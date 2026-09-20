from datetime import datetime
from typing import Any, Dict, Optional
import re
import uuid

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.connection import get_db

from app.models import (
    User,
    AIChatHistory,
)

from app.services.ai_service import (
    generate_ai_response,
)

from app.services.ai_context_service import (
    build_relevant_context,
    format_context_for_ai,
)


# =========================================================
# ROUTER
# =========================================================

router = APIRouter(
    prefix="/api/ai",
    tags=["AI Assistant"],
)


# =========================================================
# REQUEST MODEL
# =========================================================

class AIChatRequest(BaseModel):

    session_id: Optional[str] = Field(
        default=None,
        max_length=255,
    )

    # Chat history is isolated by dashboard.
    # default = DefaultDashboard
    # user    = UserDashboard
    dashboard_type: str = Field(
        default="default",
        max_length=20,
    )

    user_message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
    )

    # Live React page state. This is optional because the backend
    # database remains the source of truth for persistent data.
    # The frontend can send current route/page state and any
    # frontend-only values that the user can currently see.
    frontend_context: Optional[Dict[str, Any]] = Field(
        default=None,
    )


# =========================================================
# RESPONSE MODEL
# =========================================================

class AIChatResponse(BaseModel):

    session_id: str

    user_message: str

    ai_response: str

    created_at: datetime


# =========================================================
# CREATE SESSION ID
# =========================================================

def normalize_dashboard_type(
    value: Optional[str],
) -> str:
    """
    Normalize the dashboard scope.

    Supported values:
    - default -> DefaultDashboard
    - user    -> UserDashboard

    Unknown/empty values safely use default.
    """

    value = (
        value or "default"
    ).strip().lower()

    if value == "user":
        return "user"

    return "default"


def session_belongs_to_dashboard(
    session_id: str,
    dashboard_type: str,
) -> bool:
    """
    AI Assistant chat history is unified for the
    authenticated user across all intern pages.

    The authenticated user's user_id is the ownership
    boundary. Dashboard/page/route must not split the
    same user's AI Assistant history.

    Existing sessions are intentionally included:
        chat_...
        default_chat_...
        user_chat_...
        any other previously generated session ID
    """

    return True


# =========================================================
# SEPARATE PREPARATION HISTORY FROM AI ASSISTANT HISTORY
# =========================================================

# Preparation Agent stores its durable practice/interview records
# in the same AIChatHistory table, but marks them explicitly.
# Those records must NEVER appear in the InternMatch AI Assistant
# history.
PREPARATION_HISTORY_MARKERS = (
    "[PREPARATION_QUESTION]",
    "[PREPARATION_ANSWER]",
    "[PREPARATION_SESSION]",
    "[PREPARATION_MOCK_INTERVIEW]",
    "[PREPARATION_MOCK_QUESTION]",
    "[PREPARATION_MOCK_ANSWER]",
    "[PREPARATION_VOICE_INTERVIEW]",
    "[PREPARATION_VOICE_QUESTION]",
    "[PREPARATION_VOICE_ANSWER]",
)


def is_preparation_history_record(
    record: AIChatHistory,
) -> bool:
    message = str(
        getattr(record, "user_message", "") or ""
    ).lstrip()

    return any(
        message.startswith(marker)
        for marker in PREPARATION_HISTORY_MARKERS
    )


def is_ai_assistant_history_record(
    record: AIChatHistory,
) -> bool:
    return not is_preparation_history_record(record)


def get_ai_assistant_history(
    db: Session,
    user_id: int,
    session_id: Optional[str] = None,
):
    query = db.query(AIChatHistory).filter(
        AIChatHistory.user_id == user_id,
    )

    if session_id:
        query = query.filter(
            AIChatHistory.session_id == session_id,
        )

    records = (
        query.order_by(
            AIChatHistory.created_at.asc(),
            AIChatHistory.id.asc(),
        )
        .all()
    )

    return [
        record
        for record in records
        if is_ai_assistant_history_record(record)
    ]


def create_session_id(
    dashboard_type: str = "default",
) -> str:
    """
    Create one unified AI Assistant session ID.

    dashboard_type is accepted for API compatibility,
    but it must not create a separate chat history.
    """

    return f"chat_{uuid.uuid4().hex}"


# =========================================================
# VALIDATE DASHBOARD ACCESS
# =========================================================

def validate_dashboard_access(
    current_user: User,
    dashboard_type: str,
) -> None:
    """
    Enforce dashboard/account-role isolation before any AI work.

    default -> authenticated InternMatch accounts
    user    -> intern accounts
    """

    role = str(
        getattr(current_user, "role", "") or ""
    ).strip().lower()

    if dashboard_type == "user" and role != "intern":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "User dashboard AI is available only to internship users."
            ),
        )


# =========================================================
# CREATE CHAT TITLE
# =========================================================

def create_chat_title(
    message: str,
) -> str:

    """
    Creates a short title from the first question.

    Example:

    Input:
    "How does InternMatch AI work?"

    Output:
    "How does InternMatch AI work?"

    Long questions are shortened.
    """

    title = " ".join(
        message.strip().split()
    )

    if not title:

        return "New conversation"

    max_length = 55

    if len(title) <= max_length:

        return title

    return (
        title[:max_length]
        .rsplit(" ", 1)[0]
        + "..."
    )


# =========================================================
# CLEAN USER MESSAGE
# =========================================================

def clean_user_message(
    message: str,
) -> str:

    if message is None:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty.",
        )

    message = message.strip()

    if not message:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty.",
        )

    if len(message) > 2000:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Message is too long. "
                "Please keep your question under "
                "2000 characters."
            ),
        )

    return message


# =========================================================
# GET COMPLETE SESSION HISTORY
# =========================================================

def get_session_history(
    db: Session,
    user_id: int,
    session_id: str,
):

    return get_ai_assistant_history(
        db=db,
        user_id=user_id,
        session_id=session_id,
    )


# =========================================================
# PREPARE RECENT HISTORY FOR GROQ
# =========================================================

def prepare_recent_history_for_ai(
    history,
):

    """
    PostgreSQL keeps the complete conversation.

    Only the latest few messages are sent to Groq.

    This prevents the request from becoming too large.
    """

    # Keep only the latest 3 conversation records.
    recent_records = history[-3:]

    messages = []

    for record in recent_records:

        if record.user_message:

            messages.append(
                {
                    "role": "user",
                    "content": record.user_message[:900],
                }
            )

        if record.ai_response:

            messages.append(
                {
                    "role": "assistant",
                    "content": record.ai_response[:1200],
                }
            )

    return messages


# =========================================================
# QUESTION NUMBER EXTRACTION
# =========================================================

def get_question_number(
    message: str,
) -> Optional[int]:

    text = message.lower().strip()

    # -----------------------------------------------------
    # Numeric question numbers
    # -----------------------------------------------------

    numeric_patterns = [

        r"what was my (\d+)(?:st|nd|rd|th)? question",

        r"what is my (\d+)(?:st|nd|rd|th)? question",

        r"what did i ask in question (\d+)",

        r"what did i ask in my (\d+)(?:st|nd|rd|th)? question",

        r"tell me my (\d+)(?:st|nd|rd|th)? question",

        r"show me my (\d+)(?:st|nd|rd|th)? question",

        r"what was question number (\d+)",

        r"what is question number (\d+)",

        r"which was my (\d+)(?:st|nd|rd|th)? question",

        r"which is my (\d+)(?:st|nd|rd|th)? question",
    ]

    for pattern in numeric_patterns:

        match = re.search(
            pattern,
            text,
        )

        if not match:
            continue

        try:

            number = int(
                match.group(1)
            )

        except ValueError:

            return None

        if number >= 1:

            return number

    # -----------------------------------------------------
    # Word-based ordinals
    # -----------------------------------------------------

    ordinal_numbers = {
        "first": 1,
        "second": 2,
        "third": 3,
        "fourth": 4,
        "fifth": 5,
        "sixth": 6,
        "seventh": 7,
        "eighth": 8,
        "ninth": 9,
        "tenth": 10,
        "eleventh": 11,
        "twelfth": 12,
        "thirteenth": 13,
        "fourteenth": 14,
        "fifteenth": 15,
        "sixteenth": 16,
        "seventeenth": 17,
        "eighteenth": 18,
        "nineteenth": 19,
        "twentieth": 20,
    }

    ordinal_pattern = (
        r"\b(?:what was|what is|which was|which is) "
        r"(?:my )?"
        r"(first|second|third|fourth|fifth|sixth|seventh|eighth|"
        r"ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|"
        r"fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|"
        r"twentieth) question\b"
    )

    match = re.search(
        ordinal_pattern,
        text,
    )

    if match:
        return ordinal_numbers.get(
            match.group(1)
        )

    # Additional natural-language forms.
    for ordinal_word, number in ordinal_numbers.items():
        patterns = [
            rf"\bwhat did i ask in my {ordinal_word} question\b",
            rf"\btell me my {ordinal_word} question\b",
            rf"\bshow me my {ordinal_word} question\b",
        ]

        if any(re.search(pattern, text) for pattern in patterns):
            return number

    return None


# =========================================================
# FIRST QUESTION REQUEST
# =========================================================

def is_first_question_request(
    message: str,
) -> bool:

    text = message.lower().strip()

    phrases = [

        "what was my first question",

        "what is my first question",

        "what did i ask first",

        "what was the first question i asked",

        "show my first question",

        "tell me my first question",
    ]

    return any(
        phrase in text
        for phrase in phrases
    )


# =========================================================
# LAST QUESTION REQUEST
# =========================================================

def is_last_question_request(
    message: str,
) -> bool:

    text = message.lower().strip()

    phrases = [

        "what was my last question",

        "what is my last question",

        "what did i ask last",

        "show my last question",

        "tell me my last question",

        "what was my latest question",

        "what is my latest question",
    ]

    return any(
        phrase in text
        for phrase in phrases
    )


# =========================================================
# QUESTION COUNT REQUEST
# =========================================================

def is_question_count_request(
    message: str,
) -> bool:

    text = message.lower().strip()

    phrases = [

        "how many questions have i asked",

        "how many questions did i ask",

        "how many questions i asked",

        "number of questions i asked",

        "question count",

        "how many questions",
    ]

    return any(
        phrase in text
        for phrase in phrases
    )


# =========================================================
# MEMORY QUESTION HANDLER
# =========================================================

def answer_memory_question(
    db: Session,
    user_id: int,
    session_id: str,
    user_message: str,
) -> Optional[str]:

    history = get_session_history(
        db=db,
        user_id=user_id,
        session_id=session_id,
    )

    # =====================================================
    # QUESTION COUNT
    # =====================================================

    if is_question_count_request(
        user_message
    ):

        count = len(history)

        if count == 0:

            return (
                "You have not asked any questions "
                "in this chat yet."
            )

        if count == 1:

            return (
                "You have asked 1 question "
                "in this chat."
            )

        return (
            f"You have asked {count} questions "
            "in this chat."
        )

    # =====================================================
    # FIRST QUESTION
    # =====================================================

    if is_first_question_request(
        user_message
    ):

        if not history:

            return (
                "You have not asked a question "
                "in this chat yet."
            )

        return (
            "Your first question was:\n"
            f"{history[0].user_message}"
        )

    # =====================================================
    # LAST QUESTION
    # =====================================================

    if is_last_question_request(
        user_message
    ):

        if not history:

            return (
                "You have not asked a question "
                "in this chat yet."
            )

        return (
            "Your last question was:\n"
            f"{history[-1].user_message}"
        )

    # =====================================================
    # SPECIFIC QUESTION NUMBER
    # =====================================================

    question_number = get_question_number(
        user_message
    )

    if question_number is not None:

        if question_number > len(history):

            if len(history) == 0:

                return (
                    "You have not asked any questions "
                    "in this chat yet."
                )

            return (
                f"You have asked only "
                f"{len(history)} "
                "questions in this chat."
            )

        selected = history[
            question_number - 1
        ]

        return (
            f"Your question #{question_number} was:\n"
            f"{selected.user_message}"
        )

    return None


# =========================================================
# CHECK SESSION ACCESS
# =========================================================

def check_session_access(
    db: Session,
    user_id: int,
    session_id: str,
    dashboard_type: str = "default",
) -> None:
    """
    Verify both ownership and dashboard scope.

    A session from another dashboard is invisible to the
    current dashboard even when it belongs to the same user.
    """

    dashboard_type = normalize_dashboard_type(
        dashboard_type
    )

    if not session_belongs_to_dashboard(
        session_id,
        dashboard_type,
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found.",
        )

    user_session_records = (
        db.query(AIChatHistory)
        .filter(
            AIChatHistory.user_id == user_id,
            AIChatHistory.session_id == session_id,
        )
        .order_by(
            AIChatHistory.created_at.asc(),
            AIChatHistory.id.asc(),
        )
        .all()
    )

    # A session containing only Preparation Agent records is not
    # an AI Assistant session.
    if any(
        is_ai_assistant_history_record(record)
        for record in user_session_records
    ):
        return

    other_user_session = (
        db.query(AIChatHistory)
        .filter(
            AIChatHistory.session_id == session_id,
        )
        .first()
    )

    if other_user_session:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "You do not have access "
                "to this chat session."
            ),
        )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Chat session not found.",
    )


@router.post(
    "/chat",
    response_model=AIChatResponse,
)
def chat_with_ai(
    request: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):

    # =====================================================
    # CLEAN MESSAGE
    # =====================================================

    user_message = clean_user_message(
        request.user_message
    )

    # =====================================================
    # DASHBOARD SCOPE
    # =====================================================

    dashboard_type = normalize_dashboard_type(
        request.dashboard_type
    )

    # Never allow a caller to choose an AI dashboard scope that
    # does not match the authenticated account role.
    validate_dashboard_access(
        current_user=current_user,
        dashboard_type=dashboard_type,
    )

    # =====================================================
    # CREATE OR USE SESSION
    # =====================================================

    if request.session_id:

        session_id = request.session_id

        check_session_access(
            db=db,
            user_id=current_user.id,
            session_id=session_id,
            dashboard_type=dashboard_type,
        )

    else:

        session_id = create_session_id(
            dashboard_type
        )

    # =====================================================
    # GET COMPLETE HISTORY
    # =====================================================

    history = get_session_history(
        db=db,
        user_id=current_user.id,
        session_id=session_id,
    )

    # =====================================================
    # MEMORY QUESTIONS
    # =====================================================

    memory_answer = answer_memory_question(
        db=db,
        user_id=current_user.id,
        session_id=session_id,
        user_message=user_message,
    )

    if memory_answer is not None:

        chat_record = AIChatHistory(
            user_id=current_user.id,
            session_id=session_id,
            user_message=user_message,
            ai_response=memory_answer,
        )

        db.add(chat_record)

        try:

            db.commit()

            db.refresh(
                chat_record
            )

        except Exception as exc:

            db.rollback()

            print(
                "AI memory save error:",
                repr(exc),
            )

            raise HTTPException(
                status_code=500,
                detail=(
                    "Unable to save chat history."
                ),
            )

        return AIChatResponse(
            session_id=session_id,
            user_message=user_message,
            ai_response=memory_answer,
            created_at=chat_record.created_at,
        )

    # =====================================================
    # BUILD APPLICATION CONTEXT
    # =====================================================

    try:

        context = build_relevant_context(
            db=db,
            user_id=current_user.id,
            user_message=user_message,
            dashboard_type=dashboard_type,
            frontend_context=request.frontend_context,
        )

        # Question scope is decided by InternMatch's application
        # contract before Groq is called. Unsupported dashboard/role
        # questions receive a deterministic error instead of an
        # invented AI answer.
        question_scope = context.get(
            "question_scope",
            {},
        )

        if not question_scope.get("valid", False):
            error_message = (
                question_scope.get("error_message")
                or "That question is not available for your current dashboard or account role."
            )

            chat_record = AIChatHistory(
                user_id=current_user.id,
                session_id=session_id,
                user_message=user_message,
                ai_response=error_message,
            )

            db.add(chat_record)

            try:
                db.commit()
                db.refresh(chat_record)
            except Exception as exc:
                db.rollback()
                print(
                    "AI scope-error save error:",
                    repr(exc),
                )
                raise HTTPException(
                    status_code=500,
                    detail="Unable to save chat history.",
                )

            return AIChatResponse(
                session_id=session_id,
                user_message=user_message,
                ai_response=error_message,
                created_at=chat_record.created_at,
            )

        application_context = (
            format_context_for_ai(
                context
            )
        )

    except HTTPException:
        raise

    except Exception as exc:

        print(
            "AI context error:",
            repr(exc),
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to prepare InternMatch "
                "application context."
            ),
        )

    # =====================================================
    # RECENT HISTORY ONLY
    # =====================================================

    previous_messages = (
        prepare_recent_history_for_ai(
            history
        )
    )

    # =====================================================
    # CALL GROQ
    # =====================================================

    try:

        ai_response = generate_ai_response(
            user_message=user_message,
            previous_messages=previous_messages,
            application_context=application_context,
            dashboard_type=dashboard_type,
            user_role=str(
                getattr(current_user, "role", "") or ""
            ),
        )

    except Exception as exc:

        print(
            "Groq AI error:",
            repr(exc),
        )

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "InternMatch AI is temporarily "
                "unable to generate a response."
            ),
        )

    # =====================================================
    # SAVE COMPLETE CONVERSATION
    # =====================================================

    chat_record = AIChatHistory(
        user_id=current_user.id,
        session_id=session_id,
        user_message=user_message,
        ai_response=ai_response,
    )

    db.add(chat_record)

    try:

        db.commit()

        db.refresh(
            chat_record
        )

    except Exception as exc:

        db.rollback()

        print(
            "AI chat save error:",
            repr(exc),
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "AI response was generated, "
                "but the conversation could not "
                "be saved."
            ),
        )

    # =====================================================
    # RETURN RESPONSE
    # =====================================================

    return AIChatResponse(
        session_id=session_id,
        user_message=user_message,
        ai_response=ai_response,
        created_at=chat_record.created_at,
    )


# =========================================================
# GET ALL CHAT SESSIONS
# =========================================================

@router.get(
    "/chats",
)
def get_chat_sessions(
    dashboard_type: str = "default",
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    """
    Return only InternMatch AI Assistant chat sessions for
    the authenticated user. Preparation Agent records are excluded.
    """

    dashboard_type = normalize_dashboard_type(
        dashboard_type
    )

    validate_dashboard_access(
        current_user=current_user,
        dashboard_type=dashboard_type,
    )

    records = get_ai_assistant_history(
        db=db,
        user_id=current_user.id,
    )

    # AI Assistant history is unified across the user's intern pages.
    # dashboard_type is retained only for API compatibility and
    # frontend page context; it does not split this history.
    records = [
        record
        for record in records
        if session_belongs_to_dashboard(
            record.session_id,
            dashboard_type,
        )
    ]

    sessions = {}

    for record in records:

        session_id = record.session_id

        if session_id not in sessions:

            sessions[session_id] = {
                "session_id": session_id,

                "first_message": (
                    record.user_message
                ),

                "first_question": (
                    record.user_message
                ),

                "title": create_chat_title(
                    record.user_message
                ),

                "last_message": (
                    record.user_message
                ),

                "message_count": 0,

                "created_at": (
                    record.created_at
                ),

                "updated_at": (
                    record.created_at
                ),
            }

        sessions[session_id][
            "last_message"
        ] = record.user_message

        sessions[session_id][
            "message_count"
        ] += 1

        sessions[session_id][
            "updated_at"
        ] = record.created_at

    result = sorted(
        sessions.values(),
        key=lambda item: item[
            "updated_at"
        ],
        reverse=True,
    )

    return {
        "sessions": result,
        "total_sessions": len(result),
        "dashboard_type": "unified",
    }


@router.get(
    "/chats/{session_id}",
)
def get_chat_history(
    session_id: str,
    dashboard_type: str = "default",
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    """
    Return complete InternMatch AI Assistant history for one session.
    Preparation Agent records are excluded, and ownership remains
    restricted to the authenticated user.
    """

    dashboard_type = normalize_dashboard_type(
        dashboard_type
    )

    validate_dashboard_access(
        current_user=current_user,
        dashboard_type=dashboard_type,
    )

    check_session_access(
        db=db,
        user_id=current_user.id,
        session_id=session_id,
        dashboard_type=dashboard_type,
    )

    history = get_session_history(
        db=db,
        user_id=current_user.id,
        session_id=session_id,
    )

    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found.",
        )

    messages = []

    for index, record in enumerate(
        history,
        start=1,
    ):
        messages.append(
            {
                "id": record.id,

                "question_number": index,

                "session_id": (
                    record.session_id
                ),

                "user_message": (
                    record.user_message
                ),

                "ai_response": (
                    record.ai_response
                ),

                "created_at": (
                    record.created_at
                ),
            }
        )

    return {
        "session_id": session_id,

        "title": create_chat_title(
            history[0].user_message
        ),

        "messages": messages,

        "total_messages": len(messages),

        "dashboard_type": "unified",
    }


@router.delete(
    "/chats/{session_id}",
)
def delete_chat_session(
    session_id: str,
    dashboard_type: str = "default",
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    """
    Delete one InternMatch AI Assistant chat session only.
    """

    dashboard_type = normalize_dashboard_type(
        dashboard_type
    )

    validate_dashboard_access(
        current_user=current_user,
        dashboard_type=dashboard_type,
    )

    check_session_access(
        db=db,
        user_id=current_user.id,
        session_id=session_id,
        dashboard_type=dashboard_type,
    )

    records = (
        db.query(AIChatHistory)
        .filter(
            AIChatHistory.user_id == current_user.id,
            AIChatHistory.session_id == session_id,
        )
        .all()
    )

    if not records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found.",
        )

    for record in records:
        db.delete(record)

    db.commit()

    return {
        "message": (
            "Chat session deleted successfully."
        ),
        "session_id": session_id,
        "dashboard_type": "unified",
    }


@router.delete(
    "/chats",
)
def delete_all_chats(
    dashboard_type: str = "default",
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    """
    Delete all chat history belonging to the current
    dashboard only. Chats on the other dashboard remain.
    """

    dashboard_type = normalize_dashboard_type(
        dashboard_type
    )

    validate_dashboard_access(
        current_user=current_user,
        dashboard_type=dashboard_type,
    )

    records = (
        db.query(AIChatHistory)
        .filter(
            AIChatHistory.user_id == current_user.id
        )
        .all()
    )

    scoped_records = [
        record
        for record in records
        if session_belongs_to_dashboard(
            record.session_id,
            dashboard_type,
        )
    ]

    deleted_count = len(scoped_records)

    for record in scoped_records:
        db.delete(record)

    db.commit()

    return {
        "message": (
            "Dashboard-specific AI chat history "
            "deleted successfully."
        ),
        "deleted_messages": deleted_count,
        "dashboard_type": "unified",
    }

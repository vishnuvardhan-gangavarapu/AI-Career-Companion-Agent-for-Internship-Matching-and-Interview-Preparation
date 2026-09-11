from typing import Any, Dict, Optional
import json

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.connection import get_db
from app.models import User
from app.services.preparation_service import (
    complete_preparation_session,
    create_preparation_session,
    evaluate_preparation_answer,
    generate_preparation_question,
    get_preparation_answers,
    get_preparation_overview,
    get_preparation_session_result,
    get_preparation_question,
    get_ai_learning_recommendations,
    preparation_chat,
    save_preparation_answer,
    PreparationQuestionState,
    PreparationSessionState,
    create_voice_interview_session,
    generate_voice_interview_question,
    evaluate_voice_interview_answer,
    save_voice_interview_answer,
    complete_voice_interview,
    get_voice_interview_progress,
    get_voice_interview_question,
    create_mock_interview_session,
    generate_mock_interview_question,
    evaluate_mock_interview_answer,
    save_mock_interview_answer,
    complete_mock_interview,
    get_mock_interview_progress,
    get_mock_interview_question,
)

router = APIRouter(
    prefix="/api/preparation",
    tags=["Preparation Agent"],
)


# ============================================================
# REQUEST SCHEMAS
# ============================================================

class PreparationChatRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Message/question sent to the preparation agent.",
    )

    target_role: Optional[str] = Field(
        default=None,
        max_length=150,
        description="Optional target role.",
    )

    context: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional frontend/page context.",
    )


class CreateSessionRequest(BaseModel):
    session_type: str = Field(
        default="practice",
        max_length=50,
        description="Type of preparation session.",
    )

    category: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Technical, HR, resume, mixed, etc.",
    )

    target_role: Optional[str] = Field(
        default=None,
        max_length=150,
        description="Role being prepared for.",
    )

    difficulty: Optional[str] = Field(
        default="medium",
        max_length=50,
        description="easy, medium, or hard.",
    )


class GenerateQuestionRequest(BaseModel):
    session_id: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Preparation practice session ID.",
    )

    topic: Optional[str] = Field(
        default=None,
        max_length=150,
        description="Specific interview topic.",
    )

    category: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Question category.",
    )

    target_role: Optional[str] = Field(
        default=None,
        max_length=150,
        description="Target role.",
    )

    difficulty: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Question difficulty.",
    )


class EvaluateAnswerRequest(BaseModel):
    question_id: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Preparation question ID.",
    )

    answer: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="Candidate's answer.",
    )


class SaveAnswerRequest(BaseModel):
    question_id: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Preparation question ID.",
    )

    answer: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="Candidate's answer.",
    )

    answer_type: str = Field(
        default="text",
        max_length=30,
        description="text, voice, etc.",
    )

    evaluation: Optional[Any] = Field(
        default=None,
        description="AI evaluation result.",
    )


# ============================================================
# SERIALIZATION HELPERS
# ============================================================

def _serialize_session(
    session: Optional[PreparationSessionState],
) -> Optional[Dict[str, Any]]:
    if session is None:
        return None

    return {
        "id": session.id,
        "user_id": session.user_id,
        "session_type": session.session_type,
        "category": session.category,
        "target_role": session.target_role,
        "difficulty": session.difficulty,
        "status": session.status,
        "score": session.score,
        "started_at": (
            session.created_at.isoformat()
            if session.created_at
            else None
        ),
        "created_at": (
            session.created_at.isoformat()
            if session.created_at
            else None
        ),
        "completed_at": (
            session.completed_at.isoformat()
            if session.completed_at
            else None
        ),
    }


def _serialize_question(
    question: Optional[PreparationQuestionState],
) -> Optional[Dict[str, Any]]:
    if question is None:
        return None

    return {
        "id": question.id,
        "session_id": question.session_id,
        "user_id": question.user_id,
        "question": question.question,
        "category": question.category,
        "topic": question.topic,
        "difficulty": question.difficulty,
        "source": question.source,
        "created_at": (
            question.created_at.isoformat()
            if question.created_at
            else None
        ),
    }


def _serialize_answer(answer: Any) -> Dict[str, Any]:
    return {
        "id": answer.id,
        "question_id": answer.question_id,
        "user_id": answer.user_id,
        "answer": answer.answer,
        "answer_type": "text",
        "score": answer.score,
        "feedback": answer.feedback,
        "created_at": (
            answer.created_at.isoformat()
            if answer.created_at
            else None
        ),
    }


# ============================================================
# 1. PREPARATION OVERVIEW
# ============================================================

@router.get(
    "/overview",
    summary="Get preparation overview",
)
def preparation_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        overview = get_preparation_overview(
            db=db,
            user_id=current_user.id,
        )

        return {
            "success": True,
            "data": overview,
        }

    except HTTPException:
        raise

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to load preparation overview: {str(exc)}",
        )


@router.get(
    "/learning-recommendations",
    summary="Get AI learning recommendations",
)
def learning_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        recommendations = get_ai_learning_recommendations(
            db=db,
            user_id=current_user.id,
        )

        return {
            "success": True,
            "data": recommendations,
        }

    except HTTPException:
        raise

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to generate learning recommendations: {str(exc)}",
        )


# ============================================================
# 2. PREPARATION CHAT
# ============================================================

@router.post(
    "/chat",
    summary="Chat with preparation agent",
)
def preparation_agent_chat(
    request: PreparationChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    message = request.message.strip()

    if not message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty.",
        )

    try:
        result = preparation_chat(
            db=db,
            user_id=current_user.id,
            user_message=message,
            previous_messages=None,
        )

        return {
            "success": True,
            "data": result,
        }

    except HTTPException:
        raise

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Preparation agent failed: {str(exc)}",
        )


# ============================================================
# 3. CREATE PREPARATION SESSION
# ============================================================

@router.post(
    "/session",
    status_code=status.HTTP_201_CREATED,
    summary="Create preparation session",
)
def create_session(
    request: CreateSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session_type = request.session_type.strip() or "practice"

    category = (
        request.category.strip()
        if request.category
        else "mixed"
    )

    target_role = (
        request.target_role.strip()
        if request.target_role
        else "General"
    )

    difficulty = (
        request.difficulty.strip()
        if request.difficulty
        else "medium"
    )

    try:
        session = create_preparation_session(
            db=db,
            user_id=current_user.id,
            category=category,
            target_role=target_role,
            difficulty=difficulty,
            session_type=session_type,
        )

        return {
            "success": True,
            "message": "Preparation session created successfully.",
            "data": _serialize_session(session),
        }

    except HTTPException:
        raise

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to create preparation session: {str(exc)}",
        )


# ============================================================
# 4. GENERATE QUESTION
# ============================================================

@router.post(
    "/question",
    status_code=status.HTTP_201_CREATED,
    summary="Generate preparation question",
)
def generate_question(
    request: GenerateQuestionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    category = (
        request.category.strip()
        if request.category
        else "mixed"
    )

    target_role = (
        request.target_role.strip()
        if request.target_role
        else "General"
    )

    difficulty = (
        request.difficulty.strip()
        if request.difficulty
        else "medium"
    )

    topic = (
        request.topic.strip()
        if request.topic
        else category or target_role or "general interview"
    )

    # The session is intentionally held in application/session state,
    # not in a separate preparation database table.
    session = PreparationSessionState(
        id=request.session_id.strip(),
        user_id=current_user.id,
        category=category,
        target_role=target_role,
        difficulty=difficulty,
        session_type="practice",
        status="active",
    )

    try:
        question = generate_preparation_question(
            db=db,
            user_id=current_user.id,
            session=session,
            topic=topic,
        )

        return {
            "success": True,
            "message": "Preparation question generated successfully.",
            "data": _serialize_question(question),
        }

    except HTTPException:
        raise

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to generate preparation question: {str(exc)}",
        )


# ============================================================
# 5. EVALUATE ANSWER
# ============================================================

@router.post(
    "/answer/evaluate",
    summary="Evaluate preparation answer",
)
def evaluate_answer(
    request: EvaluateAnswerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    answer = request.answer.strip()

    if not answer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Answer cannot be empty.",
        )

    question = get_preparation_question(
        db=db,
        user_id=current_user.id,
        question_id=request.question_id.strip(),
    )

    if question is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preparation question not found.",
        )

    try:
        evaluation = evaluate_preparation_answer(
            db=db,
            user_id=current_user.id,
            question=question,
            user_answer=answer,
        )

        saved_answer = save_preparation_answer(
            db=db,
            user_id=current_user.id,
            question_id=question.id,
            user_answer=answer,
            evaluation=evaluation,
        )

        return {
            "success": True,
            "message": "Answer evaluated and saved successfully.",
            "data": evaluation,
            "saved": True,
            "answer": _serialize_answer(saved_answer),
        }

    except HTTPException:
        raise

    except ValueError as exc:
        db.rollback()

        # ValueError here means a validation/evaluation problem, not an
        # authorization failure. Returning 403 made internal Python errors
        # look like permission errors in the frontend.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to evaluate answer: {str(exc)}",
        )


# ============================================================
# 6. SAVE ANSWER
# ============================================================

@router.post(
    "/answer",
    status_code=status.HTTP_201_CREATED,
    summary="Save preparation answer",
)
def save_answer(
    request: SaveAnswerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    answer_text = request.answer.strip()

    if not answer_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Answer cannot be empty.",
        )

    question_id = request.question_id.strip()

    question = get_preparation_question(
        db=db,
        user_id=current_user.id,
        question_id=question_id,
    )

    if question is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preparation question not found.",
        )

    # Prevent duplicate answer records for the same question.
    existing_answers = get_preparation_answers(
        db=db,
        user_id=current_user.id,
        session_id=question.session_id,
    )

    if any(
        item.question_id == question.id
        for item in existing_answers
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This question has already been answered.",
        )

    try:
        if isinstance(request.evaluation, str):
            evaluation_text = request.evaluation
        elif request.evaluation is not None:
            evaluation_text = str(request.evaluation)
        else:
            evaluation_text = ""

        saved_answer = save_preparation_answer(
            db=db,
            user_id=current_user.id,
            question_id=question.id,
            user_answer=answer_text,
            evaluation=evaluation_text,
        )

        return {
            "success": True,
            "message": "Answer saved successfully.",
            "data": _serialize_answer(saved_answer),
        }

    except HTTPException:
        raise

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to save preparation answer: {str(exc)}",
        )


# ============================================================
# 7. COMPLETE SESSION
# ============================================================

@router.post(
    "/session/{session_id}/complete",
    summary="Complete preparation session",
)
def complete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    clean_session_id = session_id.strip()

    if not clean_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session ID cannot be empty.",
        )

    try:
        completed = complete_preparation_session(
            db=db,
            session_id=clean_session_id,
            user_id=current_user.id,
        )

        if completed is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Preparation session not found.",
            )

        result = get_preparation_session_result(
            db=db,
            user_id=current_user.id,
            session_id=clean_session_id,
        )

        return {
            "success": True,
            "message": "Preparation session completed successfully.",
            "data": {
                **(_serialize_session(completed) or {}),
                "result": result,
            },
        }

    except HTTPException:
        raise

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to complete preparation session: {str(exc)}",
        )


# ============================================================
# 7.1 PRACTICE SESSION RESULT
# ============================================================

@router.get(
    "/session/{session_id}/result",
    summary="Get completed preparation session evaluation",
)
def preparation_session_result(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    clean_session_id = session_id.strip()
    if not clean_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session ID cannot be empty.",
        )

    try:
        result = get_preparation_session_result(
            db=db,
            user_id=current_user.id,
            session_id=clean_session_id,
        )
        if result["total_questions"] == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Preparation session result not found.",
            )
        return {"success": True, "data": result}
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to load preparation evaluation: {str(exc)}",
        )


# ============================================================
# 8. VOICE INTERVIEW — PHASE 2 STEP 10
# ============================================================

class CreateVoiceInterviewRequest(BaseModel):
    target_role: Optional[str] = Field(
        default="Software Engineering Intern",
        max_length=150,
    )
    category: Optional[str] = Field(
        default="mixed",
        max_length=100,
    )
    difficulty: Optional[str] = Field(
        default="medium",
        max_length=50,
    )
    total_questions: int = Field(
        default=10,
        ge=1,
        le=30,
    )


class GenerateVoiceQuestionRequest(BaseModel):
    interview_id: str = Field(
        ...,
        min_length=1,
        max_length=100,
    )
    target_role: Optional[str] = Field(
        default="Software Engineering Intern",
        max_length=150,
    )
    category: Optional[str] = Field(
        default="mixed",
        max_length=100,
    )
    difficulty: Optional[str] = Field(
        default="medium",
        max_length=50,
    )
    question_number: int = Field(
        default=1,
        ge=1,
        le=30,
    )
    total_questions: int = Field(
        default=10,
        ge=1,
        le=30,
    )


class EvaluateVoiceAnswerRequest(BaseModel):
    interview_id: str = Field(
        ...,
        min_length=1,
        max_length=100,
    )
    question_id: str = Field(
        ...,
        min_length=1,
        max_length=100,
    )
    question: str = Field(
        ...,
        min_length=1,
        max_length=5000,
    )
    transcript: str = Field(
        ...,
        min_length=1,
        max_length=20000,
    )
    target_role: Optional[str] = Field(
        default="Software Engineering Intern",
        max_length=150,
    )
    category: Optional[str] = Field(
        default="mixed",
        max_length=100,
    )
    difficulty: Optional[str] = Field(
        default="medium",
        max_length=50,
    )
    question_number: int = Field(
        default=1,
        ge=1,
        le=30,
    )
    total_questions: int = Field(
        default=10,
        ge=1,
        le=30,
    )


class SaveVoiceAnswerRequest(BaseModel):
    interview_id: str = Field(
        ...,
        min_length=1,
        max_length=100,
    )
    question_id: str = Field(
        ...,
        min_length=1,
        max_length=100,
    )
    question: str = Field(
        ...,
        min_length=1,
        max_length=5000,
    )
    transcript: str = Field(
        ...,
        min_length=1,
        max_length=20000,
    )
    score: float = Field(
        default=0.0,
        ge=0,
        le=10,
    )
    # Accept the complete structured AI evaluation from the frontend.
    # Older clients may still send a plain string, so both shapes are supported.
    evaluation: Any = Field(default="")
    question_number: int = Field(
        default=1,
        ge=1,
        le=30,
    )
    total_questions: int = Field(
        default=10,
        ge=1,
        le=30,
    )


def _serialize_voice_question(question: Any) -> Optional[Dict[str, Any]]:
    if question is None:
        return None

    if isinstance(question, dict):
        return question

    return {
        "id": question.question_id,
        "question_id": question.question_id,
        "interview_id": question.interview_id,
        "question": question.question,
        "category": question.category,
        "difficulty": question.difficulty,
        "target_role": question.target_role,
        "question_number": question.question_number,
        "total_questions": question.total_questions,
    }


# ------------------------------------------------------------
# 8.1 CREATE VOICE INTERVIEW
# ------------------------------------------------------------

@router.post(
    "/voice-interview",
    status_code=status.HTTP_201_CREATED,
    summary="Create voice interview session",
)
def create_voice_interview(
    request: CreateVoiceInterviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target_role = (
        request.target_role.strip()
        if request.target_role
        else "Software Engineering Intern"
    )
    category = (
        request.category.strip()
        if request.category
        else "mixed"
    )
    difficulty = (
        request.difficulty.strip()
        if request.difficulty
        else "medium"
    )

    try:
        session = create_voice_interview_session(
            user_id=current_user.id,
            target_role=target_role,
            difficulty=difficulty,
            category=category,
            total_questions=request.total_questions,
        )

        return {
            "success": True,
            "message": "Voice interview session created successfully.",
            "data": session,
        }

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to create voice interview: {str(exc)}",
        )


# ------------------------------------------------------------
# 8.2 GENERATE VOICE QUESTION
# ------------------------------------------------------------

@router.post(
    "/voice-interview/question",
    status_code=status.HTTP_201_CREATED,
    summary="Generate voice interview question",
)
def generate_voice_question(
    request: GenerateVoiceQuestionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        candidate = get_preparation_overview(
            db=db,
            user_id=current_user.id,
        )

        question = generate_voice_interview_question(
            db=db,
            user_id=current_user.id,
            interview_id=request.interview_id.strip(),
            candidate=candidate,
            target_role=(
                request.target_role.strip()
                if request.target_role
                else "Software Engineering Intern"
            ),
            category=(
                request.category.strip()
                if request.category
                else "mixed"
            ),
            difficulty=(
                request.difficulty.strip()
                if request.difficulty
                else "medium"
            ),
            question_number=request.question_number,
            total_questions=request.total_questions,
        )

        return {
            "success": True,
            "message": "Voice interview question generated successfully.",
            "data": _serialize_voice_question(question),
        }

    except HTTPException:
        raise

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to generate voice question: {str(exc)}",
        )


# ------------------------------------------------------------
# 8.3 EVALUATE VOICE TRANSCRIPT
# ------------------------------------------------------------

@router.post(
    "/voice-interview/evaluate",
    summary="Evaluate voice interview transcript",
)
def evaluate_voice_answer(
    request: EvaluateVoiceAnswerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    transcript = request.transcript.strip()

    if not transcript:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transcript cannot be empty.",
        )

    try:
        # Evaluate and persist in the SAME request. The old flow made:
        #   1) POST /evaluate
        #   2) POST /answer
        #   3) GET /progress
        # which added avoidable network/database latency.
        candidate = get_preparation_overview(
            db=db,
            user_id=current_user.id,
        )

        evaluation = evaluate_voice_interview_answer(
            candidate=candidate,
            question=request.question.strip(),
            transcript=transcript,
            target_role=(
                request.target_role.strip()
                if request.target_role
                else "Software Engineering Intern"
            ),
            category=(
                request.category.strip()
                if request.category
                else "mixed"
            ),
            difficulty=(
                request.difficulty.strip()
                if request.difficulty
                else "medium"
            ),
        )

        saved = save_voice_interview_answer(
            db=db,
            user_id=current_user.id,
            interview_id=request.interview_id.strip(),
            question_id=request.question_id.strip(),
            question=request.question.strip(),
            transcript=transcript,
            evaluation=evaluation,
            question_number=request.question_number,
            total_questions=request.total_questions,
        )

        # Return the saved record so the frontend can update its local state
        # without making another GET /progress request.
        return {
            "success": True,
            "message": "Answer evaluated and saved successfully.",
            "data": {
                **evaluation,
                "saved": True,
                "saved_answer": saved,
            },
        }

    except HTTPException:
        raise

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to evaluate voice answer: {str(exc)}",
        )


# ------------------------------------------------------------
# 8.4 SAVE VOICE ANSWER
# ------------------------------------------------------------

@router.post(
    "/voice-interview/answer",
    status_code=status.HTTP_201_CREATED,
    summary="Save voice interview answer",
)
def save_voice_answer(
    request: SaveVoiceAnswerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    transcript = request.transcript.strip()

    if not transcript:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transcript cannot be empty.",
        )

    try:
        raw_evaluation = request.evaluation
        if isinstance(raw_evaluation, str):
            try:
                parsed_evaluation = json.loads(raw_evaluation)
                if not isinstance(parsed_evaluation, dict):
                    parsed_evaluation = {"evaluation": raw_evaluation}
            except (TypeError, ValueError, json.JSONDecodeError):
                parsed_evaluation = {"evaluation": raw_evaluation}
        elif isinstance(raw_evaluation, dict):
            parsed_evaluation = dict(raw_evaluation)
        else:
            parsed_evaluation = {"evaluation": str(raw_evaluation or "")}

        parsed_evaluation["score"] = request.score

        saved = save_voice_interview_answer(
            db=db,
            user_id=current_user.id,
            interview_id=request.interview_id.strip(),
            question_id=request.question_id.strip(),
            question=request.question.strip(),
            transcript=transcript,
            evaluation=parsed_evaluation,
            question_number=request.question_number,
            total_questions=request.total_questions,
        )

        return {
            "success": True,
            "message": "Voice interview answer saved successfully.",
            "data": saved,
        }

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to save voice answer: {str(exc)}",
        )


# ------------------------------------------------------------
# 8.5 GET VOICE INTERVIEW QUESTION
# ------------------------------------------------------------

@router.get(
    "/voice-interview/{interview_id}/question/{question_id}",
    summary="Get voice interview question",
)
def get_voice_question(
    interview_id: str,
    question_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        question = get_voice_interview_question(
            db=db,
            user_id=current_user.id,
            interview_id=interview_id.strip(),
            question_id=question_id.strip(),
        )

        if question is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Voice interview question not found.",
            )

        return {
            "success": True,
            "data": _serialize_voice_question(question),
        }

    except HTTPException:
        raise

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to load voice question: {str(exc)}",
        )


# ------------------------------------------------------------
# 8.6 VOICE INTERVIEW PROGRESS
# ------------------------------------------------------------

@router.get(
    "/voice-interview/{interview_id}/progress",
    summary="Get voice interview progress",
)
def voice_interview_progress(
    interview_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        progress = get_voice_interview_progress(
            db=db,
            user_id=current_user.id,
            interview_id=interview_id.strip(),
        )

        return {
            "success": True,
            "data": progress,
        }

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to load voice interview progress: {str(exc)}",
        )


# ------------------------------------------------------------
# 8.7 COMPLETE VOICE INTERVIEW
# ------------------------------------------------------------

@router.post(
    "/voice-interview/{interview_id}/complete",
    summary="Complete voice interview",
)
def complete_voice(
    interview_id: str,
    total_questions: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if total_questions < 1 or total_questions > 30:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="total_questions must be between 1 and 30.",
        )

    try:
        result = complete_voice_interview(
            db=db,
            user_id=current_user.id,
            interview_id=interview_id.strip(),
            total_questions=total_questions,
        )

        return {
            "success": True,
            "message": "Voice interview completed successfully.",
            "data": result,
        }

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to complete voice interview: {str(exc)}",
        )


# ============================================================
# 9. MOCK INTERVIEW — PHASE 3 FOUNDATION
# ============================================================

class CreateMockInterviewRequest(BaseModel):
    category: Optional[str] = Field(default="Mixed", max_length=100)
    target_role: Optional[str] = Field(default=None, max_length=150)
    difficulty: Optional[str] = Field(default="medium", max_length=50)


class GenerateMockQuestionRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=100)
    question_number: int = Field(default=1, ge=1, le=30)
    category: Optional[str] = Field(default=None, max_length=100)
    target_role: Optional[str] = Field(default=None, max_length=150)
    difficulty: Optional[str] = Field(default=None, max_length=50)

class EvaluateMockAnswerRequest(BaseModel):
    question_id: str = Field(..., min_length=1, max_length=100)
    answer: str = Field(..., min_length=1, max_length=10000)


class SaveMockAnswerRequest(BaseModel):
    question_id: str = Field(..., min_length=1, max_length=100)
    answer: str = Field(..., min_length=1, max_length=10000)
    evaluation: Optional[str] = Field(default=None, max_length=20000)


def _serialize_mock_question(question: Any) -> Optional[Dict[str, Any]]:
    if question is None:
        return None

    return {
        "id": question.id,
        "question_id": question.id,
        "session_id": question.session_id,
        "user_id": question.user_id,
        "question": question.question,
        "category": question.category,
        "topic": question.topic,
        "difficulty": question.difficulty,
        "target_role": question.target_role,
        "question_number": question.question_number,
        "created_at": (
            question.created_at.isoformat()
            if getattr(question, "created_at", None)
            else None
        ),
    }


@router.post(
    "/mock-interview",
    status_code=status.HTTP_201_CREATED,
    summary="Create mock interview session",
)
def create_mock_interview(
    request: CreateMockInterviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        session = create_mock_interview_session(
            db=db,
            user_id=current_user.id,
            category=request.category.strip() if request.category else "Mixed",
            target_role=request.target_role.strip() if request.target_role else "",
            difficulty=request.difficulty.strip() if request.difficulty else "medium",
        )

        return {
            "success": True,
            "message": "Mock interview session created successfully.",
            "data": _serialize_session(session),
        }

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to create mock interview: {str(exc)}",
        )


@router.post(
    "/mock-interview/question",
    status_code=status.HTTP_201_CREATED,
    summary="Generate mock interview question",
)
def generate_mock_question(
    request: GenerateMockQuestionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session_id = request.session_id.strip()

    try:
        # The frontend sends the selected interview configuration with every
        # question request. There is no preparation-session database table, so
        # the router must not silently replace the candidate's selections with
        # defaults.
        session = PreparationSessionState(
            id=session_id,
            user_id=current_user.id,
            category=(request.category.strip() if request.category else "Mixed"),
            target_role=(
                request.target_role.strip()
                if request.target_role
                else "Software Engineering Intern"
            ),
            difficulty=(request.difficulty.strip() if request.difficulty else "medium"),
            session_type="mock_interview",
            status="active",
        )

        question = generate_mock_interview_question(
            db=db,
            user_id=current_user.id,
            session=session,
            question_number=request.question_number,
        )

        return {
            "success": True,
            "message": "Mock interview question generated successfully.",
            "data": _serialize_mock_question(question),
        }

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to generate mock interview question: {str(exc)}",
        )


@router.get(
    "/mock-interview/question/{question_id}",
    summary="Get mock interview question",
)
def get_mock_question(
    question_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        question = get_mock_interview_question(
            db=db,
            user_id=current_user.id,
            question_id=question_id.strip(),
        )

        if question is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mock interview question not found.",
            )

        return {
            "success": True,
            "data": _serialize_mock_question(question),
        }

    except HTTPException:
        raise

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to load mock interview question: {str(exc)}",
        )


@router.post(
    "/mock-interview/answer/evaluate",
    summary="Evaluate mock interview answer",
)
def evaluate_mock_answer(
    request: EvaluateMockAnswerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    answer = request.answer.strip()

    if not answer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Answer cannot be empty.",
        )

    try:
        question = get_mock_interview_question(
            db=db,
            user_id=current_user.id,
            question_id=request.question_id.strip(),
        )

        if question is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mock interview question not found.",
            )

        evaluation = evaluate_mock_interview_answer(
            db=db,
            user_id=current_user.id,
            question=question,
            user_answer=answer,
        )

        try:
            evaluation_payload = json.loads(evaluation) if isinstance(evaluation, str) else evaluation
        except (TypeError, ValueError, json.JSONDecodeError):
            evaluation_payload = {"raw_evaluation": str(evaluation or "")}

        saved_answer = save_mock_interview_answer(
            db=db,
            user_id=current_user.id,
            question=question,
            user_answer=answer,
            evaluation=json.dumps(evaluation_payload, ensure_ascii=False),
        )

        return {
            "success": True,
            "message": "Answer evaluated and saved successfully.",
            "data": {
                "evaluation": evaluation_payload,
                "saved": True,
                "answer": _serialize_answer(saved_answer),
            },
        }

    except HTTPException:
        raise

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to evaluate mock interview answer: {str(exc)}",
        )


@router.post(
    "/mock-interview/answer",
    status_code=status.HTTP_201_CREATED,
    summary="Save mock interview answer",
)
def save_mock_answer(
    request: SaveMockAnswerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    answer = request.answer.strip()

    if not answer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Answer cannot be empty.",
        )

    try:
        question = get_mock_interview_question(
            db=db,
            user_id=current_user.id,
            question_id=request.question_id.strip(),
        )

        if question is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mock interview question not found.",
            )

        saved = save_mock_interview_answer(
            db=db,
            user_id=current_user.id,
            question=question,
            user_answer=answer,
            evaluation=request.evaluation,
        )

        return {
            "success": True,
            "message": "Mock interview answer saved successfully.",
            "data": _serialize_answer(saved),
        }

    except HTTPException:
        raise

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to save mock interview answer: {str(exc)}",
        )


@router.get(
    "/mock-interview/{session_id}/progress",
    summary="Get mock interview progress",
)
def mock_interview_progress(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        progress = get_mock_interview_progress(
            db=db,
            user_id=current_user.id,
            session_id=session_id.strip(),
        )

        return {
            "success": True,
            "data": progress,
        }

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to load mock interview progress: {str(exc)}",
        )


@router.post(
    "/mock-interview/{session_id}/complete",
    summary="Complete mock interview",
)
def complete_mock(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        normalized_session_id = session_id.strip()
        result = complete_mock_interview(
            db=db,
            user_id=current_user.id,
            session_id=normalized_session_id,
        )

        # Re-read persisted history after completion. This guarantees the
        # response contains the answer/evaluation that was saved immediately
        # before the finish action.
        progress = get_mock_interview_progress(
            db=db,
            user_id=current_user.id,
            session_id=normalized_session_id,
        )

        merged = {**result, **progress, "status": "completed"}
        if not merged.get("answer_evaluations"):
            merged["answer_evaluations"] = result.get("answer_evaluations", [])

        return {
            "success": True,
            "message": "Mock interview completed successfully.",
            "data": merged,
        }

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to complete mock interview: {str(exc)}",
        )


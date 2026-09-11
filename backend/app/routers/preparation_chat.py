from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)

from pydantic import BaseModel, Field

from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.connection import get_db

from app.models import (
    User,
    PreparationConversation,
    PreparationDocument,
)

from app.services.preparation_document_service import (
    document_to_dict,
    process_uploaded_document,
)

from app.services import (
    preparation_chat_service,
)


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/api/preparation-chat",
    tags=["Preparation Chat"],
)


# ============================================================
# REQUEST SCHEMA
# ============================================================

class PreparationChatMessageRequest(
    BaseModel
):

    conversation_id: Optional[int] = None

    message: str = Field(
        ...,
        min_length=1,
        max_length=10000,
    )

    document_ids: list[int] = Field(
        default_factory=list
    )


# ============================================================
# SERIALIZATION
# ============================================================

def serialize_conversation(
    conversation: PreparationConversation,
) -> dict[str, Any]:

    return (
        preparation_chat_service
        .conversation_to_dict(
            conversation
        )
    )


def serialize_document(
    document: PreparationDocument,
) -> dict[str, Any]:

    return document_to_dict(
        document
    )


def serialize_message(
    db: Session,
    message,
) -> dict[str, Any]:

    return (
        preparation_chat_service
        .message_to_dict(
            db,
            message,
        )
    )


# ============================================================
# CREATE CONVERSATION
# ============================================================

@router.post(
    "/conversations",
    status_code=status.HTTP_201_CREATED,
)
def create_preparation_conversation(
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):

    try:

        conversation = (
            preparation_chat_service
            .create_conversation(
                db,
                current_user.id,
            )
        )

        db.commit()

        db.refresh(
            conversation
        )

        return {
            "success": True,
            "data": serialize_conversation(
                conversation
            ),
        }

    except Exception as exc:

        db.rollback()

        print(
            "\n========== "
            "PREPARATION CHAT CONVERSATION ERROR "
            "=========="
        )

        print(
            f"User ID: {current_user.id}"
        )

        print(
            f"Error type: {type(exc).__name__}"
        )

        print(
            f"Error: {exc}"
        )

        print(
            "==========================================\n"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to create Preparation Chat "
                f"conversation: {exc}"
            ),
        ) from exc


# ============================================================
# GET CONVERSATIONS
# ============================================================

@router.get(
    "/conversations"
)
def get_preparation_conversations(
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):

    conversations = (
        preparation_chat_service
        .get_conversations(
            db,
            current_user.id,
        )
    )

    return {
        "success": True,
        "data": [
            serialize_conversation(
                item
            )
            for item in conversations
        ],
    }


# ============================================================
# GET SINGLE CONVERSATION
# ============================================================

@router.get(
    "/conversations/{conversation_id}"
)
def get_preparation_conversation(
    conversation_id: int,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):

    conversation = (
        preparation_chat_service
        .get_conversation(
            db,
            current_user.id,
            conversation_id,
        )
    )

    if conversation is None:

        raise HTTPException(
            status_code=404,
            detail=(
                "Preparation Chat conversation "
                "not found."
            ),
        )

    documents = (
        db.query(
            PreparationDocument
        )
        .filter(
            PreparationDocument.conversation_id
            == conversation_id
        )
        .order_by(
            PreparationDocument.created_at.asc(),
            PreparationDocument.id.asc(),
        )
        .all()
    )

    messages = (
        preparation_chat_service
        .get_messages(
            db,
            current_user.id,
            conversation_id,
        )
    )

    return {
        "success": True,
        "data": {
            "conversation": serialize_conversation(
                conversation
            ),
            "documents": [
                serialize_document(
                    item
                )
                for item in documents
            ],
            "messages": [
                serialize_message(
                    db,
                    item,
                )
                for item in messages
            ],
        },
    }


# ============================================================
# DELETE CONVERSATION
# ============================================================

@router.delete(
    "/conversations/{conversation_id}"
)
def delete_preparation_conversation(
    conversation_id: int,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):

    conversation = (
        preparation_chat_service
        .get_conversation(
            db,
            current_user.id,
            conversation_id,
        )
    )

    if conversation is None:

        raise HTTPException(
            status_code=404,
            detail=(
                "Preparation Chat conversation "
                "not found."
            ),
        )

    # --------------------------------------------------------
    # Save physical file paths before DB cascade delete
    # --------------------------------------------------------

    paths = [
        Path(
            document.storage_path
        )
        for document in conversation.documents
        if document.storage_path
    ]

    # --------------------------------------------------------
    # Delete database conversation
    # --------------------------------------------------------

    if not (
        preparation_chat_service
        .delete_conversation(
            db,
            current_user.id,
            conversation_id,
        )
    ):

        raise HTTPException(
            status_code=404,
            detail=(
                "Preparation Chat conversation "
                "not found."
            ),
        )

    # --------------------------------------------------------
    # Delete physical files
    # --------------------------------------------------------

    for path in paths:

        try:

            if path.exists():

                path.unlink()

        except OSError:

            pass

    return {
        "success": True,
        "conversation_id": conversation_id,
    }


# ============================================================
# UPLOAD DOCUMENT
# ============================================================

@router.post(
    "/conversations/{conversation_id}/documents",
    status_code=status.HTTP_201_CREATED,
)
def upload_preparation_document(
    conversation_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):

    conversation = (
        preparation_chat_service
        .get_conversation(
            db,
            current_user.id,
            conversation_id,
        )
    )

    if conversation is None:

        raise HTTPException(
            status_code=404,
            detail=(
                "Preparation Chat conversation "
                "not found."
            ),
        )

    try:

        document = (
            process_uploaded_document(
                db=db,
                upload_file=file,
                user_id=current_user.id,
                conversation_id=conversation_id,
            )
        )

        db.commit()

        db.refresh(
            document
        )

        return {
            "success": True,
            "data": serialize_document(
                document
            ),
        }

    except ValueError as exc:

        db.rollback()

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:

        db.rollback()

        print(
            "\n========== "
            "PREPARATION CHAT DOCUMENT ERROR "
            "=========="
        )

        print(
            f"User ID: {current_user.id}"
        )

        print(
            f"Conversation ID: {conversation_id}"
        )

        print(
            f"File: {file.filename}"
        )

        print(
            f"Error type: {type(exc).__name__}"
        )

        print(
            f"Error: {exc}"
        )

        print(
            "============================================\n"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to process the uploaded document: "
                f"{exc}"
            ),
        ) from exc


# ============================================================
# GET DOCUMENTS
# ============================================================

@router.get(
    "/conversations/{conversation_id}/documents"
)
def get_preparation_documents(
    conversation_id: int,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):

    conversation = (
        preparation_chat_service
        .get_conversation(
            db,
            current_user.id,
            conversation_id,
        )
    )

    if conversation is None:

        raise HTTPException(
            status_code=404,
            detail=(
                "Preparation Chat conversation "
                "not found."
            ),
        )

    documents = (
        db.query(
            PreparationDocument
        )
        .filter(
            PreparationDocument.conversation_id
            == conversation_id
        )
        .order_by(
            PreparationDocument.created_at.asc(),
            PreparationDocument.id.asc(),
        )
        .all()
    )

    return {
        "success": True,
        "data": [
            serialize_document(
                item
            )
            for item in documents
        ],
    }


# ============================================================
# DELETE DOCUMENT
# ============================================================

@router.delete(
    "/conversations/{conversation_id}/documents/{document_id}"
)
def delete_preparation_document(
    conversation_id: int,
    document_id: int,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):

    conversation = (
        preparation_chat_service
        .get_conversation(
            db,
            current_user.id,
            conversation_id,
        )
    )

    if conversation is None:

        raise HTTPException(
            status_code=404,
            detail=(
                "Preparation Chat conversation "
                "not found."
            ),
        )

    document = (
        db.query(
            PreparationDocument
        )
        .filter(
            PreparationDocument.id
            == document_id,
            PreparationDocument.conversation_id
            == conversation_id,
        )
        .first()
    )

    if document is None:

        raise HTTPException(
            status_code=404,
            detail=(
                "Preparation document "
                "not found."
            ),
        )

    storage_path = (
        Path(
            document.storage_path
        )
        if document.storage_path
        else None
    )

    db.delete(
        document
    )

    db.commit()

    if storage_path:

        try:

            if storage_path.exists():

                storage_path.unlink()

        except OSError:

            pass

    return {
        "success": True,
        "document_id": document_id,
    }


# ============================================================
# GET MESSAGES
# ============================================================

@router.get(
    "/conversations/{conversation_id}/messages"
)
def get_preparation_messages(
    conversation_id: int,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):

    conversation = (
        preparation_chat_service
        .get_conversation(
            db,
            current_user.id,
            conversation_id,
        )
    )

    if conversation is None:

        raise HTTPException(
            status_code=404,
            detail=(
                "Preparation Chat conversation "
                "not found."
            ),
        )

    messages = (
        preparation_chat_service
        .get_messages(
            db,
            current_user.id,
            conversation_id,
        )
    )

    return {
        "success": True,
        "data": [
            serialize_message(
                db,
                item,
            )
            for item in messages
        ],
    }


# ============================================================
# SEND MESSAGE
# ============================================================

@router.post(
    "/messages"
)
def send_preparation_chat_message(
    payload: PreparationChatMessageRequest,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):

    try:

        result = (
            preparation_chat_service
            .send_message(
                db=db,
                user_id=current_user.id,
                conversation_id=payload.conversation_id,
                user_message=payload.message.strip(),
                document_ids=payload.document_ids,
            )
        )

        return {
            "success": True,

            "conversation": (
                serialize_conversation(
                    result["conversation"]
                )
            ),

            "user_message": (
                serialize_message(
                    db,
                    result["user_message"],
                )
            ),

            "assistant_message": (
                serialize_message(
                    db,
                    result["assistant_message"],
                )
            ),

            "created_new_conversation": (
                result[
                    "created_new_conversation"
                ]
            ),
        }

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except RuntimeError as exc:

        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc

    except Exception as exc:

        db.rollback()

        print(
            "\n========== "
            "PREPARATION CHAT SEND ERROR "
            "=========="
        )

        print(
            f"User ID: {current_user.id}"
        )

        print(
            f"Conversation ID: "
            f"{payload.conversation_id}"
        )

        print(
            f"Error type: {type(exc).__name__}"
        )

        print(
            f"Error: {exc}"
        )

        print(
            "============================================\n"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Preparation Chat failed: "
                f"{exc}"
            ),
        ) from exc
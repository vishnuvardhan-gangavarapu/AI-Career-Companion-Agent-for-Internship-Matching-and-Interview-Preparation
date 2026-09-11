from __future__ import annotations

import re
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import (
    User,
    Resume,
    ResumeProfile,
    PreparationConversation,
    PreparationMessage,
    PreparationDocument,
    PreparationDocumentChunk,
)

from app.services.ai_service import generate_ai_response


MAX_HISTORY_MESSAGES = 10
MAX_PROFILE_CONTEXT = 4500
MAX_MESSAGE_LENGTH = 10000
MAX_DOCUMENT_CONTEXT = 18000
MAX_RELEVANT_CHUNKS = 12
RETRIEVAL_NEIGHBOR_RADIUS = 3
MAX_SECTION_CHUNKS = 40
MIN_QUERY_TERM_LENGTH = 2

ALLOWED_DOCUMENT_EXTENSIONS = {"pdf", "doc", "docx", "txt"}


# =========================================================
# BASIC HELPERS
# =========================================================

def _clean_text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _trim_text(value: Any, max_length: int) -> str:
    value = _clean_text(value)
    if len(value) <= max_length:
        return value
    return value[:max_length].rstrip() + "..."


# =========================================================
# TIMESTAMP HELPER
# =========================================================

def utc_now():
    return datetime.now(timezone.utc)


# =========================================================
# CONVERSATIONS
# =========================================================

def create_conversation(db: Session, user_id: int) -> PreparationConversation:
    now = utc_now()
    conversation = PreparationConversation(
        user_id=user_id,
        title=None,
        created_at=now,
        updated_at=now,
    )
    db.add(conversation)
    db.flush()
    return conversation


def get_conversation(db: Session, user_id: int, conversation_id: int) -> Optional[PreparationConversation]:
    return (
        db.query(PreparationConversation)
        .filter(
            PreparationConversation.id == conversation_id,
            PreparationConversation.user_id == user_id,
        )
        .first()
    )


def get_conversations(db: Session, user_id: int) -> List[PreparationConversation]:
    return (
        db.query(PreparationConversation)
        .filter(PreparationConversation.user_id == user_id)
        .order_by(PreparationConversation.updated_at.desc(), PreparationConversation.id.desc())
        .all()
    )


def delete_conversation(db: Session, user_id: int, conversation_id: int) -> bool:
    conversation = get_conversation(db, user_id, conversation_id)
    if conversation is None:
        return False
    db.delete(conversation)
    db.commit()
    return True


# =========================================================
# MESSAGE HISTORY
# =========================================================

def get_messages(db: Session, user_id: int, conversation_id: int) -> List[PreparationMessage]:
    if get_conversation(db, user_id, conversation_id) is None:
        return []
    return (
        db.query(PreparationMessage)
        .filter(PreparationMessage.conversation_id == conversation_id)
        .order_by(PreparationMessage.created_at.asc(), PreparationMessage.id.asc())
        .all()
    )


def _history_for_ai(db: Session, conversation_id: int) -> List[Dict[str, str]]:
    rows = (
        db.query(PreparationMessage)
        .filter(
            PreparationMessage.conversation_id == conversation_id,
            PreparationMessage.role.in_(["user", "assistant"]),
        )
        .order_by(PreparationMessage.created_at.asc(), PreparationMessage.id.asc())
        .all()
    )[-MAX_HISTORY_MESSAGES:]
    return [
        {"role": row.role, "content": _trim_text(row.content, 1400)}
        for row in rows
        if _clean_text(row.content)
    ]


# =========================================================
# PROFILE
# =========================================================

def build_profile_context(db: Session, user_id: int) -> str:
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        return ""

    resume = (
        db.query(Resume)
        .filter(Resume.user_id == user_id)
        .order_by(Resume.uploaded_at.desc())
        .first()
    )

    profile = None
    if resume is not None:
        profile = (
            db.query(ResumeProfile)
            .filter(
                ResumeProfile.user_id == user_id,
                ResumeProfile.resume_id == resume.id,
            )
            .first()
        )

    lines = [
        "USER PROFILE (SECONDARY SOURCE)",
        f"Name: {_trim_text(user.full_name, 150)}",
        f"Email: {_trim_text(user.email, 255)}",
        f"Phone: {_trim_text(user.phone, 40)}",
        f"Location: {_trim_text(user.location, 150)}",
        f"Profile Summary: {_trim_text(user.profile_summary, 600)}",
    ]

    if profile:
        lines += [
            "",
            "RESUME PROFILE",
            f"Professional Summary: {_trim_text(profile.professional_summary, 700)}",
            f"Skills: {_trim_text(profile.skills, 900)}",
            f"Technical Skills: {_trim_text(profile.technical_skills, 900)}",
            f"Soft Skills: {_trim_text(profile.soft_skills, 600)}",
            f"Education: {_trim_text(profile.education, 900)}",
            f"Work Experience: {_trim_text(profile.work_experience, 1100)}",
            f"Projects: {_trim_text(profile.projects, 900)}",
            f"Certifications: {_trim_text(profile.certifications, 600)}",
            f"Internships: {_trim_text(profile.internships, 600)}",
        ]

    return _trim_text("\n".join(lines), MAX_PROFILE_CONTEXT)


# =========================================================
# DOCUMENT HELPERS
# =========================================================

def _conversation_documents(db: Session, conversation_id: int) -> List[PreparationDocument]:
    return (
        db.query(PreparationDocument)
        .filter(
            PreparationDocument.conversation_id == conversation_id,
            PreparationDocument.analysis_status == "completed",
        )
        .order_by(PreparationDocument.created_at.asc(), PreparationDocument.id.asc())
        .all()
    )


def _documents_by_ids(
    db: Session,
    conversation_id: int,
    document_ids: Optional[Sequence[int]],
) -> List[PreparationDocument]:
    documents = _conversation_documents(db, conversation_id)
    if not document_ids:
        return documents
    wanted = {int(value) for value in document_ids if value is not None}
    return [document for document in documents if document.id in wanted]


def _document_chunks(db: Session, document_id: int) -> List[PreparationDocumentChunk]:
    return (
        db.query(PreparationDocumentChunk)
        .filter(PreparationDocumentChunk.document_id == document_id)
        .order_by(PreparationDocumentChunk.chunk_index.asc())
        .all()
    )


def _is_broad_document_request(query: str) -> bool:
    q = _clean_text(query).lower()
    phrases = (
        "summary", "summarize", "summarise", "explain this document",
        "explain the document", "explain this file", "explain the file",
        "describe this document", "describe the document", "overview",
        "what is this document", "what does this document contain",
        "tell me about this document", "give me the document", "contents of this document",
    )
    return any(phrase in q for phrase in phrases)


def _mentioned_document_ids(
    query: str,
    documents: Sequence[PreparationDocument],
) -> List[int]:
    q = _clean_text(query).lower()
    matches = []
    for document in documents:
        filename = _clean_text(document.file_name).lower()
        stem = re.sub(r"\.[^.]+$", "", filename)
        if filename and filename in q:
            matches.append(document.id)
        elif stem and len(stem) >= 3 and stem in q:
            matches.append(document.id)
    return matches


def _tokenize_for_retrieval(value: str) -> List[str]:
    tokens = re.findall(r"[a-zA-Z0-9]+(?:['-][a-zA-Z0-9]+)*", _clean_text(value).lower())
    stop_words = {
        "a", "an", "and", "are", "as", "at", "be", "by", "can", "could", "do",
        "for", "from", "give", "has", "have", "how", "i", "in", "is", "it", "me",
        "my", "of", "on", "or", "please", "tell", "the", "this", "to", "was", "what",
        "when", "where", "which", "who", "why", "with", "you", "your", "document", "file",
    }
    return [token for token in tokens if len(token) >= MIN_QUERY_TERM_LENGTH and token not in stop_words]


def _score_chunk(query: str, chunk_text: str) -> float:
    query_terms = _tokenize_for_retrieval(query)
    chunk_terms = _tokenize_for_retrieval(chunk_text)
    if not query_terms or not chunk_terms:
        return 0.0

    counter = Counter(chunk_terms)
    lower = _clean_text(chunk_text).lower()
    score = 0.0

    for term in query_terms:
        occurrences = counter.get(term, 0)
        if occurrences:
            score += min(occurrences, 6) * 2.0

    query_phrase = " ".join(query_terms)
    if query_phrase and query_phrase in lower:
        score += 10.0

    for index in range(len(query_terms) - 1):
        if f"{query_terms[index]} {query_terms[index + 1]}" in lower:
            score += 3.0

    return score


def _extract_section_reference(query: str):
    q = _clean_text(query).lower()
    patterns = (
        ("week", r"\bweek\s*(\d+)\b"),
        ("day", r"\bday\s*(\d+)\b"),
        ("chapter", r"\bchapter\s*(\d+)\b"),
        ("module", r"\bmodule\s*(\d+)\b"),
        ("section", r"\bsection\s*(\d+)\b"),
        ("phase", r"\bphase\s*(\d+)\b"),
    )
    for kind, pattern in patterns:
        match = re.search(pattern, q)
        if match:
            return kind, int(match.group(1))
    return None


def _find_section_chunks(db: Session, document: PreparationDocument, kind: str, number: int):
    chunks = _document_chunks(db, document.id)
    if not chunks:
        return []

    target = re.compile(
        rf"(?im)^\s*(?:\d+[.)]\s*)?{re.escape(kind)}\s*[-:–—]?\s*{number}\b|\b{re.escape(kind)}\s*{number}\b"
    )
    next_section = re.compile(
        rf"(?im)^\s*(?:\d+[.)]\s*)?{re.escape(kind)}\s*[-:–—]?\s*\d+\b|\b{re.escape(kind)}\s*\d+\b"
    )

    start = None
    for index, chunk in enumerate(chunks):
        if target.search(_clean_text(chunk.chunk_text)):
            start = index
            break

    if start is None:
        needle = f"{kind} {number}"
        for index, chunk in enumerate(chunks):
            if needle in _clean_text(chunk.chunk_text).lower():
                start = index
                break

    if start is None:
        return []

    result = []
    for index in range(start, min(len(chunks), start + MAX_SECTION_CHUNKS)):
        chunk = chunks[index]
        if index > start and next_section.search(_clean_text(chunk.chunk_text)):
            break
        result.append((document, chunk, 100.0))
    return result


def _representative_chunks(db: Session, document: PreparationDocument, max_chars: int) -> List[tuple]:
    chunks = _document_chunks(db, document.id)
    if not chunks:
        return []

    # For a generic summary/explanation, sample the beginning, middle and end
    # instead of only returning the first lexical matches.
    if len(chunks) <= 8:
        selected = chunks
    else:
        positions = sorted({0, 1, len(chunks) // 4, len(chunks) // 2, (3 * len(chunks)) // 4, len(chunks) - 2, len(chunks) - 1})
        selected = [chunks[i] for i in positions if 0 <= i < len(chunks)]

    result = []
    used = 0
    for chunk in selected:
        text_value = _clean_text(chunk.chunk_text)
        if not text_value:
            continue
        remaining = max_chars - used
        if remaining <= 0:
            break
        text_value = _trim_text(text_value, remaining)
        result.append((document, chunk, 1.0))
        used += len(text_value)
    return result


# =========================================================
# RETRIEVAL
# =========================================================

def retrieve_relevant_chunks(
    db: Session,
    conversation_id: int,
    query: str,
    document_ids: Optional[Sequence[int]] = None,
) -> List[Dict[str, Any]]:
    all_documents = _conversation_documents(db, conversation_id)
    if not all_documents:
        return []

    mentioned_ids = _mentioned_document_ids(query, all_documents)
    selected_documents = _documents_by_ids(db, conversation_id, document_ids)
    if mentioned_ids:
        selected_documents = [doc for doc in all_documents if doc.id in set(mentioned_ids)]

    if not selected_documents:
        return []

    # Generic summary/explanation: the user has not named a section, so use
    # representative evidence from the actual document(s).
    if _is_broad_document_request(query):
        output = []
        budget_each = max(1200, MAX_DOCUMENT_CONTEXT // max(len(selected_documents), 1))
        for document in selected_documents:
            output.extend(_representative_chunks(db, document, budget_each))
        return [
            {
                "document_id": doc.id,
                "file_name": doc.file_name,
                "chunk_id": chunk.id,
                "chunk_index": chunk.chunk_index,
                "chunk_text": chunk.chunk_text,
                "score": score,
            }
            for doc, chunk, score in output
        ]

    section_reference = _extract_section_reference(query)
    if section_reference:
        kind, number = section_reference
        results = []
        for document in selected_documents:
            results.extend(_find_section_chunks(db, document, kind, number))
        if results:
            return [
                {
                    "document_id": doc.id,
                    "file_name": doc.file_name,
                    "chunk_id": chunk.id,
                    "chunk_index": chunk.chunk_index,
                    "chunk_text": chunk.chunk_text,
                    "score": score,
                }
                for doc, chunk, score in results
            ]

    scored = []
    for document in selected_documents:
        for chunk in _document_chunks(db, document.id):
            score = _score_chunk(query, chunk.chunk_text)
            if score > 0:
                scored.append({
                    "document_id": document.id,
                    "file_name": document.file_name,
                    "chunk_id": chunk.id,
                    "chunk_index": chunk.chunk_index,
                    "chunk_text": chunk.chunk_text,
                    "score": score,
                })

    # If lexical matching fails, do not fall back to the resume. Use the real
    # uploaded document as evidence instead.
    if not scored:
        fallback = []
        for document in selected_documents:
            fallback.extend(_representative_chunks(db, document, MAX_DOCUMENT_CONTEXT // max(len(selected_documents), 1)))
        return [
            {
                "document_id": doc.id,
                "file_name": doc.file_name,
                "chunk_id": chunk.id,
                "chunk_index": chunk.chunk_index,
                "chunk_text": chunk.chunk_text,
                "score": score,
            }
            for doc, chunk, score in fallback
        ]

    scored.sort(key=lambda item: (-item["score"], item["document_id"], item["chunk_index"]))
    seeds = scored[:MAX_RELEVANT_CHUNKS]

    expanded = {(item["document_id"], item["chunk_index"]): item for item in seeds}
    for seed in seeds:
        neighbours = (
            db.query(PreparationDocumentChunk)
            .filter(
                PreparationDocumentChunk.document_id == seed["document_id"],
                PreparationDocumentChunk.chunk_index.between(
                    max(0, seed["chunk_index"] - RETRIEVAL_NEIGHBOR_RADIUS),
                    seed["chunk_index"] + RETRIEVAL_NEIGHBOR_RADIUS,
                ),
            )
            .order_by(PreparationDocumentChunk.chunk_index.asc())
            .all()
        )
        for chunk in neighbours:
            key = (seed["document_id"], chunk.chunk_index)
            expanded.setdefault(key, {
                "document_id": seed["document_id"],
                "file_name": seed["file_name"],
                "chunk_id": chunk.id,
                "chunk_index": chunk.chunk_index,
                "chunk_text": chunk.chunk_text,
                "score": max(seed["score"] - 1, 0),
            })

    return sorted(expanded.values(), key=lambda item: (item["document_id"], item["chunk_index"]))


def build_relevant_document_context(
    db: Session,
    conversation_id: int,
    query: str,
    document_ids: Optional[Sequence[int]] = None,
) -> str:
    chunks = retrieve_relevant_chunks(db, conversation_id, query, document_ids=document_ids)
    if not chunks:
        return ""

    sections: List[str] = []
    remaining = MAX_DOCUMENT_CONTEXT
    current_doc = None
    current_name = None
    current_lines: List[str] = []

    def flush():
        nonlocal remaining, current_lines
        if not current_lines or remaining <= 0:
            current_lines = []
            return
        block = _trim_text("\n".join(current_lines), remaining)
        if block:
            sections.append(f"DOCUMENT: {current_name}\n{block}")
            remaining -= len(block)
        current_lines = []

    for item in chunks:
        if remaining <= 0:
            break
        if current_doc != item["document_id"]:
            flush()
            current_doc = item["document_id"]
            current_name = item["file_name"]
        text_value = _clean_text(item["chunk_text"])
        if text_value:
            current_lines.append(f"[Chunk {item['chunk_index']}] {text_value}")

    flush()
    return "\n\n".join(sections)


# =========================================================
# AI CONTEXT
# =========================================================

def build_retrieval_chat_context(
    db: Session,
    user_id: int,
    conversation_id: int,
    query: str,
    document_ids: Optional[Sequence[int]] = None,
) -> str:
    documents = _conversation_documents(db, conversation_id)
    document_context = build_relevant_document_context(
        db, conversation_id, query, document_ids=document_ids
    )
    profile_context = build_profile_context(db, user_id)

    parts = [
        "PREPARATION CHAT SOURCE POLICY",
        "- Uploaded documents are the authoritative source for document questions.",
        "- If the user names a filename, answer from that file only.",
        "- If the user asks to summarize/explain a document, use representative evidence from the actual document; never substitute the resume.",
        "- If the user refers to a Week/Day/Chapter/Section/Phase, use the complete matching section and its consecutive chunks.",
        "- If the requested fact is not present in the supplied document evidence, say that it is not present rather than inventing it.",
        "- Continue follow-up questions using the uploaded documents already stored in this conversation.",
    ]

    if documents:
        parts.append("\nAVAILABLE UPLOADED DOCUMENTS:")
        for document in documents:
            parts.append(f"- {document.file_name} (id={document.id})")

    if document_context:
        parts.extend(["\nAUTHORITATIVE DOCUMENT EVIDENCE:", document_context])

    if profile_context:
        parts.extend(["\nSECONDARY RESUME/PROFILE CONTEXT:", profile_context])

    if not document_context and not profile_context:
        parts.append("\nNo document or profile evidence is available.")

    return "\n".join(parts)


# =========================================================
# SERIALIZATION
# =========================================================

def conversation_to_dict(conversation: PreparationConversation) -> Dict[str, Any]:
    return {
        "id": conversation.id,
        "user_id": conversation.user_id,
        "title": conversation.title,
        "created_at": conversation.created_at.isoformat() if conversation.created_at else None,
        "updated_at": conversation.updated_at.isoformat() if conversation.updated_at else None,
    }


def message_to_dict(db: Session, message: PreparationMessage) -> Dict[str, Any]:
    rows = db.execute(
        text("""
            SELECT d.id, d.file_name, d.file_size, d.file_type,
                   d.mime_type, d.analysis_status
            FROM preparation_message_documents pmd
            JOIN preparation_documents d ON d.id = pmd.document_id
            WHERE pmd.message_id = :message_id
            ORDER BY d.id ASC
        """),
        {"message_id": message.id},
    ).mappings().all()

    documents = [dict(row) for row in rows]
    for document in documents:
        document["file_type"] = str(document.get("file_type") or "FILE").upper()

    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "role": message.role,
        "content": message.content,
        "created_at": message.created_at.isoformat() if message.created_at else None,
        "documents": documents,
    }


# =========================================================
# TITLE
# =========================================================

def generate_conversation_title(message: str) -> str:
    cleaned = " ".join(_clean_text(message).split())
    if not cleaned:
        return "Preparation Chat"
    return cleaned if len(cleaned) <= 60 else cleaned[:57].rstrip() + "..."


# =========================================================
# SEND MESSAGE
# =========================================================

def _validate_document_ids(
    db: Session,
    conversation_id: int,
    document_ids: Optional[Sequence[int]],
) -> List[int]:
    if not document_ids:
        return []

    ids = []
    for value in document_ids:
        try:
            ids.append(int(value))
        except (TypeError, ValueError):
            continue

    ids = list(dict.fromkeys(ids))
    if not ids:
        return []

    rows = (
        db.query(PreparationDocument.id)
        .filter(
            PreparationDocument.id.in_(ids),
            PreparationDocument.conversation_id == conversation_id,
            PreparationDocument.analysis_status == "completed",
        )
        .all()
    )
    valid = {row[0] for row in rows}
    invalid = [doc_id for doc_id in ids if doc_id not in valid]
    if invalid:
        raise ValueError("One or more attached documents do not belong to this conversation or are not ready.")
    return ids


def _attach_documents_to_message(db: Session, message_id: int, document_ids: Sequence[int]) -> None:
    if not document_ids:
        return
    for document_id in document_ids:
        db.execute(
            text("""
                INSERT INTO preparation_message_documents (message_id, document_id)
                VALUES (:message_id, :document_id)
                ON CONFLICT (message_id, document_id) DO NOTHING
            """),
            {"message_id": message_id, "document_id": document_id},
        )


def send_message(
    db: Session,
    user_id: int,
    conversation_id: Optional[int],
    user_message: str,
    document_ids: Optional[Sequence[int]] = None,
) -> Dict[str, Any]:
    message = _clean_text(user_message)
    if not message:
        raise ValueError("Message cannot be empty.")
    if len(message) > MAX_MESSAGE_LENGTH:
        raise ValueError("Message is too long.")

    created_new_conversation = conversation_id is None
    if conversation_id is None:
        conversation = create_conversation(db, user_id)
    else:
        conversation = get_conversation(db, user_id, conversation_id)
        if conversation is None:
            raise ValueError("Preparation conversation not found.")

    try:
        attached_ids = _validate_document_ids(db, conversation.id, document_ids)
        previous_messages = _history_for_ai(db, conversation.id)
        context = build_retrieval_chat_context(
            db=db,
            user_id=user_id,
            conversation_id=conversation.id,
            query=message,
            document_ids=attached_ids or None,
        )

        assistant_text = generate_ai_response(
            user_message=message,
            previous_messages=previous_messages,
            application_context=context,
            dashboard_type="preparation",
            user_role="intern",
            preparation_document_mode=True,
        )
        assistant_text = _clean_text(assistant_text)
        if not assistant_text:
            raise RuntimeError("AI returned an empty response.")

        now = utc_now()
        user_record = PreparationMessage(
            conversation_id=conversation.id,
            role="user",
            content=message,
            created_at=now,
        )
        db.add(user_record)
        db.flush()

        _attach_documents_to_message(db, user_record.id, attached_ids)

        assistant_record = PreparationMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=assistant_text,
            created_at=utc_now(),
        )
        db.add(assistant_record)

        if not conversation.title:
            conversation.title = generate_conversation_title(message)

        conversation.updated_at = utc_now()

        db.commit()
        db.refresh(conversation)
        db.refresh(user_record)
        db.refresh(assistant_record)

        return {
            "conversation": conversation,
            "user_message": user_record,
            "assistant_message": assistant_record,
            "created_new_conversation": created_new_conversation,
        }
    except Exception:
        db.rollback()
        raise

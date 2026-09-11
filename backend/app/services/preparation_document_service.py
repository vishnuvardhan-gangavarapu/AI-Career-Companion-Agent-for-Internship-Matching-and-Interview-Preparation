from __future__ import annotations

"""
Preparation Chat document processing service.

Responsibilities:
- Validate PDF/DOC/DOCX/TXT uploads
- Store files under uploads/preparation_chat/<user>/<conversation>/
- Calculate SHA-256 hash
- Extract text
- Preserve PDF page boundaries
- Preserve DOCX paragraphs and tables
- Support legacy DOC through LibreOffice/antiword when installed
- Build logical sections
- Build overlapping retrieval chunks
- Persist PreparationDocument, PreparationDocumentSection and
  PreparationDocumentChunk records

Important:
- chunk_index is GLOBAL for the complete document.
- chunk_index NEVER restarts for a new section.
- The router controls database commit/rollback.
- This service does NOT call the AI model.
"""

# ============================================================
# IMPORTS
# ============================================================

import hashlib
import mimetypes
import os
import re
import shutil
import subprocess
import tempfile

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF
from docx import Document as DocxDocument
from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.models.preparation_document import PreparationDocument
from app.models.preparation_document_chunk import (
    PreparationDocumentChunk,
)
from app.models.preparation_document_section import (
    PreparationDocumentSection,
)


# ============================================================
# CONFIGURATION
# ============================================================

BASE_UPLOAD_DIR = (
    Path("uploads") / "preparation_chat"
)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".txt",
}

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    (
        "application/"
        "vnd.openxmlformats-officedocument."
        "wordprocessingml.document"
    ),
    "text/plain",
}

# Retrieval chunk configuration.
CHUNK_SIZE = 2800
CHUNK_OVERLAP = 400

MIN_HEADING_LENGTH = 2
MAX_HEADING_LENGTH = 180


# ============================================================
# TIME HELPER
# ============================================================

def utc_now() -> datetime:
    """
    Return the current UTC datetime.
    """
    return datetime.now(timezone.utc)


# ============================================================
# INTERNAL DATA STRUCTURES
# ============================================================

@dataclass
class ExtractedUnit:
    """
    Represents a piece of extracted document text.

    PDF:
        page_number contains the actual PDF page number.

    DOC/DOCX/TXT:
        page_number is normally None.
    """

    text: str
    page_number: Optional[int] = None


@dataclass
class SectionData:
    """
    Represents a logical document section.
    """

    title: Optional[str]
    text: str
    page_start: Optional[int]
    page_end: Optional[int]


@dataclass
class ChunkData:
    """
    Represents one retrieval chunk.
    """

    text: str
    page_number: Optional[int]


# ============================================================
# FILE VALIDATION
# ============================================================

def validate_file_extension(
    filename: str,
) -> str:
    """
    Validate and return the normalized extension.
    """

    if not filename:
        raise ValueError(
            "A file name is required."
        )

    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(
            sorted(ALLOWED_EXTENSIONS)
        )

        raise ValueError(
            "Unsupported file type. "
            f"Allowed file types: {allowed}"
        )

    return extension


def validate_file_size(
    file_size: int,
) -> None:
    """
    Validate uploaded file size.
    """

    if file_size <= 0:
        raise ValueError(
            "The uploaded file is empty."
        )

    if file_size > MAX_FILE_SIZE:
        max_mb = (
            MAX_FILE_SIZE
            // (1024 * 1024)
        )

        raise ValueError(
            "File is too large. "
            f"Maximum allowed size is {max_mb} MB."
        )


def get_safe_original_filename(
    filename: str,
) -> str:
    """
    Remove path traversal information while
    preserving the original filename.
    """

    if not filename:
        return "document"

    filename = filename.replace(
        "\\",
        "/",
    )

    filename = Path(filename).name

    filename = filename.replace(
        "\x00",
        "",
    )

    if not filename:
        return "document"

    return filename


def get_mime_type(
    filename: str,
) -> str:
    """
    Determine MIME type from extension.
    """

    extension = Path(filename).suffix.lower()

    known_types = {
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx": (
            "application/"
            "vnd.openxmlformats-officedocument."
            "wordprocessingml.document"
        ),
        ".txt": "text/plain",
    }

    return known_types.get(
        extension,
        mimetypes.guess_type(
            filename
        )[0]
        or "application/octet-stream",
    )


# ============================================================
# FILE STORAGE
# ============================================================

def build_document_storage_path(
    user_id: int,
    conversation_id: int,
    extension: str,
) -> Path:
    """
    Create a secure document storage path.

    Structure:

        uploads/
            preparation_chat/
                <user_id>/
                    <conversation_id>/
                        <random-file>.pdf
    """

    user_dir = (
        BASE_UPLOAD_DIR
        / str(int(user_id))
    )

    conversation_dir = (
        user_dir
        / str(int(conversation_id))
    )

    conversation_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    random_name = hashlib.sha256(
        os.urandom(32)
    ).hexdigest()

    return (
        conversation_dir
        / f"{random_name}{extension}"
    )


def save_uploaded_file(
    upload_file: UploadFile,
    destination: Path,
) -> tuple[int, str]:
    """
    Save an uploaded file.

    Returns:

        (
            file_size,
            sha256_hash
        )
    """

    destination.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    total_size = 0

    hasher = hashlib.sha256()

    try:

        with destination.open(
            "wb"
        ) as output:

            while True:

                data = (
                    upload_file.file.read(
                        1024 * 1024
                    )
                )

                if not data:
                    break

                total_size += len(data)

                if total_size > MAX_FILE_SIZE:
                    raise ValueError(
                        "File is too large. "
                        "Maximum allowed size is 10 MB."
                    )

                hasher.update(data)

                output.write(data)

    except Exception:

        if destination.exists():
            try:
                destination.unlink()
            except OSError:
                pass

        raise

    validate_file_size(
        total_size
    )

    return (
        total_size,
        hasher.hexdigest(),
    )


# ============================================================
# TEXT DECODING
# ============================================================

def decode_text_file(
    raw_bytes: bytes,
) -> str:
    """
    Decode TXT files using common encodings.
    """

    encodings = [
        "utf-8-sig",
        "utf-8",
        "utf-16",
        "cp1252",
        "latin-1",
    ]

    for encoding in encodings:

        try:
            return raw_bytes.decode(
                encoding
            )

        except UnicodeDecodeError:
            continue

    raise ValueError(
        "Unable to decode the text file "
        "using supported encodings."
    )


# ============================================================
# PDF EXTRACTION
# ============================================================

def extract_pdf(
    file_path: Path,
) -> tuple[
    list[ExtractedUnit],
    int,
]:
    """
    Extract PDF text while preserving page boundaries.
    """

    units: list[ExtractedUnit] = []

    try:

        pdf = fitz.open(
            file_path
        )

    except Exception as exc:

        raise ValueError(
            f"Unable to open PDF document: {exc}"
        ) from exc

    try:

        page_count = len(pdf)

        for page_index in range(
            page_count
        ):

            page = pdf[page_index]

            text = page.get_text(
                "text"
            )

            if text is None:
                text = ""

            text = text.replace(
                "\x00",
                "",
            )

            if text.strip():

                units.append(
                    ExtractedUnit(
                        text=text,
                        page_number=(
                            page_index + 1
                        ),
                    )
                )

    finally:

        pdf.close()

    if not units:

        raise ValueError(
            "No readable text was found "
            "in the PDF."
        )

    return (
        units,
        page_count,
    )


# ============================================================
# DOCX EXTRACTION
# ============================================================

def extract_docx(
    file_path: Path,
) -> tuple[
    list[ExtractedUnit],
    int,
]:
    """
    Extract DOCX paragraphs and tables.

    python-docx does not reliably expose physical
    page numbers, therefore page_number is None.
    """

    try:

        document = DocxDocument(
            str(file_path)
        )

    except Exception as exc:

        raise ValueError(
            f"Unable to open DOCX document: {exc}"
        ) from exc

    lines: list[str] = []

    # --------------------------------------------------------
    # Paragraphs
    # --------------------------------------------------------

    for paragraph in document.paragraphs:

        text = paragraph.text

        if text is None:
            continue

        text = text.replace(
            "\x00",
            "",
        )

        lines.append(text)

    # --------------------------------------------------------
    # Tables
    # --------------------------------------------------------

    for table_index, table in enumerate(
        document.tables,
        start=1,
    ):

        lines.append("")

        lines.append(
            f"[Table {table_index}]"
        )

        for row in table.rows:

            cells: list[str] = []

            for cell in row.cells:

                cell_text = (
                    cell.text or ""
                )

                cell_text = (
                    cell_text
                    .replace(
                        "\n",
                        " ",
                    )
                    .strip()
                )

                cells.append(
                    cell_text
                )

            lines.append(
                " | ".join(cells)
            )

        lines.append("")

    text = "\n".join(lines)

    if not text.strip():

        raise ValueError(
            "No readable text was found "
            "in the DOCX document."
        )

    return (
        [
            ExtractedUnit(
                text=text,
                page_number=None,
            )
        ],
        0,
    )


# ============================================================
# LEGACY DOC EXTRACTION
# ============================================================

def extract_doc(
    file_path: Path,
) -> tuple[
    list[ExtractedUnit],
    int,
]:
    """
    Extract legacy .doc files.

    Preferred:
        LibreOffice / soffice -> DOCX

    Fallback:
        antiword -> TXT
    """

    # --------------------------------------------------------
    # LibreOffice
    # --------------------------------------------------------

    soffice_commands = [
        "soffice",
        "libreoffice",
    ]

    for command in soffice_commands:

        if shutil.which(command) is None:
            continue

        with tempfile.TemporaryDirectory() as temp_dir:

            temp_path = Path(
                temp_dir
            )

            try:

                result = subprocess.run(
                    [
                        command,
                        "--headless",
                        "--convert-to",
                        "docx",
                        "--outdir",
                        str(temp_path),
                        str(file_path),
                    ],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    timeout=60,
                    check=False,
                )

            except (
                subprocess.SubprocessError,
                OSError,
            ):

                continue

            converted_file = (
                temp_path
                / f"{file_path.stem}.docx"
            )

            if (
                result.returncode == 0
                and converted_file.exists()
            ):

                try:

                    return extract_docx(
                        converted_file
                    )

                except Exception:
                    pass

    # --------------------------------------------------------
    # antiword
    # --------------------------------------------------------

    if shutil.which(
        "antiword"
    ) is not None:

        try:

            result = subprocess.run(
                [
                    "antiword",
                    str(file_path),
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=60,
                check=False,
            )

            if result.returncode == 0:

                raw = result.stdout

                if isinstance(
                    raw,
                    bytes,
                ):

                    text = raw.decode(
                        "utf-8",
                        errors="replace",
                    )

                else:

                    text = str(raw)

                text = text.replace(
                    "\x00",
                    "",
                )

                if text.strip():

                    return (
                        [
                            ExtractedUnit(
                                text=text,
                                page_number=None,
                            )
                        ],
                        0,
                    )

        except (
            subprocess.SubprocessError,
            OSError,
        ):

            pass

    raise ValueError(
        "Unable to read .doc file. "
        "Install LibreOffice or antiword "
        "to support legacy DOC files."
    )


# ============================================================
# TXT EXTRACTION
# ============================================================

def extract_txt(
    file_path: Path,
) -> tuple[
    list[ExtractedUnit],
    int,
]:
    """
    Extract plain text.
    """

    try:

        raw_bytes = (
            file_path.read_bytes()
        )

    except OSError as exc:

        raise ValueError(
            f"Unable to read text file: {exc}"
        ) from exc

    text = decode_text_file(
        raw_bytes
    )

    text = text.replace(
        "\x00",
        "",
    )

    if not text.strip():

        raise ValueError(
            "The text file is empty."
        )

    return (
        [
            ExtractedUnit(
                text=text,
                page_number=None,
            )
        ],
        0,
    )


# ============================================================
# EXTRACTION DISPATCHER
# ============================================================

def extract_document(
    file_path: Path,
    extension: str,
) -> tuple[
    list[ExtractedUnit],
    int,
]:
    """
    Extract a supported document based
    on its extension.
    """

    extension = extension.lower()

    if extension == ".pdf":
        return extract_pdf(
            file_path
        )

    if extension == ".docx":
        return extract_docx(
            file_path
        )

    if extension == ".doc":
        return extract_doc(
            file_path
        )

    if extension == ".txt":
        return extract_txt(
            file_path
        )

    raise ValueError(
        f"Unsupported document extension: {extension}"
    )


# ============================================================
# TEXT NORMALIZATION
# ============================================================

def normalize_extracted_text(
    text: str,
) -> str:
    """
    Normalize extracted text without
    destroying code indentation or line breaks.
    """

    if not text:
        return ""

    text = text.replace(
        "\r\n",
        "\n",
    )

    text = text.replace(
        "\r",
        "\n",
    )

    text = text.replace(
        "\x00",
        "",
    )

    cleaned_lines: list[str] = []

    blank_line_count = 0

    for line in text.split("\n"):

        line = line.rstrip()

        if not line.strip():

            blank_line_count += 1

            if blank_line_count <= 2:
                cleaned_lines.append("")

        else:

            blank_line_count = 0

            cleaned_lines.append(
                line
            )

    return "\n".join(
        cleaned_lines
    ).strip()


# ============================================================
# HEADING DETECTION
# ============================================================

HEADING_PATTERNS = [
    re.compile(
        r"^(#{1,6})\s+(.+?)\s*$"
    ),

    re.compile(
        r"^(week|day|chapter|module|section|unit|"
        r"lesson|task|phase|part|project|assignment)"
        r"\s*[\-:#.]?\s*\d*\s*:?\s*(.+)?$",
        re.IGNORECASE,
    ),

    re.compile(
        r"^\d+(?:\.\d+)*[\s.)-]+.+$"
    ),

    re.compile(
        r"^[A-Z][A-Z0-9\s\-&:/()]{2,100}$"
    ),
]


def clean_heading_candidate(
    line: str,
) -> str:
    """
    Clean detected heading text.
    """

    line = line.strip()

    line = re.sub(
        r"^#{1,6}\s*",
        "",
        line,
    )

    return line.strip()


def is_heading(
    line: str,
) -> bool:
    """
    Determine whether a line is probably
    a document heading.
    """

    stripped = line.strip()

    if not stripped:
        return False

    if len(stripped) < MIN_HEADING_LENGTH:
        return False

    if len(stripped) > MAX_HEADING_LENGTH:
        return False

    if re.match(
        r"^(https?://|www\.)",
        stripped,
        re.IGNORECASE,
    ):
        return False

    if stripped.endswith(
        (
            ".",
            "?",
            "!",
        )
    ):
        return False

    for pattern in HEADING_PATTERNS:

        if pattern.match(stripped):
            return True

    words = stripped.split()

    if (
        1 <= len(words) <= 10
        and len(stripped) <= 100
    ):

        alpha_chars = [
            char
            for char in stripped
            if char.isalpha()
        ]

        if alpha_chars:

            uppercase_ratio = (
                sum(
                    char.isupper()
                    for char in alpha_chars
                )
                / len(alpha_chars)
            )

            if uppercase_ratio >= 0.75:
                return True

    return False


# ============================================================
# SECTION BUILDING
# ============================================================

def build_sections(
    units: list[ExtractedUnit],
) -> list[SectionData]:
    """
    Build logical document sections.

    Important:
    The complete document remains available.
    Sections are only used for organization/retrieval.
    """

    all_lines: list[
        tuple[str, Optional[int]]
    ] = []

    # --------------------------------------------------------
    # Flatten extracted units
    # --------------------------------------------------------

    for unit in units:

        unit_text = unit.text or ""

        for line in unit_text.split(
            "\n"
        ):

            all_lines.append(
                (
                    line,
                    unit.page_number,
                )
            )

    sections: list[SectionData] = []

    current_title: Optional[str] = None

    current_lines: list[str] = []

    current_page_start: Optional[int] = None

    current_page_end: Optional[int] = None

    # --------------------------------------------------------
    # Section flush helper
    # --------------------------------------------------------

    def flush_current_section() -> None:

        nonlocal current_title
        nonlocal current_lines
        nonlocal current_page_start
        nonlocal current_page_end

        text = "\n".join(
            current_lines
        ).strip()

        if not text:

            current_title = None
            current_lines = []
            current_page_start = None
            current_page_end = None

            return

        sections.append(
            SectionData(
                title=current_title,
                text=text,
                page_start=current_page_start,
                page_end=current_page_end,
            )
        )

        current_title = None
        current_lines = []
        current_page_start = None
        current_page_end = None

    # --------------------------------------------------------
    # Process every line
    # --------------------------------------------------------

    for line, page_number in all_lines:

        stripped = line.strip()

        if is_heading(stripped):

            # Avoid duplicate consecutive headings.
            if (
                current_title is not None
                and stripped.lower()
                == current_title.lower()
                and not current_lines
            ):
                continue

            flush_current_section()

            current_title = (
                clean_heading_candidate(
                    stripped
                )
            )

            if page_number is not None:

                current_page_start = (
                    page_number
                )

                current_page_end = (
                    page_number
                )

            continue

        if current_page_start is None:

            if page_number is not None:

                current_page_start = (
                    page_number
                )

        if page_number is not None:

            current_page_end = (
                page_number
            )

        current_lines.append(
            line
        )

    flush_current_section()

    # --------------------------------------------------------
    # No headings found
    # --------------------------------------------------------

    if not sections:

        full_text = "\n".join(
            line
            for line, _ in all_lines
        ).strip()

        if full_text:

            pages = [
                page
                for _, page in all_lines
                if page is not None
            ]

            sections.append(
                SectionData(
                    title=None,
                    text=full_text,
                    page_start=(
                        min(pages)
                        if pages
                        else None
                    ),
                    page_end=(
                        max(pages)
                        if pages
                        else None
                    ),
                )
            )

    return sections


# ============================================================
# CHUNKING
# ============================================================

def split_text_into_chunks(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> list[str]:
    """
    Split text into overlapping chunks.

    Priority:

        1. paragraph boundary
        2. line boundary
        3. whitespace boundary
        4. hard character boundary

    This preserves programming code and document structure
    as much as possible.
    """

    if not text:
        return []

    if chunk_size <= 0:
        raise ValueError(
            "chunk_size must be greater than zero."
        )

    if overlap < 0:
        raise ValueError(
            "overlap cannot be negative."
        )

    if overlap >= chunk_size:
        raise ValueError(
            "overlap must be smaller than chunk_size."
        )

    text = text.strip()

    if len(text) <= chunk_size:

        return [
            text
        ]

    chunks: list[str] = []

    start = 0

    text_length = len(text)

    while start < text_length:

        target_end = min(
            start + chunk_size,
            text_length,
        )

        if target_end >= text_length:

            chunk = text[
                start:
            ].strip()

            if chunk:
                chunks.append(
                    chunk
                )

            break

        # ----------------------------------------------------
        # Search for paragraph boundary
        # ----------------------------------------------------

        search_start = (
            start
            + int(
                chunk_size * 0.55
            )
        )

        paragraph_break = text.rfind(
            "\n\n",
            search_start,
            target_end,
        )

        if paragraph_break > start:

            end = (
                paragraph_break
                + 2
            )

        else:

            # ------------------------------------------------
            # Search for line boundary
            # ------------------------------------------------

            line_break = text.rfind(
                "\n",
                search_start,
                target_end,
            )

            if line_break > start:

                end = (
                    line_break
                    + 1
                )

            else:

                # --------------------------------------------
                # Search for whitespace
                # --------------------------------------------

                space_break = text.rfind(
                    " ",
                    search_start,
                    target_end,
                )

                if space_break > start:

                    end = (
                        space_break
                        + 1
                    )

                else:

                    end = target_end

        chunk = text[
            start:end
        ].strip()

        if chunk:

            chunks.append(
                chunk
            )

        # ----------------------------------------------------
        # Calculate overlap
        # ----------------------------------------------------

        next_start = max(
            end - overlap,
            start + 1,
        )

        start = next_start

    return chunks


def build_chunk_data(
    section: SectionData,
) -> list[ChunkData]:
    """
    Convert a section into chunk data.
    """

    chunks = split_text_into_chunks(
        section.text
    )

    result: list[ChunkData] = []

    for chunk in chunks:

        result.append(
            ChunkData(
                text=chunk,
                page_number=(
                    section.page_start
                ),
            )
        )

    return result


# ============================================================
# COMPLETE DOCUMENT TEXT
# ============================================================

def build_full_document_text(
    units: list[ExtractedUnit],
) -> str:
    """
    Build the complete extracted document text.

    PDF page boundaries are preserved.
    """

    parts: list[str] = []

    for unit in units:

        text = normalize_extracted_text(
            unit.text
        )

        if not text:
            continue

        if unit.page_number is not None:

            parts.append(
                f"\n[Page {unit.page_number}]\n"
            )

        parts.append(
            text
        )

    return normalize_extracted_text(
        "\n".join(parts)
    )


# ============================================================
# DATABASE PERSISTENCE
# ============================================================

def persist_document_structure(
    db: Session,
    document: PreparationDocument,
    sections: list[SectionData],
) -> None:
    """
    Persist document sections and chunks.

    CRITICAL DATABASE RULE:

        UNIQUE(document_id, chunk_index)

    Therefore chunk_index is GLOBAL across the entire
    document.

    Example:

        Section 0:
            chunk 0
            chunk 1
            chunk 2

        Section 1:
            chunk 3
            chunk 4
            chunk 5

        Section 2:
            chunk 6
            chunk 7

    NEVER do:

        Section 0:
            chunk 0

        Section 1:
            chunk 0   <-- WRONG

    The section_id identifies the section.
    The chunk_index identifies the chunk's global
    position within the document.
    """

    # --------------------------------------------------------
    # IMPORTANT:
    # This variable is intentionally declared OUTSIDE
    # the section loop.
    # --------------------------------------------------------

    chunk_global_index = 0

    # --------------------------------------------------------
    # Create all sections and chunks
    # --------------------------------------------------------

    for section_index, section_data in enumerate(
        sections
    ):

        # ----------------------------------------------------
        # Create section
        # ----------------------------------------------------

        section = PreparationDocumentSection(
            document_id=document.id,
            section_index=section_index,
            title=section_data.title,
            page_start=section_data.page_start,
            page_end=section_data.page_end,
            section_text=section_data.text,
            created_at=utc_now(),
        )

        db.add(section)

        # ----------------------------------------------------
        # Section ID is needed by chunks.
        # ----------------------------------------------------

        db.flush()

        # ----------------------------------------------------
        # Build section chunks
        # ----------------------------------------------------

        section_chunks = build_chunk_data(
            section_data
        )

        # ----------------------------------------------------
        # Insert chunks
        # ----------------------------------------------------

        for chunk_data in section_chunks:

            # ------------------------------------------------
            # Safety check:
            # never allow duplicate global indexes in memory.
            # ------------------------------------------------

            current_index = (
                chunk_global_index
            )

            chunk = PreparationDocumentChunk(
                document_id=document.id,

                section_id=section.id,

                # IMPORTANT:
                # GLOBAL document-level index.
                chunk_index=current_index,

                chunk_text=chunk_data.text,

                page_number=chunk_data.page_number,

                character_count=len(
                    chunk_data.text
                ),

                created_at=utc_now(),
            )

            db.add(chunk)

            # ------------------------------------------------
            # Increment AFTER creating the chunk.
            # ------------------------------------------------

            chunk_global_index += 1

    # --------------------------------------------------------
    # Flush all chunks.
    # --------------------------------------------------------

    db.flush()


# ============================================================
# MAIN DOCUMENT PROCESSOR
# ============================================================

def process_uploaded_document(
    db: Session,
    upload_file: UploadFile,
    user_id: int,
    conversation_id: int,
) -> PreparationDocument:
    """
    Process one uploaded document.

    Pipeline:

        validate
             ↓
        save physical file
             ↓
        extract text
             ↓
        normalize
             ↓
        detect sections
             ↓
        create document DB row
             ↓
        create sections
             ↓
        create GLOBAL chunks
             ↓
        mark completed

    Important:
        This function does NOT commit.

    The router controls:

        db.commit()

    and:

        db.rollback()
    """

    # ========================================================
    # 1. Validate filename
    # ========================================================

    original_filename = (
        get_safe_original_filename(
            upload_file.filename
            or "document"
        )
    )

    # ========================================================
    # 2. Validate extension
    # ========================================================

    extension = (
        validate_file_extension(
            original_filename
        )
    )

    # ========================================================
    # 3. MIME type
    # ========================================================

    mime_type = get_mime_type(
        original_filename
    )

    # ========================================================
    # 4. Storage path
    # ========================================================

    storage_path = (
        build_document_storage_path(
            user_id=user_id,
            conversation_id=conversation_id,
            extension=extension,
        )
    )

    # ========================================================
    # 5. Save physical file
    # ========================================================

    file_size, file_hash = (
        save_uploaded_file(
            upload_file,
            storage_path,
        )
    )

    try:

        # ====================================================
        # 6. Extract document BEFORE DB persistence
        # ====================================================

        units, page_count = (
            extract_document(
                storage_path,
                extension,
            )
        )

        # ====================================================
        # 7. Build complete text
        # ====================================================

        full_text = (
            build_full_document_text(
                units
            )
        )

        if not full_text.strip():

            raise ValueError(
                "No readable text was extracted "
                "from the document."
            )

        # ====================================================
        # 8. Build sections
        # ====================================================

        sections = build_sections(
            units
        )

        if not sections:

            raise ValueError(
                "Unable to create document sections."
            )

        # ====================================================
        # 9. Create document DB record
        # ====================================================

        document = PreparationDocument(
            conversation_id=conversation_id,
            file_name=original_filename,
            file_type=extension.lstrip(
                "."
            ),
            mime_type=mime_type,
            file_size=file_size,
            storage_path=str(
                storage_path
            ),
            file_hash=file_hash,
            extracted_text=full_text,
            page_count=(
                page_count
                if page_count > 0
                else None
            ),
            character_count=len(
                full_text
            ),
            analysis_status="processing",
            analysis_error=None,
            created_at=utc_now(),
            analyzed_at=None,
        )

        db.add(document)

        # ====================================================
        # 10. Generate document ID
        # ====================================================

        db.flush()

        # ====================================================
        # 11. Persist sections + GLOBAL chunks
        # ====================================================

        persist_document_structure(
            db=db,
            document=document,
            sections=sections,
        )

        # ====================================================
        # 12. Mark processing complete
        # ====================================================

        document.analysis_status = (
            "completed"
        )

        document.analysis_error = None

        document.analyzed_at = (
            utc_now()
        )

        # ====================================================
        # 13. Final flush
        # ====================================================

        db.flush()

        return document

    except Exception:

        # ====================================================
        # IMPORTANT:
        # Do NOT call db.rollback() here.
        #
        # The router owns the DB transaction.
        # ====================================================

        try:

            if storage_path.exists():

                storage_path.unlink()

        except OSError:

            pass

        raise


# ============================================================
# DOCUMENT SERIALIZATION
# ============================================================

def document_to_dict(
    document: PreparationDocument,
) -> dict:
    """
    Convert ORM document into frontend-safe metadata.

    storage_path is intentionally NOT exposed.
    """

    return {
        "id": document.id,

        "file_name": document.file_name,

        "file_type": document.file_type,

        "mime_type": document.mime_type,

        "file_size": document.file_size,

        "page_count": document.page_count,

        "character_count": (
            document.character_count
        ),

        "analysis_status": (
            document.analysis_status
        ),

        "analysis_error": (
            document.analysis_error
        ),

        "created_at": (
            document.created_at.isoformat()
            if document.created_at
            else None
        ),

        "analyzed_at": (
            document.analyzed_at.isoformat()
            if document.analyzed_at
            else None
        ),
    }
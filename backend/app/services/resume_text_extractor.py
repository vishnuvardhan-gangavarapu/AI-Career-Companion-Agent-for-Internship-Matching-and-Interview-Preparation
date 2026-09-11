import fitz

from docx import Document


# =========================================================
# PDF
# =========================================================

def extract_text_from_pdf(
    file_path: str,
) -> str:

    try:

        document = fitz.open(
            file_path
        )

        pages = []

        for page in document:

            text = page.get_text()

            if text:

                pages.append(
                    text.strip()
                )

        document.close()

        result = "\n".join(
            pages
        ).strip()

        if not result:

            raise RuntimeError(
                "No readable text was found in the PDF."
            )

        return result

    except Exception as exc:

        raise RuntimeError(
            f"Unable to extract text from PDF: {exc}"
        ) from exc


# =========================================================
# DOCX
# =========================================================

def extract_text_from_docx(
    file_path: str,
) -> str:

    try:

        document = Document(
            file_path
        )

        paragraphs = [

            paragraph.text.strip()

            for paragraph
            in document.paragraphs

            if paragraph.text.strip()
        ]

        result = "\n".join(
            paragraphs
        ).strip()

        if not result:

            raise RuntimeError(
                "No readable text was found in the DOCX."
            )

        return result

    except Exception as exc:

        raise RuntimeError(
            f"Unable to extract text from DOCX: {exc}"
        ) from exc


# =========================================================
# MAIN EXTRACTOR
# =========================================================

def extract_resume_text(
    file_path: str,
    file_type: str,
) -> str:

    extension = (
        file_type
        .lower()
        .replace(".", "")
        .strip()
    )

    if extension == "pdf":

        return extract_text_from_pdf(
            file_path
        )

    if extension == "docx":

        return extract_text_from_docx(
            file_path
        )

    raise ValueError(
        "Only PDF and DOCX resumes are supported."
    )
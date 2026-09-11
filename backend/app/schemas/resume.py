from datetime import datetime

from pydantic import BaseModel

class ResumeUploadResponse(BaseModel):
    message: str
    resume_id: int
    filename: str

class ResumeListItem(BaseModel):
    id: int
    file_name: str
    file_type: str
    file_size: int | None
    analysis_status: str
    uploaded_at: datetime
    analyzed_at: datetime | None
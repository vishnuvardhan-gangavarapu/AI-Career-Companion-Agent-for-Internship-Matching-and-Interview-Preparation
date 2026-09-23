from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database.connection import Base, engine

from app.models import (
    User,
    Resume,
    ResumeProfile,
    Internship,
    SavedInternship,
    Application,
    Notification,
    AIChatHistory,
    PreparationConversation,
    PreparationMessage,
    PreparationDocument,
    PreparationMessageDocument,
    PreparationDocumentSection,
    PreparationDocumentChunk,
)

from app.routers.auth import router as auth_router
from app.routers.resume import router as resume_router
from app.routers.profile import router as profile_router
from app.routers.internship import router as internship_router
from app.routers.cover_letter import router as cover_letter_router
from app.routers.application import router as application_router
from app.routers.dashboard import router as dashboard_router
from app.routers.skill_gap import router as skill_gap_router
from app.routers.saved_internships import router as saved_internships_router
from app.routers.notifications import router as notifications_router
from app.routers.ai_assistant import router as ai_assistant_router
from app.routers.preparation import router as preparation_router
from app.routers.preparation_chat import router as preparation_chat_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Internship Matcher",
    description=(
        "Backend API for the AI Internship Matcher application"
    ),
    version="1.0.0",
)

app.mount(
    "/uploads",
    StaticFiles(directory="uploads"),
    name="uploads",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(resume_router)
app.include_router(skill_gap_router)
app.include_router(profile_router)
app.include_router(internship_router)
app.include_router(cover_letter_router)
app.include_router(application_router)
app.include_router(dashboard_router)
app.include_router(saved_internships_router)
app.include_router(notifications_router)
app.include_router(ai_assistant_router)
app.include_router(preparation_router)
app.include_router(preparation_chat_router)

@app.get("/")
def root():
    return {
        "message": "AI Internship Matcher API is running"
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }
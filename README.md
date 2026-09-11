# InternMatch AI

> **AI-powered internship discovery, resume intelligence, application
> support, and interview preparation platform.**

InternMatch AI is a full-stack web application designed to help students
and internship seekers move from **resume analysis → internship matching
→ skill-gap discovery → application support → interview preparation** in
one platform.

The project combines a modern React frontend with a FastAPI backend,
PostgreSQL persistence, SQLAlchemy ORM, and Groq-powered AI services.

------------------------------------------------------------------------

## ✨ Highlights

-   🔐 User registration, login, JWT authentication, password recovery,
    and account management
-   📄 Resume upload and resume analysis
-   🤖 AI-assisted resume extraction using **Regex + Groq LLM**
-   🧠 Structured resume profiles containing education, skills,
    experience, projects, certifications, internships, achievements, and
    more
-   🎯 Internship discovery and resume/skill-based internship matching
-   📊 Internship match-details and skill-gap analysis
-   💾 Save internships for later
-   📝 Apply for internships and withdraw applications
-   ✉️ AI-generated personalized internship cover letters
-   📥 Cover-letter download support in PDF and DOCX formats
-   🔔 User notifications
-   💬 AI Assistant with persistent chat sessions and chat history
-   🎓 Preparation Agent for interview preparation, learning
    recommendations, mock interviews, voice interviews, question
    generation, answer evaluation, and session results
-   📚 Preparation Chat with conversation history and document uploads
-   📎 Preparation Chat document processing with stored document
    sections/chunks and message-document relationships
-   🎨 Responsive React UI with reusable layout/sidebar components and
    animated interfaces

------------------------------------------------------------------------

## 🏗️ Technology Stack

### Frontend

  Technology     Purpose
  -------------- ------------------------------------
  React 19       User interface
  React Router   Client-side routing
  Vite           Frontend development/build tooling
  Axios          HTTP requests
  Lucide React   UI icons
  CSS            Responsive and animated styling
  Oxlint         Frontend linting

### Backend

  Technology                     Purpose
  ------------------------------ ------------------------------
  Python                         Backend language
  FastAPI                        REST API framework
  SQLAlchemy 2                   ORM/database access
  PostgreSQL                     Persistent database
  Pydantic / Pydantic Settings   Validation and configuration
  JWT                            Authentication
  bcrypt / password hashing      Password security
  Groq                           LLM-powered AI features
  PyMuPDF                        PDF text extraction
  python-docx                    DOCX processing/generation
  python-dotenv                  Environment configuration

------------------------------------------------------------------------

## 🧩 Core Modules

### 1. Authentication

The platform provides:

-   User registration
-   Login
-   JWT-based authenticated requests
-   Password change
-   Forgot-password flow
-   Account deletion

Authentication-related backend logic is located in:

``` text
backend/app/routers/auth.py
backend/app/core/security.py
backend/app/core/dependencies.py
```

------------------------------------------------------------------------

### 2. Resume Intelligence

Users can upload supported resume files and have the platform extract
structured information.

Supported resume formats include:

``` text
PDF
DOC
DOCX
```

The resume pipeline combines:

``` text
Resume File
    ↓
Text Extraction
    ↓
Regex Extraction
    ↓
Groq LLM Extraction
    ↓
Structured Resume Profile
    ↓
Internship Matching / Preparation
```

Extracted profile information can include:

-   Full name
-   Email
-   Phone
-   Address
-   LinkedIn
-   GitHub
-   Professional summary
-   Skills
-   Technical skills
-   Soft skills
-   Education
-   Work experience
-   Projects
-   Certifications
-   Internships
-   Languages
-   Achievements
-   Publications

Relevant backend services:

``` text
backend/app/services/resume_text_extractor.py
backend/app/services/regex_parser.py
backend/app/services/groq_parser.py
backend/app/services/resume_merger.py
```

------------------------------------------------------------------------

### 3. Internship Matching

The internship module provides:

-   All internships
-   Matched internships
-   Internship details
-   Match details

Matching considers the candidate profile and internship requirements,
including skills.

Backend:

``` text
backend/app/routers/internship.py
```

Frontend:

``` text
frontend/src/pages/Internships.jsx
frontend/src/pages/InternshipDetails.jsx
frontend/src/pages/SkillGap.jsx
```

------------------------------------------------------------------------

### 4. Skill Gap Analysis

The Skill Gap feature helps the user understand the relationship between
their current skills and the requirements of an internship.

It is intended to make missing skills easier to identify before applying
or preparing for an internship.

Frontend:

``` text
frontend/src/pages/SkillGap.jsx
```

------------------------------------------------------------------------

### 5. Internship Applications

Authenticated users can:

-   View their applications
-   Open application details
-   Apply for internships
-   Withdraw applications
-   Download generated cover letters

Backend:

``` text
backend/app/routers/application.py
```

Database model:

``` text
backend/app/models/application.py
```

------------------------------------------------------------------------

### 6. AI Cover Letter Generator

InternMatch AI can generate a personalized internship cover letter using
the candidate's stored resume profile and the selected internship.

The generator is designed to:

-   Use the candidate's actual information
-   Connect relevant skills/projects to internship requirements
-   Avoid inventing experience
-   Avoid inventing technologies
-   Produce professional internship-focused content
-   Support regeneration variations

Backend service:

``` text
backend/app/services/cover_letter_generator.py
```

The application also provides PDF and DOCX download support.

------------------------------------------------------------------------

### 7. AI Assistant

The AI Assistant provides an authenticated conversational interface for
questions related to the user's InternMatch experience.

It supports:

-   Persistent chat sessions
-   Chat history
-   Session deletion
-   Context-aware answers
-   Candidate-specific context
-   Preparation-related guidance
-   Internship/skill/application questions when the required context is
    available

Backend:

``` text
backend/app/routers/ai_assistant.py
backend/app/services/ai_service.py
backend/app/services/ai_context_service.py
```

Frontend:

``` text
frontend/src/components/ai-assistant/AIAssistant.jsx
```

------------------------------------------------------------------------

### 8. Preparation Agent

The Preparation Agent is the interview-preparation module.

It includes backend flows for:

-   Preparation overview
-   Learning recommendations
-   Preparation-agent chat
-   Interview sessions
-   Question generation
-   Answer evaluation
-   Saving answers
-   Completing sessions
-   Session results
-   Voice interviews
-   Voice question generation/evaluation
-   Mock interviews
-   Mock question generation
-   Mock answer evaluation
-   Progress tracking
-   Final results

Backend:

``` text
backend/app/routers/preparation.py
backend/app/services/preparation_service.py
```

Frontend:

``` text
frontend/src/pages/PreparationAgent.jsx
```

------------------------------------------------------------------------

### 9. Preparation Chat

Preparation Chat is a dedicated AI conversation experience for interview
and career preparation.

It supports:

-   Creating conversations
-   Conversation history
-   Loading individual conversations
-   Deleting conversations
-   Sending messages
-   Uploading preparation documents
-   Viewing document attachments
-   Deleting documents
-   Persistent preparation messages
-   Document-aware AI responses

Backend:

``` text
backend/app/routers/preparation_chat.py
backend/app/services/preparation_chat_service.py
backend/app/services/preparation_document_service.py
```

The preparation-document data layer includes:

``` text
preparation_conversations
preparation_documents
preparation_document_chunks
preparation_document_sections
preparation_messages
preparation_message_documents
```

Frontend:

``` text
frontend/src/pages/PreparationChat.jsx
frontend/src/styles/PreparationChat.css
```

------------------------------------------------------------------------

## 🗂️ Project Structure

``` text
Infosys_Internship/
│
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── dependencies.py
│   │   │   └── security.py
│   │   │
│   │   ├── database/
│   │   │   └── connection.py
│   │   │
│   │   ├── models/
│   │   │   ├── ai_chat_history.py
│   │   │   ├── application.py
│   │   │   ├── internship.py
│   │   │   ├── notification.py
│   │   │   ├── preparation_conversation.py
│   │   │   ├── preparation_document.py
│   │   │   ├── preparation_document_chunk.py
│   │   │   ├── preparation_document_section.py
│   │   │   ├── preparation_message.py
│   │   │   ├── preparation_message_document.py
│   │   │   ├── resume.py
│   │   │   ├── resume_profile.py
│   │   │   └── user.py
│   │   │
│   │   ├── routers/
│   │   │   ├── ai_assistant.py
│   │   │   ├── application.py
│   │   │   ├── auth.py
│   │   │   ├── cover_letter.py
│   │   │   ├── dashboard.py
│   │   │   ├── internship.py
│   │   │   ├── notifications.py
│   │   │   ├── preparation.py
│   │   │   ├── preparation_chat.py
│   │   │   ├── profile.py
│   │   │   ├── resume.py
│   │   │   └── saved_internships.py
│   │   │
│   │   ├── services/
│   │   │   ├── ai_context_service.py
│   │   │   ├── ai_service.py
│   │   │   ├── cover_letter_generator.py
│   │   │   ├── groq_parser.py
│   │   │   ├── notification_service.py
│   │   │   ├── preparation_chat_service.py
│   │   │   ├── preparation_document_service.py
│   │   │   ├── preparation_service.py
│   │   │   ├── regex_parser.py
│   │   │   ├── resume_merger.py
│   │   │   └── resume_text_extractor.py
│   │   │
│   │   └── main.py
│   │
│   ├── requirements.txt
│   └── .env                 # local secrets; do not commit
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ai-assistant/
│   │   │   ├── layout/
│   │   │   └── notifications/
│   │   │
│   │   ├── pages/
│   │   │   ├── Application.jsx
│   │   │   ├── CreateCoverLetter.jsx
│   │   │   ├── DefaultDashboard.jsx
│   │   │   ├── DefaultProfile.jsx
│   │   │   ├── ForgotPassword.jsx
│   │   │   ├── InternshipDetails.jsx
│   │   │   ├── Internships.jsx
│   │   │   ├── Landing.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── PreparationAgent.jsx
│   │   │   ├── PreparationChat.jsx
│   │   │   ├── Profile.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Resume.jsx
│   │   │   ├── SavedInternships.jsx
│   │   │   ├── Settings.jsx
│   │   │   ├── SkillGap.jsx
│   │   │   └── UserDashboard.jsx
│   │   │
│   │   └── App.jsx
│   │
│   ├── public/
│   ├── package.json
│   ├── vite.config.js
│   └── .gitignore
│
└── README.md
```

------------------------------------------------------------------------

## 🔄 Application Flow

``` text
                    ┌───────────────┐
                    │    Landing    │
                    └───────┬───────┘
                            │
                    Register / Login
                            │
                            ▼
                    ┌───────────────┐
                    │ Resume Upload │
                    └───────┬───────┘
                            │
                 Regex + Groq Analysis
                            │
                            ▼
                  ┌──────────────────┐
                  │ Resume Profile   │
                  └────────┬─────────┘
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
       Internships     Skill Gap     Preparation
             │                           │
             ▼                           ▼
         Match / Save             Agent / Chat
             │                           │
             ▼                           ▼
          Apply                 Mock / Voice Interview
             │                           │
             ▼                           ▼
      Cover Letter                 AI Evaluation
```

------------------------------------------------------------------------

## ⚙️ Prerequisites

Install the following before running the project:

-   **Python 3.11+ recommended**
-   **Node.js 18+ recommended**
-   **PostgreSQL**
-   A **Groq API key**

You should also have a PostgreSQL database available for the
application.

------------------------------------------------------------------------

## 🚀 Installation

### 1. Clone the repository

``` bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd Infosys_Internship
```

------------------------------------------------------------------------

### 2. Create the PostgreSQL database

Create a PostgreSQL database for the project.

Example:

``` sql
CREATE DATABASE infosys_internship;
```

------------------------------------------------------------------------

### 3. Configure backend environment variables

Create:

``` text
backend/.env
```

Use the following structure:

``` env
DATABASE_URL=postgresql+psycopg://<username>:<password>@localhost:5432/infosys_internship

JWT_SECRET_KEY=<your-secure-secret>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

GROQ_API_KEY=<your-groq-api-key>
```

> **Never commit real API keys, JWT secrets, database passwords, or
> other credentials to GitHub.**

------------------------------------------------------------------------

### 4. Create a Python virtual environment

From the `backend` directory:

``` bash
cd backend
python -m venv venv
```

Activate it on Windows:

``` bash
venv\Scripts\activate
```

On macOS/Linux:

``` bash
source venv/bin/activate
```

------------------------------------------------------------------------

### 5. Install backend dependencies

``` bash
pip install -r requirements.txt
```

------------------------------------------------------------------------

### 6. Start the FastAPI backend

From:

``` text
Infosys_Internship/backend
```

run:

``` bash
uvicorn app.main:app --reload
```

The API will normally be available at:

``` text
http://localhost:8000
```

FastAPI documentation:

``` text
http://localhost:8000/docs
```

Health endpoint:

``` text
http://localhost:8000/health
```

------------------------------------------------------------------------

### 7. Install frontend dependencies

Open another terminal:

``` bash
cd frontend
npm install
```

------------------------------------------------------------------------

### 8. Start the React frontend

``` bash
npm run dev
```

Vite will normally serve the frontend at:

``` text
http://localhost:5173
```

------------------------------------------------------------------------

## 🧪 Frontend Commands

Inside `frontend/`:

### Development

``` bash
npm run dev
```

### Production build

``` bash
npm run build
```

### Preview production build

``` bash
npm run preview
```

### Lint

``` bash
npm run lint
```

------------------------------------------------------------------------

## 🔌 Backend API Overview

The backend is organized around feature-specific routers.

  Router                     Main responsibility
  -------------------------- -----------------------------------------------
  `/api/auth`                Authentication and account operations
  `/api/resume`              Resume upload, analysis, retrieval, deletion
  `/api/profile`             User profile
  `/api/internships`         Internship discovery and matching
  `/api/applications`        Internship applications
  `/api/saved-internships`   Saved internships
  `/api/notifications`       Notifications
  `/api/ai-assistant`        AI Assistant sessions and messages
  `/api/preparation`         Interview preparation and mock/voice sessions
  `/api/preparation-chat`    Preparation conversations and documents
  `/api/cover-letter`        Cover-letter generation

Exact routes can be inspected through the FastAPI Swagger UI at:

``` text
http://localhost:8000/docs
```

------------------------------------------------------------------------

## 🗄️ Database

The application uses PostgreSQL with SQLAlchemy.

Core entities include:

``` text
users
resumes
resume_profiles
internships
saved_internships
applications
notifications
ai_chat_history
preparation_conversations
preparation_documents
preparation_document_chunks
preparation_document_sections
preparation_messages
preparation_message_documents
```

The backend initializes SQLAlchemy metadata when the application starts.

For production deployments, a proper migration workflow such as Alembic
should be considered rather than relying on automatic table creation.

------------------------------------------------------------------------

## 🔐 Security Notes

The repository should **not** contain:

``` text
API keys
JWT secrets
Database passwords
Production credentials
Private certificates
Uploaded personal resumes
Generated user documents
```

Recommended Git exclusions include:

``` text
.env
.env.*
venv/
__pycache__/
*.pyc
node_modules/
dist/
uploads/
```

Before pushing to GitHub, inspect the repository for accidentally
committed credentials.

------------------------------------------------------------------------

## 🧠 AI Architecture

InternMatch AI uses AI selectively rather than sending every operation
directly to an LLM.

### Resume processing

``` text
Resume
  ↓
Text extraction
  ↓
Regex-based extraction
  ↓
Groq structured extraction
  ↓
Resume profile
```

### AI Assistant

``` text
Authenticated user
       ↓
Question
       ↓
Context preparation
       ↓
Relevant candidate/platform context
       ↓
Groq
       ↓
AI response
       ↓
Stored chat history
```

### Preparation Chat

``` text
User question
       +
Optional document
       ↓
Document processing
       ↓
Relevant preparation context
       ↓
Groq
       ↓
Preparation response
       ↓
Conversation history
```

The AI services are designed to avoid inventing candidate-specific
information when the required information is unavailable.

------------------------------------------------------------------------

## 📁 Resume File Processing

The backend contains dedicated services for extracting and analyzing
resume content:

``` text
resume_text_extractor.py
regex_parser.py
groq_parser.py
resume_merger.py
```

This separation makes the resume pipeline easier to maintain and allows
deterministic extraction and LLM-based extraction to complement each
other.

------------------------------------------------------------------------

## 🎯 Intended User Journey

A typical user can use the platform as follows:

1.  Create an account.
2.  Log in.
3.  Upload a resume.
4.  Analyze the resume.
5.  Review the generated profile.
6.  Explore matched internships.
7.  Inspect skill gaps.
8.  Save suitable internships.
9.  Generate a personalized cover letter.
10. Apply for an internship.
11. Use the AI Assistant for platform/career questions.
12. Open Preparation Agent for structured interview preparation.
13. Use Preparation Chat for document-aware preparation.
14. Practice mock or voice interviews.
15. Review AI-generated evaluation and preparation results.

------------------------------------------------------------------------

## 🎨 Frontend Design

The frontend is organized into reusable page, layout, sidebar,
notification, and AI-assistant components.

Main shared components include:

``` text
Layout.jsx
UserSidebar.jsx
DefaultSidebar.jsx
NotificationBell.jsx
AIAssistant.jsx
```

The UI uses dedicated CSS files for individual pages and components,
allowing feature-level styling without introducing a frontend CSS
framework.

------------------------------------------------------------------------

## 🛠️ Troubleshooting

### Backend does not start

Verify:

``` text
Python environment
PostgreSQL availability
backend/.env
DATABASE_URL
GROQ_API_KEY
```

Then run:

``` bash
uvicorn app.main:app --reload
```

------------------------------------------------------------------------

### Frontend cannot reach the API

Make sure the FastAPI backend is running on:

``` text
http://localhost:8000
```

and the frontend is running on:

``` text
http://localhost:5173
```

Also check the frontend API configuration used by the application.

------------------------------------------------------------------------

### PostgreSQL connection errors

Verify:

-   PostgreSQL service is running
-   Database exists
-   Username is correct
-   Password is correct
-   Port is correct
-   Database name is correct

------------------------------------------------------------------------

### AI features fail

Verify that:

``` env
GROQ_API_KEY=<your-key>
```

is configured correctly in `backend/.env`.

------------------------------------------------------------------------

## 🚧 Future Improvements

Possible future enhancements include:

-   Alembic database migrations
-   Automated backend tests
-   Automated frontend tests
-   CI/CD pipeline
-   Production deployment configuration
-   Docker / Docker Compose
-   Improved observability and structured logging
-   Rate limiting
-   More granular API authorization
-   Object storage for uploaded documents
-   Background processing for large documents
-   Vector search/retrieval for larger preparation-document collections

------------------------------------------------------------------------

## 📌 Project Status

**InternMatch AI** is a full-stack internship and interview-preparation
platform combining:

**Resume Intelligence + Internship Matching + Skill Gap Analysis +
Applications + AI Cover Letters + AI Assistant + Interview Preparation +
Preparation Chat**

The project is structured as a separate React frontend and FastAPI
backend with PostgreSQL persistence.

------------------------------------------------------------------------

## 👨‍💻 Development

Built as a full-stack AI-powered internship platform with a focus on:

-   Practical internship discovery
-   Resume-driven personalization
-   AI-assisted career preparation
-   Interview practice
-   Document-aware preparation
-   Clean and responsive user experience

------------------------------------------------------------------------

## 📄 License

Add the license that matches how you intend to distribute the project.

For example, if you choose MIT:

``` text
MIT License
```

Do not add a license unless you have decided which license you want to
use.

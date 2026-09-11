from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models import (
    User,
    Resume,
    ResumeProfile,
    Internship,
    SavedInternship,
    Application,
    Notification,
)


# =========================================================
# CONTEXT LIMITS
# =========================================================

# Keep this considerably smaller than the previous version.
# This protects Groq from unnecessarily large requests.

MAX_CONTEXT_LENGTH = 5500

MAX_TEXT_LENGTH = 700

MAX_LIST_ITEMS = 8


# =========================================================
# APPLICATION KNOWLEDGE / QUESTION SCOPE
# =========================================================
# This registry is the central source for what InternMatch
# exposes to the AI. It is intentionally independent of any
# single React page so the assistant can reason across the
# whole application.

DASHBOARD_ROLES = {
    "default": {"intern"},
    "user": {"intern"},
}

APPLICATION_PAGES = {
    "default": [
        "/defaultDashboard",
        "/defaultProfile",
        "/resume",
        "/internships",
        "/applications",
        "/skill-gap",
        "/saved-internships",
        "/settings",
    ],
    "user": [
        "/userDashboard",
        "/profile",
        "/resume",
        "/internships",
        "/applications",
        "/skill-gap",
        "/saved-internships",
        "/cover-letters/create",
        "/settings",
    ],
}

FEATURE_RULES = {
    "dashboard": {"dashboards": {"default", "user"}, "roles": {"intern"}},
    "profile": {"dashboards": {"default", "user"}, "roles": {"intern"}},
    "resume": {"dashboards": {"default", "user"}, "roles": {"intern"}},
    "internships": {"dashboards": {"default", "user"}, "roles": {"intern"}},
    "applications": {"dashboards": {"default", "user"}, "roles": {"intern"}},
    "saved_internships": {"dashboards": {"default", "user"}, "roles": {"intern"}},
    "skill_gap": {"dashboards": {"user", "default"}, "roles": {"intern"}},
    "cover_letter": {"dashboards": {"user", "default"}, "roles": {"intern"}},
    "settings": {"dashboards": {"default", "user"}, "roles": {"intern"}},
    "account_deletion": {"dashboards": {"default", "user"}, "roles": {"intern"}},
    "notifications": {"dashboards": {"default", "user"}, "roles": {"intern"}},
    "chat_history": {"dashboards": {"default", "user"}, "roles": {"intern"}},
}

FEATURE_KEYWORDS = {
    "account_deletion": ["delete account", "delete my account", "remove account", "close account", "deactivate account", "permanently delete"],
    "profile": ["profile", "my name", "my email", "my phone", "my location", "linkedin", "github", "profile completion"],
    "resume": ["resume", "cv", "education", "experience", "project", "certification", "skill", "degree", "college", "university"],
    "internships": ["internship", "internships", "opportunity", "opportunities", "available internships", "internships page"],
    "applications": ["application", "applications", "applied", "apply", "application status", "withdraw", "pending", "approved", "rejected"],
    "saved_internships": ["saved internship", "saved internships", "saved jobs", "bookmark", "bookmarked"],
    "skill_gap": ["skill gap", "skill gaps", "missing skill", "missing skills", "skills i am missing", "skills i need to learn"],
    "cover_letter": ["cover letter", "coverletter", "application letter"],
    "settings": ["settings", "account settings", "preferences", "password", "change password"],
    "notifications": ["notification", "notifications", "unread", "alerts"],
    "dashboard": ["dashboard", "home page", "homepage", "what can i do", "what can i see", "features", "how does internmatch", "how does the platform work", "how can i use internmatch"],
    "chat_history": ["previous question", "second question", "third question", "last question", "chat history", "conversation history", "what did i ask"],
}


def detect_feature_intents(user_message: str):
    text = (user_message or "").lower().strip()
    matched = []
    for feature, keywords in FEATURE_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            matched.append(feature)
    return matched


def validate_question_scope(
    user_message: str,
    dashboard_type: str,
    user_role: str,
) -> Dict[str, Any]:
    """Validate whether the question is supported by both role and dashboard."""
    dashboard = (dashboard_type or "default").strip().lower()
    role = (user_role or "").strip().lower()
    intents = detect_feature_intents(user_message)

    if dashboard not in DASHBOARD_ROLES:
        return {
            "valid": False,
            "reason": "unknown_dashboard",
            "error_message": "This AI question cannot be processed because the current dashboard is unknown.",
            "intents": intents,
        }

    if role not in DASHBOARD_ROLES[dashboard]:
        return {
            "valid": False,
            "reason": "role_dashboard_mismatch",
            "error_message": "This question is not available for your current dashboard and account role.",
            "intents": intents,
        }

    # Unknown/general questions are allowed to reach the AI. The model must
    # answer only from supplied application context and user data.
    if not intents:
        return {
            "valid": True,
            "reason": "general_question",
            "error_message": "",
            "intents": [],
        }

    invalid = []
    for feature in intents:
        rule = FEATURE_RULES.get(feature)
        if not rule:
            continue
        if dashboard not in rule["dashboards"] or role not in rule["roles"]:
            invalid.append(feature)

    if invalid:
        return {
            "valid": False,
            "reason": "feature_not_available_for_scope",
            "error_message": (
                "That question is not available for your current dashboard or account role. "
                "Please ask about features available in your current InternMatch experience."
            ),
            "intents": intents,
            "invalid_features": invalid,
        }

    return {
        "valid": True,
        "reason": "supported",
        "error_message": "",
        "intents": intents,
    }


def get_application_knowledge_context(
    dashboard_type: str,
    user_role: str,
) -> Dict[str, Any]:
    """Return the application's current navigation and feature contract."""
    dashboard = (dashboard_type or "default").strip().lower()
    role = (user_role or "").strip().lower()
    return {
        "application": "InternMatch",
        "dashboard_type": dashboard,
        "account_role": role,
        "available_pages": APPLICATION_PAGES.get(dashboard, []),
        "feature_scope": sorted(
            feature
            for feature, rule in FEATURE_RULES.items()
            if dashboard in rule["dashboards"] and role in rule["roles"]
        ),
        "instruction": (
            "Use this application contract together with live database and frontend context. "
            "Never claim a page or action exists outside this contract."
        ),
    }


def get_frontend_context(
    frontend_context: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Sanitize frontend state and normalize important UI-only values.

    Persistent profile/application data remains database-authoritative.
    Values that are calculated and displayed only by React, such as the
    profile completion percentage, are preserved as live frontend state.
    """
    if not isinstance(frontend_context, dict):
        return {}

    cleaned = safe_json(frontend_context) or {}
    if not isinstance(cleaned, dict):
        return {}

    local_state = cleaned.get("local_application_state")
    if not isinstance(local_state, dict):
        local_state = {}

    # Profile.jsx stores this exact UI value in localStorage. Normalize it
    # into a named field so the AI does not have to infer it from arbitrary
    # local-storage keys.
    completion = local_state.get("profile_completion_percentage")
    if completion is not None and str(completion).strip() != "":
        cleaned["profile_completion"] = {
            "percentage": str(completion).strip(),
            "source": "current React application UI",
            "instruction": (
                "For the user's displayed profile completion percentage, "
                "use this value exactly. Do not recalculate it from partial "
                "database fields unless the user explicitly asks for a recalculation."
            ),
        }

    return cleaned


# =========================================================
# SAFE TEXT
# =========================================================

def safe_text(
    value: Any,
    max_length: int = MAX_TEXT_LENGTH,
) -> str:

    if value is None:
        return ""

    text = str(value).strip()

    if len(text) <= max_length:
        return text

    return (
        text[:max_length].rstrip()
        + "..."
    )


# =========================================================
# SAFE JSON
# =========================================================

def safe_json(
    value: Any,
) -> Any:

    if value is None:
        return None

    if isinstance(value, dict):

        result = {}

        for key, item in value.items():

            result[str(key)] = safe_json(item)

        return result

    if isinstance(value, list):

        return [
            safe_json(item)
            for item in value[:MAX_LIST_ITEMS]
        ]

    if isinstance(value, tuple):

        return [
            safe_json(item)
            for item in value[:MAX_LIST_ITEMS]
        ]

    if isinstance(value, str):

        return safe_text(
            value,
            700,
        )

    if isinstance(
        value,
        (
            int,
            float,
            bool,
        ),
    ):

        return value

    return safe_text(
        value,
        700,
    )


# =========================================================
# USER CONTEXT
# =========================================================

def get_user_context(
    db: Session,
    user_id: int,
) -> Dict[str, Any]:

    user = (
        db.query(User)
        .filter(
            User.id == user_id
        )
        .first()
    )

    if not user:
        return {}

    return {
        "user_id": user.id,

        "full_name": safe_text(
            user.full_name,
            150,
        ),

        "email": safe_text(
            user.email,
            255,
        ),

        "phone": safe_text(
            user.phone,
            30,
        ),

        "role": safe_text(
            user.role,
            50,
        ),

        "location": safe_text(
            user.location,
            150,
        ),

        "address": safe_text(
            user.address,
            300,
        ),

        "linkedin_url": safe_text(
            user.linkedin_url,
            300,
        ),

        "github_url": safe_text(
            user.github_url,
            300,
        ),

        "profile_summary": safe_text(
            user.profile_summary,
            700,
        ),

        "is_active": user.is_active,
    }


# =========================================================
# RESUME CONTEXT
# =========================================================

def get_resume_context(
    db: Session,
    user_id: int,
) -> Dict[str, Any]:

    resume = (
        db.query(Resume)
        .filter(
            Resume.user_id == user_id
        )
        .order_by(
            Resume.uploaded_at.desc()
        )
        .first()
    )

    # -----------------------------------------------------
    # USER HAS NO RESUME
    # -----------------------------------------------------

    if not resume:

        return {
            "resume_available": False,

            "profile_available": False,

            "analysis_status": "not_uploaded",

            "message": (
                "The user has not uploaded a resume."
            ),
        }

    result = {

        "resume_available": True,

        "file_name": safe_text(
            resume.file_name,
            255,
        ),

        "file_type": safe_text(
            resume.file_type,
            50,
        ),

        "analysis_status": safe_text(
            resume.analysis_status,
            50,
        ),

        "uploaded_at": (
            str(resume.uploaded_at)
            if resume.uploaded_at
            else None
        ),

        "analyzed_at": (
            str(resume.analyzed_at)
            if resume.analyzed_at
            else None
        ),
    }

    # -----------------------------------------------------
    # GET ANALYZED RESUME PROFILE
    # -----------------------------------------------------

    profile = (
        db.query(ResumeProfile)
        .filter(
            ResumeProfile.user_id == user_id,
            ResumeProfile.resume_id == resume.id,
        )
        .first()
    )

    if not profile:

        result.update(
            {
                "profile_available": False,

                "message": (
                    "Resume uploaded but the resume "
                    "profile has not been analyzed yet."
                ),
            }
        )

        return result

    # -----------------------------------------------------
    # ANALYZED PROFILE
    # -----------------------------------------------------

    result["profile_available"] = True

    result["full_name"] = safe_text(
        profile.full_name,
        150,
    )

    result["email"] = safe_text(
        profile.email,
        255,
    )

    result["phone"] = safe_text(
        profile.phone,
        30,
    )

    result["address"] = safe_text(
        profile.address,
        300,
    )

    result["linkedin_url"] = safe_text(
        profile.linkedin_url,
        300,
    )

    result["github_url"] = safe_text(
        profile.github_url,
        300,
    )

    result["professional_summary"] = safe_text(
        profile.professional_summary,
        700,
    )

    result["skills"] = safe_json(
        profile.skills
    )

    result["technical_skills"] = safe_json(
        profile.technical_skills
    )

    result["soft_skills"] = safe_json(
        profile.soft_skills
    )

    result["education"] = safe_json(
        profile.education
    )

    result["work_experience"] = safe_json(
        profile.work_experience
    )

    result["projects"] = safe_json(
        profile.projects
    )

    result["certifications"] = safe_json(
        profile.certifications
    )

    result["internships"] = safe_json(
        profile.internships
    )

    result["languages"] = safe_json(
        profile.languages
    )

    result["achievements"] = safe_json(
        profile.achievements
    )

    result["publications"] = safe_json(
        profile.publications
    )

    return result


# =========================================================
# SAVED INTERNSHIPS
# =========================================================

def get_saved_internship_context(
    db: Session,
    user_id: int,
) -> Dict[str, Any]:

    saved_records = (
        db.query(SavedInternship)
        .filter(
            SavedInternship.user_id == user_id
        )
        .order_by(
            SavedInternship.saved_at.desc()
        )
        .limit(MAX_LIST_ITEMS)
        .all()
    )

    internships = []

    for saved in saved_records:

        internship = (
            db.query(Internship)
            .filter(
                Internship.id
                == saved.internship_id
            )
            .first()
        )

        if not internship:
            continue

        internships.append(
            {
                "saved_id":
                    saved.id,

                "internship_id":
                    internship.id,

                "company_name":
                    safe_text(
                        internship.company_name,
                        150,
                    ),

                "title":
                    safe_text(
                        internship.title,
                        150,
                    ),

                "location":
                    safe_text(
                        internship.location,
                        100,
                    ),

                "duration":
                    safe_text(
                        internship.duration,
                        80,
                    ),

                "work_mode":
                    safe_text(
                        internship.work_mode,
                        80,
                    ),

                "stipend":
                    safe_text(
                        internship.stipend,
                        80,
                    ),

                "required_skills":
                    safe_json(
                        internship.required_skills
                    ),

                "saved_at":
                    (
                        str(saved.saved_at)
                        if saved.saved_at
                        else None
                    ),
            }
        )

    return {
        "total_saved":
            len(internships),

        "internships":
            internships,
    }


# =========================================================
# APPLICATION CONTEXT
# =========================================================

def get_application_context(
    db: Session,
    user_id: int,
) -> Dict[str, Any]:

    applications = (
        db.query(Application)
        .filter(
            Application.user_id == user_id
        )
        .order_by(
            Application.applied_at.desc()
        )
        .limit(MAX_LIST_ITEMS)
        .all()
    )

    result = []

    for application in applications:

        internship = (
            db.query(Internship)
            .filter(
                Internship.id
                == application.internship_id
            )
            .first()
        )

        item = {

            "application_id":
                application.id,

            "internship_id":
                application.internship_id,

            "status":
                safe_text(
                    application.status,
                    50,
                ),

            "applied_at":
                (
                    str(application.applied_at)
                    if application.applied_at
                    else None
                ),

            "updated_at":
                (
                    str(application.updated_at)
                    if application.updated_at
                    else None
                ),

            "withdrawn_at":
                (
                    str(application.withdrawn_at)
                    if application.withdrawn_at
                    else None
                ),
        }

        if internship:

            item["company_name"] = safe_text(
                internship.company_name,
                150,
            )

            item["title"] = safe_text(
                internship.title,
                150,
            )

            item["location"] = safe_text(
                internship.location,
                100,
            )

        result.append(item)

    return {
        "total_applications":
            len(result),

        "applications":
            result,
    }


# =========================================================
# NOTIFICATION CONTEXT
# =========================================================

def get_notification_context(
    db: Session,
    user_id: int,
) -> Dict[str, Any]:

    notifications = (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id
        )
        .order_by(
            Notification.created_at.desc()
        )
        .limit(MAX_LIST_ITEMS)
        .all()
    )

    result = []

    for notification in notifications:

        result.append(
            {
                "title":
                    safe_text(
                        notification.title,
                        150,
                    ),

                "message":
                    safe_text(
                        notification.message,
                        400,
                    ),

                "type":
                    safe_text(
                        notification.notification_type,
                        80,
                    ),

                "is_read":
                    notification.is_read,

                "related_entity_type":
                    safe_text(
                        notification.related_entity_type,
                        80,
                    ),

                "related_entity_id":
                    notification.related_entity_id,

                "created_at":
                    (
                        str(
                            notification.created_at
                        )
                        if notification.created_at
                        else None
                    ),
            }
        )

    unread_count = sum(
        1
        for item in result
        if not item["is_read"]
    )

    return {
        "unread_count":
            unread_count,

        "recent_notifications":
            result,
    }


# =========================================================
# DASHBOARD STATE
# =========================================================

def get_dashboard_context(
    db: Session,
    user_id: int,
) -> Dict[str, Any]:

    resume = (
        db.query(Resume)
        .filter(
            Resume.user_id == user_id
        )
        .order_by(
            Resume.uploaded_at.desc()
        )
        .first()
    )

    # -----------------------------------------------------
    # DEFAULT USER
    # -----------------------------------------------------

    if not resume:

        return {
            "dashboard_type":
                "default_user_dashboard",

            "resume_uploaded":
                False,

            "resume_analyzed":
                False,

            "description": (
                "The user has not uploaded a resume. "
                "The user is using the default dashboard."
            ),

            "available_state": [
                "Profile",
                "Resume upload",
                "Internship discovery",
                "AI Assistant",
                "Settings",
            ],
        }

    # -----------------------------------------------------
    # RESUME EXISTS
    # -----------------------------------------------------

    profile = (
        db.query(ResumeProfile)
        .filter(
            ResumeProfile.user_id == user_id,
            ResumeProfile.resume_id == resume.id,
        )
        .first()
    )

    # -----------------------------------------------------
    # RESUME UPLOADED BUT NOT ANALYZED
    # -----------------------------------------------------

    if not profile:

        return {
            "dashboard_type":
                "resume_uploaded_dashboard",

            "resume_uploaded":
                True,

            "resume_analyzed":
                False,

            "analysis_status":
                safe_text(
                    resume.analysis_status,
                    50,
                ),

            "description": (
                "The user has uploaded a resume, "
                "but the resume profile is not "
                "available yet."
            ),

            "available_state": [
                "Resume",
                "Resume analysis",
                "Profile",
                "Internship discovery",
                "AI Assistant",
                "Settings",
            ],
        }

    # -----------------------------------------------------
    # ANALYZED USER DASHBOARD
    # -----------------------------------------------------

    return {
        "dashboard_type":
            "analyzed_user_dashboard",

        "resume_uploaded":
            True,

        "resume_analyzed":
            True,

        "analysis_status":
            safe_text(
                resume.analysis_status,
                50,
            ),

        "description": (
            "The user's resume has been analyzed "
            "and a resume profile is available."
        ),

        "available_state": [
            "Profile",
            "Resume",
            "Internship matching",
            "Saved internships",
            "Skill gap",
            "Applications",
            "Notifications",
            "AI Assistant",
            "Settings",
        ],
    }


# =========================================================
# GENERAL INTERNMATCH WORKFLOW
# =========================================================

def get_general_application_context() -> Dict[str, Any]:

    return {
        "application_name":
            "InternMatch",

        "purpose": (
            "InternMatch helps students and "
            "recent graduates discover, save, "
            "and apply for internships."
        ),

        "workflow": [
            "Sign up or log in.",
            "Complete the profile.",
            "Upload a resume.",
            "Resume information is analyzed.",
            "View internships.",
            "Compare opportunities with your profile.",
            "Save interesting internships.",
            "Review skill gaps when available.",
            "Create or provide a cover letter.",
            "Apply for internships.",
            "Track application status.",
            "Receive notifications.",
            "Update profile and resume when needed.",
        ],

        "ai_assistant_workflow": [
            "User asks a question.",
            "InternMatch identifies relevant context.",
            "Only relevant user data is prepared.",
            "Groq AI generates a concise answer.",
            "The question and answer are saved in chat history.",
        ],
    }


# =========================================================
# INTERNSHIP CATALOG SUMMARY
# =========================================================

def get_internship_catalog_context(
    db: Session,
) -> Dict[str, Any]:
    """Return the live internship count without loading the whole catalog."""

    total_internships = db.query(Internship).count()

    return {
        "total_internships": total_internships,
        "source": "current Internship database records",
    }


# =========================================================
# BEST INTERNSHIP MATCH CONTEXT
# =========================================================

def _normalize_match_skill(skill: Any) -> str:
    """Normalize a skill using the same rules as the internship matcher."""

    if not isinstance(skill, str):
        return ""

    value = skill.strip().lower()

    replacements = {
        ".": "",
        "-": "",
        "_": "",
        " ": "",
        "/": "",
        "(": "",
        ")": "",
        "+": "plus",
    }

    for old, new in replacements.items():
        value = value.replace(old, new)

    return value


def get_best_internship_match_context(
    db: Session,
    user_id: int,
) -> Dict[str, Any]:
    """Return live internship matches calculated from the user's analyzed resume."""

    profile = (
        db.query(ResumeProfile)
        .join(Resume, Resume.id == ResumeProfile.resume_id)
        .filter(
            ResumeProfile.user_id == user_id,
            Resume.analysis_status == "completed",
        )
        .order_by(Resume.analyzed_at.desc())
        .first()
    )

    if not profile:
        return {
            "available": False,
            "message": "No analyzed resume profile is available yet.",
            "matches": [],
        }

    user_skills = []
    if isinstance(profile.skills, list):
        user_skills.extend(profile.skills)
    if isinstance(profile.technical_skills, list):
        user_skills.extend(profile.technical_skills)

    user_skill_map = {}
    for skill in user_skills:
        normalized = _normalize_match_skill(skill)
        if normalized:
            user_skill_map[normalized] = skill

    matches = []

    for internship in db.query(Internship).all():
        required = internship.required_skills
        if not isinstance(required, list):
            required = []

        valid_required = [
            skill for skill in required
            if _normalize_match_skill(skill)
        ]

        matched = []
        missing = []

        for required_skill in valid_required:
            normalized = _normalize_match_skill(required_skill)
            if normalized in user_skill_map:
                matched.append(required_skill)
            else:
                missing.append(required_skill)

        percentage = (
            round((len(matched) / len(valid_required)) * 100)
            if valid_required
            else 0
        )

        matches.append({
            "internship_id": internship.id,
            "company_name": safe_text(internship.company_name, 200),
            "title": safe_text(internship.title, 250),
            "location": safe_text(internship.location, 200),
            "duration": safe_text(internship.duration, 100),
            "work_mode": safe_text(internship.work_mode, 100),
            "stipend": safe_text(internship.stipend, 100),
            "match_percentage": percentage,
            "matched_skills": matched,
            "missing_skills": missing,
        })

    matches.sort(
        key=lambda item: (
            item["match_percentage"],
            len(item["matched_skills"]),
        ),
        reverse=True,
    )

    return {
        "available": bool(matches),
        "user_skills": list(user_skill_map.values()),
        "total_internships_checked": len(matches),
        "perfect_match_available": any(
            item["match_percentage"] == 100 for item in matches
        ),
        "matches": matches[:5],
    }


# =========================================================
# USER NEXT-STEP CONTEXT
# =========================================================

def get_user_next_step_context(
    db: Session,
    user_id: int,
) -> Dict[str, Any]:
    """Summarize the user's current state for state-aware guidance."""

    resume = (
        db.query(Resume)
        .filter(Resume.user_id == user_id)
        .order_by(Resume.uploaded_at.desc())
        .first()
    )

    if not resume:
        return {
            "current_stage": "resume_not_uploaded",
            "next_steps": [
                "Complete the profile if needed.",
                "Upload a resume.",
                "Wait for resume analysis to complete.",
                "Review the generated profile and skills.",
                "Browse internships and compare matches.",
            ],
        }

    profile = (
        db.query(ResumeProfile)
        .filter(
            ResumeProfile.user_id == user_id,
            ResumeProfile.resume_id == resume.id,
        )
        .first()
    )

    if not profile:
        return {
            "current_stage": "resume_uploaded_not_analyzed",
            "analysis_status": safe_text(
                resume.analysis_status,
                50,
            ),
            "next_steps": [
                "Complete or wait for resume analysis.",
                "Review the generated profile after analysis.",
                "Then browse internships and compare matches.",
            ],
        }

    pending_application = (
        db.query(Application)
        .filter(
            Application.user_id == user_id,
            Application.status == "pending",
        )
        .count()
    )

    saved_count = (
        db.query(SavedInternship)
        .filter(SavedInternship.user_id == user_id)
        .count()
    )

    application_count = (
        db.query(Application)
        .filter(Application.user_id == user_id)
        .count()
    )

    if pending_application > 0:
        next_steps = [
            "Track the pending application status.",
            "Review notifications for updates.",
            "Continue exploring suitable internships.",
        ]
        stage = "application_pending"
    elif application_count > 0:
        next_steps = [
            "Review your application statuses.",
            "Check notifications for updates.",
            "Continue exploring suitable internships.",
        ]
        stage = "applications_exist"
    elif saved_count > 0:
        next_steps = [
            "Review your saved internships.",
            "Compare their requirements with your skills.",
            "Create a cover letter and apply to suitable opportunities.",
        ]
        stage = "saved_internships_exist"
    else:
        next_steps = [
            "Browse matched internships.",
            "Review missing skills for suitable opportunities.",
            "Save internships you are interested in.",
            "Create a cover letter and apply.",
        ]
        stage = "ready_for_internship_discovery"

    return {
        "current_stage": stage,
        "resume_analyzed": True,
        "saved_internship_count": saved_count,
        "application_count": application_count,
        "pending_application_count": pending_application,
        "next_steps": next_steps,
    }


# =========================================================
# KEYWORD HELPERS
# =========================================================

def contains_any(
    text: str,
    keywords,
) -> bool:

    return any(
        keyword in text
        for keyword in keywords
    )


# =========================================================
# BUILD RELEVANT CONTEXT
# =========================================================

def build_relevant_context(
    db: Session,
    user_id: int,
    user_message: str,
    dashboard_type: str = "default",
    frontend_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:

    text = (
        user_message
        .lower()
        .strip()
    )

    context: Dict[str, Any] = {}

    # =====================================================
    # USER IS ALWAYS INCLUDED
    # =====================================================

    context["user"] = get_user_context(
        db=db,
        user_id=user_id,
    )

    normalized_dashboard_type = (
        dashboard_type or "default"
    ).strip().lower()

    current_user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    # =====================================================
    # APPLICATION CONTRACT + QUESTION SCOPE
    # =====================================================

    user_role = (
        str(current_user.role).lower()
        if current_user and current_user.role
        else ""
    )

    context["application_knowledge"] = (
        get_application_knowledge_context(
            dashboard_type=normalized_dashboard_type,
            user_role=user_role,
        )
    )

    context["question_scope"] = (
        validate_question_scope(
            user_message=user_message,
            dashboard_type=normalized_dashboard_type,
            user_role=user_role,
        )
    )

    # Frontend state is optional. When supplied by React, it is treated as
    # live page context and is never allowed to override authenticated DB data.
    live_frontend_context = get_frontend_context(frontend_context)
    if live_frontend_context:
        context["frontend_context"] = live_frontend_context

    # =====================================================
    # CURRENT DASHBOARD STATE
    # =====================================================

    context["dashboard"] = get_dashboard_context(
        db=db,
        user_id=user_id,
    )

    # A scope-invalid question is returned with the validation contract only.
    # The router/service can turn this into a safe user-facing error without
    # asking Groq to answer an unsupported question.
    if not context["question_scope"].get("valid", False):
        return context

    # =====================================================
    # DASHBOARD IS INCLUDED FOR DASHBOARD / WORKFLOW
    # QUESTIONS
    # =====================================================

    internship_count_keywords = [
        "how many internships",
        "how many internship",
        "total internships",
        "number of internships",
        "internships are available",
        "internships available",
        "internships are present",
        "internships page",
        "internship page",
        "available internships",
    ]

    if contains_any(text, internship_count_keywords):
        context["internship_catalog"] = (
            get_internship_catalog_context(db=db)
        )

    # =====================================================
    # DASHBOARD IS INCLUDED FOR DASHBOARD / WORKFLOW
    # =====================================================

    dashboard_keywords = [

        "dashboard",

        "home page",

        "homepage",

        "what can i do",

        "what can i see",

        "features",

        "feature",

        "internmatch",

        "how does internmatch work",

        "how do i use",

        "workflow",

        "steps",

        "process",

        "platform",

        "website",
    ]

    if contains_any(
        text,
        dashboard_keywords,
    ):

        context["dashboard"] = (
            get_dashboard_context(
                db=db,
                user_id=user_id,
            )
        )

        context["application"] = (
            get_general_application_context()
        )

    # =====================================================
    # RESUME QUESTIONS
    # =====================================================

    resume_keywords = [

        "resume",

        "skill",

        "skills",

        "education",

        "experience",

        "project",

        "projects",

        "certification",

        "certifications",

        "qualification",

        "profile",

        "programming",

        "technical skill",

        "soft skill",

        "degree",

        "college",

        "university",

        "internship experience",

    ]

    if contains_any(
        text,
        resume_keywords,
    ):

        context["resume"] = (
            get_resume_context(
                db=db,
                user_id=user_id,
            )
        )

    # =====================================================
    # SAVED INTERNSHIP QUESTIONS
    # =====================================================

    saved_keywords = [

        "saved internship",

        "saved internships",

        "saved",

        "bookmark",

        "bookmarked",

        "saved opportunity",

        "save internship",

    ]

    if contains_any(
        text,
        saved_keywords,
    ):

        context["saved_internships"] = (
            get_saved_internship_context(
                db=db,
                user_id=user_id,
            )
        )

    # =====================================================
    # APPLICATION QUESTIONS
    # =====================================================

    application_keywords = [

        "application",

        "applications",

        "applied",

        "apply",

        "status",

        "application status",

        "withdraw",

        "withdrawn",

        "submitted",

        "pending",

        "approved",

        "rejected",

        "interview",

        "offer",

    ]

    if contains_any(
        text,
        application_keywords,
    ):

        context["applications"] = (
            get_application_context(
                db=db,
                user_id=user_id,
            )
        )

    # =====================================================
    # NOTIFICATION QUESTIONS
    # =====================================================

    notification_keywords = [

        "notification",

        "notifications",

        "alert",

        "alerts",

        "message",

        "messages",

        "unread",

    ]

    if contains_any(
        text,
        notification_keywords,
    ):

        context["notifications"] = (
            get_notification_context(
                db=db,
                user_id=user_id,
            )
        )

    # =====================================================
    # PROFILE QUESTIONS
    # =====================================================

    profile_keywords = [

        "my profile",

        "profile information",

        "profile details",

        "my account",

        "my name",

        "my email",

        "my phone",

        "my location",

        "linkedin",

        "github",

    ]

    if contains_any(
        text,
        profile_keywords,
    ):

        context["user"] = get_user_context(
            db=db,
            user_id=user_id,
        )

    # =====================================================
    # COVER LETTER QUESTIONS
    # =====================================================

    cover_letter_keywords = [

        "cover letter",

        "coverletter",

        "application letter",

    ]

    if contains_any(
        text,
        cover_letter_keywords,
    ):

        context["application"] = (
            get_general_application_context()
        )

        context["cover_letter"] = {
            "available": True,

            "description": (
                "InternMatch includes cover letter "
                "support as part of the internship "
                "application workflow."
            ),
        }

    # =====================================================
    # SKILL GAP QUESTIONS
    # =====================================================

    skill_gap_keywords = [

        "skill gap",

        "skill gaps",

        "missing skill",

        "missing skills",

        "skills i need",

        "skills required",

        "what skills am i missing",

    ]

    if contains_any(
        text,
        skill_gap_keywords,
    ):

        context["resume"] = (
            get_resume_context(
                db=db,
                user_id=user_id,
            )
        )

        context["skill_gap"] = {
            "description": (
                "Skill gap analysis compares "
                "the user's available profile "
                "skills with internship requirements "
                "when the required application data "
                "is available."
            ),
        }

    # =====================================================
    # MATCHING QUESTIONS
    # =====================================================

    matching_keywords = [

        "match",

        "matching",

        "matched",

        "recommend",

        "recommendation",

        "recommendations",

        "best internship",

        "suitable internship",

        "internships for me",

        "which internship",

        "fit",

    ]

    if contains_any(
        text,
        matching_keywords,
    ):

        context["resume"] = (
            get_resume_context(
                db=db,
                user_id=user_id,
            )
        )

        context["matching"] = {
            "description": (
                "InternMatch can use the user's "
                "resume profile and internship "
                "requirements to determine relevance."
            ),
        }

        context["best_internship_matches"] = (
            get_best_internship_match_context(
                db=db,
                user_id=user_id,
            )
        )

    # =====================================================
    # GENERAL WORKFLOW QUESTIONS
    # =====================================================

    general_workflow_keywords = [

        "how does internmatch",

        "how internmatch",

        "how does the application work",

        "how does this application work",

        "how does the platform work",

        "how can i use internmatch",

        "what is internmatch",

        "explain internmatch",

        "steps in internmatch",

        "internmatch steps",

    ]

    if contains_any(
        text,
        general_workflow_keywords,
    ):

        context["dashboard"] = (
            get_dashboard_context(
                db=db,
                user_id=user_id,
            )
        )

        context["application"] = (
            get_general_application_context()
        )

    # =====================================================
    # NEXT-STEP / CURRENT-STATE QUESTIONS
    # =====================================================

    next_step_keywords = [
        "what should i do next",
        "what do i do next",
        "what can i do next",
        "next step",
        "next steps",
        "what should i do now",
        "what do i do now",
        "what should i do",
        "where do i go next",
    ]

    if contains_any(text, next_step_keywords):
        context["dashboard_state"] = (
            get_user_next_step_context(
                db=db,
                user_id=user_id,
            )
        )

    # =====================================================
    # IF NO DOMAIN-SPECIFIC CONTEXT MATCHED
    # =====================================================

    domain_context_keys = {
        "application",
        "internship_catalog",
        "resume",
        "saved_internships",
        "applications",
        "notifications",
        "matching",
        "best_internship_matches",
        "skill_gap",
        "cover_letter",
        "dashboard_state",
    }

    if not any(
        key in context
        for key in domain_context_keys
    ):
        context["application"] = (
            get_general_application_context()
        )

    return context


# =========================================================
# FORMAT CONTEXT FOR AI
# =========================================================

def format_context_for_ai(
    context: Dict[str, Any],
) -> str:

    sections = []

    # =====================================================
    # QUESTION SCOPE
    # =====================================================

    question_scope = context.get("question_scope")
    if question_scope:
        sections.append(
            "QUESTION SCOPE:\n"
            + _format_value(question_scope)
        )

    # =====================================================
    # APPLICATION KNOWLEDGE
    # =====================================================

    application_knowledge = context.get("application_knowledge")
    if application_knowledge:
        sections.append(
            "APPLICATION KNOWLEDGE:\n"
            + _format_value(application_knowledge)
        )

    # =====================================================
    # LIVE FRONTEND CONTEXT
    # =====================================================

    frontend = context.get("frontend_context")
    if frontend:
        sections.append(
            "LIVE FRONTEND CONTEXT:\n"
            + _format_value(frontend)
        )

    # =====================================================
    # USER
    # =====================================================

    user = context.get(
        "user"
    )

    if user:

        sections.append(
            "USER:\n"
            + _format_value(
                user
            )
        )

    # =====================================================
    # INTERNSHIP CATALOG
    # =====================================================

    internship_catalog = context.get(
        "internship_catalog"
    )

    if internship_catalog:
        sections.append(
            "INTERNSHIP CATALOG:\n"
            + _format_value(internship_catalog)
        )

    # =====================================================
    # DASHBOARD STATE
    # =====================================================

    dashboard_state = context.get(
        "dashboard_state"
    )

    if dashboard_state:
        sections.append(
            "CURRENT USER STATE:\n"
            + _format_value(dashboard_state)
        )

    # =====================================================
    # DASHBOARD
    # =====================================================

    dashboard = context.get(
        "dashboard"
    )

    if dashboard:

        sections.append(
            "DASHBOARD:\n"
            + _format_value(
                dashboard
            )
        )

    # =====================================================
    # APPLICATION WORKFLOW
    # =====================================================

    application = context.get(
        "application"
    )

    if application:

        sections.append(
            "INTERNMATCH:\n"
            + _format_value(
                application
            )
        )

    # =====================================================
    # RESUME
    # =====================================================

    resume = context.get(
        "resume"
    )

    if resume:

        sections.append(
            "RESUME:\n"
            + _format_value(
                resume
            )
        )

    # =====================================================
    # SAVED INTERNSHIPS
    # =====================================================

    saved = context.get(
        "saved_internships"
    )

    if saved:

        sections.append(
            "SAVED INTERNSHIPS:\n"
            + _format_value(
                saved
            )
        )

    # =====================================================
    # APPLICATIONS
    # =====================================================

    applications = context.get(
        "applications"
    )

    if applications:

        sections.append(
            "USER APPLICATIONS:\n"
            + _format_value(
                applications
            )
        )

    # =====================================================
    # NOTIFICATIONS
    # =====================================================

    notifications = context.get(
        "notifications"
    )

    if notifications:

        sections.append(
            "NOTIFICATIONS:\n"
            + _format_value(
                notifications
            )
        )

    # =====================================================
    # MATCHING
    # =====================================================

    matching = context.get(
        "matching"
    )

    if matching:

        sections.append(
            "MATCHING:\n"
            + _format_value(
                matching
            )
        )

    # =====================================================
    # BEST INTERNSHIP MATCHES
    # =====================================================

    best_matches = context.get(
        "best_internship_matches"
    )

    if best_matches:
        sections.append(
            "BEST INTERNSHIP MATCHES:\n"
            + _format_value(
                best_matches
            )
        )

    # =====================================================
    # SKILL GAP
    # =====================================================

    skill_gap = context.get(
        "skill_gap"
    )

    if skill_gap:

        sections.append(
            "SKILL GAP:\n"
            + _format_value(
                skill_gap
            )
        )

    # =====================================================
    # COVER LETTER
    # =====================================================

    cover_letter = context.get(
        "cover_letter"
    )

    if cover_letter:

        sections.append(
            "COVER LETTER:\n"
            + _format_value(
                cover_letter
            )
        )

    # =====================================================
    # COMBINE
    # =====================================================

    result = "\n\n".join(
        sections
    )

    # =====================================================
    # HARD LIMIT
    # =====================================================

    if len(result) <= MAX_CONTEXT_LENGTH:

        return result

    return (
        result[:MAX_CONTEXT_LENGTH]
        .rstrip()
        + "\n..."
    )


# =========================================================
# FORMAT VALUE
# =========================================================

def _format_value(
    value: Any,
    level: int = 0,
) -> str:

    if level > 3:

        return safe_text(
            value,
            500,
        )

    # =====================================================
    # DICTIONARY
    # =====================================================

    if isinstance(
        value,
        dict,
    ):

        lines = []

        for key, item in value.items():

            key_text = (
                str(key)
                .replace(
                    "_",
                    " ",
                )
                .capitalize()
            )

            if isinstance(
                item,
                (
                    dict,
                    list,
                    tuple,
                ),
            ):

                nested = _format_value(
                    item,
                    level + 1,
                )

                if nested:

                    lines.append(
                        f"{key_text}:\n"
                        + nested
                    )

            else:

                item_text = safe_text(
                    item,
                    600,
                )

                if item_text:

                    lines.append(
                        f"{key_text}: "
                        f"{item_text}"
                    )

        return "\n".join(
            lines
        )

    # =====================================================
    # LIST / TUPLE
    # =====================================================

    if isinstance(
        value,
        (
            list,
            tuple,
        ),
    ):

        lines = []

        for item in value[
            :MAX_LIST_ITEMS
        ]:

            if isinstance(
                item,
                (
                    dict,
                    list,
                    tuple,
                ),
            ):

                nested = _format_value(
                    item,
                    level + 1,
                )

                if nested:

                    lines.append(
                        "- "
                        + nested.replace(
                            "\n",
                            "\n  ",
                        )
                    )

            else:

                item_text = safe_text(
                    item,
                    500,
                )

                if item_text:

                    lines.append(
                        "- "
                        + item_text
                    )

        return "\n".join(
            lines
        )

    # =====================================================
    # SIMPLE VALUE
    # =====================================================

    return safe_text(
        value,
        600,
    )
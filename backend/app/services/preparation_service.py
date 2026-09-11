from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json
import re
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models import (
    AIChatHistory,
    User,
    ResumeProfile,
    Internship,
)
from app.services.ai_service import generate_ai_response, generate_fast_ai_response


# =========================================================
# ROLE CONFIGURATION
# =========================================================

ROLE_REQUIREMENTS = {
    "Frontend Developer": [
        "html",
        "css",
        "javascript",
        "react",
        "typescript",
        "bootstrap",
        "tailwind",
        "vite",
    ],
    "Backend Developer": [
        "python",
        "java",
        "fastapi",
        "django",
        "sql",
        "postgresql",
        "mysql",
        "rest api",
    ],
    "Full Stack Developer": [
        "html",
        "css",
        "javascript",
        "react",
        "python",
        "fastapi",
        "django",
        "postgresql",
        "sql",
    ],
    "AI Engineer": [
        "python",
        "machine learning",
        "artificial intelligence",
        "llm",
        "groq",
        "openai",
        "fastapi",
        "postgresql",
    ],
    "Software Engineering Intern": [
        "python",
        "java",
        "javascript",
        "sql",
        "git",
        "github",
        "data structures",
        "algorithms",
    ],
}


# Canonical preparation topics for each role. These are the topics the
# interview-preparation engine can rotate through even when a topic is not
# explicitly present in the resume. Resume skills and weak topics are still
# added separately, so personalization is preserved without restricting the
# candidate to only the skills detected in the resume.
ROLE_PRACTICE_TOPICS = {
    "Frontend Developer": [
        "HTML",
        "CSS",
        "JavaScript",
        "React",
        "TypeScript",
        "Bootstrap",
        "Tailwind CSS",
        "Vite",
        "DOM",
        "Responsive Web Design",
        "Web Accessibility",
        "Git",
    ],
    "Backend Developer": [
        "Python",
        "Java",
        "FastAPI",
        "Django",
        "SQL",
        "PostgreSQL",
        "MySQL",
        "REST APIs",
        "Database Design",
        "Authentication",
        "Git",
    ],
    "Full Stack Developer": [
        "HTML",
        "CSS",
        "JavaScript",
        "React",
        "TypeScript",
        "Python",
        "FastAPI",
        "Django",
        "SQL",
        "PostgreSQL",
        "REST APIs",
        "Git",
    ],
    "AI Engineer": [
        "Python",
        "Machine Learning",
        "Artificial Intelligence",
        "LLMs",
        "Prompt Engineering",
        "Generative AI",
        "FastAPI",
        "PostgreSQL",
        "Data Processing",
        "Git",
    ],
    "Software Engineering Intern": [
        "Data Structures",
        "Algorithms",
        "JavaScript",
        "Python",
        "Java",
        "SQL",
        "Object-Oriented Programming",
        "DBMS",
        "Operating Systems",
        "Computer Networks",
        "Git",
    ],
}


# =========================================================
# PRACTICE STATE
#
# These are normal Python objects, NOT database models.
# The frontend owns the active practice state.
# AIChatHistory is used for durable question/answer/evaluation
# history.
# =========================================================

@dataclass
class PreparationSessionState:
    id: str
    user_id: int
    category: str
    target_role: str
    difficulty: str
    session_type: str
    status: str = "active"
    score: Optional[float] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


@dataclass
class PreparationQuestionState:
    id: str
    session_id: str
    user_id: int
    question: str
    category: str
    topic: str
    difficulty: str
    source: str = "ai"
    created_at: Optional[datetime] = None


@dataclass
class PreparationAnswerState:
    id: str
    question_id: str
    user_id: int
    answer: str
    feedback: str
    score: Optional[float] = None
    created_at: Optional[datetime] = None


# =========================================================
# CONSTANTS
# =========================================================

PRACTICE_SESSION_PREFIX = "preparation_practice_"
QUESTION_MARKER = "[PREPARATION_QUESTION]"
ANSWER_MARKER = "[PREPARATION_ANSWER]"
SESSION_MARKER = "[PREPARATION_SESSION]"
MOCK_INTERVIEW_MARKER = "[PREPARATION_MOCK_INTERVIEW]"
MOCK_QUESTION_MARKER = "[PREPARATION_MOCK_QUESTION]"
MOCK_ANSWER_MARKER = "[PREPARATION_MOCK_ANSWER]"

MAX_CONTEXT_ITEMS = 5


# =========================================================
# GENERIC HELPERS
# =========================================================

def normalize_list(value: Any) -> List[str]:
    if value is None:
        return []

    if isinstance(value, (list, tuple)):
        return [
            str(item).strip()
            for item in value
            if str(item).strip()
        ]

    if isinstance(value, str):
        items = [value]

        for separator in (",", ";", "|"):
            temp: List[str] = []
            for item in items:
                temp.extend(item.split(separator))
            items = temp

        return [
            item.strip()
            for item in items
            if item.strip()
        ]

    return []


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def unique_strings(items: List[str]) -> List[str]:
    result: List[str] = []
    seen = set()

    for item in items:
        value = normalize_text(item)
        key = value.lower()

        if not key or key in seen:
            continue

        seen.add(key)
        result.append(value)

    return result


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _generate_interview_ai(prompt: str) -> str:
    """
    Call the shared AI service with only the prompt.

    Mock-interview prompts already contain the complete resume/application
    context. Keeping the call to the single required argument makes this
    flow compatible with both the current AI service and older deployments
    that used different context parameter shapes.
    """
    clean_prompt = normalize_text(prompt)

    if not clean_prompt:
        return ""

    try:
        response = generate_ai_response(
            user_message=clean_prompt,
            previous_messages=None,
        )
    except TypeError:
        # Compatibility fallback for an older two-positional-argument
        # implementation.
        try:
            response = generate_ai_response(
                clean_prompt,
                None,
            )
        except Exception:
            return ""
    except Exception:
        return ""

    return normalize_text(response)


def new_session_id() -> str:
    return f"{PRACTICE_SESSION_PREFIX}{uuid4().hex}"


def new_question_id() -> str:
    return f"question_{uuid4().hex}"


def new_answer_id() -> str:
    return f"answer_{uuid4().hex}"


def _safe_datetime(value: Any) -> Optional[datetime]:
    return value if isinstance(value, datetime) else None


# =========================================================
# PHASE 4 - STEP 1: CANDIDATE PROFILE INTELLIGENCE
# =========================================================

def _extract_experience_years(candidate: Dict[str, Any]) -> float:
    """Estimate professional experience from resume-derived work history."""
    experience = candidate.get("work_experience") or []
    if not isinstance(experience, (list, tuple)):
        experience = [experience]

    explicit_years = 0.0
    explicit_months = 0
    found_duration = False

    for item in experience:
        text = normalize_text(item)
        if not text:
            continue

        combined = re.search(
            r"(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years?|yrs?)"
            r"\s*(?:and|&)\s*(\d+)\s*(?:months?|mos?)",
            text,
            flags=re.IGNORECASE,
        )
        if combined:
            explicit_years += float(combined.group(1))
            explicit_months += int(combined.group(2))
            found_duration = True
            continue

        years = re.search(
            r"(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years?|yrs?)",
            text,
            flags=re.IGNORECASE,
        )
        if years:
            explicit_years += float(years.group(1))
            found_duration = True
            continue

        months = re.search(
            r"(\d+)\s*(?:months?|mos?)",
            text,
            flags=re.IGNORECASE,
        )
        if months:
            explicit_months += int(months.group(1))
            found_duration = True

    if found_duration:
        return round(explicit_years + explicit_months / 12.0, 1)

    # Conservative fallback for date ranges such as 2023-2025.
    total_months = 0
    date_pattern = re.compile(
        r"\b(20\d{2})\s*(?:-|–|to)\s*(20\d{2}|present|current)\b",
        flags=re.IGNORECASE,
    )

    for item in experience:
        text = normalize_text(item)
        for match in date_pattern.finditer(text):
            start_year = int(match.group(1))
            end_value = match.group(2).lower()
            end_year = datetime.now().year if end_value in {"present", "current"} else int(end_value)
            if end_year >= start_year:
                total_months += (end_year - start_year) * 12

    return round(total_months / 12.0, 1)


def _infer_experience_level(candidate: Dict[str, Any]) -> str:
    """
    Classify a candidate for interview preparation.

    fresher -> no professional experience / recent graduate
    entry_level -> projects/internships or limited work evidence
    intermediate -> at least one year of professional experience
    experienced -> three or more years of professional experience
    """
    years = _extract_experience_years(candidate)
    work_experience = candidate.get("work_experience") or []
    internships = candidate.get("internships") or []
    education = candidate.get("education") or []

    work_count = len(work_experience) if isinstance(work_experience, (list, tuple)) else 0
    internship_count = len(internships) if isinstance(internships, (list, tuple)) else 0

    education_text = " ".join(
        normalize_text(item)
        for item in education
        if normalize_text(item)
    )

    current_year = datetime.now().year
    recent_graduation = bool(
        re.search(rf"\b{current_year}\b", education_text)
    )

    if years >= 3:
        return "experienced"
    if years >= 1:
        return "intermediate"
    if work_count == 0 and recent_graduation:
        return "fresher"
    if work_count == 0 and internship_count > 0:
        return "entry_level"
    if work_count == 0:
        return "fresher"
    return "entry_level"


def _profile_completeness(candidate: Dict[str, Any]) -> int:
    """Calculate how complete the resume-derived candidate profile is."""
    profile = candidate.get("profile") or {}

    checks = [
        bool(normalize_text(profile.get("full_name"))),
        bool(normalize_text(profile.get("professional_summary"))),
        bool(candidate.get("skills")),
        bool(candidate.get("technical_skills")),
        bool(candidate.get("education")),
        bool(candidate.get("projects")),
        bool(candidate.get("work_experience") or candidate.get("internships")),
        bool(candidate.get("certifications")),
    ]

    return round((sum(checks) / len(checks)) * 100) if checks else 0


def build_preparation_profile(
    candidate: Dict[str, Any],
    role_recommendations: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Build the canonical personalized profile used by Phase 4.

    The profile is derived only from the existing User/ResumeProfile data
    and role-matching results. It creates no new database records.
    """
    roles = role_recommendations or []
    top_role = roles[0] if roles else {}

    profile = candidate.get("profile") or {}
    user = candidate.get("user") or {}

    skills = unique_strings(normalize_list(candidate.get("skills")))
    technical_skills = unique_strings(
        normalize_list(candidate.get("technical_skills"))
    )
    soft_skills = unique_strings(
        normalize_list(candidate.get("soft_skills"))
    )

    matched_skills = unique_strings(
        [
            str(skill)
            for role in roles[:3]
            for skill in (role.get("matched_skills") or [])
        ]
    )

    missing_skills = unique_strings(
        [
            str(skill)
            for role in roles[:3]
            for skill in (role.get("missing_skills") or [])
        ]
    )

    projects = candidate.get("projects") or []
    work_experience = candidate.get("work_experience") or []
    internships = candidate.get("internships") or []
    education = candidate.get("education") or []
    certifications = candidate.get("certifications") or []

    target_role = (
        normalize_text(top_role.get("role"))
        or normalize_text(user.get("role"))
        or "Software Engineering Intern"
    )

    focus_topics = unique_strings(
        matched_skills[:8]
        + missing_skills[:8]
        + technical_skills[:8]
    )[:12]

    role_names = unique_strings(
        [target_role]
        + [
            normalize_text(role.get("role"))
            for role in roles[:3]
            if isinstance(role, dict)
        ]
    )

    role_topic_catalog: List[str] = []
    for role_name in role_names:
        role_topic_catalog.extend(
            ROLE_PRACTICE_TOPICS.get(role_name, [])
        )

    if not role_topic_catalog:
        role_topic_catalog = ROLE_PRACTICE_TOPICS[
            "Software Engineering Intern"
        ]

    practice_topics = unique_strings(
        role_topic_catalog
        + focus_topics
        + technical_skills
        + matched_skills
        + missing_skills
    )[:36]

    return {
        "full_name": (
            normalize_text(profile.get("full_name"))
            or normalize_text(user.get("full_name"))
        ),
        "target_role": target_role,
        "role_match_percentage": int(top_role.get("match_percentage") or 0),
        "experience_level": _infer_experience_level(candidate),
        "estimated_experience_years": _extract_experience_years(candidate),
        "profile_completeness": _profile_completeness(candidate),
        "skills": skills[:20],
        "technical_skills": technical_skills[:20],
        "soft_skills": soft_skills[:12],
        "matched_skills": matched_skills[:15],
        "missing_skills": missing_skills[:15],
        "focus_topics": focus_topics,
        "practice_topics": practice_topics,
        "project_count": len(projects) if isinstance(projects, (list, tuple)) else 0,
        "work_experience_count": (
            len(work_experience)
            if isinstance(work_experience, (list, tuple))
            else 0
        ),
        "internship_count": (
            len(internships)
            if isinstance(internships, (list, tuple))
            else 0
        ),
        "education_count": (
            len(education)
            if isinstance(education, (list, tuple))
            else 0
        ),
        "certification_count": (
            len(certifications)
            if isinstance(certifications, (list, tuple))
            else 0
        ),
    }


# =========================================================
# GET RESUME PROFILE
# =========================================================

def get_resume_profile(
    db: Session,
    user_id: int,
) -> Optional[ResumeProfile]:
    return (
        db.query(ResumeProfile)
        .filter(ResumeProfile.user_id == user_id)
        .order_by(ResumeProfile.updated_at.desc())
        .first()
    )


# =========================================================
# BUILD CANDIDATE PROFILE
# =========================================================

def build_candidate_profile(
    db: Session,
    user_id: int,
) -> Dict[str, Any]:
    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    profile = get_resume_profile(
        db=db,
        user_id=user_id,
    )

    empty_profile = {
        "user": None,
        "profile": None,
        "skills": [],
        "technical_skills": [],
        "soft_skills": [],
        "education": [],
        "work_experience": [],
        "projects": [],
        "certifications": [],
        "internships": [],
        "languages": [],
        "achievements": [],
    }

    if not user:
        return empty_profile

    if not profile:
        empty_profile["user"] = {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
        }
        return empty_profile

    skills = unique_strings(
        normalize_list(profile.skills)
        + normalize_list(profile.technical_skills)
    )

    return {
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
        },
        "profile": {
            "full_name": profile.full_name,
            "email": profile.email,
            "phone": profile.phone,
            "professional_summary": profile.professional_summary,
        },
        "skills": skills,
        "technical_skills": unique_strings(
            normalize_list(profile.technical_skills)
        ),
        "soft_skills": unique_strings(
            normalize_list(profile.soft_skills)
        ),
        "education": profile.education or [],
        "work_experience": profile.work_experience or [],
        "projects": profile.projects or [],
        "certifications": profile.certifications or [],
        "internships": profile.internships or [],
        "languages": profile.languages or [],
        "achievements": profile.achievements or [],
    }


# =========================================================
# ROLE RECOMMENDATION
# =========================================================

def _contains_requirement(text: str, requirement: str) -> bool:
    """Match a requirement as a phrase/token without false positives."""
    normalized_text = re.sub(r"[^a-z0-9+#.]+", " ", normalize_text(text).lower())
    normalized_requirement = re.sub(
        r"[^a-z0-9+#.]+",
        " ",
        normalize_text(requirement).lower(),
    ).strip()

    if not normalized_text or not normalized_requirement:
        return False

    pattern = rf"(?<![a-z0-9+#]){re.escape(normalized_requirement)}(?![a-z0-9+#])"
    return bool(re.search(pattern, normalized_text))


def _candidate_role_evidence(
    candidate: Dict[str, Any],
) -> str:
    """Build searchable evidence from resume-derived fields only."""
    parts: List[str] = []

    profile = candidate.get("profile") or {}
    summary = normalize_text(profile.get("professional_summary"))
    if summary:
        parts.append(summary)

    for field_name in (
        "projects",
        "work_experience",
        "internships",
        "certifications",
    ):
        values = candidate.get(field_name) or []
        if isinstance(values, list):
            parts.extend(str(item) for item in values if item)

    return " ".join(parts)


def recommend_roles(
    db: Session,
    user_id: int,
) -> List[Dict[str, Any]]:
    candidate = build_candidate_profile(
        db=db,
        user_id=user_id,
    )

    candidate_skills = unique_strings(
        candidate.get("skills") or []
    )
    skill_text = " ".join(candidate_skills)
    evidence_text = _candidate_role_evidence(candidate)

    project_count = (
        len(candidate["projects"])
        if isinstance(candidate["projects"], list)
        else 0
    )

    experience_count = (
        len(candidate["work_experience"])
        if isinstance(candidate["work_experience"], list)
        else 0
    )

    internship_count = (
        len(candidate["internships"])
        if isinstance(candidate["internships"], list)
        else 0
    )

    recommendations: List[Dict[str, Any]] = []

    for role, required_skills in ROLE_REQUIREMENTS.items():
        matched: List[str] = []
        missing: List[str] = []
        skill_matches = 0
        contextual_matches = 0

        for requirement in required_skills:
            skill_match = any(
                _contains_requirement(skill, requirement)
                for skill in candidate_skills
            )

            context_match = _contains_requirement(
                evidence_text,
                requirement,
            )

            if skill_match:
                matched.append(requirement)
                skill_matches += 1
            elif context_match:
                matched.append(requirement)
                contextual_matches += 1
            else:
                missing.append(requirement)

        total_requirements = len(required_skills)

        if total_requirements:
            # Resume skills are the strongest signal. Mentions in
            # projects/experience provide additional evidence.
            base_score = (
                (skill_matches / total_requirements) * 80
                + (contextual_matches / total_requirements) * 15
            )
        else:
            base_score = 0

        practical_bonus = 0
        if project_count > 0 and skill_matches > 0:
            practical_bonus += 3
        if experience_count > 0 and skill_matches > 0:
            practical_bonus += 2
        elif internship_count > 0 and skill_matches > 0:
            practical_bonus += 2

        score = min(
            100,
            round(base_score + practical_bonus),
        )

        reasons: List[str] = []

        if skill_matches:
            reasons.append(
                f"{skill_matches} required skill"
                f"{'' if skill_matches == 1 else 's'} "
                "matched directly in the resume."
            )

        if contextual_matches:
            reasons.append(
                f"{contextual_matches} additional requirement"
                f"{'' if contextual_matches == 1 else 's'} "
                "found in project or experience details."
            )

        if project_count > 0 and skill_matches > 0:
            reasons.append("Your projects provide practical evidence.")

        if experience_count > 0 and skill_matches > 0:
            reasons.append("Your work experience supports the role.")
        elif internship_count > 0 and skill_matches > 0:
            reasons.append("Your internship experience supports the role.")

        if not reasons:
            reasons.append(
                "The current resume has limited evidence for this role."
            )

        recommendations.append(
            {
                "role": role,
                "match_percentage": score,
                "matched_skills": matched,
                "missing_skills": missing,
                "match_reason": " ".join(reasons),
                "reason": " ".join(reasons),
                "match_breakdown": {
                    "direct_skill_matches": skill_matches,
                    "contextual_matches": contextual_matches,
                    "required_skills": total_requirements,
                },
            }
        )

    recommendations.sort(
        key=lambda item: (
            item["match_percentage"],
            len(item["matched_skills"]),
            -len(item["missing_skills"]),
        ),
        reverse=True,
    )

    return recommendations



# =========================================================
# RESUME PERSONALIZATION
# =========================================================

def build_resume_personalization(
    candidate: Dict[str, Any],
    role_recommendations: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Build a read-only personalized preparation profile from the
    existing ResumeProfile data.

    This does NOT create or update a database table. It only derives
    preparation guidance from information already present in the
    candidate resume profile.
    """
    skills = unique_strings(
        normalize_list(candidate.get("skills"))
    )
    technical_skills = unique_strings(
        normalize_list(candidate.get("technical_skills"))
    )
    soft_skills = unique_strings(
        normalize_list(candidate.get("soft_skills"))
    )
    projects = candidate.get("projects") or []
    experience = candidate.get("work_experience") or []
    certifications = candidate.get("certifications") or []

    roles = role_recommendations or []
    top_role = roles[0] if roles else None

    matched = unique_strings(
        [
            str(item)
            for role in roles[:3]
            for item in (role.get("matched_skills") or [])
        ]
    )
    missing = unique_strings(
        [
            str(item)
            for role in roles[:3]
            for item in (role.get("missing_skills") or [])
        ]
    )

    strengths: List[str] = []
    improvement_areas: List[str] = []

    if technical_skills:
        strengths.append(
            f"Technical foundation: {', '.join(technical_skills[:6])}"
        )

    if projects:
        strengths.append(
            f"Practical project experience: {len(projects)} project"
            f"{'' if len(projects) == 1 else 's'}"
        )

    if experience:
        strengths.append(
            f"Work experience: {len(experience)} record"
            f"{'' if len(experience) == 1 else 's'}"
        )

    if certifications:
        strengths.append(
            f"Certifications: {len(certifications)} available"
        )

    if soft_skills:
        strengths.append(
            f"Communication/soft skills: {', '.join(soft_skills[:5])}"
        )

    if missing:
        improvement_areas.append(
            f"Priority technical gaps: {', '.join(missing[:8])}"
        )

    if not projects:
        improvement_areas.append(
            "Add or strengthen practical projects that demonstrate your target role."
        )

    if not experience:
        improvement_areas.append(
            "Build practical experience through projects, internships, or open-source work."
        )

    if not soft_skills:
        improvement_areas.append(
            "Prepare concise examples for communication, teamwork, and problem-solving."
        )

    if not technical_skills:
        improvement_areas.append(
            "Complete resume analysis or add technical skills before starting technical preparation."
        )

    focus_topics = unique_strings(
        matched[:6] + missing[:6]
    )

    if not focus_topics:
        focus_topics = technical_skills[:6]

    return {
        "personalized_for_role": (
            top_role.get("role")
            if top_role
            else "Not enough resume data"
        ),
        "top_role_match_percentage": (
            top_role.get("match_percentage")
            if top_role
            else 0
        ),
        "strengths": strengths[:6],
        "improvement_areas": improvement_areas[:6],
        "focus_topics": focus_topics[:10],
        "matched_skills": matched[:12],
        "missing_skills": missing[:12],
        "project_count": len(projects) if isinstance(projects, list) else 0,
        "experience_count": (
            len(experience) if isinstance(experience, list) else 0
        ),
        "certification_count": (
            len(certifications) if isinstance(certifications, list) else 0
        ),
        "experience_level": _infer_experience_level(candidate),
        "estimated_experience_years": _extract_experience_years(candidate),
        "profile_completeness": _profile_completeness(candidate),
    }


# =========================================================
# PERSONALIZED ROADMAP & WEAK TOPICS
# =========================================================

def build_preparation_roadmap(
    db: Session,
    user_id: int,
    candidate: Optional[Dict[str, Any]] = None,
    role_recommendations: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Derive weak topics and a practical preparation roadmap from existing
    resume data, role gaps, and persisted answer evaluations.

    This is read-only derived guidance. It does NOT create preparation
    database tables or additional database records.
    """
    candidate = candidate or build_candidate_profile(
        db=db,
        user_id=user_id,
    )
    roles = role_recommendations or recommend_roles(
        db=db,
        user_id=user_id,
    )[:3]

    personalization = build_resume_personalization(
        candidate=candidate,
        role_recommendations=roles,
    )

    # Resume/role gaps are the primary source of technical weak topics.
    missing_skills = unique_strings(
        personalization.get("missing_skills") or []
    )

    # Use only requirements belonging to the best-fit role when possible.
    top_role = roles[0] if roles else {}
    top_role_name = normalize_text(top_role.get("role"))
    top_role_missing = unique_strings(
        top_role.get("missing_skills") or []
    )

    if top_role_name in ROLE_REQUIREMENTS:
        role_gap_topics = [
            requirement
            for requirement in ROLE_REQUIREMENTS[top_role_name]
            if any(
                _contains_requirement(item, requirement)
                for item in top_role_missing
            )
        ]
    else:
        role_gap_topics = top_role_missing[:]

    # Recover question topics and scores from AIChatHistory.
    question_records = _question_records(
        db=db,
        user_id=user_id,
    )
    answer_records = _answer_records(
        db=db,
        user_id=user_id,
    )

    question_topics: Dict[str, str] = {}
    question_categories: Dict[str, str] = {}

    for record in question_records:
        raw = record.user_message or ""
        question_id = _extract_question_id(raw)
        if not question_id:
            continue

        metadata = _parse_question_metadata(
            record.ai_response or ""
        )
        question_category = (
            normalize_text(metadata.get("category"))
            or "General"
        )
        stored_topic = normalize_text(metadata.get("topic"))
        generic_topics = {
            "",
            "general",
            "mixed",
            "technical",
            "hr",
            "resume",
            "interview",
            "general interview",
        }
        question_topics[question_id] = (
            _derive_specific_topic(
                _extract_question_text(record),
                question_category,
            )
            if stored_topic.lower() in generic_topics
            else stored_topic
        )
        question_categories[question_id] = question_category

    topic_scores: Dict[str, List[float]] = {}
    topic_attempts: Dict[str, int] = {}

    for record in answer_records:
        raw = record.user_message or ""
        question_id = _extract_question_id(raw)
        topic = (
            question_topics.get(question_id, "General")
            if question_id
            else "General"
        )
        topic = normalize_text(topic) or "General"

        topic_attempts[topic] = topic_attempts.get(topic, 0) + 1

        score = _extract_score(record.ai_response or "")
        if score is not None:
            topic_scores.setdefault(topic, []).append(score)

    performance_topics: List[Dict[str, Any]] = []

    for topic, scores_for_topic in topic_scores.items():
        if not scores_for_topic:
            continue

        average = round(
            sum(scores_for_topic) / len(scores_for_topic),
            2,
        )

        if average < 7:
            if average < 5:
                priority = "high"
                reason = (
                    f"Average answer score is {average}/10 "
                    "across previous attempts."
                )
            else:
                priority = "medium"
                reason = (
                    f"Average answer score is {average}/10; "
                    "more practice is recommended."
                )

            performance_topics.append(
                {
                    "topic": topic,
                    "priority": priority,
                    "reason": reason,
                    "source": "answer_evaluations",
                    "average_score": average,
                    "attempts": topic_attempts.get(topic, 0),
                    "category": question_categories.get(
                        next(
                            (
                                question_id
                                for question_id, question_topic
                                in question_topics.items()
                                if question_topic.lower() == topic.lower()
                            ),
                            "",
                        ),
                        "General",
                    ),
                }
            )

    # Avoid duplicate weak topics while combining performance and role gaps.
    weak_topics: List[Dict[str, Any]] = []
    seen_topics = set()

    for item in sorted(
        performance_topics,
        key=lambda value: (
            0 if value["priority"] == "high" else 1,
            value.get("average_score", 10),
        ),
    ):
        key = normalize_text(item["topic"]).lower()
        if not key or key in seen_topics:
            continue
        seen_topics.add(key)
        weak_topics.append(item)

    for topic in unique_strings(role_gap_topics + missing_skills):
        key = topic.lower()
        if key in seen_topics:
            continue

        weak_topics.append(
            {
                "topic": topic,
                "priority": "high" if topic in role_gap_topics else "medium",
                "reason": (
                    "Required by the best-fit role but not clearly "
                    "demonstrated in the resume."
                ),
                "source": "role_requirements",
                "average_score": None,
                "attempts": 0,
                "category": "Technical",
            }
        )
        seen_topics.add(key)

    # If there are no measured weaknesses or role gaps, guide the candidate
    # toward the strongest resume-backed focus topics.
    if not weak_topics:
        fallback_topics = unique_strings(
            personalization.get("focus_topics") or []
        )[:5]

        for topic in fallback_topics:
            weak_topics.append(
                {
                    "topic": topic,
                    "priority": "medium",
                    "reason": (
                        "Recommended focus area based on the "
                        "candidate's resume and role match."
                    ),
                    "source": "resume_personalization",
                    "average_score": None,
                    "attempts": 0,
                    "category": "Technical",
                }
            )

    weak_topics = weak_topics[:10]

    roadmap: List[Dict[str, Any]] = []

    for index, item in enumerate(weak_topics[:6], start=1):
        topic = item["topic"]
        priority = item["priority"]

        if priority == "high":
            goal = (
                f"Build a reliable interview-ready foundation in {topic}."
            )
            action = (
                f"Learn the core concepts of {topic}, then complete "
                "2-3 practical questions and one applied example."
            )
        else:
            goal = (
                f"Strengthen interview confidence in {topic}."
            )
            action = (
                f"Review the key concepts of {topic} and practice "
                "at least 2 role-relevant interview questions."
            )

        if item.get("average_score") is not None:
            action += (
                f" Previous average: "
                f"{item['average_score']}/10."
            )

        roadmap.append(
            {
                "step": index,
                "topic": topic,
                "priority": priority,
                "goal": goal,
                "action": action,
                "source": item.get("source", "derived"),
                "average_score": item.get("average_score"),
                "attempts": item.get("attempts", 0),
            }
        )

    return {
        "best_fit_role": top_role_name or "Software Engineering Intern",
        "weak_topics": weak_topics,
        "roadmap": roadmap,
        "measured_topics": len(topic_scores),
        "evaluated_topics": len(performance_topics),
        "adaptive_strategy": {
            "low_score_threshold": 5.0,
            "high_score_threshold": 7.5,
            "max_level_change_per_question": 1,
        },
    }


# =========================================================
# PROGRESS TRACKING
# =========================================================

def build_preparation_progress(
    db: Session,
    user_id: int,
) -> Dict[str, Any]:
    """
    Build progress metrics from persisted AIChatHistory practice records.

    This is derived data only. No additional preparation tables are used.
    """
    records = (
        db.query(AIChatHistory)
        .filter(AIChatHistory.user_id == user_id)
        .filter(
            AIChatHistory.session_id.like(
                f"{PRACTICE_SESSION_PREFIX}%"
            )
        )
        .order_by(
            AIChatHistory.created_at.asc(),
            AIChatHistory.id.asc(),
        )
        .all()
    )

    question_records = [
        record
        for record in records
        if (record.user_message or "").startswith(QUESTION_MARKER)
    ]
    answer_records = [
        record
        for record in records
        if (record.user_message or "").startswith(ANSWER_MARKER)
    ]

    question_metadata: Dict[str, Dict[str, str]] = {}
    for record in question_records:
        question_id = _extract_question_id(record.user_message or "")
        if not question_id:
            continue
        question_metadata[question_id] = _parse_question_metadata(
            record.ai_response or ""
        )

    scores: List[float] = []
    score_history: List[Dict[str, Any]] = []
    topic_stats: Dict[str, Dict[str, Any]] = {}
    category_stats: Dict[str, Dict[str, Any]] = {}

    for record in answer_records:
        raw = record.user_message or ""
        question_id = _extract_question_id(raw)
        metadata = question_metadata.get(question_id or "", {})
        category = normalize_text(metadata.get("category")) or "General"
        stored_topic = normalize_text(metadata.get("topic"))
        generic_topics = {
            "",
            "general",
            "mixed",
            "technical",
            "hr",
            "resume",
            "interview",
            "general interview",
        }
        topic = (
            _derive_specific_topic(
                _extract_question_text(
                    next(
                        (
                            question_record
                            for question_record in question_records
                            if _extract_question_id(
                                question_record.user_message or ""
                            ) == question_id
                        ),
                        "",
                    )
                ),
                category,
            )
            if stored_topic.lower() in generic_topics
            else stored_topic
        ) or "General"
        score = _extract_score(record.ai_response or "")

        if score is None:
            continue

        scores.append(score)
        score_history.append(
            {
                "score": score,
                "topic": topic,
                "category": category,
                "created_at": (
                    record.created_at.isoformat()
                    if isinstance(record.created_at, datetime)
                    else None
                ),
            }
        )

        topic_entry = topic_stats.setdefault(
            topic,
            {"attempts": 0, "total_score": 0.0},
        )
        topic_entry["attempts"] += 1
        topic_entry["total_score"] += score

        category_entry = category_stats.setdefault(
            category,
            {"attempts": 0, "total_score": 0.0},
        )
        category_entry["attempts"] += 1
        category_entry["total_score"] += score

    def _stats(entries: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
        result: List[Dict[str, Any]] = []
        for name, value in entries.items():
            attempts = int(value["attempts"])
            average = round(value["total_score"] / attempts, 2) if attempts else 0
            result.append(
                {
                    "name": name,
                    "attempts": attempts,
                    "average_score": average,
                }
            )
        result.sort(
            key=lambda item: (item["average_score"], -item["attempts"])
        )
        return result

    topic_progress = _stats(topic_stats)
    category_progress = _stats(category_stats)

    average_score = (
        round(sum(scores) / len(scores), 2) if scores else None
    )

    recent_scores = scores[-5:]
    recent_average = (
        round(sum(recent_scores) / len(recent_scores), 2)
        if recent_scores
        else None
    )

    previous_scores = scores[-10:-5]
    previous_average = (
        round(sum(previous_scores) / len(previous_scores), 2)
        if previous_scores
        else None
    )

    improvement = (
        round(recent_average - previous_average, 2)
        if recent_average is not None and previous_average is not None
        else None
    )

    if improvement is None:
        trend = "not_enough_data"
    elif improvement >= 0.75:
        trend = "improving"
    elif improvement <= -0.75:
        trend = "declining"
    else:
        trend = "stable"

    session_ids = sorted(
        {
            record.session_id
            for record in records
            if record.session_id
        }
    )

    completed_sessions = sum(
        1
        for session_id in session_ids
        if any(
            (record.user_message or "").startswith(SESSION_MARKER)
            and "status=completed" in (record.user_message or "")
            for record in records
            if record.session_id == session_id
        )
    )

    question_ids = {
        qid for qid in (_extract_question_id(r.user_message or "") for r in question_records)
        if qid
    }
    answer_question_ids = {
        qid for qid in (_extract_question_id(r.user_message or "") for r in answer_records)
        if qid
    }
    answered_questions = len(answer_question_ids)
    total_unique_questions = len(question_ids)
    completion_rate = (
        round((len(answer_question_ids & question_ids) / total_unique_questions) * 100, 2)
        if total_unique_questions
        else 0
    )

    if average_score is None:
        readiness = "not_started"
    elif average_score >= 8:
        readiness = "strong"
    elif average_score >= 6:
        readiness = "developing"
    else:
        readiness = "needs_improvement"

    return {
        "total_sessions": len(session_ids),
        "completed_sessions": completed_sessions,
        "total_questions": len(question_records),
        "total_answers": answered_questions,
        "completion_rate": completion_rate,
        "average_score": average_score,
        "recent_average_score": recent_average,
        "previous_average_score": previous_average,
        "score_change": improvement,
        "trend": trend,
        "readiness": readiness,
        "weak_topics": [
            item for item in topic_progress[:10]
            if item.get("average_score", 10) < 7
        ],
        "topic_progress": topic_progress[:10],
        "category_progress": category_progress[:10],
        "score_history": score_history[-10:],
    }


# =========================================================
# ADAPTIVE DIFFICULTY
# =========================================================

def _difficulty_rank(value: str) -> int:
    key = normalize_text(value).lower()
    return {"easy": 1, "beginner": 1, "medium": 2, "intermediate": 2, "hard": 3, "advanced": 3}.get(key, 2)


def _difficulty_name(rank: int) -> str:
    return {1: "easy", 2: "medium", 3: "hard"}.get(max(1, min(3, int(rank))), "medium")


def get_adaptive_preparation_difficulty(db: Session, user_id: int, requested_difficulty: str = "medium", topic: Optional[str] = None) -> Dict[str, Any]:
    """Choose the next practice level from actual candidate performance."""
    requested_rank = _difficulty_rank(requested_difficulty)
    progress = build_preparation_progress(db=db, user_id=user_id)
    overall_average = progress.get("average_score")
    recent_average = progress.get("recent_average_score")
    topic_average = None
    topic_attempts = 0
    topic_name = normalize_text(topic)

    if topic_name:
        for item in progress.get("topic_progress", []):
            if normalize_text(item.get("name")).lower() == topic_name.lower():
                topic_average = item.get("average_score")
                topic_attempts = int(item.get("attempts") or 0)
                break

    measured = topic_average if topic_average is not None else overall_average
    if measured is None:
        return {"difficulty": _difficulty_name(requested_rank), "reason": "No evaluated answers yet; using the requested session difficulty.", "source": "session", "average_score": None, "topic_average_score": None, "topic_attempts": 0}

    if measured < 5.0:
        target = requested_rank - 1
        reason = f"Performance is {measured}/10, so the next question is one level easier."
    elif measured >= 7.5:
        target = requested_rank + 1
        reason = f"Performance is {measured}/10, so the next question is one level harder."
    else:
        target = requested_rank
        reason = f"Performance is {measured}/10, so the current difficulty is maintained."

    if topic_average is None and recent_average is not None:
        if recent_average < 4.5 and requested_rank > 1:
            target = min(target, requested_rank - 1)
            reason += f" Recent average is {recent_average}/10."
        elif recent_average >= 8.5 and requested_rank < 3:
            target = max(target, requested_rank + 1)
            reason += f" Recent average is {recent_average}/10."

    target = max(requested_rank - 1, min(requested_rank + 1, target))
    return {"difficulty": _difficulty_name(target), "reason": reason, "source": "topic_performance" if topic_average is not None else "overall_performance", "average_score": measured, "topic_average_score": topic_average, "topic_attempts": topic_attempts}

# =========================================================
# INTERNSHIP MATCH
# =========================================================

def recommend_internships(
    db: Session,
    user_id: int,
    limit: int = 10,
) -> List[Dict[str, Any]]:
    candidate = build_candidate_profile(
        db=db,
        user_id=user_id,
    )

    candidate_skills = [
        skill.lower()
        for skill in candidate["skills"]
    ]

    internships = (
        db.query(Internship)
        .order_by(Internship.created_at.desc())
        .all()
    )

    results: List[Dict[str, Any]] = []

    for internship in internships:
        required = normalize_list(
            internship.required_skills
        )

        matched: List[str] = []
        missing: List[str] = []

        for requirement in required:
            requirement_lower = requirement.lower()

            found = any(
                requirement_lower in skill
                or skill in requirement_lower
                for skill in candidate_skills
            )

            if found:
                matched.append(requirement)
            else:
                missing.append(requirement)

        percentage = (
            round((len(matched) / len(required)) * 100)
            if required
            else 0
        )

        results.append(
            {
                "internship_id": internship.id,
                "company_name": internship.company_name,
                "title": internship.title,
                "location": internship.location,
                "work_mode": internship.work_mode,
                "required_skills": required,
                "matched_skills": matched,
                "missing_skills": missing,
                "match_percentage": percentage,
            }
        )

    results.sort(
        key=lambda item: item["match_percentage"],
        reverse=True,
    )

    return results[:max(1, limit)]


# =========================================================
# INTERNSHIP-SPECIFIC PREPARATION
# =========================================================

def build_internship_preparation(
    db: Session,
    user_id: int,
    internships: Optional[List[Dict[str, Any]]] = None,
    limit: int = 5,
) -> List[Dict[str, Any]]:
    """
    Build preparation guidance for the candidate's best internship matches.

    The guidance is derived from existing Internship data, resume skills,
    and the candidate's persisted practice performance. No new tables are
    created and no internship records are modified.
    """
    candidate = build_candidate_profile(db=db, user_id=user_id)
    matches = internships or recommend_internships(
        db=db,
        user_id=user_id,
        limit=limit,
    )

    # Use existing practice performance to prioritize skills that are both
    # relevant to the internship and weak in previous interview attempts.
    progress = build_preparation_progress(db=db, user_id=user_id)
    weak_performance = {
        normalize_text(item.get("name")).lower(): item
        for item in progress.get("topic_progress", [])
        if item.get("average_score", 10) < 7
    }

    results: List[Dict[str, Any]] = []

    for internship in matches[:max(1, limit)]:
        required = unique_strings(internship.get("required_skills") or [])
        matched = unique_strings(internship.get("matched_skills") or [])
        missing = unique_strings(internship.get("missing_skills") or [])

        priority_topics: List[Dict[str, Any]] = []

        for skill in required:
            key = skill.lower()
            performance = weak_performance.get(key)

            if skill in missing:
                priority = "high"
                reason = "Required by this internship but not clearly present in the resume."
            elif performance:
                priority = "high" if performance["average_score"] < 5 else "medium"
                reason = (
                    f"Relevant to this internship and previous practice average "
                    f"is {performance['average_score']}/10."
                )
            elif skill in matched:
                priority = "medium"
                reason = "Relevant internship requirement supported by the resume."
            else:
                priority = "medium"
                reason = "Listed as a relevant internship requirement."

            priority_topics.append(
                {
                    "topic": skill,
                    "priority": priority,
                    "reason": reason,
                    "average_score": (
                        performance.get("average_score") if performance else None
                    ),
                }
            )

        priority_topics.sort(
            key=lambda item: (
                0 if item["priority"] == "high" else 1,
                item["average_score"] if item["average_score"] is not None else 10,
            )
        )

        preparation_actions = [
            f"Study the internship's highest-priority requirements: {', '.join(item['topic'] for item in priority_topics[:4]) or 'the listed role requirements'}.",
            "Prepare one resume-backed project or experience example for the most relevant skills.",
            "Practice technical and HR questions using the internship title and responsibilities as context.",
        ]

        description = normalize_text(internship.get("description"))
        responsibilities = normalize_text(internship.get("responsibilities"))

        results.append(
            {
                "internship_id": internship.get("internship_id"),
                "company_name": internship.get("company_name"),
                "title": internship.get("title"),
                "location": internship.get("location"),
                "work_mode": internship.get("work_mode"),
                "match_percentage": internship.get("match_percentage", 0),
                "required_skills": required,
                "matched_skills": matched,
                "missing_skills": missing,
                "priority_topics": priority_topics[:8],
                "preparation_actions": preparation_actions,
                "description": description[:700] if description else "",
                "responsibilities": responsibilities[:700] if responsibilities else "",
            }
        )

    return results


# =========================================================
# BUILD AI CONTEXT
# =========================================================

def build_preparation_context(
    db: Session,
    user_id: int,
) -> str:
    candidate = build_candidate_profile(
        db=db,
        user_id=user_id,
    )

    role_recommendations = recommend_roles(
        db=db,
        user_id=user_id,
    )[:3]

    personalization = build_resume_personalization(
        candidate=candidate,
        role_recommendations=role_recommendations,
    )

    preparation_profile = build_preparation_profile(
        candidate=candidate,
        role_recommendations=role_recommendations,
    )

    roadmap_data = build_preparation_roadmap(
        db=db,
        user_id=user_id,
        candidate=candidate,
        role_recommendations=role_recommendations,
    )

    internship_recommendations = recommend_internships(
        db=db,
        user_id=user_id,
        limit=5,
    )

    internship_preparation = build_internship_preparation(
        db=db,
        user_id=user_id,
        internships=internship_recommendations,
        limit=5,
    )

    lines: List[str] = [
        "Candidate Resume Context",
        "",
    ]

    user = candidate["user"]

    if user:
        lines.append(
            f"Candidate Name: {user['full_name']}"
        )
        lines.append(
            f"Email: {user['email']}"
        )
        lines.append(
            f"Application Role: {user.get('role', 'intern')}"
        )

    profile = candidate["profile"]

    if profile:
        summary = normalize_text(
            profile.get("professional_summary")
        )

        if summary:
            lines.append(
                f"Professional Summary: {summary}"
            )

    technical_skills = candidate["technical_skills"]

    if technical_skills:
        lines.append(
            "Technical Skills: "
            + ", ".join(technical_skills)
        )

    soft_skills = candidate["soft_skills"]

    if soft_skills:
        lines.append(
            "Soft Skills: "
            + ", ".join(soft_skills)
        )

    education = candidate["education"]

    if education:
        lines.extend(["", "Education:"])
        for item in education[:MAX_CONTEXT_ITEMS]:
            lines.append(str(item))

    projects = candidate["projects"]

    if projects:
        lines.extend(["", "Projects:"])
        for item in projects[:MAX_CONTEXT_ITEMS]:
            lines.append(str(item))

    certifications = candidate["certifications"]

    if certifications:
        lines.append(
            "Certifications: "
            + ", ".join(
                str(item)
                for item in certifications[:MAX_CONTEXT_ITEMS]
            )
        )

    work_experience = candidate["work_experience"]

    if work_experience:
        lines.extend(["", "Experience:"])
        for item in work_experience[:MAX_CONTEXT_ITEMS]:
            lines.append(str(item))

    lines.extend(["", "Personalized Preparation Profile:"])

    lines.append(
        f"Target role: {preparation_profile['target_role']} "
        f"({preparation_profile['role_match_percentage']}% match)"
    )
    lines.append(
        f"Experience level: {preparation_profile['experience_level']}"
    )
    lines.append(
        f"Estimated professional experience: "
        f"{preparation_profile['estimated_experience_years']} years"
    )
    lines.append(
        f"Profile completeness: {preparation_profile['profile_completeness']}%"
    )

    if preparation_profile["skills"]:
        lines.append(
            "Candidate skills: "
            + ", ".join(preparation_profile["skills"][:12])
        )

    if preparation_profile["matched_skills"]:
        lines.append(
            "Role-matched skills: "
            + ", ".join(preparation_profile["matched_skills"][:10])
        )

    if preparation_profile["missing_skills"]:
        lines.append(
            "Priority missing skills: "
            + ", ".join(preparation_profile["missing_skills"][:10])
        )

    lines.append(
        f"Best-fit role: {personalization['personalized_for_role']} "
        f"({personalization['top_role_match_percentage']}%)"
    )

    if personalization["strengths"]:
        lines.append("Strengths:")
        for item in personalization["strengths"]:
            lines.append(f"- {item}")

    if personalization["improvement_areas"]:
        lines.append("Improvement Areas:")
        for item in personalization["improvement_areas"]:
            lines.append(f"- {item}")

    if personalization["focus_topics"]:
        lines.append(
            "Recommended Focus Topics: "
            + ", ".join(personalization["focus_topics"])
        )

    lines.append("")
    lines.append("Weak Topics and Preparation Roadmap:")

    for item in roadmap_data["weak_topics"][:6]:
        average = item.get("average_score")
        score_text = (
            f"; previous average={average}/10"
            if average is not None
            else ""
        )
        lines.append(
            f"- {item['topic']} | priority={item['priority']} "
            f"| source={item.get('source', 'derived')}"
            f"{score_text} | {item['reason']}"
        )

    for item in roadmap_data["roadmap"][:6]:
        lines.append(
            f"Roadmap Step {item['step']}: {item['topic']} - "
            f"{item['goal']} Action: {item['action']}"
        )

    progress = build_preparation_progress(
        db=db,
        user_id=user_id,
    )
    lines.extend(["", "Preparation Progress:"])
    lines.append(
        f"Readiness: {progress['readiness']} | "
        f"Average score: {progress['average_score']} | "
        f"Trend: {progress['trend']}"
    )
    lines.append(
        f"Questions: {progress['total_questions']} | "
        f"Answers: {progress['total_answers']} | "
        f"Completion rate: {progress['completion_rate']}%"
    )
    if progress["topic_progress"]:
        lines.append("Lowest-scoring topics:")
        for item in progress["topic_progress"][:5]:
            lines.append(
                f"- {item['name']}: {item['average_score']}/10 "
                f"({item['attempts']} attempts)"
            )

    lines.extend(["", "Recommended Roles:"])

    for role in role_recommendations:
        lines.append(
            f"{role['role']} - "
            f"{role['match_percentage']}%"
        )

    lines.extend(["", "Top Internship Matches:"])

    for internship in internship_recommendations:
        lines.append(
            f"{internship['title']} at "
            f"{internship['company_name']} - "
            f"{internship['match_percentage']}%"
        )

    lines.extend(["", "Internship-Specific Preparation:"])
    for internship in internship_preparation[:5]:
        lines.append(
            f"{internship['title']} at {internship['company_name']} "
            f"({internship['match_percentage']}% match)"
        )
        if internship["priority_topics"]:
            lines.append(
                "Priority internship topics: "
                + ", ".join(
                    item["topic"]
                    for item in internship["priority_topics"][:5]
                )
            )
        for action in internship["preparation_actions"][:3]:
            lines.append(f"- {action}")

    return "\n".join(lines)



# =========================================================
# DOCUMENT Q&A
# =========================================================

DOCUMENT_QA_MARKER = "[PREPARATION_DOCUMENT_QA]"


def _clean_document_text(value: Any, max_chars: int = 50000) -> str:
    """Normalize document text before sending it to the AI."""
    text = normalize_text(value)
    if not text:
        return ""

    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text[:max_chars].strip()


def _document_history(
    db: Session,
    user_id: int,
    document_name: Optional[str] = None,
) -> List[AIChatHistory]:
    """Return this user's persisted document-Q&A history."""
    query = db.query(AIChatHistory).filter(
        AIChatHistory.user_id == user_id,
        AIChatHistory.user_message.like(f"{DOCUMENT_QA_MARKER}%"),
    )

    if document_name:
        safe_name = normalize_text(document_name)
        query = query.filter(
            AIChatHistory.user_message.like(f"%Document: {safe_name}%")
        )

    return (
        query.order_by(
            AIChatHistory.created_at.asc(),
            AIChatHistory.id.asc(),
        )
        .all()
    )


def document_question_answer(
    db: Session,
    user_id: int,
    question: str,
    document_text: str,
    document_name: str = "Uploaded document",
    previous_messages: Optional[List[Dict[str, str]]] = None,
) -> str:
    """
    Answer a candidate's question using only the supplied document content
    plus the candidate's existing InternMatch preparation context.

    The document itself is not stored in a new database table. Only the
    question/answer interaction is persisted in AIChatHistory.
    """
    cleaned_question = normalize_text(question)
    cleaned_document = _clean_document_text(document_text)
    cleaned_name = normalize_text(document_name) or "Uploaded document"

    if not cleaned_question:
        raise ValueError("Document question cannot be empty.")

    if not cleaned_document:
        raise ValueError("Document text cannot be empty.")

    candidate_context = build_preparation_context(
        db=db,
        user_id=user_id,
    )

    history = _document_history(
        db=db,
        user_id=user_id,
        document_name=cleaned_name,
    )

    recent_document_history = []
    for record in history[-6:]:
        raw = record.user_message or ""
        answer = normalize_text(record.ai_response or "")
        question_match = re.search(
            r"Question:\s*(.*?)(?:\nAnswer:|$)",
            raw,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if question_match:
            previous_question = question_match.group(1).strip()
            if previous_question:
                recent_document_history.append(
                    f"Q: {previous_question}\nA: {answer[:1200]}"
                )

    previous_document_qa = (
        "\n\n".join(recent_document_history)
        if recent_document_history
        else "None"
    )

    prompt = f"""
You are the Document Q&A assistant inside the InternMatch application.

Answer the user's question using the uploaded document as the primary source.
The candidate context is provided only to help personalize the explanation when
relevant to interview preparation.

Document name:
{cleaned_name}

Uploaded document content:
{cleaned_document}

Candidate preparation context:
{candidate_context}

Previous questions about this document:
{previous_document_qa}

Strict rules:
1. Answer only from information supported by the uploaded document.
2. Do not invent facts, dates, skills, employers, projects, qualifications,
   requirements, or recommendations that are not supported by the document.
3. If the document does not contain the answer, clearly say that the document
   does not provide enough information.
4. When useful, identify the relevant section or wording from the document,
   but do not fabricate page numbers or citations.
5. For interview preparation questions, connect the document content to the
   candidate's preparation context only when that connection is supported.
6. Keep the response concise, practical, and easy to understand.
7. If the user asks for a summary, summarize only the supplied document.
8. If the user asks what to prepare from the document, prioritize concrete
   skills, topics, responsibilities, eligibility criteria, or interview areas
   explicitly present in it.
9. Do not claim to have performed an application action such as applying,
   saving, withdrawing, or uploading unless the application actually did so.
"""

    response = generate_ai_response(
        user_message=(
            prompt
            + "\n\nUser Question:\n"
            + cleaned_question
        ),
        previous_messages=previous_messages,
        application_context=candidate_context,
    )

    answer_text = normalize_text(response)
    if not answer_text:
        answer_text = (
            "I could not generate an answer from the uploaded document. "
            "Please try asking the question again."
        )

    history_record = AIChatHistory(
        user_id=user_id,
        session_id=f"document_qa_{uuid4().hex}",
        user_message=(
            f"{DOCUMENT_QA_MARKER}\n"
            f"Document: {cleaned_name}\n"
            f"Question: {cleaned_question}\n"
            f"Answer: {answer_text}"
        ),
        ai_response=answer_text,
    )

    db.add(history_record)
    db.commit()
    db.refresh(history_record)

    return answer_text


def get_document_qa_history(
    db: Session,
    user_id: int,
    document_name: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Return persisted document-Q&A interactions for the authenticated user."""
    records = _document_history(
        db=db,
        user_id=user_id,
        document_name=document_name,
    )

    result: List[Dict[str, Any]] = []

    for record in records:
        raw = record.user_message or ""
        document_match = re.search(
            r"Document:\s*(.*?)\nQuestion:",
            raw,
            flags=re.IGNORECASE | re.DOTALL,
        )
        question_match = re.search(
            r"Question:\s*(.*?)\nAnswer:",
            raw,
            flags=re.IGNORECASE | re.DOTALL,
        )

        result.append(
            {
                "id": record.id,
                "document_name": (
                    document_match.group(1).strip()
                    if document_match
                    else "Uploaded document"
                ),
                "question": (
                    question_match.group(1).strip()
                    if question_match
                    else ""
                ),
                "answer": normalize_text(record.ai_response or ""),
                "created_at": (
                    record.created_at.isoformat()
                    if record.created_at
                    else None
                ),
            }
        )

    return result

# =========================================================
# PREPARATION CHAT
# =========================================================

def preparation_chat(
    db: Session,
    user_id: int,
    user_message: str,
    previous_messages: Optional[List[Dict[str, str]]] = None,
) -> str:
    message = normalize_text(user_message)

    if not message:
        raise ValueError("Message cannot be empty.")

    # Keep the real InternMatch mock-interview workflow deterministic. This
    # prevents a language model from replacing a specific UI question with a
    # generic preparation overview.
    mock_terms = ("mock interview", "mock-interview")
    workflow_terms = (
        "how",
        "attend",
        "apply",
        "start",
        "join",
        "take",
        "begin",
    )
    if any(term in message for term in mock_terms) and any(
        term in message for term in workflow_terms
    ):
        return (
            "1. Open Start Practicing\n"
            "   Go to the Start Practicing section on the Preparation Agent page.\n\n"
            "2. Select Mock Interview\n"
            "   Choose Mock Interview to prepare a full AI interview session.\n\n"
            "3. Configure your session\n"
            "   In Personalized Session, choose the category, difficulty, target role, and number of questions.\n\n"
            "4. Start the interview\n"
            "   Click the start button to begin your mock interview.\n\n"
            "5. Answer each question\n"
            "   Submit your answer for each question and continue to the next one.\n\n"
            "6. Review your results\n"
            "   After finishing, review your AI score, feedback, strengths, and areas to improve."
        )

    context = build_preparation_context(
        db=db,
        user_id=user_id,
    )

    # The preparation service supplies the candidate data as application context.
    # Do not prepend a second instruction prompt to the user's message. Doing so
    # makes the model treat the instruction block as the question and can produce
    # generic or unrelated answers.
    return generate_ai_response(
        user_message=message,
        previous_messages=previous_messages,
        application_context=context,
        dashboard_type="preparation",
        user_role="intern",
    )


# =========================================================
# PRACTICE HISTORY HELPERS
# =========================================================

def get_practice_history(
    db: Session,
    user_id: int,
    session_id: str,
) -> List[AIChatHistory]:
    return (
        db.query(AIChatHistory)
        .filter(
            and_(
                AIChatHistory.user_id == user_id,
                AIChatHistory.session_id == session_id,
            )
        )
        .order_by(
            AIChatHistory.created_at.asc(),
            AIChatHistory.id.asc(),
        )
        .all()
    )


def _question_records(
    db: Session,
    user_id: int,
    session_id: Optional[str] = None,
) -> List[AIChatHistory]:
    query = db.query(AIChatHistory).filter(
        AIChatHistory.user_id == user_id,
        AIChatHistory.user_message.like(
            f"{QUESTION_MARKER}%"
        ),
    )

    if session_id:
        query = query.filter(
            AIChatHistory.session_id == session_id
        )

    return (
        query.order_by(
            AIChatHistory.created_at.asc(),
            AIChatHistory.id.asc(),
        )
        .all()
    )


def _answer_records(
    db: Session,
    user_id: int,
    session_id: Optional[str] = None,
) -> List[AIChatHistory]:
    query = db.query(AIChatHistory).filter(
        AIChatHistory.user_id == user_id,
        AIChatHistory.user_message.like(
            f"{ANSWER_MARKER}%"
        ),
    )

    if session_id:
        query = query.filter(
            AIChatHistory.session_id == session_id
        )

    return (
        query.order_by(
            AIChatHistory.created_at.asc(),
            AIChatHistory.id.asc(),
        )
        .all()
    )


def _extract_question_text(record: Any) -> str:
    """Extract question text from either an AIChatHistory record or raw text.

    Some preparation flows pass the database record, while the question-state
    lookup passes the already extracted ``user_message`` string. Supporting both
    forms prevents AttributeError when Give AI Feedback is clicked.
    """
    if isinstance(record, str):
        text = record
    else:
        text = getattr(record, "user_message", "") or ""

    if text.startswith(QUESTION_MARKER):
        text = text[len(QUESTION_MARKER):].strip()

    return text



def _derive_specific_topic(
    question_text: str,
    category: str = "",
) -> str:
    """Recover a useful topic when older question records stored a generic category as topic."""
    text = normalize_text(question_text).lower()
    category_key = normalize_text(category).lower()

    if not text:
        if "hr" in category_key or "behavior" in category_key:
            return "Behavioral Interview"
        if "resume" in category_key:
            return "Resume and Projects"
        if "technical" in category_key:
            return "Core Technical Concepts"
        return "Interview Fundamentals"

    topic_rules = [
        ("JavaScript", ("javascript", " js ", "ecmascript", "closure", "promise", "event loop", "hoisting", "dom")),
        ("React", ("react", "jsx", "useeffect", "usestate", "props", "component", "virtual dom")),
        ("Python", ("python", "django", "flask", "pandas", "list comprehension")),
        ("Java", ("java", "jvm", "jre", "jdk", "spring", "servlet")),
        ("SQL", (" sql ", "mysql", "postgresql", "query", "join", "normalization", "subquery")),
        ("HTML/CSS", ("html", "html5", "css", "flexbox", "grid", "box model", "semantic")),
        ("Data Structures", ("data structure", "array", "linked list", "stack", "queue", "tree", "graph", "hash table", "heap")),
        ("Algorithms", ("algorithm", "sorting", "searching", "binary search", "recursion", "dynamic programming", "greedy", "time complexity", "space complexity")),
        ("Object-Oriented Programming", ("object oriented", "oops", "inheritance", "polymorphism", "encapsulation", "abstraction", "class and object")),
        ("Git", ("git", "github", "gitlab", "commit", "branch", "merge", "rebase", "pull request")),
        ("REST APIs", ("rest api", "restful", "api", "http", "endpoint", "get request", "post request", "put request", "delete request", "json")),
        ("DBMS", ("dbms", "database", "acid", "transaction", "indexing", "primary key", "foreign key")),
        ("Computer Networks", ("network", "tcp", "udp", "http", "https", "dns", "osi", "ip address")),
        ("Operating Systems", ("operating system", "process", "thread", "deadlock", "paging", "virtual memory", "scheduling")),
        ("Behavioral Interview", ("tell me about yourself", "strength", "weakness", "teamwork", "conflict", "leadership", "challenge", "failure", "communication")),
    ]

    padded = f" {text} "
    for topic, keywords in topic_rules:
        if any(keyword in padded for keyword in keywords):
            return topic

    if "hr" in category_key or "behavior" in category_key:
        return "Behavioral Interview"
    if "resume" in category_key:
        return "Resume and Projects"
    if "technical" in category_key:
        return "Core Technical Concepts"
    return "Interview Fundamentals"

def _extract_score(text: str) -> Optional[float]:
    if not text:
        return None

    raw = normalize_text(text)

    # Support structured JSON evaluations stored by the frontend.
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            for key in (
                "score",
                "overall_score",
                "total_score",
                "overallScore",
            ):
                value = parsed.get(key)
                if value is not None:
                    if isinstance(value, (int, float)) and not isinstance(value, bool):
                        return max(0.0, min(float(value), 10.0))
                    match = re.search(r"(?<!\d)(10(?:\.0+)?|[0-9](?:\.[0-9]+)?)(?:\s*/\s*10)?", normalize_text(value))
                    if match:
                        return max(0.0, min(float(match.group(1)), 10.0))
    except (TypeError, ValueError, json.JSONDecodeError):
        pass

    patterns = [
        r"(?:overall\s+)?score\s*:\s*(\d+(?:\.\d+)?)\s*/\s*10",
        r"(?:overall\s+)?score\s*=\s*(\d+(?:\.\d+)?)",
        r"(?:overall\s+)?score\s*:\s*(\d+(?:\.\d+)?)",
        r"(\d+(?:\.\d+)?)\s*/\s*10",
    ]

    for pattern in patterns:
        match = re.search(
            pattern,
            raw,
            flags=re.IGNORECASE,
        )

        if match:
            try:
                score = float(match.group(1))
                return max(0.0, min(score, 10.0))
            except (TypeError, ValueError):
                pass

    return None



def _extract_question_id(
    text: str,
) -> Optional[str]:
    match = re.search(
        r"Question ID:\s*([A-Za-z0-9_.-]+)",
        text or "",
        flags=re.IGNORECASE,
    )

    return match.group(1) if match else None


def _find_question_by_id(
    db: Session,
    user_id: int,
    question_id: Any,
) -> Optional[PreparationQuestionState]:
    question_id_text = normalize_text(question_id)

    if not question_id_text:
        return None

    records = _question_records(
        db=db,
        user_id=user_id,
    )

    for record in records:
        raw = record.user_message or ""

        match = re.search(
            r"Question ID:\s*([A-Za-z0-9_.-]+)",
            raw,
            flags=re.IGNORECASE,
        )

        if match and match.group(1) == question_id_text:
            question_text = _extract_question_text(
                raw
            )

            metadata = record.ai_response or ""
            values = _parse_question_metadata(metadata)

            return PreparationQuestionState(
                id=question_id_text,
                session_id=record.session_id,
                user_id=user_id,
                question=question_text,
                category=values.get(
                    "category",
                    "General",
                ),
                topic=values.get(
                    "topic",
                    "General",
                ),
                difficulty=values.get(
                    "difficulty",
                    "medium",
                ),
                source=values.get(
                    "source",
                    "ai",
                ),
                created_at=_safe_datetime(
                    record.created_at
                ),
            )

    return None


def _parse_question_metadata(
    metadata: str,
) -> Dict[str, str]:
    result: Dict[str, str] = {}

    for line in (metadata or "").splitlines():
        if "=" not in line:
            continue

        key, value = line.split(
            "=",
            1,
        )

        key = key.strip().lower()
        value = value.strip()

        if key and value:
            result[key] = value

    return result


def _question_history_for_prompt(
    db: Session,
    user_id: int,
    session_id: str,
) -> List[str]:
    records = _question_records(
        db=db,
        user_id=user_id,
        session_id=session_id,
    )

    return [
        _extract_question_text(record)
        for record in records[-20:]
        if _extract_question_text(record)
    ]


# =========================================================
# CREATE PREPARATION SESSION
#
# No database session row is created.
# A UUID identifies the frontend practice session.
# =========================================================

def create_preparation_session(
    db: Session,
    user_id: int,
    category: str,
    target_role: str,
    difficulty: str,
    session_type: str = "practice",
) -> PreparationSessionState:
    profile = get_resume_profile(
        db=db,
        user_id=user_id,
    )

    if profile is None:
        raise ValueError(
            "Resume analysis is required before starting "
            "Preparation Agent practice."
        )

    now = utc_now()

    return PreparationSessionState(
        id=new_session_id(),
        user_id=user_id,
        session_type=normalize_text(
            session_type
        ) or "practice",
        category=normalize_text(
            category
        ) or "General",
        target_role=normalize_text(
            target_role
        ) or "Software Engineering Intern",
        difficulty=normalize_text(
            difficulty
        ) or "medium",
        status="active",
        created_at=now,
    )


# =========================================================
# GENERATE QUESTION
#
# Question is stored in AIChatHistory so it can be used to
# prevent repetition without a PreparationQuestion table.
# =========================================================

def generate_preparation_question(
    db: Session,
    user_id: int,
    session: PreparationSessionState,
    topic: str,
) -> PreparationQuestionState:
    profile = get_resume_profile(
        db=db,
        user_id=user_id,
    )

    if profile is None:
        raise ValueError(
            "Resume analysis is required before generating "
            "preparation questions."
        )

    context = build_preparation_context(
        db=db,
        user_id=user_id,
    )

    previous_questions = _question_history_for_prompt(
        db=db,
        user_id=user_id,
        session_id=session.id,
    )

    previous_text = (
        "\n".join(
            f"- {item}"
            for item in previous_questions
        )
        if previous_questions
        else "None"
    )

    candidate_skills = unique_strings(
        normalize_list(profile.skills)
        + normalize_list(profile.technical_skills)
    )
    candidate_projects = normalize_list(profile.projects)
    candidate_experience = normalize_list(profile.work_experience)
    candidate_certifications = normalize_list(profile.certifications)

    preparation_profile = build_preparation_profile(
        candidate=build_candidate_profile(db=db, user_id=user_id),
        role_recommendations=recommend_roles(db=db, user_id=user_id)[:3],
    )

    adaptive = get_adaptive_preparation_difficulty(
        db=db,
        user_id=user_id,
        requested_difficulty=session.difficulty,
        topic=topic,
    )
    adaptive_difficulty = adaptive["difficulty"]

    personalization_lines = [
        "Candidate skills: " + (", ".join(candidate_skills[:12]) or "None"),
        "Candidate project evidence: " + (" | ".join(candidate_projects[:3]) or "None"),
        "Candidate experience evidence: " + (" | ".join(candidate_experience[:3]) or "None"),
        "Candidate certifications: " + (", ".join(candidate_certifications[:6]) or "None"),
        "Experience level: " + preparation_profile["experience_level"],
        "Best-fit role: " + preparation_profile["target_role"],
        "Priority focus topics: " + (
            ", ".join(preparation_profile["focus_topics"][:8]) or "None"
        ),
    ]

    prompt = f"""
You are the personalized interview preparation AI inside InternMatch.

Generate exactly ONE interview question for this candidate.

Target Role:
{session.target_role}

Category:
{session.category}

Requested Difficulty:
{session.difficulty}

Adaptive Difficulty:
{adaptive_difficulty}

Topic:
{normalize_text(topic) or "General"}

Candidate Context:
{context}

Candidate Evidence:
{chr(10).join(personalization_lines)}

Previously asked questions:
{previous_text}

Personalization rules:
- Base the question on the target role, selected category, topic, and candidate evidence.
- Prefer an actual resume skill, project, internship, certification, or experience when it naturally fits.
- For project/experience questions, ask about the candidate's actual work rather than inventing details.
- If the selected topic is not supported by the resume, ask a general role-appropriate question instead of pretending the candidate has that skill.
- Match the Adaptive Difficulty, using the requested difficulty only as the starting level.
- Progress from fundamentals to practical/application questions when possible.
- Never repeat or closely paraphrase a previous question.
- Generate only one question.
- Keep it to 1-2 sentences and about 30-40 words maximum.
- Return ONLY the question text.
"""

    try:
        question_text = generate_ai_response(
            user_message=prompt,
            previous_messages=None,
            application_context=context,
        ).strip()
    except Exception:
        question_text = ""

    question_text = _clean_question_text(
        question_text
    )

    if not question_text:
        question_text = _fallback_question(
            session=session,
            topic=topic,
        )

    question_id = new_question_id()

    metadata = "\n".join(
        [
            f"question_id={question_id}",
            f"category={session.category}",
            f"topic={normalize_text(topic) or 'General'}",
            f"difficulty={session.difficulty}",
            "source=ai",
        ]
    )

    history = AIChatHistory(
        user_id=user_id,
        session_id=session.id,
        user_message=(
            f"{QUESTION_MARKER}\n"
            f"Question ID: {question_id}\n"
            f"{question_text}"
        ),
        ai_response=metadata,
    )

    db.add(history)
    db.commit()
    db.refresh(history)

    return PreparationQuestionState(
        id=question_id,
        session_id=session.id,
        user_id=user_id,
        question=question_text,
        category=session.category,
        topic=normalize_text(topic) or "General",
        difficulty=adaptive_difficulty,
        source="ai",
        created_at=history.created_at or utc_now(),
    )


def _clean_question_text(
    question_text: str,
) -> str:
    text = normalize_text(question_text)

    if not text:
        return ""

    if text.startswith("Question:"):
        text = text[len("Question:"):].strip()

    text = text.strip("\"'")

    # Prevent accidental multi-question AI output.
    lines = [
        line.strip()
        for line in text.splitlines()
        if line.strip()
    ]

    if lines:
        text = lines[0]

    # Keep the generated question compact.
    words = text.split()

    if len(words) > 45:
        text = " ".join(words[:45]).rstrip(".,;:") + "?"

    return text


def _fallback_question(
    session: PreparationSessionState,
    topic: str,
) -> str:
    role = (
        session.target_role
        or "your target role"
    )

    topic_text = (
        normalize_text(topic)
        or "a core technical concept"
    )

    return (
        f"For the {role} role, explain "
        f"{topic_text} and give one practical example."
    )


# =========================================================
# EVALUATE ANSWER
# =========================================================

def evaluate_preparation_answer(
    db: Session,
    user_id: int,
    question: PreparationQuestionState,
    user_answer: str,
) -> str:
    """Evaluate an answer using the candidate's real resume context.

    The evaluation remains AI-driven, but the prompt enforces a consistent
    rubric and prevents the evaluator from rewarding skills that are not
    supported by the candidate context. No preparation database tables are
    required.
    """
    cleaned_answer = normalize_text(user_answer)

    if not cleaned_answer:
        raise ValueError(
            "Answer cannot be empty."
        )

    profile = get_resume_profile(
        db=db,
        user_id=user_id,
    )

    if profile is None:
        raise ValueError(
            "Resume analysis is required before evaluating "
            "preparation answers."
        )

    context = build_preparation_context(
        db=db,
        user_id=user_id,
    )

    question_topic = normalize_text(question.topic) or "General"
    question_category = normalize_text(question.category) or "General"
    question_difficulty = normalize_text(question.difficulty) or "medium"
    target_role = normalize_text(
        getattr(question, "target_role", "")
    ) or "the selected target role"

    prompt = f"""
You are an expert interview evaluator inside the InternMatch application.

Evaluate the candidate's answer fairly and specifically for this interview
question. The candidate's resume context is evidence about what they know or
have actually worked with. Do not invent experience, skills, projects, or
achievements that are not supported by that context.

Target Role:
{target_role}

Question Category:
{question_category}

Question Difficulty:
{question_difficulty}

Question Topic:
{question_topic}

Interview Question:
{question.question}

Candidate Answer:
{cleaned_answer}

Candidate Resume/Application Context:
{context}

Evaluation rules:
1. Score the answer from 0 to 10 using correctness, technical knowledge,
   relevance, completeness, and communication.
2. For technical questions, prioritize factual correctness and whether the
   answer actually addresses the asked concept.
3. For HR/behavioral questions, prioritize relevance, clarity, ownership,
   structure, and concrete examples.
4. Do not lower the score merely because the candidate has no work experience
   when the question does not require it.
5. If the candidate claims experience that conflicts with the resume context,
   point that out as something to verify rather than inventing evidence.
6. Give practical improvements the candidate can use on the next attempt.
7. Provide an interview-quality ideal answer that is concise and appropriate
   for the candidate's level.
8. Do not give multiple conflicting scores.

Return ONLY valid JSON. Do not use Markdown or code fences. Use exactly these keys:
{{
  "score": 0,
  "correctness": 0,
  "technical_knowledge": 0,
  "relevance": 0,
  "completeness": 0,
  "communication": 0,
  "answer_verdict": "correct",
  "feedback": "specific overall feedback",
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"],
  "ideal_answer": "a clear, question-specific model answer that teaches the intern what a strong answer should contain",
  "matched_key_points": ["key point present in the candidate answer"],
  "missing_or_incorrect_points": ["important point missing or incorrect"]
}}

Scoring rules:
- score and every metric must be a number from 0 to 10.
- For technical questions, assess factual correctness and required concepts.
- For HR/general questions, assess semantic fit, relevance, reasoning, clarity and examples; do not require keywords.
- "correct" normally means score >= 7, "partially_correct" means 4-6.9, and "incorrect" means < 4.
- The ideal_answer must be a real answer to the exact interview question, never a grading instruction.
- Keep each feedback field concise so the response is complete.

Keep the evaluation fair, encouraging, specific, and practical.
"""

    try:
        # Practice feedback is interactive, so use the dedicated low-latency
        # evaluator first. Fall back to the normal AI service if unavailable.
        evaluation = generate_fast_ai_response(prompt)
        if not normalize_text(evaluation):
            evaluation = generate_ai_response(
                user_message=prompt,
                previous_messages=None,
                application_context=context,
            )
    except Exception:
        try:
            evaluation = generate_ai_response(
                user_message=prompt,
                previous_messages=None,
                application_context=context,
            )
        except Exception:
            evaluation = (
            "Score: 5/10\n\n"
            "Correctness: The answer could not be fully verified.\n"
            "Technical Knowledge: Add the key technical points related to the question.\n"
            "Relevance: Stay directly focused on what the question asks.\n"
            "Completeness: Include the important parts and one practical example.\n"
            "Communication: Use a clear, structured explanation.\n\n"
            "What Was Good:\n"
            "1. You attempted the question.\n"
            "2. You provided a direct response.\n\n"
            "What Needs Improvement:\n"
            "1. Explain the core concept more precisely.\n"
            "2. Add a relevant practical example.\n\n"
            "Ideal Answer:\n"
            "Give a concise definition, explain the key point, and finish with a practical example."
        )

    return normalize_text(evaluation)


def save_preparation_answer(
    db: Session,
    user_id: int,
    question_id: Any,
    user_answer: str,
    evaluation: Any,
) -> PreparationAnswerState:
    """Persist one practice answer exactly once per question.

    Evaluation is stored as plain text because the existing AIChatHistory
    model is shared by the application. The function accepts either a string
    or a structured object from the frontend.
    """
    cleaned_answer = normalize_text(user_answer)

    if not cleaned_answer:
        raise ValueError("Answer cannot be empty.")

    question = _find_question_by_id(
        db=db,
        user_id=user_id,
        question_id=question_id,
    )

    if question is None:
        raise ValueError(
            "Preparation question was not found. Please generate the question again."
        )

    if isinstance(evaluation, dict):
        cleaned_evaluation = json.dumps(evaluation, ensure_ascii=False)
    else:
        cleaned_evaluation = normalize_text(str(evaluation or ""))

    if not cleaned_evaluation:
        cleaned_evaluation = "No evaluation was returned."

    # Replace an existing answer for this question instead of creating a
    # second history row. This prevents progress and scores from being
    # inflated by repeated clicks.
    existing = None
    for record in (
        db.query(AIChatHistory)
        .filter(AIChatHistory.user_id == user_id)
        .filter(AIChatHistory.session_id == question.session_id)
        .filter(AIChatHistory.user_message.like(f"{ANSWER_MARKER}%"))
        .order_by(AIChatHistory.created_at.asc(), AIChatHistory.id.asc())
        .all()
    ):
        match = re.search(
            r"Question ID:\s*([^\s]+)",
            record.user_message or "",
            flags=re.IGNORECASE,
        )
        if match and match.group(1) == str(question.id):
            existing = record
            break

    answer_id = new_answer_id()
    answer_message = (
        f"{ANSWER_MARKER}\n"
        f"Answer ID: {answer_id}\n"
        f"Question ID: {question.id}\n"
        f"Question: {question.question}\n"
        f"Candidate Answer: {cleaned_answer}"
    )

    if existing is not None:
        existing.user_message = answer_message
        existing.ai_response = cleaned_evaluation
        answer_record = existing
    else:
        answer_record = AIChatHistory(
            user_id=user_id,
            session_id=question.session_id,
            user_message=answer_message,
            ai_response=cleaned_evaluation,
        )
        db.add(answer_record)

    db.commit()
    db.refresh(answer_record)

    return PreparationAnswerState(
        id=answer_id,
        question_id=question.id,
        user_id=user_id,
        answer=cleaned_answer,
        feedback=cleaned_evaluation,
        score=_extract_score(cleaned_evaluation),
        created_at=answer_record.created_at or utc_now(),
    )


# =========================================================
# PRACTICE SESSION RESULT
# =========================================================

def get_preparation_session_result(
    db: Session,
    user_id: int,
    session_id: str,
) -> Dict[str, Any]:
    records = (
        db.query(AIChatHistory)
        .filter(AIChatHistory.user_id == user_id)
        .filter(AIChatHistory.session_id == session_id)
        .order_by(AIChatHistory.created_at.asc(), AIChatHistory.id.asc())
        .all()
    )

    questions = [
        r for r in records
        if (r.user_message or "").startswith(QUESTION_MARKER)
    ]
    answers = [
        r for r in records
        if (r.user_message or "").startswith(ANSWER_MARKER)
    ]

    question_map: Dict[str, Dict[str, Any]] = {}
    for record in questions:
        qid = _extract_question_id(record.user_message or "")
        if not qid:
            continue
        meta = _parse_question_metadata(record.ai_response or "")
        question_map[qid] = {
            "question_id": qid,
            "question": _extract_question_text(record),
            "topic": meta.get("topic", "General"),
            "category": meta.get("category", "General"),
            "difficulty": meta.get("difficulty", "medium"),
        }

    # Latest saved answer wins for a question.
    answer_map: Dict[str, AIChatHistory] = {}
    for record in answers:
        qid = _extract_question_id(record.user_message or "")
        if qid:
            answer_map[qid] = record

    report = []
    scores = []
    for qid, record in answer_map.items():
        raw = record.user_message or ""
        score = _extract_score(record.ai_response or "")
        if score is not None:
            scores.append(score)

        answer_match = re.search(
            r"Candidate Answer:\s*(.*)$", raw, flags=re.IGNORECASE | re.DOTALL
        )
        answer_text = answer_match.group(1).strip() if answer_match else ""
        report.append({
            **question_map.get(qid, {"question_id": qid, "question": ""}),
            "answer": answer_text,
            "score": score,
            "evaluation": record.ai_response or "",
        })

    report.sort(key=lambda item: list(answer_map.keys()).index(item["question_id"]) if item["question_id"] in answer_map else 9999)
    average_score = round(sum(scores) / len(scores), 2) if scores else None
    total_questions = len(question_map)
    answered_questions = len(answer_map)
    completion_rate = round((answered_questions / total_questions) * 100, 2) if total_questions else 0

    return {
        "session_id": session_id,
        "total_questions": total_questions,
        "answered_questions": answered_questions,
        "completion_rate": completion_rate,
        "average_score": average_score,
        "score_percentage": round((average_score or 0) * 10, 1),
        "completed": any(
            (r.user_message or "").startswith(SESSION_MARKER)
            and "status=completed" in (r.user_message or "")
            for r in records
        ),
        "answers": report,
    }


# =========================================================
# COMPLETE SESSION
#
# No PreparationSession row exists.
# Completion is reconstructed from AIChatHistory.
# =========================================================

def complete_preparation_session(
    db: Session,
    session_id: str,
    user_id: Optional[int] = None,
) -> Optional[PreparationSessionState]:
    if not session_id:
        return None

    query = db.query(AIChatHistory).filter(
        AIChatHistory.session_id == session_id
    )

    if user_id is not None:
        query = query.filter(
            AIChatHistory.user_id == user_id
        )

    records = (
        query.order_by(
            AIChatHistory.created_at.asc(),
            AIChatHistory.id.asc(),
        )
        .all()
    )

    if not records:
        return None

    owner_id = records[0].user_id

    questions = [
        record
        for record in records
        if (record.user_message or "").startswith(
            QUESTION_MARKER
        )
    ]

    answers = [
        record
        for record in records
        if (record.user_message or "").startswith(
            ANSWER_MARKER
        )
    ]

    scores = [
        score
        for score in (
            _extract_score(
                record.ai_response or ""
            )
            for record in answers
        )
        if score is not None
    ]

    average_score = (
        round(sum(scores) / len(scores), 2)
        if scores
        else None
    )

    category = "General"
    target_role = "Software Engineering Intern"
    difficulty = "medium"

    if questions:
        metadata = _parse_question_metadata(
            questions[0].ai_response or ""
        )
        category = metadata.get(
            "category",
            category,
        )
        difficulty = metadata.get(
            "difficulty",
            difficulty,
        )

    completion_record = AIChatHistory(
        user_id=owner_id,
        session_id=session_id,
        user_message=(
            f"{SESSION_MARKER}\n"
            f"status=completed"
        ),
        ai_response=(
            f"score={average_score if average_score is not None else ''}\n"
            f"questions={len(questions)}\n"
            f"answers={len(answers)}"
        ),
    )

    db.add(completion_record)
    db.commit()
    db.refresh(completion_record)

    return PreparationSessionState(
        id=session_id,
        user_id=owner_id,
        category=category,
        target_role=target_role,
        difficulty=difficulty,
        session_type="practice",
        status="completed",
        score=average_score,
        completed_at=(
            completion_record.created_at
            or utc_now()
        ),
        created_at=(
            records[0].created_at
            or utc_now()
        ),
    )



# =========================================================
# PHASE 2 — STEP 9: MOCK INTERVIEW
# =========================================================
#
# Mock Interview uses the existing AIChatHistory table only.
# No PreparationSession / PreparationQuestion / PreparationAnswer
# database tables are required.
#
# The frontend can keep the active mock-interview state in memory/session
# storage while these records provide durable question/answer/evaluation
# history.
# =========================================================

@dataclass
class MockInterviewQuestionState:
    id: str
    session_id: str
    user_id: int
    question: str
    category: str
    topic: str
    difficulty: str
    target_role: str
    question_number: int = 1
    source: str = "ai"
    created_at: Optional[datetime] = None


def new_mock_interview_id() -> str:
    return f"mock_interview_{uuid4().hex}"


def new_mock_question_id() -> str:
    return f"mock_question_{uuid4().hex}"


def _mock_history(
    db: Session,
    user_id: int,
    session_id: Optional[str] = None,
) -> List[AIChatHistory]:
    # Mock questions and answers use their own markers, while the
    # completion record uses MOCK_INTERVIEW_MARKER. The previous query only
    # matched the completion marker, which made saved answers appear as zero
    # during final validation/result calculation.
    query = db.query(AIChatHistory).filter(
        AIChatHistory.user_id == user_id,
        or_(
            AIChatHistory.user_message.like(f"{MOCK_INTERVIEW_MARKER}%"),
            AIChatHistory.user_message.like(f"{MOCK_QUESTION_MARKER}%"),
            AIChatHistory.user_message.like(f"{MOCK_ANSWER_MARKER}%"),
        ),
    )

    if session_id:
        query = query.filter(
            AIChatHistory.session_id == session_id
        )

    return (
        query.order_by(
            AIChatHistory.created_at.asc(),
            AIChatHistory.id.asc(),
        )
        .all()
    )


def _mock_question_history(
    db: Session,
    user_id: int,
    session_id: str,
) -> List[AIChatHistory]:
    return (
        db.query(AIChatHistory)
        .filter(
            AIChatHistory.user_id == user_id,
            AIChatHistory.session_id == session_id,
            AIChatHistory.user_message.like(
                f"{MOCK_QUESTION_MARKER}%"
            ),
        )
        .order_by(
            AIChatHistory.created_at.asc(),
            AIChatHistory.id.asc(),
        )
        .all()
    )


def _mock_answer_history(
    db: Session,
    user_id: int,
    session_id: str,
) -> List[AIChatHistory]:
    return (
        db.query(AIChatHistory)
        .filter(
            AIChatHistory.user_id == user_id,
            AIChatHistory.session_id == session_id,
            AIChatHistory.user_message.like(
                f"{MOCK_ANSWER_MARKER}%"
            ),
        )
        .order_by(
            AIChatHistory.created_at.asc(),
            AIChatHistory.id.asc(),
        )
        .all()
    )


def _clean_mock_question(value: str) -> str:
    """Return only a genuine interview question from an AI response."""
    text = normalize_text(value)
    if not text:
        return ""

    # Handle JSON responses from the model.
    if text.startswith("{") and text.endswith("}"):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                for key in ("question", "question_text", "text", "prompt"):
                    candidate = normalize_text(parsed.get(key))
                    if candidate:
                        text = candidate
                        break
        except (TypeError, ValueError, json.JSONDecodeError):
            pass

    text = text.replace("```text", "").replace("```txt", "").replace("```markdown", "")
    text = text.replace("```", "").strip().strip("\"'")

    # Remove an AI heading while preserving the actual question that follows.
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    cleaned_lines: List[str] = []

    for line in lines:
        line = re.sub(
            r"^(?:question|interviewer question)\s*[:\-]?\s*",
            "",
            line,
            flags=re.IGNORECASE,
        )
        line = re.sub(r"^\d+\s*[\).:\-]\s*", "", line).strip()

        compact = re.sub(r"\s+", " ", line).strip().lower()

        if not compact:
            continue

        if re.fullmatch(r"question\s*\d+", compact):
            continue

        if re.fullmatch(r"question\s*\d+\s*\([^)]*\)\s*[:\-]?", compact):
            continue

        if (
            compact.startswith("question ")
            and "difficulty" in compact
            and len(compact.split()) < 15
        ):
            continue

        if compact in {
            "question",
            "interviewer question",
            "here is your question",
            "question unavailable",
            "no question",
            "none",
            "n/a",
        }:
            continue

        cleaned_lines.append(line.strip("\"'"))

    if not cleaned_lines:
        return ""

    # Prefer a line that actually looks like an interview question.
    question_candidates = [
        line
        for line in cleaned_lines
        if "?" in line or re.match(
            r"^(what|why|how|when|where|which|can you|could you|describe|tell me|explain|walk me|would you|have you)",
            line,
            flags=re.IGNORECASE,
        )
    ]

    text = question_candidates[0] if question_candidates else cleaned_lines[0]

    words = text.split()
    if len(words) > 80:
        text = " ".join(words[:80]).rstrip(".,;:") + "?"

    if len(text.split()) < 5:
        return ""

    return text



def _mock_previous_questions(
    records: List[AIChatHistory],
) -> List[str]:
    questions: List[str] = []

    for record in records:
        raw = record.user_message or ""
        match = re.search(
            r"Question:\s*(.*?)(?:\n|$)",
            raw,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if match:
            question = normalize_text(match.group(1))
            if question:
                questions.append(question)

    return questions


def create_mock_interview_session(
    db: Session,
    user_id: int,
    category: str = "Mixed",
    target_role: str = "",
    difficulty: str = "medium",
) -> PreparationSessionState:
    """
    Create an in-memory-compatible mock interview session.

    The session itself is not inserted into a preparation table.
    The returned ID is persisted when the first mock question is generated.
    """
    profile = get_resume_profile(
        db=db,
        user_id=user_id,
    )

    if profile is None:
        raise ValueError(
            "Resume analysis is required before starting a mock interview."
        )

    roles = recommend_roles(
        db=db,
        user_id=user_id,
    )

    recommended_role = (
        normalize_text(target_role)
        or (
            normalize_text(roles[0].get("role"))
            if roles
            else "Software Engineering Intern"
        )
    )

    difficulty_text = normalize_text(difficulty).lower()
    if difficulty_text not in {"easy", "medium", "hard"}:
        difficulty_text = "medium"

    category_text = normalize_text(category) or "Mixed"
    session_id = new_mock_interview_id()

    return PreparationSessionState(
        id=session_id,
        user_id=user_id,
        category=category_text,
        target_role=recommended_role,
        difficulty=difficulty_text,
        session_type="mock_interview",
        status="active",
        created_at=utc_now(),
    )


def generate_mock_interview_question(
    db: Session,
    user_id: int,
    session: PreparationSessionState,
    question_number: int = 1,
) -> MockInterviewQuestionState:
    """
    Generate exactly one personalized mock-interview question.

    Questions are persisted in AIChatHistory so later questions can avoid
    repetition. No preparation question table is created.
    """
    profile = get_resume_profile(
        db=db,
        user_id=user_id,
    )

    if profile is None:
        raise ValueError(
            "Resume analysis is required before generating mock interview questions."
        )

    context = build_preparation_context(
        db=db,
        user_id=user_id,
    )

    previous_records = _mock_question_history(
        db=db,
        user_id=user_id,
        session_id=session.id,
    )
    previous_questions = _mock_previous_questions(previous_records)

    previous_text = (
        "\n".join(f"- {item}" for item in previous_questions[-15:])
        if previous_questions
        else "None"
    )

    candidate_skills = unique_strings(
        normalize_list(profile.skills)
        + normalize_list(profile.technical_skills)
    )
    projects = normalize_list(profile.projects)
    experience = normalize_list(profile.work_experience)

    prompt = f"""
You are the AI Mock Interviewer inside the InternMatch application.

Conduct a realistic one-question-at-a-time interview for the candidate.

Target Role:
{session.target_role}

Interview Category:
{session.category}

Difficulty:
{session.difficulty}

Question Number:
{question_number}

Candidate Resume/Application Context:
{context}

Candidate Skills:
{", ".join(candidate_skills[:15]) or "None"}

Candidate Projects:
{" | ".join(projects[:4]) or "None"}

Candidate Experience:
{" | ".join(experience[:4]) or "None"}

Previous Mock Interview Questions:
{previous_text}

Rules:
1. Generate exactly ONE interview question.
2. Do not repeat or closely paraphrase a previous question.
3. Use the candidate's actual resume evidence when appropriate.
4. Do not invent projects, experience, skills, employers, or achievements.
5. For technical questions, test practical understanding rather than trivia.
6. For HR/behavioral questions, ask for a concrete example when appropriate.
7. Match the requested difficulty.
8. Keep the question concise and realistic for an actual interview.
9. Mix technical and HR questions when the category is "Mixed".
10. Return ONLY the question text.
"""

    try:
        generated = _generate_interview_ai(prompt)
    except Exception:
        generated = ""

    question_text = _clean_mock_question(generated)

    # The AI may occasionally return a heading instead of the requested
    # question. Never persist/display that heading. Use a deterministic
    # resume-aware fallback so the interview always has a real question.
    if not question_text:
        fallback_skill = candidate_skills[0] if candidate_skills else "your main technical skill"
        category_key = session.category.strip().lower()
        difficulty_key = session.difficulty.strip().lower()
        role = session.target_role or "Software Engineering Intern"

        technical_questions = [
            f"What is {fallback_skill}, and where would you use it in a real project?",
            f"As a {role}, how would you debug a problem involving {fallback_skill}?",
            f"Explain one important best practice you would follow when using {fallback_skill} in production.",
            f"How would you test a {fallback_skill}-based feature before releasing it?",
            f"Describe a practical trade-off you might face when using {fallback_skill} and how you would decide between the options.",
        ]
        hr_questions = [
            f"Tell me about a project or experience that best demonstrates your fit for a {role} position.",
            "Tell me about a difficult problem you faced and how you worked through it.",
            "How do you prioritize your work when you have multiple deadlines?",
            "Tell me about a time you received critical feedback and how you responded.",
            "Why are you interested in this role, and what do you hope to learn from it?",
        ]
        behavioral_questions = [
            "Describe a situation where you had to learn something quickly. What did you do?",
            "Tell me about a time you disagreed with a teammate. How did you handle it?",
            "Describe a project where something did not go as planned. What did you learn?",
            "How do you communicate when you are blocked on a technical task?",
            "Tell me about a time you took ownership of a problem without being asked.",
        ]

        if category_key in {"hr", "behavioral", "behavioral / hr"}:
            pool = hr_questions if category_key == "hr" else behavioral_questions
        elif category_key == "technical":
            pool = technical_questions
        else:
            mixed_pools = [technical_questions, hr_questions, behavioral_questions]
            pool = mixed_pools[(max(question_number, 1) - 1) % len(mixed_pools)]

        question_text = pool[(max(question_number, 1) - 1) % len(pool)]

    # Final safety check: never persist a placeholder.
    if not _clean_mock_question(question_text):
        raise RuntimeError("Unable to generate a valid mock interview question.")

    question_id = new_mock_question_id()

    metadata = "\n".join(
        [
            f"question_id={question_id}",
            f"question_number={question_number}",
            f"category={session.category}",
            f"topic={candidate_skills[0] if candidate_skills else 'General'}",
            f"difficulty={session.difficulty}",
            f"target_role={session.target_role}",
            "source=ai",
        ]
    )

    record = AIChatHistory(
        user_id=user_id,
        session_id=session.id,
        user_message=(
            f"{MOCK_QUESTION_MARKER}\n"
            f"Question ID: {question_id}\n"
            f"Question Number: {question_number}\n"
            f"Question: {question_text}"
        ),
        ai_response=metadata,
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    return MockInterviewQuestionState(
        id=question_id,
        session_id=session.id,
        user_id=user_id,
        question=question_text,
        category=session.category,
        topic=(
            candidate_skills[0]
            if candidate_skills
            else "General"
        ),
        difficulty=session.difficulty,
        target_role=session.target_role,
        question_number=question_number,
        source="ai",
        created_at=record.created_at or utc_now(),
    )


def _parse_mock_evaluation_text(text: str, candidate_answer: str) -> Dict[str, Any]:
    """Parse AI mock-interview evaluation into a complete stable structure."""
    raw = normalize_text(text)
    if not raw:
        return {}

    parsed: Dict[str, Any] = {}

    # Accept strict JSON, fenced JSON, or JSON embedded in surrounding text.
    json_candidates = [raw]
    fenced = re.findall(r"```(?:json)?\s*([\s\S]*?)```", raw, flags=re.IGNORECASE)
    json_candidates.extend(fenced)
    object_match = re.search(r"\{[\s\S]*\}", raw)
    if object_match:
        json_candidates.append(object_match.group(0))

    for candidate in json_candidates:
        try:
            value = json.loads(candidate.strip())
            if isinstance(value, dict):
                parsed = value
                break
        except (TypeError, ValueError, json.JSONDecodeError):
            continue

    def clean(value: Any) -> str:
        return normalize_text(value)

    def coerce_number(value: Any) -> Optional[float]:
        if value is None or isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return max(0.0, min(10.0, float(value)))
        text_value = normalize_text(value)
        if not text_value:
            return None
        match = re.search(r"(?<!\d)(10(?:\.0+)?|[0-9](?:\.[0-9]+)?)(?:\s*/\s*10)?", text_value)
        if match:
            try:
                return max(0.0, min(10.0, float(match.group(1))))
            except (TypeError, ValueError):
                return None
        return None

    def number(*names: str) -> Optional[float]:
        aliases = []
        for name in names:
            aliases.extend([
                name,
                name.lower().replace(" ", "_"),
                f"{name.lower().replace(' ', '_')}_score",
            ])
        for key in aliases:
            if key in parsed:
                score_value = coerce_number(parsed[key])
                if score_value is not None:
                    return score_value
        label_pattern = "|".join(re.escape(name) for name in names)
        patterns = [
            rf"(?:^|\n)\s*(?:{label_pattern})\s*:\s*(\d+(?:\.\d+)?)\s*(?:/\s*10)?",
            rf"(?:{label_pattern})\s*=\s*(\d+(?:\.\d+)?)",
        ]
        for pattern in patterns:
            match = re.search(pattern, raw, flags=re.IGNORECASE)
            if match:
                return coerce_number(match.group(1))
        return None

    def block(*labels: str) -> str:
        label_pattern = "|".join(re.escape(label) for label in labels)
        stop_labels = (
            "Score|Overall Score|Correctness|Technical Knowledge|Technical|"
            "Relevance|Completeness|Communication|Answer Verdict|Verdict|"
            "Matched Key Points|Matched Points|Missing or Incorrect Points|"
            "Missing Points|Incorrect Points|What Was Good|Strengths|"
            "What Needs Improvement|Improvements|Feedback|Interviewer Feedback|"
            "Reference Answer|Ideal Answer|Recommended Answer|Candidate Answer"
        )
        match = re.search(
            rf"(?:^|\n)\s*(?:{label_pattern})\s*:\s*([\s\S]*?)(?=\n\s*(?:{stop_labels})\s*:|$)",
            raw,
            flags=re.IGNORECASE,
        )
        return clean(match.group(1)) if match else ""

    def list_value(*keys: str) -> List[str]:
        for key in keys:
            value = parsed.get(key)
            if isinstance(value, list):
                return [clean(x) for x in value if clean(x)]
            if isinstance(value, str) and value.strip():
                return [
                    re.sub(r"^\s*(?:[-*]|\d+[.)])\s*", "", line).strip()
                    for line in value.splitlines() if line.strip()
                ]
        value = block(*keys)
        if not value:
            return []
        return [
            re.sub(r"^\s*(?:[-*]|\d+[.)])\s*", "", line).strip()
            for line in value.splitlines() if line.strip()
        ]

    score = number("Score", "Overall Score", "overall_score", "total_score")
    correctness = number("Correctness", "correctness_score")
    technical = number("Technical Knowledge", "Technical", "technical_knowledge_score")
    relevance = number("Relevance", "relevance_score")
    completeness = number("Completeness", "completeness_score")
    communication = number("Communication", "communication_score")

    verdict = clean(parsed.get("answer_verdict") or parsed.get("verdict") or block("Answer Verdict", "Verdict"))
    verdict = verdict.lower().replace("-", "_").replace(" ", "_")
    if verdict in {"partial", "partially", "partiallycorrect"}:
        verdict = "partially_correct"
    if verdict not in {"correct", "partially_correct", "incorrect"}:
        verdict = "correct" if score is not None and score >= 8 else "partially_correct" if score is not None and score >= 5 else "incorrect"

    reference = clean(
        parsed.get("reference_answer")
        or parsed.get("ideal_answer")
        or parsed.get("recommended_answer")
        or parsed.get("model_answer")
        or block("Reference Answer", "Ideal Answer", "Recommended Answer")
    )
    feedback = clean(parsed.get("feedback") or parsed.get("overall_feedback") or parsed.get("comments") or block("Feedback", "Interviewer Feedback"))
    candidate = clean(parsed.get("candidate_answer") or block("Candidate Answer") or candidate_answer)

    result = {
        "score": score,
        "correctness": correctness,
        "technical_knowledge": technical,
        "relevance": relevance,
        "completeness": completeness,
        "communication": communication,
        "answer_verdict": verdict,
        "matched_key_points": list_value("matched_key_points", "matched_points", "Matched Key Points"),
        "missing_or_incorrect_points": list_value("missing_or_incorrect_points", "missing_points", "incorrect_points", "Missing or Incorrect Points"),
        "strengths": list_value("strengths", "what_was_good", "What Was Good"),
        "improvements": list_value("improvements", "what_needs_improvement", "What Needs Improvement"),
        "feedback": feedback,
        "reference_answer": reference,
        "ideal_answer": reference,
        "candidate_answer": candidate or candidate_answer,
        "raw_evaluation": raw,
    }
    return result


def _reference_answer_is_usable(value: Any) -> bool:
    text = normalize_text(value)
    if len(text) < 80:
        return False
    if re.fullmatch(r"(?:\d+[.)]\s*)?choose an?\.?", text, flags=re.IGNORECASE):
        return False
    if text.lower() in {"n/a", "na", "none", "unknown", "not available"}:
        return False
    return len(re.findall(r"[A-Za-z]{2,}", text)) >= 12


def _reference_answer_is_generic(value: Any) -> bool:
    """Return True when the reference is only a generic scoring instruction.

    The report must teach the intern what a good answer actually looks like.
    Generic phrases such as "a strong answer should directly address..." are
    therefore treated as unusable even when they pass the length check.
    """
    text = normalize_text(value).lower()
    if not text:
        return True
    generic_phrases = (
        "a strong answer should directly address the question",
        "a complete answer should directly address the question",
        "explain the relevant concepts accurately",
        "provide an appropriate practical example",
        "include the key implementation or reasoning details required by the question",
        "a reference answer could not be generated",
    )
    return any(phrase in text for phrase in generic_phrases)


def _generate_exact_reference_answer(question: MockInterviewQuestionState) -> str:
    """Generate a learner-friendly model answer for the exact question."""
    prompt = f"""
You are an expert interviewer and mentor. Write the CORRECT MODEL ANSWER that an intern can study after an interview.

EXACT INTERVIEW QUESTION:
{question.question}

ROLE: {question.target_role}
CATEGORY: {question.category}
DIFFICULTY: {question.difficulty}

Requirements:
- Answer THIS exact question, not a generic description of how to answer it.
- Make the answer understandable to an intern.
- For technical questions, state the correct concepts, explain them briefly, and give a realistic example when useful.
- For coding/engineering questions, include the important technical reasoning, best practice, or trade-off the question asks about.
- For HR/behavioral questions, provide a strong professional sample answer without pretending it is the candidate's real experience.
- Do not mention scoring, evaluation, keywords, the candidate, or this instruction.
- Do not write a heading, preface, numbering, or meta-commentary.
- Write 3-6 complete sentences.
- Use plain professional language that an intern can learn from.

Return ONLY the model answer.
"""
    try:
        answer = _clean_reference_answer(generate_fast_ai_response(prompt))
        if _reference_answer_is_usable(answer) and not _reference_answer_is_generic(answer):
            return answer
    except Exception:
        pass
    try:
        answer = _clean_reference_answer(_generate_interview_ai(prompt))
        if _reference_answer_is_usable(answer) and not _reference_answer_is_generic(answer):
            return answer
    except Exception:
        pass
    return ""


def _mock_evaluation_is_complete(value: Dict[str, Any]) -> bool:
    required_numeric = (
        "score", "correctness", "technical_knowledge", "relevance",
        "completeness", "communication",
    )
    if not value or not all(value.get(key) is not None for key in required_numeric):
        return False
    return _reference_answer_is_usable(value.get("reference_answer"))


def _mock_evaluation_needs_second_pass(value: Dict[str, Any]) -> bool:
    if not value:
        return True
    numeric = [value.get(k) for k in (
        "score", "correctness", "technical_knowledge", "relevance",
        "completeness", "communication",
    )]
    all_zero = all(v is not None and float(v) == 0 for v in numeric)
    return all_zero or not _reference_answer_is_usable(value.get("reference_answer"))


def _clean_reference_answer(value: Any) -> str:
    """Clean an AI reference answer without applying question-specific rules."""
    text = normalize_text(value)
    if not text:
        return ""

    fenced = re.findall(r"```(?:text|txt|markdown)?\s*([\s\S]*?)```", text, flags=re.IGNORECASE)
    if fenced:
        text = normalize_text(fenced[0])

    # If the model returned JSON, extract the answer field.
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            for key in ("reference_answer", "ideal_answer", "answer", "model_answer"):
                candidate = normalize_text(parsed.get(key))
                if candidate:
                    text = candidate
                    break
    except (TypeError, ValueError, json.JSONDecodeError):
        pass

    text = re.sub(r"^\s*(?:reference answer|ideal answer|correct answer|answer)\s*:\s*", "", text, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", text).strip()


def _generate_mock_reference_answer(question: MockInterviewQuestionState) -> str:
    """Generate a complete reference answer for the exact interview question."""
    prompt = f"""
You are an expert technical and HR interviewer for InternMatch.
Question: {question.question}
Role: {question.target_role}
Category: {question.category}
Difficulty: {question.difficulty}

Write a complete, accurate reference answer to THIS EXACT QUESTION.
For technical questions, include the essential concepts and implementation or
security details the question asks for. For behavioral questions, give the ideal
structure and relevant points without inventing personal experience.
Write 3-6 complete sentences. Do not start with a heading or numbering.
Return ONLY the answer text.
"""
    try:
        answer = _clean_reference_answer(_generate_interview_ai(prompt))
        return answer if _reference_answer_is_usable(answer) else ""
    except Exception:
        return ""


def _complete_mock_evaluation(
    db: Session,
    question: MockInterviewQuestionState,
    candidate_answer: str,
    evaluation_text: str,
) -> Dict[str, Any]:
    """Guarantee that every saved mock evaluation has usable metrics and reference answer."""
    parsed = _parse_mock_evaluation_text(evaluation_text, candidate_answer)

    if not _mock_evaluation_is_complete(parsed) or _mock_evaluation_needs_second_pass(parsed):
        repair_prompt = f"""
You are the final scoring judge for one InternMatch mock interview answer.
Return ONLY one compact valid JSON object. Do not return markdown.

QUESTION:
{question.question}

ROLE: {question.target_role}
CATEGORY: {question.category}
DIFFICULTY: {question.difficulty}

CANDIDATE ANSWER:
{candidate_answer}

You must judge ONLY the candidate answer against the exact question.
Do not punish the candidate for using different wording when the meaning is correct.
Do not invent missing facts or candidate experience.
For technical questions, check whether the answer correctly addresses the requested concept, implementation, security, trade-offs, or examples actually asked for.
For HR questions, check relevance, structure, ownership, specificity, and clarity.

Scoring:
- 9-10 = excellent and substantially complete
- 7-8 = correct with only minor omissions
- 5-6 = partially correct with important omissions
- 3-4 = weak or substantially incomplete
- 1-2 = mostly incorrect/irrelevant
- 0 = no meaningful answer or materially wrong answer

A long answer that is technically correct must NOT receive 0.
Semantic equivalence counts as correct.

The reference_answer must be a complete answer to THIS QUESTION, at least 3 sentences, and must never be a fragment such as "1. Choose an.".
Keep arrays short: maximum 3 items each.
Keep feedback under 500 characters.

Return exactly these keys:
{{
  "score": number,
  "correctness": number,
  "technical_knowledge": number,
  "relevance": number,
  "completeness": number,
  "communication": number,
  "answer_verdict": "correct" | "partially_correct" | "incorrect",
  "matched_key_points": [],
  "missing_or_incorrect_points": [],
  "strengths": [],
  "improvements": [],
  "feedback": "",
  "reference_answer": "",
  "candidate_answer": ""
}}
"""
        repaired = _generate_interview_ai(repair_prompt)
        repaired_parsed = _parse_mock_evaluation_text(repaired, candidate_answer)
        if repaired_parsed:
            parsed = {**parsed, **{k: v for k, v in repaired_parsed.items() if v not in (None, "", [], {})}}

    # If the first repair still produced an unusable result, perform a final
    # focused judge pass. This is intentionally separate from reference-answer
    # generation so a truncated answer cannot silently become the evaluation.
    if _mock_evaluation_needs_second_pass(parsed):
        final_prompt = f"""
Evaluate this interview answer as an independent final judge and return ONLY compact JSON.
Question: {question.question}
Candidate answer: {candidate_answer}

Judge the candidate answer against the exact question, not against a memorized reference.
Give six 0-10 numbers: score, correctness, technical_knowledge, relevance, completeness, communication.
Do not give all six values as 0 unless the answer is empty, materially unrelated, or materially wrong.
If the answer is substantively correct but misses some requested details, score it as partially
correct, normally in the 5-8 range according to the omissions. If it covers most requested
concepts accurately, normally score it in the 7-10 range. Semantic equivalence counts.
Return a 3-5 sentence accurate reference_answer for the exact question.
answer_verdict must be correct, partially_correct, or incorrect.
Keep feedback short and arrays to at most 2 items.
"""
        final_raw = _generate_interview_ai(final_prompt)
        final_parsed = _parse_mock_evaluation_text(final_raw, candidate_answer)
        if final_parsed:
            parsed = {**parsed, **{k: v for k, v in final_parsed.items() if v not in (None, "", [], {})}}

    score = parsed.get("score")
    numeric_keys = ["correctness", "technical_knowledge", "relevance", "completeness", "communication"]
    if score is None:
        available = [parsed.get(k) for k in numeric_keys if parsed.get(k) is not None]
        score = round(sum(available) / len(available), 2) if available else 0.0
        parsed["score"] = score

    # If the model omitted one dimension, use the overall evaluated score rather
    # than displaying a misleading blank metric in the final report.
    for key in numeric_keys:
        if parsed.get(key) is None:
            parsed[key] = float(score)

    reference = _clean_reference_answer(parsed.get("reference_answer"))
    # The evaluator prompt can return a generic scoring sentence instead of a
    # useful model answer. Treat that as missing and generate a dedicated exact
    # answer so the report teaches the intern what the answer should be.
    if (not _reference_answer_is_usable(reference)) or _reference_answer_is_generic(reference):
        reference = _generate_exact_reference_answer(question)
    if not reference:
        reference = _generate_mock_reference_answer(question)
    if not reference:
        reference = (
            "Review the question-specific concepts and provide a complete answer "
            "that directly explains the requested idea with the relevant reasoning "
            "or example. This fallback is shown only if the AI model is unavailable."
        )
    parsed["reference_answer"] = reference
    parsed["ideal_answer"] = reference
    parsed["candidate_answer"] = normalize_text(parsed.get("candidate_answer") or candidate_answer)

    numeric_keys = [
        "correctness",
        "technical_knowledge",
        "relevance",
        "completeness",
        "communication",
    ]
    numeric_values = []
    for key in numeric_keys:
        value = parsed.get(key)
        try:
            number = max(0.0, min(10.0, float(value)))
        except (TypeError, ValueError):
            number = None
        if number is not None:
            parsed[key] = number
            numeric_values.append(number)

    if numeric_values:
        parsed["score"] = round(sum(numeric_values) / len(numeric_values), 2)

    score_value = float(parsed.get("score") or 0)
    verdict = normalize_text(parsed.get("answer_verdict")).lower().replace("-", "_").replace(" ", "_")
    if verdict not in {"correct", "partially_correct", "incorrect"}:
        parsed["answer_verdict"] = (
            "correct" if score_value >= 7.5
            else "partially_correct" if score_value >= 4.5
            else "incorrect"
        )

    if not parsed.get("feedback"):
        parsed["feedback"] = "The answer was evaluated against the interview question, role expectations, and communication quality."
    if not parsed.get("strengths"):
        parsed["strengths"] = ["You attempted the interview question."]
    if not parsed.get("improvements"):
        parsed["improvements"] = ["Add specific reasoning and supporting details to strengthen the answer."]

    return parsed


def _contains_keyword(answer: str, keyword: str) -> bool:
    """Check whether a concept/keyword is actually present in the candidate answer."""
    answer_l = normalize_text(answer).lower()
    keyword_l = normalize_text(keyword).lower()
    if not answer_l or not keyword_l:
        return False
    # Phrase match first.
    if keyword_l in answer_l:
        return True
    # Treat punctuation/underscores as separators for technical terms.
    tokens = [t for t in re.split(r"[^a-z0-9+#.]+", keyword_l) if t]
    if not tokens:
        return False
    return all(token in answer_l for token in tokens)


def _derive_mock_keywords(question_text: str) -> List[str]:
    """Derive deterministic technical concepts from the exact mock question.

    This is a safety net for cases where the LLM is unavailable or does not
    return expected_keywords. The final technical score can therefore still
    be calculated from concepts actually present in the candidate answer.
    """
    text = normalize_text(question_text)
    if not text:
        return []

    lower = text.lower()
    known_phrases = [
        "react", "react.js", "javascript", "typescript", "html", "css",
        "node.js", "node", "express", "django", "django rest framework",
        "rest api", "api", "endpoint", "fastapi", "flask", "python",
        "java", "spring boot", "sql", "postgresql", "mysql", "mongodb",
        "database", "orm", "sqlalchemy", "authentication", "authorization",
        "validation", "testing", "unit testing", "integration testing",
        "payment", "razorpay", "stripe", "webhook", "jwt", "oauth",
        "git", "docker", "kubernetes", "aws", "azure", "deployment",
        "state management", "redux", "component", "props", "hooks",
        "useeffect", "usestate", "routing", "responsive design", "performance",
        "caching", "algorithm", "data structure", "array", "linked list",
        "stack", "queue", "hashmap", "recursion", "time complexity",
        "space complexity", "exception handling", "error handling", "security",
        "encryption", "authorization", "transaction", "schema", "model",
        "crud", "http", "json", "request", "response", "frontend", "backend",
        "order", "payment gateway", "storage", "persist", "database storage",
    ]

    found: List[str] = []
    for phrase in known_phrases:
        if phrase in lower and phrase not in found:
            found.append(phrase)

    # Capture important multi-word concepts from the question even when they
    # are not in the known list. Keep common filler words out.
    stop = {
        "what", "how", "would", "you", "your", "the", "this", "that",
        "with", "from", "into", "about", "explain", "describe", "tell",
        "where", "when", "which", "why", "should", "could", "can", "does",
        "have", "has", "and", "or", "for", "to", "of", "in", "on", "a",
        "an", "is", "are", "be", "as", "it", "its", "their", "they",
        "them", "user", "users", "candidate", "real", "project", "feature",
        "one", "include", "including", "using", "used", "use", "would",
    }
    words = re.findall(r"[A-Za-z][A-Za-z0-9+#.-]{2,}", text)
    for word in words:
        clean = word.strip(".,:;()[]{}?!\"").lower()
        if clean in stop or len(clean) < 3:
            continue
        if clean not in {x.lower() for x in found} and clean not in {x.lower() for x in found}:
            # Prefer words that look like technical concepts.
            if any(ch.isdigit() for ch in clean) or clean in {
                "component", "endpoint", "validation", "payment", "database",
                "api", "backend", "frontend", "storage", "security", "testing",
                "request", "response", "authentication", "authorization",
                "transaction", "schema", "model", "order",
            }:
                found.append(clean)

    # Avoid an oversized keyword list; coverage should remain meaningful.
    return found[:10]


def _hybrid_keyword_metrics(question: MockInterviewQuestionState, answer: str, ai: Dict[str, Any]) -> Dict[str, Any]:
    """Combine AI semantic judgement with deterministic keyword verification."""
    expected = ai.get("expected_keywords") or ai.get("key_points") or []
    if isinstance(expected, str):
        expected = [x.strip() for x in re.split(r"[,\n;]", expected) if x.strip()]
    expected = [normalize_text(x) for x in expected if normalize_text(x)][:10]

    # If the AI did not return expected keywords, derive them from the exact
    # question so technical scoring never collapses to a generic score.
    if not expected:
        expected = _derive_mock_keywords(question.question)

    matched = [kw for kw in expected if _contains_keyword(answer, kw)]
    missing = [kw for kw in expected if kw not in matched]

    ai_score = ai.get("score")
    try:
        ai_score = max(0.0, min(10.0, float(ai_score))) if ai_score is not None else None
    except (TypeError, ValueError):
        ai_score = None

    category = normalize_text(question.category).lower()
    technical = any(x in category for x in ("technical", "coding", "python", "javascript", "programming", "dsa", "sql"))

    # Technical answers: keyword coverage is an explicit signal, while AI remains
    # responsible for correctness and semantic equivalence.
    if technical and expected:
        keyword_coverage = len(matched) / len(expected)
        keyword_score = keyword_coverage * 10.0
        # Technical mock interviews are intentionally keyword/concept driven.
        # AI semantic judgement is useful, but cannot overpower the concepts
        # actually present in the candidate answer.
        if ai_score is None:
            final_score = keyword_score
        else:
            final_score = (keyword_score * 0.75) + (ai_score * 0.25)
        final_score = max(0.0, min(10.0, round(final_score, 2)))
    elif ai_score is not None and ai_score > 0:
        final_score = round(ai_score, 2)
    else:
        # General/HR fallback: a meaningful answer should not be displayed as 0
        # just because the model returned an unusable numeric payload.
        words = len(normalize_text(answer).split())
        final_score = 4.0 if words >= 5 else 2.0 if words >= 2 else 1.0

    dimensions = {}
    for key in ("correctness", "technical_knowledge", "relevance", "completeness", "communication"):
        value = ai.get(key)
        try:
            value = max(0.0, min(10.0, float(value))) if value is not None else None
        except (TypeError, ValueError):
            value = None
        dimensions[key] = value if value is not None and value > 0 else final_score

    if technical and expected:
        dimensions["correctness"] = round((dimensions["correctness"] * 0.65) + ((len(matched) / len(expected)) * 10.0 * 0.35), 2)
        dimensions["technical_knowledge"] = round((dimensions["technical_knowledge"] * 0.65) + ((len(matched) / len(expected)) * 10.0 * 0.35), 2)
        dimensions["completeness"] = round((dimensions["completeness"] * 0.65) + ((len(matched) / len(expected)) * 10.0 * 0.35), 2)

    verdict = normalize_text(ai.get("answer_verdict")).lower().replace("-", "_").replace(" ", "_")
    if final_score >= 7:
        verdict = "correct"
    elif final_score >= 4.5:
        verdict = "partially_correct"
    else:
        verdict = "incorrect"

    coverage = round((len(matched) / len(expected)) * 100, 2) if expected else None

    return {
        "score": final_score,
        **dimensions,
        "answer_verdict": verdict,
        "expected_keywords": expected[:10],
        "keyword_coverage": coverage,
        "matched_key_points": matched[:6] or ai.get("matched_key_points", [])[:6],
        "missing_or_incorrect_points": missing[:6] or ai.get("missing_or_incorrect_points", [])[:6],
    }


def _fast_mock_evaluation(question: MockInterviewQuestionState, answer: str) -> Dict[str, Any]:
    """One fast AI call plus deterministic keyword validation."""
    prompt = f"""
You are a professional company interview evaluator.
Evaluate this ONE candidate answer against the exact question.

Question: {question.question}
Role: {question.target_role}
Category: {question.category}
Difficulty: {question.difficulty}
Candidate answer: {answer}

Rules:
- If the question is technical/coding, identify 3-10 essential keywords or concepts that a correct answer should contain. Do not require exact wording; use concepts.
- For technical questions, correctness comes from whether the candidate actually explains the required concepts. Keyword coverage is a supporting signal, not the only signal.
- For HR/general/behavioral questions, evaluate semantically: does the answer directly and credibly answer the question, with clear reasoning and relevant detail?
- Do not require a reference answer to have identical wording.
- A meaningful, substantively correct answer must NOT receive 0.
- 0 is only for an empty, completely unrelated, or materially wrong answer.
- Return one JSON object only. No markdown.

JSON keys:
score, correctness, technical_knowledge, relevance, completeness, communication,
answer_verdict, expected_keywords, matched_key_points, missing_or_incorrect_points,
strengths, improvements, feedback, reference_answer

All numeric scores must be 0-10. expected_keywords should be short concepts.
reference_answer must directly answer the exact question in 3-6 sentences.
"""
    try:
        raw = generate_fast_ai_response(prompt)
    except Exception:
        raw = ""

    parsed = _parse_mock_evaluation_text(raw, answer)
    # Preserve fields the parser does not currently extract.
    try:
        raw_json = json.loads(raw)
        if isinstance(raw_json, dict):
            parsed["expected_keywords"] = raw_json.get("expected_keywords") or raw_json.get("key_points") or []
    except Exception:
        parsed["expected_keywords"] = []

    # Deterministic fallback: for technical questions, derive concepts directly
    # from the question and score against the words/concepts in the answer.
    if not parsed:
        parsed = {
            "score": None,
            "correctness": None,
            "technical_knowledge": None,
            "relevance": None,
            "completeness": None,
            "communication": None,
            "answer_verdict": "incorrect",
            "expected_keywords": _derive_mock_keywords(question.question),
            "matched_key_points": [],
            "missing_or_incorrect_points": [],
            "strengths": [],
            "improvements": [],
            "feedback": "Technical concepts were checked directly against the interview question.",
            "reference_answer": "",
        }

    metrics = _hybrid_keyword_metrics(question, answer, parsed)
    parsed.update(metrics)
    parsed["candidate_answer"] = answer
    parsed["reference_answer"] = _clean_reference_answer(parsed.get("reference_answer"))
    if (not _reference_answer_is_usable(parsed.get("reference_answer"))) or _reference_answer_is_generic(parsed.get("reference_answer")):
        parsed["reference_answer"] = _generate_exact_reference_answer(question)
    if not parsed.get("reference_answer"):
        parsed["reference_answer"] = (
            "Review the question-specific concepts and provide a complete answer "
            "that directly explains the requested idea with the relevant reasoning "
            "or example. This fallback is shown only if the AI model is unavailable."
        )
    parsed["ideal_answer"] = parsed["reference_answer"]
    if not parsed.get("feedback"):
        parsed["feedback"] = "The answer was evaluated for relevance, correctness, completeness, and communication."
    if not parsed.get("strengths"):
        parsed["strengths"] = ["The answer directly attempted the interview question."]
    if not parsed.get("improvements"):
        parsed["improvements"] = ["Add the key concepts or reasoning requested by the question."]
    return parsed


def evaluate_mock_interview_answer(
    db: Session,
    user_id: int,
    question: MockInterviewQuestionState,
    user_answer: str,
) -> str:
    """Fast hybrid mock evaluation: AI semantics + deterministic keyword validation."""
    cleaned_answer = normalize_text(user_answer)
    if not cleaned_answer:
        raise ValueError("Mock interview answer cannot be empty.")

    profile = get_resume_profile(db=db, user_id=user_id)
    if profile is None:
        raise ValueError("Resume analysis is required before evaluating a mock interview answer.")

    try:
        complete = _fast_mock_evaluation(question, cleaned_answer)
    except Exception:
        complete = {}

    if not complete or not complete.get("score"):
        words = len(cleaned_answer.split())
        fallback = max(1.0, min(6.0, 2.0 + (words / 25.0)))
        complete = {
            "score": round(fallback, 2),
            "correctness": round(fallback, 2),
            "technical_knowledge": round(fallback, 2),
            "relevance": round(fallback, 2),
            "completeness": round(fallback, 2),
            "communication": round(fallback, 2),
            "answer_verdict": "partially_correct",
            "matched_key_points": [],
            "missing_or_incorrect_points": [],
            "strengths": ["You provided a meaningful attempt."],
            "improvements": ["Add more question-specific details and reasoning."],
            "feedback": "The answer was evaluated, but the AI response was incomplete.",
            "reference_answer": "A strong answer should directly address the question, explain the relevant concepts accurately, and provide an appropriate practical example.",
            "ideal_answer": "A strong answer should directly address the question, explain the relevant concepts accurately, and provide an appropriate practical example.",
            "candidate_answer": cleaned_answer,
        }

    complete["candidate_answer"] = cleaned_answer
    complete["score"] = round(max(0.0, min(10.0, float(complete.get("score", 0)))), 2)
    for key in ("correctness", "technical_knowledge", "relevance", "completeness", "communication"):
        try:
            complete[key] = round(max(0.0, min(10.0, float(complete.get(key, complete["score"])))), 2)
        except (TypeError, ValueError):
            complete[key] = complete["score"]
    complete["reference_answer"] = _clean_reference_answer(complete.get("reference_answer"))
    complete["ideal_answer"] = complete["reference_answer"]
    complete["raw_evaluation"] = complete.get("raw_evaluation", "")
    return json.dumps(complete, ensure_ascii=False)

def save_mock_interview_answer(
    db: Session,
    user_id: int,
    question: MockInterviewQuestionState,
    user_answer: str,
    evaluation: Optional[str] = None,
) -> PreparationAnswerState:
    """Persist one mock answer with a guaranteed structured evaluation.

    The database stores the complete normalized evaluation as JSON in the
    existing AIChatHistory.ai_response column. This keeps the current schema
    unchanged while making the final report deterministic.
    """
    cleaned_answer = normalize_text(user_answer)
    if not cleaned_answer:
        raise ValueError("Mock interview answer cannot be empty.")

    # Never persist an incomplete/free-form evaluation. Normalize it first;
    # if it is incomplete, the same evaluator/repair path used by the
    # evaluation endpoint creates the missing metrics and reference answer.
    evaluation_text = normalize_text(evaluation)
    complete = {}
    if evaluation_text:
        try:
            parsed_evaluation = json.loads(evaluation_text)
            if isinstance(parsed_evaluation, dict) and parsed_evaluation.get("score") is not None:
                complete = parsed_evaluation
        except (TypeError, ValueError, json.JSONDecodeError):
            complete = {}

        if not complete:
            complete = _complete_mock_evaluation(
                db=db,
                question=question,
                candidate_answer=cleaned_answer,
                evaluation_text=evaluation_text,
            )
    else:
        generated = evaluate_mock_interview_answer(
            db=db,
            user_id=user_id,
            question=question,
            user_answer=cleaned_answer,
        )
        try:
            complete = json.loads(generated)
        except (TypeError, ValueError, json.JSONDecodeError):
            complete = _complete_mock_evaluation(
                db=db,
                question=question,
                candidate_answer=cleaned_answer,
                evaluation_text=generated,
            )

    complete["candidate_answer"] = cleaned_answer
    complete["reference_answer"] = normalize_text(complete.get("reference_answer"))
    complete["ideal_answer"] = complete["reference_answer"]
    feedback = json.dumps(complete, ensure_ascii=False)

    existing_records = (
        db.query(AIChatHistory)
        .filter(
            AIChatHistory.user_id == user_id,
            AIChatHistory.session_id == question.session_id,
            AIChatHistory.user_message.like(f"{MOCK_ANSWER_MARKER}%"),
        )
        .order_by(AIChatHistory.created_at.desc(), AIChatHistory.id.desc())
        .all()
    )

    for existing in existing_records:
        existing_raw = existing.user_message or ""
        if _extract_question_id(existing_raw) != question.id:
            continue

        answer_id_match = re.search(
            r"Answer ID:\s*([A-Za-z0-9_.-]+)",
            existing_raw,
            flags=re.IGNORECASE,
        )
        answer_id = answer_id_match.group(1) if answer_id_match else new_answer_id()

        existing.user_message = (
            f"{MOCK_ANSWER_MARKER}\n"
            f"Answer ID: {answer_id}\n"
            f"Question ID: {question.id}\n"
            f"Question Number: {question.question_number}\n"
            f"Candidate Answer: {cleaned_answer}"
        )
        existing.ai_response = feedback
        db.commit()
        db.refresh(existing)

        return PreparationAnswerState(
            id=answer_id,
            question_id=question.id,
            user_id=user_id,
            answer=cleaned_answer,
            feedback=feedback,
            score=_extract_score(feedback),
            created_at=existing.created_at or utc_now(),
        )

    answer_id = new_answer_id()
    record = AIChatHistory(
        user_id=user_id,
        session_id=question.session_id,
        user_message=(
            f"{MOCK_ANSWER_MARKER}\n"
            f"Answer ID: {answer_id}\n"
            f"Question ID: {question.id}\n"
            f"Question Number: {question.question_number}\n"
            f"Candidate Answer: {cleaned_answer}"
        ),
        ai_response=feedback,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return PreparationAnswerState(
        id=answer_id,
        question_id=question.id,
        user_id=user_id,
        answer=cleaned_answer,
        feedback=feedback,
        score=_extract_score(feedback),
        created_at=record.created_at or utc_now(),
    )

def _build_mock_answer_evaluations(
    db: Session,
    question_records: List[AIChatHistory],
    answer_records: List[AIChatHistory],
) -> List[Dict[str, Any]]:
    """Build a reliable question-by-question report.

    Older records may contain only free-form feedback. Those records are
    repaired in memory using the current evaluation parser/AI repair path so
    the report never displays N/A metrics or an unavailable reference answer
    when a real evaluation can be produced.
    """
    question_map: Dict[str, Dict[str, Any]] = {}

    for record in question_records:
        raw = record.user_message or ""
        question_id = _extract_question_id(raw)
        if not question_id:
            continue

        question_match = re.search(
            r"Question:\s*([\s\S]*?)(?:\n|$)", raw, flags=re.IGNORECASE
        )
        number_match = re.search(r"Question Number:\s*(\d+)", raw, flags=re.IGNORECASE)
        metadata = record.ai_response or ""

        def metadata_value(name: str, default: str = "") -> str:
            match = re.search(
                rf"(?:^|\n){re.escape(name)}=(.*?)(?:\n|$)",
                metadata,
                flags=re.IGNORECASE,
            )
            return normalize_text(match.group(1)) if match else default

        question_map[question_id] = {
            "question_id": question_id,
            "question": normalize_text(question_match.group(1)) if question_match else "",
            "question_number": int(number_match.group(1)) if number_match else None,
            "category": metadata_value("category", "Mixed"),
            "difficulty": metadata_value("difficulty", "medium"),
            "target_role": metadata_value("target_role", "Software Engineering Intern"),
            "topic": metadata_value("topic", "General"),
        }

    evaluations: List[Dict[str, Any]] = []
    changed_records = False

    for record in answer_records:
        raw = record.user_message or ""
        question_id = _extract_question_id(raw)
        if not question_id:
            continue

        qmeta = question_map.get(question_id, {})
        number_match = re.search(r"Question Number:\s*(\d+)", raw, flags=re.IGNORECASE)
        answer_match = re.search(
            r"Candidate Answer:\s*([\s\S]*)$",
            raw,
            flags=re.IGNORECASE,
        )
        candidate_answer = normalize_text(answer_match.group(1)) if answer_match else ""
        evaluation_text = normalize_text(record.ai_response)

        question_state = MockInterviewQuestionState(
            id=question_id,
            session_id=record.session_id or "",
            user_id=record.user_id,
            question=qmeta.get("question") or "Interview question",
            category=qmeta.get("category") or "Mixed",
            topic=qmeta.get("topic") or "General",
            difficulty=qmeta.get("difficulty") or "medium",
            target_role=qmeta.get("target_role") or "Software Engineering Intern",
            question_number=int(number_match.group(1)) if number_match else (qmeta.get("question_number") or 1),
            source="ai",
            created_at=record.created_at or utc_now(),
        )

        parsed = _complete_mock_evaluation(
            db=db,
            question=question_state,
            candidate_answer=candidate_answer,
            evaluation_text=evaluation_text,
        )

        # Older mock results may have been stored as 0/10 because the previous
        # evaluator failed to parse the AI response. Re-score those records with
        # the current fast hybrid evaluator so the professional report can repair
        # historical results when the user opens it.
        numeric_values = [parsed.get(k) for k in (
            "score", "correctness", "technical_knowledge", "relevance",
            "completeness", "communication",
        )]
        if candidate_answer and all(
            value is not None and float(value) == 0 for value in numeric_values
        ):
            try:
                repaired = _fast_mock_evaluation(question_state, candidate_answer)
                if repaired.get("score") is not None and float(repaired.get("score")) > 0:
                    parsed = repaired
            except Exception:
                pass

        # Persist the repaired structure so the next report is deterministic.
        normalized_json = json.dumps(parsed, ensure_ascii=False)
        if normalize_text(record.ai_response) != normalized_json:
            record.ai_response = normalized_json
            changed_records = True

        evaluations.append({
            **qmeta,
            "question_id": question_id,
            "question_number": int(number_match.group(1)) if number_match else qmeta.get("question_number"),
            "answer": candidate_answer,
            "score": parsed.get("score"),
            "correctness": parsed.get("correctness"),
            "technical_knowledge": parsed.get("technical_knowledge"),
            "relevance": parsed.get("relevance"),
            "completeness": parsed.get("completeness"),
            "communication": parsed.get("communication"),
            "answer_verdict": parsed.get("answer_verdict"),
            "matched_key_points": parsed.get("matched_key_points", []),
            "missing_or_incorrect_points": parsed.get("missing_or_incorrect_points", []),
            "strengths": parsed.get("strengths", []),
            "improvements": parsed.get("improvements", []),
            "feedback": parsed.get("feedback", ""),
            "reference_answer": parsed.get("reference_answer", ""),
            "ideal_answer": parsed.get("reference_answer", ""),
            "candidate_answer": candidate_answer,
            "evaluation": normalized_json,
            "created_at": record.created_at.isoformat() if record.created_at else None,
        })

    if changed_records:
        db.commit()

    evaluations.sort(key=lambda item: (item.get("question_number") or 9999, item.get("created_at") or ""))
    return evaluations

def complete_mock_interview(
    db: Session,
    user_id: int,
    session_id: str,
) -> Dict[str, Any]:
    """
    Calculate and persist a mock-interview completion summary.
    """
    records = _mock_history(
        db=db,
        user_id=user_id,
        session_id=session_id,
    )

    question_records = [
        record
        for record in records
        if (record.user_message or "").startswith(
            MOCK_QUESTION_MARKER
        )
    ]

    answer_records = [
        record
        for record in records
        if (record.user_message or "").startswith(
            MOCK_ANSWER_MARKER
        )
    ]

    answer_evaluations = _build_mock_answer_evaluations(
        db=db,
        question_records=question_records,
        answer_records=answer_records,
    )
    scores = [
        float(item["score"])
        for item in answer_evaluations
        if item.get("score") is not None
    ]
    average_score = round(sum(scores) / len(scores), 2) if scores else None

    completed_at = utc_now()

    completion_record = AIChatHistory(
        user_id=user_id,
        session_id=session_id,
        user_message=(
            f"{MOCK_INTERVIEW_MARKER}\n"
            "status=completed\n"
            f"questions={len(question_records)}\n"
            f"answers={len(answer_records)}\n"
            f"average_score={average_score}"
        ),
        ai_response=(
            f"Mock interview completed. "
            f"Average score: {average_score if average_score is not None else 'N/A'}/10."
        ),
    )

    db.add(completion_record)
    db.commit()
    db.refresh(completion_record)

    readiness = "not_started"
    if average_score is not None:
        if average_score >= 8:
            readiness = "strong"
        elif average_score >= 6:
            readiness = "developing"
        else:
            readiness = "needs_improvement"

    total_questions = len(question_records)
    total_answers = len(answer_records)
    completion_rate = (
        round((total_answers / total_questions) * 100, 2)
        if total_questions
        else 0.0
    )

    return {
        "session_id": session_id,
        "status": "completed",
        "total_questions": total_questions,
        "total_answers": total_answers,
        "completion_rate": completion_rate,
        "average_score": average_score,
        "readiness": readiness,
        "answer_evaluations": answer_evaluations,
        "completed_at": completed_at.isoformat(),
    }


def get_mock_interview_progress(
    db: Session,
    user_id: int,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Return mock-interview metrics derived entirely from AIChatHistory.
    """
    records = (
        _mock_history(
            db=db,
            user_id=user_id,
            session_id=session_id,
        )
        if session_id
        else _mock_history(
            db=db,
            user_id=user_id,
        )
    )

    question_records = [
        record
        for record in records
        if (record.user_message or "").startswith(
            MOCK_QUESTION_MARKER
        )
    ]

    answer_records = [
        record
        for record in records
        if (record.user_message or "").startswith(
            MOCK_ANSWER_MARKER
        )
    ]

    answer_evaluations = _build_mock_answer_evaluations(
        db=db,
        question_records=question_records,
        answer_records=answer_records,
    )

    scores = [
        float(item["score"])
        for item in answer_evaluations
        if item.get("score") is not None
    ]

    average_score = round(sum(scores) / len(scores), 2) if scores else None

    topic_scores: Dict[str, List[float]] = {}

    question_topics: Dict[str, str] = {}
    for record in question_records:
        raw = record.user_message or ""
        question_id = _extract_question_id(raw)

        if question_id:
            metadata = record.ai_response or ""
            topic_match = re.search(
                r"topic=(.*)",
                metadata,
                flags=re.IGNORECASE,
            )
            question_topics[question_id] = (
                normalize_text(topic_match.group(1))
                if topic_match
                else "General"
            )

    for record in answer_records:
        raw = record.user_message or ""
        question_id = _extract_question_id(raw)
        topic = question_topics.get(
            question_id or "",
            "General",
        )
        score = _extract_score(record.ai_response or "")

        if score is not None:
            topic_scores.setdefault(topic, []).append(score)

    weak_topics = []
    for topic, topic_values in topic_scores.items():
        if not topic_values:
            continue

        topic_average = round(
            sum(topic_values) / len(topic_values),
            2,
        )

        if topic_average < 7:
            weak_topics.append(
                {
                    "topic": topic,
                    "average_score": topic_average,
                    "attempts": len(topic_values),
                    "priority": (
                        "high"
                        if topic_average < 5
                        else "medium"
                    ),
                }
            )

    weak_topics.sort(
        key=lambda item: (
            item["average_score"],
            -item["attempts"],
        )
    )

    total_questions = len(question_records)
    total_answers = len(answer_records)
    completion_rate = (
        round((total_answers / total_questions) * 100, 2)
        if total_questions
        else 0.0
    )

    return {
        "session_id": session_id,
        "total_questions": total_questions,
        "total_answers": total_answers,
        "completion_rate": completion_rate,
        "average_score": average_score,
        "answer_evaluations": answer_evaluations,
        "weak_topics": weak_topics[:10],
        "completed": any(
            (record.user_message or "").startswith(
                MOCK_INTERVIEW_MARKER
            )
            and "status=completed"
            in (record.user_message or "")
            for record in records
        ),
    }


def get_mock_interview_question(
    db: Session,
    user_id: int,
    question_id: str,
) -> Optional[MockInterviewQuestionState]:
    """
    Recover a mock-interview question from AIChatHistory.
    """
    records = (
        db.query(AIChatHistory)
        .filter(
            AIChatHistory.user_id == user_id,
            AIChatHistory.user_message.like(
                f"{MOCK_QUESTION_MARKER}%"
            ),
        )
        .order_by(
            AIChatHistory.created_at.asc(),
            AIChatHistory.id.asc(),
        )
        .all()
    )

    wanted_id = normalize_text(question_id)

    for record in records:
        raw = record.user_message or ""

        id_match = re.search(
            r"Question ID:\s*([A-Za-z0-9_.-]+)",
            raw,
            flags=re.IGNORECASE,
        )

        if not id_match or id_match.group(1) != wanted_id:
            continue

        number_match = re.search(
            r"Question Number:\s*(\d+)",
            raw,
            flags=re.IGNORECASE,
        )

        question_match = re.search(
            r"Question:\s*(.*?)(?:\n|$)",
            raw,
            flags=re.IGNORECASE | re.DOTALL,
        )

        metadata = record.ai_response or ""

        def _metadata_value(
            key: str,
            default: str,
        ) -> str:
            match = re.search(
                rf"^{re.escape(key)}=(.*)$",
                metadata,
                flags=re.IGNORECASE | re.MULTILINE,
            )
            return (
                normalize_text(match.group(1))
                if match
                else default
            )

        return MockInterviewQuestionState(
            id=wanted_id,
            session_id=record.session_id,
            user_id=user_id,
            question=(
                normalize_text(question_match.group(1))
                if question_match
                else ""
            ),
            category=_metadata_value(
                "category",
                "Mixed",
            ),
            topic=_metadata_value(
                "topic",
                "General",
            ),
            difficulty=_metadata_value(
                "difficulty",
                "medium",
            ),
            target_role=_metadata_value(
                "target_role",
                "Software Engineering Intern",
            ),
            question_number=(
                int(number_match.group(1))
                if number_match
                else 1
            ),
            source=_metadata_value(
                "source",
                "ai",
            ),
            created_at=record.created_at or utc_now(),
        )

    return None



# =========================================================
# PREPARATION OVERVIEW
# =========================================================



# ============================================================
# PHASE 2 — STEP 10: VOICE INTERVIEW
# ============================================================
#
# Architecture:
# - No new database tables/models.
# - Browser/frontend performs speech-to-text.
# - Backend receives the transcript as plain text.
# - AIChatHistory stores the voice interview question,
#   transcript, evaluation, and completion metadata.
# - Resume/profile/internship context is reused from Steps 1–9.
# - Questions are generated one at a time and previous voice
#   questions are excluded to reduce repetition.
# - Audio is intentionally NOT stored by the backend.
#

VOICE_INTERVIEW_MARKER = "[PREPARATION_VOICE_INTERVIEW]"
VOICE_QUESTION_MARKER = "[PREPARATION_VOICE_QUESTION]"
VOICE_ANSWER_MARKER = "[PREPARATION_VOICE_ANSWER]"


@dataclass
class VoiceInterviewQuestionState:
    question_id: str
    interview_id: str
    question: str
    category: str
    difficulty: str
    target_role: str
    question_number: int
    total_questions: int = 10


def new_voice_interview_id() -> str:
    return f"voice_interview_{uuid4().hex}"


def new_voice_question_id() -> str:
    return f"voice_question_{uuid4().hex}"


def _voice_history(db: Session, user_id: int, interview_id: str):
    return (
        db.query(AIChatHistory)
        .filter(
            AIChatHistory.user_id == user_id,
            AIChatHistory.session_id == interview_id,
        )
        .order_by(AIChatHistory.created_at.asc(), AIChatHistory.id.asc())
        .all()
    )


def _voice_question_history(db: Session, user_id: int, interview_id: str):
    return [
        item
        for item in _voice_history(db, user_id, interview_id)
        if VOICE_QUESTION_MARKER in (item.user_message or "")
    ]


def _voice_answer_history(db: Session, user_id: int, interview_id: str):
    return [
        item
        for item in _voice_history(db, user_id, interview_id)
        if VOICE_ANSWER_MARKER in (item.user_message or "")
    ]


def _clean_voice_question(value: str) -> str:
    text = str(value or "").strip()

    text = re.sub(
        r"^\s*(question|q)\s*[:\-]\s*",
        "",
        text,
        flags=re.IGNORECASE,
    )

    text = re.sub(
        r"^\s*\d+[\.\):\-]\s*",
        "",
        text,
    )

    text = text.replace("```", "").strip()
    return text


def _voice_previous_questions(
    db: Session,
    user_id: int,
    interview_id: str,
) -> List[str]:
    questions: List[str] = []

    for item in _voice_question_history(db, user_id, interview_id):
        raw = item.user_message or ""
        match = re.search(
            r"question=(.*?)(?:\s*\|\s*category=|\s*\|\s*difficulty=|$)",
            raw,
            flags=re.IGNORECASE,
        )
        if match:
            question = _clean_voice_question(match.group(1))
        else:
            question = _clean_voice_question(raw)

        if question:
            questions.append(question)

    return questions


def create_voice_interview_session(
    user_id: int,
    target_role: str = "Software Engineering Intern",
    difficulty: str = "medium",
    category: str = "mixed",
    total_questions: int = 10,
) -> Dict[str, Any]:
    """Create frontend/session state only.

    Deliberately does not create a SQL table row.
    """
    safe_total = max(1, min(int(total_questions or 10), 30))

    return {
        "interview_id": new_voice_interview_id(),
        "user_id": user_id,
        "target_role": target_role or "Software Engineering Intern",
        "difficulty": difficulty or "medium",
        "category": category or "mixed",
        "total_questions": safe_total,
        "question_number": 0,
        "completed": False,
    }


def build_voice_interview_prompt(
    candidate: Dict[str, Any],
    target_role: str,
    category: str,
    difficulty: str,
    previous_questions: List[str],
    question_number: int,
    total_questions: int,
) -> str:
    profile = candidate.get("profile") or {}
    resume = candidate.get("resume") or {}
    internships = candidate.get("internships") or []

    resume_context = json.dumps(
        {
            "full_name": profile.get("full_name"),
            "professional_summary": profile.get("professional_summary"),
            "skills": profile.get("skills"),
            "technical_skills": profile.get("technical_skills"),
            "soft_skills": profile.get("soft_skills"),
            "education": profile.get("education"),
            "work_experience": profile.get("work_experience"),
            "projects": profile.get("projects"),
            "certifications": profile.get("certifications"),
            "internships": profile.get("internships"),
            "resume_file": resume.get("file_name"),
        },
        ensure_ascii=False,
    )

    internship_context = json.dumps(
        internships[:5],
        ensure_ascii=False,
    )

    previous_text = "\n".join(
        f"- {question}" for question in previous_questions[-30:]
    )

    return f"""
You are conducting a professional voice interview for an internship candidate.

Interview position:
- Question {question_number} of {total_questions}
- Target role: {target_role}
- Category: {category}
- Difficulty: {difficulty}

Candidate resume/profile:
{resume_context}

Relevant internship opportunities:
{internship_context}

Previously asked voice-interview questions:
{previous_text or "- None"}

Rules:
1. Ask exactly ONE interview question.
2. Do not repeat or closely paraphrase any previous question.
3. Personalize the question using genuine resume/profile evidence when useful.
4. Never invent candidate experience, skills, projects, employers, education, or achievements.
5. If resume evidence is insufficient, ask a role-relevant question without inventing facts.
6. Keep the question natural for spoken conversation.
7. Do not provide an answer, hints, explanation, grading, or multiple questions.
8. For mixed interviews, balance technical, behavioral, project, HR, and situational questions.
9. Make the difficulty appropriate for the requested level.
10. Return only the question text.

Generate the next voice-interview question now.
""".strip()


def generate_voice_interview_question(
    db: Session,
    user_id: int,
    interview_id: str,
    candidate: Dict[str, Any],
    target_role: str = "Software Engineering Intern",
    category: str = "mixed",
    difficulty: str = "medium",
    question_number: int = 1,
    total_questions: int = 10,
) -> VoiceInterviewQuestionState:
    previous_questions = _voice_previous_questions(
        db,
        user_id,
        interview_id,
    )

    prompt = build_voice_interview_prompt(
        candidate=candidate,
        target_role=target_role,
        category=category,
        difficulty=difficulty,
        previous_questions=previous_questions,
        question_number=question_number,
        total_questions=total_questions,
    )

    generated = ""
    try:
        generated = generate_ai_response(prompt)
    except Exception:
        generated = ""

    question = _clean_voice_question(generated)

    # Safe deterministic fallback if the model is unavailable.
    if not question:
        fallback_questions = [
            f"Tell me about a project that demonstrates your skills for a {target_role} role.",
            f"What is one technical challenge you faced in a project, and how did you solve it?",
            f"Why are you interested in working as a {target_role}?",
            "Describe a situation where you had to learn something quickly.",
            "How would you approach debugging a problem you had never seen before?",
            "Tell me about a time you received difficult feedback and how you responded.",
            "What part of your technical skill set would you most like to improve?",
            "How do you decide which approach to use when solving a programming problem?",
            "Describe how you would explain a technical concept to a non-technical teammate.",
            "What would you do if you disagreed with a teammate about an implementation decision?",
        ]

        index = max(0, (question_number - 1) % len(fallback_questions))
        question = fallback_questions[index]

    # A lightweight duplicate guard for model outputs.
    previous_normalized = {
        re.sub(r"[^a-z0-9]+", " ", q.lower()).strip()
        for q in previous_questions
    }
    normalized = re.sub(
        r"[^a-z0-9]+",
        " ",
        question.lower(),
    ).strip()

    if normalized in previous_normalized:
        fallback = (
            "Describe a different technical or project experience "
            "that is relevant to this role."
        )
        if fallback.lower() not in previous_normalized:
            question = fallback

    question_id = new_voice_question_id()

    metadata = (
        f"{VOICE_QUESTION_MARKER} "
        f"question_id={question_id} | "
        f"question={question} | "
        f"category={category} | "
        f"difficulty={difficulty} | "
        f"target_role={target_role} | "
        f"question_number={question_number} | "
        f"total_questions={total_questions}"
    )

    db.add(
        AIChatHistory(
            user_id=user_id,
            session_id=interview_id,
            user_message=metadata,
            ai_response=question,
        )
    )
    db.commit()

    return VoiceInterviewQuestionState(
        question_id=question_id,
        interview_id=interview_id,
        question=question,
        category=category,
        difficulty=difficulty,
        target_role=target_role,
        question_number=question_number,
        total_questions=total_questions,
    )


def build_voice_answer_evaluation_prompt(
    candidate: Dict[str, Any],
    question: str,
    transcript: str,
    target_role: str,
    category: str,
    difficulty: str,
) -> str:
    """Build a compact prompt for low-latency live evaluation.

    The full resume/profile is intentionally not sent here. The evaluator
    only needs the role, question, and spoken answer to judge the response.
    Keeping the prompt small reduces input latency and token usage.
    """
    return f"""
Evaluate this interview answer quickly and objectively.

Role: {target_role}
Category: {category}
Difficulty: {difficulty}
Question: {question}
Candidate answer: {transcript}

Ignore accent, filler words, and minor speech-to-text errors. Judge only the
meaning and technical/behavioral quality of the answer.

Return ONLY this compact format:
Score: X/10
Correctness: one short sentence
Technical Knowledge: one short sentence
Relevance: one short sentence
Completeness: one short sentence
Communication: one short sentence
What Was Good: one or two short points
What Needs Improvement: one or two short points
Ideal Answer: 2-3 concise sentences
""".strip()


def evaluate_voice_interview_answer(
    candidate: Dict[str, Any],
    question: str,
    transcript: str,
    target_role: str = "Software Engineering Intern",
    category: str = "mixed",
    difficulty: str = "medium",
) -> Dict[str, Any]:
    transcript = str(transcript or "").strip()
    question = str(question or "").strip()

    if not transcript:
        return {
            "score": 0.0,
            "evaluation": (
                "Score: 0/10\n\n"
                "Correctness: No answer was provided.\n"
                "Technical Knowledge: Not assessable.\n"
                "Relevance: Not assessable.\n"
                "Completeness: No response to evaluate.\n"
                "Communication: No spoken transcript was received.\n\n"
                "What Was Good:\n"
                "1. The question was presented for practice.\n"
                "2. A response can be attempted again.\n\n"
                "What Needs Improvement:\n"
                "1. Provide a spoken answer before submitting.\n"
                "2. Address the question directly.\n\n"
                "Ideal Answer:\n"
                "Give a concise answer that directly addresses the question "
                "and supports it with a relevant example when appropriate."
            ),
            "transcript": "",
        }

    prompt = build_voice_answer_evaluation_prompt(
        candidate=candidate,
        question=question,
        transcript=transcript,
        target_role=target_role,
        category=category,
        difficulty=difficulty,
    )

    evaluation = ""
    try:
        evaluation = generate_fast_ai_response(prompt)
    except Exception:
        evaluation = ""

    evaluation = str(evaluation or "").strip()

    if not evaluation:
        evaluation = (
            "Score: 5/10\n\n"
            "Correctness: The answer was received, but automated detailed "
            "evaluation is temporarily unavailable.\n"
            "Technical Knowledge: Review the core concept and supporting details.\n"
            "Relevance: Make sure the response directly addresses the question.\n"
            "Completeness: Add reasoning, examples, or steps where appropriate.\n"
            "Communication: Keep the spoken response structured and concise.\n\n"
            "What Was Good:\n"
            "1. You attempted the question.\n"
            "2. Your response was captured successfully.\n\n"
            "What Needs Improvement:\n"
            "1. Give a more structured response.\n"
            "2. Support the answer with accurate details or an example.\n\n"
            "Ideal Answer:\n"
            "Start with the direct answer, explain the key reasoning, "
            "and finish with a relevant example when useful."
        )

    score_match = re.search(
        r"Score\s*:\s*(\d+(?:\.\d+)?)\s*/\s*10",
        evaluation,
        flags=re.IGNORECASE,
    )

    try:
        score = float(score_match.group(1)) if score_match else 0.0
    except (TypeError, ValueError):
        score = 0.0

    score = max(0.0, min(10.0, score))

    return {
        "score": score,
        "evaluation": evaluation,
        "transcript": transcript,
    }


def save_voice_interview_answer(
    db: Session,
    user_id: int,
    interview_id: str,
    question_id: str,
    question: str,
    transcript: str,
    evaluation: Dict[str, Any],
    question_number: int = 1,
    total_questions: int = 10,
) -> Dict[str, Any]:
    score = float(evaluation.get("score") or 0.0)

    # Persist the COMPLETE structured evaluation.  The previous implementation
    # stored only one free-form text field, which meant the final report could
    # not reliably reconstruct correctness/technical knowledge/relevance/etc.
    normalized_evaluation = dict(evaluation or {})
    normalized_evaluation["score"] = score
    evaluation_text = json.dumps(
        normalized_evaluation,
        ensure_ascii=False,
    )

    metadata = (
        f"{VOICE_ANSWER_MARKER} "
        f"question_id={question_id} | "
        f"question_number={question_number} | "
        f"total_questions={total_questions} | "
        f"score={score:g} | "
        f"question={question} | "
        f"transcript={transcript}"
    )

    # Upsert by question_id so clicking save/evaluate twice cannot create
    # duplicate answers and inflate the final score.
    existing = None
    for item in _voice_answer_history(db, user_id, interview_id):
        raw = item.user_message or ""
        match = re.search(
            r"question_id=([^|\s]+)",
            raw,
            flags=re.IGNORECASE,
        )
        if match and match.group(1) == question_id:
            existing = item
            break

    if existing is not None:
        existing.user_message = metadata
        existing.ai_response = evaluation_text
        db.commit()
        db.refresh(existing)
    else:
        db.add(
            AIChatHistory(
                user_id=user_id,
                session_id=interview_id,
                user_message=metadata,
                ai_response=evaluation_text,
            )
        )
        db.commit()

    return {
        "question_id": question_id,
        "score": score,
        "evaluation": normalized_evaluation,
        "transcript": transcript,
        "question": question,
        "question_number": question_number,
    }


def complete_voice_interview(
    db: Session,
    user_id: int,
    interview_id: str,
    total_questions: int = 10,
) -> Dict[str, Any]:
    answers = _voice_answer_history(
        db,
        user_id,
        interview_id,
    )

    # Latest answer per question only.
    unique_answers: Dict[str, AIChatHistory] = {}
    for item in answers:
        match = re.search(
            r"question_id=([^|\s]+)",
            item.user_message or "",
            flags=re.IGNORECASE,
        )
        if match:
            unique_answers[match.group(1)] = item
    answers = list(unique_answers.values())

    scores: List[float] = []

    for item in answers:
        match = re.search(
            r"score=(\d+(?:\.\d+)?)",
            item.user_message or "",
            flags=re.IGNORECASE,
        )
        if match:
            try:
                scores.append(float(match.group(1)))
            except ValueError:
                pass

    average_score = (
        round(sum(scores) / len(scores), 2)
        if scores
        else None
    )

    completed = len(answers)

    completion_marker = (
        f"{VOICE_INTERVIEW_MARKER} completed "
        f"total_questions={total_questions} "
        f"answered_questions={completed} "
        f"average_score={average_score if average_score is not None else 'null'}"
    )

    db.add(
        AIChatHistory(
            user_id=user_id,
            session_id=interview_id,
            user_message=completion_marker,
            ai_response="Voice interview completed.",
        )
    )
    db.commit()

    return {
        "interview_id": interview_id,
        "completed": True,
        "total_questions": int(total_questions or 0),
        "answered_questions": completed,
        "average_score": average_score,
    }


def get_voice_interview_progress(
    db: Session,
    user_id: int,
    interview_id: str,
) -> Dict[str, Any]:
    answers = _voice_answer_history(
        db,
        user_id,
        interview_id,
    )

    questions = _voice_question_history(
        db,
        user_id,
        interview_id,
    )

    # De-duplicate by question id (latest saved answer wins).
    answer_map: Dict[str, AIChatHistory] = {}
    for item in answers:
        match = re.search(
            r"question_id=([^|\s]+)",
            item.user_message or "",
            flags=re.IGNORECASE,
        )
        if match:
            answer_map[match.group(1)] = item

    answers = list(answer_map.values())

    question_map: Dict[str, AIChatHistory] = {}
    for item in questions:
        match = re.search(
            r"question_id=([^|\s]+)",
            item.user_message or "",
            flags=re.IGNORECASE,
        )
        if match:
            question_map[match.group(1)] = item
    questions = list(question_map.values())

    scores: List[float] = []
    report_answers: List[Dict[str, Any]] = []

    for item in answers:
        raw = item.user_message or ""
        score_match = re.search(
            r"score=(\d+(?:\.\d+)?)",
            raw,
            flags=re.IGNORECASE,
        )
        score = None
        if score_match:
            try:
                score = float(score_match.group(1))
                scores.append(score)
            except ValueError:
                score = None

        def field(name: str) -> str:
            match = re.search(
                rf"{re.escape(name)}=(.*?)(?:\s*\|\s*\w+=|$)",
                raw,
                flags=re.IGNORECASE | re.DOTALL,
            )
            return match.group(1).strip() if match else ""

        qid = field("question_id")
        qnumber = field("question_number")
        transcript = field("transcript")
        question_text = field("question")

        evaluation_payload: Dict[str, Any] = {}
        try:
            parsed = json.loads(item.ai_response or "")
            if isinstance(parsed, dict):
                evaluation_payload = parsed
        except (TypeError, ValueError, json.JSONDecodeError):
            evaluation_payload = {
                "evaluation": item.ai_response or "",
                "feedback": item.ai_response or "",
            }

        report_answers.append({
            "question_id": qid,
            "question_number": int(qnumber) if qnumber.isdigit() else 1,
            "question": question_text,
            "transcript": transcript,
            "score": score if score is not None else evaluation_payload.get("score"),
            "evaluation": evaluation_payload,
        })

    report_answers.sort(
        key=lambda item: item.get("question_number") or 9999
    )

    average_score = (
        round(sum(scores) / len(scores), 2)
        if scores
        else None
    )

    return {
        "interview_id": interview_id,
        "question_count": len(questions),
        "answered_count": len(answers),
        "average_score": average_score,
        "answers": report_answers,
        "completed": any(
            VOICE_INTERVIEW_MARKER in (item.user_message or "")
            and "completed" in (item.user_message or "").lower()
            for item in _voice_history(
                db,
                user_id,
                interview_id,
            )
        ),
    }


def get_voice_interview_question(
    db: Session,
    user_id: int,
    interview_id: str,
    question_id: str,
) -> Optional[VoiceInterviewQuestionState]:
    for item in _voice_question_history(
        db,
        user_id,
        interview_id,
    ):
        raw = item.user_message or ""

        id_match = re.search(
            r"question_id=([^|\s]+)",
            raw,
            flags=re.IGNORECASE,
        )

        if not id_match or id_match.group(1) != question_id:
            continue

        question_match = re.search(
            r"question=(.*?)(?:\s*\|\s*category=|\s*\|\s*difficulty=|$)",
            raw,
            flags=re.IGNORECASE,
        )

        category_match = re.search(
            r"category=([^|]+)",
            raw,
            flags=re.IGNORECASE,
        )

        difficulty_match = re.search(
            r"difficulty=([^|]+)",
            raw,
            flags=re.IGNORECASE,
        )

        role_match = re.search(
            r"target_role=([^|]+)",
            raw,
            flags=re.IGNORECASE,
        )

        number_match = re.search(
            r"question_number=(\d+)",
            raw,
            flags=re.IGNORECASE,
        )

        total_match = re.search(
            r"total_questions=(\d+)",
            raw,
            flags=re.IGNORECASE,
        )

        return VoiceInterviewQuestionState(
            question_id=question_id,
            interview_id=interview_id,
            question=_clean_voice_question(
                question_match.group(1)
                if question_match
                else item.ai_response
            ),
            category=(
                category_match.group(1).strip()
                if category_match
                else "mixed"
            ),
            difficulty=(
                difficulty_match.group(1).strip()
                if difficulty_match
                else "medium"
            ),
            target_role=(
                role_match.group(1).strip()
                if role_match
                else "Software Engineering Intern"
            ),
            question_number=(
                int(number_match.group(1))
                if number_match
                else 1
            ),
            total_questions=(
                int(total_match.group(1))
                if total_match
                else 10
            ),
        )

    return None



def get_ai_learning_recommendations(
    db: Session,
    user_id: int,
) -> Dict[str, Any]:
    """
    Generate personalized learning recommendations from the candidate's
    existing preparation data.

    This is read-only intelligence: it does not create or modify database
    records. The AI receives a compact, authoritative snapshot of the
    candidate profile, measured topic performance, weak topics, and role gaps.
    """
    candidate = build_candidate_profile(
        db=db,
        user_id=user_id,
    )

    roles = recommend_roles(
        db=db,
        user_id=user_id,
    )[:3]

    preparation_profile = build_preparation_profile(
        candidate=candidate,
        role_recommendations=roles,
    )

    roadmap = build_preparation_roadmap(
        db=db,
        user_id=user_id,
        candidate=candidate,
        role_recommendations=roles,
    )

    progress = build_preparation_progress(
        db=db,
        user_id=user_id,
    )

    topic_progress = progress.get("topic_progress") or []
    weak_topics = roadmap.get("weak_topics") or []
    role_name = (
        normalize_text(preparation_profile.get("target_role"))
        or "Software Engineering Intern"
    )

    compact_topic_progress = [
        {
            "topic": normalize_text(item.get("name") or item.get("topic")),
            "average_score": item.get("average_score"),
            "attempts": item.get("attempts", 0),
        }
        for item in topic_progress[:12]
        if normalize_text(item.get("name") or item.get("topic"))
    ]

    compact_weak_topics = [
        {
            "topic": normalize_text(item.get("topic")),
            "priority": normalize_text(item.get("priority")) or "medium",
            "average_score": item.get("average_score"),
            "attempts": item.get("attempts", 0),
            "reason": normalize_text(item.get("reason")),
        }
        for item in weak_topics[:10]
        if normalize_text(item.get("topic"))
    ]

    role_gaps = unique_strings(
        preparation_profile.get("missing_skills") or []
    )[:12]

    resume_skills = unique_strings(
        preparation_profile.get("technical_skills")
        or preparation_profile.get("skills")
        or []
    )[:16]

    focus_topics = unique_strings(
        preparation_profile.get("focus_topics") or []
    )[:12]

    payload = {
        "target_role": role_name,
        "experience_level": preparation_profile.get("experience_level"),
        "estimated_experience_years": preparation_profile.get(
            "estimated_experience_years"
        ),
        "resume_skills": resume_skills,
        "role_gaps": role_gaps,
        "focus_topics": focus_topics,
        "topic_performance": compact_topic_progress,
        "weak_topics": compact_weak_topics,
        "overall_average_score": progress.get("average_score"),
        "recent_average_score": progress.get("recent_average_score"),
        "previous_average_score": progress.get("previous_average_score"),
        "trend": progress.get("trend"),
        "readiness": progress.get("readiness"),
    }

    prompt = f"""
You are the learning-planning component of InternMatch AI.

Create a practical interview-preparation recommendation for this candidate.
Use ONLY the supplied candidate data. Do not invent scores, skills, roles,
experience, completed topics, or facts.

Candidate data:
{json.dumps(payload, ensure_ascii=False, default=str)}

Return ONLY valid JSON with this exact top-level structure:
{{
  "headline": "short personalized headline",
  "summary": "2 concise sentences explaining the most important focus",
  "priority_topic": "the single highest-priority topic from supplied data",
  "recommendations": [
    {{
      "topic": "topic name",
      "priority": "high|medium|low",
      "reason": "why this topic should be studied now",
      "action": "specific learning/practice action",
      "difficulty": "easy|medium|hard",
      "practice_count": 5
    }}
  ],
  "strong_topics": ["topic names that are already strong, if supported"],
  "daily_plan": [
    {{
      "day": "Day 1",
      "focus": "topic",
      "tasks": ["task 1", "task 2"]
    }}
  ]
}}

Rules:
- Return 3 to 5 recommendations.
- Put measured weak topics before unmeasured role gaps when both are available.
- If a measured topic is below 5/10, recommend fundamentals and easy/medium practice.
- If a measured topic is 5/10 to below 7.5/10, recommend medium practice and application.
- If a measured topic is 7.5/10 or higher, treat it as a strength and recommend maintenance/harder practice.
- Unmeasured role gaps may be recommended as learning priorities, but never describe them as low-scoring.
- Use the candidate's target role and resume skills to make recommendations relevant.
- Keep practice_count between 3 and 10.
- The daily plan should contain 3 to 5 days.
- Do not include Markdown, code fences, commentary, or extra keys.
""".strip()

    ai_text = ""
    try:
        ai_text = generate_fast_ai_response(prompt)
    except Exception:
        ai_text = ""

    parsed: Dict[str, Any] = {}

    if ai_text:
        cleaned = normalize_text(ai_text)
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        try:
            candidate_json = json.loads(cleaned)
            if isinstance(candidate_json, dict):
                parsed = candidate_json
        except (TypeError, ValueError, json.JSONDecodeError):
            match = re.search(r"\{[\s\S]*\}", cleaned)
            if match:
                try:
                    candidate_json = json.loads(match.group(0))
                    if isinstance(candidate_json, dict):
                        parsed = candidate_json
                except (TypeError, ValueError, json.JSONDecodeError):
                    parsed = {}

    # Deterministic fallback keeps the dashboard useful if the AI service is
    # temporarily unavailable or returns malformed JSON.
    if not parsed:
        fallback_recommendations: List[Dict[str, Any]] = []

        for item in compact_weak_topics[:5]:
            score = item.get("average_score")
            numeric_score = (
                float(score) if score is not None else None
            )

            if numeric_score is not None and numeric_score < 5:
                difficulty = "easy"
                action = (
                    f"Review the fundamentals of {item['topic']} and "
                    "complete 5 easy questions before moving up."
                )
            elif numeric_score is not None and numeric_score < 7.5:
                difficulty = "medium"
                action = (
                    f"Review missed concepts in {item['topic']} and "
                    "complete 5 medium questions with practical examples."
                )
            else:
                difficulty = "hard"
                action = (
                    f"Maintain {item['topic']} with 3 harder interview "
                    "questions and one project-based example."
                )

            fallback_recommendations.append(
                {
                    "topic": item["topic"],
                    "priority": item.get("priority") or "medium",
                    "reason": item.get("reason")
                    or "This area should receive more preparation focus.",
                    "action": action,
                    "difficulty": difficulty,
                    "practice_count": 5,
                }
            )

        existing = {
            normalize_text(item["topic"]).lower()
            for item in fallback_recommendations
        }

        for gap in role_gaps:
            if gap.lower() in existing:
                continue
            fallback_recommendations.append(
                {
                    "topic": gap,
                    "priority": "medium",
                    "reason": (
                        "This skill is part of the role-aligned gap in "
                        "the current candidate profile."
                    ),
                    "action": (
                        f"Learn the core concepts of {gap} and complete "
                        "3 role-relevant interview questions."
                    ),
                    "difficulty": "medium",
                    "practice_count": 3,
                }
            )
            existing.add(gap.lower())

        if not fallback_recommendations:
            for topic in focus_topics[:5]:
                fallback_recommendations.append(
                    {
                        "topic": topic,
                        "priority": "medium",
                        "reason": (
                            "This is a resume-backed focus topic for "
                            "the selected preparation role."
                        ),
                        "action": (
                            f"Review {topic} and practice 3 role-relevant "
                            "interview questions."
                        ),
                        "difficulty": "medium",
                        "practice_count": 3,
                    }
                )

        parsed = {
            "headline": f"Your next focus for {role_name}",
            "summary": (
                "These recommendations are based on your current preparation "
                "performance, role requirements and resume profile."
            ),
            "priority_topic": (
                fallback_recommendations[0]["topic"]
                if fallback_recommendations
                else "Interview Fundamentals"
            ),
            "recommendations": fallback_recommendations[:5],
            "strong_topics": [
                item["topic"]
                for item in compact_topic_progress
                if item.get("average_score") is not None
                and float(item["average_score"]) >= 7.5
            ][:5],
            "daily_plan": [
                {
                    "day": f"Day {index}",
                    "focus": item["topic"],
                    "tasks": [
                        f"Review core concepts of {item['topic']}",
                        f"Practice {min(int(item.get('practice_count', 5)), 5)} questions",
                    ],
                }
                for index, item in enumerate(
                    fallback_recommendations[:5],
                    start=1,
                )
            ],
        }

    recommendations = parsed.get("recommendations")
    if not isinstance(recommendations, list):
        recommendations = []

    normalized_recommendations: List[Dict[str, Any]] = []
    for item in recommendations[:5]:
        if not isinstance(item, dict):
            continue

        topic = normalize_text(
            item.get("topic")
            or item.get("name")
            or item.get("title")
        )
        if not topic:
            continue

        priority = normalize_text(item.get("priority")).lower()
        if priority not in {"high", "medium", "low"}:
            priority = "medium"

        difficulty = normalize_text(item.get("difficulty")).lower()
        if difficulty not in {"easy", "medium", "hard"}:
            difficulty = "medium"

        try:
            practice_count = int(item.get("practice_count", 5))
        except (TypeError, ValueError):
            practice_count = 5

        normalized_recommendations.append(
            {
                "topic": topic,
                "priority": priority,
                "reason": normalize_text(item.get("reason"))
                or "Recommended from your preparation profile.",
                "action": normalize_text(item.get("action"))
                or f"Practice {topic} with role-relevant interview questions.",
                "difficulty": difficulty,
                "practice_count": max(3, min(practice_count, 10)),
            }
        )

    if not normalized_recommendations:
        normalized_recommendations = [
            {
                "topic": item["topic"],
                "priority": item.get("priority", "medium"),
                "reason": item.get("reason")
                or "Recommended from your preparation profile.",
                "action": item.get("action")
                or f"Practice {item['topic']} with role-relevant questions.",
                "difficulty": item.get("difficulty", "medium"),
                "practice_count": item.get("practice_count", 5),
            }
            for item in (parsed.get("recommendations") or [])[:5]
            if isinstance(item, dict) and normalize_text(item.get("topic"))
        ]

    strong_topics = [
        normalize_text(item)
        for item in (
            parsed.get("strong_topics")
            if isinstance(parsed.get("strong_topics"), list)
            else []
        )
        if normalize_text(item)
    ][:5]

    daily_plan = []
    raw_daily_plan = parsed.get("daily_plan")
    if isinstance(raw_daily_plan, list):
        for item in raw_daily_plan[:5]:
            if not isinstance(item, dict):
                continue
            day = normalize_text(item.get("day")) or f"Day {len(daily_plan) + 1}"
            focus = normalize_text(item.get("focus"))
            tasks = normalize_list(item.get("tasks"))[:4]
            if focus or tasks:
                daily_plan.append(
                    {
                        "day": day,
                        "focus": focus or "Interview preparation",
                        "tasks": tasks,
                    }
                )

    if not daily_plan:
        for index, item in enumerate(
            normalized_recommendations[:5],
            start=1,
        ):
            daily_plan.append(
                {
                    "day": f"Day {index}",
                    "focus": item["topic"],
                    "tasks": [
                        f"Review {item['topic']}",
                        f"Complete {item['practice_count']} {item['difficulty']} questions",
                    ],
                }
            )

    priority_topic = normalize_text(parsed.get("priority_topic"))
    if not priority_topic and normalized_recommendations:
        priority_topic = normalized_recommendations[0]["topic"]

    return {
        "headline": normalize_text(parsed.get("headline"))
        or "Your AI learning recommendations",
        "summary": normalize_text(parsed.get("summary"))
        or (
            "Focus on the areas that will have the biggest impact on "
            "your interview readiness."
        ),
        "priority_topic": priority_topic or "Interview Fundamentals",
        "recommendations": normalized_recommendations,
        "strong_topics": unique_strings(strong_topics),
        "daily_plan": daily_plan,
        "based_on": {
            "target_role": role_name,
            "experience_level": preparation_profile.get("experience_level"),
            "measured_topics": len(compact_topic_progress),
            "weak_topics": len(compact_weak_topics),
            "resume_skills": resume_skills,
            "role_gaps": role_gaps,
            "overall_average_score": progress.get("average_score"),
            "trend": progress.get("trend"),
        },
    }


def get_preparation_overview(
    db: Session,
    user_id: int,
) -> Dict[str, Any]:
    preparation_records = (
        db.query(AIChatHistory)
        .filter(
            and_(
                AIChatHistory.user_id == user_id,
                AIChatHistory.session_id.like(
                    f"{PRACTICE_SESSION_PREFIX}%"
                ),
            )
        )
        .order_by(
            AIChatHistory.created_at.asc(),
            AIChatHistory.id.asc(),
        )
        .all()
    )

    session_ids = sorted(
        {
            record.session_id
            for record in preparation_records
            if record.session_id
        }
    )

    total_sessions = len(session_ids)

    completed_sessions = sum(
        1
        for session_id in session_ids
        if any(
            (record.user_message or "").startswith(
                SESSION_MARKER
            )
            and "status=completed"
            in (record.user_message or "")
            for record in preparation_records
            if record.session_id == session_id
        )
    )

    total_questions = sum(
        1
        for record in preparation_records
        if (record.user_message or "").startswith(
            QUESTION_MARKER
        )
    )

    total_answers = sum(
        1
        for record in preparation_records
        if (record.user_message or "").startswith(
            ANSWER_MARKER
        )
    )

    scores = [
        score
        for record in preparation_records
        if (record.user_message or "").startswith(
            ANSWER_MARKER
        )
        for score in [
            _extract_score(
                record.ai_response or ""
            )
        ]
        if score is not None
    ]

    average_score = (
        round(sum(scores) / len(scores), 2)
        if scores
        else None
    )

    candidate = build_candidate_profile(
        db=db,
        user_id=user_id,
    )

    roles = recommend_roles(
        db=db,
        user_id=user_id,
    )[:3]

    internships = recommend_internships(
        db=db,
        user_id=user_id,
        limit=5,
    )

    personalization = build_resume_personalization(
        candidate=candidate,
        role_recommendations=roles,
    )

    preparation_profile = build_preparation_profile(
        candidate=candidate,
        role_recommendations=roles,
    )

    roadmap_data = build_preparation_roadmap(
        db=db,
        user_id=user_id,
        candidate=candidate,
        role_recommendations=roles,
    )

    internship_preparation = build_internship_preparation(
        db=db,
        user_id=user_id,
        internships=internships,
        limit=5,
    )

    progress = build_preparation_progress(
        db=db,
        user_id=user_id,
    )

    return {
        "resume_analyzed": bool(
            candidate.get("profile")
        ),
        "candidate": {
            **candidate,
            "personalization": personalization,
            "preparation_profile": preparation_profile,
        },
        "preparation_profile": preparation_profile,
        "personalization": personalization,
        "roadmap": roadmap_data,
        "weak_topics": roadmap_data["weak_topics"],
        "progress": progress,
        "internship_preparation": internship_preparation,
        "mock_interview": {
            "available": bool(candidate.get("profile")),
            "recommended_role": (
                roles[0].get("role")
                if roles
                else "Software Engineering Intern"
            ),
            "recommended_difficulty": (
                "medium"
                if progress.get("average_score") is None
                else (
                    "easy"
                    if progress.get("average_score", 0) < 5
                    else (
                        "medium"
                        if progress.get("average_score", 0) < 8
                        else "hard"
                    )
                )
            ),
            "question_count": 10,
        },
        "recommended_roles": roles,
        "recommended_internships": internships,
        "total_sessions": total_sessions,
        "completed_sessions": completed_sessions,
        "total_questions": total_questions,
        "total_answers": total_answers,
        "average_score": average_score,
    }


# =========================================================
# OPTIONAL HELPER:
# GET A QUESTION FROM PERSISTED HISTORY
# =========================================================

def get_preparation_question(
    db: Session,
    user_id: int,
    question_id: str,
) -> Optional[PreparationQuestionState]:
    return _find_question_by_id(
        db=db,
        user_id=user_id,
        question_id=question_id,
    )


# =========================================================
# OPTIONAL HELPER:
# GET PRACTICE ANSWERS FOR A SESSION
# =========================================================

def get_preparation_answers(
    db: Session,
    user_id: int,
    session_id: str,
) -> List[PreparationAnswerState]:
    records = _answer_records(
        db=db,
        user_id=user_id,
        session_id=session_id,
    )

    results: List[PreparationAnswerState] = []

    for record in records:
        raw = record.user_message or ""

        answer_id_match = re.search(
            r"Answer ID:\s*([A-Za-z0-9_.-]+)",
            raw,
            flags=re.IGNORECASE,
        )

        question_id_match = re.search(
            r"Question ID:\s*([A-Za-z0-9_.-]+)",
            raw,
            flags=re.IGNORECASE,
        )

        answer_match = re.search(
            r"Candidate Answer:\s*(.*)",
            raw,
            flags=re.IGNORECASE | re.DOTALL,
        )

        answer_id = (
            answer_id_match.group(1)
            if answer_id_match
            else new_answer_id()
        )

        question_id = (
            question_id_match.group(1)
            if question_id_match
            else ""
        )

        answer_text = (
            answer_match.group(1).strip()
            if answer_match
            else ""
        )

        results.append(
            PreparationAnswerState(
                id=answer_id,
                question_id=question_id,
                user_id=user_id,
                answer=answer_text,
                feedback=record.ai_response or "",
                score=_extract_score(
                    record.ai_response or ""
                ),
                created_at=(
                    record.created_at
                    or utc_now()
                ),
            )
        )

    return results

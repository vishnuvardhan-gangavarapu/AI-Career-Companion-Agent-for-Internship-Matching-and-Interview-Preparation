from __future__ import annotations

import json
import re
from typing import Any


# ============================================================
# ROLE REQUIREMENTS
# ============================================================
# Backend-owned requirements. React should only display the result returned
# by this service; it should not decide which role belongs to a resume.

ROLE_REQUIREMENTS = {
    "frontend developer intern": {
        "display_name": "Frontend Developer Intern",
        "skills": {
            "html": "Frontend",
            "css": "Frontend",
            "javascript": "Programming",
            "react": "Frontend",
            "git": "Tools",
            "typescript": "Programming",
            "next.js": "Frontend",
            "testing": "Tools",
            "rest api": "Backend",
            "responsive design": "Frontend",
        },
        "priority": {
            "html": "Medium",
            "css": "Medium",
            "javascript": "High",
            "react": "High",
            "git": "Medium",
            "typescript": "High",
            "next.js": "High",
            "testing": "Medium",
            "rest api": "Medium",
            "responsive design": "Medium",
        },
    },
    "backend developer intern": {
        "display_name": "Backend Developer Intern",
        "skills": {
            "python": "Programming",
            "java": "Programming",
            "javascript": "Programming",
            "sql": "Database",
            "postgresql": "Database",
            "mysql": "Database",
            "rest api": "Backend",
            "git": "Tools",
            "fastapi": "Backend",
            "django": "Backend",
            "testing": "Tools",
        },
        "priority": {
            "python": "High",
            "java": "High",
            "sql": "High",
            "postgresql": "Medium",
            "mysql": "Medium",
            "rest api": "High",
            "git": "Medium",
            "fastapi": "High",
            "django": "Medium",
            "testing": "Medium",
            "javascript": "Medium",
        },
    },
    "full stack developer intern": {
        "display_name": "Full Stack Developer Intern",
        "skills": {
            "html": "Frontend",
            "css": "Frontend",
            "javascript": "Programming",
            "react": "Frontend",
            "node.js": "Backend",
            "express": "Backend",
            "python": "Programming",
            "sql": "Database",
            "mongodb": "Database",
            "rest api": "Backend",
            "git": "Tools",
            "testing": "Tools",
        },
        "priority": {
            "javascript": "High",
            "react": "High",
            "node.js": "High",
            "sql": "High",
            "rest api": "High",
            "git": "Medium",
            "testing": "Medium",
            "python": "Medium",
            "html": "Medium",
            "css": "Medium",
            "express": "Medium",
            "mongodb": "Medium",
        },
    },
    "python developer intern": {
        "display_name": "Python Developer Intern",
        "skills": {
            "python": "Programming",
            "sql": "Database",
            "git": "Tools",
            "rest api": "Backend",
            "fastapi": "Backend",
            "django": "Backend",
            "flask": "Backend",
            "testing": "Tools",
            "postgresql": "Database",
        },
        "priority": {
            "python": "High",
            "sql": "High",
            "rest api": "High",
            "fastapi": "High",
            "django": "Medium",
            "flask": "Medium",
            "git": "Medium",
            "testing": "Medium",
            "postgresql": "Medium",
        },
    },
    "java developer intern": {
        "display_name": "Java Developer Intern",
        "skills": {
            "java": "Programming",
            "sql": "Database",
            "spring": "Backend",
            "spring boot": "Backend",
            "rest api": "Backend",
            "git": "Tools",
            "mysql": "Database",
            "testing": "Tools",
        },
        "priority": {
            "java": "High",
            "sql": "High",
            "spring": "High",
            "spring boot": "High",
            "rest api": "High",
            "git": "Medium",
            "mysql": "Medium",
            "testing": "Medium",
        },
    },
}


# ============================================================
# SKILL ALIASES
# ============================================================

SKILL_ALIASES = {
    "html5": "html",
    "html 5": "html",
    "css3": "css",
    "css 3": "css",
    "js": "javascript",
    "javascript es6": "javascript",
    "ts": "typescript",
    "react.js": "react",
    "reactjs": "react",
    "node": "node.js",
    "nodejs": "node.js",
    "nextjs": "next.js",
    "next js": "next.js",
    "rest": "rest api",
    "restful api": "rest api",
    "rest apis": "rest api",
    "rest api development": "rest api",
    "postgres": "postgresql",
    "postgre sql": "postgresql",
    "mongo": "mongodb",
    "springboot": "spring boot",
    "spring boot framework": "spring boot",
}


# Explicit role phrases. These are checked against the actual resume text
# before skill-based inference.
ROLE_PHRASES = {
    "frontend developer intern": [
        "frontend developer intern",
        "front end developer intern",
        "front-end developer intern",
        "frontend developer",
        "front end developer",
        "front-end developer",
        "frontend engineer",
        "front end engineer",
        "front-end engineer",
        "react developer",
        "reactjs developer",
        "web developer",
        "ui developer",
        "ui developer intern",
        "frontend development",
        "front end development",
        "front-end development",
        "aspiring frontend developer",
        "aspiring front end developer",
        "aspiring front-end developer",
    ],
    "backend developer intern": [
        "backend developer intern",
        "back end developer intern",
        "back-end developer intern",
        "backend developer",
        "back end developer",
        "back-end developer",
        "backend engineer",
        "back end engineer",
        "back-end engineer",
        "api developer",
        "server-side developer",
        "backend development",
        "back end development",
        "back-end development",
    ],
    "full stack developer intern": [
        "full stack developer intern",
        "full-stack developer intern",
        "full stack developer",
        "full-stack developer",
        "full stack engineer",
        "full-stack engineer",
        "mern developer",
        "mean developer",
        "full stack development",
        "full-stack development",
    ],
    "python developer intern": [
        "python developer intern",
        "python developer",
        "python engineer",
        "python backend developer",
        "python development",
    ],
    "java developer intern": [
        "java developer intern",
        "java developer",
        "java engineer",
        "java backend developer",
        "spring boot developer",
        "java development",
    ],
}


# Distinctive skills help resolve ties when the resume does not explicitly
# name a role. Generic skills such as Git alone should not determine a role.
ROLE_DISTINCTIVE_SKILLS = {
    "frontend developer intern": {
        "react": 5,
        "typescript": 4,
        "next.js": 4,
        "html": 3,
        "css": 3,
        "responsive design": 3,
    },
    "backend developer intern": {
        "fastapi": 5,
        "django": 5,
        "rest api": 3,
        "postgresql": 3,
        "mysql": 3,
        "api development": 3,
    },
    "full stack developer intern": {
        "node.js": 5,
        "express": 5,
        "mongodb": 4,
        "react": 3,
        "rest api": 3,
    },
    "python developer intern": {
        "python": 6,
        "fastapi": 4,
        "django": 4,
        "flask": 4,
    },
    "java developer intern": {
        "java": 6,
        "spring boot": 5,
        "spring": 4,
        "mysql": 3,
    },
}


# ============================================================
# NORMALIZATION / FLATTENING
# ============================================================


def normalize_skill(value: Any) -> str:
    if value is None:
        return ""

    if isinstance(value, str):
        return " ".join(value.strip().lower().split())

    if isinstance(value, dict):
        for key in ("name", "skill", "title", "technology", "value"):
            if value.get(key):
                return " ".join(str(value[key]).strip().lower().split())

    return " ".join(str(value).strip().lower().split())


def flatten_skills(*sources: Any) -> list[str]:
    result: list[str] = []

    def add(value: Any) -> None:
        if value is None:
            return

        if isinstance(value, list):
            for item in value:
                add(item)
            return

        if isinstance(value, dict):
            for key in ("name", "skill", "title", "technology", "value"):
                if value.get(key):
                    normalized = normalize_skill(value[key])
                    if normalized:
                        result.append(normalized)
                    return

            for key, nested in value.items():
                normalized_key = normalize_skill(key)
                if normalized_key:
                    result.append(normalized_key)
                add(nested)
            return

        if isinstance(value, str):
            parts = []
            for line in value.replace("|", ",").replace(";", ",").splitlines():
                parts.extend(line.split(","))

            if len(parts) > 1:
                for part in parts:
                    cleaned = part.strip().lstrip("-•*").strip()
                    if cleaned:
                        result.append(cleaned.lower())
                return

        normalized = normalize_skill(value)
        if normalized:
            result.append(normalized)

    for source in sources:
        add(source)

    return list(dict.fromkeys(result))


def canonical_skill(skill: str) -> str:
    normalized = normalize_skill(skill)
    return SKILL_ALIASES.get(normalized, normalized)


# ============================================================
# ROLE DETECTION
# ============================================================


def _json_to_text(value: Any) -> str:
    if value is None:
        return ""

    if isinstance(value, str):
        return value

    try:
        return json.dumps(value, ensure_ascii=False)
    except (TypeError, ValueError):
        return str(value)


def build_resume_role_text(profile: Any, resume: Any | None = None) -> str:
    """Build searchable text from the actual analyzed resume/profile."""

    parts = []

    if resume is not None:
        parts.append(getattr(resume, "extracted_text", "") or "")

    for field in (
        "professional_summary",
        "work_experience",
        "internships",
        "projects",
        "education",
        "certifications",
        "achievements",
    ):
        parts.append(_json_to_text(getattr(profile, field, None)))

    return "\n".join(part for part in parts if part).lower()


def _role_phrase_matches(text: str) -> list[tuple[str, str, int]]:
    """Return role/phrase matches found in one text block."""

    normalized_text = " ".join(str(text or "").lower().split())
    matches: list[tuple[str, str, int]] = []

    if not normalized_text:
        return matches

    for role_key, phrases in ROLE_PHRASES.items():
        for phrase in phrases:
            if phrase in normalized_text:
                matches.append((role_key, phrase, len(phrase)))

    return matches


def detect_explicit_role(profile: Any, resume: Any | None = None) -> str | None:
    """
    Detect a role explicitly stated by the candidate.

    Structured resume sections are weighted more heavily than arbitrary
    project-description text. This prevents a project such as
    "Backend Developer API" from incorrectly changing a resume whose actual
    professional title/summary says "Frontend Developer".
    """

    weighted_sections: list[tuple[int, str]] = []

    # Highest priority: the candidate's summary/objective.
    weighted_sections.append((12, _json_to_text(getattr(profile, "professional_summary", None))))

    # Next: actual job/internship titles and descriptions.
    weighted_sections.append((10, _json_to_text(getattr(profile, "work_experience", None))))
    weighted_sections.append((10, _json_to_text(getattr(profile, "internships", None))))

    # The extracted resume is useful, but may contain references to other
    # roles in job descriptions/projects, so it gets a lower weight.
    if resume is not None:
        weighted_sections.append((7, getattr(resume, "extracted_text", "") or ""))

    # Projects can mention technologies/roles that are not the candidate's
    # target role, so use them only as weak supporting evidence.
    weighted_sections.append((3, _json_to_text(getattr(profile, "projects", None))))

    role_scores: dict[str, float] = {}
    role_best_phrase_length: dict[str, int] = {}

    for weight, text in weighted_sections:
        for role_key, phrase, phrase_length in _role_phrase_matches(text):
            role_scores[role_key] = role_scores.get(role_key, 0.0) + weight
            role_best_phrase_length[role_key] = max(
                role_best_phrase_length.get(role_key, 0),
                phrase_length,
            )

    if not role_scores:
        return None

    ranked = sorted(
        role_scores.items(),
        key=lambda item: (
            item[1],
            role_best_phrase_length.get(item[0], 0),
        ),
        reverse=True,
    )

    return ranked[0][0]


def infer_role_from_skills(user_skills: set[str]) -> tuple[str | None, str]:
    """
    Infer the most representative role from the candidate's skills.

    Coverage is deliberately weighted more than the number of distinctive
    bonus points. This prevents one backend technology such as FastAPI from
    overpowering a resume whose overall skill profile is clearly frontend.
    """

    if not user_skills:
        return None, "low"

    # Core skills are the strongest evidence for a role.
    core_skills = {
        "frontend developer intern": {"html", "css", "javascript", "react"},
        "backend developer intern": {"python", "java", "sql", "rest api", "fastapi", "django"},
        "full stack developer intern": {"javascript", "react", "node.js", "express", "rest api"},
        "python developer intern": {"python", "fastapi", "django", "flask", "sql"},
        "java developer intern": {"java", "spring", "spring boot", "sql"},
    }

    scores: dict[str, float] = {}
    matched_counts: dict[str, int] = {}

    for role_key, requirements in ROLE_REQUIREMENTS.items():
        required = {canonical_skill(skill) for skill in requirements["skills"]}
        priority_map = requirements["priority"]

        matched: set[str] = set()
        for skill in required:
            implied_match = skill == "spring" and "spring boot" in user_skills
            if skill in user_skills or implied_match:
                matched.add(skill)

        matched_counts[role_key] = len(matched)

        coverage = len(matched) / max(len(required), 1)
        core = core_skills.get(role_key, set())
        core_hits = len(core.intersection(user_skills))
        core_coverage = core_hits / max(len(core), 1)

        # High-priority requirements add evidence, but cannot dominate the
        # role decision by themselves.
        priority_score = sum(
            1.25 if priority_map.get(skill) == "High" else 0.75
            for skill in matched
        )

        distinctive_score = sum(
            bonus
            for skill, bonus in ROLE_DISTINCTIVE_SKILLS.get(role_key, {}).items()
            if canonical_skill(skill) in user_skills
        )

        # Coverage is the dominant factor. Core coverage is the second
        # strongest signal. Distinctive skills are tie-breakers/supporting
        # evidence rather than the primary decision.
        score = (
            coverage * 100.0
            + core_coverage * 45.0
            + priority_score * 2.0
            + distinctive_score * 0.8
        )

        scores[role_key] = score

    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    if not ranked:
        return None, "low"

    best_role, best_score = ranked[0]
    second_score = ranked[1][1] if len(ranked) > 1 else 0.0
    best_required_count = len(ROLE_REQUIREMENTS[best_role]["skills"])
    best_matched_count = matched_counts[best_role]
    best_coverage = best_matched_count / max(best_required_count, 1)
    best_core = core_skills.get(best_role, set())
    best_core_hits = len(best_core.intersection(user_skills))

    # Do not invent a role from a tiny amount of generic evidence.
    if best_matched_count < 2 and best_core_hits < 2:
        return None, "low"

    margin = best_score - second_score

    if best_coverage >= 0.60 and margin >= 8.0:
        confidence = "high"
    elif best_coverage >= 0.40 and margin >= 4.0:
        confidence = "medium"
    else:
        confidence = "low"

    return best_role, confidence


def detect_target_role(
    profile: Any,
    resume: Any | None,
) -> tuple[str, str, str]:
    """
    Detect role using this order:

    1. Explicit role mentioned in resume/profile text.
    2. Role inferred from analyzed skills.
    3. Frontend Developer Intern as the safe supported fallback.

    Returns: (role_key, source, confidence)
    """

    resume_text = build_resume_role_text(profile, resume)

    explicit_role = detect_explicit_role(profile=profile, resume=resume)
    if explicit_role:
        return explicit_role, "resume_mentioned", "high"

    raw_user_skills = flatten_skills(
        profile.skills,
        profile.technical_skills,
        profile.soft_skills,
    )

    user_skills = {
        canonical_skill(skill)
        for skill in raw_user_skills
        if canonical_skill(skill)
    }

    inferred_role, confidence = infer_role_from_skills(user_skills)
    if inferred_role:
        return inferred_role, "skills_inferred", confidence

    return "frontend developer intern", "default", "low"


# ============================================================
# ROLE REQUIREMENT LOOKUP
# ============================================================


def get_role_requirements(target_role: str) -> dict:
    normalized_role = normalize_skill(target_role)

    if normalized_role in ROLE_REQUIREMENTS:
        return ROLE_REQUIREMENTS[normalized_role]

    for role_key, requirements in ROLE_REQUIREMENTS.items():
        if role_key in normalized_role or normalized_role in role_key:
            return requirements

    return ROLE_REQUIREMENTS["frontend developer intern"]


# ============================================================
# SKILL GAP ANALYSIS
# ============================================================


def analyze_skill_gap(
    profile: Any,
    resume: Any | None = None,
    target_role: str | None = None,
) -> dict:
    """
    Analyze the authenticated user's resume against a detected role.

    target_role is intentionally optional. If supplied, it can be used as a
    future manual override, but the Skill Gap page currently calls this
    function without one so the role comes from the resume or its skills.
    """

    if target_role and normalize_skill(target_role) in ROLE_REQUIREMENTS:
        role_key = normalize_skill(target_role)
        role_source = "manual_override"
        role_confidence = "high"
    else:
        role_key, role_source, role_confidence = detect_target_role(
            profile=profile,
            resume=resume,
        )

    role = get_role_requirements(role_key)
    required_skills = role["skills"]
    priority_map = role["priority"]

    raw_user_skills = flatten_skills(
        profile.skills,
        profile.technical_skills,
        profile.soft_skills,
    )

    user_skills = {
        canonical_skill(skill)
        for skill in raw_user_skills
        if canonical_skill(skill)
    }

    matched_skills: list[dict] = []
    missing_skills: list[dict] = []

    for required_skill, category in required_skills.items():
        canonical_required = canonical_skill(required_skill)
        priority = priority_map.get(canonical_required, "Medium")

        # Spring Boot also demonstrates Spring knowledge.
        implied_match = (
            canonical_required == "spring"
            and "spring boot" in user_skills
        )

        if canonical_required in user_skills or implied_match:
            matched_skills.append({
                "name": required_skill.title(),
                "category": category,
                "status": "matched",
                "priority": priority,
                "evidence": "Skill found in the analysed resume.",
            })
        else:
            missing_skills.append({
                "name": required_skill.title(),
                "category": category,
                "status": "missing",
                "priority": priority,
                "reason": (
                    f"{required_skill.title()} is included in the requirement profile "
                    f"for {role['display_name']}."
                ),
            })

    total_required = len(required_skills)
    total_matched = len(matched_skills)
    overall_match = (
        round((total_matched / total_required) * 100)
        if total_required
        else 0
    )

    # These are matched high-priority skills that deserve focused practice;
    # they are not fake proficiency scores.
    improving_skills = [
        {
            "name": item["name"],
            "category": item["category"],
            "priority": item["priority"],
            "reason": (
                "Matched in the resume and marked high priority for focused preparation."
            ),
        }
        for item in matched_skills
        if item["priority"] == "High"
    ][:5]

    # Professional, simple three-level role-match language.
    if overall_match >= 80:
        role_match_label = "Good"
    elif overall_match >= 50:
        role_match_label = "Average"
    else:
        role_match_label = "Needs Improvement"

    sorted_missing = sorted(
        missing_skills,
        key=lambda item: (
            0 if item["priority"] == "High" else 1,
            item["name"],
        ),
    )

    roadmap = []
    for index, skill in enumerate(sorted_missing[:6], start=1):
        name = skill["name"]
        duration = "1–2 weeks" if skill["priority"] == "High" else "1 week"

        roadmap.append({
            "number": str(index).zfill(2),
            "topic": name,
            "title": f"Learn {name}",
            "description": (
                f"Build practical knowledge of {name} through tutorials, practice and a small project."
            ),
            "duration": duration,
            "level": f"{skill['priority']} Priority",
            "category": skill["category"],
        })

    return {
        "target_role": role["display_name"],
        "role_source": role_source,
        "role_confidence": role_confidence,
        "overall_match": overall_match,
        "role_match_label": role_match_label,
        # Kept for backward compatibility with the current frontend/API.
        "career_readiness": role_match_label,
        "matched_count": len(matched_skills),
        "missing_count": len(missing_skills),
        "improving_count": len(improving_skills),
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "improving_skills": improving_skills,
        "roadmap": roadmap,
        "user_skills": sorted(user_skills),
    }

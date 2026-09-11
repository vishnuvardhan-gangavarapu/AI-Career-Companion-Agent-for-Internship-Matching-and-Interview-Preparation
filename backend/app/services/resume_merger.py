from typing import Any


# =========================================================
# HELPERS
# =========================================================

def clean_string(value: Any) -> str | None:

    if value is None:
        return None

    if not isinstance(value, str):
        return None

    value = value.strip()

    return value if value else None


def normalize_skill(value: Any) -> str | None:

    if not isinstance(value, str):
        return None

    value = value.strip()

    if not value:
        return None

    aliases = {

        "reactjs": "React",
        "react.js": "React",

        "nodejs": "Node.js",
        "node.js": "Node.js",

        "expressjs": "Express.js",
        "express.js": "Express.js",

        "postgres": "PostgreSQL",

        "postgres sql": "PostgreSQL",

        "mongodb": "MongoDB",

        "js": "JavaScript",

        "ts": "TypeScript",

        "tailwindcss": "Tailwind CSS",

        "sklearn": "Scikit-learn",
    }

    key = value.lower()

    return aliases.get(
        key,
        value
    )


def merge_skill_lists(
    *skill_lists: Any,
) -> list[str]:

    result = []

    seen = set()

    for skill_list in skill_lists:

        if not isinstance(
            skill_list,
            list,
        ):
            continue

        for skill in skill_list:

            normalized = normalize_skill(
                skill
            )

            if not normalized:
                continue

            key = normalized.lower()

            if key not in seen:

                seen.add(key)

                result.append(
                    normalized
                )

    return result


def safe_list(value: Any) -> list:

    if isinstance(value, list):
        return value

    return []


# =========================================================
# PROJECT MERGING
# =========================================================

def merge_projects(
    regex_data: dict[str, Any],
    llm_data: dict[str, Any],
) -> list:

    llm_projects = safe_list(
        llm_data.get("projects")
    )

    regex_project_technologies = merge_skill_lists(
        regex_data.get(
            "project_technologies",
            []
        )
    )

    result = []

    for project in llm_projects:

        if not isinstance(project, dict):
            continue

        project_copy = dict(project)

        technologies = merge_skill_lists(

            project.get(
                "technologies",
                []
            ),

            project.get(
                "technology",
                []
            ),

            project.get(
                "tech_stack",
                []
            ),

            project.get(
                "skills",
                []
            ),
        )

        # If LLM didn't detect project technologies,
        # use technologies found by regex.
        if not technologies:

            technologies = list(
                regex_project_technologies
            )

        project_copy[
            "technologies"
        ] = technologies

        result.append(
            project_copy
        )

    return result


# =========================================================
# MAIN MERGER
# =========================================================

def merge_resume_data(
    regex_data: dict[str, Any],
    llm_data: dict[str, Any],
) -> dict[str, Any]:

    merged = {

        "full_name": None,

        "email": None,

        "phone": None,

        "address": None,

        "linkedin": None,

        "github": None,

        "professional_summary": None,

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

        "publications": [],
    }


    # =====================================================
    # BASIC INFORMATION
    # =====================================================

    merged["full_name"] = (

        regex_data.get("name")

        or llm_data.get("full_name")
    )


    merged["email"] = (

        regex_data.get("email")

        or llm_data.get("email")
    )


    merged["phone"] = (

        regex_data.get("phone")

        or llm_data.get("phone")
    )


    merged["linkedin"] = (

        regex_data.get("linkedin")

        or llm_data.get("linkedin")
    )


    merged["github"] = (

        regex_data.get("github")

        or llm_data.get("github")
    )


    merged["address"] = (

        llm_data.get("address")
    )


    merged["professional_summary"] = (

        llm_data.get(
            "professional_summary"
        )
    )


    # =====================================================
    # ALL SKILLS
    # =====================================================

    merged["skills"] = merge_skill_lists(

        regex_data.get(
            "technical_skills",
            []
        ),

        regex_data.get(
            "soft_skills",
            []
        ),

        llm_data.get(
            "skills",
            []
        ),
    )


    # =====================================================
    # TECHNICAL SKILLS
    # =====================================================

    merged["technical_skills"] = merge_skill_lists(

        regex_data.get(
            "technical_skills",
            []
        ),

        llm_data.get(
            "technical_skills",
            []
        ),
    )


    # =====================================================
    # SOFT SKILLS
    # =====================================================

    merged["soft_skills"] = merge_skill_lists(

        regex_data.get(
            "soft_skills",
            []
        ),

        llm_data.get(
            "soft_skills",
            []
        ),
    )


    # =====================================================
    # EDUCATION
    # =====================================================

    merged["education"] = safe_list(
        llm_data.get("education")
    )


    # =====================================================
    # WORK EXPERIENCE
    # =====================================================

    merged["work_experience"] = safe_list(
        llm_data.get(
            "work_experience"
        )
    )


    # =====================================================
    # PROJECTS
    # =====================================================

    merged["projects"] = merge_projects(
        regex_data,
        llm_data,
    )


    # =====================================================
    # OTHER DATA
    # =====================================================

    merged["certifications"] = safe_list(
        llm_data.get(
            "certifications"
        )
    )


    merged["internships"] = safe_list(
        llm_data.get(
            "internships"
        )
    )


    merged["languages"] = safe_list(
        llm_data.get(
            "languages"
        )
    )


    merged["achievements"] = safe_list(
        llm_data.get(
            "achievements"
        )
    )


    merged["publications"] = safe_list(
        llm_data.get(
            "publications"
        )
    )


    return merged
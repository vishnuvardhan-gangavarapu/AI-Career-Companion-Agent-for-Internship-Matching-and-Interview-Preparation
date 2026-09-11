import re


# =========================================================
# BASIC PATTERNS
# =========================================================

EMAIL_PATTERN = re.compile(
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"
)

PHONE_PATTERN = re.compile(
    r"(?<!\d)(?:\+?\d[\d\s().-]{8,}\d)(?!\d)"
)

LINKEDIN_PATTERN = re.compile(
    r"(?:https?://)?(?:www\.)?linkedin\.com/in/[A-Za-z0-9_-]+",
    re.IGNORECASE,
)

GITHUB_PATTERN = re.compile(
    r"(?:https?://)?(?:www\.)?github\.com/[A-Za-z0-9_-]+",
    re.IGNORECASE,
)


# =========================================================
# TECHNICAL SKILLS
# =========================================================

TECHNICAL_SKILLS = {
    # Programming languages
    "python": "Python",
    "java": "Java",
    "javascript": "JavaScript",
    "typescript": "TypeScript",
    "c": "C",
    "c++": "C++",
    "c#": "C#",
    "php": "PHP",
    "ruby": "Ruby",
    "go": "Go",
    "golang": "Go",
    "kotlin": "Kotlin",
    "swift": "Swift",
    "rust": "Rust",

    # Frontend
    "html": "HTML",
    "html5": "HTML5",
    "css": "CSS",
    "css3": "CSS3",
    "react": "React",
    "react.js": "React",
    "reactjs": "React",
    "angular": "Angular",
    "vue": "Vue.js",
    "vue.js": "Vue.js",
    "next.js": "Next.js",
    "nextjs": "Next.js",
    "bootstrap": "Bootstrap",
    "tailwind": "Tailwind CSS",
    "tailwind css": "Tailwind CSS",

    # Backend
    "node": "Node.js",
    "node.js": "Node.js",
    "nodejs": "Node.js",
    "express": "Express.js",
    "express.js": "Express.js",
    "django": "Django",
    "flask": "Flask",
    "fastapi": "FastAPI",
    "spring": "Spring",
    "spring boot": "Spring Boot",

    # Databases
    "mysql": "MySQL",
    "postgresql": "PostgreSQL",
    "postgres": "PostgreSQL",
    "mongodb": "MongoDB",
    "sqlite": "SQLite",
    "oracle": "Oracle",
    "sql": "SQL",
    "redis": "Redis",

    # Cloud / DevOps
    "aws": "AWS",
    "azure": "Azure",
    "gcp": "Google Cloud",
    "docker": "Docker",
    "kubernetes": "Kubernetes",
    "jenkins": "Jenkins",
    "github actions": "GitHub Actions",
    "terraform": "Terraform",

    # Tools
    "git": "Git",
    "github": "GitHub",
    "gitlab": "GitLab",
    "postman": "Postman",
    "jira": "Jira",
    "vscode": "VS Code",

    # Data / AI
    "machine learning": "Machine Learning",
    "deep learning": "Deep Learning",
    "artificial intelligence": "Artificial Intelligence",
    "ai": "AI",
    "nlp": "NLP",
    "natural language processing": "NLP",
    "tensorflow": "TensorFlow",
    "pytorch": "PyTorch",
    "scikit-learn": "Scikit-learn",
    "sklearn": "Scikit-learn",
    "pandas": "Pandas",
    "numpy": "NumPy",
    "matplotlib": "Matplotlib",
    "seaborn": "Seaborn",
    "opencv": "OpenCV",

    # APIs
    "rest api": "REST API",
    "restful api": "REST API",
    "api": "API",
    "graphql": "GraphQL",

    # Other
    "json": "JSON",
    "xml": "XML",
    "linux": "Linux",
    "unix": "Unix",
}


# =========================================================
# SOFT SKILLS
# =========================================================

SOFT_SKILLS = {
    "communication": "Communication",
    "verbal communication": "Verbal Communication",
    "written communication": "Written Communication",
    "teamwork": "Teamwork",
    "team work": "Teamwork",
    "leadership": "Leadership",
    "problem solving": "Problem Solving",
    "problem-solving": "Problem Solving",
    "critical thinking": "Critical Thinking",
    "time management": "Time Management",
    "adaptability": "Adaptability",
    "flexibility": "Flexibility",
    "creativity": "Creativity",
    "collaboration": "Collaboration",
    "decision making": "Decision Making",
    "decision-making": "Decision Making",
    "presentation": "Presentation",
    "presentation skills": "Presentation",
    "team management": "Team Management",
    "conflict resolution": "Conflict Resolution",
    "negotiation": "Negotiation",
    "analytical thinking": "Analytical Thinking",
    "attention to detail": "Attention to Detail",
    "work ethic": "Work Ethic",
    "self motivated": "Self-Motivated",
    "self-motivated": "Self-Motivated",
    "interpersonal skills": "Interpersonal Skills",
    "organizational skills": "Organizational Skills",
    "organization": "Organization",
}


# =========================================================
# NORMALIZATION
# =========================================================

def normalize_skill(value: str) -> str:
    """
    Normalize skill names so duplicate values are removed.
    """

    if not isinstance(value, str):
        return ""

    value = value.strip()

    if not value:
        return ""

    key = value.lower()

    if key in TECHNICAL_SKILLS:
        return TECHNICAL_SKILLS[key]

    if key in SOFT_SKILLS:
        return SOFT_SKILLS[key]

    return value


def unique_skills(values: list[str]) -> list[str]:
    """
    Remove duplicate skills while preserving order.
    """

    result = []
    seen = set()

    for value in values:

        normalized = normalize_skill(value)

        if not normalized:
            continue

        key = normalized.lower()

        if key not in seen:
            seen.add(key)
            result.append(normalized)

    return result


# =========================================================
# BASIC INFORMATION
# =========================================================

def extract_email(text: str) -> str | None:

    match = EMAIL_PATTERN.search(text)

    if not match:
        return None

    return match.group(0).strip()


def extract_phone(text: str) -> str | None:

    matches = PHONE_PATTERN.findall(text)

    for phone in matches:

        digits = re.sub(r"\D", "", phone)

        if 10 <= len(digits) <= 15:
            return phone.strip()

    return None


def extract_linkedin(text: str) -> str | None:

    match = LINKEDIN_PATTERN.search(text)

    if not match:
        return None

    value = match.group(0).strip()

    if not value.lower().startswith("http"):
        value = f"https://{value}"

    return value


def extract_github(text: str) -> str | None:

    match = GITHUB_PATTERN.search(text)

    if not match:
        return None

    value = match.group(0).strip()

    if not value.lower().startswith("http"):
        value = f"https://{value}"

    return value


# =========================================================
# NAME
# =========================================================

def extract_name(text: str) -> str | None:

    lines = [
        line.strip()
        for line in text.splitlines()
        if line.strip()
    ]

    if not lines:
        return None

    ignored_headings = {
        "resume",
        "curriculum vitae",
        "cv",
        "profile",
        "summary",
        "objective",
        "contact",
        "education",
        "skills",
        "projects",
        "experience",
    }

    for line in lines[:10]:

        cleaned = re.sub(
            r"[^A-Za-z .'-]",
            "",
            line,
        ).strip()

        words = cleaned.split()

        if (
            2 <= len(words) <= 5
            and cleaned.lower() not in ignored_headings
        ):
            return cleaned

    return None


# =========================================================
# SKILL EXTRACTION
# =========================================================

def extract_technical_skills(text: str) -> list[str]:

    text_lower = text.lower()

    found = []

    for skill, display_name in TECHNICAL_SKILLS.items():

        if skill in text_lower:

            found.append(display_name)

    return unique_skills(found)


def extract_soft_skills(text: str) -> list[str]:

    text_lower = text.lower()

    found = []

    for skill, display_name in SOFT_SKILLS.items():

        if skill in text_lower:

            found.append(display_name)

    return unique_skills(found)


# =========================================================
# SKILL SECTION EXTRACTION
# =========================================================

def extract_skill_section(text: str) -> str:

    lines = text.splitlines()

    inside_skills = False
    collected = []

    skill_headings = [
        "skills",
        "technical skills",
        "technical skill",
        "core skills",
        "key skills",
        "technologies",
        "technical expertise",
        "skills & technologies",
        "skills and technologies",
    ]

    stop_headings = [
        "education",
        "experience",
        "work experience",
        "professional experience",
        "projects",
        "certifications",
        "internships",
        "achievements",
        "languages",
        "publications",
        "interests",
    ]

    for line in lines:

        cleaned = line.strip()

        if not cleaned:
            continue

        lower = cleaned.lower()

        if any(
            heading in lower
            for heading in skill_headings
        ):
            inside_skills = True
            continue

        if inside_skills and any(
            heading == lower
            or lower.startswith(heading + ":")
            for heading in stop_headings
        ):
            break

        if inside_skills:
            collected.append(cleaned)

    return "\n".join(collected)


# =========================================================
# PROJECT TECHNOLOGIES
# =========================================================

def extract_project_technologies(text: str) -> list[str]:

    lines = text.splitlines()

    project_section = False
    project_text = []

    for line in lines:

        cleaned = line.strip()

        if not cleaned:
            continue

        lower = cleaned.lower()

        if lower in {
            "projects",
            "project",
            "academic projects",
            "personal projects",
        }:
            project_section = True
            continue

        if project_section and lower in {
            "education",
            "experience",
            "work experience",
            "certifications",
            "internships",
            "achievements",
        }:
            break

        if project_section:
            project_text.append(cleaned)

    project_text_value = "\n".join(project_text)

    return extract_technical_skills(
        project_text_value
    )


# =========================================================
# MAIN REGEX PARSER
# =========================================================

def parse_with_regex(text: str) -> dict:

    technical_skills = extract_technical_skills(text)

    soft_skills = extract_soft_skills(text)

    project_technologies = extract_project_technologies(
        text
    )

    return {

        "name": extract_name(text),

        "email": extract_email(text),

        "phone": extract_phone(text),

        "linkedin": extract_linkedin(text),

        "github": extract_github(text),

        "technical_skills": technical_skills,

        "soft_skills": soft_skills,

        "project_technologies": project_technologies,
    }
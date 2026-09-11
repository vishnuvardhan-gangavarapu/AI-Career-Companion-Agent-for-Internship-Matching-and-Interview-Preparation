import json

from groq import Groq

from app.core.config import settings


# =========================================================
# GROQ CLIENT
# =========================================================

def get_groq_client() -> Groq:

    if not settings.groq_api_key:

        raise RuntimeError(
            "GROQ_API_KEY is not configured in .env"
        )

    return Groq(
        api_key=settings.groq_api_key
    )


# =========================================================
# RESUME PARSER PROMPT
# =========================================================

RESUME_SYSTEM_PROMPT = """
You are an expert professional resume parser.

Your job is to extract ONLY factual information
that actually exists in the supplied resume.

Return ONLY valid JSON.

Do not return markdown.
Do not return explanations.
Do not invent information.
Do not guess missing information.

=========================================================
IMPORTANT SKILL RULES
=========================================================

technical_skills:

Include actual technical technologies, programming
languages, frameworks, libraries, databases, tools,
platforms, APIs, cloud technologies and technical
concepts.

Examples:

Python
Java
JavaScript
TypeScript
C
C++
React
Angular
Node.js
Express.js
FastAPI
Django
Flask
Spring Boot
HTML
CSS
SQL
MySQL
PostgreSQL
MongoDB
Redis
AWS
Azure
Docker
Kubernetes
Git
GitHub
REST API
GraphQL
Machine Learning
Deep Learning
TensorFlow
PyTorch
Pandas
NumPy
OpenCV

Do NOT put soft skills in technical_skills.

=========================================================

soft_skills:

Include human/professional skills such as:

Communication
Teamwork
Leadership
Problem Solving
Critical Thinking
Time Management
Adaptability
Creativity
Collaboration
Decision Making
Presentation
Negotiation
Conflict Resolution
Attention to Detail
Work Ethic
Interpersonal Skills
Organizational Skills

Do NOT put programming languages, frameworks,
databases or tools in soft_skills.

=========================================================

PROJECT TECHNOLOGIES
=========================================================

For every project, extract technologies separately.

For example:

{
  "title": "AI Interview Platform",
  "description": "...",
  "technologies": [
    "React",
    "FastAPI",
    "PostgreSQL",
    "Groq"
  ],
  "role": "..."
}

If a project has no technologies explicitly mentioned,
return an empty array.

=========================================================

JSON STRUCTURE
=========================================================

{
  "full_name": null,
  "email": null,
  "phone": null,
  "address": null,

  "linkedin": null,
  "github": null,

  "professional_summary": null,

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

  "publications": []
}

=========================================================
EDUCATION
=========================================================

Education objects may contain:

- degree
- institution
- university
- field_of_study
- start_year
- end_year
- start_date
- end_date
- grade
- cgpa
- percentage
- marks
- description

=========================================================
WORK EXPERIENCE
=========================================================

Work experience objects may contain:

- company
- designation
- start_date
- end_date
- responsibilities
- description

=========================================================
PROJECTS
=========================================================

Project objects may contain:

- title
- name
- description
- technologies
- role
- start_date
- end_date

=========================================================
CERTIFICATIONS
=========================================================

Certification objects may contain:

- name
- issuer
- date
- credential_id
- credential_url

=========================================================
INTERNSHIPS
=========================================================

Internship objects may contain:

- company
- role
- duration
- start_date
- end_date
- responsibilities
- description

=========================================================
GENERAL RULE
=========================================================

Extract information exactly from the resume.

Never invent information.

When information is missing:

- use null for single values
- use [] for arrays
"""


# =========================================================
# GROQ EXTRACTION
# =========================================================

def extract_resume_with_groq(
    resume_text: str,
) -> dict:

    if not resume_text.strip():

        raise ValueError(
            "Resume text cannot be empty"
        )

    client = get_groq_client()

    try:

        response = client.chat.completions.create(

            model="openai/gpt-oss-120b",

            temperature=0,

            max_tokens=6000,

            response_format={
                "type": "json_object"
            },

            messages=[

                {
                    "role": "system",
                    "content": RESUME_SYSTEM_PROMPT,
                },

                {
                    "role": "user",
                    "content": (
                        "Extract all factual resume "
                        "information from the following "
                        "resume text.\n\n"
                        f"{resume_text}"
                    ),
                },
            ],
        )

    except Exception as exc:

        raise RuntimeError(
            f"Groq API request failed: {exc}"
        ) from exc

    if not response.choices:

        raise RuntimeError(
            "Groq returned no response choices"
        )

    content = response.choices[0].message.content

    if not content:

        raise RuntimeError(
            "Groq returned an empty response"
        )

    content = content.strip()

    if content.startswith("```json"):

        content = content[7:]

    elif content.startswith("```"):

        content = content[3:]

    if content.endswith("```"):

        content = content[:-3]

    content = content.strip()

    try:

        parsed_data = json.loads(content)

    except json.JSONDecodeError as exc:

        raise RuntimeError(
            f"Groq returned invalid JSON: {content}"
        ) from exc

    if not isinstance(parsed_data, dict):

        raise RuntimeError(
            "Groq response must be a JSON object"
        )

    return parsed_data
import os
import json

from dotenv import load_dotenv
from groq import Groq

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.dirname(
            os.path.abspath(__file__)
        )
    )
)

ENV_FILE = os.path.join(
    BASE_DIR,
    ".env",
)

load_dotenv(ENV_FILE)

GROQ_API_KEY = os.getenv(
    "GROQ_API_KEY"
)

if not GROQ_API_KEY:
    raise RuntimeError(
        "GROQ_API_KEY is not configured. "
        "Please add GROQ_API_KEY to backend/.env"
    )

client = Groq(
    api_key=GROQ_API_KEY
)

def generate_cover_letter(
    resume_profile,
    internship,
    variation_instruction=None,
):

    skills = (
        resume_profile.skills or []
    )

    technical_skills = (
        resume_profile.technical_skills or []
    )

    education = (
        resume_profile.education or []
    )

    projects = (
        resume_profile.projects or []
    )

    certifications = (
        resume_profile.certifications or []
    )

    work_experience = (
        resume_profile.work_experience or []
    )

    if variation_instruction is None:
        variation_instruction = """
Create the first version of the cover letter.
Use a natural and professional structure.
"""

    prompt = f"""
You are a professional internship cover-letter writer.

Create a personalized cover letter using ONLY
the candidate information and internship information
provided below.

CANDIDATE INFORMATION
---------------------
Name:
{resume_profile.full_name}

Email:
{resume_profile.email}

Phone:
{resume_profile.phone}

Professional Summary:
{resume_profile.professional_summary}

Skills:
{json.dumps(skills)}

Technical Skills:
{json.dumps(technical_skills)}

Education:
{json.dumps(education)}

Projects:
{json.dumps(projects)}

Work Experience:
{json.dumps(work_experience)}

Certifications:
{json.dumps(certifications)}


INTERNSHIP INFORMATION
----------------------
Company:
{internship.company_name}

Position:
{internship.title}

Location:
{internship.location}

Duration:
{internship.duration}

Work Mode:
{internship.work_mode}

Required Skills:
{json.dumps(internship.required_skills)}

Description:
{internship.description}

Eligibility:
{internship.eligibility}

IMPORTANT RULES
---------------
1. Do not invent information.
2. Do not invent work experience.
3. Do not invent technologies.
4. Do not claim the candidate worked at the
   internship company.
5. Do not call the candidate a final-year student,
   recent graduate, or current student unless the
   supplied education data clearly supports it.
6. Do not invent company culture, company projects,
   company achievements, or company preferences.
7. Connect the candidate's actual skills and projects
   to the internship requirements.
8. Mention only relevant projects, education,
   certifications, or experience.
9. Keep the letter approximately 250-400 words.
10. Keep the tone professional, natural, and
    appropriate for an internship application.
11. Do not use markdown headings.
12. Do not add fake contact information.
13. Return only the cover letter.

REGENERATION INSTRUCTION
------------------------
{variation_instruction}

Generate the cover letter now.
"""

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {
                "role": "system",
                "content": (
                    "You write accurate and personalized "
                    "internship cover letters. "
                    "Never invent candidate information."
                ),
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],

        temperature=0.9,

        max_tokens=1200,
    )

    return (
        response.choices[0]
        .message
        .content
        .strip()
    )
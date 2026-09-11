import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useLocation, useNavigate, useParams } from "react-router-dom";

import "../styles/InternshipDetails.css";

/* =========================================================
   API CONFIG
========================================================= */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

/* =========================================================
   AUTH
========================================================= */

function getAuthToken() {
  const keys = ["access_token", "accessToken", "token", "authToken", "jwt"];

  for (const key of keys) {
    const value = localStorage.getItem(key);

    if (value) {
      return value.startsWith("Bearer ") ? value.substring(7) : value;
    }
  }

  return null;
}

function buildHeaders() {
  const token = getAuthToken();

  const headers = {
    Accept: "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

/* =========================================================
   INTERNSHIP ACCESS
========================================================= */

function isDefaultUserWithoutResume() {
  const dashboardType = String(
    localStorage.getItem("dashboard_type") || "",
  ).toLowerCase();

  const resumeAnalyzed = localStorage.getItem("resume_analyzed") === "true";

  const isDefaultUser =
    dashboardType === "default" ||
    dashboardType === "default_user" ||
    dashboardType === "defaultdashboard";

  return isDefaultUser && !resumeAnalyzed;
}

/* =========================================================
   HELPERS
========================================================= */

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

function normalizeArray(value) {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => {
        if (item && typeof item === "object") {
          return Object.values(item);
        }

        return [item];
      })
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === "object") {
    return Object.values(value)
      .flatMap((item) => normalizeArray(item))
      .filter(Boolean);
  }

  return String(value)
    .split(/[,;\n|•]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatValue(value, fallback = "Not specified") {
  if (value === undefined || value === null || String(value).trim() === "") {
    return fallback;
  }

  return String(value);
}

function formatDate(value) {
  if (!value) {
    return "Not specified";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getInitial(company) {
  if (!company) {
    return "I";
  }

  return String(company).trim().charAt(0).toUpperCase();
}

function getApiErrorMessage(responseData, fallback = "Something went wrong.") {
  if (!responseData) {
    return fallback;
  }

  if (typeof responseData === "string") {
    const message = responseData.trim();
    return message || fallback;
  }

  if (typeof responseData !== "object") {
    return String(responseData);
  }

  /* FastAPI commonly returns: { detail: "..." } */
  if (typeof responseData.detail === "string") {
    return responseData.detail;
  }

  /* FastAPI validation errors: { detail: [{ msg: "...", ... }] } */
  if (Array.isArray(responseData.detail)) {
    const messages = responseData.detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item === "object") {
          return (
            item.msg || item.message || item.detail || JSON.stringify(item)
          );
        }

        return String(item);
      })
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join(", ");
    }
  }

  /* Some APIs return: { detail: { message: "..." } } */
  if (responseData.detail && typeof responseData.detail === "object") {
    return (
      responseData.detail.message ||
      responseData.detail.msg ||
      responseData.detail.error ||
      JSON.stringify(responseData.detail)
    );
  }

  if (typeof responseData.message === "string") {
    return responseData.message;
  }

  if (typeof responseData.error === "string") {
    return responseData.error;
  }

  if (responseData.error && typeof responseData.error === "object") {
    return (
      responseData.error.message ||
      responseData.error.detail ||
      JSON.stringify(responseData.error)
    );
  }

  /*
   * Last resort: never allow an object to become
   * "[object Object]" in the UI.
   */
  try {
    return JSON.stringify(responseData);
  } catch {
    return fallback;
  }
}

/* =========================================================
   RESPONSE NORMALIZATION
========================================================= */

function normalizeInternshipResponse(response) {
  if (!response) {
    return {};
  }

  if (response.internship && typeof response.internship === "object") {
    return {
      ...response.internship,
      ...response,
    };
  }

  if (
    response.data?.internship &&
    typeof response.data.internship === "object"
  ) {
    return {
      ...response.data.internship,
      ...response.data,
      ...response,
    };
  }

  if (response.data && typeof response.data === "object") {
    return {
      ...response.data,
      ...response,
    };
  }

  return response;
}

function normalizeMatchResponse(response) {
  if (!response) {
    return {};
  }

  if (response.match && typeof response.match === "object") {
    return {
      ...response.match,
      ...response,
    };
  }

  if (response.data?.match && typeof response.data.match === "object") {
    return {
      ...response.data.match,
      ...response.data,
      ...response,
    };
  }

  if (response.data && typeof response.data === "object") {
    return {
      ...response.data,
      ...response,
    };
  }

  return response;
}

/* =========================================================
   ICON
========================================================= */

function Icon({ name, size = 20 }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  switch (name) {
    case "arrow-left":
      return (
        <svg {...props}>
          <path d="M19 12H5" />
          <path d="m12 19-7-7 7-7" />
        </svg>
      );

    case "arrow-right":
      return (
        <svg {...props}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );

    case "close":
      return (
        <svg {...props}>
          <path d="M6 6l12 12" />
          <path d="M18 6 6 18" />
        </svg>
      );

    case "location":
      return (
        <svg {...props}>
          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );

    case "clock":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );

    case "briefcase":
      return (
        <svg {...props}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M3 12h18" />
        </svg>
      );

    case "building":
      return (
        <svg {...props}>
          <path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16" />
          <path d="M8 7h2" />
          <path d="M14 7h2" />
          <path d="M8 11h2" />
          <path d="M14 11h2" />
          <path d="M8 15h2" />
          <path d="M14 15h2" />
          <path d="M9 21v-3h6v3" />
        </svg>
      );

    case "money":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="12" cy="12" r="3" />
          <path d="M7 9h.01" />
          <path d="M17 15h.01" />
        </svg>
      );

    case "calendar":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M16 2v4" />
          <path d="M8 2v4" />
          <path d="M3 10h18" />
        </svg>
      );

    case "bookmark":
      return (
        <svg {...props}>
          <path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4V4Z" />
        </svg>
      );

    case "document":
      return (
        <svg {...props}>
          <path d="M6 2h8l4 4v16H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
          <path d="M14 2v5h5" />
          <path d="M8 12h8" />
          <path d="M8 16h6" />
        </svg>
      );

    case "sparkle":
      return (
        <svg {...props}>
          <path d="m12 3-1.5 5.5L5 10l5.5 1.5L12 17l1.5-5.5L19 10l-5.5-1.5L12 3Z" />
          <path d="m19 15-.7 2.3L16 18l2.3.7L19 21l.7-2.3L22 18l-2.3-.7L19 15Z" />
        </svg>
      );

    case "check":
      return (
        <svg {...props}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );

    case "x":
      return (
        <svg {...props}>
          <path d="M6 6l12 12" />
          <path d="M18 6 6 18" />
        </svg>
      );

    case "refresh":
      return (
        <svg {...props}>
          <path d="M20 11a8 8 0 0 0-14.9-3" />
          <path d="M4 4v5h5" />
          <path d="M4 13a8 8 0 0 0 14.9 3" />
          <path d="M20 20v-5h-5" />
        </svg>
      );

    case "globe":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3c3 3 4 6 4 9s-1 6-4 9" />
          <path d="M12 3c-3 3-4 6-4 9s1 6 4 9" />
        </svg>
      );

    case "users":
      return (
        <svg {...props}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" />
          <path d="M16 5.5a3 3 0 0 1 0 5.8" />
          <path d="M18 15c1.8.7 3 2.1 3 5" />
        </svg>
      );

    case "graduation":
      return (
        <svg {...props}>
          <path d="m3 9 9-5 9 5-9 5z" />
          <path d="M7 11v5c3 2 7 2 10 0v-5" />
          <path d="M21 10v6" />
        </svg>
      );

    case "shield":
      return (
        <svg {...props}>
          <path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6z" />
          <path d="m8 12 2.5 2.5L16 9" />
        </svg>
      );

    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

/* =========================================================
   INFO CARD
========================================================= */

function InfoCard({ icon, label, value }) {
  return (
    <div className="id-info-card">
      <div className="id-info-icon">
        <Icon name={icon} size={18} />
      </div>

      <div className="id-info-copy">
        <span>{label}</span>

        <strong>{formatValue(value)}</strong>
      </div>
    </div>
  );
}

/* =========================================================
   LIST CARD
========================================================= */

function ListCard({ icon, label, title, items, variant = "purple" }) {
  return (
    <section className={`id-list-card ${variant}`}>
      <div className="id-list-header">
        <div className="id-list-icon">
          <Icon name={icon} size={19} />
        </div>

        <div>
          <span>{label}</span>

          <h3>{title}</h3>
        </div>
      </div>

      {items.length > 0 ? (
        <ul className="id-bullet-list">
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>
              <span className="id-bullet-check">
                <Icon name="check" size={12} />
              </span>

              <p>{item}</p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="id-empty-text">
          No information provided for this section.
        </div>
      )}
    </section>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

function InternshipDetails() {
  const { internship_id, id } = useParams();

  const location = useLocation();

  const navigate = useNavigate();

  /*
   * The internship list page can pass the selected
   * internship through React Router state. This makes
   * the details page work even when the route does not
   * contain the parameter for some reason.
   *
   * Priority:
   * 1. /internships/:internship_id
   * 2. /internships/:id
   * 3. location.state.internshipId
   * 4. location.state.internship.id
   * 5. other common ID field names
   */
  const stateInternship =
    location.state?.internship || location.state?.internshipData || null;

  const searchParams = new URLSearchParams(location.search || "");

  const searchInternshipId = firstValue(
    searchParams.get("internship_id"),
    searchParams.get("internshipId"),
    searchParams.get("id"),
  );

  const internshipId =
    internship_id ||
    id ||
    firstValue(
      location.state?.internshipId,
      location.state?.internship_id,
      stateInternship?.id,
      stateInternship?.internship_id,
      stateInternship?.internshipId,
      searchInternshipId,
    );

  console.log("INTERNSHIP DETAILS - route params:", {
    internship_id,
    id,
    searchInternshipId,
  });

  console.log("INTERNSHIP DETAILS - state:", location.state);

  console.log("INTERNSHIP DETAILS - resolved ID:", internshipId);

  /* =======================================================
     STATE
  ======================================================= */

  const [internship, setInternship] = useState(stateInternship);

  const [matchDetails, setMatchDetails] = useState(null);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [saving, setSaving] = useState(false);

  const [applying, setApplying] = useState(false);

  const [saved, setSaved] = useState(false);

  const [coverLetterSelected, setCoverLetterSelected] = useState(false);

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");

  /* =======================================================
     COVER LETTER STATE
  ======================================================= */

  const checkCoverLetterState = useCallback(() => {
    if (!internshipId) {
      setCoverLetterSelected(false);
      return;
    }

    const keys = [
      `coverLetterSelected_${internshipId}`,
      `selectedCoverLetter_${internshipId}`,
      `cover_letter_selected_${internshipId}`,
      `coverLetterUsed_${internshipId}`,
    ];

    const selected = keys.some((key) => localStorage.getItem(key) === "true");

    setCoverLetterSelected(selected);
  }, [internshipId]);

  /*
   * Keep the internship object passed by Internships.jsx
   * available immediately. The backend detail API will
   * then replace/complete it with the full record.
   */
  useEffect(() => {
    if (stateInternship && typeof stateInternship === "object") {
      setInternship((previous) => ({
        ...(previous || {}),
        ...stateInternship,
      }));
    }
  }, [stateInternship]);

  /* =======================================================
     LOAD DETAILS
  ======================================================= */

  const loadInternship = useCallback(
    async (isRefresh = false) => {
      if (!internshipId) {
        setError("Internship ID is missing.");

        setLoading(false);

        return;
      }

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");
        setMessage("");

        const headers = buildHeaders();

        /* ===============================================
             INTERNSHIP DETAILS API
          =============================================== */

        const internshipUrl = `${API_BASE_URL}/api/internships/${internshipId}`;

        console.log("INTERNSHIP DETAILS API:", internshipUrl);

        const internshipResponse = await fetch(internshipUrl, {
          method: "GET",
          headers,
        });

        const internshipText = await internshipResponse.text();

        let internshipJson = null;

        try {
          internshipJson = internshipText ? JSON.parse(internshipText) : null;
        } catch {
          internshipJson = null;
        }

        console.log("INTERNSHIP DETAILS STATUS:", internshipResponse.status);

        if (!internshipResponse.ok) {
          throw new Error(
            internshipJson?.detail ||
              `Unable to load internship details. Status: ${internshipResponse.status}`,
          );
        }

        setInternship(normalizeInternshipResponse(internshipJson));

        /* ===============================================
             MATCH DETAILS API
          =============================================== */

        const matchUrl = `${API_BASE_URL}/api/internships/${internshipId}/match-details`;

        console.log("MATCH DETAILS API:", matchUrl);

        const matchResponse = await fetch(matchUrl, {
          method: "GET",
          headers,
        });

        const matchText = await matchResponse.text();

        let matchJson = null;

        try {
          matchJson = matchText ? JSON.parse(matchText) : null;
        } catch {
          matchJson = null;
        }

        console.log("MATCH DETAILS STATUS:", matchResponse.status);

        if (matchResponse.ok) {
          setMatchDetails(normalizeMatchResponse(matchJson));
        } else {
          /*
              The internship itself should still
              be visible even if match-details
              is unavailable.
            */

          setMatchDetails({});
        }

        /* ===============================================
             SAVED STATE
          =============================================== */

        const savedList = localStorage.getItem("savedInternships");

        let isSaved = false;

        if (savedList) {
          try {
            const parsed = JSON.parse(savedList);

            if (Array.isArray(parsed)) {
              isSaved = parsed.some((item) => {
                const itemId =
                  item && typeof item === "object"
                    ? (item.id ?? item.internship_id ?? item.internshipId)
                    : item;

                return String(itemId) === String(internshipId);
              });
            }
          } catch {
            /* ignore invalid local storage */
          }
        }

        /*
         * Never show a saved state to a default user who
         * has not analyzed a resume.
         */
        setSaved(isDefaultUserWithoutResume() ? false : isSaved);

        checkCoverLetterState();
      } catch (requestError) {
        console.error("Internship details error:", requestError);

        setError(requestError?.message || "Unable to load internship details.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [internshipId, checkCoverLetterState],
  );

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    loadInternship(false);
  }, [loadInternship]);

  /* =======================================================
     WATCH COVER LETTER STATE
  ======================================================= */

  useEffect(() => {
    const refreshCoverLetterState = () => {
      checkCoverLetterState();
    };

    window.addEventListener("focus", refreshCoverLetterState);

    window.addEventListener("storage", refreshCoverLetterState);

    return () => {
      window.removeEventListener("focus", refreshCoverLetterState);

      window.removeEventListener("storage", refreshCoverLetterState);
    };
  }, [checkCoverLetterState]);

  /* =======================================================
     NORMALIZED DISPLAY DATA
  ======================================================= */

  const data = useMemo(() => {
    const item = internship || {};

    const match = matchDetails || {};

    const company = firstValue(
      item.company,
      item.company_name,
      item.companyName,
      item.organization,
      item.organization_name,
      item.employer,
      match.company,
      "Internship Company",
    );

    const title = firstValue(
      item.title,
      item.internship_title,
      item.internshipTitle,
      item.job_title,
      item.jobTitle,
      item.role,
      item.position,
      "Internship Opportunity",
    );

    const location = firstValue(
      item.location,
      item.city,
      item.work_location,
      item.workLocation,
      item.internship_location,
      item.place,
    );

    const duration = firstValue(
      item.duration,
      item.duration_text,
      item.durationText,
      item.duration_months ? `${item.duration_months} Months` : "",
      item.duration_in_months ? `${item.duration_in_months} Months` : "",
    );

    const workMode = firstValue(
      item.work_mode,
      item.workMode,
      item.mode,
      item.work_type,
      item.workType,
    );

    const stipend = firstValue(
      item.stipend,
      item.stipend_range,
      item.stipendRange,
      item.salary,
      item.salary_range,
      item.compensation,
    );

    const category = firstValue(
      item.category,
      item.internship_category,
      item.internshipCategory,
      item.domain,
      item.field,
      item.department,
    );

    const startDate = firstValue(item.start_date, item.startDate, item.start);

    const endDate = firstValue(item.end_date, item.endDate, item.end);

    const deadline = firstValue(
      item.application_deadline,
      item.applicationDeadline,
      item.deadline,
      item.last_date_to_apply,
      item.lastDateToApply,
    );

    const openings = firstValue(
      item.openings,
      item.number_of_openings,
      item.numberOfOpenings,
      item.vacancies,
      item.positions,
    );

    const experience = firstValue(
      item.experience,
      item.experience_required,
      item.experienceRequired,
      item.required_experience,
    );

    const description = firstValue(
      item.description,
      item.job_description,
      item.jobDescription,
      item.overview,
      item.about,
      item.role_description,
    );

    const companyDescription = firstValue(
      item.company_description,
      item.companyDescription,
      item.about_company,
      item.aboutCompany,
      item.company_about,
      item.employer_description,
    );

    const companyWebsite = firstValue(
      item.company_website,
      item.companyWebsite,
      item.website,
      item.website_url,
      item.websiteUrl,
      item.company_url,
      item.companyUrl,
    );

    const responsibilities = normalizeArray(
      firstValue(
        item.responsibilities,
        item.roles_responsibilities,
        item.role_responsibilities,
        item.job_responsibilities,
        item.jobResponsibilities,
      ),
    );

    const requirements = normalizeArray(
      firstValue(
        item.requirements,
        item.technical_requirements,
        item.technicalRequirements,
        item.eligibility,
        item.eligibility_criteria,
        item.eligibilityCriteria,
      ),
    );

    const qualifications = normalizeArray(
      firstValue(
        item.qualifications,
        item.qualification,
        item.education_requirements,
        item.educationRequirements,
        item.educational_qualification,
        item.education,
      ),
    );

    const benefits = normalizeArray(
      firstValue(
        item.benefits,
        item.perks,
        item.internship_benefits,
        item.internshipBenefits,
      ),
    );

    const requiredSkills = normalizeArray(
      firstValue(
        item.skills_required,
        item.required_skills,
        item.requiredSkills,
        item.skills,
        item.technical_skills,
        item.technicalSkills,
        item.skill_requirements,
      ),
    );

    const matchedSkills = normalizeArray(
      firstValue(
        match.matched_skills,
        match.matchedSkills,
        match.matching_skills,
        match.skills_matched,
        match.matched,
        item.matched_skills,
        item.matchedSkills,
      ),
    );

    const missedSkills = normalizeArray(
      firstValue(
        match.missing_skills,
        match.missed_skills,
        match.missingSkills,
        match.skills_missing,
        match.skills_to_improve,
        match.missedSkills,
        item.missing_skills,
        item.missed_skills,
        item.missingSkills,
      ),
    );

    const score = firstValue(
      match.match_percentage,
      match.matchPercentage,
      match.match_score,
      match.matchScore,
      match.match_percent,
      match.score,
      item.match_percentage,
      item.matchPercentage,
      item.match_score,
      item.matchScore,
    );

    return {
      company,
      title,
      location,
      duration,
      workMode,
      stipend,
      category,
      startDate,
      endDate,
      deadline,
      openings,
      experience,
      description,
      companyDescription,
      companyWebsite,
      responsibilities,
      requirements,
      qualifications,
      benefits,
      requiredSkills,
      matchedSkills,
      missedSkills,
      score,
    };
  }, [internship, matchDetails]);

  /* =======================================================
     SAVE / REMOVE
  ======================================================= */

  const handleSave = async () => {
    /*
     * Default users can browse the internship list, but
     * saving is available only after resume analysis.
     */
    if (isDefaultUserWithoutResume()) {
      setError(
        "Please upload and analyze your resume before saving internships.",
      );
      setMessage("");
      return;
    }

    if (!internshipId) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const token = getAuthToken();

      if (!token) {
        setError("Your login session has expired. Please login again.");

        return;
      }

      const method = saved ? "DELETE" : "POST";

      const url = `${API_BASE_URL}/api/internships/${internshipId}/save`;

      const response = await fetch(url, {
        method,
        headers: buildHeaders(),
      });

      const text = await response.text();

      let result = null;

      try {
        result = text ? JSON.parse(text) : null;
      } catch {
        result = null;
      }

      /*
       * If the internship is already saved in the backend but
       * localStorage is out of sync, the backend can return an
       * "already saved" error. Treat that state as saved and
       * synchronize localStorage instead of showing an error.
       */
      if (!response.ok) {
        const backendMessage =
          result?.detail || result?.message || result?.error || text || "";

        const normalizedMessage = String(backendMessage).toLowerCase();

        const alreadySaved =
          !saved &&
          (normalizedMessage.includes("already saved") ||
            normalizedMessage.includes("internship is already saved") ||
            normalizedMessage.includes("already exists"));

        if (alreadySaved) {
          setSaved(true);

          let savedList = [];

          try {
            const stored = JSON.parse(
              localStorage.getItem("savedInternships") || "[]",
            );

            if (Array.isArray(stored)) {
              savedList = stored;
            }
          } catch {
            savedList = [];
          }

          const currentId = String(internshipId);

          const alreadyExists = savedList.some((item) => {
            const itemId =
              item && typeof item === "object"
                ? (item.id ?? item.internship_id ?? item.internshipId)
                : item;

            return String(itemId) === currentId;
          });

          if (!alreadyExists && internship && typeof internship === "object") {
            savedList.push(internship);
          }

          localStorage.setItem("savedInternships", JSON.stringify(savedList));

          window.dispatchEvent(new Event("savedInternshipsChanged"));

          setMessage("Internship saved successfully.");

          return;
        }

        throw new Error(
          backendMessage ||
            `Unable to ${
              saved ? "remove saved internship" : "save internship"
            }.`,
        );
      }

      const newSaved = !saved;

      setSaved(newSaved);

      let savedList = [];

      try {
        const stored = JSON.parse(
          localStorage.getItem("savedInternships") || "[]",
        );

        if (Array.isArray(stored)) {
          savedList = stored;
        }
      } catch {
        savedList = [];
      }

      const currentId = String(internshipId);

      if (newSaved) {
        const alreadySaved = savedList.some((item) => {
          const itemId =
            item && typeof item === "object"
              ? (item.id ?? item.internship_id ?? item.internshipId)
              : item;

          return String(itemId) === currentId;
        });

        if (!alreadySaved) {
          savedList.push(internship);
        }
      } else {
        savedList = savedList.filter((item) => {
          const itemId =
            item && typeof item === "object"
              ? (item.id ?? item.internship_id ?? item.internshipId)
              : item;

          return String(itemId) !== currentId;
        });
      }

      localStorage.setItem("savedInternships", JSON.stringify(savedList));

      window.dispatchEvent(new Event("savedInternshipsChanged"));

      setMessage(
        newSaved
          ? "Internship saved successfully."
          : "Internship removed from saved internships.",
      );
    } catch (requestError) {
      console.error("Save internship error:", requestError);

      setError(requestError?.message || "Unable to update saved internship.");
    } finally {
      setSaving(false);
    }
  };

  /* =======================================================
     COVER LETTER
  ======================================================= */
  const handleCoverLetter = () => {
    /*
     * Default users can browse internships, but cover-letter
     * generation is available only after resume analysis.
     */
    if (isDefaultUserWithoutResume()) {
      setError(
        "Cover letter generation is available after you upload and analyze your resume. Please upload your resume first.",
      );
      setMessage("");
      return;
    }

    if (!internshipId) {
      setError("Internship ID is missing.");
      return;
    }

    /*
     * IMPORTANT:
     * Do not call the AI from this page.
     * This page only opens the Create Cover Letter page.
     *
     * The internship object is passed through router state and
     * the ID is also included in the query string so the page
     * still works after a refresh.
     */
    navigate(
      `/cover-letters/create?internship_id=${encodeURIComponent(
        String(internshipId),
      )}`,
      {
        state: {
          internshipId: String(internshipId),
          internship: internship || null,
          internshipData: internship || null,
          matchDetails: matchDetails || null,
          match: matchDetails || null,
        },
      },
    );
  };

  /* =======================================================
     APPLY
  ======================================================= */

  const handleApply = async () => {
    /*
     * Default users cannot submit applications until their
     * resume has been uploaded and analyzed.
     */
    if (isDefaultUserWithoutResume()) {
      setError(
        "Please upload and analyze your resume before applying to internships.",
      );
      setMessage("");
      return;
    }

    /* =====================================================
       APPLY USING THE GENERATED + SELECTED COVER LETTER
       Backend expects JSON:
       { "cover_letter": "..." }
    ===================================================== */

    if (!internshipId) {
      setError(
        "Internship ID is missing. Please return to the internships page and try again.",
      );
      return;
    }

    /* Apply only after the user explicitly selects a cover letter. */
    if (!coverLetterSelected) {
      setError("Please create and select a cover letter before applying.");
      return;
    }

    /* Prevent double-click submissions. */
    if (applying) {
      return;
    }

    try {
      setApplying(true);
      setError("");
      setMessage("");

      /* =====================================================
         AUTH TOKEN
      ===================================================== */

      const token = getAuthToken();

      if (!token) {
        setError("Your login session has expired. Please login again.");
        return;
      }

      /* =====================================================
         GET SELECTED COVER LETTER
      ===================================================== */

      let selectedCoverLetter = localStorage.getItem(
        `selectedCoverLetterContent_${internshipId}`,
      );

      console.log("APPLY - SELECTED COVER LETTER:", selectedCoverLetter);

      /*
       * Support both formats:
       *
       * 1. Plain text:
       *    "Dear Hiring Manager..."
       *
       * 2. JSON string:
       *    { "cover_letter": "Dear Hiring Manager..." }
       */
      if (selectedCoverLetter) {
        try {
          const parsed = JSON.parse(selectedCoverLetter);

          if (
            parsed &&
            typeof parsed === "object" &&
            typeof parsed.cover_letter === "string"
          ) {
            selectedCoverLetter = parsed.cover_letter;
          }
        } catch {
          /* Stored value is already plain text. */
        }
      }

      /* =====================================================
         VALIDATE COVER LETTER
      ===================================================== */

      if (
        !selectedCoverLetter ||
        typeof selectedCoverLetter !== "string" ||
        !selectedCoverLetter.trim()
      ) {
        setError(
          "The selected cover letter could not be found. Please open the Cover Letter page, select 'Use This Cover Letter' again, and then apply.",
        );
        return;
      }

      selectedCoverLetter = selectedCoverLetter.trim();

      console.log("APPLY - COVER LETTER LENGTH:", selectedCoverLetter.length);

      /* =====================================================
         JSON REQUEST BODY

         IMPORTANT:
         Do NOT use FormData.
         Do NOT create a File.
         Do NOT send a field named `file`.
      ===================================================== */

      const requestBody = {
        cover_letter: selectedCoverLetter,
      };

      console.log("APPLY - REQUEST BODY:", requestBody);

      /* =====================================================
         APPLICATION API
      ===================================================== */

      const url = `${API_BASE_URL}/api/applications/${encodeURIComponent(
        String(internshipId),
      )}`;

      console.log("APPLY - API URL:", url);

      /* =====================================================
         SEND JSON
      ===================================================== */

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      /* =====================================================
         READ RESPONSE
      ===================================================== */

      const responseText = await response.text();

      let result = null;

      try {
        result = responseText ? JSON.parse(responseText) : null;
      } catch {
        result = responseText || null;
      }

      console.log("APPLY - STATUS:", response.status);

      console.log("APPLY - RESPONSE:", result);

      /* =====================================================
         API ERROR
      ===================================================== */

      if (!response.ok) {
        const apiMessage = getApiErrorMessage(
          result,
          `Unable to submit application. Status: ${response.status}`,
        );

        throw new Error(apiMessage);
      }

      /* =====================================================
         SUCCESS
      ===================================================== */

      console.log("APPLICATION SUBMITTED SUCCESSFULLY");

      setMessage(
        typeof result?.message === "string"
          ? result.message
          : "Application submitted successfully.",
      );

      /* Mark this internship as applied locally. */
      localStorage.setItem(`appliedInternship_${internshipId}`, "true");

      /* Store returned application ID when available. */
      const applicationId =
        result?.application?.id ?? result?.application_id ?? result?.id;

      if (applicationId !== undefined && applicationId !== null) {
        localStorage.setItem(
          `applicationId_${internshipId}`,
          String(applicationId),
        );
      }

      /* Go to the Applications page after success. */
      setTimeout(() => {
        navigate("/applications", {
          replace: true,
        });
      }, 1000);
    } catch (requestError) {
      console.error("Application submission error:", requestError);

      const errorMessage =
        requestError instanceof Error
          ? requestError.message
          : getApiErrorMessage(requestError, "Unable to submit application.");

      setError(errorMessage || "Unable to submit application.");
    } finally {
      setApplying(false);
    }
  };

  /* =======================================================
     BACK
  ======================================================= */

  const handleBack = () => {
    navigate("/internships");
  };

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="id-page">
        <div className="id-loading-card">
          <div className="id-loading-orb">
            <div className="id-spinner" />
          </div>

          <span className="id-loading-label">INTERNMATCH AI</span>

          <h2>Preparing internship details</h2>

          <p>Loading the opportunity and your personalized AI match.</p>
        </div>
      </div>
    );
  }

  /* =======================================================
     ERROR WITHOUT DATA
  ======================================================= */

  if (error && !internship) {
    return (
      <div className="id-page">
        <div className="id-error-card">
          <div className="id-error-mark">!</div>

          <span className="id-loading-label">SOMETHING WENT WRONG</span>

          <h2>Unable to load internship</h2>

          <p>{error}</p>

          <div className="id-error-buttons">
            <button
              type="button"
              className="id-button id-button-primary"
              onClick={() => loadInternship(true)}
            >
              <Icon name="refresh" size={17} />
              Try Again
            </button>

            <button
              type="button"
              className="id-button id-button-light"
              onClick={handleBack}
            >
              <Icon name="arrow-left" size={17} />
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <div className="id-page">
      <div className="id-bg-grid" />
      <div className="id-bg-orb id-bg-orb-one" />
      <div className="id-bg-orb id-bg-orb-two" />
      <div className="id-bg-orb id-bg-orb-three" />

      <div className="id-shell">
        {/* TOP NAV */}
        <header className="id-topbar">
          <button type="button" onClick={handleBack} className="id-back-link">
            <span className="id-icon-box id-icon-purple">
              <Icon name="arrow-left" size={16} />
            </span>
            <span>
              <small>BACK TO</small>
              Internships
            </span>
          </button>

          <div className="id-top-actions">
            <button
              type="button"
              className="id-refresh"
              onClick={() => loadInternship(true)}
              disabled={refreshing}
            >
              <Icon name="refresh" size={15} />
              {refreshing ? "Refreshing" : "Refresh details"}
            </button>
          </div>
        </header>

        {/* ALERTS */}
        {error && (
          <div className="id-alert id-alert-error">
            <span className="id-alert-symbol">
              <Icon name="x" size={15} />
            </span>
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Close error"
            >
              <Icon name="close" size={15} />
            </button>
          </div>
        )}

        {message && (
          <div className="id-alert id-alert-success">
            <span className="id-alert-symbol">
              <Icon name="check" size={15} />
            </span>
            <span>{message}</span>
            <button
              type="button"
              onClick={() => setMessage("")}
              aria-label="Close message"
            >
              <Icon name="close" size={15} />
            </button>
          </div>
        )}

        {/* HERO */}
        <section className="id-hero">
          <div className="id-hero-glow" />

          <div className="id-hero-main">
            <div className="id-company-logo-wrap">
              <div className="id-company-logo">
                <Icon name="building" size={31} />
              </div>
              <span className="id-verified">
                <Icon name="check" size={11} />
              </span>
            </div>

            <div className="id-hero-copy">
              <div className="id-eyebrow">
                <span>INTERNSHIP OPPORTUNITY</span>
                {data.category && <b>{data.category}</b>}
              </div>

              <h1>{data.title}</h1>
              <p className="id-company-name">{data.company}</p>

              <div className="id-hero-meta">
                {data.location && (
                  <span>
                    <Icon name="location" size={15} />
                    {data.location}
                  </span>
                )}
                {data.duration && (
                  <span>
                    <Icon name="clock" size={15} />
                    {data.duration}
                  </span>
                )}
                {data.workMode && (
                  <span>
                    <Icon name="briefcase" size={15} />
                    {data.workMode}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="id-match-card">
            <div
              className="id-match-ring"
              style={{
                "--match": `${Math.min(100, Math.max(0, Number(data.score) || 0))}%`,
              }}
            >
              <div className="id-match-ring-inner">
                <strong>
                  {data.score !== ""
                    ? `${Math.round(Number(data.score))}%`
                    : "—"}
                </strong>
                <span>MATCH</span>
              </div>
            </div>
            <div className="id-match-copy">
              <span>AI PROFILE MATCH</span>
              <h3>
                {Number(data.score) >= 80
                  ? "Excellent match"
                  : Number(data.score) >= 60
                    ? "Strong match"
                    : "Good opportunity"}
              </h3>
              <p>Based on your profile and required skills.</p>
            </div>
          </div>
        </section>

        {/* ACTION BAR */}
        <section className="id-action-panel">
          <div className="id-action-intro">
            <div className="id-action-icon">
              <Icon name="sparkle" size={20} />
            </div>
            <div>
              <span>YOUR NEXT STEP</span>
              <h2>Ready to move forward?</h2>
              <p>
                Create your personalized cover letter, save this role, then
                apply.
              </p>
            </div>
          </div>

          <div className="id-action-buttons">
            <button
              type="button"
              className={`id-action-btn id-save-btn ${saved ? "saved" : ""}`}
              onClick={handleSave}
              disabled={saving}
            >
              <Icon name="bookmark" size={17} />
              {saving ? "Saving..." : saved ? "Saved" : "Save internship"}
            </button>

            <button
              type="button"
              className="id-action-btn id-cover-btn"
              onClick={handleCoverLetter}
            >
              <Icon name="document" size={17} />
              {coverLetterSelected
                ? "Open cover letter"
                : "Create cover letter"}
            </button>

            <button
              type="button"
              className={`id-action-btn id-apply-btn ${coverLetterSelected ? "active" : "disabled"}`}
              onClick={handleApply}
              disabled={applying || !coverLetterSelected}
            >
              {applying ? "Submitting..." : "Apply now"}
              <Icon name="arrow-right" size={17} />
            </button>
          </div>
        </section>

        {!coverLetterSelected && (
          <div className="id-apply-hint">
            <Icon name="document" size={14} />
            Create and select a cover letter to unlock{" "}
            <strong>Apply now</strong>.
          </div>
        )}

        {/* QUICK STATS */}
        <section className="id-stat-grid">
          <InfoCard icon="money" label="Stipend" value={data.stipend} />
          <InfoCard
            icon="calendar"
            label="Application deadline"
            value={formatDate(data.deadline)}
          />
          <InfoCard
            icon="calendar"
            label="Start date"
            value={formatDate(data.startDate)}
          />
          <InfoCard icon="users" label="Openings" value={data.openings} />
          <InfoCard
            icon="graduation"
            label="Experience"
            value={data.experience}
          />
          <InfoCard icon="building" label="Company" value={data.company} />
        </section>

        {/* CONTENT */}
        <div className="id-content-grid">
          <div className="id-content-main">
            {/* ABOUT ROLE */}
            <section className="id-glass-section id-description-section">
              <div className="id-section-heading">
                <div className="id-section-icon purple">
                  <Icon name="document" size={19} />
                </div>
                <div>
                  <span>ABOUT THE ROLE</span>
                  <h2>Internship description</h2>
                </div>
              </div>
              <div className="id-description-text">
                <p>{formatValue(data.description)}</p>
              </div>
            </section>

            {/* SKILL MATCH */}
            <section className="id-glass-section">
              <div className="id-section-heading id-section-heading-row">
                <div className="id-section-heading-left">
                  <div className="id-section-icon blue">
                    <Icon name="sparkle" size={19} />
                  </div>
                  <div>
                    <span>AI PROFILE ANALYSIS</span>
                    <h2>How your skills match</h2>
                  </div>
                </div>
                {data.score !== "" && (
                  <div className="id-match-mini">
                    <Icon name="sparkle" size={13} />
                    {Math.round(Number(data.score))}% match
                  </div>
                )}
              </div>

              <div className="id-match-progress">
                <div className="id-progress-top">
                  <span>Profile compatibility</span>
                  <strong>
                    {data.score !== ""
                      ? `${Math.round(Number(data.score))}%`
                      : "—"}
                  </strong>
                </div>
                <div className="id-progress-track">
                  <span
                    style={{
                      width: `${Math.min(100, Math.max(0, Number(data.score) || 0))}%`,
                    }}
                  />
                </div>
              </div>

              <div className="id-skill-grid">
                <div className="id-skill-panel matched">
                  <div className="id-skill-panel-head">
                    <div className="id-skill-panel-icon">
                      <Icon name="check" size={17} />
                    </div>
                    <div>
                      <span>YOUR STRENGTHS</span>
                      <h3>Matched skills</h3>
                    </div>
                    <strong>{data.matchedSkills.length}</strong>
                  </div>
                  {data.matchedSkills.length > 0 ? (
                    <div className="id-skill-chips">
                      {data.matchedSkills.map((skill, index) => (
                        <span
                          className="id-skill-chip matched"
                          key={`matched-${index}`}
                        >
                          <Icon name="check" size={11} />
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="id-skill-empty">
                      No matched skills were returned by the backend.
                    </div>
                  )}
                </div>

                <div className="id-skill-panel missing">
                  <div className="id-skill-panel-head">
                    <div className="id-skill-panel-icon">
                      <Icon name="x" size={16} />
                    </div>
                    <div>
                      <span>AREAS TO IMPROVE</span>
                      <h3>Skills to improve</h3>
                    </div>
                    <strong>{data.missedSkills.length}</strong>
                  </div>
                  {data.missedSkills.length > 0 ? (
                    <div className="id-skill-chips">
                      {data.missedSkills.map((skill, index) => (
                        <span
                          className="id-skill-chip missing"
                          key={`missing-${index}`}
                        >
                          <Icon name="x" size={11} />
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="id-no-missing">
                      <Icon name="check" size={14} />
                      No missing skills detected.
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* REQUIRED SKILLS */}
            <section className="id-glass-section">
              <div className="id-section-heading">
                <div className="id-section-icon cyan">
                  <Icon name="briefcase" size={19} />
                </div>
                <div>
                  <span>TECHNICAL REQUIREMENTS</span>
                  <h2>Skills required</h2>
                </div>
              </div>
              {data.requiredSkills.length > 0 ? (
                <div className="id-required-skills">
                  {data.requiredSkills.map((skill, index) => (
                    <span
                      key={`required-${index}`}
                      className="id-required-chip"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="id-empty-box">
                  Required skills were not provided by the internship API.
                </div>
              )}
            </section>

            {/* RESPONSIBILITIES + REQUIREMENTS */}
            <section className="id-two-column">
              <ListCard
                icon="briefcase"
                label="YOUR ROLE"
                title="Responsibilities"
                items={data.responsibilities}
                variant="purple"
              />
              <ListCard
                icon="document"
                label="ELIGIBILITY"
                title="Requirements"
                items={data.requirements}
                variant="blue"
              />
            </section>

            {/* QUALIFICATIONS + BENEFITS */}
            <section className="id-two-column">
              <ListCard
                icon="graduation"
                label="EDUCATION"
                title="Qualifications"
                items={data.qualifications}
                variant="cyan"
              />
              <ListCard
                icon="sparkle"
                label="WHAT YOU GET"
                title="Benefits & Perks"
                items={data.benefits}
                variant="green"
              />
            </section>
          </div>

          {/* SIDEBAR */}
          <aside className="id-sidebar">
            <section className="id-sidebar-card id-sticky-card">
              <div className="id-sidebar-top">
                <div className="id-sidebar-icon">
                  <Icon name="briefcase" size={19} />
                </div>
                <span>OPPORTUNITY SNAPSHOT</span>
              </div>
              <h2>{data.title}</h2>
              <p className="id-sidebar-company">{data.company}</p>

              <div className="id-sidebar-list">
                <div>
                  <Icon name="location" size={16} />
                  <span>
                    <small>Location</small>
                    <strong>{formatValue(data.location)}</strong>
                  </span>
                </div>
                <div>
                  <Icon name="clock" size={16} />
                  <span>
                    <small>Duration</small>
                    <strong>{formatValue(data.duration)}</strong>
                  </span>
                </div>
                <div>
                  <Icon name="money" size={16} />
                  <span>
                    <small>Stipend</small>
                    <strong>{formatValue(data.stipend)}</strong>
                  </span>
                </div>
                <div>
                  <Icon name="calendar" size={16} />
                  <span>
                    <small>Deadline</small>
                    <strong>{formatDate(data.deadline)}</strong>
                  </span>
                </div>
              </div>

              <button
                type="button"
                className={`id-sidebar-apply ${coverLetterSelected ? "active" : ""}`}
                onClick={coverLetterSelected ? handleApply : handleCoverLetter}
                disabled={applying}
              >
                <span>
                  {coverLetterSelected
                    ? applying
                      ? "Submitting..."
                      : "Apply now"
                    : "Create cover letter"}
                </span>
                <Icon name="arrow-right" size={16} />
              </button>

              <button
                type="button"
                className={`id-sidebar-save ${saved ? "saved" : ""}`}
                onClick={handleSave}
                disabled={saving}
              >
                <Icon name="bookmark" size={15} />
                {saved ? "Saved to your opportunities" : "Save for later"}
              </button>
            </section>

            {data.companyWebsite && (
              <section className="id-sidebar-card id-company-mini">
                <div className="id-company-mini-logo">
                  <Icon name="building" size={21} />
                </div>
                <div>
                  <span>COMPANY</span>
                  <h3>{data.company}</h3>
                </div>
                <a
                  href={
                    String(data.companyWebsite).startsWith("http")
                      ? data.companyWebsite
                      : `https://${data.companyWebsite}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Company website"
                >
                  <Icon name="globe" size={15} />
                </a>
              </section>
            )}
          </aside>
        </div>

        {/* COMPANY */}
        <section className="id-glass-section id-company-section">
          <div className="id-section-heading id-section-heading-row">
            <div className="id-section-heading-left">
              <div className="id-section-icon orange">
                <Icon name="building" size={19} />
              </div>
              <div>
                <span>COMPANY</span>
                <h2>About {data.company}</h2>
              </div>
            </div>
            {data.companyWebsite && (
              <a
                className="id-company-website"
                href={
                  String(data.companyWebsite).startsWith("http")
                    ? data.companyWebsite
                    : `https://${data.companyWebsite}`
                }
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="globe" size={15} />
                Company website
              </a>
            )}
          </div>
          <div className="id-company-card">
            <div className="id-company-card-logo">
              <Icon name="building" size={25} />
            </div>
            <div>
              <span>ORGANIZATION</span>
              <h3>{data.company}</h3>
              <p>{formatValue(data.category, "Internship Provider")}</p>
            </div>
            <div className="id-company-description">
              <h3>Company overview</h3>
              <p>
                {formatValue(
                  data.companyDescription,
                  `${data.company} is offering this internship opportunity. Additional company information will appear here when it is provided by the internship database.`,
                )}
              </p>
            </div>
          </div>
        </section>

        {/* APPLICATION WORKFLOW */}
        <section className="id-workflow-section">
          <div className="id-section-heading">
            <div className="id-section-icon green">
              <Icon name="check" size={19} />
            </div>
            <div>
              <span>APPLICATION WORKFLOW</span>
              <h2>Complete your application</h2>
            </div>
          </div>

          <div className="id-workflow">
            <div className="id-workflow-step completed">
              <div className="id-workflow-number">
                <Icon name="check" size={14} />
              </div>
              <div>
                <span>STEP 01</span>
                <h3>Review internship</h3>
                <p>
                  Check the role, company, requirements and your AI skill match.
                </p>
              </div>
            </div>
            <div className="id-workflow-connector" />
            <div
              className={`id-workflow-step ${coverLetterSelected ? "completed" : "current"}`}
            >
              <div className="id-workflow-number">
                {coverLetterSelected ? <Icon name="check" size={14} /> : "02"}
              </div>
              <div>
                <span>STEP 02</span>
                <h3>Create cover letter</h3>
                <p>Generate and select the cover letter you want to use.</p>
                <button
                  type="button"
                  className="id-workflow-action"
                  onClick={handleCoverLetter}
                >
                  {coverLetterSelected
                    ? "Open cover letter"
                    : "Create cover letter"}
                  <Icon name="arrow-right" size={14} />
                </button>
              </div>
            </div>
            <div className="id-workflow-connector" />
            <div
              className={`id-workflow-step ${coverLetterSelected ? "current" : "locked"}`}
            >
              <div className="id-workflow-number">03</div>
              <div>
                <span>STEP 03</span>
                <h3>Submit application</h3>
                <p>
                  {coverLetterSelected
                    ? "Your application is ready to submit."
                    : "Select a cover letter first to unlock this step."}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="id-final-panel">
          <div className="id-final-copy">
            <div className="id-final-icon">
              <Icon name="shield" size={20} />
            </div>
            <div>
              <span>
                {coverLetterSelected ? "READY TO APPLY" : "ALMOST THERE"}
              </span>
              <h2>
                {coverLetterSelected
                  ? "Your application is ready."
                  : "Create your personalized cover letter."}
              </h2>
              <p>
                {coverLetterSelected
                  ? "Your selected cover letter is ready. Submit your application when you're ready."
                  : "Create and select a cover letter to unlock the final application step."}
              </p>
            </div>
          </div>
          <div className="id-final-buttons">
            <button
              type="button"
              className="id-button id-button-light"
              onClick={handleBack}
            >
              <Icon name="arrow-left" size={16} />
              Back to internships
            </button>
            <button
              type="button"
              className="id-button id-button-primary"
              onClick={handleCoverLetter}
            >
              <Icon name="document" size={16} />
              {coverLetterSelected
                ? "Open cover letter"
                : "Generate cover letter"}
              <Icon name="arrow-right" size={15} />
            </button>
            <button
              type="button"
              className={`id-button id-final-apply ${coverLetterSelected ? "active" : "disabled"}`}
              disabled={applying || !coverLetterSelected}
              onClick={handleApply}
            >
              {applying ? "Submitting..." : "Apply now"}
              <Icon name="arrow-right" size={16} />
            </button>
          </div>
        </section>

        <div className="id-security">
          <span>
            <Icon name="shield" size={14} />
          </span>
          Your profile, cover letter and application information are securely
          handled by InternMatch AI.
        </div>
      </div>
    </div>
  );
}

export default InternshipDetails;

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Clipboard,
  Download,
  FileText,
  Globe2,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  Target,
  UserRound,
  XCircle,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import "../styles/CreateCoverLetter.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

/* =========================================================
   TOKEN
   Important:
   InternshipDetails uses localStorage token names while
   older CoverLetter pages used only AuthContext.token.
   This page supports both so navigation does not randomly
   send a logged-in user to /login.
========================================================= */
function getToken(auth) {
  const candidates = [
    auth?.token,
    auth?.accessToken,
    auth?.access_token,
    localStorage.getItem("access_token"),
    localStorage.getItem("accessToken"),
    localStorage.getItem("token"),
    localStorage.getItem("authToken"),
    localStorage.getItem("jwt"),
  ];

  const token = candidates.find((value) => value && String(value).trim());

  if (!token) return null;

  return String(token).startsWith("Bearer ")
    ? String(token).slice(7)
    : String(token);
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
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .flatMap((item) =>
        item && typeof item === "object" ? Object.values(item) : [item],
      )
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

function normalizeInternshipResponse(response) {
  if (!response) return {};

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

function normalizeCoverLetterResponse(response) {
  if (!response) return null;

  // The actual FastAPI API returns cover_letter as a string.
  if (typeof response.cover_letter === "string") {
    return {
      ...response,
      content: response.cover_letter.trim(),
    };
  }

  if (response.cover_letter && typeof response.cover_letter === "object") {
    return {
      ...response.cover_letter,
      ...response,
      content:
        response.cover_letter.content ||
        response.cover_letter.text ||
        response.cover_letter.letter ||
        "",
    };
  }

  if (typeof response.data?.cover_letter === "string") {
    return {
      ...response.data,
      ...response,
      content: response.data.cover_letter.trim(),
    };
  }

  if (
    response.data?.cover_letter &&
    typeof response.data.cover_letter === "object"
  ) {
    return {
      ...response.data.cover_letter,
      ...response.data,
      ...response,
      content:
        response.data.cover_letter.content ||
        response.data.cover_letter.text ||
        response.data.cover_letter.letter ||
        "",
    };
  }

  if (typeof response.content === "string") {
    return {
      ...response,
      content: response.content.trim(),
    };
  }

  if (typeof response.data?.content === "string") {
    return {
      ...response.data,
      ...response,
      content: response.data.content.trim(),
    };
  }

  return response;
}

function getInternshipId(item) {
  return firstValue(item?.internship_id, item?.internshipId, item?.id);
}

function getTitle(item) {
  return firstValue(
    item?.title,
    item?.internship_title,
    item?.internshipTitle,
    item?.job_title,
    item?.role,
    "Internship Opportunity",
  );
}

function getCompany(item) {
  return firstValue(
    item?.company,
    item?.company_name,
    item?.companyName,
    item?.organization,
    item?.organization_name,
    item?.employer,
    "Company",
  );
}

function getLocation(item) {
  return firstValue(
    item?.location,
    item?.city,
    item?.work_location,
    item?.workLocation,
    item?.internship_location,
    item?.place,
  );
}

function getWorkMode(item) {
  return firstValue(
    item?.work_mode,
    item?.workMode,
    item?.mode,
    item?.work_type,
    item?.workType,
  );
}

function getDuration(item) {
  return firstValue(
    item?.duration,
    item?.duration_text,
    item?.durationText,
    item?.duration_months ? `${item.duration_months} Months` : "",
    item?.duration_in_months ? `${item.duration_in_months} Months` : "",
  );
}

function getRequiredSkills(item) {
  return normalizeArray(
    firstValue(
      item?.required_skills,
      item?.requiredSkills,
      item?.skills,
      item?.technical_skills,
    ),
  );
}

function getInitial(company) {
  return (
    String(company || "I")
      .trim()
      .charAt(0)
      .toUpperCase() || "I"
  );
}

/* =========================================================
   ICON BADGE
========================================================= */
function IconBadge({ children, className = "" }) {
  return <div className={`cl-icon-badge ${className}`}>{children}</div>;
}

/* =========================================================
   MAIN
========================================================= */
export default function CreateCoverLetter() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const params = useParams();
  const auth = useAuth();

  const token = getToken(auth);

  const stateInternship =
    routerLocation.state?.internship ||
    routerLocation.state?.internshipData ||
    null;

  const query = useMemo(
    () => new URLSearchParams(routerLocation.search || ""),
    [routerLocation.search],
  );

  const routeInternshipId = firstValue(
    params?.internshipId,
    params?.internship_id,
    params?.id,
    query.get("internship_id"),
    query.get("internshipId"),
    query.get("id"),
    routerLocation.state?.internshipId,
    routerLocation.state?.internship_id,
    getInternshipId(stateInternship),
  );

  const [internship, setInternship] = useState(stateInternship);

  const [coverLetter, setCoverLetter] = useState(null);

  const [loadingInternship, setLoadingInternship] = useState(!stateInternship);

  const [generating, setGenerating] = useState(false);

  const [selecting, setSelecting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);

  const internshipId = routeInternshipId || getInternshipId(internship);

  const selectedId = localStorage.getItem(
    `selectedCoverLetterId_${internshipId}`,
  );

  const selectedContent = localStorage.getItem(
    `selectedCoverLetterContent_${internshipId}`,
  );

  const isSelected =
    Boolean(selectedContent && selectedContent.trim()) &&
    ((coverLetter?.cover_letter_id &&
      selectedId &&
      String(selectedId) === String(coverLetter.cover_letter_id)) ||
      localStorage.getItem(`coverLetterSelected_${internshipId}`) === "true");

  /* =========================================================
     LOAD INTERNSHIP
  ========================================================= */
  const loadInternship = useCallback(async () => {
    if (stateInternship) {
      setInternship((previous) => ({
        ...(previous || {}),
        ...stateInternship,
      }));
      setLoadingInternship(false);
      return;
    }

    if (!internshipId) {
      setLoadingInternship(false);
      setError(
        "Internship information is missing. Please return to Internship Details and try again.",
      );
      return;
    }

    try {
      setLoadingInternship(true);
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/api/internships/${internshipId}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      const text = await response.text();
      let data = null;

      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            `Unable to load internship. Status: ${response.status}`,
        );
      }

      setInternship(normalizeInternshipResponse(data));
    } catch (err) {
      console.error("Create cover letter internship load error:", err);

      setError(err?.message || "Unable to load internship information.");
    } finally {
      setLoadingInternship(false);
    }
  }, [stateInternship, internshipId, token]);

  useEffect(() => {
    loadInternship();
  }, [loadInternship]);

  /* =========================================================
     GENERATE
  ========================================================= */
  const handleGenerate = async () => {
    const dashboardType = localStorage.getItem("dashboard_type") || "default";

    if (dashboardType === "default") {
      setError(
        "Cover letter generation is available after you upload and analyze your resume. Please upload your resume first.",
      );
      return;
    }

    if (!token) {
      setError("Your login session could not be found. Please sign in again.");
      return;
    }

    if (!internshipId) {
      setError(
        "Internship ID is missing. Please return to Internship Details.",
      );
      return;
    }

    try {
      setGenerating(true);
      setError("");
      setSuccess("");
      setCopied(false);

      const response = await fetch(
        `${API_BASE_URL}/api/cover-letters/generate/${encodeURIComponent(
          String(internshipId),
        )}`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const responseText = await response.text();

      let result = null;

      try {
        result = responseText ? JSON.parse(responseText) : null;
      } catch {
        result = null;
      }

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            "Your login session has expired or is invalid. Please sign in again.",
          );
        }

        if (response.status === 403) {
          throw new Error(
            "You are not authorized to generate a cover letter for this internship.",
          );
        }

        throw new Error(
          result?.detail ||
            result?.message ||
            `Cover letter generation failed. Status: ${response.status}`,
        );
      }

      const normalized = normalizeCoverLetterResponse(result);

      /*
       * IMPORTANT:
       * The FastAPI endpoint returns cover_letter as a STRING:
       *
       * {
       *   "message": "Cover letter generated successfully",
       *   "internship_id": 1,
       *   "company_name": "Infosys",
       *   "job_title": "Frontend Developer Intern",
       *   "cover_letter": "Dear Hiring Manager,..."
       * }
       *
       * Therefore we must read result.cover_letter directly.
       * Do not use result.cover_letter.content because
       * cover_letter is not an object in this API response.
       */
      let content = "";

      if (typeof result === "string") {
        content = result;
      } else if (typeof result?.cover_letter === "string") {
        content = result.cover_letter;
      } else if (typeof result?.content === "string") {
        content = result.content;
      } else if (typeof result?.data?.cover_letter === "string") {
        content = result.data.cover_letter;
      } else if (typeof result?.data?.content === "string") {
        content = result.data.content;
      } else if (typeof normalized?.content === "string") {
        content = normalized.content;
      } else if (typeof normalized?.cover_letter === "string") {
        content = normalized.cover_letter;
      }

      content = String(content || "").trim();

      console.log("COVER LETTER EXTRACTED CONTENT LENGTH:", content.length);

      if (!content) {
        console.error(
          "Successful API response but no cover-letter text was found:",
          result,
        );

        throw new Error("The cover-letter API returned an empty cover letter.");
      }

      const completeLetter = {
        ...normalized,
        content: String(content).trim(),
        internship_id:
          normalized?.internship_id || normalized?.internshipId || internshipId,
        internship_title:
          normalized?.internship_title ||
          normalized?.internshipTitle ||
          getTitle(internship),
        company:
          normalized?.company ||
          normalized?.company_name ||
          getCompany(internship),
        candidate_name:
          normalized?.candidate_name || normalized?.candidateName || "",
      };

      setCoverLetter(completeLetter);

      setSuccess("Your personalized cover letter is ready.");
    } catch (err) {
      console.error("Cover letter generation error:", err);

      setError(err?.message || "Unable to generate the cover letter.");
    } finally {
      setGenerating(false);
    }
  };

  /* =========================================================
   SELECT LETTER
========================================================= */
  const handleSelect = async () => {
    if (!internshipId || !coverLetter?.content) {
      setError("Please generate a cover letter first.");
      return;
    }

    try {
      setSelecting(true);
      setError("");
      setSuccess("");

      /*
       * Get cover letter ID if backend provides one.
       */
      const coverLetterId =
        coverLetter.cover_letter_id ||
        coverLetter.id ||
        `generated-${Date.now()}`;

      /*
       * Save the selected cover letter ID.
       */
      localStorage.setItem(
        `selectedCoverLetterId_${internshipId}`,
        String(coverLetterId),
      );

      localStorage.setItem(
        `selectedCoverLetterContent_${internshipId}`,
        String(coverLetter.content).trim(),
      );

      /*
       * Save company and internship information.
       */
      localStorage.setItem(
        `selectedCoverLetterCompany_${internshipId}`,
        String(
          coverLetter.company ||
            coverLetter.company_name ||
            getCompany(internship),
        ),
      );

      localStorage.setItem(
        `selectedCoverLetterTitle_${internshipId}`,
        String(
          coverLetter.internship_title ||
            coverLetter.internshipTitle ||
            coverLetter.job_title ||
            getTitle(internship),
        ),
      );

      /*
       * Keep all existing selection flags
       * for compatibility with InternshipDetails.jsx.
       */
      localStorage.setItem(`coverLetterSelected_${internshipId}`, "true");

      localStorage.setItem(`selectedCoverLetter_${internshipId}`, "true");

      localStorage.setItem(`cover_letter_selected_${internshipId}`, "true");

      localStorage.setItem(`coverLetterUsed_${internshipId}`, "true");

      /*
       * Also keep a complete copy for debugging/future use.
       */
      localStorage.setItem(
        `selectedCoverLetterData_${internshipId}`,
        JSON.stringify({
          id: coverLetterId,
          internship_id: internshipId,
          internship_title:
            coverLetter.internship_title ||
            coverLetter.internshipTitle ||
            coverLetter.job_title ||
            getTitle(internship),
          company:
            coverLetter.company ||
            coverLetter.company_name ||
            getCompany(internship),
          candidate_name:
            coverLetter.candidate_name || coverLetter.candidateName || "",
          content: String(coverLetter.content).trim(),
        }),
      );

      console.log("COVER LETTER SELECTED:", {
        internshipId,
        coverLetterId,
        contentLength: String(coverLetter.content).trim().length,
      });

      setSuccess(
        "Cover letter selected. You can now apply for this internship.",
      );
    } catch (err) {
      console.error("Cover letter selection error:", err);

      setError(err?.message || "Unable to select this cover letter.");
    } finally {
      setSelecting(false);
    }
  };

  /* =========================================================
     COPY
  ========================================================= */
  const handleCopy = async () => {
    if (!coverLetter?.content) return;

    try {
      await navigator.clipboard.writeText(coverLetter.content);

      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Unable to copy the cover letter.");
    }
  };

  /* =========================================================
     DOWNLOAD TXT
  ========================================================= */
  const handleDownload = () => {
    if (!coverLetter?.content) return;

    const filename = `${getTitle(internship)}-cover-letter`
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

    const blob = new Blob([coverLetter.content], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${filename || "cover-letter"}.txt`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  /* =========================================================
     PRINT / SAVE AS PDF
  ========================================================= */
  const handlePrint = () => {
    if (!coverLetter?.content) return;
    window.print();
  };

  /* =========================================================
     BACK
  ========================================================= */
  const handleBack = () => {
    if (internshipId) {
      navigate(`/internships/${internshipId}`, {
        state: {
          internship,
        },
      });
      return;
    }

    navigate("/internships");
  };

  /* =========================================================
     LOADING
  ========================================================= */
  if (loadingInternship) {
    return (
      <div className="create-cover-letter-page">
        <div className="cl-background-orb cl-orb-one" />
        <div className="cl-background-orb cl-orb-two" />

        <section className="cl-loading-card">
          <div className="cl-loading-icon">
            <Loader2 size={31} />
          </div>

          <span className="cl-eyebrow">INTERNMATCH AI</span>

          <h1>Preparing your cover letter workspace</h1>

          <p>
            Loading the selected internship so the AI can personalize your
            application.
          </p>
        </section>
      </div>
    );
  }

  const title = getTitle(internship);
  const company = getCompany(internship);
  const location = getLocation(internship);
  const workMode = getWorkMode(internship);
  const duration = getDuration(internship);
  const skills = getRequiredSkills(internship);

  return (
    <div className="create-cover-letter-page">
      <div className="cl-background-grid" />
      <div className="cl-background-orb cl-orb-one" />
      <div className="cl-background-orb cl-orb-two" />
      <div className="cl-background-orb cl-orb-three" />

      <main className="cl-shell">
        {/* =================================================
            TOP NAV
        ================================================= */}
        <header className="cl-topbar">
          <button type="button" className="cl-back-button" onClick={handleBack}>
            <ArrowLeft size={17} />
            <span>Back to Internship</span>
          </button>

          <div className="cl-brand">
            <div className="cl-brand-mark">
              <Sparkles size={16} />
            </div>
            <div>
              <strong>InternMatch AI</strong>
              <span>Career Document Studio</span>
            </div>
          </div>

          <div className="cl-secure">
            <Target size={14} />
            AI Personalized
          </div>
        </header>

        {/* =================================================
            HERO
        ================================================= */}
        <section className="cl-hero">
          <div className="cl-hero-copy">
            <div className="cl-hero-badge">
              <Sparkles size={14} />
              AI CAREER DOCUMENT
            </div>

            <h1>
              Create a cover letter
              <span> that gets noticed.</span>
            </h1>

            <p>
              Generate a professional, internship-specific cover letter using
              your resume profile and the requirements of this opportunity.
            </p>

            <div className="cl-hero-points">
              <span>
                <CheckCircle2 size={15} />
                Resume-aware
              </span>

              <span>
                <CheckCircle2 size={15} />
                Internship-specific
              </span>

              <span>
                <CheckCircle2 size={15} />
                Professional tone
              </span>
            </div>
          </div>

          <div className="cl-ai-orb">
            <div className="cl-ai-orb-ring cl-ring-one" />
            <div className="cl-ai-orb-ring cl-ring-two" />
            <div className="cl-ai-orb-core">
              <FileText size={38} />
              <Sparkles className="cl-ai-sparkle" size={18} />
            </div>
          </div>
        </section>

        {/* =================================================
            ALERTS
        ================================================= */}
        {error && (
          <div className="cl-alert cl-alert-error">
            <XCircle size={18} />
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Close error"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="cl-alert cl-alert-success">
            <CheckCircle2 size={18} />
            <span>{success}</span>
            <button
              type="button"
              onClick={() => setSuccess("")}
              aria-label="Close success message"
            >
              ×
            </button>
          </div>
        )}

        {/* =================================================
            SELECTED INTERNSHIP
        ================================================= */}
        <section className="cl-opportunity-card">
          <div className="cl-company-avatar">{getInitial(company)}</div>

          <div className="cl-opportunity-main">
            <span className="cl-small-label">COVER LETTER FOR</span>

            <h2>{title}</h2>

            <div className="cl-company-line">
              <strong>{company}</strong>

              {location && (
                <>
                  <i />
                  <span>
                    <MapPin size={13} />
                    {location}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="cl-opportunity-meta">
            {workMode && (
              <span>
                <Globe2 size={14} />
                {workMode}
              </span>
            )}

            {duration && (
              <span>
                <CalendarDays size={14} />
                {duration}
              </span>
            )}
          </div>
        </section>

        {/* =================================================
            WORKSPACE
        ================================================= */}
        <section className="cl-workspace">
          {/* LEFT */}
          <div className="cl-main-column">
            {!coverLetter && (
              <section className="cl-generate-card">
                <div className="cl-generate-icon">
                  <Sparkles size={31} />
                </div>

                <span className="cl-section-eyebrow">READY TO GENERATE</span>

                <h2>Build your personalized letter</h2>

                <p>
                  InternMatch AI will use your parsed resume profile, skills,
                  projects, education and this internship's requirements to
                  create a tailored application letter.
                </p>

                <div className="cl-generate-features">
                  <div>
                    <IconBadge>
                      <UserRound size={17} />
                    </IconBadge>
                    <span>
                      <strong>Your profile</strong>
                      <small>Resume information</small>
                    </span>
                  </div>

                  <div>
                    <IconBadge>
                      <Target size={17} />
                    </IconBadge>
                    <span>
                      <strong>Opportunity</strong>
                      <small>Internship requirements</small>
                    </span>
                  </div>

                  <div>
                    <IconBadge>
                      <Sparkles size={17} />
                    </IconBadge>
                    <span>
                      <strong>AI writing</strong>
                      <small>Professional personalization</small>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="cl-primary-button cl-generate-button"
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  {generating ? (
                    <>
                      <Loader2 size={18} className="cl-spin" />
                      Creating your letter...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Generate Cover Letter
                    </>
                  )}
                </button>

                <p className="cl-generate-note">
                  <CheckCircle2 size={14} />
                  You can regenerate the letter if you want a different version.
                </p>
              </section>
            )}

            {coverLetter && (
              <section className="cl-letter-card">
                <div className="cl-letter-toolbar">
                  <div className="cl-letter-title">
                    <div className="cl-document-icon">
                      <FileText size={20} />
                    </div>

                    <div>
                      <span>AI GENERATED DOCUMENT</span>
                      <h2>Your Cover Letter</h2>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="cl-selected-badge">
                      <CheckCircle2 size={15} />
                      Selected
                    </div>
                  )}
                </div>

                <div className="cl-letter-paper">
                  <div className="cl-paper-topline">
                    <span>{company}</span>
                    <span>InternMatch AI</span>
                  </div>

                  <div className="cl-paper-content">
                    <p className="cl-letter-greeting">Dear Hiring Team,</p>

                    {String(coverLetter.content)
                      .split(/\n\s*\n/)
                      .filter(Boolean)
                      .map((paragraph, index) => (
                        <p key={index}>{paragraph.trim()}</p>
                      ))}

                    <p>
                      Sincerely,
                      <br />
                      <strong>
                        {coverLetter.candidate_name || "Candidate"}
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="cl-letter-actions">
                  <button
                    type="button"
                    className="cl-secondary-button"
                    onClick={handleGenerate}
                    disabled={generating}
                  >
                    {generating ? (
                      <Loader2 size={16} className="cl-spin" />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                    Regenerate
                  </button>

                  <button
                    type="button"
                    className="cl-secondary-button"
                    onClick={handleCopy}
                  >
                    {copied ? <Check size={16} /> : <Clipboard size={16} />}
                    {copied ? "Copied" : "Copy"}
                  </button>

                  <button
                    type="button"
                    className="cl-secondary-button"
                    onClick={handlePrint}
                  >
                    <FileText size={16} />
                    Print / PDF
                  </button>

                  <button
                    type="button"
                    className="cl-primary-button"
                    onClick={handleDownload}
                  >
                    <Download size={16} />
                    Download
                  </button>
                </div>

                <div className="cl-select-panel">
                  <div>
                    <span className="cl-select-kicker">FINAL STEP</span>
                    <h3>Use this cover letter for your application?</h3>
                    <p>
                      Select it to unlock the Apply button on the internship
                      details page.
                    </p>
                  </div>

                  <button
                    type="button"
                    className={`cl-select-button ${
                      isSelected ? "selected" : ""
                    }`}
                    onClick={handleSelect}
                    disabled={selecting || isSelected}
                  >
                    {selecting ? (
                      <Loader2 size={17} className="cl-spin" />
                    ) : isSelected ? (
                      <CheckCircle2 size={17} />
                    ) : (
                      <Check size={17} />
                    )}

                    {isSelected ? "Selected" : "Use This Cover Letter"}
                  </button>
                </div>
              </section>
            )}
          </div>

          {/* RIGHT SIDEBAR */}
          <aside className="cl-side-column">
            <section className="cl-side-card">
              <div className="cl-side-heading">
                <div>
                  <span>OPPORTUNITY</span>
                  <h3>Internship details</h3>
                </div>

                <IconBadge>
                  <Target size={17} />
                </IconBadge>
              </div>

              <div className="cl-data-list">
                <div>
                  <span>Role</span>
                  <strong>{title}</strong>
                </div>

                <div>
                  <span>Company</span>
                  <strong>{company}</strong>
                </div>

                {location && (
                  <div>
                    <span>Location</span>
                    <strong>{location}</strong>
                  </div>
                )}

                {workMode && (
                  <div>
                    <span>Work mode</span>
                    <strong>{workMode}</strong>
                  </div>
                )}

                {duration && (
                  <div>
                    <span>Duration</span>
                    <strong>{duration}</strong>
                  </div>
                )}
              </div>
            </section>

            <section className="cl-side-card">
              <div className="cl-side-heading">
                <div>
                  <span>REQUIREMENTS</span>
                  <h3>Target skills</h3>
                </div>

                <IconBadge className="green">
                  <CheckCircle2 size={17} />
                </IconBadge>
              </div>

              {skills.length > 0 ? (
                <div className="cl-skills">
                  {skills.map((skill, index) => (
                    <span key={`${skill}-${index}`}>
                      <Check size={12} />
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="cl-no-data">
                  <FileText size={15} />
                  Skills will be taken from the internship requirements.
                </div>
              )}
            </section>

            <section className="cl-side-card cl-ai-info-card">
              <div className="cl-ai-info-icon">
                <Sparkles size={20} />
              </div>

              <span className="cl-section-eyebrow">AI PERSONALIZATION</span>

              <h3>Written around your actual profile</h3>

              <p>
                The generated letter is designed to connect your resume
                strengths with the opportunity instead of using a generic
                template.
              </p>

              <div className="cl-ai-check">
                <CheckCircle2 size={15} />
                Resume profile
              </div>

              <div className="cl-ai-check">
                <CheckCircle2 size={15} />
                Skills & projects
              </div>

              <div className="cl-ai-check">
                <CheckCircle2 size={15} />
                Internship requirements
              </div>
            </section>
          </aside>
        </section>

        {/* =================================================
            FOOTER
        ================================================= */}
        <footer className="cl-footer">
          <span>
            <Sparkles size={14} />
            InternMatch AI
          </span>

          <p>Your resume and application documents are handled securely.</p>
        </footer>
      </main>
    </div>
  );
}

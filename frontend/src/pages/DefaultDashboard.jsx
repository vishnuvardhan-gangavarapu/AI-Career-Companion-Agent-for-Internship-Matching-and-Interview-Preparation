import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Upload,
  FileText,
  Sparkles,
  UserRound,
  BriefcaseBusiness,
  Target,
  Send,
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  ChevronRight,
} from "lucide-react";

import "../styles/DefaultDashboard.css";

function DefaultDashboard() {
  const navigate = useNavigate();

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  const [totalInternships, setTotalInternships] = useState(null);

  useEffect(() => {
    const token =
      localStorage.getItem("access_token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      "";

    if (!token) {
      return;
    }

    let cancelled = false;

    const loadInternshipCount = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/internships/matched?min_match=30`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        const list = Array.isArray(data?.internships)
          ? data.internships
          : Array.isArray(data?.matches)
            ? data.matches
            : Array.isArray(data?.results)
              ? data.results
              : Array.isArray(data)
                ? data
                : [];

        const count = Number(
          data?.total_internships ??
            data?.total_count ??
            data?.count ??
            list.length,
        );

        if (!cancelled) {
          setTotalInternships(Number.isFinite(count) ? count : list.length);
        }
      } catch (error) {
        console.warn("Unable to load internship count:", error);
      }
    };

    loadInternshipCount();

    return () => {
      cancelled = true;
    };
  }, [API_BASE_URL]);

  const handleViewInternships = () => {
    navigate("/internships");
  };

  const currentDate = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  const handleUploadResume = () => {
    navigate("/resume");
  };

  const workflowSteps = [
    {
      number: "01",
      title: "Create Account",
      description: "Create your account and get started.",
      icon: UserRound,
      className: "workflow-account",
      completed: true,
    },
    {
      number: "02",
      title: "Upload Resume",
      description: "Upload your PDF or DOC/DOCX resume.",
      icon: Upload,
      className: "workflow-upload",
      action: true,
    },
    {
      number: "03",
      title: "AI Resume Analysis",
      description: "AI analyzes your skills, education and experience.",
      icon: Sparkles,
      className: "workflow-ai",
      locked: true,
    },
    {
      number: "04",
      title: "Profile Generation",
      description: "Your professional profile is created automatically.",
      icon: UserRound,
      className: "workflow-profile",
      locked: true,
    },
    {
      number: "05",
      title: "Internship Matching",
      description: "Find internships based on your profile and skills.",
      icon: BriefcaseBusiness,
      className: "workflow-internship",
      action: true,
    },
    {
      number: "06",
      title: "Skill Gap Analysis",
      description: "Discover missing skills and improvement areas.",
      icon: Target,
      className: "workflow-skill",
      locked: true,
    },
    {
      number: "07",
      title: "Apply & Track",
      description: "Apply to internships and track your applications.",
      icon: Send,
      className: "workflow-apply",
      locked: true,
    },
  ];

  return (
    <div className="default-dashboard">
      {/* =====================================================
          BACKGROUND AMBIENT EFFECTS
      ===================================================== */}

      <div className="dashboard-orb dashboard-orb-one" aria-hidden="true" />

      <div className="dashboard-orb dashboard-orb-two" aria-hidden="true" />

      <div className="dashboard-orb dashboard-orb-three" aria-hidden="true" />

      {/* =====================================================
          HEADER
      ===================================================== */}

      <section className="default-dashboard-header">
        <div className="dashboard-header-content">
          <span className="dashboard-eyebrow">
            <Sparkles size={14} strokeWidth={2.3} />
            AI CAREER ASSISTANT
          </span>

          <h1>
            Build your career
            <span> with AI.</span>
          </h1>

          <p>
            Welcome to InternMatchAI. Upload your resume and let AI transform
            your information into a personalized career journey.
          </p>
        </div>

        <div className="dashboard-header-badge">
          <div className="badge-icon">
            <UserRound size={18} strokeWidth={2} />
          </div>

          <div>
            <span>Profile Status</span>
            <strong>Getting Started</strong>
          </div>
        </div>

        <div className="dashboard-current-date">{currentDate}</div>
      </section>

      {/* =====================================================
          PROFILE PROGRESS
      ===================================================== */}

      <section className="profile-progress-card">
        <div className="progress-card-left">
          <div className="progress-icon">
            <Sparkles size={22} strokeWidth={2} />
          </div>

          <div className="progress-text">
            <div className="progress-title-row">
              <h2>Complete your career profile</h2>

              <span>20%</span>
            </div>

            <p>
              Upload your resume to unlock your personalized AI career
              dashboard.
            </p>

            <div className="progress-track">
              <div className="progress-value" />
            </div>
          </div>
        </div>

        <div className="progress-status">
          <CheckCircle2 size={18} strokeWidth={2.2} />

          <span>Account created</span>
        </div>
      </section>

      {/* =====================================================
          RESUME UPLOAD HERO
      ===================================================== */}

      <section className="resume-upload-card">
        <div className="resume-card-glow" />

        <div className="resume-card-content">
          <div className="resume-card-icon">
            <Upload size={29} strokeWidth={2} />
          </div>

          <span className="resume-card-label">STEP 1 · GET STARTED</span>

          <h2>Upload your resume</h2>

          <p>
            Upload your PDF or DOC/DOCX resume. Our AI will analyze your skills,
            education and experience and automatically build your professional
            profile.
          </p>

          <div className="resume-supported">
            <span>
              <CheckCircle2 size={15} />
              PDF
            </span>

            <span>
              <CheckCircle2 size={15} />
              DOC
            </span>

            <span>
              <CheckCircle2 size={15} />
              DOCX
            </span>
          </div>

          <button
            type="button"
            className="resume-upload-button"
            onClick={handleUploadResume}
          >
            <Upload size={18} strokeWidth={2.2} />

            <span>Upload Resume</span>

            <ArrowRight size={18} strokeWidth={2.2} className="button-arrow" />
          </button>
        </div>

        {/* RESUME VISUAL */}

        <div className="resume-visual">
          <div className="resume-document">
            <div className="document-top">
              <div className="document-avatar">
                <UserRound size={17} />
              </div>

              <div className="document-lines">
                <span />
                <span />
              </div>
            </div>

            <div className="document-section">
              <span className="document-heading" />
              <span />
              <span />
              <span />
              <span />
            </div>

            <div className="document-section">
              <span className="document-heading" />
              <span />
              <span />
            </div>

            <div className="document-section">
              <span className="document-heading" />
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="ai-floating-card">
            <div className="ai-floating-icon">
              <Sparkles size={16} />
            </div>

            <div>
              <span>AI Analysis</span>
              <strong>Waiting for resume</strong>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          WORKFLOW HEADER
      ===================================================== */}

      <section className="workflow-header">
        <div>
          <span className="section-label">YOUR CAREER JOURNEY</span>

          <h2>From resume to career opportunity</h2>
        </div>

        <p>
          Follow the steps below to unlock your complete AI-powered career
          experience.
        </p>
      </section>

      {/* =====================================================
          WORKFLOW
      ===================================================== */}

      <section className="career-workflow">
        {workflowSteps.map((step, index) => {
          const Icon = step.icon;

          return (
            <div className="workflow-step-wrapper" key={step.number}>
              <article
                className={`workflow-step ${step.className} ${
                  step.locked ? "workflow-locked" : ""
                } ${step.completed ? "workflow-completed" : ""}`}
                onClick={step.action ? handleUploadResume : undefined}
              >
                {/* TOP */}

                <div className="workflow-step-top">
                  <span className="workflow-number">{step.number}</span>

                  {step.locked && (
                    <span className="workflow-lock">
                      <LockKeyhole size={14} strokeWidth={2.2} />
                    </span>
                  )}

                  {step.completed && (
                    <span className="workflow-check">
                      <CheckCircle2 size={15} strokeWidth={2.2} />
                    </span>
                  )}
                </div>

                {/* ICON */}

                <div className="workflow-icon">
                  <Icon size={24} strokeWidth={2} />
                </div>

                {/* CONTENT */}

                <h3>{step.title}</h3>

                <p>{step.description}</p>

                {/* STATUS */}

                {step.action && (
                  <div className="workflow-action">
                    <span>
                      {step.className === "workflow-internship"
                        ? "Browse internships"
                        : "Upload now"}
                    </span>

                    <ArrowRight size={15} strokeWidth={2.2} />
                  </div>
                )}

                {step.locked && (
                  <div className="workflow-locked-text">
                    <LockKeyhole size={13} strokeWidth={2} />

                    <span>Unlock after resume</span>
                  </div>
                )}

                {step.completed && (
                  <div className="workflow-completed-text">
                    <CheckCircle2 size={13} strokeWidth={2} />

                    <span>Completed</span>
                  </div>
                )}
              </article>

              {/* =================================================
                  ARROW BETWEEN STEPS
              ================================================= */}

              {index < workflowSteps.length - 1 && (
                <div className="workflow-arrow">
                  <ChevronRight size={20} strokeWidth={2} />
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* =====================================================
          FEATURE SUMMARY
      ===================================================== */}

      <section className="dashboard-features-header">
        <div>
          <span className="section-label">WHAT YOU WILL UNLOCK</span>

          <h2>Your AI career toolkit</h2>
        </div>

        <p>
          Browse internships now; upload your resume to unlock the personalized
          tools.
        </p>
      </section>

      <section className="default-dashboard-features">
        <article className="default-feature-card feature-blue">
          <div className="feature-card-top">
            <div className="feature-icon">
              <FileText size={22} />
            </div>

            <div className="feature-lock">
              <LockKeyhole size={14} />
            </div>
          </div>

          <h3>AI Resume Analysis</h3>

          <p>
            Extract skills, education, experience and professional information
            from your resume.
          </p>

          <div className="feature-bottom">
            <span>Locked</span>

            <ArrowRight size={16} />
          </div>
        </article>

        <article
          className="default-feature-card feature-purple feature-accessible"
          onClick={handleViewInternships}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleViewInternships();
            }
          }}
          aria-label="Browse internships"
        >
          <div className="feature-card-top">
            <div className="feature-icon">
              <BriefcaseBusiness size={22} />
            </div>

            <div className="feature-access-badge">OPEN</div>
          </div>

          <h3>Internships</h3>

          <p>
            Browse available internship opportunities and open any internship to
            view its complete details.
          </p>

          <div className="feature-internship-count">
            <strong>
              {totalInternships === null ? "—" : totalInternships}
            </strong>
            <span>internships available</span>
          </div>

          <div className="feature-bottom">
            <span>Browse internships</span>

            <ArrowRight size={16} />
          </div>
        </article>

        <article className="default-feature-card feature-orange">
          <div className="feature-card-top">
            <div className="feature-icon">
              <Target size={22} />
            </div>

            <div className="feature-lock">
              <LockKeyhole size={14} />
            </div>
          </div>

          <h3>Skill Gap Analysis</h3>

          <p>
            Identify missing skills and understand where you should improve.
          </p>

          <div className="feature-bottom">
            <span>Locked</span>

            <ArrowRight size={16} />
          </div>
        </article>
      </section>

      {/* =====================================================
          BOTTOM TIP
      ===================================================== */}

      <section className="dashboard-tip">
        <div className="tip-icon">
          <Sparkles size={19} />
        </div>

        <div>
          <strong>One resume unlocks your complete journey</strong>

          <p>
            Upload your resume once and InternMatchAI will use your profile to
            personalize your internships, skill gap analysis and interview
            preparation.
          </p>
        </div>
      </section>
    </div>
  );
}

export default DefaultDashboard;

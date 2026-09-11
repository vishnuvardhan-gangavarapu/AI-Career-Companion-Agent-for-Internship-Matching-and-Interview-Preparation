import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  UserRound,
  FileCheck2,
  BriefcaseBusiness,
  Target,
  ClipboardList,
  Bookmark,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  FileText,
  Search,
  ChevronRight,
  Clock3,
  Send,
  Brain,
  Zap,
  Award,
  BarChart3,
  ShieldCheck,
  GraduationCap,
  Rocket,
} from "lucide-react";

import "../styles/UserDashboard.css";

/* ============================================================
   DASHBOARD IMAGES
   ============================================================ */

const DASHBOARD_IMAGES = {
  hero: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=88",

  teamwork:
    "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=85",

  workspace:
    "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=900&q=85",

  coding:
    "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=900&q=85",
};

/* ============================================================
   USER DASHBOARD
   ============================================================ */

function UserDashboard() {
  const navigate = useNavigate();

  /* ============================================================
     USER
     ============================================================ */

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const userName = user?.full_name || user?.name || "there";

  const firstName = String(userName).trim().split(/\s+/)[0] || "there";

  const currentDate = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  /* ============================================================
     PROFILE COMPLETION
     ============================================================ */

  const [profileCompletion, setProfileCompletion] = useState(() => {
    const value = Number(
      localStorage.getItem("profile_completion_percentage") || 0,
    );

    return Math.min(100, Math.max(0, value));
  });

  useEffect(() => {
    const updateProfileCompletion = () => {
      const value = Number(
        localStorage.getItem("profile_completion_percentage") || 0,
      );

      if (Number.isFinite(value)) {
        setProfileCompletion(Math.min(100, Math.max(0, value)));
      }
    };

    updateProfileCompletion();

    window.addEventListener("storage", updateProfileCompletion);

    return () => {
      window.removeEventListener("storage", updateProfileCompletion);
    };
  }, []);

  /* ============================================================
     API
     ============================================================ */

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  /* ============================================================
     AUTH TOKEN
     ============================================================ */

  const getAuthToken = () => {
    return (
      localStorage.getItem("access_token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      ""
    );
  };

  /* ============================================================
     DASHBOARD DATA
     ============================================================ */

  const [internshipCount, setInternshipCount] = useState(0);

  const [applications, setApplications] = useState([]);

  const [applicationCount, setApplicationCount] = useState(0);

  const [dashboardDataLoading, setDashboardDataLoading] = useState(true);

  /* ============================================================
     LOAD DASHBOARD DATA
     ============================================================ */

  useEffect(() => {
    let cancelled = false;

    const loadDashboardData = async () => {
      const token = getAuthToken();

      if (!token) {
        setDashboardDataLoading(false);

        return;
      }

      try {
        setDashboardDataLoading(true);

        /* ======================================================
           MATCHED INTERNSHIPS
           ====================================================== */

        const internshipsResponse = await fetch(
          `${API_BASE_URL}/api/internships/matched?min_match=30`,
          {
            method: "GET",

            headers: {
              Accept: "application/json",

              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (internshipsResponse.ok) {
          const internshipData = await internshipsResponse.json();

          const internshipList = Array.isArray(internshipData?.internships)
            ? internshipData.internships
            : Array.isArray(internshipData?.matches)
              ? internshipData.matches
              : Array.isArray(internshipData?.results)
                ? internshipData.results
                : Array.isArray(internshipData)
                  ? internshipData
                  : [];

          const totalInternships = Number.isFinite(
            Number(internshipData?.total_internships),
          )
            ? Number(internshipData.total_internships)
            : internshipList.length;

          if (!cancelled) {
            setInternshipCount(totalInternships);
          }
        } else {
          if (!cancelled) {
            setInternshipCount(0);
          }
        }

        /* ======================================================
           APPLICATIONS
           ====================================================== */

        const applicationsResponse = await fetch(
          `${API_BASE_URL}/api/applications/my`,
          {
            method: "GET",

            headers: {
              Accept: "application/json",

              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (applicationsResponse.ok) {
          const applicationData = await applicationsResponse.json();

          const realApplications = Array.isArray(applicationData?.applications)
            ? applicationData.applications
            : [];

          const realApplicationCount = Number.isFinite(
            Number(applicationData?.count),
          )
            ? Number(applicationData.count)
            : realApplications.length;

          if (!cancelled) {
            setApplications(realApplications);

            setApplicationCount(realApplicationCount);
          }
        } else {
          if (!cancelled) {
            setApplications([]);

            setApplicationCount(0);
          }
        }
      } catch (error) {
        console.error("Dashboard API error:", error);

        if (!cancelled) {
          setInternshipCount(0);

          setApplications([]);

          setApplicationCount(0);
        }
      } finally {
        if (!cancelled) {
          setDashboardDataLoading(false);
        }
      }
    };

    loadDashboardData();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ============================================================
     SAVED INTERNSHIPS
     ============================================================ */

  const savedInternshipCount = useMemo(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("savedInternships") || "[]",
      );

      return Array.isArray(saved) ? saved.length : 0;
    } catch {
      return 0;
    }
  }, []);

  /* ============================================================
     APPLICATION STATUS
     ============================================================ */

  const normalizedStatuses = applications.map((application) =>
    String(application?.status || "")
      .trim()
      .toLowerCase(),
  );

  const pendingCount = normalizedStatuses.filter(
    (status) => status === "pending",
  ).length;

  const approvedCount = normalizedStatuses.filter(
    (status) => status === "approved",
  ).length;

  const rejectedCount = normalizedStatuses.filter(
    (status) => status === "rejected",
  ).length;

  const withdrawnCount = normalizedStatuses.filter(
    (status) => status === "withdrawn",
  ).length;

  const activeApplicationCount = pendingCount + approvedCount;

  /* ============================================================
     APPLICATION STEPS
     ============================================================ */

  const applicationSteps = [
    {
      label: "Applied",

      count: dashboardDataLoading ? 0 : applicationCount,

      icon: Send,

      className: applicationCount > 0 ? "is-complete" : "",
    },

    {
      label: "Under review",

      count: dashboardDataLoading ? 0 : pendingCount,

      icon: Clock3,

      className: pendingCount > 0 ? "is-current" : "",
    },

    {
      label: "Shortlisted",

      count: dashboardDataLoading ? 0 : approvedCount,

      icon: Award,

      className: approvedCount > 0 ? "is-complete" : "",
    },

    {
      label: "Interview",

      count: 0,

      icon: Brain,

      className: "",
    },
  ];

  /* ============================================================
     NAVIGATION
     ============================================================ */

  const goTo = (path) => {
    navigate(path);
  };

  /* ============================================================
     CAREER TOOLS
     ============================================================ */

  const dashboardTools = [
    {
      title: "Find internships",

      description:
        "Discover opportunities matched with your resume, skills and career profile.",

      label: "OPPORTUNITIES",

      icon: BriefcaseBusiness,

      className: "tool-violet",

      path: "/internships",

      action: "Explore matches",

      meta: dashboardDataLoading ? "Loading..." : `${internshipCount} matches`,

      image: DASHBOARD_IMAGES.teamwork,
    },

    {
      title: "Skill gap analysis",

      description:
        "Discover the skills that can improve your chances of landing better opportunities.",

      label: "SKILL DEVELOPMENT",

      icon: Target,

      className: "tool-orange",

      path: "/skill-gap",

      action: "View skill gaps",

      meta: "Personalized",

      image: DASHBOARD_IMAGES.coding,
    },

    {
      title: "Application tracker",

      description:
        "Keep every internship application organized and follow your progress.",

      label: "APPLICATIONS",

      icon: ClipboardList,

      className: "tool-cyan",

      path: "/applications",

      action: "Track applications",

      meta: dashboardDataLoading
        ? "Loading..."
        : `${applicationCount} applications`,

      image: DASHBOARD_IMAGES.workspace,
    },

    {
      title: "Saved internships",

      description:
        "Return to opportunities you bookmarked and continue your application journey.",

      label: "SAVED",

      icon: Bookmark,

      className: "tool-blue",

      path: "/saved-internships",

      action: "View saved",

      meta: `${savedInternshipCount} saved`,

      image: DASHBOARD_IMAGES.hero,
    },
  ];

  /* ============================================================
     JSX
     ============================================================ */

  return (
    <div className="professional-dashboard">
      {/* ======================================================
          BACKGROUND
          ====================================================== */}

      <div className="dashboard-background">
        <div className="dashboard-mesh" />

        <div className="dashboard-orb orb-one" />

        <div className="dashboard-orb orb-two" />

        <div className="dashboard-orb orb-three" />
      </div>

      {/* ======================================================
          MAIN CONTAINER
          ====================================================== */}

      <main className="dashboard-container">
        {/* ====================================================
            HERO
            ==================================================== */}

        <section className="career-hero">
          <div className="dashboard-current-date">{currentDate}</div>

          {/* HERO CONTENT */}

          <div className="hero-content">
            <div className="hero-breadcrumb">
              <span>HOME</span>

              <ChevronRight size={12} />

              <strong>DASHBOARD</strong>
            </div>

            <div className="hero-label">
              <Sparkles size={14} />
              AI CAREER COMMAND CENTER
            </div>

            <h1>
              Welcome back,
              <span>{firstName}.</span>
            </h1>

            <p>
              Your personalized career workspace is ready. Discover internships,
              improve your skills and move closer to your next opportunity.
            </p>

            <div className="hero-buttons">
              <button
                type="button"
                className="hero-primary"
                onClick={() => goTo("/internships")}
              >
                <Search size={17} />
                Find internships
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                className="hero-secondary"
                onClick={() => goTo("/profile")}
              >
                <UserRound size={17} />
                View profile
              </button>
            </div>

            {/* HERO STATS */}

            <div className="hero-mini-stats">
              <div>
                <BriefcaseBusiness size={17} />

                <div>
                  <strong>
                    {dashboardDataLoading ? "..." : internshipCount}
                  </strong>

                  <span>matched roles</span>
                </div>
              </div>

              <div>
                <ClipboardList size={17} />

                <div>
                  <strong>
                    {dashboardDataLoading ? "..." : applicationCount}
                  </strong>

                  <span>applications</span>
                </div>
              </div>

              <div>
                <TrendingUp size={17} />

                <div>
                  <strong>{profileCompletion}%</strong>

                  <span>profile strength</span>
                </div>
              </div>
            </div>
          </div>

          {/* HERO IMAGE */}

          <div className="hero-image-card">
            <img
              src={DASHBOARD_IMAGES.hero}
              alt="Modern professional workspace"
            />

            <div className="hero-image-overlay" />

            <div className="hero-floating-label">
              <div className="floating-icon">
                <Sparkles size={17} />
              </div>

              <div>
                <span>AI POWERED</span>

                <strong>Career workspace</strong>
              </div>
            </div>

            <div className="hero-image-bottom">
              <div className="hero-image-avatar">
                <UserRound size={19} />
              </div>

              <div>
                <span>PROFILE HEALTH</span>

                <strong>
                  {profileCompletion >= 70
                    ? "Excellent progress"
                    : "Keep building"}
                </strong>
              </div>

              <div className="hero-image-score">{profileCompletion}%</div>
            </div>
          </div>
        </section>

        {/* ====================================================
            RESUME STRIP
            ==================================================== */}

        <section className="resume-strip">
          <div className="resume-strip-icon">
            <FileCheck2 size={23} />
          </div>

          <div className="resume-strip-content">
            <span>AI RESUME ANALYSIS</span>

            <h2>Your resume is powering your career matches.</h2>

            <p>
              Keep your professional information updated for more accurate
              recommendations.
            </p>
          </div>

          <div className="resume-strip-status">
            <div className="analysis-status">
              <CheckCircle2 size={14} />
              Analysis active
            </div>

            <button type="button" onClick={() => goTo("/resume")}>
              Manage resume
              <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* ====================================================
            CAREER OVERVIEW
            ==================================================== */}

        <section className="section-heading">
          <div>
            <span>YOUR CAREER SNAPSHOT</span>

            <h2>Overview</h2>
          </div>

          <p>Everything important at a glance.</p>
        </section>

        <section className="overview-grid">
          {/* PROFILE */}

          <article className="overview-card purple">
            <div className="overview-card-top">
              <div className="overview-icon">
                <UserRound size={20} />
              </div>

              <span className="overview-badge">
                <TrendingUp size={12} />
                Active
              </span>
            </div>

            <span className="overview-label">PROFILE</span>

            <strong>{profileCompletion}%</strong>

            <p>Profile completion</p>

            <div className="overview-progress">
              <span
                style={{
                  width: `${profileCompletion}%`,
                }}
              />
            </div>
          </article>

          {/* RESUME */}

          <article className="overview-card green">
            <div className="overview-card-top">
              <div className="overview-icon">
                <FileText size={20} />
              </div>

              <span className="success-badge">
                <CheckCircle2 size={12} />
                Ready
              </span>
            </div>

            <span className="overview-label">RESUME</span>

            <strong className="word-value">Analyzed</strong>

            <p>AI profile generated</p>

            <div className="overview-bottom-status">
              <CheckCircle2 size={13} />
              Profile data active
            </div>
          </article>

          {/* INTERNSHIPS */}

          <article
            className="overview-card blue clickable"
            onClick={() => goTo("/internships")}
          >
            <div className="overview-card-top">
              <div className="overview-icon">
                <BriefcaseBusiness size={20} />
              </div>

              <span className="number-badge">
                {dashboardDataLoading ? "..." : internshipCount}
              </span>
            </div>

            <span className="overview-label">INTERNSHIPS</span>

            <strong>{dashboardDataLoading ? "..." : internshipCount}</strong>

            <p>Matching opportunities</p>

            <div className="overview-link">
              Explore matches
              <ArrowRight size={13} />
            </div>
          </article>

          {/* APPLICATIONS */}

          <article
            className="overview-card cyan clickable"
            onClick={() => goTo("/applications")}
          >
            <div className="overview-card-top">
              <div className="overview-icon">
                <ClipboardList size={20} />
              </div>

              <span className="number-badge">
                {dashboardDataLoading ? "..." : applicationCount}
              </span>
            </div>

            <span className="overview-label">APPLICATIONS</span>

            <strong>{dashboardDataLoading ? "..." : applicationCount}</strong>

            <p>Total applications</p>

            <div className="overview-link">
              Track progress
              <ArrowRight size={13} />
            </div>
          </article>
        </section>

        {/* ====================================================
            CAREER TOOLS
            ==================================================== */}

        <section className="section-heading tools-section-heading">
          <div>
            <span>CAREER TOOLS</span>

            <h2>Move your career forward</h2>
          </div>

          <p>Personalized tools built around your profile.</p>
        </section>

        <section className="tools-layout">
          {/* TOOL GRID */}

          <div className="tool-grid">
            {dashboardTools.map((tool) => {
              const Icon = tool.icon;

              return (
                <article
                  key={tool.title}
                  className={`career-tool ${tool.className}`}
                  onClick={() => goTo(tool.path)}
                >
                  <div className="tool-image">
                    <img src={tool.image} alt={tool.title} />

                    <div />
                  </div>

                  <div className="tool-content">
                    <div className="tool-top">
                      <div className="tool-icon">
                        <Icon size={21} />
                      </div>

                      <span>{tool.meta}</span>
                    </div>

                    <small>{tool.label}</small>

                    <h3>{tool.title}</h3>

                    <p>{tool.description}</p>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();

                        goTo(tool.path);
                      }}
                    >
                      {tool.action}

                      <ArrowRight size={14} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {/* ==================================================
              APPLICATION TRACKER
              NO IMAGE
          ================================================== */}

          <aside className="application-card">
            <div className="application-card-content">
              {/* HEADER */}

              <div className="application-heading">
                <div>
                  <span>APPLICATION TRACKER</span>

                  <h2>Your application progress</h2>
                </div>

                <button
                  type="button"
                  onClick={() => goTo("/applications")}
                  aria-label="Open application tracker"
                >
                  <ArrowRight size={16} />
                </button>
              </div>

              {/* ACTIVE APPLICATION SUMMARY */}

              <div className="application-total">
                <div>
                  <strong>
                    {dashboardDataLoading ? "..." : activeApplicationCount}
                  </strong>

                  <span>active applications</span>
                </div>

                <div className="application-health">
                  <BarChart3 size={17} />

                  <span>
                    {dashboardDataLoading
                      ? "Loading"
                      : applicationCount === 0
                        ? "Ready to apply"
                        : "On track"}
                  </span>
                </div>
              </div>

              {/* APPLICATION TIMELINE */}

              <div className="application-flow">
                {applicationSteps.map((step, index) => {
                  const Icon = step.icon;

                  return (
                    <div
                      className={`application-step ${step.className}`}
                      key={step.label}
                    >
                      {/* ICON */}

                      <div className="application-step-line-wrap">
                        <div className="application-step-icon">
                          <Icon size={15} />
                        </div>

                        {index < applicationSteps.length - 1 && <span />}
                      </div>

                      {/* CONTENT */}

                      <div className="application-step-copy">
                        <strong>{step.label}</strong>

                        <small>
                          {dashboardDataLoading
                            ? "Loading..."
                            : step.count === 0
                              ? "No applications yet"
                              : `${step.count} application${
                                  step.count > 1 ? "s" : ""
                                }`}
                        </small>
                      </div>

                      {/* COUNT */}

                      <b>{dashboardDataLoading ? "..." : step.count}</b>
                    </div>
                  );
                })}
              </div>

              {/* TRACKER BUTTON */}

              <button
                type="button"
                className="application-button"
                onClick={() => goTo("/applications")}
              >
                Open application tracker
                <ArrowRight size={14} />
              </button>
            </div>
          </aside>
        </section>

        {/* ====================================================
            AI CAREER BANNER
            ==================================================== */}

        <section className="ai-career-banner">
          <div className="ai-banner-image">
            <img src={DASHBOARD_IMAGES.coding} alt="AI career development" />

            <div />
          </div>

          <div className="ai-banner-content">
            <div className="ai-icon">
              <Sparkles size={23} />
            </div>

            <span>AI CAREER ASSISTANT</span>

            <h2>Turn your next opportunity into a stronger application.</h2>

            <p>
              Use your resume and matched internship details to build
              professional applications with AI assistance.
            </p>
          </div>

          <button type="button" onClick={() => goTo("/internships")}>
            Explore opportunities
            <ArrowRight size={16} />
          </button>
        </section>

        {/* ====================================================
            CAREER READINESS
            ==================================================== */}

        <section className="bottom-grid">
          {/* READINESS */}

          <article className="readiness-card">
            <div className="bottom-heading">
              <div>
                <span>CAREER READINESS</span>

                <h2>Your next best actions</h2>
              </div>

              <div className="heading-zap">
                <Zap size={18} />
              </div>
            </div>

            <div className="readiness-list">
              <button type="button" onClick={() => goTo("/profile")}>
                <span className="readiness-icon complete">
                  <CheckCircle2 size={15} />
                </span>

                <span>
                  <strong>Complete your profile</strong>

                  <small>Keep your professional information updated.</small>
                </span>

                <ArrowRight size={15} />
              </button>

              <button type="button" onClick={() => goTo("/skill-gap")}>
                <span className="readiness-icon warning">
                  <Target size={15} />
                </span>

                <span>
                  <strong>Close your top skill gaps</strong>

                  <small>Improve skills that unlock more matches.</small>
                </span>

                <ArrowRight size={15} />
              </button>

              <button type="button" onClick={() => goTo("/internships")}>
                <span className="readiness-icon primary">
                  <BriefcaseBusiness size={15} />
                </span>

                <span>
                  <strong>Apply to your best match</strong>

                  <small>Start with opportunities ranked for you.</small>
                </span>

                <ArrowRight size={15} />
              </button>
            </div>
          </article>

          {/* CAREER IMAGE */}

          <article className="career-insight-card">
            <img
              src={DASHBOARD_IMAGES.workspace}
              alt="Professional career workspace"
            />

            <div className="career-insight-overlay" />

            <div className="career-insight-content">
              <div className="insight-icon">
                <GraduationCap size={21} />
              </div>

              <span>CAREER INSIGHT</span>

              <h2>Keep growing your profile.</h2>

              <p>
                Update your resume whenever you complete a project, learn a
                technology or gain new experience.
              </p>

              <button type="button" onClick={() => goTo("/resume")}>
                Update resume
                <ArrowRight size={14} />
              </button>
            </div>
          </article>
        </section>

        {/* ====================================================
            FOOTER
            ==================================================== */}

        <footer className="dashboard-footer">
          <div className="footer-icon">
            <ShieldCheck size={17} />
          </div>

          <div>
            <strong>Your dashboard is personalized for you.</strong>

            <span>
              Keep your professional profile updated for better internship
              recommendations.
            </span>
          </div>

          <button type="button" onClick={() => goTo("/profile")}>
            Manage profile
            <ArrowRight size={14} />
          </button>
        </footer>
      </main>
    </div>
  );
}

export default UserDashboard;

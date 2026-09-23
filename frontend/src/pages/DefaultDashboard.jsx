import { useEffect, useMemo, useState } from "react";
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
  ShieldCheck,
  Brain,
  Rocket,
  Search,
  BarChart3,
  GraduationCap,
} from "lucide-react";
import "../styles/DefaultDashboard.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const getToken = () =>
  localStorage.getItem("access_token") ||
  localStorage.getItem("accessToken") ||
  localStorage.getItem("token") ||
  localStorage.getItem("authToken") ||
  "";

function DefaultDashboard() {
  const navigate = useNavigate();

  const [internshipCount, setInternshipCount] = useState(null);
  const [loading, setLoading] = useState(true);

  const currentDate = useMemo(
    () =>
      new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }).format(new Date()),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const loadInternshipCount = async () => {
      const token = getToken();

      if (!token) {
        setLoading(false);
        return;
      }

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
          if (!cancelled) setInternshipCount(0);
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
          setInternshipCount(
            Number.isFinite(count) ? count : list.length,
          );
        }
      } catch (error) {
        console.error("Internship count error:", error);

        if (!cancelled) {
          setInternshipCount(0);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadInternshipCount();

    return () => {
      cancelled = true;
    };
  }, []);

  const steps = [
    {
      number: "01",
      title: "Account created",
      description:
        "Your InternMatchAI workspace is ready.",
      icon: UserRound,
      state: "done",
    },
    {
      number: "02",
      title: "Upload resume",
      description:
        "Upload PDF, DOC or DOCX to start your AI journey.",
      icon: Upload,
      state: "active",
      action: () => navigate("/resume"),
      actionText: "Upload now",
    },
    {
      number: "03",
      title: "AI analysis",
      description:
        "Skills, education and experience are extracted.",
      icon: Brain,
      state: "locked",
    },
    {
      number: "04",
      title: "Profile intelligence",
      description:
        "Your professional profile is generated.",
      icon: UserRound,
      state: "locked",
    },
    {
      number: "05",
      title: "Internship matching",
      description:
        "Opportunities are matched to your profile.",
      icon: BriefcaseBusiness,
      state: "locked",
    },
    {
      number: "06",
      title: "Skill gap",
      description:
        "See role-specific skills to strengthen.",
      icon: Target,
      state: "locked",
    },
    {
      number: "07",
      title: "Apply & track",
      description:
        "Manage applications from one workspace.",
      icon: Send,
      state: "locked",
    },
  ];

  return (
    <div className="default-dashboard">
      <div className="default-bg-grid" />

      <div className="default-orb orb-a" />
      <div className="default-orb orb-b" />
      <div className="default-orb orb-c" />

      <main className="default-shell">

        {/* TOP BAR */}
        <header className="default-topbar reveal">
          <div className="default-breadcrumb">
            <span>HOME</span>
            <ChevronRight size={13} />
            <strong>DASHBOARD</strong>
          </div>

          <div className="default-date">
            <BarChart3 size={15} />
            {currentDate}
          </div>
        </header>

        {/* HERO */}
        <section className="default-hero glass reveal reveal-delay-1">

          <div className="default-hero-copy">

            <span className="eyebrow">
              <Sparkles size={15} />
              AI CAREER LAUNCHPAD
            </span>

            <h1>
              Build your career
              <span>with intelligence.</span>
            </h1>

            <p>
              Welcome to InternMatchAI. Upload your resume once and let
              the platform transform it into a personalized internship,
              skill and application journey.
            </p>

            <div className="hero-actions">

              <button
                type="button"
                className="primary-button"
                onClick={() => navigate("/resume")}
              >
                <Upload size={18} />
                Upload your resume
                <ArrowRight size={17} />
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() => navigate("/internships")}
              >
                <Search size={17} />
                Explore internships
              </button>

            </div>

            <div className="hero-trust-row">

              <span>
                <ShieldCheck size={15} />
                Private & secure
              </span>

              <span>
                <Brain size={15} />
                Regex + AI analysis
              </span>

              <span>
                <Rocket size={15} />
                Personalized journey
              </span>

            </div>

          </div>

          <div className="launchpad-visual">

            <div className="visual-orbit orbit-1" />
            <div className="visual-orbit orbit-2" />

            <div className="visual-core">

              <div className="core-icon">
                <Sparkles size={30} />
              </div>

              <strong>AI</strong>

              <span>Career engine</span>

            </div>

            <div className="floating-mini mini-top">

              <CheckCircle2 size={16} />

              <div>
                <span>PROFILE</span>
                <strong>Ready to build</strong>
              </div>

            </div>

            <div className="floating-mini mini-bottom">

              <BriefcaseBusiness size={16} />

              <div>
                <span>OPPORTUNITIES</span>

                <strong>
                  {loading
                    ? "Loading..."
                    : `${internshipCount ?? 0} available`}
                </strong>
              </div>

            </div>

          </div>

        </section>

        {/* FIRST MILESTONE */}
        <section className="progress-panel glass reveal reveal-delay-2">

          <div className="progress-ring-small">

            <svg viewBox="0 0 90 90">
              <circle
                cx="45"
                cy="45"
                r="36"
                className="ring-track"
              />

              <circle
                cx="45"
                cy="45"
                r="36"
                className="ring-value"
                pathLength="100"
              />
            </svg>

            <strong>20%</strong>

          </div>

          <div className="progress-copy">

            <span className="section-kicker">
              YOUR FIRST MILESTONE
            </span>

            <h2>Complete your career profile</h2>

            <p>
              Upload your resume to unlock AI analysis,
              your professional profile, personalized skill gap
              analysis and internship matching.
            </p>

          </div>

          <button
            type="button"
            className="progress-button"
            onClick={() => navigate("/resume")}
          >
            Start with resume
            <ArrowRight size={16} />
          </button>

        </section>

        {/* CAREER JOURNEY */}
        <section className="journey-heading reveal">

          <div>
            <span className="section-kicker">
              YOUR CAREER JOURNEY
            </span>

            <h2>From resume to opportunity</h2>
          </div>

          <p>
            Every stage unlocks the next part of your
            personalized career workspace.
          </p>

        </section>

        <section className="journey-grid">

          {steps.map((step, index) => {

            const Icon = step.icon;

            return (
              <article
                key={step.number}
                className={`journey-card glass journey-${step.state} reveal reveal-delay-${Math.min(
                  index + 1,
                  6,
                )}`}
                onClick={step.action}
                role={step.action ? "button" : undefined}
                tabIndex={step.action ? 0 : undefined}
                onKeyDown={(event) => {
                  if (
                    step.action &&
                    (event.key === "Enter" ||
                      event.key === " ")
                  ) {
                    event.preventDefault();
                    step.action();
                  }
                }}
              >

                <div className="journey-card-top">

                  <span>{step.number}</span>

                  {step.state === "locked" && (
                    <LockKeyhole size={15} />
                  )}

                  {step.state === "done" && (
                    <CheckCircle2 size={16} />
                  )}

                </div>

                <div className="journey-icon">
                  <Icon size={23} />
                </div>

                <h3>{step.title}</h3>

                <p>{step.description}</p>

                {step.action && (
                  <div className="journey-action">
                    {step.actionText}
                    <ArrowRight size={15} />
                  </div>
                )}

                {step.state === "locked" && (
                  <div className="locked-label">
                    <LockKeyhole size={13} />
                    Unlock after resume
                  </div>
                )}

                {step.state === "done" && (
                  <div className="done-label">
                    <CheckCircle2 size={13} />
                    Completed
                  </div>
                )}

              </article>
            );
          })}

        </section>

        {/* UNLOCKED FEATURES */}
        <section className="unlock-heading reveal">

          <div>
            <span className="section-kicker">
              WHAT YOU UNLOCK
            </span>

            <h2>Your AI career toolkit</h2>
          </div>

          <p>
            Internship discovery remains available.
            Personalized tools activate after resume analysis.
          </p>

        </section>

        <section className="unlock-grid">

          <article className="unlock-card unlock-blue glass reveal">

            <div className="unlock-icon">
              <FileText size={22} />
            </div>

            <span className="unlock-status">
              <LockKeyhole size={13} />
              LOCKED
            </span>

            <h3>AI Resume Analysis</h3>

            <p>
              Extract structured skills, education,
              experience and professional information
              from your resume.
            </p>

            <button
              type="button"
              onClick={() => navigate("/resume")}
            >
              Upload resume
              <ArrowRight size={15} />
            </button>

          </article>

          <article
            className="unlock-card unlock-violet glass clickable reveal reveal-delay-1"
            onClick={() => navigate("/internships")}
          >

            <div className="unlock-icon">
              <BriefcaseBusiness size={22} />
            </div>

            <span className="unlock-status open">
              <CheckCircle2 size={13} />
              OPEN
            </span>

            <h3>Internship discovery</h3>

            <p>
              Browse internship opportunities and
              inspect complete opportunity details.
            </p>

            <strong className="internship-count">
              {loading ? "—" : internshipCount ?? 0}
              <small> opportunities</small>
            </strong>

            <button type="button">
              Browse internships
              <ArrowRight size={15} />
            </button>

          </article>

          <article className="unlock-card unlock-orange glass reveal reveal-delay-2">

            <div className="unlock-icon">
              <Target size={22} />
            </div>

            <span className="unlock-status">
              <LockKeyhole size={13} />
              LOCKED
            </span>

            <h3>Skill Gap Intelligence</h3>

            <p>
              Compare your actual resume skills with
              the target role and build a learning roadmap.
            </p>

            <button
              type="button"
              onClick={() => navigate("/resume")}
            >
              Unlock analysis
              <ArrowRight size={15} />
            </button>

          </article>

        </section>

        {/* BOTTOM CTA */}
        <section className="default-bottom-banner glass reveal">

          <div className="banner-icon">
            <GraduationCap size={24} />
          </div>

          <div>

            <span className="section-kicker">
              ONE STEP STARTS EVERYTHING
            </span>

            <h2>
              Upload your resume. Let AI do the heavy lifting.
            </h2>

            <p>
              Your analyzed resume becomes the foundation
              for your profile, internship matching,
              skill gap and preparation experience.
            </p>

          </div>

          <button
            type="button"
            onClick={() => navigate("/resume")}
          >
            Get started
            <ArrowRight size={16} />
          </button>

        </section>

      </main>
    </div>
  );
}

export default DefaultDashboard;
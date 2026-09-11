import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  UserRound,
  Mail,
  Phone,
  ShieldCheck,
  FileText,
  Upload,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  LogOut,
  BriefcaseBusiness,
  LockKeyhole,
  ChevronRight,
} from "lucide-react";

import "../styles/DefaultProfile.css";

function DefaultProfile() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ============================================================
     LOAD USER PROFILE
     ============================================================ */

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const token = localStorage.getItem("access_token");

        if (!token) {
          navigate("/login", {
            replace: true,
          });

          return;
        }

        const response = await fetch("http://127.0.0.1:8000/api/auth/me", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.detail || "Unable to load profile information.",
          );
        }

        setUser(data);

        localStorage.setItem("user", JSON.stringify(data));
      } catch (err) {
        console.error("Default profile error:", err);

        setError(err.message || "Unable to load profile information.");
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [navigate]);

  /* ============================================================
     RESUME
     ============================================================ */

  const handleUploadResume = () => {
    navigate("/resume");
  };

  /* ============================================================
     LOGOUT
     ============================================================ */

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    localStorage.removeItem("dashboard_type");

    navigate("/", {
      replace: true,
    });
  };

  /* ============================================================
     LOADING
     ============================================================ */

  if (loading) {
    return (
      <div className="default-profile-page">
        <ProfileBackground />

        <div className="profile-loading">
          <div className="loading-card">
            <div className="loading-logo">
              <UserRound size={27} />
            </div>

            <div className="loading-spinner" />

            <h3>Loading profile</h3>

            <p>Preparing your account...</p>
          </div>
        </div>
      </div>
    );
  }

  /* ============================================================
     ERROR
     ============================================================ */

  if (error) {
    return (
      <div className="default-profile-page">
        <ProfileBackground />

        <div className="profile-error">
          <div className="error-card">
            <div className="error-icon">
              <ShieldCheck size={27} />
            </div>

            <span className="eyebrow">PROFILE</span>

            <h2>Unable to load your profile</h2>

            <p>{error}</p>

            <button onClick={() => window.location.reload()}>
              Try Again
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const fullName = user?.full_name || "User";

  const email = user?.email || "Not available";

  const phone = user?.phone || "Not available";

  const role = user?.role || "intern";

  const firstName = fullName.split(" ")[0];

  return (
    <div className="default-profile-page">
      <ProfileBackground />

      <main className="profile-container">
        {/* =====================================================
            PAGE HEADER
        ====================================================== */}

        <header className="profile-page-header">
          <div className="header-left">
            <div className="header-badge">
              <Sparkles size={14} />

              <span>PERSONAL SPACE</span>
            </div>

            <h1>
              Your profile,
              <span>{firstName}.</span>
            </h1>

            <p>
              Everything you need to manage your InternMatchAI account and
              career profile.
            </p>
          </div>

          {/* ACCOUNT STATUS */}

          <div className="header-action">
            <div className="active-indicator">
              <span />
            </div>

            <div className="active-copy">
              <small>ACCOUNT</small>

              <strong>Active</strong>
            </div>

            <CheckCircle2 size={19} />
          </div>
        </header>

        {/* =====================================================
            MAIN CONTENT
            PROFILE HERO REMOVED
        ====================================================== */}

        <section className="profile-layout">
          {/* ===================================================
              PERSONAL DETAILS
          ==================================================== */}

          <article className="details-card glass-card">
            <div className="card-top">
              <div className="card-heading">
                <div className="heading-icon blue">
                  <UserRound size={20} />
                </div>

                <div>
                  <span>ACCOUNT INFORMATION</span>

                  <h3>Personal details</h3>
                </div>
              </div>

              <div className="card-status">
                <span />
                Verified
              </div>
            </div>

            <div className="details-list">
              <ProfileDetail
                icon={<UserRound size={19} />}
                iconClass="blue"
                label="Full name"
                value={fullName}
              />

              <ProfileDetail
                icon={<Mail size={19} />}
                iconClass="cyan"
                label="Email address"
                value={email}
              />

              <ProfileDetail
                icon={<Phone size={19} />}
                iconClass="purple"
                label="Phone number"
                value={phone}
              />

              <ProfileDetail
                icon={<BriefcaseBusiness size={19} />}
                iconClass="orange"
                label="Account role"
                value={role}
                capitalize
              />
            </div>
          </article>

          {/* ===================================================
              RESUME CARD
          ==================================================== */}

          <article className="resume-card glass-card">
            <div className="resume-decoration" />

            <div className="resume-icon-box">
              <FileText size={27} />
            </div>

            <span className="resume-label">CAREER PROFILE</span>

            <h3>Build your career profile</h3>

            <p>
              Upload your resume and let InternMatchAI understand your skills,
              education and experience.
            </p>

            <div className="resume-progress">
              <div className="progress-header">
                <span>Profile completion</span>

                <strong>20%</strong>
              </div>

              <div className="progress-track">
                <div className="progress-value">
                  <span />
                </div>
              </div>

              <div className="progress-footer">
                <div>
                  <CheckCircle2 size={15} />

                  <span>Account created</span>
                </div>

                <span>1 of 5 steps</span>
              </div>
            </div>

            <button className="resume-button" onClick={handleUploadResume}>
              <span className="resume-button-icon">
                <Upload size={18} />
              </span>

              <span>Upload Resume</span>

              <ArrowRight className="resume-arrow" size={18} />
            </button>
          </article>
        </section>

        {/* =====================================================
            SECURITY + LOGOUT
        ====================================================== */}

        <section className="bottom-layout">
          {/* SECURITY */}

          <article className="security-card glass-card">
            <div className="security-icon">
              <LockKeyhole size={22} />
            </div>

            <div className="security-text">
              <span>SECURITY</span>

              <h3>Your account is protected</h3>

              <p>
                Your information is securely stored and protected behind
                authentication.
              </p>
            </div>

            <div className="security-badge">
              <ShieldCheck size={18} />

              <span>Secure</span>
            </div>
          </article>

          {/* LOGOUT */}

          <article className="logout-card glass-card">
            <div className="logout-left">
              <div className="logout-icon">
                <LogOut size={21} />
              </div>

              <div>
                <span>ACCOUNT</span>

                <h3>Sign out</h3>

                <p>Safely sign out of your account.</p>
              </div>
            </div>

            <button className="logout-button" onClick={handleLogout}>
              <LogOut size={17} />

              <span>Logout</span>
            </button>
          </article>
        </section>
      </main>
    </div>
  );
}

/* ==============================================================
   PROFILE DETAIL
   ============================================================== */

function ProfileDetail({ icon, iconClass, label, value, capitalize = false }) {
  return (
    <div className="profile-detail">
      <div className={`detail-icon ${iconClass}`}>{icon}</div>

      <div className="detail-content">
        <span>{label}</span>

        <strong className={capitalize ? "capitalize" : ""} title={value}>
          {value}
        </strong>
      </div>

      <ChevronRight className="detail-arrow" size={16} />
    </div>
  );
}

/* ==============================================================
   BACKGROUND
   ============================================================== */

function ProfileBackground() {
  return (
    <div className="profile-background" aria-hidden="true">
      <div className="background-orb orb-purple" />

      <div className="background-orb orb-blue" />

      <div className="background-orb orb-cyan" />

      <div className="background-grid" />

      <div className="background-dot dot-one" />

      <div className="background-dot dot-two" />

      <div className="background-dot dot-three" />
    </div>
  );
}

export default DefaultProfile;

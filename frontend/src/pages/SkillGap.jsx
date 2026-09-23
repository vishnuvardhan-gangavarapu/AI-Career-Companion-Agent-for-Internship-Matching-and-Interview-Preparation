import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  Code2,
  Gauge,
  Lightbulb,
  Lock,
  Sparkles,
  Target,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";

import "../styles/SkillGap.css";

const API_BASE_URL = "http://127.0.0.1:8000";

const getAuthToken = () =>
  localStorage.getItem("access_token") ||
  localStorage.getItem("token") ||
  localStorage.getItem("accessToken") ||
  "";

const getAuthHeaders = () => {
  const token = getAuthToken();

  return token
    ? {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      }
    : {
        Accept: "application/json",
      };
};

const getSkillIcon = (skill) => {
  const name = String(skill || "").toLowerCase();

  if (["git", "github", "gitlab", "testing"].some((item) => name.includes(item))) {
    return CheckCircle2;
  }

  if (["next.js", "react", "html", "css", "node", "spring"].some((item) => name.includes(item))) {
    return Code2;
  }

  if (["sql", "mysql", "postgres", "mongodb", "database"].some((item) => name.includes(item))) {
    return Brain;
  }

  return Code2;
};

function SkillGap() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("All");
  const [completedRoadmap, setCompletedRoadmap] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("internmatch_skill_gap_roadmap_completed") || "[]");
      return new Set(Array.isArray(stored) ? stored.map(String) : []);
    } catch {
      return new Set();
    }
  });

  /*
   * =========================================================
   * BACKEND SKILL-GAP DATA
   * =========================================================
   */

  // The backend is the source of truth for the resume used by Skill Gap.
  // It identifies the logged-in user from the JWT and automatically selects
  // that user's latest analysed resume. We intentionally do not depend on
  // selectedSkillGapResumeId in localStorage here, because older analysed
  // resumes may have been created before that browser key existed.
  const userName = useMemo(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      return user.name || user.full_name || "Your";
    } catch {
      return "Your";
    }
  }, []);

  const [skillGap, setSkillGap] = useState(null);
  const [resumeInfo, setResumeInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const fetchSkillGap = async () => {
      setLoading(true);
      setError("");

      const token = getAuthToken();

      if (!token) {
        if (!cancelled) {
          setError("Your session has expired. Please login again.");
          setLoading(false);
        }
        return;
      }

      try {
        // Do not send a resume_id from localStorage.
        // The backend finds the latest analysed resume owned by the JWT user.
        const response = await fetch(
          `${API_BASE_URL}/api/skill-gap`,
          {
            method: "GET",
            headers: getAuthHeaders(),
          },
        );

        if (response.status === 401) {
          navigate("/login", { replace: true });
          return;
        }

        let data = null;

        try {
          data = await response.json();
        } catch {
          data = null;
        }

        if (!response.ok) {
          throw new Error(
            data?.detail ||
              data?.message ||
              `Unable to load skill gap (${response.status}).`,
          );
        }

        if (!data?.skill_gap) {
          throw new Error("The server returned an empty skill-gap analysis.");
        }

        if (!cancelled) {
          setSkillGap(data.skill_gap);
          setResumeInfo(data.resume || null);
        }
      } catch (fetchError) {
        console.error("Skill gap API error:", fetchError);

        if (!cancelled) {
          setSkillGap(null);
          setResumeInfo(null);
          setError(
            fetchError?.message ||
              "Unable to load your skill gap. Please try again.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchSkillGap();

    return () => {
      cancelled = true;
    };
  }, [navigate]);


  const matchedSkills = (skillGap?.matched_skills || []).map((skill) => ({
    ...skill,
    status: "matched",
    icon: getSkillIcon(skill.name),
  }));

  const missingSkills = (skillGap?.missing_skills || []).map((skill) => ({
    ...skill,
    status: "missing",
    icon: getSkillIcon(skill.name),
  }));

  const improvingSkills = (skillGap?.improving_skills || []).map((skill) => ({
    ...skill,
    icon: getSkillIcon(skill.name),
  }));

  const roadmap = (skillGap?.roadmap || []).map((item, index) => ({
    ...item,
    number: item.number || String(index + 1).padStart(2, "0"),
    title: item.title || `Learn ${item.topic}`,
    description:
      item.description ||
      `Build practical knowledge of ${item.topic} through practice and a small project.`,
    duration: item.duration || "1 week",
    level: item.level || "Medium Priority",
    icon: getSkillIcon(item.topic),
  }));

  const improvingBySkill = new Map(
    improvingSkills.map((skill) => [String(skill.name).toLowerCase(), skill]),
  );

  const uniqueMatchedSkills = matchedSkills.map((skill) => {
    const improvement = improvingBySkill.get(String(skill.name).toLowerCase());

    return {
      ...skill,
      progress: improvement?.progress ?? null,
      target: improvement?.target ?? null,
    };
  });

  const allSkills = [
    ...uniqueMatchedSkills,
    ...missingSkills,
  ];

  const filteredSkills =
    activeCategory === "All"
      ? allSkills
      : allSkills.filter((skill) => skill.category === activeCategory);

  const overallMatch = Number(skillGap?.overall_match ?? 0);
  const matchedCount = Number(skillGap?.matched_count ?? matchedSkills.length);
  const missingCount = Number(skillGap?.missing_count ?? missingSkills.length);
  const improvingCount = Number(
    skillGap?.improving_count ?? improvingSkills.length,
  );
  const roleMatchLabel = skillGap?.role_match_label || skillGap?.career_readiness || "Average";
  const targetRole = skillGap?.target_role || "Target Role";
  const roleSource = skillGap?.role_source || "default";
  const roleSourceLabel =
    roleSource === "resume_mentioned"
      ? "Based on your resume"
      : roleSource === "skills_inferred"
        ? "Inferred from your skills"
        : "Default role";

  const startSkillPreparation = (skill, difficulty = "medium") => {
    const topic = String(skill?.name || "").trim();
    if (!topic) return;

    try {
      sessionStorage.setItem(
        "internmatch_preparation_skill_gap_focus",
        JSON.stringify({ topic, difficulty }),
      );
    } catch (error) {
      console.warn("Skill gap preparation focus storage error:", error);
    }

    navigate(
      `/preparation-agent?mode=practice&topic=${encodeURIComponent(topic)}&difficulty=${encodeURIComponent(difficulty)}`,
    );
  };

  const toggleRoadmapStep = (number) => {
    const id = String(number);
    setCompletedRoadmap((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);

      try {
        localStorage.setItem(
          "internmatch_skill_gap_roadmap_completed",
          JSON.stringify([...next]),
        );
      } catch (error) {
        console.warn("Skill gap roadmap progress save error:", error);
      }

      return next;
    });
  };

  const completedRoadmapCount = roadmap.filter((item) =>
    completedRoadmap.has(String(item.number)),
  ).length;

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  if (loading) {
    return (
      <div className="skill-gap-page">
        <div className="skill-gap-orb skill-gap-orb-one" aria-hidden="true" />
        <div className="skill-gap-orb skill-gap-orb-two" aria-hidden="true" />
        <div className="skill-gap-orb skill-gap-orb-three" aria-hidden="true" />
        <section className="skill-gap-hero">
          <div className="skill-gap-hero-content">
            <div className="skill-gap-eyebrow">
              <Sparkles size={15} />
              AI SKILL ANALYSIS
            </div>
            <h1>Analysing your<span> skill gap.</span></h1>
            <p>We are detecting your target role from your resume and skills.</p>
          </div>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="skill-gap-page">
        <div className="skill-gap-orb skill-gap-orb-one" aria-hidden="true" />
        <section className="skill-gap-bottom-cta" style={{ margin: "80px auto", maxWidth: "900px" }}>
          <div className="skill-gap-bottom-icon">
            <Target size={25} />
          </div>
          <div className="skill-gap-bottom-content">
            <span>SKILL GAP</span>
            <h2>We couldn't load your analysis.</h2>
            <p>{error}</p>
          </div>
          <button
            type="button"
            className="skill-gap-primary-button"
            onClick={() => navigate("/resume")}
          >
            Go to Resume
            <ArrowRight size={18} />
          </button>
        </section>
      </div>
    );
  }

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <div className="skill-gap-page">
      {/* =====================================================
          BACKGROUND DECORATION
      ===================================================== */}

      <div className="skill-gap-orb skill-gap-orb-one" aria-hidden="true" />

      <div className="skill-gap-orb skill-gap-orb-two" aria-hidden="true" />

      <div className="skill-gap-orb skill-gap-orb-three" aria-hidden="true" />

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="skill-gap-hero">
        <div className="skill-gap-hero-content">
          <div className="skill-gap-eyebrow">
            <Sparkles size={15} />
            AI SKILL ANALYSIS
          </div>

          <h1>
            Close your
            <span> skill gap.</span>
          </h1>

          <p>
            {userName}, discover exactly which skills you need to strengthen to
            become a stronger candidate for your target internship.
          </p>

          <div className="skill-gap-role">
            <div className="skill-gap-role-icon">
              <Target size={19} />
            </div>

            <div>
              <span>YOUR TARGET ROLE</span>
              <strong style={{ display: "block" }}>{targetRole}</strong>
              <small
                style={{
                  display: "block",
                  marginTop: "4px",
                  lineHeight: 1.3,
                }}
              >
                {roleSourceLabel}
              </small>
            </div>
          </div>
        </div>

        {/* =================================================
            SCORE
        ================================================= */}

        <div className="skill-gap-score-card">
          <div className="skill-gap-score-ring">
            <svg viewBox="0 0 160 160" className="skill-gap-score-svg">
              <circle
                cx="80"
                cy="80"
                r="65"
                className="skill-gap-score-track"
              />

              <circle
                cx="80"
                cy="80"
                r="65"
                className="skill-gap-score-progress"
                strokeDasharray="408"
                strokeDashoffset={408 - (408 * Math.max(0, Math.min(100, overallMatch))) / 100}
              />
            </svg>

            <div className="skill-gap-score-value">
              <strong>{overallMatch}%</strong>

              <span>MATCH</span>
            </div>
          </div>

          <div className="skill-gap-score-text">
            <div className="score-status">
              <TrendingUp size={15} />
              {roleMatchLabel} match
            </div>

            <p>
              {targetRole}
              {resumeInfo?.file_name ? ` · ${resumeInfo.file_name}` : ""}
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================
          STAT CARDS
      ===================================================== */}

      <section className="skill-gap-stat-grid">
        <div className="skill-gap-stat-card matched">
          <div className="skill-gap-stat-icon">
            <CheckCircle2 size={22} />
          </div>

          <div>
            <strong>{matchedCount}</strong>
            <span>Skills matched</span>
          </div>

          <div className="skill-gap-stat-decoration">✓</div>
        </div>

        <div className="skill-gap-stat-card missing">
          <div className="skill-gap-stat-icon">
            <XCircle size={22} />
          </div>

          <div>
            <strong>{missingCount}</strong>
            <span>Skills missing</span>
          </div>

          <div className="skill-gap-stat-decoration">!</div>
        </div>

        <div className="skill-gap-stat-card improving">
          <div className="skill-gap-stat-icon">
            <TrendingUp size={22} />
          </div>

          <div>
            <strong>{improvingCount}</strong>
            <span>Priority skills</span>
          </div>

          <div className="skill-gap-stat-decoration">↑</div>
        </div>

        <div className="skill-gap-stat-card readiness">
          <div className="skill-gap-stat-icon">
            <Gauge size={22} />
          </div>

          <div>
            <strong>{roleMatchLabel}</strong>
            <span>Role match</span>
          </div>

          <div className="skill-gap-stat-decoration">★</div>
        </div>
      </section>

      {/* =====================================================
          SKILL OVERVIEW
      ===================================================== */}

      <section className="skill-gap-section">
        <div className="skill-gap-section-header">
          <div>
            <span className="skill-gap-section-label">SKILL OVERVIEW</span>

            <h2>Where you stand</h2>

            <p>
              Compare your current skills with the requirements of your target
              role.
            </p>
          </div>

          <div className="skill-gap-ai-badge">
            <Sparkles size={15} />
            AI analyzed
          </div>
        </div>

        {/* =================================================
            FILTERS
        ================================================= */}

        <div className="skill-gap-filters">
          {["All", "Frontend", "Programming", "Tools", "Backend", "Database"].map(
            (category) => (
              <button
                key={category}
                type="button"
                className={activeCategory === category ? "active" : ""}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ),
          )}
        </div>

        <div className="skill-gap-skill-grid">
          {filteredSkills.map((skill, index) => {
            const SkillIcon = skill.icon || Code2;

            return (
              <div
                className={`skill-gap-skill-card ${skill.status}`}
                key={`${skill.name}-${index}`}
              >
                <div className="skill-gap-skill-top">
                  <div className="skill-gap-skill-icon">
                    <SkillIcon size={20} />
                  </div>

                  <div className="skill-gap-skill-info">
                    <h3>{skill.name}</h3>

                    <span>{skill.category}</span>
                  </div>

                  {skill.status === "matched" && (
                    <CheckCircle2 size={20} className="skill-success-icon" />
                  )}

                  {skill.status === "missing" && (
                    <XCircle size={20} className="skill-danger-icon" />
                  )}

                  {skill.status === "improving" && (
                    <TrendingUp size={20} className="skill-warning-icon" />
                  )}
                </div>

                {skill.status === "matched" && (
                  <div className="skill-gap-progress-row">
                    <span>Resume evidence</span>
                    <strong>Matched</strong>
                  </div>
                )}

                {skill.status === "missing" && (
                  <div className="skill-missing-text">
                    <span>{skill.reason}</span>

                    <button
                      type="button"
                      className="skill-learn-link"
                      onClick={() => startSkillPreparation(skill, skill.priority?.toLowerCase() === "high" ? "hard" : "medium")}
                    >
                      Learn
                      <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* =====================================================
          TWO COLUMN SECTION
      ===================================================== */}

      <section className="skill-gap-two-column">
        {/* ===================================================
            MISSING SKILLS
        =================================================== */}

        <div className="skill-gap-panel">
          <div className="skill-gap-panel-header">
            <div>
              <span className="skill-gap-section-label">PRIORITY GAPS</span>

              <h2>Skills you're missing</h2>
            </div>

            <div className="skill-gap-panel-icon danger">
              <Lock size={19} />
            </div>
          </div>

          <div className="missing-skill-list">
            {missingSkills.map((skill, index) => (
              <div className="missing-skill-item" key={skill.name}>
                <div className="missing-skill-number">
                  {String(index + 1).padStart(2, "0")}
                </div>

                <div className="missing-skill-content">
                  <div className="missing-skill-title">
                    <h3>{skill.name}</h3>

                    <span
                      className={`priority-badge ${skill.priority.toLowerCase()}`}
                    >
                      {skill.priority}
                    </span>
                  </div>

                  <p>{skill.reason}</p>
                </div>

                <button
                  type="button"
                  className="missing-skill-arrow"
                  aria-label={`Learn ${skill.name}`}
                  onClick={() => startSkillPreparation(skill, skill.priority?.toLowerCase() === "high" ? "hard" : "medium")}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ===================================================
            AI RECOMMENDATION
        =================================================== */}

        <div className="skill-gap-ai-panel">
          <div className="skill-gap-ai-glow" />

          <div className="skill-gap-ai-icon">
            <Brain size={25} />
          </div>

          <span className="skill-gap-section-label">AI CAREER COACH</span>

          <h2>Here's what we'd recommend next.</h2>

          <p>
            Focus on the highest-impact skills first. Building these skills can
            significantly improve your match with the detected internship role.
          </p>

          <div className="ai-recommendation-list">
            {(missingSkills.length ? missingSkills.slice(0, 3) : matchedSkills.slice(0, 3)).map((skill) => (
              <div key={skill.name}>
                <CheckCircle2 size={17} />
                <span>
                  {missingSkills.length
                    ? `Learn ${skill.name}`
                    : `Strengthen ${skill.name}`}
                </span>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="skill-gap-primary-button"
            onClick={() => {
              const firstSkill = missingSkills[0] || matchedSkills[0];
              if (firstSkill) startSkillPreparation(firstSkill, "hard");
            }}
          >
            Start learning path
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* =====================================================
          ROADMAP
      ===================================================== */}

      <section className="skill-gap-roadmap-section">
        <div className="skill-gap-section-header">
          <div>
            <span className="skill-gap-section-label">
              PERSONALIZED ROADMAP
            </span>

            <h2>Your path to a stronger profile</h2>

            <p>Follow these steps to close your most important skill gaps.</p>
          </div>

          <div className="roadmap-completion">
            <span>{completedRoadmapCount} / {roadmap.length} completed</span>

            <div>
              <span style={{ width: `${roadmap.length ? (completedRoadmapCount / roadmap.length) * 100 : 0}%` }} />
            </div>
          </div>
        </div>

        <div className="skill-gap-roadmap">
          {roadmap.map((item, index) => {
            const RoadmapIcon = item.icon;

            return (
              <div className={`roadmap-card ${completedRoadmap.has(String(item.number)) ? "completed" : ""}`} key={item.number}>
                <div className="roadmap-number">{item.number}</div>

                <div className="roadmap-icon">
                  <RoadmapIcon size={20} />
                </div>

                <div className="roadmap-content">
                  <div className="roadmap-title-row">
                    <h3>{item.title}</h3>

                    <span
                      className={
                        item.level.includes("High")
                          ? "roadmap-priority high"
                          : "roadmap-priority medium"
                      }
                    >
                      {item.level}
                    </span>
                  </div>

                  <p>{item.description}</p>

                  <div className="roadmap-duration">
                    <BookOpen size={14} />

                    {item.duration}
                  </div>
                </div>

                <button
                  type="button"
                  className="roadmap-action"
                  onClick={() => startSkillPreparation(
                    { name: item.topic || item.title },
                    item.level.toLowerCase().includes("high") ? "hard" : "medium",
                  )}
                  aria-label={`Practice ${item.title}`}
                >
                  <ArrowRight size={18} />
                </button>
                <button
                  type="button"
                  className="roadmap-complete-action"
                  onClick={() => toggleRoadmapStep(item.number)}
                  aria-label={completedRoadmap.has(String(item.number)) ? `Mark ${item.title} incomplete` : `Mark ${item.title} complete`}
                >
                  {completedRoadmap.has(String(item.number)) ? <CheckCircle2 size={17} /> : <span>✓</span>}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* =====================================================
          BOTTOM CTA
      ===================================================== */}

      <section className="skill-gap-bottom-cta">
        <div className="cta-decoration">
          <Sparkles size={70} />
        </div>

        <div className="skill-gap-bottom-icon">
          <Target size={25} />
        </div>

        <div className="skill-gap-bottom-content">
          <span>KEEP GOING</span>

          <h2>You're closer than you think.</h2>

          <p>
            Focus on the highest-priority missing skills shown in your analysis and practise them in the Preparation Agent.
          </p>
        </div>

        <button
          type="button"
          className="skill-gap-primary-button"
          onClick={() => {
            const firstSkill = missingSkills[0] || matchedSkills[0];
            if (firstSkill) startSkillPreparation(firstSkill, "hard");
          }}
        >
          Improve my skills
          <ArrowRight size={18} />
        </button>
      </section>
    </div>
  );
}

export default SkillGap;

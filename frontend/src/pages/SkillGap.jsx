import { useMemo, useState } from "react";
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
   * USER / TARGET ROLE DATA
   * =========================================================
   *
   * These values can later be replaced with your backend
   * skill-gap API response.
   */

  const targetRole =
    localStorage.getItem("selectedRole") ||
    localStorage.getItem("targetRole") ||
    "Frontend Developer Intern";

  const userName = useMemo(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");

      return user.name || user.full_name || "Your";
    } catch {
      return "Your";
    }
  }, []);

  /*
   * =========================================================
   * SKILL DATA
   * =========================================================
   */

  const matchedSkills = [
    {
      name: "HTML5",
      level: 92,
      category: "Frontend",
      icon: Code2,
    },
    {
      name: "CSS3",
      level: 88,
      category: "Frontend",
      icon: Code2,
    },
    {
      name: "JavaScript",
      level: 82,
      category: "Programming",
      icon: Code2,
    },
    {
      name: "React.js",
      level: 78,
      category: "Frontend",
      icon: Code2,
    },
    {
      name: "Git",
      level: 76,
      category: "Tools",
      icon: Code2,
    },
  ];

  const missingSkills = [
    {
      name: "TypeScript",
      priority: "High",
      category: "Frontend",
      reason: "Frequently requested for modern React roles.",
    },
    {
      name: "Next.js",
      priority: "High",
      category: "Frontend",
      reason: "Improves your readiness for production React applications.",
    },
    {
      name: "Testing",
      priority: "Medium",
      category: "Tools",
      reason: "Companies expect developers to understand frontend testing.",
    },
    {
      name: "REST APIs",
      priority: "Medium",
      category: "Backend",
      reason:
        "Important for connecting frontend applications with backend services.",
    },
  ];

  const improvingSkills = [
    {
      name: "React.js",
      progress: 78,
      target: 90,
      category: "Frontend",
    },
    {
      name: "JavaScript",
      progress: 82,
      target: 92,
      category: "Programming",
    },
    {
      name: "Git",
      progress: 76,
      target: 88,
      category: "Tools",
    },
  ];

  const roadmap = [
    {
      number: "01",
      topic: "TypeScript",
      title: "Master TypeScript",
      description:
        "Learn types, interfaces, generics and TypeScript with React.",
      duration: "1–2 weeks",
      level: "High Priority",
      icon: Code2,
    },
    {
      number: "02",
      topic: "Next.js",
      title: "Build with Next.js",
      description:
        "Learn routing, server components, API routes and deployment.",
      duration: "2–3 weeks",
      level: "High Priority",
      icon: Zap,
    },
    {
      number: "03",
      topic: "Testing",
      title: "Learn Frontend Testing",
      description: "Practice unit and component testing with modern tools.",
      duration: "1 week",
      level: "Medium Priority",
      icon: CheckCircle2,
    },
    {
      number: "04",
      topic: "REST APIs",
      title: "Work with REST APIs",
      description: "Connect React applications with real backend APIs.",
      duration: "1 week",
      level: "Medium Priority",
      icon: Brain,
    },
  ];

  /*
   * =========================================================
   * FILTER
   * =========================================================
   */

  // Merge improving skills into the matched skill card instead of rendering
  // the same skill a second time. React.js, JavaScript and Git therefore
  // appear once, with their current proficiency and improvement goal together.
  const improvingBySkill = new Map(
    improvingSkills.map((skill) => [skill.name.toLowerCase(), skill]),
  );

  const uniqueMatchedSkills = matchedSkills.map((skill) => {
    const improvement = improvingBySkill.get(skill.name.toLowerCase());
    return {
      ...skill,
      status: "matched",
      progress: improvement?.progress ?? skill.level,
      target: improvement?.target ?? null,
    };
  });

  const allSkills = [
    ...uniqueMatchedSkills,
    ...missingSkills.map((skill) => ({
      ...skill,
      status: "missing",
    })),
  ];

  const filteredSkills =
    activeCategory === "All"
      ? allSkills
      : allSkills.filter((skill) => skill.category === activeCategory);

  /*
   * =========================================================
   * STATS
   * =========================================================
   */

  const overallMatch = 78;

  const matchedCount = matchedSkills.length;

  const missingCount = missingSkills.length;

  const improvingCount = improvingSkills.length;

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
              <strong>{targetRole}</strong>
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
                strokeDashoffset="90"
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
              Good progress
            </div>

            <p>You're already on the right path.</p>
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
            <span>Skills to improve</span>
          </div>

          <div className="skill-gap-stat-decoration">↑</div>
        </div>

        <div className="skill-gap-stat-card readiness">
          <div className="skill-gap-stat-icon">
            <Gauge size={22} />
          </div>

          <div>
            <strong>Good</strong>
            <span>Career readiness</span>
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
          {["All", "Frontend", "Programming", "Tools", "Backend"].map(
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
                  <>
                    <div className="skill-gap-progress-row">
                      <span>{skill.target ? `Current ${skill.level}%` : "Proficiency"}</span>
                      <strong>{skill.target ? `Goal ${skill.target}%` : `${skill.level}%`}</strong>
                    </div>

                    <div className="skill-gap-progress">
                      <div
                        style={{
                          width: `${skill.level}%`,
                        }}
                      />
                    </div>
                  </>
                )}

                {skill.status === "improving" && (
                  <>
                    <div className="skill-gap-progress-row">
                      <span>Current {skill.progress}%</span>

                      <strong>Goal {skill.target}%</strong>
                    </div>

                    <div className="skill-gap-progress improving-bar">
                      <div
                        style={{
                          width: `${skill.progress}%`,
                        }}
                      />
                    </div>
                  </>
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
            significantly improve your chances of matching modern frontend
            internship requirements.
          </p>

          <div className="ai-recommendation-list">
            <div>
              <CheckCircle2 size={17} />
              <span>Learn TypeScript fundamentals</span>
            </div>

            <div>
              <CheckCircle2 size={17} />
              <span>Build one Next.js project</span>
            </div>

            <div>
              <CheckCircle2 size={17} />
              <span>Add testing to your React projects</span>
            </div>
          </div>

          <button
            type="button"
            className="skill-gap-primary-button"
            onClick={() => startSkillPreparation(missingSkills[0], "hard")}
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
            Close just a few high-priority gaps and your profile can become much
            more competitive.
          </p>
        </div>

        <button type="button" className="skill-gap-primary-button">
          Improve my skills
          <ArrowRight size={18} />
        </button>
      </section>
    </div>
  );
}

export default SkillGap;

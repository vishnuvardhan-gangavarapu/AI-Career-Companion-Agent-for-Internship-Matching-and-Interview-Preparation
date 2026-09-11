import { Link } from "react-router-dom";
import "../styles/Landing.css";

const images = {
  heroMain:
    "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=85",
  heroResume:
    "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=900&q=85",
  heroLaptop:
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=85",
  internship:
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1000&q=85",
  resume:
    "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1000&q=85",
  skills:
    "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1000&q=85",
  coverLetter:
    "https://images.unsplash.com/photo-1456324504439-367cee3b3c32?auto=format&fit=crop&w=1000&q=85",
  application:
    "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1000&q=85",
  career:
    "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1400&q=85",
};

const features = [
  {
    number: "01",
    icon: "📄",
    title: "AI Resume Analysis",
    text: "Turn your resume into a structured professional profile. AI extracts education, skills, projects and experience.",
    image: images.resume,
    tag: "RESUME → PROFILE",
  },
  {
    number: "02",
    icon: "🎯",
    title: "Smart Skill Matching",
    text: "Compare your profile with internship requirements and instantly understand where you are a strong match.",
    image: images.skills,
    tag: "SKILLS → MATCH",
  },
  {
    number: "03",
    icon: "💼",
    title: "Internship Discovery",
    text: "Explore relevant opportunities based on your skills, education, interests and career direction.",
    image: images.internship,
    tag: "PROFILE → JOBS",
  },
  {
    number: "04",
    icon: "📊",
    title: "Skill Gap Analysis",
    text: "See matched skills in green and missing skills in red, then focus your learning on what matters most.",
    image: images.skills,
    tag: "MATCHED vs MISSING",
  },
  {
    number: "05",
    icon: "✨",
    title: "AI Cover Letters",
    text: "Generate a professional cover letter tailored to your resume and the internship you want to apply for.",
    image: images.coverLetter,
    tag: "AI → COVER LETTER",
  },
  {
    number: "06",
    icon: "📋",
    title: "Application Tracking",
    text: "Apply, withdraw and follow every application from pending review to the final outcome in one place.",
    image: images.application,
    tag: "APPLY → TRACK",
  },
];

const steps = [
  {
    number: "01",
    title: "Upload Your Resume",
    text: "Start with your PDF, DOC or DOCX resume.",
  },
  {
    number: "02",
    title: "AI Builds Your Profile",
    text: "Your skills, education and experience are extracted.",
  },
  {
    number: "03",
    title: "Discover Your Matches",
    text: "Find internships aligned with your profile.",
  },
  {
    number: "04",
    title: "Understand Skill Gaps",
    text: "Know exactly what skills you already have and what is missing.",
  },
  {
    number: "05",
    title: "Create Your Cover Letter",
    text: "Generate a tailored professional application with AI.",
  },
  {
    number: "06",
    title: "Apply & Track",
    text: "Submit applications and monitor their status.",
  },
];

function Landing() {
  return (
    <div className="landing-page">
      <div className="landing-noise" aria-hidden="true" />
      <div className="landing-orb landing-orb-one" aria-hidden="true" />
      <div className="landing-orb landing-orb-two" aria-hidden="true" />
      <div className="landing-orb landing-orb-three" aria-hidden="true" />

      <header className="landing-navbar">
        <Link to="/" className="landing-logo">
          <img src="/logo.png" alt="InternMatch AI" />
          <span>InternMatch AI</span>
        </Link>

        <nav className="landing-nav-links" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#platform-preview">Platform</a>
        </nav>

        <div className="nav-actions">
          <Link to="/login" className="nav-login-btn">
            Login
          </Link>

          <Link to="/register" className="nav-signup-btn">
            Sign Up
            <span>↗</span>
          </Link>
        </div>
      </header>

      <main>
        {/* =====================================================
            HERO
        ===================================================== */}
        <section className="hero-section">
          <div className="hero-grid-lines" aria-hidden="true" />

          <div className="hero-content">
            <div className="hero-badge">
              <span className="hero-badge-dot" />
              AI-POWERED INTERNSHIP PLATFORM
            </div>

            <h1>
              Your skills deserve
              <br />
              the <span>right opportunity.</span>
            </h1>

            <p>
              InternMatch AI transforms your resume into a career profile,
              finds internships that fit your skills, reveals your skill gaps,
              and helps you apply with confidence.
            </p>

            <div className="hero-actions">
              <Link to="/register" className="hero-primary-btn">
                Get Started
                <span>→</span>
              </Link>

              <a href="#platform-preview" className="hero-secondary-btn">
                Explore platform
                <span>↓</span>
              </a>
            </div>

            <div className="hero-trust-row">
              <div className="trust-avatars">
                <span>AI</span>
                <span>CV</span>
                <span>JOB</span>
                <span>+</span>
              </div>

              <div>
                <strong>One career workspace</strong>
                <small>Resume · Skills · Internships · Applications</small>
              </div>
            </div>
          </div>

          {/* Visual career collage */}
          <div className="hero-visual" aria-label="InternMatch AI platform preview">
            <div className="hero-image-main">
              <img src={images.heroMain} alt="Students collaborating on career work" />
              <div className="image-overlay" />
              <div className="hero-image-caption">
                <span>CAREER DISCOVERY</span>
                <strong>Build your next move.</strong>
              </div>
            </div>

            <div className="hero-floating-card resume-float">
              <div className="floating-icon">📄</div>
              <div>
                <span>RESUME ANALYSIS</span>
                <strong>Complete</strong>
              </div>
              <b>✓</b>
            </div>

            <div className="hero-floating-card match-float">
              <div className="floating-icon match-icon">🎯</div>
              <div>
                <span>AI MATCH</span>
                <strong>92% Match</strong>
              </div>
            </div>

            <div className="hero-mini-image">
              <img src={images.heroResume} alt="Professional resume and laptop" />
              <span>AI PROFILE</span>
            </div>

            <div className="hero-mini-image second">
              <img src={images.heroLaptop} alt="Developer working on a laptop" />
              <span>SKILL SIGNALS</span>
            </div>

            <div className="hero-ring ring-one" />
            <div className="hero-ring ring-two" />
          </div>
        </section>

        {/* =====================================================
            PLATFORM STRIP
        ===================================================== */}
        <section className="platform-strip">
          <div className="platform-strip-inner">
            <span>YOUR CAREER WORKFLOW</span>

            <div className="platform-flow">
              <b>RESUME</b>
              <i>→</i>
              <b>AI PROFILE</b>
              <i>→</i>
              <b>MATCH</b>
              <i>→</i>
              <b>SKILL GAP</b>
              <i>→</i>
              <b>APPLY</b>
              <i>→</i>
              <b>TRACK</b>
            </div>
          </div>
        </section>

        {/* =====================================================
            PLATFORM PREVIEW
        ===================================================== */}
        <section id="platform-preview" className="platform-preview-section">
          <div className="section-intro">
            <div className="section-label">SEE THE DIFFERENCE</div>

            <h2>
              More than a job search.
              <br />
              <span>A complete career workflow.</span>
            </h2>

            <p>
              Every part of your internship journey connects together, so you
              spend less time searching and more time becoming application-ready.
            </p>
          </div>

          <div className="dashboard-preview">
            <div className="preview-window-bar">
              <div className="window-dots">
                <i />
                <i />
                <i />
              </div>

              <div className="preview-url">
                <span>internmatch.ai</span> / dashboard
              </div>

              <div className="preview-status">
                <span />
                AI ACTIVE
              </div>
            </div>

            <div className="preview-body">
              <aside className="preview-sidebar">
                <div className="preview-brand">
                  <img src="/logo.png" alt="" />
                  <b>InternMatch</b>
                </div>

                <div className="preview-user">
                  <div>V</div>
                  <span>
                    <strong>Your profile</strong>
                    <small>Career workspace</small>
                  </span>
                </div>

                <div className="preview-menu">
                  <b className="active">⌂ Dashboard</b>
                  <b>💼 Internships</b>
                  <b>🎯 Skill Gap</b>
                  <b>📋 Applications</b>
                  <b>🔖 Saved</b>
                </div>
              </aside>

              <div className="preview-main">
                <div className="preview-welcome">
                  <div>
                    <span>AI CAREER COMMAND CENTER</span>
                    <h3>Welcome back.</h3>
                    <p>Your next opportunity is closer than you think.</p>
                  </div>

                  <div className="preview-profile-score">
                    <div className="score-circle">
                      <strong>85</strong>
                      <small>%</small>
                    </div>
                    <span>Profile<br />complete</span>
                  </div>
                </div>

                <div className="preview-stat-grid">
                  <div>
                    <span>PROFILE</span>
                    <strong>85%</strong>
                    <small>Ready</small>
                  </div>
                  <div>
                    <span>RESUME</span>
                    <strong>AI</strong>
                    <small>Analyzed</small>
                  </div>
                  <div>
                    <span>MATCHES</span>
                    <strong>12</strong>
                    <small>Internships</small>
                  </div>
                  <div>
                    <span>APPLIED</span>
                    <strong>3</strong>
                    <small>Active</small>
                  </div>
                </div>

                <div className="preview-content-grid">
                  <div className="preview-internship-card">
                    <div className="preview-card-title">
                      <span>RECOMMENDED FOR YOU</span>
                      <b>View all →</b>
                    </div>

                    <div className="preview-job">
                      <div className="job-logo">JS</div>
                      <div>
                        <strong>Frontend Developer Intern</strong>
                        <span>React · JavaScript · Remote</span>
                      </div>
                      <em>92%</em>
                    </div>

                    <div className="preview-job">
                      <div className="job-logo purple">PY</div>
                      <div>
                        <strong>Python Developer Intern</strong>
                        <span>Python · FastAPI · Hybrid</span>
                      </div>
                      <em>87%</em>
                    </div>

                    <div className="preview-job">
                      <div className="job-logo cyan">AI</div>
                      <div>
                        <strong>AI / ML Intern</strong>
                        <span>Python · ML · Bengaluru</span>
                      </div>
                      <em>81%</em>
                    </div>
                  </div>

                  <div className="preview-skill-card">
                    <div className="preview-card-title">
                      <span>SKILL SIGNALS</span>
                      <b>Analyze →</b>
                    </div>

                    <div className="skill-line">
                      <div>
                        <span>React</span>
                        <b>Matched</b>
                      </div>
                      <i className="good" style={{ width: "91%" }} />
                    </div>

                    <div className="skill-line">
                      <div>
                        <span>JavaScript</span>
                        <b>Matched</b>
                      </div>
                      <i className="good" style={{ width: "84%" }} />
                    </div>

                    <div className="skill-line">
                      <div>
                        <span>Testing</span>
                        <b className="needs">Improve</b>
                      </div>
                      <i className="needs-bar" style={{ width: "47%" }} />
                    </div>

                    <div className="skill-tip">
                      <span>✨</span>
                      <p>Improving <strong>Testing</strong> could unlock more matches.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================
            FEATURES
        ===================================================== */}
        <section id="features" className="features-section">
          <div className="features-heading">
            <div className="section-label">WHY INTERNMATCH AI</div>

            <h2>
              Six intelligent tools.
              <br />
              <span>One career advantage.</span>
            </h2>

            <p>
              Designed to connect the steps that normally feel scattered
              across resumes, job boards, spreadsheets and applications.
            </p>
          </div>

          <div className="features-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.number}>
                <div className="feature-image">
                  <img src={feature.image} alt={feature.title} loading="lazy" />
                  <span>{feature.tag}</span>
                  <b>{feature.number}</b>
                </div>

                <div className="feature-card-body">
                  <div className="feature-icon">{feature.icon}</div>

                  <h3>{feature.title}</h3>

                  <p>{feature.text}</p>

                  <span className="feature-more">
                    Explore feature <b>→</b>
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* =====================================================
            HOW IT WORKS
        ===================================================== */}
        <section id="how-it-works" className="how-section">
          <div className="how-visual">
            <img
              src={images.career}
              alt="Professionals collaborating in a modern workspace"
              loading="lazy"
            />

            <div className="how-visual-overlay" />

            <div className="how-image-card">
              <span>THE GOAL</span>
              <strong>From “I need an internship”</strong>
              <b>to “I know why I’m a strong candidate.”</b>
            </div>

            <div className="how-stat">
              <span>AI WORKFLOW</span>
              <strong>06</strong>
              <small>connected steps</small>
            </div>
          </div>

          <div className="how-content">
            <div className="section-label">HOW IT WORKS</div>

            <h2>
              Your journey from resume
              <br />
              <span>to internship.</span>
            </h2>

            <p className="how-intro">
              A guided workflow that turns your existing profile into a
              smarter internship search and application process.
            </p>

            <div className="how-steps">
              {steps.map((step) => (
                <div className="how-step" key={step.number}>
                  <div className="step-number">{step.number}</div>

                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* =====================================================
            IMAGE SHOWCASE
        ===================================================== */}
        <section className="showcase-section">
          <div className="showcase-heading">
            <div className="section-label">BUILT FOR YOUR NEXT MOVE</div>
            <h2>Search smarter. Apply stronger.</h2>
          </div>

          <div className="showcase-grid">
            <div className="showcase-card showcase-large">
              <img src={images.internship} alt="Students preparing for careers" loading="lazy" />
              <div className="showcase-overlay">
                <span>INTERNSHIP DISCOVERY</span>
                <h3>Opportunities aligned with your skills.</h3>
              </div>
            </div>

            <div className="showcase-card">
              <img src={images.coverLetter} alt="Writing a professional document" loading="lazy" />
              <div className="showcase-overlay">
                <span>AI APPLICATIONS</span>
                <h3>Professional cover letters, faster.</h3>
              </div>
            </div>

            <div className="showcase-card">
              <img src={images.application} alt="Team collaborating at work" loading="lazy" />
              <div className="showcase-overlay">
                <span>APPLICATION TRACKING</span>
                <h3>Know what happens next.</h3>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================
            CTA
        ===================================================== */}
        <section className="cta-section">
          <div className="cta-image-layer">
            <img src={images.heroLaptop} alt="" aria-hidden="true" />
          </div>

          <div className="cta-content">
            <div className="section-label">START YOUR JOURNEY</div>

            <h2>
              Stop searching randomly.
              <br />
              Start building <span>with purpose.</span>
            </h2>

            <p>
              Upload your resume, discover your matches and take the next
              step toward an internship that actually fits you.
            </p>

            <div className="cta-actions">
              <Link to="/register" className="cta-button">
                Create your profile
                <span>→</span>
              </Link>

              <Link to="/login" className="cta-login">
                Already have an account? <strong>Login</strong>
              </Link>
            </div>
          </div>
        </section>

        {/* =====================================================
            FOOTER
        ===================================================== */}
        <footer className="landing-footer">
          <div className="footer-brand">
            <Link to="/" className="landing-logo">
              <img src="/logo.png" alt="InternMatch AI" />
              <span>InternMatch AI</span>
            </Link>

            <p>AI-powered internship discovery and career preparation.</p>
          </div>

          <div className="footer-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <Link to="/login">Login</Link>
            <Link to="/register">Sign Up</Link>
          </div>

          <div className="footer-copy">
            © {new Date().getFullYear()} InternMatch AI
          </div>
        </footer>
      </main>
    </div>
  );
}

export default Landing;

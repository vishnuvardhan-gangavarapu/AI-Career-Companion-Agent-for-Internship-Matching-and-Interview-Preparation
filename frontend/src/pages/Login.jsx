import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import "../styles/Login.css";

// =========================================================
// API CONFIGURATION
// =========================================================

const API_URL = "http://127.0.0.1:8000";

// =========================================================
// LOGIN COMPONENT
// =========================================================

function Login() {
  const navigate = useNavigate();

  // =======================================================
  // FORM STATE
  // =======================================================

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  // =======================================================
  // UI STATE
  // =======================================================

  const [showPassword, setShowPassword] = useState(false);

  const [rememberMe, setRememberMe] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [loading, setLoading] = useState(false);

  // =======================================================
  // INPUT CHANGE
  // =======================================================

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  // =======================================================
  // LOGIN
  // =======================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    // -------------------------------------------------------
    // Basic validation
    // -------------------------------------------------------

    if (!formData.email.trim() || !formData.password) {
      setError("Please enter your email and password.");

      return;
    }

    setLoading(true);

    try {
      // =====================================================
      // STEP 1
      // CALL BACKEND LOGIN API
      // =====================================================

      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },

        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
        }),
      });

      // =====================================================
      // STEP 2
      // READ RESPONSE
      // =====================================================

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      // =====================================================
      // STEP 3
      // HANDLE LOGIN ERROR
      // =====================================================

      if (!response.ok) {
        throw new Error(
          data?.detail || data?.message || "Invalid email or password.",
        );
      }

      // =====================================================
      // STEP 4
      // GET ACCESS TOKEN
      // =====================================================

      const authToken =
        data?.access_token || data?.token || data?.accessToken || data?.jwt;

      if (!authToken) {
        throw new Error(
          "Login successful, but authentication token was not received.",
        );
      }

      // =====================================================
      // STEP 5
      // STORE TOKEN
      // =====================================================

      localStorage.setItem("access_token", authToken);

      localStorage.setItem("token", authToken);

      window.dispatchEvent(
        new CustomEvent("internmatch-auth-changed", {
          detail: {
            token: authToken,
            email: formData.email.trim(),
          },
        })
      );

      // =====================================================
      // STEP 6
      // STORE REFRESH TOKEN
      // =====================================================

      if (data?.refresh_token) {
        localStorage.setItem("refresh_token", data.refresh_token);
      }

      // =====================================================
      // STEP 7
      // REMEMBER ME
      // =====================================================

      if (rememberMe) {
        localStorage.setItem("remember_me", "true");

        localStorage.setItem("remembered_email", formData.email.trim());
      } else {
        localStorage.removeItem("remember_me");

        localStorage.removeItem("remembered_email");
      }

      // =====================================================
      // STEP 8
      // STORE USER INFORMATION
      // =====================================================

      if (data?.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      } else {
        // Fallback user object

        localStorage.setItem(
          "user",
          JSON.stringify({
            email: formData.email.trim(),
          }),
        );
      }

      // =====================================================
      // STEP 9
      // STORE LOGIN STATUS
      // =====================================================

      localStorage.setItem("isLoggedIn", "true");

      // =====================================================
      // STEP 10
      // STORE RESUME INFORMATION
      // =====================================================

      if (data?.resume_id !== null && data?.resume_id !== undefined) {
        localStorage.setItem("resume_id", String(data.resume_id));
      } else {
        localStorage.removeItem("resume_id");
      }

      // =====================================================
      // STEP 11
      // STORE RESUME PROFILE INFORMATION
      // =====================================================

      if (
        data?.resume_profile_id !== null &&
        data?.resume_profile_id !== undefined
      ) {
        localStorage.setItem(
          "resume_profile_id",
          String(data.resume_profile_id),
        );
      } else {
        localStorage.removeItem("resume_profile_id");
      }

      // =====================================================
      // STEP 12
      // VERIFY CURRENT USER FROM BACKEND
      // =====================================================

      /*
       * The login API gives us the authentication token.
       *
       * We now call:
       *
       * GET /api/auth/me
       *
       * to verify the authenticated user before continuing.
       */

      let currentUser = null;

      const meResponse = await fetch(`${API_URL}/api/auth/me`, {
        method: "GET",

        headers: {
          Authorization: `Bearer ${authToken}`,
          Accept: "application/json",
        },
      });

      let meData = {};

      try {
        meData = await meResponse.json();
      } catch {
        meData = {};
      }

      // -----------------------------------------------------
      // AUTHENTICATION VERIFICATION ERROR
      // -----------------------------------------------------

      if (meResponse.status === 401) {
        throw new Error(
          "Authentication verification failed. Please login again.",
        );
      }

      if (!meResponse.ok) {
        throw new Error(
          meData?.detail ||
            meData?.message ||
            "Unable to verify your account role.",
        );
      }

      // -----------------------------------------------------
      // GET VERIFIED USER OBJECT
      // -----------------------------------------------------

      currentUser = meData?.user || meData?.data || meData || null;

      /*
       * Keep the verified backend user in localStorage.
       * This replaces the login-response user with the
       * information returned by /api/auth/me.
       */

      if (currentUser) {
        localStorage.setItem("user", JSON.stringify(currentUser));

        window.dispatchEvent(
          new CustomEvent("internmatch-auth-changed", {
            detail: {
              token: authToken,
              user: currentUser,
            },
          })
        );
      }

      // -----------------------------------------------------
      // GET VERIFIED ROLE
      // -----------------------------------------------------

      const verifiedRole =
        currentUser?.role ||
        currentUser?.user_role ||
        currentUser?.userRole ||
        meData?.role ||
        meData?.user_role ||
        meData?.userRole ||
        data?.role ||
        data?.user?.role ||
        "";

      const userRole = String(verifiedRole).trim().toLowerCase();

      console.log("Verified user role:", userRole);

      // =====================================================
      // STEP 13
      // NORMAL USER DASHBOARD DECISION
      // =====================================================

      /*
       * Clear any stale role value from a previous session.
       * Normal dashboard routing is decided by the backend.
       */

      localStorage.removeItem("user_role");

      // =====================================================

      /*
       * Existing backend dashboard response:
       *
       * "dashboard": {
       *     "type": "default",
       *     "path": "/defaultDashboard"
       * }
       *
       * OR
       *
       * "dashboard": {
       *     "type": "professional",
       *     "path": "/userDashboard"
       * }
       */

      const dashboardType = data?.dashboard?.type || "default";

      let dashboardPath = data?.dashboard?.path;

      // =====================================================
      // STEP 15
      // SAFETY FALLBACK
      // =====================================================

      /*
       * If the backend does not provide a dashboard path,
       * preserve the existing dashboard decision logic.
       */

      if (!dashboardPath) {
        if (dashboardType === "professional") {
          dashboardPath = "/userDashboard";
        } else {
          dashboardPath = "/defaultDashboard";
        }
      }

      // =====================================================
      // STEP 16
      // NORMALIZE DASHBOARD PATH
      // =====================================================

      /*
       * Only the existing normal-user dashboard paths are
       * allowed here.
       */

      const allowedDashboardPaths = ["/defaultDashboard", "/userDashboard"];

      if (!allowedDashboardPaths.includes(dashboardPath)) {
        dashboardPath = "/defaultDashboard";
      }

      // =====================================================
      // STEP 17
      // STORE DASHBOARD TYPE
      // =====================================================

      if (dashboardPath === "/userDashboard") {
        localStorage.setItem("dashboard_type", "user");
      } else {
        localStorage.setItem("dashboard_type", "default");
      }

      // =====================================================
      // STEP 18
      // STORE VERIFIED ROLE
      // =====================================================

      localStorage.setItem("user_role", userRole || "user");

      // =====================================================
      // STEP 19
      // SUCCESS MESSAGE
      // =====================================================

      if (dashboardPath === "/userDashboard") {
        setSuccess("Login successful. Loading your personalized dashboard...");
      } else {
        setSuccess("Login successful. Loading your dashboard...");
      }

      // =====================================================
      // STEP 20
      // REDIRECT
      // =====================================================

      setTimeout(() => {
        navigate(dashboardPath, {
          replace: true,
        });
      }, 500);
    } catch (error) {
      console.error("Login error:", error);

      // =====================================================
      // CLEAR AUTH DATA WHEN LOGIN FAILS
      // =====================================================

      localStorage.removeItem("access_token");

      localStorage.removeItem("token");

      localStorage.removeItem("refresh_token");

      localStorage.removeItem("isLoggedIn");

      localStorage.removeItem("resume_id");

      localStorage.removeItem("resume_profile_id");

      localStorage.removeItem("user_role");
      localStorage.removeItem("dashboard_type");

      window.dispatchEvent(
        new CustomEvent("internmatch-auth-changed", {
          detail: {
            token: null,
            user: null,
          },
        })
      );

      // =====================================================
      // SHOW ERROR
      // =====================================================

      setError(error?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="login-page">
      {/* =================================================
          BACKGROUND
      ================================================= */}

      <div className="login-background-grid"></div>

      <div className="login-orb login-orb-one"></div>

      <div className="login-orb login-orb-two"></div>

      <div className="login-orb login-orb-three"></div>

      {/* =================================================
          LOGIN WRAPPER
      ================================================= */}

      <div className="login-wrapper">
        <div className="login-card">
          {/* =================================================
              BRAND
          ================================================= */}

          <Link to="/" className="login-brand">
            <img src="/logo.png" alt="InternMatch AI" />

            <span>InternMatch AI</span>
          </Link>

          {/* =================================================
              HEADING
          ================================================= */}

          <div className="login-heading">
            <div className="login-badge">LOGIN TO YOUR ACCOUNT</div>

            <p>Welcome back. Continue your internship journey.</p>
          </div>

          {/* =================================================
              FORM
          ================================================= */}

          <form className="login-form" onSubmit={handleSubmit}>
            {/* ===============================================
                EMAIL
            =============================================== */}

            <div className="login-form-group login-animation-1">
              <label htmlFor="login-email">Email Address</label>

              <div className="login-input-wrapper">
                <span className="login-input-icon">✉</span>

                <input
                  id="login-email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* ===============================================
                PASSWORD
            =============================================== */}

            <div className="login-form-group login-animation-2">
              <div className="login-password-label">
                <label htmlFor="login-password">Password</label>

                <Link to="/forgot-password" className="forgot-password">
                  Forgot Password?
                </Link>
              </div>

              <div className="login-input-wrapper">
                <span className="login-input-icon">🔒</span>

                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {/* ===============================================
                REMEMBER ME
            =============================================== */}

            <div className="login-options login-animation-3">
              <label className="remember-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => {
                    setRememberMe(event.target.checked);
                  }}
                />

                <span className="remember-checkbox">{rememberMe && "✓"}</span>

                <span>Remember me</span>
              </label>
            </div>

            {/* ===============================================
                ERROR MESSAGE
            =============================================== */}

            {error && (
              <div className="login-message login-error">
                <span>!</span>

                <span>{error}</span>
              </div>
            )}

            {/* ===============================================
                SUCCESS MESSAGE
            =============================================== */}

            {success && (
              <div className="login-message login-success">
                <span>✓</span>

                <span>{success}</span>
              </div>
            )}

            {/* ===============================================
                LOGIN BUTTON
            =============================================== */}

            <button
              type="submit"
              className="login-submit login-animation-4"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="login-spinner"></span>

                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Login</span>

                  <span className="login-submit-arrow">→</span>
                </>
              )}
            </button>
          </form>

          {/* =================================================
              REGISTER
          ================================================= */}

          <div className="login-register">
            <span>Don't have an account?</span>

            <Link to="/register">Create Account</Link>
          </div>

          {/* =================================================
              SECURITY
          ================================================= */}

          <div className="login-security">
            <span className="login-security-icon">🔒</span>

            <span>Your information is secure and protected.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;

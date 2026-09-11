import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/Register.css";

const API_URL = "http://127.0.0.1:8000";

function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [agreeTerms, setAgreeTerms] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  const handleTermsChange = (event) => {
    setAgreeTerms(event.target.checked);

    setError("");
    setSuccess("");
  };

  const getPasswordStrength = () => {
    const password = formData.password;

    if (!password) {
      return {
        label: "",
        width: "0%",
        className: "",
      };
    }

    let score = 0;

    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) {
      return {
        label: "Weak",
        width: "35%",
        className: "weak",
      };
    }

    if (score <= 3) {
      return {
        label: "Medium",
        width: "65%",
        className: "medium",
      };
    }

    return {
      label: "Strong",
      width: "100%",
      className: "strong",
    };
  };

  const passwordStrength = getPasswordStrength();

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      !formData.full_name.trim() ||
      !formData.email.trim() ||
      !formData.phone.trim() ||
      !formData.password ||
      !formData.confirm_password
    ) {
      setError("Please fill in all fields.");
      return;
    }

    if (formData.password !== formData.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    if (!agreeTerms) {
      setError(
        "Please agree to the Terms of Service and Privacy Policy before creating your account.",
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          full_name: formData.full_name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          password: formData.password,
          confirm_password: formData.confirm_password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Registration failed.");
      }

      setSuccess("Account created successfully. Redirecting to login...");

      setTimeout(() => {
        navigate("/login");
      }, 1200);
    } catch (error) {
      setError(error.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-background-grid"></div>

      <div className="register-orb register-orb-one"></div>
      <div className="register-orb register-orb-two"></div>
      <div className="register-orb register-orb-three"></div>

      <div className="register-wrapper">
        <div className="register-card">
          <Link to="/" className="register-brand">
            <img src="/logo.png" alt="InternMatch AI" />

            <span>InternMatch AI</span>
          </Link>

          <div className="register-heading">
            <div className="register-badge">CREATE YOUR ACCOUNT</div>

            <p>Start your journey to find the right internship.</p>
          </div>

          <form className="register-form" onSubmit={handleSubmit}>
            <div className="form-group form-animation-1">
              <label htmlFor="full_name">Full Name</label>

              <div className="input-wrapper">
                <span className="input-icon">👤</span>

                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  placeholder="Enter your full name"
                  value={formData.full_name}
                  onChange={handleChange}
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="form-group form-animation-2">
              <label htmlFor="email">Email Address</label>

              <div className="input-wrapper">
                <span className="input-icon">✉</span>

                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group form-animation-3">
              <label htmlFor="phone">Phone Number</label>

              <div className="input-wrapper">
                <span className="input-icon">☎</span>

                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="Enter your phone number"
                  value={formData.phone}
                  onChange={handleChange}
                  autoComplete="tel"
                />
              </div>
            </div>

            <div className="form-group form-animation-4">
              <label htmlFor="password">Password</label>

              <div className="input-wrapper">
                <span className="input-icon">🔒</span>

                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {formData.password && (
              <div className="password-strength">
                <div className="strength-top">
                  <span>Password strength</span>

                  <span className={passwordStrength.className}>
                    {passwordStrength.label}
                  </span>
                </div>

                <div className="strength-track">
                  <div
                    className={`strength-bar ${passwordStrength.className}`}
                    style={{
                      width: passwordStrength.width,
                    }}
                  ></div>
                </div>
              </div>
            )}

            <div className="form-group form-animation-5">
              <label htmlFor="confirm_password">Confirm Password</label>

              <div className="input-wrapper">
                <span className="input-icon">🔐</span>

                <input
                  id="confirm_password"
                  name="confirm_password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={formData.confirm_password}
                  onChange={handleChange}
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                >
                  {showConfirmPassword ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {/* TERMS AND CONDITIONS */}

            <div className="terms-container">
              <label className="terms-label" htmlFor="agreeTerms">
                <input
                  id="agreeTerms"
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={handleTermsChange}
                />

                <span className="custom-checkbox" aria-hidden="true">
                  {agreeTerms && "✓"}
                </span>

                <span className="terms-text">
                  I agree to the{" "}
                  <Link
                    to="/terms"
                    onClick={(event) => event.stopPropagation()}
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    to="/privacy"
                    onClick={(event) => event.stopPropagation()}
                  >
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
            </div>

            {error && (
              <div className="register-message register-error">
                <span>!</span>

                {error}
              </div>
            )}

            {success && (
              <div className="register-message register-success">
                <span>✓</span>

                {success}
              </div>
            )}

            <button
              type="submit"
              className="register-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loading-spinner"></span>
                  Creating Account...
                </>
              ) : (
                <>
                  <span>Create Account</span>

                  <span className="submit-arrow">→</span>
                </>
              )}
            </button>
          </form>

          <div className="register-login">
            <span>Already have an account?</span>

            <Link to="/login">Login</Link>
          </div>

          <div className="register-security">
            <span className="security-icon">🔒</span>

            <span>Your information is secure and protected.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;

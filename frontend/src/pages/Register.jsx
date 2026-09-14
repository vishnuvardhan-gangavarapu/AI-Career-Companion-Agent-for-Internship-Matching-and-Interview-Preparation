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

  // Password strength is calculated live from the same rules
  // displayed underneath the meter.
  const getPasswordStrength = () => {
    const password = formData.password;

    if (!password) {
      return {
        label: "",
        width: "0%",
        className: "",
        color: "transparent",
      };
    }

    const hasMinLength = password.length >= 8;
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);

    const passedRules = [
      hasMinLength,
      hasLowercase,
      hasUppercase,
      hasNumber,
      hasSymbol,
    ].filter(Boolean).length;

    // The meter is based on the number of rules satisfied:
    // 1/5 = 20%, 2/5 = 40%, ... 5/5 = 100%.
    const width = `${passedRules * 20}%`;

    if (passedRules === 5) {
      return {
        label: "Strong",
        width,
        className: "strong",
        color: "#16a34a",
      };
    }

    if (passedRules >= 3) {
      return {
        label: "Medium",
        width,
        className: "medium",
        color: "#f59e0b",
      };
    }

    return {
      label: "Weak",
      width,
      className: "weak",
      color: "#ef3340",
    };
  };

  const passwordStrength = getPasswordStrength();

  // Convert FastAPI/Pydantic validation responses into messages a normal user
  // can understand instead of displaying "[object Object]".
  const getFriendlyErrorMessage = (detail) => {
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          const field = item?.loc?.[item.loc.length - 1];
          const message = String(item?.msg || "").toLowerCase();

          switch (field) {
            case "full_name":
              if (message.includes("at least 2")) {
                return "Full name must contain at least 2 characters.";
              }
              return "Please enter your full name.";

            case "email":
              return "Please enter a valid email address, such as name@gmail.com.";

            case "phone":
              if (message.includes("10 digits")) {
                return "Phone number must contain at least 10 digits.";
              }
              return "Please enter a valid phone number.";

            case "password":
              if (message.includes("at least 8")) {
                return "Password must contain at least 8 characters.";
              }
              if (message.includes("uppercase")) {
                return "Password must contain at least one uppercase letter (A-Z).";
              }
              if (message.includes("lowercase")) {
                return "Password must contain at least one lowercase letter (a-z).";
              }
              if (message.includes("number")) {
                return "Password must contain at least one number (0-9).";
              }
              return "Please enter a stronger password.";

            case "confirm_password":
              return "Please enter your password again in Confirm Password.";

            default:
              return item?.msg || "Please check the information you entered.";
          }
        })
        .filter(Boolean)
        .join("\n");
    }

    if (typeof detail === "string") {
      const normalized = detail.toLowerCase();

      if (normalized.includes("email is already registered")) {
        return "This email address is already registered. Please use another email or log in.";
      }

      if (normalized.includes("phone number is already registered")) {
        return "This phone number is already registered. Please use another number or log in.";
      }

      if (normalized.includes("passwords do not match")) {
        return "The passwords do not match. Please enter the same password in both fields.";
      }

      return detail;
    }

    return "Registration failed. Please check your details and try again.";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    const fullName = formData.full_name.trim();
    const email = formData.email.trim();
    const phone = formData.phone.trim();
    const password = formData.password;
    const confirmPassword = formData.confirm_password;

    if (!fullName || !email || !phone || !password || !confirmPassword) {
      setError("Please complete all fields before creating your account.");
      return;
    }

    if (fullName.length < 2) {
      setError("Please enter your full name (at least 2 characters).");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      setError("Please enter a valid email address, such as name@gmail.com.");
      return;
    }

    const phoneDigits = phone.replace(/\D/g, "");

    if (phoneDigits.length < 10) {
      setError("Please enter a valid phone number with at least 10 digits.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least one uppercase letter (A-Z).");
      return;
    }

    if (!/[a-z]/.test(password)) {
      setError("Password must contain at least one lowercase letter (a-z).");
      return;
    }

    if (!/[0-9]/.test(password)) {
      setError("Password must contain at least one number (0-9).");
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "The passwords do not match. Please enter the same password in both fields.",
      );
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
          full_name: fullName,
          email,
          phone,
          password,
          confirm_password: confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(getFriendlyErrorMessage(data.detail));
      }

      setSuccess("Account created successfully. Redirecting to login...");

      setTimeout(() => {
        navigate("/login");
      }, 1200);
    } catch (error) {
      setError(
        error?.message || "Unable to create your account. Please try again.",
      );
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
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
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

                <div
                  className="strength-track"
                  role="progressbar"
                  aria-label={`Password strength: ${passwordStrength.label}`}
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={parseInt(passwordStrength.width, 10) || 0}
                >
                  <div
                    className={`strength-bar ${passwordStrength.className}`}
                    style={{
                      width: passwordStrength.width,
                      backgroundColor: passwordStrength.color,
                    }}
                    aria-hidden="true"
                  />
                </div>

                <div className="strength-hint">
                  <span className={formData.password.length >= 8 ? "met" : ""}>
                    {formData.password.length >= 8 ? "✓" : "○"} 8+ characters
                  </span>
                  <span className={/[a-z]/.test(formData.password) ? "met" : ""}>
                    {/[a-z]/.test(formData.password) ? "✓" : "○"} lowercase
                  </span>
                  <span className={/[A-Z]/.test(formData.password) ? "met" : ""}>
                    {/[A-Z]/.test(formData.password) ? "✓" : "○"} uppercase
                  </span>
                  <span className={/[0-9]/.test(formData.password) ? "met" : ""}>
                    {/[0-9]/.test(formData.password) ? "✓" : "○"} number
                  </span>
                  <span className={/[^A-Za-z0-9]/.test(formData.password) ? "met" : ""}>
                    {/[^A-Za-z0-9]/.test(formData.password) ? "✓" : "○"} symbol
                  </span>
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
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
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
                  I agree to{" "}
                  <Link
                    to="/terms"
                    onClick={(event) => event.stopPropagation()}
                  >
                    the Terms of Service
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
              <div
                className="register-message register-error"
                role="alert"
                aria-live="polite"
              >
                <span>!</span>

                <div className="register-message-text">
                  {error.split("\n").map((message, index) => (
                    <div key={index}>{message}</div>
                  ))}
                </div>
              </div>
            )}

            {success && (
              <div
                className="register-message register-success"
                role="status"
                aria-live="polite"
              >
                <span>✓</span>
                <div className="register-message-text">{success}</div>
              </div>
            )}

            <button
              type="submit"
              className={`register-submit ${loading ? "loading-state" : ""}`}
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

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail,
  ArrowRight,
  ArrowLeft,
  LockKeyhole,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  RotateCcw,
} from "lucide-react";

import "../styles/ForgotPassword.css";

const API_BASE_URL = "http://127.0.0.1:8000";

const ForgotPassword = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmedEmail)) {
      setErrorMessage(
        "Please enter a valid email address."
      );
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/api/auth/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: trimmedEmail,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.message ||
            "Unable to process your request."
        );
      }

      setSuccessMessage(
        data?.message ||
          "Password reset instructions have been generated. Please continue with password reset."
      );
    } catch (error) {
      console.error(
        "Forgot password error:",
        error
      );

      setErrorMessage(
        error?.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate("/login");
  };

  const handleTryAgain = () => {
    setSuccessMessage("");
    setErrorMessage("");
    setEmail("");
  };

  return (
    <div className="forgot-password-page">

      {/* =====================================================
          BACKGROUND DECORATIONS
         ===================================================== */}

      <div className="forgot-bg-orb forgot-bg-orb-one" />
      <div className="forgot-bg-orb forgot-bg-orb-two" />
      <div className="forgot-bg-orb forgot-bg-orb-three" />

      <div className="forgot-bg-ring forgot-ring-one" />
      <div className="forgot-bg-ring forgot-ring-two" />

      <div className="forgot-floating-dot forgot-dot-one" />
      <div className="forgot-floating-dot forgot-dot-two" />
      <div className="forgot-floating-dot forgot-dot-three" />


      {/* =====================================================
          MAIN CARD
         ===================================================== */}

      <main className="forgot-password-wrapper">

        <div className="forgot-password-card">

          {/* =================================================
              LEFT VISUAL PANEL
             ================================================= */}

          <section className="forgot-password-visual">

            <div className="forgot-visual-glow" />

            <div className="forgot-visual-content">

              <div className="forgot-security-icon">
                <ShieldCheck size={42} />
              </div>

              <div className="forgot-visual-badge">
                <Sparkles size={15} />
                <span>ACCOUNT SECURITY</span>
              </div>

              <h2>
                Secure your
                <br />
                <span>account.</span>
              </h2>

              <p>
                Don't worry. We'll help you get
                back into your account safely and
                securely.
              </p>

            </div>


            {/* Decorative Lock */}

            <div className="forgot-floating-lock">

              <div className="forgot-lock-ring">
                <LockKeyhole size={25} />
              </div>

              <div>
                <strong>
                  Secure Recovery
                </strong>

                <span>
                  Your account is protected
                </span>
              </div>

            </div>


            {/* Decorative Lines */}

            <div className="forgot-visual-line line-one" />
            <div className="forgot-visual-line line-two" />
            <div className="forgot-visual-line line-three" />

          </section>


          {/* =================================================
              RIGHT FORM PANEL
             ================================================= */}

          <section className="forgot-password-form-panel">

            {!successMessage ? (

              <div className="forgot-form-content">

                {/* Header */}

                <div className="forgot-form-header">

                  <div className="forgot-form-icon">
                    <Mail size={29} />
                  </div>

                  <div className="forgot-form-label">
                    PASSWORD RECOVERY
                  </div>

                  <h1>
                    Forgot password?
                  </h1>

                  <p>
                    Enter the email address associated
                    with your account and we'll help you
                    reset your password.
                  </p>

                </div>


                {/* Form */}

                <form
                  className="forgot-password-form"
                  onSubmit={handleSubmit}
                >

                  <div className="forgot-input-group">

                    <label htmlFor="forgot-email">
                      Email Address
                    </label>

                    <div
                      className={`forgot-input-wrapper ${
                        errorMessage
                          ? "forgot-input-error"
                          : ""
                      }`}
                    >

                      <Mail
                        className="forgot-input-icon"
                        size={20}
                      />

                      <input
                        id="forgot-email"
                        type="email"
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          setErrorMessage("");
                        }}
                        placeholder="Enter your email address"
                        autoComplete="email"
                        disabled={loading}
                      />

                    </div>

                    {errorMessage && (
                      <div className="forgot-error-message">
                        {errorMessage}
                      </div>
                    )}

                  </div>


                  <button
                    type="submit"
                    className="forgot-submit-button"
                    disabled={loading}
                  >

                    {loading ? (
                      <>
                        <span className="forgot-button-spinner" />
                        <span>
                          Processing...
                        </span>
                      </>
                    ) : (
                      <>
                        <span>
                          Continue
                        </span>

                        <span className="forgot-submit-arrow">
                          <ArrowRight size={20} />
                        </span>
                      </>
                    )}

                  </button>

                </form>


                {/* Security Notice */}

                <div className="forgot-security-notice">

                  <div className="forgot-security-notice-icon">
                    <ShieldCheck size={19} />
                  </div>

                  <div>
                    <strong>
                      Your information is secure
                    </strong>

                    <span>
                      We protect your account and
                      personal information.
                    </span>
                  </div>

                </div>


                {/* Back Login */}

                <button
                  type="button"
                  className="forgot-back-button"
                  onClick={handleBackToLogin}
                >
                  <ArrowLeft size={18} />

                  <span>
                    Back to Login
                  </span>
                </button>

              </div>

            ) : (

              /* =================================================
                 SUCCESS STATE
                 ================================================= */

              <div className="forgot-success-content">

                <div className="forgot-success-icon">

                  <CheckCircle2 size={43} />

                </div>


                <div className="forgot-success-badge">

                  <span>
                    REQUEST GENERATED
                  </span>

                </div>


                <h1>
                  Check your
                  <br />
                  <span>next steps.</span>
                </h1>


                <p className="forgot-success-message">
                  {successMessage}
                </p>


                {/* Email Display */}

                <div className="forgot-success-email">

                  <div className="forgot-success-email-icon">
                    <Mail size={20} />
                  </div>

                  <div>

                    <span>
                      Recovery request
                    </span>

                    <strong>
                      {email}
                    </strong>

                  </div>

                </div>


                {/* API Message Card */}

                <div className="forgot-api-message">

                  <div className="forgot-api-check">
                    <CheckCircle2 size={20} />
                  </div>

                  <div>

                    <strong>
                      Password reset instructions generated
                    </strong>

                    <p>
                      Please continue with the
                      password reset process.
                    </p>

                  </div>

                </div>


                <div className="forgot-success-actions">

                  <button
                    type="button"
                    className="forgot-login-button"
                    onClick={handleBackToLogin}
                  >

                    <span>
                      Back to Login
                    </span>

                    <ArrowRight size={19} />

                  </button>


                  <button
                    type="button"
                    className="forgot-try-again"
                    onClick={handleTryAgain}
                  >

                    <RotateCcw size={17} />

                    <span>
                      Use another email
                    </span>

                  </button>

                </div>

              </div>

            )}

          </section>

        </div>

      </main>

    </div>
  );
};

export default ForgotPassword;
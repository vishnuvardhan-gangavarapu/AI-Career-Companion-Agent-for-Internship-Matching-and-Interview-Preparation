import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Fingerprint,
  CircleCheck,
} from "lucide-react";
import "../styles/ForgotPassword.css";

const API_BASE_URL = "http://127.0.0.1:8000";
const RESEND_SECONDS = 30;

const ForgotPassword = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [demoOtp, setDemoOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);

  const [passwords, setPasswords] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const otpRefs = useRef([]);

  const isEmail = useMemo(
    () => identifier.includes("@"),
    [identifier]
  );

  const otpValue = otp.join("");

  const maskedIdentifier = useMemo(() => {
    if (!identifier) return "";

    if (isEmail) {
      const [name, domain] = identifier.split("@");

      if (!name || !domain) return identifier;

      if (name.length <= 2) {
        return `${name.charAt(0)}*@${domain}`;
      }

      return `${name.slice(0, 2)}${"*".repeat(
        Math.max(1, name.length - 2)
      )}@${domain}`;
    }

    const digits = identifier.replace(/\D/g, "");

    if (digits.length <= 4) return identifier;

    return `${"*".repeat(Math.max(1, digits.length - 4))}${digits.slice(
      -4
    )}`;
  }, [identifier, isEmail]);

  useEffect(() => {
    if (resendSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setResendSeconds((current) =>
        current > 0 ? current - 1 : 0
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const clearMessages = () => {
    setErrorMessage("");
    setInfoMessage("");
    setSuccessMessage("");
  };

  const getApiResponse = async (response) => {
    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        data?.detail ||
          data?.message ||
          "Something went wrong. Please try again."
      );
    }

    return data;
  };

  const validateIdentifier = () => {
    const value = identifier.trim();

    if (!value) {
      setErrorMessage(
        "Please enter your email address or mobile number."
      );
      return false;
    }

    if (value.includes("@")) {
      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(value)) {
        setErrorMessage(
          "Please enter a valid email address."
        );
        return false;
      }

      return true;
    }

    const digits = value.replace(/\D/g, "");

    if (digits.length < 10) {
      setErrorMessage(
        "Please enter a valid mobile number with at least 10 digits."
      );
      return false;
    }

    return true;
  };

  const requestOtp = async (event) => {
    event?.preventDefault();
    clearMessages();

    if (!validateIdentifier()) return;

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
            identifier: identifier.trim(),
          }),
        }
      );

      const data = await getApiResponse(response);

      setDemoOtp(data?.demo_otp || "");
      setOtp(["", "", "", "", "", ""]);
      setResendSeconds(RESEND_SECONDS);
      setStep(2);

      setInfoMessage(
        "A new OTP has been generated. Enter the 6-digit code to continue."
      );

      window.setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 150);
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "Unable to generate OTP. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const digits = value.replace(/\D/g, "");

    if (!digits) {
      setOtp((current) => {
        const next = [...current];
        next[index] = "";
        return next;
      });
      return;
    }

    const characters = digits.slice(0, 6).split("");

    if (characters.length > 1) {
      setOtp((current) => {
        const next = [...current];

        characters.forEach((character, offset) => {
          if (index + offset < 6) {
            next[index + offset] = character;
          }
        });

        return next;
      });

      const targetIndex = Math.min(
        index + characters.length,
        5
      );

      window.setTimeout(() => {
        otpRefs.current[targetIndex]?.focus();
      }, 0);

      return;
    }

    setOtp((current) => {
      const next = [...current];
      next[index] = characters[0];
      return next;
    });

    if (index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, event) => {
    if (
      event.key === "Backspace" &&
      !otp[index] &&
      index > 0
    ) {
      otpRefs.current[index - 1]?.focus();
    }

    if (
      event.key === "ArrowLeft" &&
      index > 0
    ) {
      otpRefs.current[index - 1]?.focus();
    }

    if (
      event.key === "ArrowRight" &&
      index < 5
    ) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (event) => {
    event.preventDefault();

    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!pasted) return;

    const nextOtp = ["", "", "", "", "", ""];

    pasted.split("").forEach((digit, index) => {
      nextOtp[index] = digit;
    });

    setOtp(nextOtp);

    const focusIndex = Math.min(
      pasted.length,
      5
    );

    window.setTimeout(() => {
      otpRefs.current[focusIndex]?.focus();
    }, 0);
  };

  const verifyOtp = async (event) => {
    event?.preventDefault();
    clearMessages();

    if (!/^\d{6}$/.test(otpValue)) {
      setErrorMessage(
        "Please enter all 6 digits of the OTP."
      );
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/api/auth/verify-reset-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            identifier: identifier.trim(),
            otp: otpValue,
          }),
        }
      );

      const data = await getApiResponse(response);

      setResetToken(data?.reset_token || "");
      setStep(3);

      setInfoMessage(
        "OTP verified successfully. Create your new password."
      );
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "Invalid OTP. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    clearMessages();

    if (resendSeconds > 0 || resending) return;

    try {
      setResending(true);

      const response = await fetch(
        `${API_BASE_URL}/api/auth/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            identifier: identifier.trim(),
          }),
        }
      );

      const data = await getApiResponse(response);

      setDemoOtp(data?.demo_otp || "");
      setOtp(["", "", "", "", "", ""]);
      setResendSeconds(RESEND_SECONDS);

      setInfoMessage(
        "A new OTP has been generated. Your previous OTP is no longer valid."
      );

      window.setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 150);
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "Unable to generate a new OTP."
      );
    } finally {
      setResending(false);
    }
  };

  const useDemoOtp = () => {
    if (!demoOtp) return;

    const digits = demoOtp
      .replace(/\D/g, "")
      .slice(0, 6);

    const nextOtp = ["", "", "", "", "", ""];

    digits.split("").forEach((digit, index) => {
      nextOtp[index] = digit;
    });

    setOtp(nextOtp);
    clearMessages();

    window.setTimeout(() => {
      otpRefs.current[5]?.focus();
    }, 0);
  };

  const validatePassword = () => {
    const {
      newPassword,
      confirmPassword,
    } = passwords;

    if (newPassword.length < 8) {
      setErrorMessage(
        "Password must contain at least 8 characters."
      );
      return false;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setErrorMessage(
        "Password must contain at least one uppercase letter."
      );
      return false;
    }

    if (!/[a-z]/.test(newPassword)) {
      setErrorMessage(
        "Password must contain at least one lowercase letter."
      );
      return false;
    }

    if (!/\d/.test(newPassword)) {
      setErrorMessage(
        "Password must contain at least one number."
      );
      return false;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage(
        "New password and confirm password do not match."
      );
      return false;
    }

    return true;
  };

  const resetPassword = async (event) => {
    event?.preventDefault();
    clearMessages();

    if (!resetToken) {
      setErrorMessage(
        "Your reset session is invalid. Please start again."
      );
      setStep(1);
      return;
    }

    if (!validatePassword()) return;

    try {
      setLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/api/auth/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reset_token: resetToken,
            new_password: passwords.newPassword,
            confirm_password:
              passwords.confirmPassword,
          }),
        }
      );

      const data = await getApiResponse(response);

      setSuccessMessage(
        data?.message ||
          "Your password has been reset successfully."
      );

      setPasswords({
        newPassword: "",
        confirmPassword: "",
      });

      setDemoOtp("");
      setOtp(["", "", "", "", "", ""]);
      setResetToken("");
      setStep(4);
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "Unable to reset your password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    clearMessages();

    if (step === 2) {
      setOtp(["", "", "", "", "", ""]);
      setStep(1);
    } else if (step === 3) {
      setPasswords({
        newPassword: "",
        confirmPassword: "",
      });
      setStep(2);
    }
  };

  const startOver = () => {
    setStep(1);
    setIdentifier("");
    setOtp(["", "", "", "", "", ""]);
    setDemoOtp("");
    setResetToken("");
    setResendSeconds(0);

    setPasswords({
      newPassword: "",
      confirmPassword: "",
    });

    clearMessages();
  };

  const passwordRules = [
    {
      valid: passwords.newPassword.length >= 8,
      text: "8+ characters",
    },
    {
      valid: /[A-Z]/.test(passwords.newPassword),
      text: "Uppercase letter",
    },
    {
      valid: /[a-z]/.test(passwords.newPassword),
      text: "Lowercase letter",
    },
    {
      valid: /\d/.test(passwords.newPassword),
      text: "One number",
    },
  ];

  const steps = [
    { number: 1, label: "Account" },
    { number: 2, label: "Verify OTP" },
    { number: 3, label: "New Password" },
    { number: 4, label: "Complete" },
  ];

  return (
    <div className="forgot-page">
      <div className="forgot-background">
        <div className="bg-gradient-one" />
        <div className="bg-gradient-two" />
        <div className="bg-grid" />
        <div className="bg-circle circle-one" />
        <div className="bg-circle circle-two" />
        <div className="bg-circle circle-three" />
      </div>

      <main className="forgot-shell">
        <section className="forgot-brand-panel">
          <div className="brand-top">
            <div className="brand-icon">
              <Sparkles size={21} />
            </div>

            <div className="brand-copy">
              <strong>InternMatch AI</strong>
              <span>Your Career, Our AI Advantage</span>
            </div>
          </div>

          <div className="brand-main">
            <div className="brand-security-icon">
              <ShieldCheck size={48} />
            </div>

            <div className="brand-pill">
              <Fingerprint size={15} />
              <span>SECURE RECOVERY</span>
            </div>

            <h2>
              Secure your
              <br />
              <span>account.</span>
            </h2>

            <p>
              Recover your InternMatch AI account through a
              secure and simple verification experience.
            </p>

            <div className="security-list">
              <div className="security-item">
                <div className="security-item-icon">
                  <LockKeyhole size={18} />
                </div>
                <div>
                  <strong>Protected account</strong>
                  <span>Your recovery stays private</span>
                </div>
              </div>

              <div className="security-item">
                <div className="security-item-icon">
                  <RefreshCw size={18} />
                </div>
                <div>
                  <strong>Quick recovery</strong>
                  <span>Get back into your account quickly</span>
                </div>
              </div>

              <div className="security-item">
                <div className="security-item-icon">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <strong>Trusted platform</strong>
                  <span>Designed for secure career journeys</span>
                </div>
              </div>
            </div>
          </div>

          <div className="brand-footer-card">
            <div className="brand-footer-icon">
              <CheckCircle2 size={20} />
            </div>

            <div>
              <strong>Secure Recovery</strong>
              <span>Your account is protected</span>
            </div>

            <div className="footer-status">
              <span />
              Protected
            </div>
          </div>

          <div className="brand-orb orb-lock">
            <LockKeyhole size={25} />
          </div>

          <div className="brand-orb orb-safe">
            <ShieldCheck size={24} />
          </div>

          <div className="brand-decoration-line decoration-one" />
          <div className="brand-decoration-line decoration-two" />
        </section>

        <section className="forgot-content-panel">
          <div className="content-header">
            <div className="content-context">
              <span className="context-dot" />
              Account recovery
            </div>

            <span className="secure-label">
              <ShieldCheck size={14} />
              Secure session
            </span>
          </div>

          <div className="forgot-card">
            <div className="stepper">
              {steps.map((item, index) => (
                <React.Fragment key={item.number}>
                  <div
                    className={`step-item ${
                      step === item.number
                        ? "active"
                        : step > item.number
                        ? "completed"
                        : ""
                    }`}
                  >
                    <div className="step-circle">
                      {step > item.number ? (
                        <Check size={15} />
                      ) : (
                        item.number
                      )}
                    </div>

                    <span>{item.label}</span>
                  </div>

                  {index < steps.length - 1 && (
                    <div
                      className={`step-connector ${
                        step > item.number
                          ? "completed"
                          : ""
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>

            {step === 1 && (
              <div className="step-screen">
                <div className="screen-icon">
                  <KeyRound size={29} />
                </div>

                <div className="screen-kicker">
                  PASSWORD RECOVERY
                </div>

                <h1>
                  Forgot
                  <br />
                  <span>password?</span>
                </h1>

                <p className="screen-description">
                  Enter your registered email address or mobile
                  number. We'll verify your identity before you
                  create a new password.
                </p>

                <form
                  className="recovery-form"
                  onSubmit={requestOtp}
                >
                  <div className="field">
                    <label htmlFor="forgot-identifier">
                      Email address or mobile number
                    </label>

                    <div
                      className={`input-box ${
                        errorMessage ? "has-error" : ""
                      }`}
                    >
                      {isEmail ? (
                        <Mail size={20} />
                      ) : (
                        <Phone size={20} />
                      )}

                      <input
                        id="forgot-identifier"
                        type="text"
                        value={identifier}
                        onChange={(event) => {
                          setIdentifier(
                            event.target.value
                          );
                          clearMessages();
                        }}
                        placeholder="you@example.com or mobile number"
                        autoComplete="username"
                        disabled={loading}
                      />
                    </div>

                    {errorMessage && (
                      <div className="field-error">
                        {errorMessage}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={loading}
                  >
                    <span>
                      {loading
                        ? "Generating OTP..."
                        : "Send verification OTP"}
                    </span>

                    <span className="button-icon">
                      {loading ? (
                        <span className="spinner" />
                      ) : (
                        <ArrowRight size={19} />
                      )}
                    </span>
                  </button>
                </form>

                <div className="secure-info">
                  <div className="secure-info-icon">
                    <ShieldCheck size={18} />
                  </div>

                  <div>
                    <strong>Your information is secure</strong>
                    <span>
                      Recovery details are used only to verify
                      your account.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="text-back-button"
                  onClick={() => navigate("/login")}
                >
                  <ArrowLeft size={17} />
                  Back to Login
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="step-screen">
                <div className="screen-icon">
                  <ShieldCheck size={29} />
                </div>

                <div className="screen-kicker">
                  STEP 02 · VERIFY IDENTITY
                </div>

                <h1>
                  Verify your
                  <br />
                  <span>OTP.</span>
                </h1>

                <p className="screen-description">
                  We've generated a new 6-digit verification
                  code for{" "}
                  <strong>{maskedIdentifier}</strong>.
                </p>

                <form
                  className="recovery-form"
                  onSubmit={verifyOtp}
                >
                  <div className="field">
                    <label>Verification code</label>

                    <div
                      className={`otp-container ${
                        errorMessage ? "has-error" : ""
                      }`}
                    >
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          ref={(element) => {
                            otpRefs.current[index] =
                              element;
                          }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(event) =>
                            handleOtpChange(
                              index,
                              event.target.value
                            )
                          }
                          onKeyDown={(event) =>
                            handleOtpKeyDown(
                              index,
                              event
                            )
                          }
                          onPaste={
                            index === 0
                              ? handleOtpPaste
                              : undefined
                          }
                          aria-label={`OTP digit ${
                            index + 1
                          }`}
                          disabled={loading}
                        />
                      ))}
                    </div>

                    {errorMessage && (
                      <div className="field-error">
                        {errorMessage}
                      </div>
                    )}
                  </div>

                  {demoOtp && (
                    <div className="demo-otp">
                      <div className="demo-otp-left">
                        <div className="demo-otp-icon">
                          <KeyRound size={17} />
                        </div>

                        <div>
                          <span>DEMO OTP</span>
                          <strong>{demoOtp}</strong>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={useDemoOtp}
                        disabled={loading}
                      >
                        Use OTP
                      </button>
                    </div>
                  )}

                  <div className="resend-section">
                    <div className="resend-left">
                      <div className="resend-icon">
                        <RefreshCw
                          size={18}
                          className={
                            resending
                              ? "spin"
                              : ""
                          }
                        />
                      </div>

                      <div>
                        <strong>Didn't receive the code?</strong>
                        <span>
                          {resendSeconds > 0
                            ? `Request another code in ${resendSeconds}s`
                            : "You can request a fresh OTP now"}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="resend-button"
                      onClick={resendOtp}
                      disabled={
                        resendSeconds > 0 ||
                        resending ||
                        loading
                      }
                    >
                      {resending ? (
                        <>
                          <span className="small-spinner" />
                          Sending
                        </>
                      ) : (
                        <>
                          <RefreshCw size={15} />
                          {resendSeconds > 0
                            ? `Resend ${resendSeconds}s`
                            : "Resend OTP"}
                        </>
                      )}
                    </button>
                  </div>

                  {infoMessage && (
                    <div className="inline-message">
                      <CircleCheck size={16} />
                      <span>{infoMessage}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={
                      loading ||
                      otpValue.length !== 6
                    }
                  >
                    <span>
                      {loading
                        ? "Verifying..."
                        : "Verify OTP"}
                    </span>

                    <span className="button-icon">
                      {loading ? (
                        <span className="spinner" />
                      ) : (
                        <ArrowRight size={19} />
                      )}
                    </span>
                  </button>
                </form>

                <button
                  type="button"
                  className="text-back-button"
                  onClick={goBack}
                  disabled={loading}
                >
                  <ArrowLeft size={17} />
                  Change email or mobile
                </button>
              </div>
            )}

            {step === 3 && (
              <div className="step-screen">
                <div className="screen-icon">
                  <LockKeyhole size={29} />
                </div>

                <div className="screen-kicker">
                  STEP 03 · CREATE PASSWORD
                </div>

                <h1>
                  Create a new
                  <br />
                  <span>password.</span>
                </h1>

                <p className="screen-description">
                  Your identity has been verified. Choose a
                  strong password for your account.
                </p>

                <form
                  className="recovery-form"
                  onSubmit={resetPassword}
                >
                  <div className="field">
                    <label htmlFor="forgot-new-password">
                      New password
                    </label>

                    <div className="input-box">
                      <LockKeyhole size={19} />

                      <input
                        id="forgot-new-password"
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        value={
                          passwords.newPassword
                        }
                        onChange={(event) => {
                          setPasswords(
                            (previous) => ({
                              ...previous,
                              newPassword:
                                event.target.value,
                            })
                          );
                          clearMessages();
                        }}
                        placeholder="Enter a new password"
                        autoComplete="new-password"
                        disabled={loading}
                      />

                      <button
                        type="button"
                        className="password-eye"
                        onClick={() =>
                          setShowPassword(
                            (value) => !value
                          )
                        }
                        disabled={loading}
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="forgot-confirm-password">
                      Confirm new password
                    </label>

                    <div className="input-box">
                      <LockKeyhole size={19} />

                      <input
                        id="forgot-confirm-password"
                        type={
                          showConfirmPassword
                            ? "text"
                            : "password"
                        }
                        value={
                          passwords.confirmPassword
                        }
                        onChange={(event) => {
                          setPasswords(
                            (previous) => ({
                              ...previous,
                              confirmPassword:
                                event.target.value,
                            })
                          );
                          clearMessages();
                        }}
                        placeholder="Confirm your new password"
                        autoComplete="new-password"
                        disabled={loading}
                      />

                      <button
                        type="button"
                        className="password-eye"
                        onClick={() =>
                          setShowConfirmPassword(
                            (value) => !value
                          )
                        }
                        disabled={loading}
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="field-error password-error">
                      {errorMessage}
                    </div>
                  )}

                  <div className="password-rules">
                    {passwordRules.map((rule) => (
                      <div
                        key={rule.text}
                        className={
                          rule.valid ? "valid" : ""
                        }
                      >
                        <CheckCircle2 size={14} />
                        <span>{rule.text}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={loading}
                  >
                    <span>
                      {loading
                        ? "Updating password..."
                        : "Reset password"}
                    </span>

                    <span className="button-icon">
                      {loading ? (
                        <span className="spinner" />
                      ) : (
                        <ArrowRight size={19} />
                      )}
                    </span>
                  </button>
                </form>

                <button
                  type="button"
                  className="text-back-button"
                  onClick={goBack}
                  disabled={loading}
                >
                  <ArrowLeft size={17} />
                  Back to OTP
                </button>
              </div>
            )}

            {step === 4 && (
              <div className="success-screen">
                <div className="success-icon">
                  <CheckCircle2 size={42} />
                </div>

                <div className="success-kicker">
                  PASSWORD UPDATED
                </div>

                <h1>
                  You're all
                  <br />
                  <span>set.</span>
                </h1>

                <p className="success-description">
                  {successMessage ||
                    "Your password has been reset successfully. You can now sign in securely with your new password."}
                </p>

                <div className="account-summary">
                  <div className="account-summary-icon">
                    {isEmail ? (
                      <Mail size={20} />
                    ) : (
                      <Phone size={20} />
                    )}
                  </div>

                  <div>
                    <span>Recovery account</span>
                    <strong>
                      {maskedIdentifier}
                    </strong>
                  </div>

                  <CheckCircle2
                    className="account-check"
                    size={20}
                  />
                </div>

                <div className="success-security">
                  <ShieldCheck size={20} />

                  <div>
                    <strong>
                      Recovery completed securely
                    </strong>
                    <span>
                      Your previous reset session is no
                      longer usable.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    navigate("/login")
                  }
                >
                  <span>Continue to Login</span>

                  <span className="button-icon">
                    <ArrowRight size={19} />
                  </span>
                </button>

                <button
                  type="button"
                  className="text-back-button center"
                  onClick={startOver}
                >
                  Start another recovery
                </button>
              </div>
            )}
          </div>

          <div className="content-footer">
            <span>
              <ShieldCheck size={14} />
              InternMatch AI secure recovery
            </span>

            <span>© {new Date().getFullYear()} InternMatch AI</span>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ForgotPassword;
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  UserCircle,
  LockKeyhole,
  Monitor,
  Trash2,
  Save,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  LogOut,
  X,
  Mail,
  Phone,
  UserRound,
  ArrowRight,
  KeyRound,
  ShieldAlert,
} from "lucide-react";

import "../styles/Settings.css";

const API_BASE_URL = "http://127.0.0.1:8000";

function Settings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /* =========================================================
     ACTIVE SECTION
     ========================================================= */

  const [activeSection, setActiveSection] = useState(
    searchParams.get("section") || "account",
  );

  /* =========================================================
     USER
     ========================================================= */

  const [user, setUser] = useState({
    id: "",
    full_name: "",
    email: "",
    phone: "",
    role: "",
  });

  const [loadingUser, setLoadingUser] = useState(true);

  /* =========================================================
     EDIT PROFILE
     ========================================================= */

  const [profileForm, setProfileForm] = useState({
    full_name: "",
    email: "",
    phone: "",
  });

  const [savingProfile, setSavingProfile] = useState(false);

  /* =========================================================
     PASSWORD
     ========================================================= */

  const [currentPassword, setCurrentPassword] = useState("");

  const [newPassword, setNewPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  const [showNewPassword, setShowNewPassword] = useState(false);

  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [changingPassword, setChangingPassword] = useState(false);

  /* =========================================================
     DELETE
     ========================================================= */

  const [deletePassword, setDeletePassword] = useState("");

  const [showDeletePassword, setShowDeletePassword] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [deletingAccount, setDeletingAccount] = useState(false);

  /* =========================================================
     MESSAGES
     ========================================================= */

  const [success, setSuccess] = useState("");

  const [error, setError] = useState("");

  /* =========================================================
     TOKEN
     ========================================================= */

  const getToken = () => {
    return (
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("accessToken") ||
      ""
    );
  };

  /* =========================================================
     AUTH HEADERS
     ========================================================= */

  const getAuthHeaders = () => {
    const token = getToken();

    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
    };
  };

  /* =========================================================
     UNAUTHORIZED
     ========================================================= */

  const handleUnauthorized = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("accessToken");

    localStorage.removeItem("user");
    localStorage.removeItem("userData");
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("dashboard_type");

    navigate("/login", {
      replace: true,
    });
  };

  /* =========================================================
     CLEAR MESSAGE
     ========================================================= */

  const clearMessages = () => {
    setSuccess("");
    setError("");
  };

  /* =========================================================
     LOAD USER
     ========================================================= */

  useEffect(() => {
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    setLoadingUser(true);
    clearMessages();

    const token = getToken();

    /*
     * First use localStorage so the UI appears immediately.
     */

    const storedUser =
      localStorage.getItem("user") ||
      localStorage.getItem("userData") ||
      localStorage.getItem("loggedInUser");

    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);

        const localUser = {
          id: parsed?.id || "",
          full_name: parsed?.full_name || parsed?.name || "",
          email: parsed?.email || "",
          phone: parsed?.phone || parsed?.phone_number || "",
          role: parsed?.role || "intern",
        };

        setUser(localUser);

        setProfileForm({
          full_name: localUser.full_name,
          email: localUser.email,
          phone: localUser.phone,
        });
      } catch {
        // Ignore invalid localStorage.
      }
    }

    if (!token) {
      setLoadingUser(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to load your account information.");
      }

      const data = await response.json();

      const loadedUser = {
        id: data?.id || "",
        full_name: data?.full_name || data?.name || "",
        email: data?.email || "",
        phone: data?.phone || "",
        role: data?.role || "intern",
      };

      setUser(loadedUser);

      setProfileForm({
        full_name: loadedUser.full_name,
        email: loadedUser.email,
        phone: loadedUser.phone,
      });

      /*
       * Keep localStorage synchronized with the database.
       */

      localStorage.setItem("user", JSON.stringify(loadedUser));
    } catch (err) {
      console.error("Settings user loading error:", err);

      /*
       * Do not destroy the local user data if
       * the API temporarily fails.
       */
    } finally {
      setLoadingUser(false);
    }
  };

  /* =========================================================
     CHANGE SECTION
     ========================================================= */

  const changeSection = (section) => {
    clearMessages();

    setActiveSection(section);

    navigate(`/settings?section=${section}`, {
      replace: true,
    });
  };

  /* =========================================================
     PROFILE FORM CHANGE
     ========================================================= */

  const handleProfileChange = (event) => {
    const { name, value } = event.target;

    setProfileForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  /* =========================================================
     SAVE PROFILE
     ========================================================= */

  const handleSaveProfile = async (event) => {
    event.preventDefault();

    clearMessages();

    const fullName = profileForm.full_name.trim();

    const email = profileForm.email.trim().toLowerCase();

    const phone = profileForm.phone.trim();

    if (!fullName) {
      setError("Please enter your full name.");
      return;
    }

    if (fullName.length < 2) {
      setError("Full name must contain at least 2 characters.");
      return;
    }

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!phone) {
      setError("Please enter your phone number.");
      return;
    }

    const phoneDigits = phone.replace(/\D/g, "");

    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      setError("Please enter a valid phone number.");
      return;
    }

    const token = getToken();

    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      setSavingProfile(true);

      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone,
        }),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || data?.message || "Unable to update your profile.",
        );
      }

      const savedUser = data?.user || data?.profile || data;

      const updatedUser = {
        id: savedUser?.id || user.id,
        full_name: savedUser?.full_name || fullName,
        email: savedUser?.email || email,
        phone: savedUser?.phone || phone,
        role: savedUser?.role || user.role || "intern",
      };

      /*
       * Update React state.
       */

      setUser(updatedUser);

      setProfileForm({
        full_name: updatedUser.full_name,
        email: updatedUser.email,
        phone: updatedUser.phone,
      });

      /*
       * Update localStorage.
       * Dashboard/profile/header can immediately
       * display the new values.
       */

      localStorage.setItem("user", JSON.stringify(updatedUser));

      /*
       * Keep older localStorage keys synchronized
       * if they exist in the application.
       */

      if (localStorage.getItem("userData")) {
        localStorage.setItem("userData", JSON.stringify(updatedUser));
      }

      if (localStorage.getItem("loggedInUser")) {
        localStorage.setItem("loggedInUser", JSON.stringify(updatedUser));
      }

      setSuccess("Profile updated successfully.");
    } catch (err) {
      console.error("Profile update error:", err);

      setError(err?.message || "Unable to update your profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  /* =========================================================
     CHANGE PASSWORD
     ========================================================= */

  const handleChangePassword = async (event) => {
    event.preventDefault();

    clearMessages();

    if (!currentPassword.trim()) {
      setError("Please enter your current password.");
      return;
    }

    if (!newPassword.trim()) {
      setError("Please enter your new password.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must contain at least 8 characters.");
      return;
    }

    if (!confirmPassword.trim()) {
      setError("Please confirm your new password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    const token = getToken();

    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      setChangingPassword(true);

      const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || data?.message || "Unable to change password.",
        );
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setSuccess(data?.message || "Password changed successfully.");
    } catch (err) {
      setError(err?.message || "Unable to change password.");
    } finally {
      setChangingPassword(false);
    }
  };

  /* =========================================================
     LOGOUT
     ========================================================= */

  const handleLogout = async () => {
    clearMessages();

    const token = getToken();

    try {
      if (token) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch {
      // Local logout still continues.
    }

    localStorage.removeItem("access_token");

    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("accessToken");

    localStorage.removeItem("user");
    localStorage.removeItem("userData");
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("dashboard_type");

    navigate("/", {
      replace: true,
    });
  };

  /* =========================================================
     DELETE ACCOUNT
     ========================================================= */

  const handleDeleteAccount = async () => {
    clearMessages();

    if (!deletePassword.trim()) {
      setError("Enter your current password.");
      return;
    }

    const token = getToken();

    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      setDeletingAccount(true);

      const response = await fetch(`${API_BASE_URL}/api/auth/account`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          password: deletePassword,
        }),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || data?.message || "Unable to delete account.",
        );
      }

      localStorage.clear();

      navigate("/login", {
        replace: true,
      });
    } catch (err) {
      setError(err?.message || "Unable to delete account.");

      setShowDeleteConfirm(false);
    } finally {
      setDeletingAccount(false);
    }
  };

  /* =========================================================
     PASSWORD STRENGTH
     ========================================================= */

  const passwordRules = {
    length: newPassword.length >= 8,

    uppercase: /[A-Z]/.test(newPassword),

    number: /[0-9]/.test(newPassword),

    symbol: /[^A-Za-z0-9]/.test(newPassword),
  };

  const passwordScore =
    Object.values(passwordRules).filter(Boolean).length * 25;

  const passwordStrength =
    passwordScore === 100
      ? "Strong"
      : passwordScore >= 50
        ? "Good"
        : passwordScore > 0
          ? "Weak"
          : "Build a stronger password";

  /* =========================================================
     INITIAL
     ========================================================= */

  const initials = (user.full_name || "User")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0])
    .join("")
    .toUpperCase();

  /* =========================================================
     SETTINGS ITEMS
     ========================================================= */

  const settingsItems = [
    {
      id: "account",
      number: "01",
      title: "Edit Profile",
      description: "Name, email and phone",
      icon: UserCircle,
    },

    {
      id: "password",
      number: "02",
      title: "Change Password",
      description: "Update your account password",
      icon: LockKeyhole,
    },

    {
      id: "session",
      number: "03",
      title: "Session",
      description: "Manage your current session",
      icon: Monitor,
    },

    {
      id: "delete",
      number: "04",
      title: "Delete Account",
      description: "Permanently remove account",
      icon: Trash2,
      danger: true,
    },
  ];

  /* =========================================================
     CONTENT
     ========================================================= */

  const renderAccount = () => (
    <section className="settings-panel">
      <div className="settings-panel-header">
        <div className="settings-panel-icon account-icon">
          <UserCircle size={27} />
        </div>

        <div>
          <span className="panel-eyebrow">ACCOUNT</span>

          <h1>Edit Profile</h1>

          <p>Update the basic information connected to your account.</p>
        </div>
      </div>

      <div className="profile-preview">
        <div className="profile-avatar">
          {initials || <UserRound size={28} />}
        </div>

        <div className="profile-preview-copy">
          <strong>{user.full_name || "Your Name"}</strong>

          <span>
            {user.role === "intern" ? "Intern" : user.role || "Intern"}
          </span>
        </div>

        <div className="profile-status">
          <CheckCircle2 size={15} />
          Account active
        </div>
      </div>

      <form className="profile-edit-form" onSubmit={handleSaveProfile}>
        <div className="form-section-title">
          <div>
            <span>PERSONAL INFORMATION</span>

            <h2>Your account details</h2>
          </div>

          <ShieldCheck size={21} />
        </div>

        <div className="profile-form-grid">
          {/* NAME */}

          <div className="settings-form-field field-full">
            <label htmlFor="full_name">Full Name</label>

            <div className="settings-input">
              <UserRound size={18} />

              <input
                id="full_name"
                name="full_name"
                type="text"
                value={profileForm.full_name}
                onChange={handleProfileChange}
                placeholder="Enter your full name"
                autoComplete="name"
              />
            </div>
          </div>

          {/* EMAIL */}

          <div className="settings-form-field">
            <label htmlFor="email">Email Address</label>

            <div className="settings-input">
              <Mail size={18} />

              <input
                id="email"
                name="email"
                type="email"
                value={profileForm.email}
                onChange={handleProfileChange}
                placeholder="Enter your email"
                autoComplete="email"
              />
            </div>
          </div>

          {/* PHONE */}

          <div className="settings-form-field">
            <label htmlFor="phone">Phone Number</label>

            <div className="settings-input">
              <Phone size={18} />

              <input
                id="phone"
                name="phone"
                type="tel"
                value={profileForm.phone}
                onChange={handleProfileChange}
                placeholder="Enter your phone number"
                autoComplete="tel"
              />
            </div>
          </div>
        </div>

        {/* READ ONLY ROLE */}

        <div className="readonly-account-info">
          <div className="readonly-icon">
            <ShieldCheck size={18} />
          </div>

          <div>
            <strong>Account role</strong>

            <span>
              {user.role === "intern" ? "Intern" : user.role || "Intern"} —
              managed by the system
            </span>
          </div>
        </div>

        <div className="form-bottom">
          <p>
            Only your name, email and phone number can be changed from this
            section.
          </p>

          <button
            type="submit"
            className="primary-settings-button"
            disabled={savingProfile}
          >
            {savingProfile ? (
              <>
                <LoaderCircle size={18} className="settings-spinner" />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );

  /* =========================================================
     PASSWORD CONTENT
     ========================================================= */

  const renderPassword = () => (
    <section className="settings-panel">
      <div className="settings-panel-header">
        <div className="settings-panel-icon password-icon">
          <LockKeyhole size={27} />
        </div>

        <div>
          <span className="panel-eyebrow">SECURITY</span>

          <h1>Change Password</h1>

          <p>Create a strong password to keep your account protected.</p>
        </div>
      </div>

      <form className="password-settings-form" onSubmit={handleChangePassword}>
        {/* CURRENT */}

        <div className="settings-form-field">
          <label htmlFor="current-password">Current Password</label>

          <div className="settings-input">
            <LockKeyhole size={18} />

            <input
              id="current-password"
              type={showCurrentPassword ? "text" : "password"}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Enter current password"
              autoComplete="current-password"
            />

            <button
              type="button"
              className="input-eye"
              onClick={() => setShowCurrentPassword((previous) => !previous)}
            >
              {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="password-two-column">
          {/* NEW */}

          <div className="settings-form-field">
            <label htmlFor="new-password">New Password</label>

            <div className="settings-input">
              <KeyRound size={18} />

              <input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Create new password"
                autoComplete="new-password"
              />

              <button
                type="button"
                className="input-eye"
                onClick={() => setShowNewPassword((previous) => !previous)}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* CONFIRM */}

          <div className="settings-form-field">
            <label htmlFor="confirm-password">Confirm New Password</label>

            <div className="settings-input">
              <KeyRound size={18} />

              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat new password"
                autoComplete="new-password"
              />

              <button
                type="button"
                className="input-eye"
                onClick={() => setShowConfirmPassword((previous) => !previous)}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        </div>

        {/* STRENGTH */}

        <div className="password-strength-box">
          <div className="strength-title">
            <span>Password strength</span>

            <strong>{passwordStrength}</strong>
          </div>

          <div className="strength-bar">
            <span
              style={{
                width: `${passwordScore}%`,
              }}
            />
          </div>

          <div className="strength-rules">
            <span className={passwordRules.length ? "active" : ""}>
              8+ characters
            </span>

            <span className={passwordRules.uppercase ? "active" : ""}>
              Uppercase
            </span>

            <span className={passwordRules.number ? "active" : ""}>Number</span>

            <span className={passwordRules.symbol ? "active" : ""}>Symbol</span>
          </div>
        </div>

        <div className="security-tip">
          <ShieldCheck size={20} />

          <div>
            <strong>Security recommendation</strong>

            <span>
              Use a unique password that you do not use on other websites.
            </span>
          </div>
        </div>

        <div className="form-bottom">
          <p>
            Your existing password will remain unchanged until you save a new
            one.
          </p>

          <button
            type="submit"
            className="primary-settings-button"
            disabled={changingPassword}
          >
            {changingPassword ? (
              <>
                <LoaderCircle size={18} className="settings-spinner" />
                Updating...
              </>
            ) : (
              <>
                <Save size={18} />
                Change Password
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );

  /* =========================================================
     SESSION CONTENT
     ========================================================= */

  const renderSession = () => (
    <section className="settings-panel session-panel">
      <div className="settings-panel-header">
        <div className="settings-panel-icon session-icon">
          <Monitor size={27} />
        </div>

        <div>
          <span className="panel-eyebrow">SESSION</span>

          <h1>Current Session</h1>

          <p>Manage your current InternMatchAI login session.</p>
        </div>
      </div>

      <div className="session-status-card">
        <div className="session-status-icon">
          <ShieldCheck size={26} />
        </div>

        <div>
          <span className="session-status-label">CURRENT SESSION</span>

          <h2>You are securely signed in</h2>

          <p>Your current account session is active on this device.</p>
        </div>

        <span className="online-badge">
          <i />
          Active
        </span>
      </div>

      <div className="session-info-grid">
        <div>
          <span>ACCOUNT</span>

          <strong>{user.email || "Current account"}</strong>
        </div>

        <div>
          <span>ROLE</span>

          <strong>
            {user.role === "intern" ? "Intern" : user.role || "Intern"}
          </strong>
        </div>
      </div>

      <div className="logout-section">
        <div className="logout-copy">
          <div className="logout-icon">
            <LogOut size={21} />
          </div>

          <div>
            <h2>Sign out of your account</h2>

            <p>
              You will need to login again to access your InternMatchAI account.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="logout-settings-button"
          onClick={handleLogout}
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </section>
  );

  /* =========================================================
     DELETE CONTENT
     ========================================================= */

  const renderDelete = () => (
    <section className="settings-panel delete-panel">
      <div className="settings-panel-header">
        <div className="settings-panel-icon delete-icon">
          <Trash2 size={27} />
        </div>

        <div>
          <span className="panel-eyebrow danger-text">DANGER ZONE</span>

          <h1>Delete Account</h1>

          <p>Permanently remove your InternMatchAI account.</p>
        </div>
      </div>

      <div className="delete-warning">
        <div className="delete-warning-icon">
          <ShieldAlert size={24} />
        </div>

        <div>
          <h2>This action cannot be undone</h2>

          <p>
            Deleting your account will permanently remove your account and
            associated information.
          </p>
        </div>
      </div>

      {!showDeleteConfirm ? (
        <div className="delete-action-area">
          <div>
            <h2>Permanently delete account</h2>

            <p>Make sure you are certain before continuing.</p>
          </div>

          <button
            type="button"
            className="delete-main-button"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 size={18} />
            Delete Account
          </button>
        </div>
      ) : (
        <div className="delete-confirm-box">
          <div className="delete-confirm-heading">
            <ShieldAlert size={21} />

            <div>
              <strong>Confirm account deletion</strong>

              <span>Enter your current password to continue.</span>
            </div>
          </div>

          <div className="settings-form-field">
            <label htmlFor="delete-password">Current Password</label>

            <div className="settings-input">
              <LockKeyhole size={18} />

              <input
                id="delete-password"
                type={showDeletePassword ? "text" : "password"}
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                placeholder="Enter current password"
                autoComplete="current-password"
              />

              <button
                type="button"
                className="input-eye"
                onClick={() => setShowDeletePassword((previous) => !previous)}
              >
                {showDeletePassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="delete-confirm-actions">
            <button
              type="button"
              className="cancel-delete-settings"
              onClick={() => {
                setShowDeleteConfirm(false);

                setDeletePassword("");

                clearMessages();
              }}
              disabled={deletingAccount}
            >
              Cancel
            </button>

            <button
              type="button"
              className="confirm-delete-settings"
              onClick={handleDeleteAccount}
              disabled={deletingAccount}
            >
              {deletingAccount ? (
                <>
                  <LoaderCircle size={17} className="settings-spinner" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={17} />
                  Delete Permanently
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </section>
  );

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className="settings-page">
      <div className="settings-bg-orb settings-bg-orb-one" />
      <div className="settings-bg-orb settings-bg-orb-two" />

      <div className="settings-shell">
        {/* ===================================================
            LEFT SETTINGS MENU
            =================================================== */}

        <aside className="settings-sidebar">
          <div className="settings-sidebar-header">
            <span>SETTINGS</span>

            <h2>Account Settings</h2>

            <p>Manage your account and security preferences.</p>
          </div>

          <div className="settings-menu">
            {settingsItems.map((item) => {
              const Icon = item.icon;

              const active = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`
                      settings-menu-item
                      ${active ? "active" : ""}
                      ${item.danger ? "danger-menu-item" : ""}
                    `}
                  onClick={() => changeSection(item.id)}
                >
                  <span className="menu-number">{item.number}</span>

                  <span className="menu-icon">
                    <Icon size={20} />
                  </span>

                  <span className="menu-copy">
                    <strong>{item.title}</strong>

                    <small>{item.description}</small>
                  </span>

                  <ArrowRight size={17} className="menu-arrow" />
                </button>
              );
            })}
          </div>

          <div className="sidebar-security-note">
            <ShieldCheck size={18} />

            <div>
              <strong>Account protected</strong>

              <span>Your account settings are secured.</span>
            </div>
          </div>
        </aside>

        {/* ===================================================
            RIGHT CONTENT
            =================================================== */}

        <main className="settings-main">
          {success && (
            <div className="settings-alert success-alert">
              <CheckCircle2 size={19} />

              <span>{success}</span>

              <button type="button" onClick={() => setSuccess("")}>
                <X size={16} />
              </button>
            </div>
          )}

          {error && (
            <div className="settings-alert error-alert">
              <AlertCircle size={19} />

              <span>{error}</span>

              <button type="button" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}

          {loadingUser ? (
            <div className="settings-loading">
              <LoaderCircle size={30} className="settings-spinner" />

              <h2>Loading settings...</h2>

              <p>Fetching your account information.</p>
            </div>
          ) : (
            <>
              {activeSection === "account" && renderAccount()}

              {activeSection === "password" && renderPassword()}

              {activeSection === "session" && renderSession()}

              {activeSection === "delete" && renderDelete()}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default Settings;

import React, { useEffect, useState } from "react";
import {
  Eye,
  X,
  Clock3,
  CheckCircle2,
  XCircle,
  RotateCcw,
  MapPin,
  CalendarDays,
  BriefcaseBusiness,
  IndianRupee,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import "../styles/Application.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function getToken(auth) {
  const candidates = [
    auth?.token,
    auth?.accessToken,
    auth?.access_token,
    localStorage.getItem("access_token"),
    localStorage.getItem("accessToken"),
    localStorage.getItem("token"),
    localStorage.getItem("authToken"),
    localStorage.getItem("jwt"),
  ];

  const token = candidates.find((value) => value && String(value).trim());

  if (!token) return null;

  return String(token).startsWith("Bearer ")
    ? String(token).slice(7)
    : String(token);
}

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({ status }) {
  const normalized = String(status || "pending").toLowerCase();

  if (normalized === "approved") {
    return (
      <span className="application-status approved">
        <CheckCircle2 size={15} />
        Approved
      </span>
    );
  }

  if (normalized === "rejected") {
    return (
      <span className="application-status rejected">
        <XCircle size={15} />
        Rejected
      </span>
    );
  }

  if (normalized === "withdrawn") {
    return (
      <span className="application-status withdrawn">
        <RotateCcw size={15} />
        Withdrawn
      </span>
    );
  }

  return (
    <span className="application-status pending">
      <Clock3 size={15} />
      Pending
    </span>
  );
}

/* =========================================================
   MAIN
========================================================= */

export default function Application() {
  const auth = useAuth();

  const token = getToken(auth);

  const [applications, setApplications] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState("all");

  const [selectedApplication, setSelectedApplication] = useState(null);

  const [loadingDetails, setLoadingDetails] = useState(false);

  const [withdrawing, setWithdrawing] = useState(false);

  // Application waiting for the user's withdraw confirmation.
  const [withdrawConfirmation, setWithdrawConfirmation] = useState(null);

  /* =========================================================
     LOAD APPLICATIONS
  ========================================================= */

  const loadApplications = async () => {
    if (!token) {
      setError("Please login again.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_BASE_URL}/api/applications/my`, {
        method: "GET",

        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || "Unable to load applications.");
      }

      setApplications(data?.applications || []);
    } catch (err) {
      console.error("Applications loading error:", err);

      setError(err?.message || "Unable to load your applications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, [token]);

  /* =========================================================
     FILTER
  ========================================================= */

  const filteredApplications =
    activeTab === "all"
      ? applications
      : applications.filter(
          (application) =>
            String(application.status).toLowerCase() === activeTab,
        );

  /* =========================================================
     COUNTS
  ========================================================= */

  const getCount = (status) => {
    return applications.filter(
      (application) => String(application.status).toLowerCase() === status,
    ).length;
  };

  /* =========================================================
     VIEW DETAILS
  ========================================================= */

  const handleViewDetails = async (applicationId) => {
    if (!token) {
      alert("Please login again.");
      return;
    }

    try {
      setLoadingDetails(true);

      const response = await fetch(
        `${API_BASE_URL}/api/applications/${applicationId}`,
        {
          method: "GET",

          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || "Unable to load application details.");
      }

      setSelectedApplication(data?.application || null);
    } catch (err) {
      console.error("Application details error:", err);

      alert(err?.message || "Unable to load application details.");
    } finally {
      setLoadingDetails(false);
    }
  };

  /* =========================================================
     WITHDRAW
  ========================================================= */

  const handleWithdraw = (applicationId) => {
    if (!token) {
      alert("Please login again.");
      return;
    }

    const application = applications.find(
      (item) => item.application_id === applicationId,
    );

    setWithdrawConfirmation({
      applicationId,
      jobTitle: application?.job_title || "this internship",
      companyName: application?.company_name || "the company",
    });
  };

  const cancelWithdraw = () => {
    if (withdrawing) return;
    setWithdrawConfirmation(null);
  };

  const confirmWithdraw = async () => {
    if (!withdrawConfirmation?.applicationId) {
      setWithdrawConfirmation(null);
      return;
    }

    if (!token) {
      alert("Please login again.");
      setWithdrawConfirmation(null);
      return;
    }

    try {
      setWithdrawing(true);

      const response = await fetch(
        `${API_BASE_URL}/api/applications/${withdrawConfirmation.applicationId}/withdraw`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || "Unable to withdraw application.");
      }

      setWithdrawConfirmation(null);
      setSelectedApplication(null);
      await loadApplications();

      alert("Application withdrawn successfully.");
    } catch (err) {
      console.error("Withdraw application error:", err);
      alert(err?.message || "Unable to withdraw application.");
    } finally {
      setWithdrawing(false);
    }
  };

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div className="applications-page">
        <div className="applications-loading">
          <div className="applications-spinner" />

          <h2>Loading your applications...</h2>

          <p>Please wait while we retrieve your application history.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="applications-page">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <section className="applications-hero">
        <div>
          <span className="applications-eyebrow">APPLICATION CENTER</span>

          <h1>My Applications</h1>

          <p>Track every internship application you've submitted.</p>
        </div>

        <div className="applications-total">
          <strong>{applications.length}</strong>

          <span>Total Applications</span>
        </div>
      </section>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="applications-error">
          <XCircle size={19} />

          <span>{error}</span>
        </div>
      )}

      {/* =====================================================
          TABS
      ===================================================== */}

      <div className="applications-tabs">
        <button
          className={activeTab === "all" ? "active" : ""}
          onClick={() => setActiveTab("all")}
        >
          All
          <span>{applications.length}</span>
        </button>

        <button
          className={activeTab === "pending" ? "active" : ""}
          onClick={() => setActiveTab("pending")}
        >
          Pending
          <span>{getCount("pending")}</span>
        </button>

        <button
          className={activeTab === "approved" ? "active" : ""}
          onClick={() => setActiveTab("approved")}
        >
          Approved
          <span>{getCount("approved")}</span>
        </button>

        <button
          className={activeTab === "rejected" ? "active" : ""}
          onClick={() => setActiveTab("rejected")}
        >
          Rejected
          <span>{getCount("rejected")}</span>
        </button>

        <button
          className={activeTab === "withdrawn" ? "active" : ""}
          onClick={() => setActiveTab("withdrawn")}
        >
          Withdrawn
          <span>{getCount("withdrawn")}</span>
        </button>
      </div>

      {/* =====================================================
          APPLICATIONS
      ===================================================== */}

      {filteredApplications.length === 0 ? (
        <section className="applications-empty">
          <div className="applications-empty-icon">
            <BriefcaseBusiness size={32} />
          </div>

          <h2>No applications found</h2>

          <p>You don't have any applications under this category yet.</p>
        </section>
      ) : (
        <section className="applications-list">
          {filteredApplications.map((application) => (
            <article
              className="application-card"
              key={application.application_id}
            >
              {/* COMPANY */}

              <div className="application-company">
                <div className="company-logo">
                  {String(application.company_name || "I")
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div>
                  <h2>{application.job_title}</h2>

                  <p>{application.company_name}</p>
                </div>
              </div>

              {/* DETAILS */}

              <div className="application-meta">
                {application.location && (
                  <span>
                    <MapPin size={15} />
                    {application.location}
                  </span>
                )}

                {application.duration && (
                  <span>
                    <CalendarDays size={15} />
                    {application.duration}
                  </span>
                )}

                {application.work_mode && (
                  <span>
                    <BriefcaseBusiness size={15} />
                    {application.work_mode}
                  </span>
                )}

                {application.stipend && (
                  <span>
                    <IndianRupee size={15} />
                    {application.stipend}
                  </span>
                )}
              </div>

              {/* STATUS */}

              <div className="application-status-area">
                <StatusBadge status={application.status} />

                <span className="application-date">
                  Applied{" "}
                  {application.applied_at
                    ? new Date(application.applied_at).toLocaleDateString(
                        "en-IN",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        },
                      )
                    : "—"}
                </span>
              </div>

              {/* ACTIONS */}

              <div className="application-actions">
                <button
                  className="application-view-button"
                  onClick={() => handleViewDetails(application.application_id)}
                >
                  <Eye size={17} />
                  View Details
                </button>

                {application.can_withdraw && (
                  <button
                    className="application-withdraw-button"
                    onClick={() => handleWithdraw(application.application_id)}
                  >
                    <RotateCcw size={16} />
                    Withdraw
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      {/* =====================================================
          DETAILS MODAL
      ===================================================== */}

      {selectedApplication && (
        <div
          className="application-modal-overlay"
          onClick={() => setSelectedApplication(null)}
        >
          <div
            className="application-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="application-modal-close"
              onClick={() => setSelectedApplication(null)}
            >
              <X size={20} />
            </button>

            {/* HEADER */}

            <div className="application-modal-header">
              <div className="company-logo large">
                {String(selectedApplication.internship?.company_name || "I")
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div>
                <span>APPLICATION DETAILS</span>

                <h2>{selectedApplication.internship?.title}</h2>

                <p>{selectedApplication.internship?.company_name}</p>
              </div>
            </div>

            {/* STATUS */}

            <div className="application-modal-status">
              <StatusBadge status={selectedApplication.status} />

              {selectedApplication.applied_at && (
                <span>
                  Applied{" "}
                  {new Date(selectedApplication.applied_at).toLocaleDateString(
                    "en-IN",
                    {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    },
                  )}
                </span>
              )}
            </div>

            {/* INTERNSHIP DETAILS */}

            <section className="application-detail-section">
              <h3>Internship Details</h3>

              <div className="application-detail-grid">
                <div>
                  <span>Company</span>

                  <strong>
                    {selectedApplication.internship?.company_name}
                  </strong>
                </div>

                <div>
                  <span>Role</span>

                  <strong>{selectedApplication.internship?.title}</strong>
                </div>

                <div>
                  <span>Location</span>

                  <strong>
                    {selectedApplication.internship?.location ||
                      "Not specified"}
                  </strong>
                </div>

                <div>
                  <span>Duration</span>

                  <strong>
                    {selectedApplication.internship?.duration ||
                      "Not specified"}
                  </strong>
                </div>

                <div>
                  <span>Work Mode</span>

                  <strong>
                    {selectedApplication.internship?.work_mode ||
                      "Not specified"}
                  </strong>
                </div>

                <div>
                  <span>Stipend</span>

                  <strong>
                    {selectedApplication.internship?.stipend || "Not specified"}
                  </strong>
                </div>
              </div>

              {selectedApplication.internship?.description && (
                <div className="application-description">
                  <span>Description</span>

                  <p>{selectedApplication.internship.description}</p>
                </div>
              )}
            </section>

            {/* COVER LETTER */}

            <section className="application-detail-section">
              <h3>Submitted Cover Letter</h3>

              <div className="application-cover-letter">
                {selectedApplication.cover_letter}
              </div>
            </section>

            {/* WITHDRAW */}

            {selectedApplication.can_withdraw && (
              <div className="application-modal-footer">
                <button
                  className="application-withdraw-large"
                  disabled={withdrawing}
                  onClick={() =>
                    handleWithdraw(selectedApplication.application_id)
                  }
                >
                  <RotateCcw size={17} />

                  {withdrawing ? "Withdrawing..." : "Withdraw Application"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* =====================================================
          WITHDRAW CONFIRMATION POPUP
      ===================================================== */}

      {withdrawConfirmation && (
        <div
          className="withdraw-confirm-overlay"
          onClick={cancelWithdraw}
          role="presentation"
        >
          <div
            className="withdraw-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdraw-confirm-title"
            aria-describedby="withdraw-confirm-message"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="withdraw-confirm-icon">
              <RotateCcw size={25} />
            </div>

            <div className="withdraw-confirm-content">
              <h2 id="withdraw-confirm-title">Withdraw Application?</h2>

              <p id="withdraw-confirm-message">
                Are you sure you want to withdraw your application for{" "}
                <strong>{withdrawConfirmation.jobTitle}</strong> at{" "}
                <strong>{withdrawConfirmation.companyName}</strong>?
              </p>

              <span className="withdraw-confirm-note">
                This action will change the application status to Withdrawn.
              </span>
            </div>

            <div className="withdraw-confirm-actions">
              <button
                type="button"
                className="withdraw-cancel-button"
                onClick={cancelWithdraw}
                disabled={withdrawing}
              >
                Cancel
              </button>

              <button
                type="button"
                className="withdraw-confirm-button"
                onClick={confirmWithdraw}
                disabled={withdrawing}
              >
                <RotateCcw size={17} />
                {withdrawing ? "Withdrawing..." : "Withdraw"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

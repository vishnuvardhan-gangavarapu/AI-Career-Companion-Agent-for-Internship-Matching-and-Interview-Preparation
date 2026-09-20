import React, { useCallback, useEffect, useState } from "react";

import {
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  CalendarDays,
  IndianRupee,
  MapPin,
  Trash2,
  ArrowRight,
  Search,
  X,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import "../styles/SavedInternships.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const SAVED_INTERNSHIPS_URL = `${API_BASE}/api/internships/saved`;

function getAuthToken() {
  const keys = ["access_token", "accessToken", "token", "authToken", "jwt"];

  for (const key of keys) {
    const value = localStorage.getItem(key);

    if (value) {
      return value.startsWith("Bearer ") ? value.substring(7) : value;
    }
  }

  return "";
}

function clearAuthAndRedirect() {
  localStorage.removeItem("access_token");

  localStorage.removeItem("accessToken");

  localStorage.removeItem("token");

  localStorage.removeItem("authToken");

  localStorage.removeItem("jwt");

  window.location.href = "/login";
}

const getInternshipId = (internship) => {
  if (!internship || typeof internship !== "object") {
    return null;
  }

  const nested =
    internship.internship && typeof internship.internship === "object"
      ? internship.internship
      : null;

  const value =
    internship.internship_id ??
    internship.internshipId ??
    internship.id ??
    nested?.internship_id ??
    nested?.internshipId ??
    nested?.id ??
    null;

  const numberValue = Number(value);

  return Number.isInteger(numberValue) && numberValue > 0
    ? numberValue
    : null;
};

const getInternshipTitle = (internship) => {
  return (
    internship?.title ||
    internship?.job_title ||
    internship?.jobTitle ||
    internship?.position ||
    "Internship"
  );
};

const getCompanyName = (internship) => {
  return (
    internship?.company_name ||
    internship?.companyName ||
    internship?.company ||
    "Company"
  );
};

const getLocation = (internship) => {
  return (
    internship?.location || internship?.city || internship?.job_location || ""
  );
};

const getDuration = (internship) => {
  return (
    internship?.duration ||
    internship?.duration_months ||
    internship?.durationMonths ||
    ""
  );
};

const getWorkMode = (internship) => {
  return (
    internship?.work_mode || internship?.workMode || internship?.mode || ""
  );
};

const getStipend = (internship) => {
  if (!internship) {
    return "";
  }

  if (
    internship.stipend !== undefined &&
    internship.stipend !== null &&
    String(internship.stipend).trim() !== ""
  ) {
    return String(internship.stipend);
  }

  const min = internship.stipend_min ?? internship.stipendMin ?? null;

  const max = internship.stipend_max ?? internship.stipendMax ?? null;

  if (min !== null || max !== null) {
    if (min !== null && max !== null) {
      return `₹${min} - ₹${max}`;
    }

    if (min !== null) {
      return `₹${min}`;
    }

    return `₹${max}`;
  }

  return "";
};

function getApiErrorMessage(responseData, fallback = "Something went wrong.") {
  if (!responseData) {
    return fallback;
  }

  if (typeof responseData === "string") {
    return responseData.trim() || fallback;
  }

  if (typeof responseData.detail === "string") {
    return responseData.detail;
  }

  if (Array.isArray(responseData.detail)) {
    const messages = responseData.detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item === "object") {
          return item.msg || item.message || item.detail || "";
        }

        return "";
      })
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join(", ");
    }
  }

  if (typeof responseData.message === "string") {
    return responseData.message;
  }

  if (typeof responseData.error === "string") {
    return responseData.error;
  }

  return fallback;
}

function normalizeSavedInternship(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const nested =
    item.internship && typeof item.internship === "object"
      ? item.internship
      : null;

  const internshipId = getInternshipId(item);

  if (internshipId === null) {
    return null;
  }

  return {
    ...nested,
    ...item,
    id: internshipId,
    internship_id: internshipId,
    saved_id: item.saved_id ?? item.saved_internship_id ?? null,
    saved_at: item.saved_at ?? null,
    title:
      item.title ??
      item.job_title ??
      nested?.title ??
      nested?.job_title ??
      "Internship",
    company_name:
      item.company_name ??
      item.company ??
      nested?.company_name ??
      nested?.company ??
      "Company",
    location: item.location ?? nested?.location ?? "",
    duration: item.duration ?? nested?.duration ?? "",
    work_mode: item.work_mode ?? item.workMode ?? nested?.work_mode ?? "",
    stipend: item.stipend ?? nested?.stipend ?? "",
  };
}

function SavedInternships() {
  const navigate = useNavigate();

  const [savedInternships, setSavedInternships] = useState([]);

  const [searchText, setSearchText] = useState("");

  const [loading, setLoading] = useState(true);

  const [removingId, setRemovingId] = useState(null);

  const [error, setError] = useState("");

  const loadSavedInternships = useCallback(async () => {
    const token = getAuthToken();

    if (!token) {
      clearAuthAndRedirect();

      return;
    }

    try {
      setLoading(true);

      setError("");

      const response = await fetch(SAVED_INTERNSHIPS_URL, {
        method: "GET",

        headers: {
          Accept: "application/json",

          Authorization: `Bearer ${token}`,
        },
      });

      const responseText = await response.text();

      let responseData = null;

      try {
        responseData = responseText ? JSON.parse(responseText) : null;
      } catch {
        responseData = null;
      }

      if (response.status === 401) {
        clearAuthAndRedirect();

        return;
      }

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(responseData, "Unable to load saved internships."),
        );
      }

      const backendInternships = Array.isArray(responseData?.internships)
        ? responseData.internships
        : Array.isArray(responseData?.saved_internships)
          ? responseData.saved_internships
          : [];

      const normalizedInternships = backendInternships
        .map(normalizeSavedInternship)
        .filter(Boolean);

      setSavedInternships(normalizedInternships);
    } catch (requestError) {
      console.error("Load saved internships error:", requestError);

      setError(requestError?.message || "Unable to load saved internships.");

      setSavedInternships([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSavedInternships();
  }, [loadSavedInternships]);

  useEffect(() => {
    const handleFocus = () => {
      loadSavedInternships();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadSavedInternships]);

  const handleRemove = async (internshipId) => {
    if (internshipId === null || internshipId === undefined) {
      return;
    }

    const token = getAuthToken();

    if (!token) {
      clearAuthAndRedirect();

      return;
    }

    try {
      setRemovingId(internshipId);

      setError("");

      const response = await fetch(
        `${API_BASE}/api/internships/${encodeURIComponent(
          String(internshipId),
        )}/save`,
        {
          method: "DELETE",

          headers: {
            Accept: "application/json",

            Authorization: `Bearer ${token}`,
          },
        },
      );

      const responseText = await response.text();

      let responseData = null;

      try {
        responseData = responseText ? JSON.parse(responseText) : null;
      } catch {
        responseData = null;
      }

      if (response.status === 401) {
        clearAuthAndRedirect();

        return;
      }

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(
            responseData,
            "Unable to remove saved internship.",
          ),
        );
      }

      setSavedInternships((previous) =>
        previous.filter(
          (internship) =>
            String(getInternshipId(internship)) !== String(internshipId),
        ),
      );

      window.dispatchEvent(new Event("savedInternshipsChanged"));
    } catch (requestError) {
      console.error("Remove saved internship error:", requestError);

      setError(requestError?.message || "Unable to remove saved internship.");
    } finally {
      setRemovingId(null);
    }
  };

  const handleViewDetails = (internshipId) => {
    if (internshipId === null || internshipId === undefined) {
      console.error("Internship ID is missing.");

      return;
    }

    const selectedInternship = savedInternships.find(
      (item) => String(getInternshipId(item)) === String(internshipId),
    );

    navigate(`/internships/${internshipId}`, {
      state: {
        internshipId: String(internshipId),

        internship_id: String(internshipId),

        internship: selectedInternship || null,
      },
    });
  };

  const handleBrowseInternships = () => {
    navigate("/internships");
  };

  const normalizedSearch = searchText.trim().toLowerCase();

  const filteredInternships = savedInternships.filter((internship) => {
    if (!normalizedSearch) {
      return true;
    }

    const title = String(getInternshipTitle(internship)).toLowerCase();

    const company = String(getCompanyName(internship)).toLowerCase();

    const location = String(getLocation(internship)).toLowerCase();

    const workMode = String(getWorkMode(internship)).toLowerCase();

    return (
      title.includes(normalizedSearch) ||
      company.includes(normalizedSearch) ||
      location.includes(normalizedSearch) ||
      workMode.includes(normalizedSearch)
    );
  });

  if (loading) {
    return (
      <div className="saved-page">
        <div className="saved-background-orb saved-orb-one" />

        <div className="saved-background-orb saved-orb-two" />

        <div className="saved-background-orb saved-orb-three" />

        <section className="saved-empty">
          <div className="saved-empty-icon">
            <Bookmark size={36} />
          </div>

          <span className="saved-eyebrow">SAVED INTERNSHIPS</span>

          <h1>Loading saved internships...</h1>

          <p>Please wait while we load your saved internships.</p>
        </section>
      </div>
    );
  }

  if (error && savedInternships.length === 0) {
    return (
      <div className="saved-page">
        <div className="saved-background-orb saved-orb-one" />

        <div className="saved-background-orb saved-orb-two" />

        <div className="saved-background-orb saved-orb-three" />

        <section className="saved-empty">
          <div className="saved-empty-icon">
            <Bookmark size={36} />
          </div>

          <span className="saved-eyebrow">SAVED INTERNSHIPS</span>

          <h1>Unable to load saved internships</h1>

          <p>{error}</p>

          <button
            type="button"
            className="saved-browse-button"
            onClick={loadSavedInternships}
          >
            Try Again
            <ArrowRight size={18} />
          </button>
        </section>
      </div>
    );
  }

  if (savedInternships.length === 0) {
    return (
      <div className="saved-page">
        <div className="saved-background-orb saved-orb-one" />

        <div className="saved-background-orb saved-orb-two" />

        <div className="saved-background-orb saved-orb-three" />

        <section className="saved-empty">
          <div className="saved-empty-icon">
            <Bookmark size={36} />
          </div>

          <span className="saved-eyebrow">SAVED INTERNSHIPS</span>

          <h1>Your saved internships</h1>

          <p>
            You haven't saved any internships yet. Browse internships and save
            the opportunities you want to revisit later.
          </p>

          <button
            type="button"
            className="saved-browse-button"
            onClick={handleBrowseInternships}
          >
            <BriefcaseBusiness size={18} />
            Browse Internships
            <ArrowRight size={18} />
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="saved-page">

      <div className="saved-background-orb saved-orb-one" />

      <div className="saved-background-orb saved-orb-two" />

      <div className="saved-background-orb saved-orb-three" />

      <section className="saved-hero">
        <div className="saved-hero-content">
          <span className="saved-eyebrow">SAVED OPPORTUNITIES</span>

          <h1>Saved Internships</h1>

          <p>
            Keep track of the internships you're interested in and revisit them
            anytime.
          </p>
        </div>

        <div className="saved-count-card">
          <div className="saved-count-icon">
            <BookmarkCheck size={25} />
          </div>

          <div>
            <strong>{savedInternships.length}</strong>

            <span>Saved Internships</span>
          </div>
        </div>
      </section>

      {error && (
        <section className="saved-no-results">
          <p>{error}</p>
        </section>
      )}

      <section className="saved-toolbar">
        <div className="saved-search">
          <Search size={19} />

          <input
            type="text"
            placeholder="Search saved internships..."
            value={searchText}
            onChange={(event) => {
              setSearchText(event.target.value);
            }}
          />

          {searchText && (
            <button
              type="button"
              className="saved-search-clear"
              onClick={() => {
                setSearchText("");
              }}
              aria-label="Clear search"
              title="Clear search"
            >
              <X size={17} />
            </button>
          )}
        </div>

        <div className="saved-result-count">
          Showing <strong>{filteredInternships.length}</strong> of{" "}
          <strong>{savedInternships.length}</strong>
        </div>
      </section>

      {filteredInternships.length === 0 ? (
        <section className="saved-no-results">
          <Search size={32} />

          <h2>No saved internships found</h2>

          <p>Try searching with another keyword.</p>
        </section>
      ) : (
        <section className="saved-list">
          {filteredInternships.map((internship, index) => {
            const internshipId = getInternshipId(internship);

            const title = getInternshipTitle(internship);

            const company = getCompanyName(internship);

            const location = getLocation(internship);

            const duration = getDuration(internship);

            const workMode = getWorkMode(internship);

            const stipend = getStipend(internship);

            const isRemoving = String(removingId) === String(internshipId);

            return (
              <article
                className="saved-card"
                key={String(internshipId)}
                style={{
                  animationDelay: `${index * 0.08}s`,
                }}
              >

                <div className="saved-company">
                  <div className="saved-company-logo">
                    {String(company).charAt(0).toUpperCase()}
                  </div>

                  <div className="saved-company-info">
                    <h2>{title}</h2>

                    <p>{company}</p>
                  </div>
                </div>

                <div className="saved-meta">
                  {location && (
                    <span>
                      <MapPin size={16} />

                      {location}
                    </span>
                  )}

                  {duration && (
                    <span>
                      <CalendarDays size={16} />

                      {duration}
                    </span>
                  )}

                  {workMode && (
                    <span>
                      <BriefcaseBusiness size={16} />

                      {workMode}
                    </span>
                  )}

                  {stipend && (
                    <span>
                      <IndianRupee size={16} />

                      {stipend}
                    </span>
                  )}
                </div>

                <div className="saved-actions">
                  <button
                    type="button"
                    className="saved-view-button"
                    onClick={() => {
                      handleViewDetails(internshipId);
                    }}
                  >
                    View Details
                    <ArrowRight size={17} />
                  </button>

                  <button
                    type="button"
                    className="saved-remove-button"
                    onClick={() => {
                      handleRemove(internshipId);
                    }}
                    disabled={isRemoving}
                    title="Remove from saved internships"
                  >
                    <Trash2 size={17} />

                    {isRemoving ? "Removing..." : "Remove"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

export default SavedInternships;
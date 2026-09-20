import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  Filter,
  Heart,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";

import "../styles/Internships.css";

const API_BASE = "http://127.0.0.1:8000";

const ALL_INTERNSHIPS_URL = `${API_BASE}/api/internships/all`;
const MATCHED_INTERNSHIPS_URL = `${API_BASE}/api/internships/matched?min_match=30`;
const SAVED_INTERNSHIPS_URL = `${API_BASE}/api/internships/saved`;

function handleInvalidAuthentication() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("token");
  localStorage.removeItem("authToken");

  window.location.href = "/login";
}

function getAuthToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    ""
  );
}

function normalizeSkills(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item.trim();
        }

        if (item && typeof item === "object") {
          return (item.name || item.skill || item.title || "")
            .toString()
            .trim();
        }

        return "";
      })
      .filter(Boolean);
  }

  if (!value) {
    return [];
  }

  return String(value)
    .split(/[|;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeInternship(item, index) {
  const matchedSkills = normalizeSkills(
    item?.matching_skills ??
      item?.matched_skills ??
      item?.matchedSkills ??
      item?.skills,
  );

  const missingSkills = normalizeSkills(
    item?.missing_required_skills ??
      item?.required_missing_skills ??
      item?.missing_skills ??
      item?.missingSkills,
  );

  const requiredSkills = normalizeSkills(
    item?.required_skills ?? item?.requiredSkills,
  );

  const matchPercentage = Number(
    item?.match_percentage ??
      item?.matchPercentage ??
      item?.match_score ??
      item?.matchScore ??
      0,
  );

  const resolvedId =
    item?.id ??
    item?.internship_id ??
    item?.internshipId ??
    item?.internshipID ??
    item?.pk ??
    item?.uuid ??
    item?._id ??
    item?.internship?.id ??
    item?.internship?.internship_id ??
    item?.internship?.internshipId ??
    null;

  return {
    id: resolvedId,

    title:
      item?.title ?? item?.job_title ?? item?.role ?? "Internship Opportunity",

    company:
      item?.company_name ?? item?.company ?? item?.companyName ?? "Company",

    location: item?.location ?? "Location not specified",

    duration:
      item?.duration ??
      (item?.duration_months
        ? `${item.duration_months} months`
        : "Duration not specified"),

    mode: item?.work_mode ?? item?.mode ?? "Not specified",

    stipend: item?.stipend ?? "Stipend not disclosed",

    startDate: item?.start_date ?? item?.startDate ?? null,

    matchPercentage,

    category:
      item?.category ?? item?.type ?? item?.internship_type ?? "Internship",

    description:
      item?.description ??
      "This internship has been matched with your profile.",

    eligibility:
      item?.eligibility ?? "Eligibility information is not specified.",

    requiredSkills,

    matchedSkills,

    missingSkills,

    sourceUrl:
      item?.source_url ??
      item?.apply_url ??
      item?.application_url ??
      item?.url ??
      "",

    sourceType: item?.source_type ?? "",

    raw: item,
  };
}

function getInternshipAccessMode() {
  const dashboardType = String(
    localStorage.getItem("dashboard_type") || "",
  ).toLowerCase();

  const resumeAnalyzed = localStorage.getItem("resume_analyzed") === "true";

  const isDefaultUser =
    dashboardType === "default" ||
    dashboardType === "default_user" ||
    dashboardType === "defaultdashboard";

  return {
    dashboardType,
    resumeAnalyzed,
    isDefaultUser,
    useAllInternshipsApi: isDefaultUser && !resumeAnalyzed,
  };
}

async function fetchInternshipAccessMode(token) {
  const fallback = getInternshipAccessMode();

  if (!token) {
    return fallback;
  }

  try {
    const response = await fetch(`${API_BASE}/api/dashboard`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const responseText = await response.text();
    let data = null;

    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      data = null;
    }

    if (response.status === 401) {
      handleInvalidAuthentication();
      return fallback;
    }

    if (!response.ok) {
      console.warn(
        "Unable to verify dashboard/resume status:",
        response.status,
        data,
      );
      return fallback;
    }

    const dashboardType = String(
      data?.dashboard_type || "default",
    ).toLowerCase();

    const resumeAnalyzed =
      data?.has_analyzed_resume === true ||
      data?.resume_analyzed === true ||
      data?.resumeAnalyzed === true ||
      data?.has_user_data === true;

    const isDefaultUser = dashboardType !== "user";

    localStorage.setItem("dashboard_type", dashboardType);
    localStorage.setItem("resume_analyzed", String(resumeAnalyzed));

    return {
      dashboardType,
      resumeAnalyzed,
      isDefaultUser,
      useAllInternshipsApi: !resumeAnalyzed,
    };
  } catch (error) {
    console.warn("Dashboard status request failed:", error);
    return fallback;
  }
}

function Internships() {
  const navigate = useNavigate();
  const [internships, setInternships] = useState([]);

  const [totalInternships, setTotalInternships] = useState(null);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [apiError, setApiError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");

  const [locationFilter, setLocationFilter] = useState("All locations");

  const [durationFilter, setDurationFilter] = useState("All durations");

  const [workModeFilter, setWorkModeFilter] = useState("All work modes");

  const [categoryFilter, setCategoryFilter] = useState("All categories");

  const [stipendFilter, setStipendFilter] = useState("Any stipend");

  const [sortBy, setSortBy] = useState("Best Match");

  const [showFilters, setShowFilters] = useState(false);

  const [savedIds, setSavedIds] = useState(new Set());

  const [accessError, setAccessError] = useState("");

  const [accessErrorType, setAccessErrorType] = useState("");

  const loadInternships = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setApiError("");

      const token = getAuthToken();

      if (!token) {
        throw new Error("Authentication token not found. Please login again.");
      }

      const { dashboardType, resumeAnalyzed, useAllInternshipsApi } =
        await fetchInternshipAccessMode(token);

      const internshipUrl = useAllInternshipsApi
        ? ALL_INTERNSHIPS_URL
        : MATCHED_INTERNSHIPS_URL;

      console.log(
        "INTERNSHIP DASHBOARD TYPE:",
        dashboardType || "not specified",
      );

      console.log("RESUME ANALYZED:", resumeAnalyzed);

      console.log(
        "INTERNSHIP MODE:",
        useAllInternshipsApi ? "ALL INTERNSHIPS" : "RESUME MATCHED",
      );

      const response = await fetch(internshipUrl, {
        method: "GET",

        headers: {
          Accept: "application/json",

          Authorization: `Bearer ${token}`,
        },
      });

      console.log("INTERNSHIP API URL:", internshipUrl);

      console.log("INTERNSHIP API STATUS:", response.status);

      const responseText = await response.text();

      console.log("INTERNSHIP API RESPONSE:", responseText);

      if (!response.ok) {
        let backendMessage = `Request failed with status ${response.status}`;

        try {
          const errorData = JSON.parse(responseText);

          if (errorData?.detail) {
            backendMessage = errorData.detail;
          }
        } catch {
          if (responseText) {
            backendMessage = responseText;
          }
        }

        if (response.status === 401) {
          console.warn(
            "Internship API authentication failed. Redirecting to login.",
          );

          setInternships([]);
          setApiError("Your login session has expired. Please login again.");

          handleInvalidAuthentication();
          return;
        }

        throw new Error(backendMessage);
      }

      let data;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error("Backend returned invalid JSON.");
      }

      console.log("REAL INTERNSHIP API DATA:", data);

      const list = Array.isArray(data?.internships)
        ? data.internships
        : Array.isArray(data?.matches)
          ? data.matches
          : Array.isArray(data?.results)
            ? data.results
            : Array.isArray(data)
              ? data
              : [];

      const normalized = list.map(normalizeInternship);

      console.log("TOTAL INTERNSHIPS RECEIVED:", normalized.length);

      setInternships(normalized);

      try {
        const savedResponse = await fetch(SAVED_INTERNSHIPS_URL, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (savedResponse.status === 401) {
          setSavedIds(new Set());
          setApiError("Your login session has expired. Please login again.");
          handleInvalidAuthentication();
          return;
        }

        if (!savedResponse.ok) {
          console.warn(
            "Unable to load saved internships:",
            savedResponse.status,
          );
          setSavedIds(new Set());
        } else {
          const savedText = await savedResponse.text();
          let savedData = null;

          try {
            savedData = savedText ? JSON.parse(savedText) : null;
          } catch {
            savedData = null;
          }

          const backendSaved = Array.isArray(savedData?.internships)
            ? savedData.internships
            : [];

          setSavedIds(
            new Set(
              backendSaved
                .map((item) =>
                  String(
                    item?.internship_id ??
                      item?.id ??
                      item?.internshipId ??
                      "",
                  ),
                )
                .filter(Boolean),
            ),
          );
        }
      } catch (savedError) {
        console.warn("Saved internship API unavailable.", savedError);
        setSavedIds(new Set());
      }
    } catch (error) {
      console.error("Internship API error:", error);

      setInternships([]);

      setApiError(
        error?.message || "Unable to load internships from the backend.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    if (refreshing) {
      return;
    }

    loadInternships(true);
  }, [loadInternships, refreshing]);

  useEffect(() => {
    loadInternships(false);
  }, [loadInternships]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && getAuthToken()) {
        loadInternships(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadInternships]);

  const toggleSave = useCallback(
    async (internship) => {
      const token = getAuthToken();

      if (!token) {
        setAccessErrorType("general");
        setAccessError("Your login session has expired. Please login again.");
        return;
      }

      const accessMode = await fetchInternshipAccessMode(token);

      if (!accessMode.resumeAnalyzed) {
        setAccessErrorType("resume");
        setAccessError(
          "Please upload and analyze your resume before saving internships.",
        );
        return;
      }

      const id = String(internship?.id || "").trim();

      if (!id) {
        setAccessErrorType("general");
        setAccessError(
          "This internship does not have a valid database ID. Please refresh the internship list.",
        );
        return;
      }

      const isCurrentlySaved = savedIds.has(id);
      const method = isCurrentlySaved ? "DELETE" : "POST";
      const url = `${API_BASE}/api/internships/${encodeURIComponent(id)}/save`;

      try {
        setAccessError("");
        setAccessErrorType("");

        const response = await fetch(url, {
          method,
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
          setAccessError(
            "Your login session has expired. Please login again.",
          );
          handleInvalidAuthentication();
          return;
        }

        if (!response.ok) {
          const backendMessage =
            typeof responseData?.detail === "string"
              ? responseData.detail
              : Array.isArray(responseData?.detail)
                ? responseData.detail
                    .map((item) => item?.msg || item?.message || "")
                    .filter(Boolean)
                    .join(", ")
                : responseData?.message ||
                  responseData?.error ||
                  `Unable to ${isCurrentlySaved ? "remove" : "save"} internship.`;

          const alreadySaved =
            !isCurrentlySaved &&
            /already\s+(saved|exists)|already.*save/i.test(backendMessage);

          if (alreadySaved) {
            setSavedIds((previous) => {
              const next = new Set(previous);
              next.add(id);
              return next;
            });
            setAccessErrorType("general");
            setAccessError("Internship is already saved.");
            return;
          }

          throw new Error(backendMessage);
        }

        setSavedIds((previous) => {
          const next = new Set(previous);

          if (isCurrentlySaved) {
            next.delete(id);
          } else {
            next.add(id);
          }

          return next;
        });

        window.dispatchEvent(new Event("savedInternshipsChanged"));
        setAccessError("");
      } catch (error) {
        console.error("Save internship error:", error);

        setAccessErrorType("general");
        setAccessError(
          error?.message || "Unable to update saved internship.",
        );
      }
    },
    [savedIds],
  );

  const locations = useMemo(() => {
    const values = internships.map((item) => item.location).filter(Boolean);

    return ["All locations", ...Array.from(new Set(values)).sort()];
  }, [internships]);

  const durations = useMemo(() => {
    const values = internships.map((item) => item.duration).filter(Boolean);

    return ["All durations", ...Array.from(new Set(values)).sort()];
  }, [internships]);

  const workModes = useMemo(() => {
    const values = internships.map((item) => item.mode).filter(Boolean);

    return ["All work modes", ...Array.from(new Set(values)).sort()];
  }, [internships]);

  const categories = useMemo(() => {
    const values = internships.map((item) => item.category).filter(Boolean);

    return ["All categories", ...Array.from(new Set(values)).sort()];
  }, [internships]);

  const filteredInternships = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const result = internships.filter((item) => {
      const searchable = [
        item.title,
        item.company,
        item.location,
        item.mode,
        item.duration,
        item.category,
        item.description,
        ...item.requiredSkills,
        ...item.matchedSkills,
        ...item.missingSkills,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);

      const matchesLocation =
        locationFilter === "All locations" || item.location === locationFilter;

      const matchesDuration =
        durationFilter === "All durations" || item.duration === durationFilter;

      const matchesWorkMode =
        workModeFilter === "All work modes" || item.mode === workModeFilter;

      const matchesCategory =
        categoryFilter === "All categories" || item.category === categoryFilter;

      let matchesStipend = true;

      if (stipendFilter !== "Any stipend") {
        const stipendText = String(item.stipend || "");

        const numbers = stipendText.match(/[\d,]+/g) || [];

        const firstNumber = Number(numbers[0]?.replace(/,/g, "") || 0);

        if (stipendFilter === "₹5,000+") {
          matchesStipend = firstNumber >= 5000;
        }

        if (stipendFilter === "₹10,000+") {
          matchesStipend = firstNumber >= 10000;
        }

        if (stipendFilter === "₹15,000+") {
          matchesStipend = firstNumber >= 15000;
        }

        if (stipendFilter === "₹20,000+") {
          matchesStipend = firstNumber >= 20000;
        }
      }

      return (
        matchesSearch &&
        matchesLocation &&
        matchesDuration &&
        matchesWorkMode &&
        matchesCategory &&
        matchesStipend
      );
    });

    return result.sort((a, b) => {
      switch (sortBy) {
        case "Highest Stipend": {
          const getAmount = (value) => {
            const numbers = String(value || "").match(/[\d,]+/g) || [];

            return Number(numbers[0]?.replace(/,/g, "") || 0);
          };

          return getAmount(b.stipend) - getAmount(a.stipend);
        }

        case "Company A-Z":
          return a.company.localeCompare(b.company);

        case "Role A-Z":
          return a.title.localeCompare(b.title);

        case "Best Match":
        default:
          return b.matchPercentage - a.matchPercentage;
      }
    });
  }, [
    internships,
    searchQuery,
    locationFilter,
    durationFilter,
    workModeFilter,
    categoryFilter,
    stipendFilter,
    sortBy,
  ]);

  const resetFilters = () => {
    setSearchQuery("");
    setLocationFilter("All locations");
    setDurationFilter("All durations");
    setWorkModeFilter("All work modes");
    setCategoryFilter("All categories");
    setStipendFilter("Any stipend");
    setSortBy("Best Match");
  };

  const openDetails = (internship) => {
    const accessMode = getInternshipAccessMode();

    if (accessMode.isDefaultUser && !accessMode.resumeAnalyzed) {
      setAccessError(
        "Please upload and analyze your resume before viewing internship details.",
      );
      return;
    }

    const internshipId =
      internship?.id ??
      internship?.internship_id ??
      internship?.internshipId ??
      internship?.internshipID ??
      internship?.pk ??
      internship?.uuid ??
      internship?._id ??
      internship?.internship?.id ??
      internship?.internship?.internship_id ??
      internship?.internship?.internshipId;

    if (
      internshipId === undefined ||
      internshipId === null ||
      String(internshipId).trim() === ""
    ) {
      console.error(
        "Internship ID is missing from internship record:",
        internship,
      );
      setApiError(
        "This internship does not have a valid database ID. Please refresh the internship list.",
      );
      return;
    }

    const normalizedId = String(internshipId).trim();

    console.log("OPENING INTERNSHIP DETAILS - ID:", normalizedId);

    navigate(`/internships/${encodeURIComponent(normalizedId)}`, {
      state: {
        internshipId: normalizedId,
        internship_id: normalizedId,
        internship,
      },
    });
  };

  const openExternalApplication = (internship) => {
    const accessMode = getInternshipAccessMode();

    if (accessMode.isDefaultUser && !accessMode.resumeAnalyzed) {
      setAccessError(
        "Please upload and analyze your resume before applying to internships.",
      );
      return;
    }

    if (!internship?.sourceUrl) {
      alert("Application link is not available for this internship.");

      return;
    }

    window.open(internship.sourceUrl, "_blank", "noopener,noreferrer");
  };


  const getMatchClass = (percentage) => {
    if (percentage >= 80) {
      return "match-high";
    }

    if (percentage >= 60) {
      return "match-medium";
    }

    return "match-low";
  };

  if (loading) {
    return (
      <div className="internships-page">
        <div className="internships-loading">
          <div className="loading-orb">
            <Sparkles size={30} />
          </div>

          <h2>
            {getInternshipAccessMode().useAllInternshipsApi
              ? "Loading internship opportunities..."
              : "Finding internships for you..."}
          </h2>

          <p>
            {getInternshipAccessMode().useAllInternshipsApi
              ? "Loading all available internship opportunities."
              : "Matching your profile with available internship opportunities."}
          </p>

          <div className="loading-bar">
            <span />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="internships-page">
      <section className="internships-hero">
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />

        <div className="hero-inner">
          <div className="hero-text">
            <div className="hero-label">
              <Sparkles size={15} />
              AI-POWERED INTERNSHIP MATCHING
            </div>

            <h1>
              Find internships
              <br />
              that match
              <span> your skills.</span>
            </h1>

            <p>
              {getInternshipAccessMode().useAllInternshipsApi
                ? "Explore all available internship opportunities and view details without uploading a resume."
                : "Discover internship opportunities personalized using your resume, technical skills and profile."}
            </p>

            <div className="hero-stats">
              <div className="hero-stat">
                <strong>
                  {totalInternships === null
                    ? internships.length
                    : totalInternships}
                </strong>

                <span>Total Internships</span>
              </div>

              <div className="hero-stat">
                <strong>{filteredInternships.length}</strong>

                <span>Showing</span>
              </div>

              <div className="hero-stat">
                <strong>AI</strong>

                <span>Powered</span>
              </div>
            </div>
          </div>

          <div className="hero-card">
            <div className="hero-card-icon">
              <Sparkles size={25} />
            </div>

            <div>
              <span>
                {getInternshipAccessMode().useAllInternshipsApi
                  ? "Internship opportunities"
                  : "Personalized matches"}
              </span>

              <strong>
                {getInternshipAccessMode().useAllInternshipsApi
                  ? "Browse all available internships"
                  : "Based on your profile"}
              </strong>
            </div>

            <div className="hero-card-check">
              <Check size={18} />
            </div>
          </div>
        </div>
      </section>

      <section className="internships-controls">
        <div className="search-wrapper">
          <Search size={20} />

          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search internships, companies, skills..."
          />

          {searchQuery && (
            <button
              type="button"
              className="clear-search"
              onClick={() => setSearchQuery("")}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <button
          type="button"
          className="filter-toggle"
          onClick={() => setShowFilters((previous) => !previous)}
        >
          <Filter size={18} />
          Filters
          <ChevronDown size={16} className={showFilters ? "rotate-icon" : ""} />
        </button>

        <button
          type="button"
          className="refresh-button"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={17} className={refreshing ? "spin" : ""} />
          Refresh
        </button>
      </section>

      {showFilters && (
        <section className="filter-panel">
          <div className="filter-field">
            <label>Location</label>

            <select
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
            >
              {locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label>Duration</label>

            <select
              value={durationFilter}
              onChange={(event) => setDurationFilter(event.target.value)}
            >
              {durations.map((duration) => (
                <option key={duration} value={duration}>
                  {duration}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label>Work Mode</label>

            <select
              value={workModeFilter}
              onChange={(event) => setWorkModeFilter(event.target.value)}
            >
              {workModes.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label>Category</label>

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label>Minimum Stipend</label>

            <select
              value={stipendFilter}
              onChange={(event) => setStipendFilter(event.target.value)}
            >
              <option>Any stipend</option>

              <option>₹5,000+</option>

              <option>₹10,000+</option>

              <option>₹15,000+</option>

              <option>₹20,000+</option>
            </select>
          </div>

          <div className="filter-field">
            <label>Sort By</label>

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option>Best Match</option>

              <option>Highest Stipend</option>

              <option>Company A-Z</option>

              <option>Role A-Z</option>
            </select>
          </div>

          <button
            type="button"
            className="reset-filters"
            onClick={resetFilters}
          >
            Reset Filters
          </button>
        </section>
      )}

      {apiError && (
        <section className="internship-error">
          <div className="error-icon">!</div>

          <div>
            <strong>Unable to load internships</strong>

            <p>{apiError}</p>

            <button type="button" onClick={() => loadInternships(true)}>
              Try Again
            </button>
          </div>
        </section>
      )}

      {accessError && (
        <section className="internship-error">
          <div className="error-icon">!</div>

          <div>
            <strong>
              {accessErrorType === "resume"
                ? "Resume analysis required"
                : "Saved internship update"}
            </strong>

            <p>{accessError}</p>

            {accessErrorType === "resume" && (
              <button type="button" onClick={() => navigate("/resume")}>
                Upload &amp; Analyze Resume
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setAccessError("");
              setAccessErrorType("");
            }}
            aria-label="Close access error"
          >
            <X size={18} />
          </button>
        </section>
      )}

      {!apiError && (
        <section className="results-header">
          <div>
            <span className="results-label">INTERNSHIP OPPORTUNITIES</span>

            <h2>
              {getInternshipAccessMode().useAllInternshipsApi
                ? "All Internship Opportunities"
                : "Matches for you"}
            </h2>

            <p>
              {getInternshipAccessMode().useAllInternshipsApi
                ? `${filteredInternships.length} internship opportunities available to explore.`
                : `${filteredInternships.length} opportunities found from your personalized internship matches.`}
            </p>
          </div>

          <div className="results-info">
            <Sparkles size={17} />
            Sorted by <strong>{sortBy}</strong>
          </div>
        </section>
      )}

      {!apiError && filteredInternships.length === 0 && (
        <section className="empty-state">
          <div className="empty-icon">
            <Search size={28} />
          </div>

          <h3>No internships found</h3>

          <p>Try changing your search or filters to find more opportunities.</p>

          <button type="button" onClick={resetFilters}>
            Clear Filters
          </button>
        </section>
      )}

      {!apiError && filteredInternships.length > 0 && (
        <section className="internship-grid">
          {filteredInternships.map((internship) => {
            const isSaved = savedIds.has(String(internship.id));

            return (
              <article className="internship-card" key={internship.id}>
                {/* CARD TOP */}

                <div className="card-top">
                  <div className="company-avatar">
                    {internship.company?.charAt(0)?.toUpperCase() || "I"}
                  </div>

                  <div className="company-info">
                    <span>{internship.company}</span>

                    <small>{internship.category}</small>
                  </div>

                  <button
                    type="button"
                    className={isSaved ? "save-button saved" : "save-button"}
                    onClick={() => toggleSave(internship)}
                    aria-label={
                      isSaved ? "Remove saved internship" : "Save internship"
                    }
                  >
                    <Heart size={18} fill={isSaved ? "currentColor" : "none"} />
                  </button>
                </div>

                {/* TITLE */}

                <div className="card-title-section">
                  <h3>{internship.title}</h3>

                  <div
                    className={`match-badge ${getMatchClass(
                      internship.matchPercentage,
                    )}`}
                  >
                    <Sparkles size={14} />
                    {getInternshipAccessMode().useAllInternshipsApi
                      ? "Available"
                      : `${Math.round(internship.matchPercentage)}% Match`}
                  </div>
                </div>

                {/* META */}

                <div className="card-meta">
                  <div className="meta-item">
                    <MapPin size={16} />

                    <span>{internship.location}</span>
                  </div>

                  <div className="meta-item">
                    <Clock3 size={16} />

                    <span>{internship.duration}</span>
                  </div>

                  <div className="meta-item">
                    <BriefcaseBusiness size={16} />

                    <span>{internship.mode}</span>
                  </div>

                  <div className="meta-item">
                    <WalletCards size={16} />

                    <span>{internship.stipend}</span>
                  </div>
                </div>

                {/* SKILLS */}

                {internship.matchedSkills.length > 0 && (
                  <div className="skills-section">
                    <span className="skills-label">Matched Skills</span>

                    <div className="skills-list">
                      {internship.matchedSkills
                        .slice(0, 5)
                        .map((skill, skillIndex) => (
                          <span
                            className="skill-pill matched"
                            key={`${internship.id}-matched-${skillIndex}`}
                          >
                            <Check size={12} />

                            {skill}
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                {/* MISSING SKILLS */}

                {internship.missingSkills.length > 0 && (
                  <div className="missing-skills">
                    <span>Skills to improve:</span>

                    <strong>
                      {internship.missingSkills.slice(0, 3).join(", ")}
                    </strong>
                  </div>
                )}

                {/* ACTIONS */}

                <div className="card-actions">
                  <button
                    type="button"
                    className="details-button"
                    onClick={() => openDetails(internship)}
                  >
                    View Details
                    <ArrowRight size={16} />
                  </button>

                  {internship.sourceUrl && (
                    <button
                      type="button"
                      className="apply-card-button"
                      onClick={() => openExternalApplication(internship)}
                    >
                      Apply
                      <ExternalLink size={15} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

export default Internships;

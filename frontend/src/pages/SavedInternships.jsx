import React, { useEffect, useState } from "react";

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

/* =========================================================
   STORAGE KEY
========================================================= */

const SAVED_INTERNSHIPS_KEY = "savedInternships";

/* =========================================================
   HELPER - GET INTERNSHIP ID
========================================================= */

const getInternshipId = (internship) => {
  if (!internship) {
    return null;
  }

  return (
    internship.id ?? internship.internship_id ?? internship.internshipId ?? null
  );
};

/* =========================================================
   HELPER - GET INTERNSHIP TITLE
========================================================= */

const getInternshipTitle = (internship) => {
  return (
    internship?.title ||
    internship?.job_title ||
    internship?.jobTitle ||
    internship?.position ||
    "Internship"
  );
};

/* =========================================================
   HELPER - GET COMPANY
========================================================= */

const getCompanyName = (internship) => {
  return (
    internship?.company_name ||
    internship?.companyName ||
    internship?.company ||
    "Company"
  );
};

/* =========================================================
   HELPER - GET LOCATION
========================================================= */

const getLocation = (internship) => {
  return (
    internship?.location || internship?.city || internship?.job_location || ""
  );
};

/* =========================================================
   HELPER - GET DURATION
========================================================= */

const getDuration = (internship) => {
  return (
    internship?.duration ||
    internship?.duration_months ||
    internship?.durationMonths ||
    ""
  );
};

/* =========================================================
   HELPER - GET WORK MODE
========================================================= */

const getWorkMode = (internship) => {
  return (
    internship?.work_mode || internship?.workMode || internship?.mode || ""
  );
};

/* =========================================================
   HELPER - GET STIPEND
========================================================= */

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

/* =========================================================
   HELPER - LOAD SAVED INTERNSHIPS
========================================================= */

const loadSavedInternshipsFromStorage = () => {
  try {
    const stored = localStorage.getItem(SAVED_INTERNSHIPS_KEY);

    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      return [];
    }

    /*
     * Remove invalid records.
     */

    const validInternships = parsed.filter((internship) => {
      return internship && getInternshipId(internship) !== null;
    });

    return validInternships;
  } catch (error) {
    console.error("Unable to read saved internships:", error);

    return [];
  }
};

/* =========================================================
   COMPONENT
========================================================= */

function SavedInternships() {
  const navigate = useNavigate();

  /* =======================================================
     STATE
  ======================================================= */

  const [savedInternships, setSavedInternships] = useState([]);

  const [searchText, setSearchText] = useState("");

  /* =======================================================
     LOAD DATA
  ======================================================= */

  const loadSavedInternships = () => {
    const internships = loadSavedInternshipsFromStorage();

    setSavedInternships(internships);
  };

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    loadSavedInternships();
  }, []);

  /* =======================================================
     LISTEN FOR STORAGE CHANGES
  ======================================================= */

  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key === SAVED_INTERNSHIPS_KEY) {
        loadSavedInternships();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    /*
     * Custom event allows the same browser tab
     * to update immediately when another page
     * changes saved internships.
     */

    const handleCustomSaveEvent = () => {
      loadSavedInternships();
    };

    window.addEventListener("savedInternshipsChanged", handleCustomSaveEvent);

    return () => {
      window.removeEventListener("storage", handleStorageChange);

      window.removeEventListener(
        "savedInternshipsChanged",
        handleCustomSaveEvent,
      );
    };
  }, []);

  /* =======================================================
     REMOVE SAVED INTERNSHIP
  ======================================================= */

  const handleRemove = (internshipId) => {
    if (internshipId === null || internshipId === undefined) {
      return;
    }

    const updatedInternships = savedInternships.filter((internship) => {
      const id = getInternshipId(internship);

      return String(id) !== String(internshipId);
    });

    /*
     * Update React state.
     */

    setSavedInternships(updatedInternships);

    /*
     * Update localStorage.
     */

    localStorage.setItem(
      SAVED_INTERNSHIPS_KEY,
      JSON.stringify(updatedInternships),
    );

    /*
     * The shared savedInternships storage is the
     * single source of truth. No separate per-ID
     * localStorage key is required.
     */

    /*
     * Tell other components/pages
     * that saved internships changed.
     */

    window.dispatchEvent(new Event("savedInternshipsChanged"));
  };

  /* =======================================================
     VIEW INTERNSHIP DETAILS
  ======================================================= */

  const handleViewDetails = (internshipId) => {
    if (internshipId === null || internshipId === undefined) {
      console.error("Internship ID is missing.");

      return;
    }

    navigate(`/internships/${internshipId}`, {
      state: {
        internshipId: String(internshipId),
        internship_id: String(internshipId),
        internship:
          savedInternships.find(
            (item) => String(getInternshipId(item)) === String(internshipId),
          ) || null,
      },
    });
  };

  /* =======================================================
     GO TO INTERNSHIPS
  ======================================================= */

  const handleBrowseInternships = () => {
    navigate("/internships");
  };

  /* =======================================================
     SEARCH
  ======================================================= */

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

  /* =======================================================
     EMPTY STATE
  ======================================================= */

  if (savedInternships.length === 0) {
    return (
      <div className="saved-page">
        {/* Background */}

        <div className="saved-background-orb saved-orb-one" />

        <div className="saved-background-orb saved-orb-two" />

        <div className="saved-background-orb saved-orb-three" />

        {/* Empty Card */}

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

  /* =======================================================
     MAIN PAGE
  ======================================================= */

  return (
    <div className="saved-page">
      {/* =================================================
          BACKGROUND
      ================================================= */}

      <div className="saved-background-orb saved-orb-one" />

      <div className="saved-background-orb saved-orb-two" />

      <div className="saved-background-orb saved-orb-three" />

      {/* =================================================
          HERO
      ================================================= */}

      <section className="saved-hero">
        <div className="saved-hero-content">
          <span className="saved-eyebrow">SAVED OPPORTUNITIES</span>

          <h1>Saved Internships</h1>

          <p>
            Keep track of the internships you're interested in and revisit them
            anytime.
          </p>
        </div>

        {/* Count */}

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

      {/* =================================================
          SEARCH TOOLBAR
      ================================================= */}

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

      {/* =================================================
          SEARCH NO RESULTS
      ================================================= */}

      {filteredInternships.length === 0 ? (
        <section className="saved-no-results">
          <Search size={32} />

          <h2>No saved internships found</h2>

          <p>Try searching with another keyword.</p>
        </section>
      ) : (
        /* =================================================
           SAVED INTERNSHIP LIST
        ================================================= */

        <section className="saved-list">
          {filteredInternships.map((internship, index) => {
            const internshipId = getInternshipId(internship);

            const title = getInternshipTitle(internship);

            const company = getCompanyName(internship);

            const location = getLocation(internship);

            const duration = getDuration(internship);

            const workMode = getWorkMode(internship);

            const stipend = getStipend(internship);

            return (
              <article
                className="saved-card"
                key={String(internshipId)}
                style={{
                  animationDelay: `${index * 0.08}s`,
                }}
              >
                {/* =========================================
                      COMPANY
                  ========================================= */}

                <div className="saved-company">
                  <div className="saved-company-logo">
                    {String(company).charAt(0).toUpperCase()}
                  </div>

                  <div className="saved-company-info">
                    <h2>{title}</h2>

                    <p>{company}</p>
                  </div>
                </div>

                {/* =========================================
                      DETAILS
                  ========================================= */}

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

                {/* =========================================
                      ACTIONS
                  ========================================= */}

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
                    title="Remove from saved internships"
                  >
                    <Trash2 size={17} />
                    Remove
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

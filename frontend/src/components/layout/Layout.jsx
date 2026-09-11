import { useEffect, useState } from "react";

import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { Menu, Search, UserCircle } from "lucide-react";

import DefaultSidebar from "./DefaultSidebar";
import UserSidebar from "./UserSidebar";

import NotificationBell from "../notifications/NotificationBell";

import AIAssistant from "../ai-assistant/AIAssistant";

import "../../styles/Layout.css";

function Layout() {
  const location = useLocation();

  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const getDashboardType = () => {
    const currentPath = location.pathname;

    if (currentPath === "/userDashboard") {
      return "user";
    }

    if (currentPath === "/defaultDashboard") {
      return "default";
    }

    if (currentPath === "/defaultProfile") {
      return "default";
    }

    const storedType = localStorage.getItem("dashboard_type");

    if (storedType === "user") {
      return "user";
    }

    if (storedType === "admin" || storedType === "mentor") {
      localStorage.setItem("dashboard_type", "default");
      return "default";
    }

    return "default";
  };

  const [dashboardType, setDashboardType] = useState(getDashboardType);

  const [dashboardTypeLoading, setDashboardTypeLoading] = useState(true);

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  const getAuthToken = () => {
    return (
      localStorage.getItem("access_token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      ""
    );
  };

  const getDashboardStatus = async () => {
    try {
      const token = getAuthToken();

      if (!token) {
        setDashboardType("default");

        localStorage.setItem("dashboard_type", "default");

        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/dashboard`, {
        method: "GET",

        headers: {
          Accept: "application/json",

          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        localStorage.removeItem("dashboard_type");

        setDashboardType("default");

        return;
      }

      if (!response.ok) {
        throw new Error(
          `Dashboard status request failed (${response.status}).`,
        );
      }

      const data = await response.json();

      const type = data?.dashboard_type === "user" ? "user" : "default";

      setDashboardType(type);

      localStorage.setItem("dashboard_type", type);

      const currentPath = location.pathname;

      if (type === "user" && currentPath === "/defaultDashboard") {
        navigate("/userDashboard", {
          replace: true,
        });

        return;
      }

      if (type === "default" && currentPath === "/userDashboard") {
        navigate("/defaultDashboard", {
          replace: true,
        });

        return;
      }
    } catch (error) {
      console.error("Dashboard status error:", error);

      setDashboardType("default");

      localStorage.setItem("dashboard_type", "default");

      if (location.pathname === "/userDashboard") {
        navigate("/defaultDashboard", {
          replace: true,
        });
      }
    } finally {
      setDashboardTypeLoading(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState("");

  const [searchOpen, setSearchOpen] = useState(false);

  const searchItems = [
    {
      title: "Default Dashboard",

      description: "Go to default dashboard",

      path: "/defaultDashboard",

      keywords: ["default", "dashboard", "home"],
    },

    {
      title: "User Dashboard",

      description: "Go to user dashboard",

      path: "/userDashboard",

      keywords: ["user", "dashboard", "home"],
    },

    {
      title: "Profile",

      description: "View your profile",

      path: "/profile",

      keywords: ["profile", "account", "personal", "user"],
    },

    {
      title: "Default Profile",

      description: "View your default profile",

      path: "/defaultProfile",

      keywords: ["default", "profile", "account"],
    },

    {
      title: "Resume",

      description: "Upload and manage your resume",

      path: "/resume",

      keywords: ["resume", "cv", "curriculum", "document", "upload"],
    },

    {
      title: "Skill Gap",

      description: "View your skill gaps",

      path: "/skill-gap",

      keywords: ["skill", "skills", "skill gap", "gap", "learning", "improve"],
    },

    {
      title: "Settings",

      description: "Manage your account settings",

      path: "/settings",

      keywords: ["settings", "preferences", "account", "configuration"],
    },

    {
      title: "Preparation Agent",
      description: "Prepare for internships and interviews with AI",
      path: "/preparation-agent",
      keywords: [
        "preparation",
        "preparation agent",
        "interview",
        "interview preparation",
        "ai",
        "questions",
        "practice",
        "career",
      ],
    },

    {
      title: "Preparation Chat",
      description: "Chat with AI about your resume and uploaded documents",
      path: "/preparation-chat",
      keywords: [
        "preparation",
        "preparation chat",
        "chat",
        "ai chat",
        "documents",
        "resume",
        "doubts",
        "questions",
      ],
    },

    {
      title: "Internships",

      description: "Browse available internships",

      path: "/internships",

      keywords: [
        "internship",
        "internships",
        "job",
        "jobs",
        "opportunity",
        "opportunities",
        "career",
      ],
    },

    {
      title: "Saved Internships",

      description: "View your saved internships",

      path: "/saved-internships",

      keywords: [
        "saved",
        "save",
        "internship",
        "internships",
        "bookmark",
        "bookmarks",
      ],
    },

    {
      title: "Create Cover Letter",

      description: "Create an AI cover letter",

      path: "/cover-letters/create",

      keywords: ["cover", "cover letter", "letter", "application", "ai"],
    },

    {
      title: "Applications",

      description: "View your internship applications",

      path: "/applications",

      keywords: [
        "application",
        "applications",
        "applied",
        "internship",
        "status",
      ],
    },
  ];

  useEffect(() => {
    const type = getDashboardType();

    setDashboardType(type);

    getDashboardStatus();
  }, [location.pathname]);

  const toggleSidebar = () => {
    setSidebarOpen((previous) => !previous);
  };

  useEffect(() => {
    const handlePointerMove = (event) => {
      document.documentElement.style.setProperty(
        "--pointer-x",
        `${event.clientX}px`,
      );

      document.documentElement.style.setProperty(
        "--pointer-y",
        `${event.clientY}px`,
      );
    };

    window.addEventListener("pointermove", handlePointerMove);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, []);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredSearchItems =
    normalizedSearch.length === 0
      ? []
      : searchItems.filter((item) => {
          const searchableText = [
            item.title,
            item.description,
            ...item.keywords,
          ]
            .join(" ")
            .toLowerCase();

          return searchableText.includes(normalizedSearch);
        });

  const handleSearchChange = (event) => {
    const value = event.target.value;

    setSearchQuery(value);

    if (value.trim().length > 0) {
      setSearchOpen(true);
    } else {
      setSearchOpen(false);
    }
  };

  const handleSearchItemClick = (item) => {
    let targetPath = item.path;

    if (item.title === "Profile") {
      if (dashboardType === "user") {
        targetPath = "/profile";
      } else {
        targetPath = "/defaultProfile";
      }
    }

    setSearchQuery("");

    setSearchOpen(false);

    navigate(targetPath);
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();

      if (filteredSearchItems.length > 0) {
        handleSearchItemClick(filteredSearchItems[0]);
      }

      return;
    }

    if (event.key === "Escape") {
      setSearchOpen(false);
    }
  };

  useEffect(() => {
    const handleOutsideClick = (event) => {
      const searchContainer = document.querySelector(
        ".navbar-search-container",
      );

      if (searchContainer && !searchContainer.contains(event.target)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const handleProfileClick = () => {
    if (dashboardType === "user") {
      navigate("/profile");

      return;
    }

    navigate("/defaultProfile");
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");

    localStorage.removeItem("accessToken");

    localStorage.removeItem("token");

    localStorage.removeItem("refresh_token");

    localStorage.removeItem("isLoggedIn");

    localStorage.removeItem("user");

    localStorage.removeItem("user_role");

    localStorage.removeItem("dashboard_type");

    localStorage.removeItem("resume_id");

    localStorage.removeItem("resume_profile_id");

    navigate("/", {
      replace: true,
    });
  };

  const SidebarComponent =
    dashboardType === "user" ? UserSidebar : DefaultSidebar;

  return (
    <div
      className={`app-layout ${
        sidebarOpen ? "sidebar-open" : "sidebar-closed"
      }`}
    >
      <div className="cursor-glow" aria-hidden="true" />

      <aside className="app-sidebar">
        <SidebarComponent />
      </aside>

      <div className="app-main">
        <header className="app-navbar">
          <div className="navbar-left">
            <button
              type="button"
              className="navbar-icon-button"
              onClick={toggleSidebar}
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              <Menu size={22} strokeWidth={2} />
            </button>

            <div className="navbar-search-container">
              <div className="navbar-search">
                <Search size={19} strokeWidth={2} className="search-icon" />

                <input
                  type="search"
                  placeholder="Search..."
                  aria-label="Search"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => {
                    if (searchQuery.trim().length > 0) {
                      setSearchOpen(true);
                    }
                  }}
                  onKeyDown={handleSearchKeyDown}
                />
              </div>

              {searchOpen && (
                <div
                  className="search-results"
                  role="listbox"
                  aria-label="Search results"
                >
                  {filteredSearchItems.length > 0 ? (
                    filteredSearchItems.map((item, index) => (
                      <button
                        type="button"
                        key={`${item.title}-${index}`}
                        className="search-result-item"
                        onClick={() => handleSearchItemClick(item)}
                      >
                        <div className="search-result-icon">
                          <Search size={17} strokeWidth={2} />
                        </div>

                        <div className="search-result-content">
                          <span className="search-result-title">
                            {item.title}
                          </span>

                          <span className="search-result-description">
                            {item.description}
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="search-no-results">
                      <Search size={18} strokeWidth={2} />

                      <div>
                        <span className="search-no-results-title">
                          No results found
                        </span>

                        <span className="search-no-results-text">
                          Try another search term
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="navbar-right">
            <NotificationBell />

            <button
              type="button"
              className="navbar-profile-button"
              aria-label="Profile"
              title="Profile"
              onClick={handleProfileClick}
            >
              <UserCircle size={26} strokeWidth={1.9} />
            </button>
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>

      <AIAssistant />
    </div>
  );
}

export default Layout;

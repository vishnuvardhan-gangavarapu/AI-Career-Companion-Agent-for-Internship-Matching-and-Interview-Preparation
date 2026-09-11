import { useEffect, useRef, useState } from "react";

import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  FileText,
  Briefcase,
  UserPlus,
  CircleCheck,
  CircleX,
  Info,
  Clock,
  X,
} from "lucide-react";

import { useLocation, useNavigate } from "react-router-dom";

import "../../styles/NotificationBell.css";

/* =========================================================
   API BASE URL
   ========================================================= */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

/* =========================================================
   NOTIFICATION BELL
   ========================================================= */

function NotificationBell() {
  const navigate = useNavigate();

  const location = useLocation();

  const bellRef = useRef(null);

  /* =========================================================
     STATE
     ========================================================= */

  const [notifications, setNotifications] = useState([]);

  const [unreadCount, setUnreadCount] = useState(0);

  const [isOpen, setIsOpen] = useState(false);

  const [loading, setLoading] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");

  /* =========================================================
     GET AUTH TOKEN
     ========================================================= */

  const getAuthToken = () => {
    return (
      localStorage.getItem("access_token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      ""
    );
  };

  /* =========================================================
     GET USER ROLE
     ========================================================= */

  const getUserRole = () => {
    const storedRole = localStorage.getItem("user_role");

    if (storedRole) {
      return storedRole.toLowerCase();
    }

    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");

      return (user?.role || user?.user_role || "").toLowerCase();
    } catch {
      return "";
    }
  };

  /* =========================================================
     CALCULATE UNREAD COUNT
     ========================================================= */

  const calculateUnreadCount = (notificationList) => {
    if (!Array.isArray(notificationList)) {
      return 0;
    }

    return notificationList.filter(
      (notification) => notification && notification.is_read !== true,
    ).length;
  };

  /* =========================================================
     FETCH NOTIFICATIONS
     ========================================================= */

  const fetchNotifications = async () => {
    const token = getAuthToken();

    if (!token) {
      setNotifications([]);

      setUnreadCount(0);

      return;
    }

    try {
      setLoading(true);

      setError("");

      const response = await fetch(`${API_BASE_URL}/api/notifications`, {
        method: "GET",

        headers: {
          Accept: "application/json",

          Authorization: `Bearer ${token}`,
        },
      });

      /* =====================================================
         UNAUTHORIZED
         ===================================================== */

      if (response.status === 401) {
        setNotifications([]);

        setUnreadCount(0);

        return;
      }

      /* =====================================================
         OTHER ERRORS
         ===================================================== */

      if (!response.ok) {
        throw new Error(`Failed to fetch notifications (${response.status})`);
      }

      const data = await response.json();

      const notificationList = Array.isArray(data?.notifications)
        ? data.notifications
        : [];

      /* =====================================================
         SAVE NOTIFICATIONS
         ===================================================== */

      setNotifications(notificationList);

      /* =====================================================
         CALCULATE REAL UNREAD COUNT
         ===================================================== */

      setUnreadCount(calculateUnreadCount(notificationList));
    } catch (err) {
      console.error("Notification fetch error:", err);

      setError("Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     INITIAL LOAD
     ========================================================= */

  useEffect(() => {
    fetchNotifications();
  }, []);

  /* =========================================================
     REFRESH WHEN ROUTE CHANGES
     ========================================================= */

  useEffect(() => {
    fetchNotifications();
  }, [location.pathname]);

  /* =========================================================
     AUTO REFRESH EVERY 30 SECONDS
     ========================================================= */

  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  /* =========================================================
     CLOSE WHEN CLICKING OUTSIDE
     ========================================================= */

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (bellRef.current && !bellRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  /* =========================================================
     BELL CLICK
     ========================================================= */

  const handleBellClick = () => {
    const nextState = !isOpen;

    setIsOpen(nextState);

    if (nextState) {
      fetchNotifications();
    }
  };

  /* =========================================================
     MARK ONE NOTIFICATION AS READ
     ========================================================= */

  const markAsRead = async (notificationId) => {
    const token = getAuthToken();

    if (!token) {
      return false;
    }

    try {
      setActionLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/api/notifications/${notificationId}/read`,
        {
          method: "PATCH",

          headers: {
            Accept: "application/json",

            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to mark notification as read");
      }

      setNotifications((previous) => {
        const updated = previous.map((notification) => {
          if (notification.id !== notificationId) {
            return notification;
          }

          return {
            ...notification,

            is_read: true,

            read_at: new Date().toISOString(),
          };
        });

        setUnreadCount(calculateUnreadCount(updated));

        return updated;
      });

      return true;
    } catch (err) {
      console.error("Mark notification read error:", err);

      return false;
    } finally {
      setActionLoading(false);
    }
  };

  /* =========================================================
     MARK ALL AS READ
     ========================================================= */

  const markAllAsRead = async () => {
    if (unreadCount === 0) {
      return;
    }

    const token = getAuthToken();

    if (!token) {
      return;
    }

    try {
      setActionLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/api/notifications/read-all`,
        {
          method: "PATCH",

          headers: {
            Accept: "application/json",

            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to mark all notifications as read");
      }

      const currentTime = new Date().toISOString();

      setNotifications((previous) =>
        previous.map((notification) => ({
          ...notification,

          is_read: true,

          read_at: notification.read_at || currentTime,
        })),
      );

      setUnreadCount(0);
    } catch (err) {
      console.error("Mark all notifications error:", err);
    } finally {
      setActionLoading(false);
    }
  };

  /* =========================================================
     DELETE NOTIFICATION
     ========================================================= */

  const deleteNotification = async (event, notificationId) => {
    event.stopPropagation();

    const token = getAuthToken();

    if (!token) {
      return;
    }

    try {
      setActionLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/api/notifications/${notificationId}`,
        {
          method: "DELETE",

          headers: {
            Accept: "application/json",

            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete notification");
      }

      setNotifications((previous) => {
        const updated = previous.filter(
          (notification) => notification.id !== notificationId,
        );

        setUnreadCount(calculateUnreadCount(updated));

        return updated;
      });
    } catch (err) {
      console.error("Delete notification error:", err);
    } finally {
      setActionLoading(false);
    }
  };

  /* =========================================================
     NOTIFICATION NAVIGATION
     ========================================================= */

  const handleNotificationNavigation = (notification) => {
    const entityType = notification.related_entity_type;

    /* =====================================================
         INTERN
         ===================================================== */

    if (entityType === "application") {
      navigate("/applications");

      return;
    }

    if (entityType === "resume") {
      navigate("/resume");

      return;
    }

    if (entityType === "user") {
      if (location.pathname === "/defaultDashboard") {
        navigate("/defaultProfile");
      } else {
        navigate("/profile");
      }
    }
  };

  /* =========================================================
     CLICK NOTIFICATION
     ========================================================= */

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    handleNotificationNavigation(notification);

    setIsOpen(false);
  };

  /* =========================================================
     GET NOTIFICATION ICON
     ========================================================= */

  const getNotificationIcon = (type) => {
    switch (type) {
      case "application_submitted":
        return <FileText size={17} />;

      case "application_approved":
        return <CircleCheck size={17} />;

      case "application_rejected":
        return <CircleX size={17} />;

      case "application_withdrawn":
        return <CircleX size={17} />;

      case "new_application":
        return <Briefcase size={17} />;

      case "user_registration":
        return <UserPlus size={17} />;

      case "resume_uploaded":
        return <FileText size={17} />;

      case "resume_analyzed":
        return <Check size={17} />;

      case "account":
        return <Info size={17} />;

      default:
        return <Info size={17} />;
    }
  };

  /* =========================================================
     NOTIFICATION COLOR
     ========================================================= */

  const getNotificationClass = (type) => {
    switch (type) {
      case "application_approved":
        return "notification-success";

      case "application_rejected":

      case "application_withdrawn":
        return "notification-danger";

      case "new_application":
        return "notification-application";

      case "application_submitted":
        return "notification-info";

      case "user_registration":
        return "notification-user";

      case "resume_uploaded":

      case "resume_analyzed":
        return "notification-resume";

      default:
        return "notification-default";
    }
  };

  /* =========================================================
     PARSE DATE
     
     PostgreSQL currently returns timezone-naive timestamps.
     We treat those timestamps as UTC.
     ========================================================= */

  const parseNotificationDate = (dateString) => {
    if (!dateString) {
      return null;
    }

    let normalized = String(dateString).trim();

    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);

    if (!hasTimezone) {
      normalized = `${normalized}Z`;
    }

    const date = new Date(normalized);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  };

  /* =========================================================
     FORMAT TIME
     ========================================================= */

  const formatTime = (dateString) => {
    const date = parseNotificationDate(dateString);

    if (!date) {
      return "Unknown time";
    }

    const now = new Date();

    const difference = now.getTime() - date.getTime();

    const seconds = Math.floor(difference / 1000);

    /* =====================================================
         FUTURE TIME
         ===================================================== */

    if (seconds < 0) {
      return "Just now";
    }

    /* =====================================================
         LESS THAN ONE MINUTE
         ===================================================== */

    if (seconds < 60) {
      return "Just now";
    }

    /* =====================================================
         MINUTES
         ===================================================== */

    if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}m ago`;
    }

    /* =====================================================
         HOURS
         ===================================================== */

    if (seconds < 86400) {
      return `${Math.floor(seconds / 3600)}h ago`;
    }

    /* =====================================================
         DAYS
         ===================================================== */

    if (seconds < 604800) {
      return `${Math.floor(seconds / 86400)}d ago`;
    }

    /* =====================================================
         OLDER
         ===================================================== */

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  /* =========================================================
     UI
     ========================================================= */

  return (
    <div className="notification-bell-wrapper" ref={bellRef}>
      {/* =====================================================
          BELL BUTTON
          ===================================================== */}

      <button
        type="button"
        className={`
          navbar-icon-button
          navbar-notification-button
          ${isOpen ? "notification-open" : ""}
        `}
        onClick={handleBellClick}
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="notification-bell-icon" size={21} strokeWidth={2} />

        {/* ===================================================
            UNREAD COUNT
            =================================================== */}

        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* =====================================================
          NOTIFICATION DROPDOWN
          ===================================================== */}

      {isOpen && (
        <div className="notification-dropdown">
          {/* =================================================
              HEADER
              ================================================= */}

          <div className="notification-header">
            <div>
              <h3>Notifications</h3>

              <span>
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : "You're all caught up"}
              </span>
            </div>

            <div className="notification-header-actions">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notification-mark-all"
                  onClick={markAllAsRead}
                  disabled={actionLoading}
                >
                  <CheckCheck size={15} />

                  <span>Mark all read</span>
                </button>
              )}

              <button
                type="button"
                className="notification-close-button"
                onClick={() => setIsOpen(false)}
                aria-label="Close notifications"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* =================================================
              NOTIFICATION LIST
              ================================================= */}

          <div className="notification-list">
            {/* ===============================================
                LOADING
                =============================================== */}

            {loading && (
              <div className="notification-loading">
                <div className="notification-spinner" />

                <span>Loading notifications...</span>
              </div>
            )}

            {/* ===============================================
                ERROR
                =============================================== */}

            {!loading && error && (
              <div className="notification-error">
                <Info size={20} />

                <span>{error}</span>

                <button type="button" onClick={fetchNotifications}>
                  Retry
                </button>
              </div>
            )}

            {/* ===============================================
                EMPTY
                =============================================== */}

            {!loading && !error && notifications.length === 0 && (
              <div className="notification-empty">
                <div className="notification-empty-icon">
                  <Bell size={24} />
                </div>

                <h4>No notifications</h4>

                <p>You're all caught up.</p>
              </div>
            )}

            {/* ===============================================
                NOTIFICATIONS
                =============================================== */}

            {!loading &&
              !error &&
              notifications.length > 0 &&
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`
                      notification-item
                      ${
                        notification.is_read
                          ? "notification-read"
                          : "notification-unread"
                      }
                    `}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {/* =====================================
                        ICON
                        ===================================== */}

                  <div
                    className={`
                        notification-icon
                        ${getNotificationClass(notification.notification_type)}
                      `}
                  >
                    {getNotificationIcon(notification.notification_type)}
                  </div>

                  {/* =====================================
                        CONTENT
                        ===================================== */}

                  <div className="notification-content">
                    <div className="notification-title-row">
                      <h4>{notification.title}</h4>

                      {!notification.is_read && (
                        <span className="notification-unread-dot" />
                      )}
                    </div>

                    <p>{notification.message}</p>

                    <div className="notification-time">
                      <Clock size={12} />

                      <span>{formatTime(notification.created_at)}</span>
                    </div>
                  </div>

                  {/* =====================================
                        ACTIONS
                        ===================================== */}

                  <div className="notification-actions">
                    {!notification.is_read && (
                      <button
                        type="button"
                        className="notification-action-button"
                        title="Mark as read"
                        disabled={actionLoading}
                        onClick={(event) => {
                          event.stopPropagation();

                          markAsRead(notification.id);
                        }}
                      >
                        <Check size={14} />
                      </button>
                    )}

                    <button
                      type="button"
                      className="
                          notification-action-button
                          notification-delete-button
                        "
                      title="Delete notification"
                      disabled={actionLoading}
                      onClick={(event) =>
                        deleteNotification(event, notification.id)
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;

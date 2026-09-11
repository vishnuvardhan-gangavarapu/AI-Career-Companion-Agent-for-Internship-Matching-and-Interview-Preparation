import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import {
  Bot,
  X,
  Menu,
  Plus,
  MessageSquare,
  Send,
  Trash2,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";

import "../../styles/AIAssistant.css";

// =========================================================
// API
// =========================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// =========================================================
// DASHBOARD SCOPE
// =========================================================

function getDashboardType(pathname = window.location.pathname) {
  const path = String(pathname || "/").toLowerCase();

  if (path.includes("/userdashboard")) {
    return "user";
  }

  return "default";
}

// =========================================================
// FRONTEND APPLICATION CONTEXT
// =========================================================

function cleanContextText(value, maxLength = 4000) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function getPageName() {
  const heading = document.querySelector(
    "main h1, main h2, [role='main'] h1, [role='main'] h2",
  );

  if (heading?.textContent?.trim()) {
    return cleanContextText(heading.textContent, 160);
  }

  if (document.title?.trim()) {
    return cleanContextText(document.title, 160);
  }

  return window.location.pathname || "Unknown page";
}

function getVisiblePageText() {
  const main = document.querySelector("main, [role='main']");
  const source = main || document.body;

  if (!source) {
    return "";
  }

  return cleanContextText(source.innerText || source.textContent || "", 6000);
}

function getVisibleActions() {
  const elements = Array.from(
    document.querySelectorAll(
      "main button, main a, [role='main'] button, [role='main'] a",
    ),
  );

  const seen = new Set();
  const actions = [];

  elements.forEach((element) => {
    const text = cleanContextText(
      element.getAttribute("aria-label") || element.textContent || "",
      140,
    );

    if (!text || seen.has(text)) {
      return;
    }

    seen.add(text);
    actions.push({
      type: element.tagName.toLowerCase() === "a" ? "link" : "button",
      text,
      href:
        element.tagName.toLowerCase() === "a"
          ? cleanContextText(element.getAttribute("href") || "", 240)
          : "",
    });
  });

  return actions.slice(0, 60);
}

function getSafeFormState() {
  const fields = Array.from(
    document.querySelectorAll(
      "main input, main textarea, main select, [role='main'] input, [role='main'] textarea, [role='main'] select",
    ),
  );

  return fields.slice(0, 40).map((field) => {
    const type = String(field.getAttribute("type") || "").toLowerCase();
    const name = cleanContextText(
      field.getAttribute("name") || field.getAttribute("id") || "field",
      120,
    );

    // Never send passwords or password-like values to the AI.
    if (
      type === "password" ||
      /password|passwd|currentpass|newpass|confirmpass/i.test(name)
    ) {
      return {
        name,
        type,
        value: "[HIDDEN]",
      };
    }

    let value = "";

    if (field.tagName.toLowerCase() === "select") {
      value = field.options?.[field.selectedIndex]?.text || field.value || "";
    } else if (type === "checkbox" || type === "radio") {
      value = field.checked ? "selected" : "not selected";
    } else {
      value = field.value || "";
    }

    return {
      name,
      type: type || field.tagName.toLowerCase(),
      value: cleanContextText(value, 300),
    };
  });
}

function getRelevantLocalStorage() {
  const result = {};
  const keys = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);

    if (key) {
      keys.push(key);
    }
  }

  const interesting = keys.filter(
    (key) =>
      /profile|resume|completion|dashboard|role|internship|application|skill|user|auth/i.test(
        key,
      ) && !/token|password|secret/i.test(key),
  );

  interesting.slice(0, 40).forEach((key) => {
    try {
      const value = localStorage.getItem(key);

      if (value !== null) {
        result[key] = cleanContextText(value, 1000);
      }
    } catch {
      // Ignore inaccessible storage entries.
    }
  });

  return result;
}

function buildFrontendContext(auth, dashboardType) {
  const path = window.location.pathname || "/";
  const search = window.location.search || "";

  const authUser = auth?.user || auth?.currentUser || auth?.profile || null;

  return {
    source: "InternMatch React application",
    captured_at: new Date().toISOString(),

    dashboard: {
      type: dashboardType,
      route: cleanContextText(path, 300),
      query: cleanContextText(search, 500),
    },

    page: {
      name: getPageName(),
      url: cleanContextText(window.location.href, 800),
      title: cleanContextText(document.title, 200),
    },

    authenticated_user: authUser
      ? {
          id: authUser.id ?? authUser.user_id ?? null,
          full_name: cleanContextText(
            authUser.full_name || authUser.name || "",
            160,
          ),
          email: cleanContextText(authUser.email || "", 220),
          role: cleanContextText(authUser.role || authUser.user_role || "", 80),
        }
      : null,

    visible_page_content: getVisiblePageText(),
    visible_actions: getVisibleActions(),
    form_state: getSafeFormState(),
    local_application_state: getRelevantLocalStorage(),

    rules: {
      priority:
        "Live frontend state is current page state; persistent user/application facts must be verified against backend data.",
      do_not_invent: true,
      do_not_expose_hidden_values: true,
    },
  };
}

// =========================================================
// TOKEN
// =========================================================

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

  if (!token) {
    return null;
  }

  const value = String(token);

  return value.startsWith("Bearer ") ? value.slice(7) : value;
}

// =========================================================
// BACKEND HISTORY → FRONTEND MESSAGES
// =========================================================

function convertHistoryToMessages(history) {
  const result = [];

  if (!history || !Array.isArray(history.messages)) {
    return result;
  }

  history.messages.forEach((item, index) => {
    // USER MESSAGE
    if (item.user_message) {
      result.push({
        id: `user_${item.id ?? index}_${item.created_at ?? Date.now()}`,

        role: "user",

        content: item.user_message,
      });
    }

    // AI MESSAGE
    if (item.ai_response) {
      result.push({
        id: `assistant_${item.id ?? index}_${item.created_at ?? Date.now()}`,

        role: "assistant",

        content: item.ai_response,
      });
    }
  });

  return result;
}

// =========================================================
// COMPONENT
// =========================================================

function AIAssistant() {
  const auth = useAuth();
  const location = useLocation();

  const token = getToken(auth);
  const dashboardType = getDashboardType(location.pathname);

  // =======================================================
  // STATE
  // =======================================================

  const [isOpen, setIsOpen] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);

  const [currentSessionId, setCurrentSessionId] = useState(null);

  const [message, setMessage] = useState("");

  const [chatSessions, setChatSessions] = useState([]);

  const [messages, setMessages] = useState([]);

  const [loading, setLoading] = useState(false);

  const [historyLoading, setHistoryLoading] = useState(false);

  const [error, setError] = useState("");

  // Confirmation dialog state. Deletion is performed only after explicit confirmation.
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [clearAllConfirmOpen, setClearAllConfirmOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const textareaRef = useRef(null);

  const messagesEndRef = useRef(null);

  // =======================================================
  // SCROLL TO BOTTOM
  // =======================================================

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
      });
    }, 50);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  // =======================================================
  // OPEN
  // =======================================================

  const openAssistant = () => {
    setIsOpen(true);

    setError("");
  };

  // =======================================================
  // CLOSE
  // =======================================================

  const closeAssistant = () => {
    setIsOpen(false);

    setHistoryOpen(false);
  };

  // =======================================================
  // TOGGLE HISTORY
  // =======================================================

  const toggleHistory = () => {
    setHistoryOpen((previous) => !previous);
  };

  // =======================================================
  // AUTH CHECK
  // =======================================================

  const requireToken = () => {
    if (!token) {
      setError("Please login again to use InternMatch AI.");

      return false;
    }

    return true;
  };

  // =======================================================
  // LOAD CHAT SESSIONS
  // =======================================================

  const loadChatSessions = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      setHistoryLoading(true);

      setError("");

      const response = await fetch(
        `${API_BASE_URL}/api/ai/chats?dashboard_type=${encodeURIComponent(dashboardType)}`,
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
        throw new Error(data?.detail || "Unable to load chat history.");
      }

      /*
       * Backend may return:
       *
       * [
       *   {...},
       *   {...}
       * ]
       *
       * OR
       *
       * {
       *   "sessions": [...]
       * }
       */

      if (Array.isArray(data)) {
        setChatSessions(data);
      } else if (Array.isArray(data?.sessions)) {
        setChatSessions(data.sessions);
      } else {
        setChatSessions([]);
      }
    } catch (err) {
      console.error("Chat sessions error:", err);

      setError(err?.message || "Unable to load chat history.");
    } finally {
      setHistoryLoading(false);
    }
  }, [token, dashboardType]);

  // =======================================================
  // LOAD COMPLETE CHAT
  // =======================================================

  const loadChatHistory = async (sessionId) => {
    if (!requireToken()) {
      return;
    }

    if (!sessionId) {
      return;
    }

    try {
      setHistoryLoading(true);

      setError("");

      const response = await fetch(
        `${API_BASE_URL}/api/ai/chats/${encodeURIComponent(sessionId)}?dashboard_type=${encodeURIComponent(dashboardType)}`,
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
        throw new Error(data?.detail || "Unable to load chat.");
      }

      setCurrentSessionId(data.session_id);

      setMessages(convertHistoryToMessages(data));

      setMessage("");

      setHistoryOpen(false);

      scrollToBottom();
    } catch (err) {
      console.error("Chat history error:", err);

      setError(err?.message || "Unable to load chat.");
    } finally {
      setHistoryLoading(false);
    }
  };

  // =======================================================
  // LOAD HISTORY WHEN OPENING
  // =======================================================

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    loadChatSessions();
  }, [isOpen, loadChatSessions]);

  // =======================================================
  // NEW CHAT
  // =======================================================

  const handleNewChat = () => {
    /*
     * IMPORTANT:
     *
     * Do NOT generate a local session ID.
     *
     * null means:
     * "Create a new chat on the backend."
     */

    setCurrentSessionId(null);

    setMessages([]);

    setMessage("");

    setError("");

    setHistoryOpen(false);

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  // =======================================================
  // SEND MESSAGE
  // =======================================================

  const handleSendMessage = async () => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      return;
    }

    if (!requireToken()) {
      return;
    }

    if (loading) {
      return;
    }

    /*
     * Keep the session ID exactly as returned
     * by the backend.
     *
     * null = new chat
     */

    const activeSessionId = currentSessionId;

    // ---------------------------------------------------
    // TEMPORARY USER MESSAGE
    // ---------------------------------------------------

    const temporaryUserMessage = {
      id: `temporary_user_${Date.now()}`,

      role: "user",

      content: trimmedMessage,
    };

    setMessages((previous) => [...previous, temporaryUserMessage]);

    setMessage("");

    setError("");

    setLoading(true);

    try {
      // -------------------------------------------------
      // API REQUEST
      // -------------------------------------------------

      const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          Accept: "application/json",

          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          /*
           * IMPORTANT:
           *
           * Backend expects
           * user_message.
           */

          session_id: activeSessionId,
          dashboard_type: dashboardType,

          // Send the current React page state so the AI can answer
          // questions about information that is visible in the application.
          frontend_context: buildFrontendContext(auth, dashboardType),

          user_message: trimmedMessage,
        }),
      });

      const data = await response.json();

      // -------------------------------------------------
      // ERROR
      // -------------------------------------------------

      if (!response.ok) {
        throw new Error(data?.detail || "Unable to generate AI response.");
      }

      // -------------------------------------------------
      // BACKEND SESSION ID
      // -------------------------------------------------

      if (!data?.session_id) {
        throw new Error("Backend did not return a session ID.");
      }

      setCurrentSessionId(data.session_id);

      // -------------------------------------------------
      // AI MESSAGE
      // -------------------------------------------------

      const assistantMessage = {
        id: `assistant_${Date.now()}`,

        role: "assistant",

        content: data.ai_response || "I couldn't generate a response.",
      };

      setMessages((previous) => [...previous, assistantMessage]);

      // -------------------------------------------------
      // REFRESH SIDEBAR
      // -------------------------------------------------

      await loadChatSessions();

      scrollToBottom();
    } catch (err) {
      console.error("AI chat error:", err);

      /*
       * Remove temporary user message
       * if backend failed.
       */

      setMessages((previous) =>
        previous.filter((item) => item.id !== temporaryUserMessage.id),
      );

      setError(err?.message || "InternMatch AI is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  };

  // =======================================================
  // ENTER KEY
  // =======================================================

  const handleInputKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      handleSendMessage();
    }
  };

  // =======================================================
  // SUGGESTED QUESTION
  // =======================================================

  const handleSuggestedQuestion = (question) => {
    setMessage(question);

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  // =======================================================
  // DELETE ONE CHAT
  // =======================================================

  const handleDeleteChat = async (event, sessionId) => {
    event.stopPropagation();

    if (!requireToken()) {
      return;
    }

    if (!sessionId) {
      return;
    }

    setDeleteTarget({ sessionId });
  };

  // =======================================================
  // CONFIRM DELETE ONE CHAT
  // =======================================================

  const confirmDeleteChat = async () => {
    const sessionId = deleteTarget?.sessionId;

    if (!sessionId || deleteLoading) {
      return;
    }

    setDeleteLoading(true);

    try {
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/api/ai/chats/${encodeURIComponent(sessionId)}?dashboard_type=${encodeURIComponent(dashboardType)}`,
        {
          method: "DELETE",

          headers: {
            Accept: "application/json",

            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || "Unable to delete chat.");
      }

      setChatSessions((previous) =>
        previous.filter((session) => session.session_id !== sessionId),
      );

      /*
       * If currently viewing deleted chat,
       * return to a clean new chat.
       */

      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);

        setMessages([]);

        setMessage("");
      }

      setDeleteTarget(null);
    } catch (err) {
      console.error("Delete chat error:", err);

      setError(err?.message || "Unable to delete chat.");
    } finally {
      setDeleteLoading(false);
    }
  };

  // =======================================================
  // DELETE ALL CHATS
  // =======================================================

  const handleDeleteAllChats = async () => {
    if (!requireToken()) {
      return;
    }

    if (chatSessions.length === 0) {
      return;
    }

    setClearAllConfirmOpen(true);
  };

  // =======================================================
  // CONFIRM DELETE ALL CHATS
  // =======================================================

  const confirmDeleteAllChats = async () => {
    if (deleteLoading || chatSessions.length === 0) {
      return;
    }

    setDeleteLoading(true);

    try {
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/api/ai/chats?dashboard_type=${encodeURIComponent(dashboardType)}`,
        {
          method: "DELETE",

          headers: {
            Accept: "application/json",

            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || "Unable to delete chat history.");
      }

      setChatSessions([]);

      setCurrentSessionId(null);

      setMessages([]);

      setMessage("");
      setClearAllConfirmOpen(false);
    } catch (err) {
      console.error("Delete all chats error:", err);

      setError(err?.message || "Unable to delete chat history.");
    } finally {
      setDeleteLoading(false);
    }
  };

  // =======================================================
  // CLOSED STATE
  // =======================================================

  if (!isOpen) {
    return (
      <button
        type="button"
        className="ai-assistant-floating-button"
        onClick={openAssistant}
        aria-label="Open InternMatch AI Assistant"
        title="InternMatch AI Assistant"
      >
        <Bot size={28} strokeWidth={2} />

        <span className="ai-assistant-pulse" />
      </button>
    );
  }

  // =======================================================
  // MAIN UI
  // =======================================================

  return (
    <div className="ai-assistant-container">
      {/* ===================================================
          HISTORY SIDEBAR
      =================================================== */}

      {historyOpen && (
        <aside className="ai-assistant-history">
          <div className="ai-history-header">
            <div className="ai-history-brand">
              <div className="ai-history-brand-icon">
                <Bot size={21} strokeWidth={2} />
              </div>

              <div>
                <h3>InternMatch AI</h3>

                <span>Chat History</span>
              </div>
            </div>

            <button
              type="button"
              className="ai-history-close"
              onClick={toggleHistory}
              aria-label="Close chat history"
              title="Close"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          {/* NEW CHAT */}

          <button
            type="button"
            className="ai-new-chat-button"
            onClick={handleNewChat}
          >
            <Plus size={19} strokeWidth={2.2} />

            <span>New Chat</span>
          </button>

          {/* DELETE ALL */}

          {chatSessions.length > 0 && (
            <button
              type="button"
              className="ai-delete-all-button"
              onClick={handleDeleteAllChats}
            >
              <Trash2 size={16} />

              <span>Delete All Chats</span>
            </button>
          )}

          {/* HISTORY */}

          <div className="ai-history-list">
            {historyLoading && (
              <div className="ai-history-loading">
                <LoaderCircle size={20} className="ai-spinner" />

                <span>Loading chats...</span>
              </div>
            )}

            {!historyLoading && chatSessions.length === 0 && (
              <div className="ai-history-empty">
                <MessageSquare size={30} strokeWidth={1.6} />

                <h4>No previous chats</h4>

                <p>Start a new conversation with InternMatch AI.</p>
              </div>
            )}

            {!historyLoading &&
              chatSessions.length > 0 &&
              chatSessions.map((session) => (
                <div
                  className={`ai-history-item-wrapper ${
                    currentSessionId === session.session_id ? "active" : ""
                  }`}
                  key={session.session_id}
                >
                  <button
                    type="button"
                    className={`ai-history-item ${
                      currentSessionId === session.session_id ? "active" : ""
                    }`}
                    onClick={() => loadChatHistory(session.session_id)}
                  >
                    <MessageSquare size={17} strokeWidth={1.9} />

                    <span>
                      {session.title ||
                        session.first_question ||
                        "New conversation"}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="ai-history-delete"
                    onClick={(event) =>
                      handleDeleteChat(event, session.session_id)
                    }
                    aria-label="Delete chat"
                    title="Delete chat"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
          </div>
        </aside>
      )}

      {/* ===================================================
          DELETE CONFIRMATION MODALS
      =================================================== */}

      {(deleteTarget || clearAllConfirmOpen) && (
        <div
          className="ai-confirm-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target !== event.currentTarget || deleteLoading) {
              return;
            }

            setDeleteTarget(null);
            setClearAllConfirmOpen(false);
          }}
        >
          <div
            className="ai-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-confirm-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="ai-confirm-icon">
              <Trash2 size={22} strokeWidth={2} />
            </div>

            <h3 id="ai-confirm-title">
              {clearAllConfirmOpen ? "Delete all chats?" : "Delete this chat?"}
            </h3>

            <p>
              {clearAllConfirmOpen
                ? "This will permanently delete all AI chat history from this dashboard. Chats from other dashboards will not be affected."
                : "This conversation will be permanently deleted from this dashboard."}
            </p>

            <div className="ai-confirm-actions">
              <button
                type="button"
                className="ai-confirm-cancel"
                disabled={deleteLoading}
                onClick={() => {
                  setDeleteTarget(null);
                  setClearAllConfirmOpen(false);
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="ai-confirm-delete"
                disabled={deleteLoading}
                onClick={
                  clearAllConfirmOpen
                    ? confirmDeleteAllChats
                    : confirmDeleteChat
                }
              >
                {deleteLoading ? (
                  <>
                    <LoaderCircle size={16} className="ai-spinner" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================
          MAIN WINDOW
      =================================================== */}

      <section className="ai-assistant-window">
        {/* HEADER */}

        <header className="ai-assistant-header">
          <div className="ai-assistant-header-left">
            <button
              type="button"
              className="ai-assistant-menu-button"
              onClick={toggleHistory}
              aria-label={
                historyOpen ? "Close chat history" : "Open chat history"
              }
              title={historyOpen ? "Close chat history" : "Chat history"}
            >
              <Menu size={21} strokeWidth={2} />
            </button>

            <div className="ai-assistant-header-icon">
              <Bot size={22} strokeWidth={2} />
            </div>

            <div className="ai-assistant-title">
              <h3>InternMatch AI</h3>

              <span>Your internship assistant</span>
            </div>
          </div>

          <button
            type="button"
            className="ai-assistant-close-button"
            onClick={closeAssistant}
            aria-label="Close InternMatch AI"
            title="Close"
          >
            <X size={21} strokeWidth={2} />
          </button>
        </header>

        {/* ERROR */}

        {error && (
          <div className="ai-assistant-error">
            <AlertCircle size={17} />

            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* BODY */}

        <div className="ai-assistant-body">
          {messages.length === 0 && (
            <div className="ai-assistant-welcome">
              <div className="ai-welcome-icon">
                <Bot size={38} strokeWidth={1.7} />
              </div>

              <h2>Hi! I'm InternMatch AI 👋</h2>

              <p className="ai-welcome-description">
                Ask me about your profile, resume, internships, applications or
                InternMatch.
              </p>

              <div className="ai-suggested-questions">
                <button
                  type="button"
                  onClick={() =>
                    handleSuggestedQuestion("How does InternMatch AI work?")
                  }
                >
                  How does InternMatch AI work?
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleSuggestedQuestion("What skills are in my resume?")
                  }
                >
                  What skills are in my resume?
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleSuggestedQuestion("What is my application status?")
                  }
                >
                  What is my application status?
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleSuggestedQuestion("What internships have I saved?")
                  }
                >
                  What internships have I saved?
                </button>
              </div>
            </div>
          )}

          {messages.length > 0 && (
            <div className="ai-message-list">
              {messages.map((chatMessage) => (
                <div
                  key={chatMessage.id}
                  className={`ai-message-row ${
                    chatMessage.role === "user"
                      ? "user-message-row"
                      : "assistant-message-row"
                  }`}
                >
                  {chatMessage.role !== "user" && (
                    <div className="ai-message-avatar">
                      <Bot size={17} strokeWidth={2} />
                    </div>
                  )}

                  <div
                    className={`ai-message ${
                      chatMessage.role === "user"
                        ? "user-message"
                        : "assistant-message"
                    }`}
                  >
                    {chatMessage.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="ai-message-row assistant-message-row">
                  <div className="ai-message-avatar">
                    <Bot size={17} strokeWidth={2} />
                  </div>

                  <div className="ai-message assistant-message ai-typing">
                    <LoaderCircle size={16} className="ai-spinner" />

                    <span>Thinking...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* INPUT */}

        <div className="ai-assistant-input-container">
          <div className="ai-assistant-input-wrapper">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Ask InternMatch AI..."
              aria-label="Ask InternMatch AI"
              rows={1}
              maxLength={2000}
              disabled={loading}
            />

            <button
              type="button"
              className="ai-assistant-send-button"
              onClick={handleSendMessage}
              disabled={!message.trim() || loading}
              aria-label="Send message"
              title="Send message"
            >
              {loading ? (
                <LoaderCircle size={18} className="ai-spinner" />
              ) : (
                <Send size={18} strokeWidth={2} />
              )}
            </button>
          </div>

          <div className="ai-assistant-disclaimer">
            InternMatch AI can make mistakes. Verify important information.
          </div>
        </div>
      </section>
    </div>
  );
}

export default AIAssistant;

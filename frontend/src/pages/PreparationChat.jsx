import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Archive,
  AlertTriangle,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  File,
  FileCode2,
  FileText,
  Image as ImageIcon,
  Loader2,
  Menu,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";

import "../styles/PreparationChat.css";

/* ============================================================
   CONFIGURATION
   ============================================================ */

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

const CHAT_API = `${API_BASE_URL}/api/preparation-chat`;

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_FILE_TYPES = [
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
];


/* ============================================================
   HELPER FUNCTIONS
   ============================================================ */

function getAuthToken() {
  const possibleKeys = [
    "access_token",
    "token",
    "authToken",
    "jwt",
  ];

  for (const key of possibleKeys) {
    const value = localStorage.getItem(key);

    if (value) {
      return value;
    }
  }

  return null;
}


function getHeaders(includeJson = true) {
  const headers = {};

  const token = getAuthToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}


async function parseResponse(response) {
  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.detail ||
      data?.message ||
      "Something went wrong. Please try again.";

    throw new Error(message);
  }

  return data;
}


function formatTime(dateValue) {
  if (!dateValue) {
    return "";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}


function formatDate(dateValue) {
  if (!dateValue) {
    return "";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return "Today";
  }

  return date.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}


function getFileIcon(fileName = "") {
  const extension =
    fileName.toLowerCase().split(".").pop();

  if (extension === "pdf") {
    return <FileText size={19} />;
  }

  if (
    extension === "doc" ||
    extension === "docx"
  ) {
    return <FileText size={19} />;
  }

  if (
    extension === "js" ||
    extension === "jsx" ||
    extension === "ts" ||
    extension === "tsx" ||
    extension === "py"
  ) {
    return <FileCode2 size={19} />;
  }

  if (
    extension === "png" ||
    extension === "jpg" ||
    extension === "jpeg"
  ) {
    return <ImageIcon size={19} />;
  }

  return <File size={19} />;
}


function formatFileSize(size) {
  if (!size) {
    return "";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}


function makeTemporaryFile(file) {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
    file,
    file_name: file.name,
    file_size: file.size,
    file_type:
      file.name.split(".").pop()?.toUpperCase() || "FILE",
    mime_type: file.type || "application/octet-stream",
    temporary: true,
  };
}


/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function PreparationChat() {
  /* ----------------------------------------------------------
     STATE
     ---------------------------------------------------------- */

  const [conversations, setConversations] = useState([]);

  const [currentConversationId, setCurrentConversationId] =
    useState(null);

  const [messages, setMessages] = useState([]);

  const [documents, setDocuments] = useState([]);

  const [pendingFiles, setPendingFiles] = useState([]);

  const [messageText, setMessageText] = useState("");

  const [loadingHistory, setLoadingHistory] =
    useState(true);

  const [loadingConversation, setLoadingConversation] =
    useState(false);

  const [sending, setSending] = useState(false);

  const [uploading, setUploading] = useState(false);

  const [deletingConversation, setDeletingConversation] =
    useState(false);

  const [error, setError] = useState("");

  const [copiedMessageId, setCopiedMessageId] =
    useState(null);

  const [sidebarOpen, setSidebarOpen] =
    useState(true);

  const [showMobileSidebar, setShowMobileSidebar] =
    useState(false);

  const [dragActive, setDragActive] =
    useState(false);

  const [activeMenuId, setActiveMenuId] =
    useState(null);

  const [showDeleteModal, setShowDeleteModal] =
    useState(false);

  const [conversationToDelete, setConversationToDelete] =
    useState(null);

  const textareaRef = useRef(null);

  const messagesEndRef = useRef(null);

  const fileInputRef = useRef(null);

  const menuRef = useRef(null);


  /* ----------------------------------------------------------
     SCROLL TO BOTTOM
     ---------------------------------------------------------- */

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });
  }, []);


  useEffect(() => {
    scrollToBottom();
  }, [messages, sending, scrollToBottom]);


  /* ----------------------------------------------------------
     LOAD CONVERSATION HISTORY
     ---------------------------------------------------------- */

  const loadConversations = useCallback(async () => {
    try {
      setLoadingHistory(true);
      setError("");

      const response = await fetch(
        `${CHAT_API}/conversations`,
        {
          method: "GET",
          headers: getHeaders(false),
        }
      );

      const data = await parseResponse(response);

      setConversations(data?.data || []);
    } catch (err) {
      console.error(
        "Failed to load Preparation Chat history:",
        err
      );

      setError(err.message);
    } finally {
      setLoadingHistory(false);
    }
  }, []);


  useEffect(() => {
    loadConversations();
  }, [loadConversations]);


  /* ----------------------------------------------------------
     LOAD SINGLE CONVERSATION
     ---------------------------------------------------------- */

  const loadConversation = async (conversationId) => {
    if (!conversationId) {
      return;
    }

    try {
      setLoadingConversation(true);
      setError("");
      setActiveMenuId(null);

      const response = await fetch(
        `${CHAT_API}/conversations/${conversationId}`,
        {
          method: "GET",
          headers: getHeaders(false),
        }
      );

      const data = await parseResponse(response);

      const conversationData =
        data?.data || {};

      setCurrentConversationId(
        conversationData?.conversation?.id ||
          conversationId
      );

      setMessages(
        conversationData?.messages || []
      );

      setDocuments(
        conversationData?.documents || []
      );

      setPendingFiles([]);

      setShowMobileSidebar(false);
    } catch (err) {
      console.error(
        "Failed to load conversation:",
        err
      );

      setError(err.message);
    } finally {
      setLoadingConversation(false);
    }
  };


  /* ----------------------------------------------------------
     NEW CHAT
     ---------------------------------------------------------- */

  const startNewChat = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setDocuments([]);
    setPendingFiles([]);
    setMessageText("");
    setError("");
    setActiveMenuId(null);
    setShowMobileSidebar(false);

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };


  /* ----------------------------------------------------------
     CREATE CONVERSATION
     ---------------------------------------------------------- */

  const createConversation = async () => {
    const response = await fetch(
      `${CHAT_API}/conversations`,
      {
        method: "POST",
        headers: getHeaders(true),
        body: JSON.stringify({}),
      }
    );

    const data = await parseResponse(response);

    return data?.data;
  };


  /* ----------------------------------------------------------
     UPLOAD ONE DOCUMENT TO EXISTING CONVERSATION
     ---------------------------------------------------------- */

  const uploadDocumentToConversation = async (
    conversationId,
    file
  ) => {
    const formData = new FormData();

    formData.append("file", file);

    const response = await fetch(
      `${CHAT_API}/conversations/${conversationId}/documents`,
      {
        method: "POST",
        headers: getHeaders(false),
        body: formData,
      }
    );

    const data = await parseResponse(response);

    return data?.data;
  };


  /* ----------------------------------------------------------
     UPLOAD PENDING FILES
     ---------------------------------------------------------- */

  const uploadPendingFiles = async (conversationId) => {
    if (!pendingFiles.length) {
      return [];
    }

    setUploading(true);

    const uploadedDocuments = [];

    try {
      for (const pending of pendingFiles) {
        const document =
          await uploadDocumentToConversation(
            conversationId,
            pending.file
          );

        if (document) {
          uploadedDocuments.push(document);
        }
      }

      setDocuments((previous) => [
        ...previous,
        ...uploadedDocuments,
      ]);

      return uploadedDocuments;
    } finally {
      setUploading(false);
    }
  };


  /* ----------------------------------------------------------
     VALIDATE FILE
     ---------------------------------------------------------- */

  const validateFile = (file) => {
    if (!file) {
      return "Invalid file.";
    }

    if (file.size > MAX_FILE_SIZE) {
      return `${file.name} is larger than 10 MB.`;
    }

    const extension =
      "." +
      file.name
        .split(".")
        .pop()
        .toLowerCase();

    if (!ALLOWED_FILE_TYPES.includes(extension)) {
      return `${file.name} is not supported. Use PDF, DOC, DOCX or TXT.`;
    }

    return null;
  };


  /* ----------------------------------------------------------
     ADD FILES
     ---------------------------------------------------------- */

  const addFiles = (fileList) => {
    const incomingFiles = Array.from(
      fileList || []
    );

    if (!incomingFiles.length) {
      return;
    }

    const validFiles = [];

    for (const file of incomingFiles) {
      const validationError =
        validateFile(file);

      if (validationError) {
        setError(validationError);
        continue;
      }

      validFiles.push(
        makeTemporaryFile(file)
      );
    }

    if (!validFiles.length) {
      return;
    }

    setPendingFiles((previous) => [
      ...previous,
      ...validFiles,
    ]);

    setError("");
  };


  /* ----------------------------------------------------------
     FILE INPUT
     ---------------------------------------------------------- */

  const handleFileInput = (event) => {
    addFiles(event.target.files);

    event.target.value = "";
  };


  /* ----------------------------------------------------------
     REMOVE PENDING FILE
     ---------------------------------------------------------- */

  const removePendingFile = (fileId) => {
    setPendingFiles((previous) =>
      previous.filter(
        (file) => file.id !== fileId
      )
    );
  };


  /* ----------------------------------------------------------
     DRAG & DROP
     ---------------------------------------------------------- */

  const handleDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(true);
  };


  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(true);
  };


  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (
      event.currentTarget === event.target
    ) {
      setDragActive(false);
    }
  };


  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();

    setDragActive(false);

    addFiles(event.dataTransfer.files);
  };


  /* ----------------------------------------------------------
     SEND MESSAGE
     ---------------------------------------------------------- */

  const sendMessage = async () => {
    const text = messageText.trim();

    if (!text || sending) {
      return;
    }

    setError("");
    setSending(true);

    const temporaryMessageId =
      `temporary-${Date.now()}`;

    const filesForMessage = [...pendingFiles];

    const optimisticMessage = {
      id: temporaryMessageId,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
      documents: filesForMessage.map(
        (file) => ({
          id: file.id,
          file_name: file.file_name,
          file_size: file.file_size,
          file_type: file.file_type,
          mime_type: file.mime_type,
          temporary: true,
        })
      ),
    };

    setMessages((previous) => [
      ...previous,
      optimisticMessage,
    ]);

    setMessageText("");

    let createdConversationHere = false;
    let uploadedDocumentsForMessage = [];
    let conversationId = currentConversationId;

    try {

      /*
       * IMPORTANT:
       *
       * If this is a brand-new chat and files were
       * selected, create the conversation only now.
       *
       * This prevents empty chats from being stored
       * when the user only uploads a file.
       */

      if (!conversationId) {
        if (filesForMessage.length) {
          const conversation =
            await createConversation();

          conversationId =
            conversation?.id;

          if (!conversationId) {
            throw new Error(
              "Unable to create a new conversation."
            );
          }

          setCurrentConversationId(
            conversationId
          );

          createdConversationHere = true;

          /*
           * Upload documents BEFORE sending the
           * first question so the AI can use them.
           */
          uploadedDocumentsForMessage =
            await uploadPendingFiles(
              conversationId
            );
        }
      } else if (filesForMessage.length) {
        /*
         * Existing conversation:
         * upload newly selected documents first.
         */
        uploadedDocumentsForMessage =
          await uploadPendingFiles(
            conversationId
          );
      }

      /*
       * Send actual message to backend.
       */

      const response = await fetch(
        `${CHAT_API}/messages`,
        {
          method: "POST",
          headers: getHeaders(true),
          body: JSON.stringify({
            conversation_id:
              conversationId || null,
            message: text,
            document_ids:
              uploadedDocumentsForMessage
                .map((document) => document.id)
                .filter(Boolean),
          }),
        }
      );

      const data =
        await parseResponse(response);

      /*
       * Backend may create the conversation when
       * conversation_id is null.
       */

      const returnedConversationId =
        data?.conversation?.id ||
        conversationId;

      if (returnedConversationId) {
        setCurrentConversationId(
          returnedConversationId
        );
      }

      /*
       * Replace optimistic message with
       * backend user message + assistant response.
       */

      const backendUserMessage =
        data?.user_message;

      const backendAssistantMessage =
        data?.assistant_message;

      setMessages((previous) => {
        const withoutOptimistic =
          previous.filter(
            (message) =>
              message.id !==
              temporaryMessageId
          );

        const nextMessages = [
          ...withoutOptimistic,
        ];

        if (backendUserMessage) {
          nextMessages.push({
            ...backendUserMessage,
            documents:
              backendUserMessage.documents?.length
                ? backendUserMessage.documents
                : filesForMessage.length
                  ? filesForMessage.map(
                      (file) => ({
                        id: file.id,
                        file_name:
                          file.file_name,
                        file_size:
                          file.file_size,
                        file_type:
                          file.file_type,
                        mime_type:
                          file.mime_type,
                        temporary: true,
                      })
                    )
                  : [],
          });
        }

        if (backendAssistantMessage) {
          nextMessages.push(
            backendAssistantMessage
          );
        }

        return nextMessages;
      });

      /*
       * Pending files have now been uploaded.
       */
      setPendingFiles([]);

      /*
       * Update conversation history.
       */
      await loadConversations();
    } catch (err) {
      console.error(
        "Preparation Chat send error:",
        err
      );

      setError(err.message);

      /*
       * If this was a brand-new chat, remove the
       * server conversation that was created only
       * for this failed message. This keeps empty
       * or failed chats out of History.
       */
      if (createdConversationHere && conversationId) {
        try {
          await fetch(
            `${CHAT_API}/conversations/${conversationId}`,
            {
              method: "DELETE",
              headers: getHeaders(false),
            }
          );
        } catch (cleanupError) {
          console.warn(
            "Failed to clean up conversation:",
            cleanupError
          );
        }

        setCurrentConversationId(null);
        setDocuments([]);
      }

      /*
       * Remove optimistic message when
       * sending fails.
       */
      setMessages((previous) =>
        previous.filter(
          (message) =>
            message.id !==
            temporaryMessageId
        )
      );

      /*
       * Restore the text so the user does
       * not lose their question.
       */
      setMessageText(text);
    } finally {
      setSending(false);

      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  };


  /* ----------------------------------------------------------
     ENTER KEY
     ---------------------------------------------------------- */

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      if (
        event.shiftKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      event.preventDefault();

      sendMessage();
    }
  };


  /* ----------------------------------------------------------
     TEXTAREA AUTO RESIZE
     ---------------------------------------------------------- */

  const handleTextChange = (event) => {
    setMessageText(event.target.value);

    const textarea =
      event.target;

    textarea.style.height = "auto";

    textarea.style.height =
      `${Math.min(
        textarea.scrollHeight,
        180
      )}px`;
  };


  /* ----------------------------------------------------------
     COPY MESSAGE
     ---------------------------------------------------------- */

  const copyMessage = async (
    message,
    messageId
  ) => {
    try {
      await navigator.clipboard.writeText(
        message
      );

      setCopiedMessageId(messageId);

      setTimeout(() => {
        setCopiedMessageId(null);
      }, 1800);
    } catch (err) {
      console.error(
        "Copy failed:",
        err
      );
    }
  };


  /* ----------------------------------------------------------
     DELETE CONVERSATION
     ---------------------------------------------------------- */

  const requestDeleteConversation = (conversation) => {
    if (!conversation?.id || deletingConversation) {
      return;
    }

    setActiveMenuId(null);
    setConversationToDelete(conversation);
    setShowDeleteModal(true);
  };


  const closeDeleteModal = () => {
    if (deletingConversation) {
      return;
    }

    setShowDeleteModal(false);
    setConversationToDelete(null);
  };


  const deleteConversation = async (conversationId) => {
    if (!conversationId || deletingConversation) {
      return;
    }

    try {
      setDeletingConversation(true);
      setError("");

      const response = await fetch(
        `${CHAT_API}/conversations/${conversationId}`,
        {
          method: "DELETE",
          headers: getHeaders(false),
        }
      );

      await parseResponse(response);

      setConversations((previous) =>
        previous.filter(
          (conversation) =>
            conversation.id !== conversationId
        )
      );

      if (currentConversationId === conversationId) {
        startNewChat();
      }

      setShowDeleteModal(false);
      setConversationToDelete(null);
    } catch (err) {
      console.error(
        "Delete conversation error:",
        err
      );

      setError(err.message);
    } finally {
      setDeletingConversation(false);
      setActiveMenuId(null);
    }
  };


  /* ----------------------------------------------------------
     DELETE DOCUMENT
     ---------------------------------------------------------- */

  const deleteDocument = async (
    documentId
  ) => {
    if (
      !currentConversationId ||
      !documentId
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Delete this uploaded document?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      const response = await fetch(
        `${CHAT_API}/conversations/${currentConversationId}/documents/${documentId}`,
        {
          method: "DELETE",
          headers: getHeaders(false),
        }
      );

      await parseResponse(response);

      setDocuments((previous) =>
        previous.filter(
          (document) =>
            document.id !== documentId
        )
      );

      /*
       * Reload messages because the backend
       * may return document relationships
       * with messages.
       */
      await loadConversation(
        currentConversationId
      );
    } catch (err) {
      console.error(
        "Delete document error:",
        err
      );

      setError(err.message);
    }
  };


  /* ----------------------------------------------------------
     CLOSE MENUS WHEN CLICKING OUTSIDE
     ---------------------------------------------------------- */

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target
        )
      ) {
        setActiveMenuId(null);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);


  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        closeDeleteModal();
      }
    };

    if (showDeleteModal) {
      document.addEventListener(
        "keydown",
        handleEscape
      );
    }

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [showDeleteModal, deletingConversation]);


  /* ----------------------------------------------------------
     RENDER DOCUMENT CARD
     ---------------------------------------------------------- */

  const renderDocumentCard = (
    document,
    removable = false
  ) => {
    return (
      <div
        className="preparation-file-card"
        key={
          document.id ||
          document.file_name
        }
      >
        <div className="preparation-file-icon">
          {getFileIcon(
            document.file_name
          )}
        </div>

        <div className="preparation-file-info">
          <div
            className="preparation-file-name"
            title={document.file_name}
          >
            {document.file_name}
          </div>

          <div className="preparation-file-meta">
            {document.file_type ||
              "FILE"}

            {document.file_size
              ? ` • ${formatFileSize(
                  document.file_size
                )}`
              : ""}
          </div>
        </div>

        {removable && (
          <button
            type="button"
            className="preparation-file-remove"
            onClick={() =>
              removePendingFile(
                document.id
              )
            }
            aria-label="Remove file"
          >
            <X size={15} />
          </button>
        )}
      </div>
    );
  };


  /* ----------------------------------------------------------
     RENDER MESSAGE
     ---------------------------------------------------------- */

  const renderMessage = (
    message,
    index
  ) => {
    const isUser =
      message.role === "user";

    const isAssistant =
      message.role === "assistant";

    const messageDocuments =
      message.documents ||
      message.attachments ||
      [];

    const messageKey =
      message.id ||
      `${message.role}-${index}`;

    return (
      <div
        className={`preparation-message-row ${
          isUser
            ? "preparation-user-row"
            : "preparation-assistant-row"
        }`}
        key={messageKey}
      >
        {!isUser && (
          <div className="preparation-avatar preparation-ai-avatar">
            <Sparkles size={17} />
          </div>
        )}

        <div
          className={`preparation-message-content ${
            isUser
              ? "preparation-user-content"
              : "preparation-assistant-content"
          }`}
        >
          <div
            className={`preparation-message-bubble ${
              isUser
                ? "preparation-user-bubble"
                : "preparation-assistant-bubble"
            }`}
          >
            <div className="preparation-message-text">
              {message.content}
            </div>

            {messageDocuments.length >
              0 && (
              <div className="preparation-message-documents">
                {messageDocuments.map(
                  (document) =>
                    renderDocumentCard(
                      document
                    )
                )}
              </div>
            )}
          </div>

          <div className="preparation-message-footer">
            <span>
              {formatTime(
                message.created_at
              )}
            </span>

            {isAssistant && (
              <button
                type="button"
                className="preparation-copy-button"
                onClick={() =>
                  copyMessage(
                    message.content,
                    messageKey
                  )
                }
                title="Copy answer"
              >
                {copiedMessageId ===
                messageKey ? (
                  <Check size={15} />
                ) : (
                  <Copy size={15} />
                )}

                <span>
                  {copiedMessageId ===
                  messageKey
                    ? "Copied"
                    : "Copy"}
                </span>
              </button>
            )}
          </div>
        </div>

        {isUser && (
          <div className="preparation-avatar preparation-user-avatar">
            <User size={17} />
          </div>
        )}
      </div>
    );
  };


  /* ----------------------------------------------------------
     RENDER EMPTY STATE
     ---------------------------------------------------------- */

  const renderEmptyState = () => {
    return (
      <div className="preparation-empty-state">
        <div className="preparation-empty-icon">
          <Sparkles size={30} />
        </div>

        <h1>
          How can I help you prepare?
        </h1>

        <p>
          Ask questions about interview
          preparation, your resume, skills,
          projects, or upload a document for
          detailed assistance.
        </p>

        <div className="preparation-suggestion-grid">
          <button
            type="button"
            onClick={() =>
              setMessageText(
                "Create interview questions based on my resume"
              )
            }
          >
            <MessageSquare size={18} />
            <span>
              Questions from my resume
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setMessageText(
                "What skills should I improve for my target role?"
              )
            }
          >
            <Sparkles size={18} />
            <span>
              Skills I should improve
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setMessageText(
                "Give me a mock interview based on my profile"
              )
            }
          >
            <Bot size={18} />
            <span>
              Start a mock interview
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              fileInputRef.current?.click()
            }
          >
            <Paperclip size={18} />
            <span>
              Analyze a document
            </span>
          </button>
        </div>
      </div>
    );
  };


  /* ----------------------------------------------------------
     RENDER HISTORY ITEM
     ---------------------------------------------------------- */

  const renderConversationItem = (
    conversation
  ) => {
    const active =
      currentConversationId ===
      conversation.id;

    return (
      <div
        className={`preparation-history-item ${
          active
            ? "preparation-history-active"
            : ""
        }`}
        key={conversation.id}
      >
        <button
          type="button"
          className="preparation-history-main"
          onClick={() =>
            loadConversation(
              conversation.id
            )
          }
        >
          <MessageSquare size={16} />

          <div className="preparation-history-text">
            <span className="preparation-history-title">
              {conversation.title ||
                "New Preparation Chat"}
            </span>

            <span className="preparation-history-date">
              {formatDate(
                conversation.updated_at ||
                  conversation.created_at
              )}
            </span>
          </div>
        </button>

        <div
          className="preparation-history-actions"
          ref={
            activeMenuId ===
            conversation.id
              ? menuRef
              : null
          }
        >
          <button
            type="button"
            className="preparation-history-menu-button"
            onClick={(event) => {
              event.stopPropagation();

              setActiveMenuId(
                activeMenuId ===
                  conversation.id
                  ? null
                  : conversation.id
              );
            }}
          >
            <MoreVertical size={16} />
          </button>

          {activeMenuId ===
            conversation.id && (
            <div className="preparation-history-menu">
              <button
                type="button"
                onClick={() =>
                  requestDeleteConversation(
                    conversation
                  )
                }
              >
                <Trash2 size={15} />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };


  /* ============================================================
     JSX
     ============================================================ */

  return (
    <div
      className={`preparation-chat-page ${
        sidebarOpen
          ? "preparation-sidebar-expanded"
          : "preparation-sidebar-collapsed"
      }`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ======================================================
          DRAG OVERLAY
          ====================================================== */}

      {dragActive && (
        <div className="preparation-drop-overlay">
          <div className="preparation-drop-box">
            <Upload size={38} />
            <h3>
              Drop your document here
            </h3>
            <p>
              PDF, DOC, DOCX or TXT
            </p>
          </div>
        </div>
      )}


      {/* ======================================================
          MOBILE SIDEBAR BACKDROP
          ====================================================== */}

      {showMobileSidebar && (
        <div
          className="preparation-mobile-backdrop"
          onClick={() =>
            setShowMobileSidebar(false)
          }
        />
      )}


      {/* ======================================================
          SIDEBAR
          ====================================================== */}

      <aside
        className={`preparation-chat-sidebar ${
          showMobileSidebar
            ? "preparation-mobile-sidebar-open"
            : ""
        }`}
      >
        <div className="preparation-sidebar-header">
          <div className="preparation-brand">
            <img
              src="/logo.png"
              alt="InternMatch AI"
              className={`preparation-brand-logo ${
                sidebarOpen
                  ? "preparation-brand-logo-expanded"
                  : "preparation-brand-logo-collapsed"
              }`}
            />

            {sidebarOpen && (
              <div className="preparation-brand-copy">
                <h2>
                  Preparation Chat
                </h2>
                <span>
                  AI Interview Assistant
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="preparation-sidebar-close-mobile"
            onClick={() =>
              setShowMobileSidebar(false)
            }
          >
            <X size={19} />
          </button>
        </div>


        <div className="preparation-sidebar-content">
          <button
            type="button"
            className="preparation-new-chat-button"
            onClick={startNewChat}
          >
            <Plus size={19} />

            {sidebarOpen && (
              <span>
                New chat
              </span>
            )}
          </button>


          {sidebarOpen && (
            <div className="preparation-history-section">
              <div className="preparation-history-heading">
                <span>
                  Recent chats
                </span>

                <button
                  type="button"
                  onClick={
                    loadConversations
                  }
                  title="Refresh history"
                >
                  <RefreshCw
                    size={14}
                  />
                </button>
              </div>


              {loadingHistory ? (
                <div className="preparation-history-loading">
                  <Loader2
                    size={17}
                    className="preparation-spin"
                  />
                  <span>
                    Loading chats...
                  </span>
                </div>
              ) : conversations.length ===
                0 ? (
                <div className="preparation-history-empty">
                  <MessageSquare
                    size={22}
                  />

                  <span>
                    No previous chats
                  </span>

                  <small>
                    Your conversations will
                    appear here.
                  </small>
                </div>
              ) : (
                <div className="preparation-history-list">
                  {conversations.map(
                    renderConversationItem
                  )}
                </div>
              )}
            </div>
          )}
        </div>


        <div className="preparation-sidebar-footer">
          {sidebarOpen ? (
            <>
              <div className="preparation-footer-icon">
                <Archive size={16} />
              </div>

              <div>
                <strong>
                  Your chats are saved
                </strong>

                <span>
                  Conversations stay linked
                  to your account.
                </span>
              </div>
            </>
          ) : (
            <Archive size={18} />
          )}
        </div>
      </aside>


      {/* ======================================================
          MAIN AREA
          ====================================================== */}

      <main className="preparation-chat-main">

        {/* ====================================================
            HEADER
            ==================================================== */}

        <header className="preparation-chat-header">
          <div className="preparation-header-left">
            <button
              type="button"
              className="preparation-mobile-menu"
              onClick={() =>
                setShowMobileSidebar(true)
              }
            >
              <Menu size={21} />
            </button>

            <button
              type="button"
              className="preparation-collapse-button"
              onClick={() =>
                setSidebarOpen(
                  (previous) =>
                    !previous
                )
              }
              title={
                sidebarOpen
                  ? "Collapse sidebar"
                  : "Expand sidebar"
              }
            >
              {sidebarOpen ? (
                <ChevronLeft
                  size={19}
                />
              ) : (
                <ChevronRight
                  size={19}
                />
              )}
            </button>

            <div className="preparation-header-title">
              <div className="preparation-header-ai-icon">
                <Bot size={19} />
              </div>

              <div>
                <h1>
                  {currentConversationId
                    ? conversations.find(
                        (conversation) =>
                          conversation.id ===
                          currentConversationId
                      )?.title ||
                      "Preparation Chat"
                    : "Preparation Chat"}
                </h1>

                <span>
                  AI-powered preparation
                </span>
              </div>
            </div>
          </div>


          <div className="preparation-header-right">
            {currentConversationId && (
              <button
                type="button"
                className="preparation-header-delete"
                onClick={() => {
                  const conversation =
                    conversations.find(
                      (item) =>
                        item.id ===
                        currentConversationId
                    );

                  requestDeleteConversation(
                    conversation || {
                      id: currentConversationId,
                      title: "Preparation Chat",
                    }
                  );
                }}
                disabled={
                  deletingConversation
                }
                title="Delete conversation"
              >
                {deletingConversation ? (
                  <Loader2
                    size={17}
                    className="preparation-spin"
                  />
                ) : (
                  <Trash2 size={17} />
                )}
              </button>
            )}
          </div>
        </header>


        {/* ====================================================
            ERROR
            ==================================================== */}

        {error && (
          <div className="preparation-error-banner">
            <div>
              <strong>
                Something went wrong
              </strong>

              <span>
                {error}
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
            >
              <X size={17} />
            </button>
          </div>
        )}


        {/* ====================================================
            CHAT CONTENT
            ==================================================== */}

        <section className="preparation-chat-content">

          {loadingConversation ? (
            <div className="preparation-loading-conversation">
              <Loader2
                size={28}
                className="preparation-spin"
              />

              <span>
                Loading conversation...
              </span>
            </div>
          ) : messages.length === 0 ? (
            renderEmptyState()
          ) : (
            <div className="preparation-messages-container">
              <div className="preparation-messages-inner">
                {messages.map(
                  renderMessage
                )}

                {sending && (
                  <div className="preparation-message-row preparation-assistant-row">
                    <div className="preparation-avatar preparation-ai-avatar">
                      <Sparkles
                        size={17}
                      />
                    </div>

                    <div className="preparation-message-content preparation-assistant-content">
                      <div className="preparation-message-bubble preparation-assistant-bubble preparation-thinking-bubble">
                        <div className="preparation-thinking">
                          <span className="preparation-thinking-dot" />
                          <span className="preparation-thinking-dot" />
                          <span className="preparation-thinking-dot" />

                          <span className="preparation-thinking-text">
                            {uploading
                              ? "Reading your document..."
                              : "Thinking..."}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div
                  ref={messagesEndRef}
                />
              </div>
            </div>
          )}


          {/* ==================================================
              COMPOSER
              ================================================== */}

          <div className="preparation-composer-wrapper">
            <div className="preparation-composer" role="group" aria-label="Preparation Chat message composer">

              {/* ----------------------------------------------
                   PENDING FILES
                   ---------------------------------------------- */}

              {pendingFiles.length >
                0 && (
                <div className="preparation-pending-files">
                  {pendingFiles.map(
                    (file) =>
                      renderDocumentCard(
                        file,
                        true
                      )
                  )}
                </div>
              )}


              <div className="preparation-composer-row">

                <button
                  type="button"
                  className="preparation-attach-button"
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                  disabled={sending}
                  title="Attach document"
                >
                  <Paperclip
                    size={20}
                  />
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  multiple
                  onChange={
                    handleFileInput
                  }
                  className="preparation-hidden-file-input"
                />


                <textarea
                  ref={textareaRef}
                  value={messageText}
                  onChange={
                    handleTextChange
                  }
                  onKeyDown={
                    handleKeyDown
                  }
                  placeholder={
                    pendingFiles.length
                      ? "Ask a question about your document..."
                      : "Message Preparation Chat..."
                  }
                  rows={1}
                  disabled={sending}
                  className="preparation-message-input"
                />


                <button
                  type="button"
                  className={`preparation-send-button ${
                    messageText.trim()
                      ? "preparation-send-active"
                      : ""
                  }`}
                  onClick={sendMessage}
                  disabled={
                    !messageText.trim() ||
                    sending
                  }
                  title="Send message"
                >
                  {sending ? (
                    <Loader2
                      size={19}
                      className="preparation-spin"
                    />
                  ) : (
                    <Send size={19} />
                  )}
                </button>
              </div>


              <div className="preparation-composer-footer">
                <span>
                  <Sparkles
                    size={13}
                  />
                  AI can make mistakes. Verify
                  important information.
                </span>

                <span>
                  Enter to send • Shift +
                  Enter for new line
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {showDeleteModal && (
        <div
          className="preparation-delete-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDeleteModal();
            }
          }}
          role="presentation"
        >
          <div
            className="preparation-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preparation-delete-title"
            aria-describedby="preparation-delete-description"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="preparation-delete-modal-close"
              onClick={closeDeleteModal}
              disabled={deletingConversation}
              aria-label="Close delete dialog"
            >
              <X size={18} />
            </button>

            <div className="preparation-delete-modal-icon">
              <AlertTriangle size={27} />
            </div>

            <div className="preparation-delete-modal-content">
              <span className="preparation-delete-modal-eyebrow">
                Delete conversation
              </span>

              <h2 id="preparation-delete-title">
                Delete this chat?
              </h2>

              <p id="preparation-delete-description">
                This will permanently delete
                {conversationToDelete?.title
                  ? ` “${conversationToDelete.title}”`
                  : " this conversation"}
                , including its messages and uploaded documents.
                This action cannot be undone.
              </p>
            </div>

            <div className="preparation-delete-modal-actions">
              <button
                type="button"
                className="preparation-delete-cancel"
                onClick={closeDeleteModal}
                disabled={deletingConversation}
              >
                Keep chat
              </button>

              <button
                type="button"
                className="preparation-delete-confirm"
                onClick={() =>
                  deleteConversation(
                    conversationToDelete?.id
                  )
                }
                disabled={deletingConversation}
              >
                {deletingConversation ? (
                  <>
                    <Loader2
                      size={17}
                      className="preparation-spin"
                    />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={17} />
                    Delete chat
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
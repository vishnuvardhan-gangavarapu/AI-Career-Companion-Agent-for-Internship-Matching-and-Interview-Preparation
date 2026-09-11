import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Trophy,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  Code2,
  FileText,
  GraduationCap,
  Lightbulb,
  Loader2,
  MessageCircle,
  Home,
  Menu,
  Mic,
  MicOff,
  Volume2,
  Rocket,
  Search,
  Send,
  ShieldCheck,
  Settings,
  Sparkles,
  Target,
  CalendarDays,
  TrendingUp,
  UserRound,
  X,
  Zap,
} from "lucide-react";

import "../styles/PreparationAgent.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const API = {
  overview: `${API_BASE_URL}/api/preparation/overview`,
  learningRecommendations: `${API_BASE_URL}/api/preparation/learning-recommendations`,
  chat: `${API_BASE_URL}/api/preparation/chat`,
  session: `${API_BASE_URL}/api/preparation/session`,
  question: `${API_BASE_URL}/api/preparation/question`,
  evaluate: `${API_BASE_URL}/api/preparation/answer/evaluate`,
  answer: `${API_BASE_URL}/api/preparation/answer`,
  complete: (sessionId) =>
    `${API_BASE_URL}/api/preparation/session/${sessionId}/complete`,
  sessionResult: (sessionId) =>
    `${API_BASE_URL}/api/preparation/session/${sessionId}/result`,
  mockInterview: `${API_BASE_URL}/api/preparation/mock-interview`,
  mockQuestion: `${API_BASE_URL}/api/preparation/mock-interview/question`,
  mockQuestionById: (questionId) =>
    `${API_BASE_URL}/api/preparation/mock-interview/question/${questionId}`,
  mockEvaluate: `${API_BASE_URL}/api/preparation/mock-interview/answer/evaluate`,
  mockAnswer: `${API_BASE_URL}/api/preparation/mock-interview/answer`,
  mockProgress: (sessionId) =>
    `${API_BASE_URL}/api/preparation/mock-interview/${sessionId}/progress`,
  mockComplete: (sessionId) =>
    `${API_BASE_URL}/api/preparation/mock-interview/${sessionId}/complete`,
  matchedInternships: `${API_BASE_URL}/api/internships/matched?min_match=0`,
  voiceInterview: `${API_BASE_URL}/api/preparation/voice-interview`,
  voiceQuestion: `${API_BASE_URL}/api/preparation/voice-interview/question`,
  voiceEvaluate: `${API_BASE_URL}/api/preparation/voice-interview/evaluate`,
  voiceAnswer: `${API_BASE_URL}/api/preparation/voice-interview/answer`,
  voiceQuestionById: (interviewId, questionId) =>
    `${API_BASE_URL}/api/preparation/voice-interview/${interviewId}/question/${questionId}`,
  voiceProgress: (interviewId) =>
    `${API_BASE_URL}/api/preparation/voice-interview/${interviewId}/progress`,
  voiceComplete: (interviewId, totalQuestions) =>
    `${API_BASE_URL}/api/preparation/voice-interview/${interviewId}/complete?total_questions=${encodeURIComponent(totalQuestions)}`,
};

const practiceStorageKey = "internmatch_preparation_active_session";
const mockInterviewStorageKey = "internmatch_mock_interview_active_session";
const mockInterviewResultStorageKey = "internmatch_mock_interview_result";
const voiceInterviewStorageKey = "internmatch_voice_interview_active_session";
const voiceInterviewResultStorageKey = "internmatch_voice_interview_result";

const getToken = () =>
  localStorage.getItem("access_token") ||
  localStorage.getItem("accessToken") ||
  localStorage.getItem("token") ||
  localStorage.getItem("authToken") ||
  "";

const firstString = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }

  return "";
};

const toArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === null || value === undefined || value === "") {
    return [];
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed;
      }

      return parsed ? [parsed] : [];
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  if (typeof value === "object") {
    return Object.values(value);
  }

  return [];
};

const itemText = (item) => {
  if (typeof item === "string" || typeof item === "number") {
    return String(item);
  }

  if (!item || typeof item !== "object") {
    return "";
  }

  return firstString(
    item.name,
    item.title,
    item.skill,
    item.role,
    item.position,
    item.job_title,
    item.degree,
    item.course,
    item.technology,
    item.company,
  );
};

const getErrorMessage = async (response) => {
  try {
    const data = await response.json();

    if (typeof data?.detail === "string") {
      return data.detail;
    }

    if (typeof data?.message === "string") {
      return data.message;
    }

    return "Something went wrong. Please try again.";
  } catch {
    return "Something went wrong. Please try again.";
  }
};

const getNumericValue = (...values) => {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== "") {
      const number = Number(value);

      if (Number.isFinite(number)) {
        return number;
      }
    }
  }

  return null;
};

const clampPercent = (value) => Math.min(100, Math.max(0, Number(value) || 0));

const compactMockInterviewResult = (result) => {
  const progress = result?.progress || {};
  const compactProgress = {
    average_score: progress.average_score,
    avg_score: progress.avg_score,
    score: progress.score,
    total_questions: progress.total_questions,
    total_answers: progress.total_answers,
    answers_count: progress.answers_count,
    evaluated_answers: progress.evaluated_answers,
    answered_questions: progress.answered_questions,
    completed_questions: progress.completed_questions,
    completion_rate: progress.completion_rate,
    readiness: progress.readiness,
    answer_evaluations: Array.isArray(progress.answer_evaluations)
      ? progress.answer_evaluations.map((item) => {
          const evaluation =
            item?.evaluation && typeof item.evaluation === "object"
              ? { ...item.evaluation }
              : item?.evaluation;

          if (evaluation && typeof evaluation === "object") {
            delete evaluation.raw_evaluation;
          }

          return {
            question_id: item?.question_id,
            question: item?.question,
            answer: item?.answer,
            score: item?.score,
            correctness: item?.correctness,
            technical_knowledge: item?.technical_knowledge,
            relevance: item?.relevance,
            completeness: item?.completeness,
            communication: item?.communication,
            reference_answer: item?.reference_answer,
            answer_verdict: item?.answer_verdict,
            verdict: item?.verdict,
            evaluation,
          };
        })
      : [],
  };

  return {
    progress: compactProgress,
    session: {
      id: result?.session?.id,
      total_questions: result?.session?.total_questions,
      status: result?.session?.status,
      category: result?.session?.category,
      target_role: result?.session?.target_role,
      difficulty: result?.session?.difficulty,
    },
  };
};

const initialMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm your AI Preparation Agent. I can analyze your resume profile, recommend suitable roles and internships, and help you prepare for technical and HR interviews.",
};

const getAuthSessionKey = () => {
  const token = getToken();
  if (!token) return "";

  // Prefer stable JWT identity/timestamps so a token refresh does not
  // accidentally create another chat during the same login session.
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(
        atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      const subject = firstString(
        payload.sub,
        payload.user_id,
        payload.id,
        "user",
      );
      const issuedAt = firstString(payload.iat, payload.auth_time, "");
      /*
       * `exp` changes when a token is refreshed. It must not be part of the
       * login-session identity or a normal token refresh would incorrectly
       * archive the current chat and create another one.
       */
      if (issuedAt) return `${subject}:${issuedAt}`;
      if (subject) return `subject:${subject}`;
    }
  } catch {
    // Fall through to a deterministic token fingerprint.
  }

  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = ((hash << 5) - hash + token.charCodeAt(index)) | 0;
  }
  return `token:${Math.abs(hash)}`;
};

function PreparationAgent() {
  const navigate = useNavigate();
  const location = useLocation();

  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const [overviewRefreshKey, setOverviewRefreshKey] = useState(0);
  const [learningRecommendations, setLearningRecommendations] = useState(null);
  const [learningRecommendationsLoading, setLearningRecommendationsLoading] =
    useState(false);
  const [learningRecommendationsError, setLearningRecommendationsError] =
    useState("");
  const [roadmapCompleted, setRoadmapCompleted] = useState(() => new Set());

  const [messages, setMessages] = useState([initialMessage]);
  const [message, setMessage] = useState("");
  const [chatSessions, setChatSessions] = useState([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [chatHistoryOpen, setChatHistoryOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [deleteChatConfirmation, setDeleteChatConfirmation] = useState(null);
  const [practiceMode, setPracticeMode] = useState(false);
  const [mockInterviewMode, setMockInterviewMode] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  const [session, setSession] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answerText, setAnswerText] = useState("");
  const [evaluation, setEvaluation] = useState(null);
  const [practiceResult, setPracticeResult] = useState(null);
  const [practiceResultLoading, setPracticeResultLoading] = useState(false);

  const [sessionLoading, setSessionLoading] = useState(false);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);

  const [mockSession, setMockSession] = useState(null);
  const [mockQuestion, setMockQuestion] = useState(null);
  const [mockAnswer, setMockAnswer] = useState("");
  const [mockEvaluation, setMockEvaluation] = useState(null);
  const [mockAnswerSaved, setMockAnswerSaved] = useState(false);
  const [mockProgress, setMockProgress] = useState(null);
  const [mockSessionLoading, setMockSessionLoading] = useState(false);
  const [mockQuestionLoading, setMockQuestionLoading] = useState(false);
  const [mockEvaluationLoading, setMockEvaluationLoading] = useState(false);
  const [mockSaveLoading, setMockSaveLoading] = useState(false);
  const [mockCompleteLoading, setMockCompleteLoading] = useState(false);
  const [mockVoiceListening, setMockVoiceListening] = useState(false);
  const [mockError, setMockError] = useState("");
  const [mockInterviewResult, setMockInterviewResult] = useState(null);
  const [mockTotalQuestions, setMockTotalQuestions] = useState(10);
  const [mockSubmittedQuestionIds, setMockSubmittedQuestionIds] = useState(
    () => new Set(),
  );
  const [expandedMockResultIds, setExpandedMockResultIds] = useState(
    () => new Set(),
  );
  const [selectedTopicPerformance, setSelectedTopicPerformance] =
    useState(null);

  // Phase 3 Step 10 — Voice Interview state.
  const [voiceInterviewMode, setVoiceInterviewMode] = useState(false);
  const [voiceSession, setVoiceSession] = useState(null);
  const [voiceQuestion, setVoiceQuestion] = useState(null);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceSpeechSupported, setVoiceSpeechSupported] = useState(false);
  const [voiceEvaluating, setVoiceEvaluating] = useState(false);
  const [voiceSaving, setVoiceSaving] = useState(false);
  const [voiceCompleting, setVoiceCompleting] = useState(false);
  const [voiceProgress, setVoiceProgress] = useState(null);
  const [voiceEvaluation, setVoiceEvaluation] = useState(null);
  const [voiceError, setVoiceError] = useState("");
  const [voiceInterviewResult, setVoiceInterviewResult] = useState(null);
  const [voiceTotalQuestions, setVoiceTotalQuestions] = useState(10);
  const [voiceAnswers, setVoiceAnswers] = useState([]);
  const [voiceQuestionLoading, setVoiceQuestionLoading] = useState(false);

  const [practiceError, setPracticeError] = useState("");

  const [sessionType, setSessionType] = useState("practice");
  const [category, setCategory] = useState("mixed");
  const [difficulty, setDifficulty] = useState("medium");
  const [targetRole, setTargetRole] = useState("");

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const mockQuestionRequestRef = useRef(0);
  const mockGenerationSessionRef = useRef(0);
  const mockVoiceRecognitionRef = useRef(null);
  const mockVoiceFinalTranscriptRef = useRef("");
  const voiceRecognitionRef = useRef(null);
  const voiceFinalTranscriptRef = useRef("");
  const voiceQuestionRequestRef = useRef(0);
  const voiceGenerationSessionRef = useRef(0);
  const practiceTopicIndexRef = useRef(0);
  const roadmapForcedTopicRef = useRef("");
  const roadmapActiveItemIdRef = useRef("");

  useEffect(() => {
    const authKey = getAuthSessionKey();
    if (!authKey) return;

    try {
      const stored = JSON.parse(
        localStorage.getItem(`internmatch_preparation_roadmap_${authKey}`) ||
          "[]",
      );
      if (Array.isArray(stored)) {
        setRoadmapCompleted(new Set(stored.map(String)));
      }
    } catch (error) {
      console.warn("Preparation roadmap progress restore error:", error);
    }
  }, []);

  const toggleRoadmapItem = (roadmapId) => {
    const id = String(roadmapId);
    setRoadmapCompleted((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);

      const authKey = getAuthSessionKey();
      if (authKey) {
        try {
          localStorage.setItem(
            `internmatch_preparation_roadmap_${authKey}`,
            JSON.stringify([...next]),
          );
        } catch (error) {
          console.warn("Preparation roadmap progress save error:", error);
        }
      }
      return next;
    });
  };

  useEffect(() => {
    const page = document.querySelector(".preparation-agent-page");
    if (!page) return undefined;

    let frame = 0;
    const handlePointerMove = (event) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const rect = page.getBoundingClientRect();
        page.style.setProperty(
          "--pa-pointer-x",
          `${event.clientX - rect.left}px`,
        );
        page.style.setProperty(
          "--pa-pointer-y",
          `${event.clientY - rect.top}px`,
        );
        frame = 0;
      });
    };

    const handlePointerLeave = () => {
      page.style.setProperty("--pa-pointer-x", "50%");
      page.style.setProperty("--pa-pointer-y", "50%");
    };

    page.addEventListener("pointermove", handlePointerMove, { passive: true });
    page.addEventListener("pointerleave", handlePointerLeave, {
      passive: true,
    });

    return () => {
      page.removeEventListener("pointermove", handlePointerMove);
      page.removeEventListener("pointerleave", handlePointerLeave);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const requestJson = async (url, options = {}) => {
    const token = getToken();

    if (!token) {
      throw new Error("Your session has expired. Please log in again.");
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });

    if (response.status === 401) {
      throw new Error("Your session has expired. Please log in again.");
    }

    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }

    return response.json();
  };

  // Browser voice capability. Audio is not uploaded or stored; only the
  // browser-generated transcript is sent to the existing backend.
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSpeechSupported(Boolean(SpeechRecognition));

    return () => {
      try {
        voiceRecognitionRef.current?.stop();
      } catch {
        // Recognition may already be stopped.
      }
      voiceRecognitionRef.current = null;
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (mockInterviewMode && !voiceInterviewMode) {
      if (voiceTranscript) setMockAnswer(voiceTranscript.slice(0, 10000));
      if (voiceError) setMockError(voiceError);
      setMockVoiceListening(voiceListening);
    }
  }, [
    mockInterviewMode,
    voiceInterviewMode,
    voiceTranscript,
    voiceError,
    voiceListening,
  ]);

  useEffect(() => {
    const loadOverview = async () => {
      setOverviewLoading(true);
      setOverviewError("");

      try {
        const result = await requestJson(API.overview, {
          method: "GET",
        });

        if (!result?.success) {
          throw new Error(
            result?.message || "Unable to load preparation overview.",
          );
        }

        const overviewData = result.data || {};

        /*
         * Normalize recommendation records at the frontend boundary.
         * The preparation service currently returns `internship_id` from
         * the real Internship database row. Keeping both fields makes the
         * rest of this component resilient to older/newer response shapes.
         */
        if (Array.isArray(overviewData.recommended_internships)) {
          overviewData.recommended_internships =
            overviewData.recommended_internships.map((item) => {
              if (!item || typeof item !== "object") {
                return item;
              }

              const resolvedId = firstString(
                item.id,
                item.internship_id,
                item.internshipId,
                item.internshipID,
                item.pk,
                item.uuid,
                item._id,
                item.internship?.id,
                item.internship?.internship_id,
                item.internship?.internshipId,
              );

              return resolvedId
                ? { ...item, id: resolvedId, internship_id: resolvedId }
                : item;
            });
        }

        /*
         * The Preparation overview and the existing Internship page use two
         * different recommendation paths. If the overview has no internship
         * records, use the application's existing resume-matched endpoint as
         * the fallback instead of showing a false "No recommendations yet"
         * state. `min_match=0` intentionally lets the existing backend return
         * every available internship with its calculated match percentage.
         */
        if (
          !Array.isArray(overviewData.recommended_internships) ||
          overviewData.recommended_internships.length === 0
        ) {
          try {
            const matchedResult = await requestJson(API.matchedInternships, {
              method: "GET",
            });

            const matchedPayload = matchedResult?.data || matchedResult || {};
            const fallbackInternships =
              matchedPayload?.internships ||
              matchedPayload?.matched_internships ||
              matchedPayload?.recommended_internships ||
              [];

            if (
              Array.isArray(fallbackInternships) &&
              fallbackInternships.length > 0
            ) {
              overviewData.recommended_internships = fallbackInternships.map(
                (item) => {
                  if (!item || typeof item !== "object") {
                    return item;
                  }

                  const resolvedId = firstString(
                    item.id,
                    item.internship_id,
                    item.internshipId,
                    item.internshipID,
                    item.pk,
                    item.uuid,
                    item._id,
                  );

                  return resolvedId
                    ? { ...item, id: resolvedId, internship_id: resolvedId }
                    : item;
                },
              );
            }
          } catch (fallbackError) {
            console.warn(
              "Internship recommendation fallback failed:",
              fallbackError,
            );
          }
        }

        if (overviewData.resume_analyzed === false) {
          navigate("/resume", { replace: true });
          return;
        }

        setOverview(overviewData);
      } catch (error) {
        console.error("Preparation overview error:", error);

        if (
          error.message?.toLowerCase().includes("resume") &&
          error.message?.toLowerCase().includes("analy")
        ) {
          navigate("/resume", { replace: true });
          return;
        }

        setOverviewError(
          error.message || "Unable to load preparation overview.",
        );
      } finally {
        setOverviewLoading(false);
      }
    };

    loadOverview();
  }, [navigate, overviewRefreshKey]);

  useEffect(() => {
    const loadLearningRecommendations = async () => {
      if (!overview) {
        return;
      }

      setLearningRecommendationsLoading(true);
      setLearningRecommendationsError("");

      try {
        const result = await requestJson(API.learningRecommendations, {
          method: "GET",
        });

        if (!result?.success || !result?.data) {
          throw new Error(
            result?.message || "Unable to load AI learning recommendations.",
          );
        }

        setLearningRecommendations(result.data);
      } catch (error) {
        console.error("AI learning recommendations error:", error);
        setLearningRecommendationsError(
          error.message || "Unable to load AI learning recommendations.",
        );
      } finally {
        setLearningRecommendationsLoading(false);
      }
    };

    loadLearningRecommendations();
  }, [overview, overviewRefreshKey]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get("mode");

    if (mode === "practice-result") {
      setPracticeMode(false);
      setMockInterviewMode(false);
      setVoiceInterviewMode(false);
      setPracticeResultLoading(true);

      let storedResult = null;
      try {
        storedResult = JSON.parse(
          sessionStorage.getItem("internmatch_preparation_practice_result") ||
            "null",
        );
      } catch (error) {
        console.warn("Practice result restore error:", error);
      }

      const initialResult =
        location.state?.practiceResult || storedResult || null;
      setPracticeResult(initialResult);
      const resultSessionId =
        location.state?.practiceSessionId || initialResult?.session_id;

      if (resultSessionId) {
        requestJson(API.sessionResult(resultSessionId), { method: "GET" })
          .then((fresh) => {
            if (fresh?.success && fresh.data) {
              setPracticeResult(fresh.data);
              try {
                sessionStorage.setItem(
                  "internmatch_preparation_practice_result",
                  JSON.stringify(fresh.data),
                );
              } catch {}
            }
          })
          .catch((error) =>
            console.warn("Practice result refresh failed:", error),
          )
          .finally(() => setPracticeResultLoading(false));
      } else {
        setPracticeResultLoading(false);
      }
      return;
    }

    if (mode === "practice") {
      setPracticeMode(true);
      roadmapActiveItemIdRef.current = "";
      setMockInterviewMode(false);

      try {
        const stored = JSON.parse(
          sessionStorage.getItem(practiceStorageKey) || "null",
        );

        if (stored?.id) {
          setSession(stored);
        }
      } catch (error) {
        console.warn("Practice session restore error:", error);
      }

      return;
    }

    if (mode === "voice-interview-result") {
      setPracticeMode(false);
      setMockInterviewMode(false);
      setVoiceInterviewMode(false);
      setSession(null);
      setCurrentQuestion(null);
      setEvaluation(null);
      setAnswerText("");
      setPracticeError("");
      setMockQuestion(null);
      setMockAnswer("");
      setMockEvaluation(null);
      setMockError("");
      setVoiceQuestion(null);
      setVoiceTranscript("");
      setVoiceEvaluation(null);
      setVoiceError("");

      const routeResult = location.state?.voiceInterviewCompleted
        ? {
            progress: location.state.progress || {},
            session: location.state.session || null,
            answers: location.state.answers || [],
          }
        : null;

      let initialResult = routeResult;

      try {
        const storedResult = JSON.parse(
          sessionStorage.getItem(voiceInterviewResultStorageKey) || "null",
        );
        initialResult = routeResult || storedResult || null;
      } catch (error) {
        console.warn("Voice interview result restore error:", error);
      }

      setVoiceInterviewResult(initialResult);

      // Re-read persisted answers/evaluations so a refresh never loses the
      // detailed report that is stored in AIChatHistory.
      const resultInterviewId =
        initialResult?.session?.id ||
        initialResult?.session?.interview_id ||
        initialResult?.progress?.interview_id;

      if (resultInterviewId) {
        requestJson(API.voiceProgress(resultInterviewId), { method: "GET" })
          .then((freshResult) => {
            if (!freshResult?.success || !freshResult?.data) return;

            const fresh = freshResult.data;
            setVoiceInterviewResult((previous) => ({
              ...(previous || initialResult || {}),
              progress: {
                ...((previous || initialResult || {}).progress || {}),
                ...fresh,
              },
              session: {
                ...((previous || initialResult || {}).session || {}),
                id: resultInterviewId,
                status: "completed",
              },
              answers:
                Array.isArray(fresh.answers) && fresh.answers.length
                  ? fresh.answers
                  : (previous || initialResult || {}).answers || [],
            }));
          })
          .catch((error) => {
            console.warn("Final voice report refresh failed:", error);
          });
      }

      return;
    }

    if (mode === "voice-interview") {
      setPracticeMode(false);
      setMockInterviewMode(false);
      setVoiceInterviewMode(true);
      setSession(null);
      setCurrentQuestion(null);
      setEvaluation(null);
      setAnswerText("");
      setPracticeError("");
      setMockQuestion(null);
      setMockAnswer("");
      setMockEvaluation(null);
      setMockError("");
      setVoiceError("");

      try {
        const stored = JSON.parse(
          sessionStorage.getItem(voiceInterviewStorageKey) || "null",
        );

        if (stored?.id) {
          setVoiceSession((previous) =>
            previous?.id === stored.id ? previous : stored,
          );
          setVoiceTotalQuestions(Number(stored.total_questions) || 10);
        }
      } catch (error) {
        console.warn("Voice interview session restore error:", error);
      }

      return;
    }

    if (mode === "mock-interview-result") {
      setPracticeMode(false);
      setMockInterviewMode(false);
      setSession(null);
      setCurrentQuestion(null);
      setEvaluation(null);
      setAnswerText("");
      setPracticeError("");
      setMockQuestion(null);
      setMockAnswer("");
      setMockEvaluation(null);
      setMockError("");

      const routeResult = location.state?.mockInterviewCompleted
        ? {
            progress: location.state.progress || {},
            session: location.state.session || null,
          }
        : null;

      let initialResult = routeResult;

      try {
        const storedResult = JSON.parse(
          sessionStorage.getItem(mockInterviewResultStorageKey) || "null",
        );
        initialResult = routeResult || storedResult || null;
      } catch (error) {
        console.warn("Mock interview result restore error:", error);
      }

      setMockInterviewResult(initialResult);

      // IMPORTANT: always re-read the final report from the backend when the
      // result page opens. This fixes stale sessionStorage/route-state results
      // and makes refresh/reopen show exactly what is persisted in the DB.
      const resultSessionId =
        initialResult?.session?.id ||
        initialResult?.session?.session_id ||
        initialResult?.progress?.session_id;

      if (resultSessionId) {
        requestJson(API.mockProgress(resultSessionId), { method: "GET" })
          .then((freshResult) => {
            if (!freshResult?.success || !freshResult?.data) return;

            setMockInterviewResult((previous) => ({
              ...(previous || initialResult || {}),
              progress: {
                ...((previous || initialResult || {}).progress || {}),
                ...freshResult.data,
              },
              session: {
                ...((previous || initialResult || {}).session || {}),
                id: resultSessionId,
                status: "completed",
              },
            }));
          })
          .catch((error) => {
            console.warn("Final mock report refresh failed:", error);
          });
      }

      return;
    }

    if (mode === "mock-interview") {
      stopVoiceListening();
      window.speechSynthesis?.cancel();
      setVoiceTranscript("");
      setVoiceError("");
      setPracticeMode(false);
      setMockInterviewMode(true);
      setSession(null);
      setCurrentQuestion(null);
      setEvaluation(null);
      setAnswerText("");
      setPracticeError("");
      setMockError("");

      // Keep the in-memory mock state during SPA navigation. Only restore
      // from sessionStorage when there is no active session in React state.
      try {
        const stored = JSON.parse(
          sessionStorage.getItem(mockInterviewStorageKey) || "null",
        );

        if (stored?.id) {
          setMockSession((previous) =>
            previous?.id === stored.id ? previous : stored,
          );
          setMockTotalQuestions(Number(stored.total_questions) || 10);
        }
      } catch (error) {
        console.warn("Mock interview session restore error:", error);
      }

      return;
    }

    // The preparation dashboard must never keep interview questions after
    // the intern leaves a dedicated interview view.
    setPracticeMode(false);
    setMockInterviewMode(false);
    setSession(null);
    setCurrentQuestion(null);
    setEvaluation(null);
    setAnswerText("");
    setPracticeError("");
    setMockSession(null);
    setMockQuestion(null);
    setMockAnswer("");
    setMockEvaluation(null);
    setMockAnswerSaved(false);
    setMockSubmittedQuestionIds(new Set());
    setExpandedMockResultIds(new Set());
    setMockProgress(null);
    setMockError("");
    setMockInterviewResult(null);
    setVoiceInterviewMode(false);
    setVoiceSession(null);
    setVoiceQuestion(null);
    setVoiceTranscript("");
    setVoiceEvaluation(null);
    setVoiceProgress(null);
    setVoiceError("");
    setVoiceAnswers([]);
    setVoiceInterviewResult(null);
    try {
      voiceRecognitionRef.current?.stop();
    } catch {
      // Recognition may already be stopped.
    }
    voiceRecognitionRef.current = null;
  }, [location.search]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, chatLoading]);

  const candidate = overview?.candidate || {};
  const profile = overview?.profile || {};

  let storedUser = {};
  try {
    storedUser =
      JSON.parse(
        localStorage.getItem("user") ||
          localStorage.getItem("userData") ||
          localStorage.getItem("loggedInUser") ||
          "{}",
      ) || {};
  } catch {
    storedUser = {};
  }

  const candidateName = firstString(
    candidate.full_name,
    candidate.name,
    candidate.user?.full_name,
    candidate.user?.name,
    candidate.profile?.full_name,
    candidate.profile?.name,
    profile.full_name,
    profile.name,
    storedUser.full_name,
    storedUser.fullName,
    storedUser.name,
    storedUser.username,
    "Intern",
  );

  const candidateEmail = firstString(
    candidate.email,
    profile.email,
    "Profile connected",
  );

  const todayLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());

  useEffect(() => {
    if (!candidateEmail) return;

    try {
      const storageKey = `internmatch_preparation_chats_${candidateEmail}`;
      const loginKeyStorage = `internmatch_preparation_login_key_${candidateEmail}`;
      const activeKeyStorage = `internmatch_preparation_active_chat_${candidateEmail}`;
      const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
      const previousLoginKey = localStorage.getItem(loginKeyStorage) || "";
      const currentLoginKey = getAuthSessionKey();
      const validChats = Array.isArray(stored) ? stored : [];

      // A new authentication session must always start a fresh chat.
      // Previous chats remain untouched in the same history collection.
      // This makes logout -> login behave like a new preparation-agent
      // conversation without deleting the candidate's previous chats.
      if (currentLoginKey && previousLoginKey !== currentLoginKey) {
        const newChat = {
          id: `prep-chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: "New preparation chat",
          createdAt: new Date().toISOString(),
          messages: [initialMessage],
        };
        const archivedChats = validChats.filter((chat) => chat && chat.id);
        const nextChats = [newChat, ...archivedChats];

        setChatSessions(nextChats);
        setActiveChatId(newChat.id);
        setMessages([initialMessage]);
        localStorage.setItem(storageKey, JSON.stringify(nextChats));
        localStorage.setItem(loginKeyStorage, currentLoginKey);
        localStorage.setItem(activeKeyStorage, newChat.id);
        return;
      }

      if (validChats.length) {
        const savedActiveId = localStorage.getItem(activeKeyStorage);
        const activeChat =
          validChats.find((chat) => chat.id === savedActiveId) || validChats[0];
        setChatSessions(validChats);
        setActiveChatId(activeChat.id);
        setMessages(
          Array.isArray(activeChat.messages) && activeChat.messages.length
            ? activeChat.messages
            : [initialMessage],
        );
        if (currentLoginKey) {
          localStorage.setItem(loginKeyStorage, currentLoginKey);
        }
        localStorage.setItem(activeKeyStorage, activeChat.id);
        return;
      }

      const firstChat = {
        id: `prep-chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: "New preparation chat",
        createdAt: new Date().toISOString(),
        messages: [initialMessage],
      };
      setChatSessions([firstChat]);
      setActiveChatId(firstChat.id);
      setMessages([initialMessage]);
      localStorage.setItem(storageKey, JSON.stringify([firstChat]));
      if (currentLoginKey) {
        localStorage.setItem(loginKeyStorage, currentLoginKey);
      }
      localStorage.setItem(activeKeyStorage, firstChat.id);
    } catch (error) {
      console.warn("Preparation chat history load error:", error);
    }
  }, [candidateEmail]);

  useEffect(() => {
    if (!candidateEmail || !activeChatId) return;

    setChatSessions((previous) => {
      const updated = previous.map((chat) =>
        chat.id === activeChatId ? { ...chat, messages } : chat,
      );

      try {
        localStorage.setItem(
          `internmatch_preparation_chats_${candidateEmail}`,
          JSON.stringify(updated),
        );
      } catch (error) {
        console.warn("Preparation chat history save error:", error);
      }

      return updated;
    });
  }, [messages, activeChatId, candidateEmail]);

  const createNewChat = () => {
    const newChat = {
      id: `prep-chat-${Date.now()}`,
      title: "New preparation chat",
      createdAt: new Date().toISOString(),
      messages: [initialMessage],
    };

    setChatSessions((previous) => [newChat, ...previous]);
    setActiveChatId(newChat.id);
    setMessages([initialMessage]);
    if (candidateEmail) {
      localStorage.setItem(
        `internmatch_preparation_active_chat_${candidateEmail}`,
        newChat.id,
      );
    }
    setChatHistoryOpen(false);
  };

  const openChat = (chat) => {
    setActiveChatId(chat.id);
    if (candidateEmail) {
      localStorage.setItem(
        `internmatch_preparation_active_chat_${candidateEmail}`,
        chat.id,
      );
    }
    setMessages(
      Array.isArray(chat.messages) && chat.messages.length
        ? chat.messages
        : [initialMessage],
    );
    setChatHistoryOpen(false);
  };

  const requestDeleteChat = (chatId) => {
    const chatToDelete = chatSessions.find((chat) => chat.id === chatId);
    if (!chatToDelete) return;
    setDeleteChatConfirmation({
      id: chatId,
      title: chatToDelete.title || "this preparation chat",
    });
  };

  const cancelDeleteChat = () => {
    setDeleteChatConfirmation(null);
  };

  const confirmDeleteChat = () => {
    const chatId = deleteChatConfirmation?.id;
    if (!chatId) return;

    const remaining = chatSessions.filter((chat) => chat.id !== chatId);

    setDeleteChatConfirmation(null);

    if (!remaining.length) {
      createNewChat();
      return;
    }

    setChatSessions(remaining);

    if (chatId === activeChatId) {
      setActiveChatId(remaining[0].id);
      setMessages(
        remaining[0].messages?.length
          ? remaining[0].messages
          : [initialMessage],
      );
    }
  };

  const technicalSkills = toArray(
    candidate.technical_skills ??
      profile.technical_skills ??
      candidate.skills?.technical ??
      profile.skills?.technical ??
      [],
  )
    .map(itemText)
    .filter(Boolean);

  const softSkills = toArray(
    candidate.soft_skills ??
      profile.soft_skills ??
      candidate.skills?.soft ??
      profile.skills?.soft ??
      [],
  )
    .map(itemText)
    .filter(Boolean);

  const education = toArray(candidate.education ?? profile.education ?? []);

  const experience = toArray(
    candidate.work_experience ??
      candidate.experience ??
      profile.work_experience ??
      profile.experience ??
      [],
  );

  const projects = toArray(candidate.projects ?? profile.projects ?? []);

  const recommendedRoles = toArray(
    overview?.recommended_roles ??
      overview?.roles ??
      overview?.role_recommendations ??
      [],
  );

  const recommendedInternships = toArray(
    overview?.recommended_internships ??
      overview?.internships ??
      overview?.internship_recommendations ??
      [],
  );

  const progress = overview?.progress || {};

  // Phase 4 Step 3 — Personalized preparation dashboard data.
  // The backend now exposes a canonical preparation_profile, weak-topic
  // analysis, roadmap and adaptive progress. Normalize those fields here so
  // the UI remains resilient to older/newer response shapes.
  const preparationProfile =
    overview?.preparation_profile ||
    candidate?.preparation_profile ||
    overview?.personalization ||
    {};

  const preparationRoadmap = overview?.roadmap || {};
  const weakTopics = toArray(
    overview?.weak_topics ??
      preparationRoadmap?.weak_topics ??
      progress?.weak_topics ??
      [],
  )
    .filter((item) => item !== null && item !== undefined)
    .map((item) => {
      if (typeof item === "string") {
        return { topic: item, priority: "medium" };
      }
      return item;
    });

  const getWeakTopicName = (item) =>
    firstString(
      item?.topic,
      item?.name,
      item?.skill,
      item?.title,
      "Focus area",
    );

  const getWeakTopicScore = (item) =>
    getNumericValue(item?.average_score, item?.score, item?.avg_score);

  const getWeakTopicAttempts = (item) =>
    getNumericValue(item?.attempts, item?.count, item?.questions_attempted) ??
    0;

  const profileCompleteness = clampPercent(
    getNumericValue(
      preparationProfile?.profile_completeness,
      preparationProfile?.completeness,
      overview?.profile_completeness,
      0,
    ),
  );

  const preparationExperienceLevel = firstString(
    preparationProfile?.experience_level,
    candidate?.experience_level,
    profile?.experience_level,
    experience.length ? "Experienced" : "",
  );

  const estimatedExperienceYears =
    getNumericValue(
      preparationProfile?.estimated_experience_years,
      candidate?.estimated_experience_years,
      profile?.estimated_experience_years,
    ) ?? 0;

  const preparationTargetRole = firstString(
    preparationProfile?.target_role,
    preparationRoadmap?.best_fit_role,
    targetRole,
    recommendedRoles?.[0]?.role,
    recommendedRoles?.[0]?.title,
    recommendedRoles?.[0]?.name,
    "",
  );

  const preparationRoleMatch = clampPercent(
    getNumericValue(
      preparationProfile?.role_match_percentage,
      preparationProfile?.role_match,
      preparationProfile?.match_percentage,
      recommendedRoles?.[0]?.match_percentage,
      recommendedRoles?.[0]?.match_score,
      recommendedRoles?.[0]?.score,
      recommendedRoles?.[0]?.percentage,
      0,
    ),
  );

  const missingSkills = toArray(
    preparationProfile?.missing_skills ??
      candidate?.missing_skills ??
      profile?.missing_skills ??
      [],
  )
    .map(itemText)
    .filter(Boolean);

  const matchedSkills = toArray(
    preparationProfile?.matched_skills ??
      candidate?.matched_skills ??
      profile?.matched_skills ??
      [],
  )
    .map(itemText)
    .filter(Boolean);

  const focusTopics = toArray(
    preparationProfile?.focus_topics ??
      preparationProfile?.priority_topics ??
      [],
  )
    .map(itemText)
    .filter(Boolean);

  const practiceTopics = toArray(
    preparationProfile?.practice_topics ??
      preparationProfile?.available_topics ??
      [],
  )
    .map(itemText)
    .filter(Boolean);

  const recentAverageScore = getNumericValue(
    progress?.recent_average_score,
    progress?.recent_avg_score,
  );

  const previousAverageScore = getNumericValue(
    progress?.previous_average_score,
    progress?.previous_avg_score,
  );

  const preparationAverageScore = getNumericValue(
    progress?.average_score,
    progress?.avg_score,
    progress?.score,
  );

  const preparationTrend = firstString(
    progress?.trend,
    previousAverageScore !== null &&
      preparationAverageScore !== null &&
      preparationAverageScore > previousAverageScore
      ? "improving"
      : previousAverageScore !== null &&
          preparationAverageScore !== null &&
          preparationAverageScore < previousAverageScore
        ? "needs attention"
        : "building",
  );

  const readiness = firstString(progress?.readiness, "Getting started");

  const adaptiveStrategy = preparationRoadmap?.adaptive_strategy || {};
  const adaptiveDifficulty = (() => {
    const score = weakTopics.length
      ? getWeakTopicScore(weakTopics[0])
      : preparationAverageScore;

    if (score === null) {
      return firstString(
        overview?.mock_interview?.recommended_difficulty,
        "medium",
      );
    }

    if (score < 5) return "easy";
    if (score >= 7.5) return "hard";
    return "medium";
  })();

  const adaptiveReason = (() => {
    const score = weakTopics.length
      ? getWeakTopicScore(weakTopics[0])
      : preparationAverageScore;

    if (score === null) {
      return "Start practicing to let the agent learn your current level.";
    }
    if (score < 5) {
      return `Your recent performance is ${score.toFixed(1)}/10, so the next questions will focus on building confidence.`;
    }
    if (score >= 7.5) {
      return `Your performance is ${score.toFixed(1)}/10, so the agent can challenge you with harder questions.`;
    }
    return `Your performance is ${score.toFixed(1)}/10, so the agent will maintain a balanced difficulty.`;
  })();

  const topWeakTopics = weakTopics.slice(0, 5);

  const topicPerformance = toArray(progress?.topic_progress)
    .filter((item) => item !== null && item !== undefined)
    .map((item) => {
      const topic = firstString(
        item?.name,
        item?.topic,
        item?.skill,
        item?.title,
        "General",
      );
      const score = clampPercent(
        (getNumericValue(item?.average_score, item?.score, item?.avg_score) ??
          0) * 10,
      );
      const attempts = Math.max(
        0,
        Math.round(
          getNumericValue(
            item?.attempts,
            item?.count,
            item?.questions_attempted,
          ) ?? 0,
        ),
      );
      const level =
        score >= 75 ? "Strong" : score >= 50 ? "Average" : "Needs Improvement";
      return { topic, score, attempts, level };
    })
    .sort((a, b) => a.score - b.score);

  const topicPerformanceVisible = topicPerformance.slice(0, 8);

  const aiRecommendationItems = toArray(
    learningRecommendations?.recommendations ?? [],
  ).filter((item) => item !== null && item !== undefined);

  const aiDailyPlan = toArray(learningRecommendations?.daily_plan ?? []).filter(
    (item) => item !== null && item !== undefined,
  );

  // Phase 5 — Personalized Learning Roadmap.
  // Build the roadmap from the existing AI recommendations, weak-topic
  // analysis, topic performance and the AI daily plan. No new backend data
  // source is required, so the existing preparation API remains untouched.
  const personalizedRoadmap = (() => {
    const recommendationItems = aiRecommendationItems
      .slice(0, 5)
      .map((item, index) => {
        const topic = firstString(
          item?.topic,
          item?.name,
          item?.title,
          `Focus ${index + 1}`,
        );
        const priority = firstString(item?.priority, "medium").toLowerCase();
        const difficulty = firstString(
          item?.difficulty,
          "medium",
        ).toLowerCase();
        const matchingTopic = topicPerformance.find(
          (performance) =>
            performance.topic.toLowerCase() === topic.toLowerCase(),
        );
        const weakMatch = weakTopics.find(
          (weak) =>
            getWeakTopicName(weak).toLowerCase() === topic.toLowerCase(),
        );
        return {
          id: `recommendation-${topic.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          day: `Priority ${index + 1}`,
          topic,
          priority,
          difficulty,
          score:
            matchingTopic?.score ??
            (getWeakTopicScore(weakMatch) !== null
              ? getWeakTopicScore(weakMatch) * 10
              : null),
          attempts: matchingTopic?.attempts ?? getWeakTopicAttempts(weakMatch),
          reason: firstString(
            item?.reason,
            weakMatch?.reason,
            "Build this skill with focused interview practice.",
          ),
          action: firstString(
            item?.action,
            `Study the core concepts of ${topic} and practice role-relevant questions.`,
          ),
          practiceCount: Math.max(3, Number(item?.practice_count) || 5),
          tasks: [],
        };
      });

    const usedTopics = new Set(
      recommendationItems.map((item) => item.topic.toLowerCase()),
    );
    weakTopics.slice(0, 5).forEach((item) => {
      const topic = getWeakTopicName(item);
      if (
        !topic ||
        usedTopics.has(topic.toLowerCase()) ||
        recommendationItems.length >= 5
      )
        return;
      const score = getWeakTopicScore(item);
      recommendationItems.push({
        id: `weak-${topic.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        day: `Priority ${recommendationItems.length + 1}`,
        topic,
        priority: firstString(
          item?.priority,
          score !== null && score < 5 ? "high" : "medium",
        ).toLowerCase(),
        difficulty: score !== null && score < 5 ? "easy" : "medium",
        score: score === null ? null : score * 10,
        attempts: getWeakTopicAttempts(item),
        reason: firstString(
          item?.reason,
          `Your current performance shows ${topic} needs more attention.`,
        ),
        action: `Review the fundamentals and practice ${topic} with targeted interview questions.`,
        practiceCount: 5,
        tasks: [],
      });
      usedTopics.add(topic.toLowerCase());
    });

    const dailyItems = aiDailyPlan.slice(0, 5).map((day, index) => {
      const focus = firstString(
        day?.focus,
        recommendationItems[index]?.topic,
        "Interview preparation",
      );
      const matched =
        recommendationItems.find(
          (item) => item.topic.toLowerCase() === focus.toLowerCase(),
        ) || recommendationItems[index];
      return {
        id: `day-${index + 1}-${focus.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        day: firstString(day?.day, `Day ${index + 1}`),
        topic: focus,
        priority: matched?.priority || (index === 0 ? "high" : "medium"),
        difficulty: matched?.difficulty || adaptiveDifficulty,
        score: matched?.score ?? null,
        attempts: matched?.attempts ?? 0,
        reason:
          matched?.reason ||
          "Follow this focused step to keep your preparation moving forward.",
        action:
          matched?.action || `Complete the suggested ${focus} learning tasks.`,
        practiceCount: matched?.practiceCount || 5,
        tasks: toArray(day?.tasks).map(itemText).filter(Boolean).slice(0, 3),
      };
    });

    if (dailyItems.length) return dailyItems;
    return recommendationItems.slice(0, 5).map((item, index) => ({
      ...item,
      day: `Day ${index + 1}`,
    }));
  })();

  const roadmapCompletedCount = personalizedRoadmap.filter((item) =>
    roadmapCompleted.has(item.id),
  ).length;
  const roadmapCompletion = personalizedRoadmap.length
    ? Math.round((roadmapCompletedCount / personalizedRoadmap.length) * 100)
    : 0;

  const getTopicPerformanceDetails = (item) => {
    const score = Number(item?.score) || 0;
    const attempts = Math.max(0, Number(item?.attempts) || 0);
    const level =
      score >= 75 ? "Strong" : score >= 50 ? "Average" : "Needs Improvement";

    const priority = score < 50 ? "High" : score < 75 ? "Medium" : "Low";

    let summary = "";
    let recommendation = "";
    let nextSteps = [];

    if (score < 50) {
      summary = `Your current average is ${Math.round(score)}%. Focus on the fundamentals of ${item?.topic || "this topic"} before moving to harder questions.`;
      recommendation =
        "Practice this topic regularly and build from easy to medium questions.";
      nextSteps = [
        "Review the core concepts",
        "Practice 5 easy questions",
        "Practice 5 medium questions",
      ];
    } else if (score < 75) {
      summary = `Your current average is ${Math.round(score)}%. You have a foundation in ${item?.topic || "this topic"}, but more consistent practice can improve your accuracy.`;
      recommendation =
        "Strengthen your explanations and move gradually toward application-based questions.";
      nextSteps = [
        "Review the concepts you missed",
        "Practice 5 medium questions",
        "Try 2 practical/application questions",
      ];
    } else {
      summary = `Your current average is ${Math.round(score)}%. ${item?.topic || "This topic"} is currently one of your stronger preparation areas.`;
      recommendation =
        "Keep this topic active and challenge yourself with harder interview questions.";
      nextSteps = [
        "Maintain your current performance",
        "Practice 3 hard questions",
        "Apply the topic to a real project example",
      ];
    }

    return {
      topic: item?.topic || "Topic",
      score,
      attempts,
      level,
      priority,
      summary,
      recommendation,
      nextSteps,
    };
  };

  /*
   * The preparation service exposes `completion_rate`, not `overall`.
   * Prefer the backend value and calculate it from question/answer counts
   * when an older response does not contain completion_rate.
   */
  const preparationQuestionCount = getNumericValue(
    progress.total_questions,
    progress.questions_count,
    progress.question_count,
  );
  const preparationAnswerCount = getNumericValue(
    progress.total_answers,
    progress.answers_count,
    progress.questions_answered,
    progress.evaluated_answers,
  );

  const calculatedPreparationProgress =
    preparationQuestionCount !== null &&
    preparationQuestionCount > 0 &&
    preparationAnswerCount !== null
      ? (preparationAnswerCount / preparationQuestionCount) * 100
      : null;

  const overallProgress = clampPercent(
    getNumericValue(
      progress.overall,
      progress.overall_progress,
      progress.preparation_progress,
      progress.progress_percentage,
      progress.completion_rate,
      calculatedPreparationProgress,
      overview?.overall_progress,
      0,
    ),
  );

  const strongestRole =
    firstString(
      recommendedRoles?.[0]?.role,
      recommendedRoles?.[0]?.title,
      recommendedRoles?.[0]?.name,
    ) || "Explore your best-fit roles";

  const suggestions = [
    "Which role can I apply for?",
    "What are my strongest technical skills?",
    "Which internship suits my skills?",
    "Give me a preparation roadmap",
    "Ask me technical interview questions",
    "Ask me HR interview questions",
  ];

  const getRoleName = (role) =>
    firstString(
      role?.role,
      role?.title,
      role?.name,
      role?.recommended_role,
      "Recommended Role",
    );

  const getRoleReason = (role) =>
    firstString(
      role?.reason,
      role?.description,
      role?.match_reason,
      role?.why,
      "This role matches your current profile.",
    );

  const getRoleScore = (role) =>
    getNumericValue(
      role?.match_percentage,
      role?.match_score,
      role?.score,
      role?.percentage,
    );

  /*
   * Recommended roles may contain the strongest role twice: once as the
   * selected/default role and once inside recommended_roles. Deduplicate
   * them before rendering the target-role select.
   */
  const targetRoleOptions = [];
  const targetRoleKeys = new Set();

  [strongestRole, ...recommendedRoles.map(getRoleName)].forEach((roleName) => {
    const cleanName = firstString(roleName).trim().replace(/\s+/g, " ");
    if (!cleanName) return;

    const key = cleanName.toLowerCase();
    if (targetRoleKeys.has(key)) return;

    targetRoleKeys.add(key);
    targetRoleOptions.push(cleanName);
  });

  const selectedTargetRole = targetRole || strongestRole;

  const getInternshipTitle = (internship) =>
    firstString(
      internship?.title,
      internship?.internship_title,
      internship?.name,
      "Internship",
    );

  const getInternshipCompany = (internship) =>
    firstString(
      internship?.company_name,
      internship?.company,
      internship?.organization,
      "Company",
    );

  const getInternshipLocation = (internship) =>
    firstString(internship?.location, internship?.work_mode, "");

  const getInternshipScore = (internship) =>
    getNumericValue(
      internship?.match_percentage,
      internship?.match_score,
      internship?.score,
    );

  const sendMessage = async (text = message) => {
    const trimmedMessage = text.trim();

    if (!trimmedMessage || chatLoading) {
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedMessage,
    };

    setMessages((previous) => [...previous, userMessage]);
    setMessage("");
    setChatLoading(true);

    try {
      const result = await requestJson(API.chat, {
        method: "POST",
        body: JSON.stringify({
          message: trimmedMessage,
        }),
      });

      // Preparation Agent backend contract:
      // { success: true, data: "<assistant response>" }
      // Keep compatibility with deployments that return an object/string.
      const responseData = result?.data ?? result ?? {};

      const assistantText =
        typeof responseData === "string"
          ? responseData.trim()
          : firstString(
              responseData.ai_response,
              responseData.response,
              responseData.answer,
              responseData.message,
              responseData.content,
            );

      if (!assistantText) {
        throw new Error(
          "The AI service returned an empty response. Please try again.",
        );
      }

      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content:
          assistantText ||
          "I could not generate a response right now. Please try again.",
      };

      setMessages((previous) => [...previous, assistantMessage]);

      // Chat history is intentionally managed locally per authenticated intern.
      // The preparation backend returns the answer text, not a chat-session id.
      setChatSessions((previous) => {
        const next = previous.map((chat) =>
          chat.id === activeChatId
            ? {
                ...chat,
                title:
                  chat.title === "New preparation chat"
                    ? trimmedMessage.slice(0, 42) +
                      (trimmedMessage.length > 42 ? "…" : "")
                    : chat.title,
                messages: [...messages, userMessage, assistantMessage],
              }
            : chat,
        );

        return next;
      });
    } catch (error) {
      console.error("Preparation chat error:", error);

      setMessages((previous) => [
        ...previous,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          isError: true,
          content: error.message || "Unable to contact the preparation agent.",
        },
      ]);
    } finally {
      setChatLoading(false);

      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const createPracticeSession = async (options = {}) => {
    practiceTopicIndexRef.current = 0;
    if (sessionLoading || mockSessionLoading || voiceQuestionLoading) {
      return;
    }

    const selectedRoleForSession = String(
      options.targetRole || targetRole || strongestRole || "",
    ).trim();
    const selectedCategory = String(
      options.category || category || "mixed",
    ).trim();
    const selectedDifficulty = String(
      options.difficulty || difficulty || "medium",
    ).trim();

    if (
      !selectedRoleForSession ||
      selectedRoleForSession === "Explore your best-fit roles"
    ) {
      setPracticeError(
        "Please select a target role from your preparation profile before starting the session.",
      );
      scrollToPreparationSection("practice-setup");
      return;
    }

    setPracticeError("");

    if (sessionType === "mock_interview") {
      await createMockInterview();
      return;
    }

    if (sessionType === "voice_interview") {
      await createVoiceInterview();
      return;
    }

    setPracticeError("");
    setSessionLoading(true);
    setEvaluation(null);
    setCurrentQuestion(null);
    setAnswerText("");

    try {
      const result = await requestJson(API.session, {
        method: "POST",
        body: JSON.stringify({
          session_type: sessionType,
          category: selectedCategory,
          target_role: selectedRoleForSession,
          difficulty: selectedDifficulty,
        }),
      });

      if (!result?.success || !result?.data) {
        throw new Error(
          result?.message || "Unable to start your preparation session.",
        );
      }

      const createdSession = result.data;
      setSession(createdSession);

      try {
        sessionStorage.setItem(
          practiceStorageKey,
          JSON.stringify(createdSession),
        );
      } catch (error) {
        console.warn("Practice session storage error:", error);
      }

      navigate("/preparation-agent?mode=practice", {
        replace: false,
      });

      await generateNextQuestion(createdSession, {
        category: selectedCategory,
        targetRole: selectedRoleForSession,
        difficulty: selectedDifficulty,
      });
    } catch (error) {
      console.error("Create preparation session error:", error);
      setPracticeError(
        error.message || "Unable to start preparation practice.",
      );
    } finally {
      setSessionLoading(false);
    }
  };

  const getNextPracticeTopic = (activeSession, options = {}) => {
    const selectedCategory = String(
      options.category || activeSession?.category || category || "mixed",
    )
      .trim()
      .toLowerCase();

    const forcedRoadmapTopic = firstString(roadmapForcedTopicRef.current);
    if (forcedRoadmapTopic) {
      roadmapForcedTopicRef.current = "";
      return forcedRoadmapTopic;
    }

    const weakTopicNames = topWeakTopics
      .map((item) => getWeakTopicName(item))
      .filter(Boolean);

    const candidateTopicNames = [
      ...weakTopicNames,
      ...practiceTopics,
      ...focusTopics,
      ...technicalSkills,
    ]
      .map((item) => String(item).trim())
      .filter(Boolean)
      .filter(
        (item, index, list) =>
          list.findIndex(
            (value) => value.toLowerCase() === item.toLowerCase(),
          ) === index,
      );

    if (
      selectedCategory.includes("hr") ||
      selectedCategory.includes("behavior")
    ) {
      return "Behavioral Interview";
    }

    if (selectedCategory.includes("resume")) {
      return "Resume and Projects";
    }

    if (candidateTopicNames.length) {
      const index = practiceTopicIndexRef.current % candidateTopicNames.length;
      practiceTopicIndexRef.current += 1;
      return candidateTopicNames[index];
    }

    if (selectedCategory.includes("technical")) {
      return "Core Technical Concepts";
    }

    return "Interview Fundamentals";
  };

  const startRoadmapPractice = async (item) => {
    const topic = firstString(item?.topic);
    if (!topic || sessionLoading || mockSessionLoading || voiceQuestionLoading)
      return;

    roadmapForcedTopicRef.current = topic;
    roadmapActiveItemIdRef.current = firstString(item?.id);
    setPracticeMode(true);
    setMockInterviewMode(false);
    setVoiceInterviewMode(false);
    setSessionType("practice");
    setCategory("technical");
    setDifficulty(firstString(item?.difficulty, adaptiveDifficulty));
    setTargetRole(preparationTargetRole || strongestRole);
    setPracticeError("");
    await createPracticeSession({
      category: "technical",
      difficulty: firstString(item?.difficulty, adaptiveDifficulty),
      targetRole: preparationTargetRole || strongestRole,
    });
    scrollToPreparationSection("practice-setup");
  };

  const generateNextQuestion = async (
    sessionOverride = session,
    options = {},
  ) => {
    const activeSession = sessionOverride || session;

    if (!activeSession?.id || questionLoading) {
      return;
    }

    setPracticeError("");
    setQuestionLoading(true);
    setEvaluation(null);
    setAnswerText("");

    try {
      const result = await requestJson(API.question, {
        method: "POST",
        body: JSON.stringify({
          session_id: activeSession.id,
          category:
            options.category || activeSession.category || category || "mixed",
          topic: getNextPracticeTopic(activeSession, options),
          target_role:
            options.targetRole ||
            activeSession.target_role ||
            targetRole ||
            strongestRole,
          difficulty:
            options.difficulty ||
            activeSession.difficulty ||
            difficulty ||
            "medium",
        }),
      });

      if (!result?.success || !result?.data) {
        throw new Error(
          result?.message || "Unable to generate the next question.",
        );
      }

      setCurrentQuestion(result.data);
    } catch (error) {
      console.error("Generate preparation question error:", error);
      setPracticeError(
        error.message || "Unable to generate the next question.",
      );
    } finally {
      setQuestionLoading(false);
    }
  };

  const evaluateCurrentAnswer = async () => {
    if (!currentQuestion?.id || !answerText.trim() || evaluationLoading) {
      return;
    }

    setPracticeError("");
    setEvaluationLoading(true);

    try {
      const result = await requestJson(API.evaluate, {
        method: "POST",
        body: JSON.stringify({
          question_id: currentQuestion.id,
          answer: answerText.trim(),
        }),
      });

      if (!result?.success) {
        throw new Error(result?.message || "Unable to evaluate your answer.");
      }

      // The preparation endpoint returns the evaluation as either text or an
      // object depending on the backend version. Always normalize it before
      // rendering; spreading a string would create character keys and leave
      // all score cards as "—".
      const evaluationData = normalizeMockEvaluation(result?.data || {});
      setEvaluation({
        ...evaluationData,
        saved: result?.saved !== false,
      });
    } catch (error) {
      console.error("Evaluate preparation answer error:", error);
      setPracticeError(error.message || "Unable to evaluate your answer.");
    } finally {
      setSaveLoading(false);
      setEvaluationLoading(false);
    }
  };

  const saveCurrentAnswer = async () => {
    if (
      !currentQuestion?.id ||
      !answerText.trim() ||
      saveLoading ||
      !evaluation
    ) {
      return;
    }

    setPracticeError("");
    setSaveLoading(true);

    try {
      const result = await requestJson(API.answer, {
        method: "POST",
        body: JSON.stringify({
          question_id: currentQuestion.id,
          answer: answerText.trim(),
          answer_type: "text",
          evaluation,
        }),
      });

      if (!result?.success) {
        throw new Error(
          result?.message || "Unable to save your preparation answer.",
        );
      }

      setEvaluation((previous) => ({
        ...(previous || {}),
        saved: true,
      }));
    } catch (error) {
      console.error("Save preparation answer error:", error);
      setPracticeError(error.message || "Unable to save your answer.");
    } finally {
      setSaveLoading(false);
    }
  };

  const completeSession = async () => {
    if (!session?.id || completeLoading) {
      return;
    }

    setPracticeError("");
    setCompleteLoading(true);

    try {
      // Final-answer safety net. If Finish is clicked immediately after an
      // evaluation, persist the current answer before marking the session done.
      if (
        currentQuestion?.id &&
        answerText.trim() &&
        evaluation &&
        !evaluation.saved
      ) {
        setSaveLoading(true);
        const saveResult = await requestJson(API.answer, {
          method: "POST",
          body: JSON.stringify({
            question_id: currentQuestion.id,
            answer: answerText.trim(),
            answer_type: "text",
            evaluation,
          }),
        });
        if (!saveResult?.success) {
          throw new Error(
            saveResult?.message || "Unable to save the current answer.",
          );
        }
      }

      const result = await requestJson(API.complete(session.id), {
        method: "POST",
      });

      if (!result?.success) {
        throw new Error(result?.message || "Unable to complete this session.");
      }

      const completedSession = result.data || session;
      const finalResult =
        result.data?.result ||
        (await requestJson(API.sessionResult(session.id), { method: "GET" }))
          .data;

      setSession(completedSession);
      setPracticeResult(finalResult || null);

      // Completing a roadmap-started practice session automatically completes
      // the matching roadmap item. Normal practice sessions are unaffected.
      const completedRoadmapItemId = roadmapActiveItemIdRef.current;
      if (completedRoadmapItemId) {
        setRoadmapCompleted((previous) => {
          if (previous.has(completedRoadmapItemId)) return previous;
          const next = new Set(previous);
          next.add(completedRoadmapItemId);
          const authKey = getAuthSessionKey();
          if (authKey) {
            try {
              localStorage.setItem(
                `internmatch_preparation_roadmap_${authKey}`,
                JSON.stringify([...next]),
              );
            } catch (error) {
              console.warn("Preparation roadmap completion save error:", error);
            }
          }
          return next;
        });
      }
      roadmapActiveItemIdRef.current = "";
      setOverviewRefreshKey((value) => value + 1);

      try {
        sessionStorage.setItem(
          "internmatch_preparation_practice_result",
          JSON.stringify(finalResult || null),
        );
        sessionStorage.removeItem(practiceStorageKey);
      } catch (storageError) {
        console.warn("Practice session storage cleanup error:", storageError);
      }

      setCurrentQuestion(null);
      setEvaluation(null);
      setAnswerText("");
      setPracticeMode(false);
      navigate("/preparation-agent?mode=practice-result", {
        replace: true,
        state: {
          practiceSessionId: session.id,
          practiceResult: finalResult || null,
        },
      });
    } catch (error) {
      console.error("Complete preparation session error:", error);
      setPracticeError(
        error.message || "Unable to complete the preparation session.",
      );
    } finally {
      setSaveLoading(false);
      setCompleteLoading(false);
    }
  };

  const stopMockVoiceListening = () => {
    stopVoiceListening();
    setVoiceTranscript("");
    setMockVoiceListening(false);
  };

  const startMockVoiceListening = () => {
    if (
      !voiceSpeechSupported ||
      mockEvaluationLoading ||
      mockSaveLoading ||
      mockCompleteLoading ||
      mockEvaluation
    )
      return;
    setMockVoiceListening(true);
    setVoiceTranscript(mockAnswer.trim());
    startVoiceListening();
  };

  const createMockInterview = async () => {
    if (mockSessionLoading) return;

    stopMockVoiceListening();
    setVoiceError("");
    setMockError("");
    setMockSessionLoading(true);
    setSessionLoading(true);
    setMockEvaluation(null);
    setMockAnswerSaved(false);
    setMockQuestion(null);
    setMockAnswer("");
    setMockProgress(null);
    setMockSubmittedQuestionIds(new Set());
    setMockInterviewResult(null);
    mockGenerationSessionRef.current += 1;

    try {
      sessionStorage.removeItem(mockInterviewResultStorageKey);
      sessionStorage.removeItem(mockInterviewStorageKey);
    } catch (error) {
      console.warn("Mock interview reset storage error:", error);
    }

    const selectedRole = targetRole || strongestRole;

    try {
      const result = await requestJson(API.mockInterview, {
        method: "POST",
        body: JSON.stringify({
          category,
          target_role: selectedRole,
          difficulty,
        }),
      });

      if (!result?.success || !result?.data?.id) {
        throw new Error(
          result?.message || "Unable to start the mock interview.",
        );
      }

      const created = {
        ...result.data,
        total_questions: mockTotalQuestions,
        category: result.data.category || category,
        target_role: result.data.target_role || selectedRole,
        difficulty: result.data.difficulty || difficulty,
        status: result.data.status || "active",
      };

      setMockSession(created);
      setMockProgress(null);
      setMockInterviewMode(true);
      sessionStorage.setItem(mockInterviewStorageKey, JSON.stringify(created));

      // Generate the first question before changing the URL. React Router
      // navigation is SPA-only, so the page is not refreshed. Keeping the
      // question in state also prevents the route effect from clearing it.
      await generateMockQuestion(created, 1);
      navigate("/preparation-agent?mode=mock-interview", { replace: false });
    } catch (error) {
      console.error("Create mock interview error:", error);
      setMockError(error.message || "Unable to start the mock interview.");
    } finally {
      setMockSessionLoading(false);
      setSessionLoading(false);
    }
  };

  const generateMockQuestion = async (
    sessionOverride = mockSession,
    questionNumberOverride = null,
  ) => {
    const activeSession = sessionOverride || mockSession;
    const questionNumber =
      Number(questionNumberOverride) ||
      Number(
        activeSession?.question_number || activeSession?.current_question || 1,
      );

    if (!activeSession?.id || mockQuestionLoading) return;

    const requestId = ++mockQuestionRequestRef.current;
    const generationSessionId = mockGenerationSessionRef.current;

    setMockError("");
    setMockQuestionLoading(true);
    setMockEvaluation(null);
    setMockAnswerSaved(false);
    stopMockVoiceListening();
    setMockAnswer("");

    const isCurrentRequest = () =>
      requestId === mockQuestionRequestRef.current &&
      generationSessionId === mockGenerationSessionRef.current;

    try {
      const payload = {
        session_id: activeSession.id,
        question_number: questionNumber,
        category: activeSession.category || category || "mixed",
        target_role: activeSession.target_role || targetRole || strongestRole,
        difficulty: activeSession.difficulty || difficulty || "medium",
      };

      let result = await requestJson(API.mockQuestion, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!isCurrentRequest()) return;

      if (!result?.success || !result?.data) {
        throw new Error(
          result?.message || "Unable to generate the mock interview question.",
        );
      }

      let questionData = result.data;
      let questionText = firstString(
        questionData.question,
        questionData.question_text,
        questionData.text,
        questionData.prompt,
      );

      // Never render a UI/header placeholder as an interview question.
      // The backend now guarantees a real question or returns an error.
      const normalizedQuestionText = questionText
        .replace(/^```(?:text|txt|markdown)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const looksLikePlaceholder =
        !normalizedQuestionText ||
        /^question\s*\d+$/i.test(normalizedQuestionText) ||
        /^question\s*\d+\s*\([^)]*\)\s*[:\-]?$/i.test(normalizedQuestionText);

      if (looksLikePlaceholder) {
        throw new Error(
          "The interviewer could not generate a valid question. Please start the interview again.",
        );
      }

      questionText = normalizedQuestionText;

      const normalizedQuestion = {
        ...questionData,
        question: questionText,
        question_number: Number(questionData.question_number) || questionNumber,
        category: questionData.category || payload.category,
        target_role: questionData.target_role || payload.target_role,
        difficulty: questionData.difficulty || payload.difficulty,
      };

      // Never allow an older network response to overwrite the newest
      // question after the candidate presses Next quickly.
      if (!isCurrentRequest()) return;

      setMockQuestion(normalizedQuestion);
      const updatedSession = {
        ...activeSession,
        question_number: normalizedQuestion.question_number,
        current_question: normalizedQuestion.question_number,
        total_questions:
          Number(activeSession.total_questions) || mockTotalQuestions,
      };
      setMockSession(updatedSession);
      sessionStorage.setItem(
        mockInterviewStorageKey,
        JSON.stringify(updatedSession),
      );
    } catch (error) {
      if (!isCurrentRequest()) return;
      console.error("Generate mock interview question error:", error);
      setMockError(
        error.message || "Unable to generate the mock interview question.",
      );
    } finally {
      if (isCurrentRequest()) {
        setMockQuestionLoading(false);
      }
    }
  };

  const normalizeMockEvaluation = (value) => {
    if (!value) return {};

    if (typeof value === "object" && !Array.isArray(value)) {
      if (
        value.evaluation &&
        typeof value.evaluation === "object" &&
        !Array.isArray(value.evaluation)
      ) {
        return { ...value, ...value.evaluation };
      }
      if (
        value.data &&
        typeof value.data === "object" &&
        !Array.isArray(value.data)
      ) {
        const nested =
          value.data.evaluation && typeof value.data.evaluation === "object"
            ? value.data.evaluation
            : value.data;
        return { ...value, ...nested };
      }
      return value;
    }

    const text = String(value).trim();
    if (!text) return {};

    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Continue with the human-readable rubric parser.
    }

    const section = (label, nextLabels = []) => {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const next = nextLabels.length
        ? `(?=\\n(?:${nextLabels.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s*:|\\n(?:What Was Good|What Needs Improvement|Ideal Answer|Candidate Answer|Recommended Answer)\\s*:|$)`
        : "(?=\\n(?:What Was Good|What Needs Improvement|Ideal Answer|Candidate Answer|Recommended Answer)\\s*:|$)";
      const match = text.match(
        new RegExp(`${escaped}\\s*:\\s*([\\s\\S]*?)${next}`, "i"),
      );
      return match ? match[1].trim() : "";
    };

    const metric = (label, aliases = []) => {
      const labels = [label, ...aliases]
        .map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");

      const match = text.match(
        new RegExp(
          `(?:^|\\n)\\s*(?:${labels})\\s*:\\s*(\\d+(?:\\.\\d+)?)\\s*(?:/\\s*10)?`,
          "i",
        ),
      );

      if (!match) return null;

      const number = Number(match[1]);
      return Number.isFinite(number) ? Math.max(0, Math.min(10, number)) : null;
    };

    const scoreMatch = text.match(
      /(?:^|\n)\s*(?:score|overall score)\s*:\s*(\d+(?:\.\d+)?)\s*\/\s*10/i,
    );

    const score = scoreMatch
      ? Number(scoreMatch[1])
      : getNumericValue(
          text.match(/(?:score|overall score)\s*=\s*(\d+(?:\.\d+)?)/i)?.[1],
        );

    const strengthsBlock =
      text.match(
        /what was good\s*:\s*([\s\S]*?)(?=\n\s*what needs improvement\s*:|\n\s*ideal answer\s*:|$)/i,
      )?.[1] || "";

    const improvementsBlock =
      text.match(
        /what needs improvement\s*:\s*([\s\S]*?)(?=\n\s*ideal answer\s*:|$)/i,
      )?.[1] || "";

    const ideal =
      text.match(/ideal answer\s*:\s*([\s\S]*)$/i)?.[1]?.trim() || "";

    const candidateAnswer =
      text
        .match(
          /candidate answer\s*:\s*([\s\S]*?)(?=\n\s*(?:recommended answer|ideal answer)\s*:|$)/i,
        )?.[1]
        ?.trim() || "";

    const recommendedAnswer =
      text
        .match(
          /recommended answer\s*:\s*([\s\S]*?)(?=\n\s*ideal answer\s*:|$)/i,
        )?.[1]
        ?.trim() || "";

    const listItems = (block) =>
      block
        .split(/\n/)
        .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
        .filter(Boolean);

    const correctnessText = section("Correctness", [
      "Technical Knowledge",
      "Relevance",
    ]);
    const technicalText = section("Technical Knowledge", [
      "Relevance",
      "Completeness",
    ]);
    const relevanceText = section("Relevance", [
      "Completeness",
      "Communication",
    ]);
    const completenessText = section("Completeness", ["Communication"]);
    const communicationText = section("Communication");

    const correctness =
      metric("Correctness") ?? getNumericValue(correctnessText);
    const technicalKnowledge =
      metric("Technical Knowledge", ["Technical"]) ??
      getNumericValue(technicalText);
    const relevance = metric("Relevance") ?? getNumericValue(relevanceText);
    const completeness =
      metric("Completeness") ?? getNumericValue(completenessText);
    const communication =
      metric("Communication") ?? getNumericValue(communicationText);

    return {
      score:
        score !== null && Number.isFinite(score)
          ? Math.max(0, Math.min(10, score))
          : undefined,
      correctness,
      technical_knowledge: technicalKnowledge,
      relevance,
      completeness,
      communication,
      feedback: [
        correctnessText,
        technicalText,
        relevanceText,
        completenessText,
        communicationText,
      ]
        .filter(Boolean)
        .join("\n\n"),
      strengths: listItems(strengthsBlock),
      improvements: listItems(improvementsBlock),
      candidate_answer: candidateAnswer,
      recommended_answer: recommendedAnswer,
      ideal_answer: ideal || recommendedAnswer,
      raw_evaluation: text,
    };
  };

  const evaluateMockAnswer = async () => {
    const questionId = mockQuestion?.id;
    const trimmedAnswer = mockAnswer.trim();

    if (
      !questionId ||
      !trimmedAnswer ||
      mockEvaluationLoading ||
      mockSaveLoading
    ) {
      return;
    }

    if (mockSubmittedQuestionIds.has(String(questionId))) {
      return;
    }

    setMockError("");
    setMockEvaluationLoading(true);
    setMockAnswerSaved(false);

    try {
      const result = await requestJson(API.mockEvaluate, {
        method: "POST",
        body: JSON.stringify({
          question_id: questionId,
          answer: trimmedAnswer,
        }),
      });

      if (!result?.success) {
        throw new Error(
          result?.message || "Unable to evaluate your mock interview answer.",
        );
      }

      const evaluationData = normalizeMockEvaluation(
        result.data?.evaluation ?? result.data,
      );

      if (!Object.keys(evaluationData).length) {
        throw new Error(
          "The AI returned an empty evaluation. Please try again.",
        );
      }

      // The backend now evaluates AND saves in the same request. Do not make
      // a second save request because that could trigger a second AI pass.
      setMockEvaluation(evaluationData);
      setMockAnswerSaved(result?.data?.saved !== false);
      setMockSubmittedQuestionIds((previous) => {
        const next = new Set(previous);
        next.add(String(questionId));
        return next;
      });

      await loadMockProgress(mockSession?.id);
    } catch (error) {
      console.error("Evaluate and save mock interview answer error:", error);
      setMockError(error.message || "Unable to evaluate your answer.");
    } finally {
      setMockSaveLoading(false);
      setMockEvaluationLoading(false);
    }
  };

  const saveMockAnswer = async () => {
    if (mockAnswerSaved) {
      return true;
    }

    if (
      !mockQuestion?.id ||
      !mockAnswer.trim() ||
      !mockEvaluation ||
      mockSaveLoading
    ) {
      return false;
    }

    setMockError("");
    setMockSaveLoading(true);

    try {
      const result = await requestJson(API.mockAnswer, {
        method: "POST",
        body: JSON.stringify({
          question_id: mockQuestion.id,
          answer: mockAnswer.trim(),
          evaluation: JSON.stringify(normalizeMockEvaluation(mockEvaluation)),
        }),
      });

      if (!result?.success) {
        throw new Error(
          result?.message || "Unable to save your mock interview answer.",
        );
      }

      setMockAnswerSaved(true);
      setMockSubmittedQuestionIds((previous) => {
        const next = new Set(previous);
        next.add(String(mockQuestion.id));
        return next;
      });
      return true;
    } catch (error) {
      console.error("Save mock interview answer error:", error);
      setMockError(error.message || "Unable to save your answer.");
      return false;
    } finally {
      setMockSaveLoading(false);
    }
  };

  const loadMockProgress = async (sessionId = mockSession?.id) => {
    if (!sessionId) return;

    try {
      const result = await requestJson(API.mockProgress(sessionId), {
        method: "GET",
      });

      if (result?.success) {
        setMockProgress(result.data || {});
      }
    } catch (error) {
      console.warn("Mock interview progress error:", error);
    }
  };

  const nextMockQuestion = async () => {
    if (
      !mockSession?.id ||
      !mockEvaluation ||
      !mockAnswerSaved ||
      mockSaveLoading ||
      mockQuestionLoading ||
      mockEvaluationLoading
    ) {
      return;
    }

    const currentNumber = Number(
      mockQuestion?.question_number || mockSession?.question_number || 1,
    );
    const total = Number(mockSession?.total_questions) || mockTotalQuestions;

    if (currentNumber >= total) {
      await completeMockInterview();
      return;
    }

    await loadMockProgress(mockSession.id);
    await generateMockQuestion(mockSession, currentNumber + 1);
  };

  const completeMockInterview = async () => {
    if (!mockSession?.id || mockCompleteLoading) return;

    const confirmed = window.confirm(
      "Finish this mock interview? Your current progress will be saved and the session will be completed.",
    );

    if (!confirmed) return;

    setMockError("");

    if (mockAnswer.trim() && !mockEvaluation) {
      setMockError(
        "Please evaluate and save your current answer before finishing the interview.",
      );
      return;
    }

    if (
      mockQuestion?.id &&
      mockAnswer.trim() &&
      mockEvaluation &&
      !mockAnswerSaved
    ) {
      const saved = await saveMockAnswer();
      if (!saved) return;
    }

    // Read persisted progress immediately before completion. React state
    // updates are asynchronous, so use the fresh response for validation.
    let freshProgress = mockProgress || {};
    try {
      const progressResult = await requestJson(
        API.mockProgress(mockSession.id),
        {
          method: "GET",
        },
      );
      if (progressResult?.success) {
        freshProgress = progressResult.data || {};
        setMockProgress(freshProgress);
      }
    } catch (error) {
      console.warn("Mock interview final progress check error:", error);
    }

    // A mock interview cannot be completed with zero evaluated answers.
    const progressAnswerCount = Number(
      freshProgress?.total_answers ??
        freshProgress?.answers_count ??
        freshProgress?.evaluated_answers ??
        0,
    );
    const localSavedAnswerCount = mockSubmittedQuestionIds.size;
    const savedAnswerCount = Math.max(
      progressAnswerCount,
      localSavedAnswerCount,
      mockAnswerSaved ? 1 : 0,
    );

    if (savedAnswerCount < 1) {
      setMockError(
        "Please answer and evaluate at least one question before finishing the mock interview.",
      );
      return;
    }

    setMockCompleteLoading(true);

    try {
      const result = await requestJson(API.mockComplete(mockSession.id), {
        method: "POST",
      });

      if (!result?.success) {
        throw new Error(
          result?.message || "Unable to complete the mock interview.",
        );
      }

      // The completion endpoint confirms the interview, then we read the
      // persisted history one more time so the result page always reflects
      // the answer that was just saved.
      let persistedProgress = result.data?.progress || result.data || {};

      try {
        const finalProgressResult = await requestJson(
          API.mockProgress(mockSession.id),
          { method: "GET" },
        );

        if (finalProgressResult?.success && finalProgressResult.data) {
          persistedProgress = {
            ...persistedProgress,
            ...finalProgressResult.data,
          };
        }
      } catch (progressError) {
        console.warn(
          "Final mock interview progress refresh error:",
          progressError,
        );
      }

      const configuredTotalQuestions =
        Number(mockSession?.total_questions) || mockTotalQuestions || 10;
      const persistedAnswerCount =
        Number(
          persistedProgress.total_answers ??
            persistedProgress.answers_count ??
            persistedProgress.evaluated_answers ??
            mockSubmittedQuestionIds.size,
        ) || 0;

      const completionProgress = {
        ...persistedProgress,
        session_id: mockSession.id,
        total_questions: configuredTotalQuestions,
        total_answers: persistedAnswerCount,
        completion_rate: clampPercent(
          configuredTotalQuestions > 0
            ? (persistedAnswerCount / configuredTotalQuestions) * 100
            : 0,
        ),
      };

      const completionResult = {
        progress: completionProgress,
        session: {
          ...(mockSession || {}),
          total_questions: configuredTotalQuestions,
          status: "completed",
        },
      };

      setMockProgress(completionProgress);
      setMockInterviewResult(completionResult);
      sessionStorage.removeItem(mockInterviewStorageKey);
      sessionStorage.removeItem(mockInterviewResultStorageKey);

      try {
        const compactResult = compactMockInterviewResult(completionResult);
        sessionStorage.setItem(
          mockInterviewResultStorageKey,
          JSON.stringify(compactResult),
        );
      } catch (storageError) {
        console.warn(
          "Mock interview result could not be cached in sessionStorage. Continuing with the in-memory result.",
          storageError,
        );
        sessionStorage.removeItem(mockInterviewResultStorageKey);
      }
      setMockSession((previous) => ({
        ...(previous || {}),
        status: "completed",
      }));
      // Refresh dashboard intelligence after a completed mock interview.
      setOverviewRefreshKey((value) => value + 1);
      navigate("/preparation-agent?mode=mock-interview-result", {
        replace: true,
        state: {
          mockInterviewCompleted: true,
          progress: completionProgress,
          session: completionResult.session,
        },
      });
    } catch (error) {
      console.error("Complete mock interview error:", error);
      setMockError(error.message || "Unable to complete the mock interview.");
    } finally {
      setMockCompleteLoading(false);
    }
  };

  const leaveMockInterview = () => {
    const confirmed = window.confirm(
      "Leave this mock interview? Unsaved progress may be lost.",
    );

    if (!confirmed) return;

    stopMockVoiceListening();
    window.speechSynthesis?.cancel();
    sessionStorage.removeItem(mockInterviewStorageKey);
    mockGenerationSessionRef.current += 1;
    mockQuestionRequestRef.current += 1;
    setMockInterviewMode(false);
    setMockSession(null);
    setMockQuestion(null);
    setMockAnswer("");
    setMockEvaluation(null);
    setMockAnswerSaved(false);
    setMockProgress(null);
    setMockError("");
    setMockSubmittedQuestionIds(new Set());

    // Leaving the dedicated mock-interview route invalidates the old active
    // session. This prevents an abandoned interview from reappearing when
    // the candidate starts a new interview from the preparation dashboard.
    try {
      sessionStorage.removeItem(mockInterviewStorageKey);
    } catch (error) {
      console.warn("Mock interview storage cleanup error:", error);
    }
    navigate("/preparation-agent", { replace: true });
  };

  // ============================================================
  // PHASE 3 STEP 10 — VOICE INTERVIEW
  // ============================================================

  const speakVoiceQuestion = (questionText) => {
    if (!questionText || !window.speechSynthesis) return;

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(questionText);
      utterance.rate = 0.92;
      utterance.pitch = 1;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.warn("Voice question playback error:", error);
    }
  };

  const stopVoiceListening = () => {
    try {
      voiceRecognitionRef.current?.stop();
    } catch {
      // Recognition may already be stopped.
    }
    setVoiceListening(false);
  };

  const startVoiceListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError(
        "Voice input is not supported in this browser. Please use Google Chrome or another browser with Speech Recognition support.",
      );
      return;
    }

    if (voiceEvaluating || voiceSaving || voiceCompleting || voiceEvaluation) {
      return;
    }

    try {
      voiceRecognitionRef.current?.stop();
    } catch {
      // Start a fresh recognition instance below.
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    voiceFinalTranscriptRef.current = voiceTranscript.trim();
    setVoiceError("");
    setVoiceListening(true);

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = voiceFinalTranscriptRef.current;

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        const textValue = result?.[0]?.transcript || "";

        if (result.isFinal) {
          finalTranscript = `${finalTranscript} ${textValue}`.trim();
        } else {
          interimTranscript += `${textValue} `;
        }
      }

      voiceFinalTranscriptRef.current = finalTranscript;
      setVoiceTranscript(`${finalTranscript} ${interimTranscript}`.trim());
    };

    recognition.onerror = (event) => {
      console.warn("Voice recognition error:", event.error);

      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        setVoiceError(
          "Microphone permission was denied. Please allow microphone access and try again.",
        );
      } else if (event.error === "no-speech") {
        setVoiceError("No speech was detected. Please try speaking again.");
      } else if (event.error !== "aborted") {
        setVoiceError(
          "Voice recognition stopped unexpectedly. Please try again.",
        );
      }

      setVoiceListening(false);
    };

    recognition.onend = () => {
      setVoiceListening(false);
      voiceRecognitionRef.current = null;
    };

    voiceRecognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.warn("Voice recognition start error:", error);
      voiceRecognitionRef.current = null;
      setVoiceListening(false);
      setVoiceError("Unable to start the microphone. Please try again.");
    }
  };

  const createVoiceInterview = async () => {
    if (mockSessionLoading || voiceQuestionLoading || voiceEvaluating) return;

    setVoiceError("");
    setVoiceInterviewResult(null);
    setVoiceSession(null);
    setVoiceQuestion(null);
    setVoiceTranscript("");
    setVoiceEvaluation(null);
    setVoiceProgress(null);
    setVoiceAnswers([]);
    setVoiceInterviewMode(true);
    setVoiceQuestionLoading(true);
    voiceGenerationSessionRef.current += 1;

    try {
      stopVoiceListening();
      window.speechSynthesis?.cancel();
      sessionStorage.removeItem(voiceInterviewStorageKey);
      sessionStorage.removeItem(voiceInterviewResultStorageKey);

      const selectedRole = targetRole || strongestRole;

      const result = await requestJson(API.voiceInterview, {
        method: "POST",
        body: JSON.stringify({
          target_role: selectedRole,
          category,
          difficulty,
          total_questions: voiceTotalQuestions,
        }),
      });

      const createdInterviewId = firstString(
        result?.data?.id,
        result?.data?.interview_id,
      );

      // The existing voice backend returns `interview_id`, while the
      // frontend uses `id` consistently for active interview state.
      if (!result?.success || !createdInterviewId) {
        throw new Error(
          result?.message || "Unable to start the voice interview.",
        );
      }

      const created = {
        ...result.data,
        id: createdInterviewId,
        interview_id: createdInterviewId,
        total_questions:
          Number(result.data.total_questions) || voiceTotalQuestions,
        category: result.data.category || category,
        target_role: result.data.target_role || selectedRole,
        difficulty: result.data.difficulty || difficulty,
        status: result.data.status || "active",
      };

      setVoiceSession(created);
      setVoiceTotalQuestions(
        Number(created.total_questions) || voiceTotalQuestions,
      );
      setVoiceProgress(null);
      setVoiceInterviewMode(true);

      sessionStorage.setItem(voiceInterviewStorageKey, JSON.stringify(created));

      await generateVoiceQuestion(created, 1);
      navigate("/preparation-agent?mode=voice-interview", {
        replace: false,
      });
    } catch (error) {
      console.error("Create voice interview error:", error);
      setVoiceError(error.message || "Unable to start the voice interview.");
      setVoiceInterviewMode(false);
    } finally {
      setVoiceQuestionLoading(false);
    }
  };

  const generateVoiceQuestion = async (
    sessionOverride = voiceSession,
    questionNumberOverride = null,
  ) => {
    const activeSession = sessionOverride || voiceSession;
    const questionNumber =
      Number(questionNumberOverride) ||
      Number(
        activeSession?.question_number || activeSession?.current_question || 1,
      );

    if (!activeSession?.id || voiceQuestionLoading) return;

    const requestId = ++voiceQuestionRequestRef.current;
    const generationSessionId = voiceGenerationSessionRef.current;

    setVoiceError("");
    setVoiceQuestionLoading(true);
    setVoiceEvaluation(null);
    setVoiceTranscript("");
    voiceFinalTranscriptRef.current = "";

    const isCurrentRequest = () =>
      requestId === voiceQuestionRequestRef.current &&
      generationSessionId === voiceGenerationSessionRef.current;

    try {
      stopVoiceListening();
      window.speechSynthesis?.cancel();

      const totalQuestions =
        Number(activeSession.total_questions) || voiceTotalQuestions;

      const result = await requestJson(API.voiceQuestion, {
        method: "POST",
        body: JSON.stringify({
          interview_id: activeSession.id,
          target_role: activeSession.target_role || targetRole || strongestRole,
          category: activeSession.category || category || "mixed",
          difficulty: activeSession.difficulty || difficulty || "medium",
          question_number: questionNumber,
          total_questions: totalQuestions,
        }),
      });

      if (!isCurrentRequest()) return;

      if (!result?.success || !result?.data) {
        throw new Error(
          result?.message || "Unable to generate the voice interview question.",
        );
      }

      const data = result.data;
      const questionText = firstString(
        data.question,
        data.question_text,
        data.text,
        data.prompt,
      )
        .replace(/^```(?:text|txt|markdown)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      if (
        !questionText ||
        /^question\s*\d+$/i.test(questionText) ||
        /^question\s*\d+\s*\([^)]*\)\s*[:\-]?$/i.test(questionText)
      ) {
        throw new Error(
          "The voice interviewer could not generate a valid question. Please try again.",
        );
      }

      const normalizedQuestion = {
        ...data,
        id: firstString(data.id, data.question_id),
        question_id: firstString(data.question_id, data.id),
        interview_id: data.interview_id || activeSession.id,
        question: questionText,
        question_number: Number(data.question_number) || questionNumber,
        total_questions: Number(data.total_questions) || totalQuestions,
        category: data.category || activeSession.category || category,
        target_role:
          data.target_role ||
          activeSession.target_role ||
          targetRole ||
          strongestRole,
        difficulty: data.difficulty || activeSession.difficulty || difficulty,
      };

      if (!normalizedQuestion.id) {
        throw new Error(
          "The voice interviewer returned an invalid question ID.",
        );
      }

      if (!isCurrentRequest()) return;

      setVoiceQuestion(normalizedQuestion);

      const updatedSession = {
        ...activeSession,
        question_number: normalizedQuestion.question_number,
        current_question: normalizedQuestion.question_number,
        total_questions: normalizedQuestion.total_questions,
      };

      setVoiceSession(updatedSession);
      sessionStorage.setItem(
        voiceInterviewStorageKey,
        JSON.stringify(updatedSession),
      );

      // Read the question aloud so the candidate can complete the interview
      // without needing to type or read the question.
      speakVoiceQuestion(normalizedQuestion.question);
    } catch (error) {
      if (!isCurrentRequest()) return;

      console.error("Generate voice interview question error:", error);
      setVoiceError(
        error.message || "Unable to generate the voice interview question.",
      );
    } finally {
      if (isCurrentRequest()) {
        setVoiceQuestionLoading(false);
      }
    }
  };

  const normalizeVoiceEvaluation = (value) => {
    if (!value) return {};

    if (typeof value === "object" && !Array.isArray(value)) {
      if (
        value.evaluation &&
        typeof value.evaluation === "object" &&
        !Array.isArray(value.evaluation)
      ) {
        return { ...value, ...value.evaluation };
      }

      if (
        value.data &&
        typeof value.data === "object" &&
        !Array.isArray(value.data)
      ) {
        const nested =
          value.data.evaluation && typeof value.data.evaluation === "object"
            ? value.data.evaluation
            : value.data;
        return { ...value, ...nested };
      }

      return value;
    }

    const textValue = String(value).trim();
    if (!textValue) return {};

    try {
      const parsed = JSON.parse(textValue);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Fall through to a simple score/feedback representation.
    }

    const scoreMatch = textValue.match(
      /(?:score|overall\s*score)\s*[:=]\s*(\d+(?:\.\d+)?)\s*(?:\/\s*10)?/i,
    );

    return {
      score: scoreMatch ? Number(scoreMatch[1]) : undefined,
      evaluation: textValue,
      feedback: textValue,
      raw_evaluation: textValue,
    };
  };

  const getVoiceScore = (value) => {
    const raw = getNumericValue(
      value?.score,
      value?.overall_score,
      value?.total_score,
      value?.rating,
    );

    return raw === null ? null : Math.max(0, Math.min(10, raw));
  };

  const evaluateVoiceAnswer = async () => {
    if (
      !voiceSession?.id ||
      !voiceQuestion?.id ||
      !voiceTranscript.trim() ||
      voiceEvaluating ||
      voiceSaving ||
      voiceEvaluation
    ) {
      return;
    }

    stopVoiceListening();
    window.speechSynthesis?.cancel();
    setVoiceError("");
    setVoiceEvaluating(true);
    setVoiceSaving(false);

    try {
      const transcript = voiceTranscript.trim();

      // One request now performs AI evaluation + database save.
      // This removes the previous evaluate -> save -> progress chain.
      const result = await requestJson(API.voiceEvaluate, {
        method: "POST",
        body: JSON.stringify({
          interview_id: voiceSession.id,
          question_id: voiceQuestion.id,
          question: voiceQuestion.question,
          transcript,
          target_role: voiceSession.target_role || targetRole || strongestRole,
          category: voiceSession.category || category || "mixed",
          difficulty: voiceSession.difficulty || difficulty || "medium",
          question_number: Number(voiceQuestion.question_number) || 1,
          total_questions:
            Number(voiceSession.total_questions) || voiceTotalQuestions,
        }),
      });

      if (!result?.success) {
        throw new Error(
          result?.message || "Unable to evaluate your spoken answer.",
        );
      }

      const evaluationData = normalizeVoiceEvaluation(
        result.data?.evaluation ?? result.data,
      );

      if (!Object.keys(evaluationData).length) {
        throw new Error(
          "The AI returned an empty voice evaluation. Please try again.",
        );
      }

      const score = getVoiceScore(evaluationData) ?? 0;

      const savedAnswer = {
        question_id: voiceQuestion.id,
        question_number: Number(voiceQuestion.question_number) || 1,
        question: voiceQuestion.question,
        transcript,
        score,
        evaluation: evaluationData,
      };

      setVoiceAnswers((previous) => {
        const withoutCurrent = previous.filter(
          (item) =>
            String(item.question_id) !== String(savedAnswer.question_id),
        );
        return [...withoutCurrent, savedAnswer];
      });

      // Set this ONLY after the backend confirms the answer was saved.
      setVoiceEvaluation(evaluationData);
    } catch (error) {
      console.error("Evaluate and save voice answer error:", error);
      setVoiceError(error.message || "Unable to evaluate your spoken answer.");
    } finally {
      setVoiceSaving(false);
      setVoiceEvaluating(false);
    }
  };

  const loadVoiceProgress = async (interviewId = voiceSession?.id) => {
    if (!interviewId) return;

    try {
      const result = await requestJson(API.voiceProgress(interviewId), {
        method: "GET",
      });

      if (result?.success) {
        setVoiceProgress(result.data || {});
      }
    } catch (error) {
      console.warn("Voice interview progress error:", error);
    }
  };

  const nextVoiceQuestion = async () => {
    if (
      !voiceSession?.id ||
      !voiceQuestion ||
      !voiceEvaluation ||
      voiceSaving ||
      voiceEvaluating ||
      voiceQuestionLoading
    ) {
      return;
    }

    const currentNumber =
      Number(voiceQuestion.question_number) ||
      Number(voiceSession.question_number) ||
      1;
    const totalQuestions =
      Number(voiceSession.total_questions) || voiceTotalQuestions;

    if (currentNumber >= totalQuestions) {
      await completeVoiceInterview();
      return;
    }

    await loadVoiceProgress(voiceSession.id);
    await generateVoiceQuestion(voiceSession, currentNumber + 1);
  };

  const completeVoiceInterview = async () => {
    if (!voiceSession?.id || voiceCompleting) return;

    const confirmed = window.confirm(
      "Finish this voice interview? Your saved transcripts and evaluations will be included in the final report.",
    );

    if (!confirmed) return;

    stopVoiceListening();
    window.speechSynthesis?.cancel();
    setVoiceError("");

    const totalQuestions =
      Number(voiceSession.total_questions) || voiceTotalQuestions;

    let freshProgress = voiceProgress || {};

    try {
      const progressResult = await requestJson(
        API.voiceProgress(voiceSession.id),
        { method: "GET" },
      );

      if (progressResult?.success) {
        freshProgress = progressResult.data || {};
        setVoiceProgress(freshProgress);
      }
    } catch (error) {
      console.warn("Voice final progress check error:", error);
    }

    const persistedAnswerCount = Number(
      freshProgress?.answered_count ??
        freshProgress?.total_answers ??
        freshProgress?.answers_count ??
        0,
    );

    if (Math.max(persistedAnswerCount, voiceAnswers.length) < 1) {
      setVoiceError(
        "Please answer and evaluate at least one question before finishing the voice interview.",
      );
      return;
    }

    setVoiceCompleting(true);

    try {
      const result = await requestJson(
        API.voiceComplete(voiceSession.id, totalQuestions),
        { method: "POST" },
      );

      if (!result?.success) {
        throw new Error(
          result?.message || "Unable to complete the voice interview.",
        );
      }

      let finalProgress = result.data || freshProgress;

      try {
        const finalProgressResult = await requestJson(
          API.voiceProgress(voiceSession.id),
          { method: "GET" },
        );

        if (finalProgressResult?.success && finalProgressResult.data) {
          finalProgress = {
            ...finalProgress,
            ...finalProgressResult.data,
          };
        }
      } catch (error) {
        console.warn("Voice final progress refresh error:", error);
      }

      const resultAnswers = [...voiceAnswers].sort(
        (a, b) =>
          Number(a.question_number || 0) - Number(b.question_number || 0),
      );

      const completedResult = {
        progress: {
          ...finalProgress,
          interview_id: voiceSession.id,
          total_questions: totalQuestions,
          answered_count: Math.max(
            Number(finalProgress?.answered_count || 0),
            resultAnswers.length,
          ),
        },
        session: {
          ...voiceSession,
          total_questions: totalQuestions,
          status: "completed",
        },
        answers: resultAnswers,
      };

      setVoiceInterviewResult(completedResult);
      setVoiceProgress(completedResult.progress);
      setVoiceSession(completedResult.session);
      setVoiceQuestion(null);
      setVoiceTranscript("");
      setVoiceEvaluation(null);
      setVoiceInterviewMode(false);

      sessionStorage.removeItem(voiceInterviewStorageKey);
      sessionStorage.setItem(
        voiceInterviewResultStorageKey,
        JSON.stringify(completedResult),
      );

      // Refresh dashboard intelligence after a completed voice interview.
      setOverviewRefreshKey((value) => value + 1);

      navigate("/preparation-agent?mode=voice-interview-result", {
        replace: true,
        state: {
          voiceInterviewCompleted: true,
          progress: completedResult.progress,
          session: completedResult.session,
          answers: resultAnswers,
        },
      });
    } catch (error) {
      console.error("Complete voice interview error:", error);
      setVoiceError(error.message || "Unable to complete the voice interview.");
    } finally {
      setVoiceCompleting(false);
    }
  };

  const leaveVoiceInterview = () => {
    const confirmed = window.confirm(
      "Leave this voice interview? Unsaved speech may be lost.",
    );

    if (!confirmed) return;

    stopVoiceListening();
    window.speechSynthesis?.cancel();
    voiceGenerationSessionRef.current += 1;
    voiceQuestionRequestRef.current += 1;
    sessionStorage.removeItem(voiceInterviewStorageKey);

    setVoiceInterviewMode(false);
    setVoiceSession(null);
    setVoiceQuestion(null);
    setVoiceTranscript("");
    setVoiceEvaluation(null);
    setVoiceProgress(null);
    setVoiceError("");
    setVoiceAnswers([]);

    navigate("/preparation-agent", { replace: true });
  };

  const voiceScore = getVoiceScore(voiceEvaluation);
  const voiceFeedback = firstString(
    voiceEvaluation?.feedback,
    voiceEvaluation?.overall_feedback,
    voiceEvaluation?.comments,
    voiceEvaluation?.summary,
    voiceEvaluation?.evaluation,
  );

  const mockScore = getNumericValue(
    mockEvaluation?.score,
    mockEvaluation?.overall_score,
    mockEvaluation?.total_score,
  );

  const mockFeedback = firstString(
    mockEvaluation?.feedback,
    mockEvaluation?.overall_feedback,
    mockEvaluation?.comments,
    mockEvaluation?.summary,
  );

  const mockIdealAnswer = firstString(
    mockEvaluation?.reference_answer,
    mockEvaluation?.ideal_answer,
    mockEvaluation?.model_answer,
    mockEvaluation?.suggested_answer,
    mockEvaluation?.recommended_answer,
  );

  const mockAnswerVerdict = firstString(
    mockEvaluation?.answer_verdict,
    mockEvaluation?.verdict,
    "partially_correct",
  )
    .toLowerCase()
    .replace(/\s+/g, "_");
  const mockAnswerVerdictLabel =
    mockAnswerVerdict === "correct"
      ? "Correct answer"
      : mockAnswerVerdict === "incorrect"
        ? "Needs correction"
        : "Partially correct";
  const mockMatchedPoints = toArray(
    mockEvaluation?.matched_key_points || mockEvaluation?.matched_points,
  )
    .map(itemText)
    .filter(Boolean);
  const mockMissingPoints = toArray(
    mockEvaluation?.missing_or_incorrect_points ||
      mockEvaluation?.missing_points,
  )
    .map(itemText)
    .filter(Boolean);

  const mockStrengths = toArray(
    mockEvaluation?.strengths || mockEvaluation?.what_was_good,
  )
    .map(itemText)
    .filter(Boolean)
    .slice(0, 4);

  const mockImprovements = toArray(
    mockEvaluation?.improvements || mockEvaluation?.what_needs_improvement,
  )
    .map(itemText)
    .filter(Boolean)
    .slice(0, 4);

  const practiceScore = getNumericValue(
    evaluation?.score,
    evaluation?.overall_score,
    evaluation?.total_score,
  );

  const correctness = getNumericValue(
    evaluation?.correctness,
    evaluation?.correctness_score,
  );

  const technicalKnowledge = getNumericValue(
    evaluation?.technical_knowledge,
    evaluation?.technical_knowledge_score,
  );

  const relevance = getNumericValue(
    evaluation?.relevance,
    evaluation?.relevance_score,
  );

  const completeness = getNumericValue(
    evaluation?.completeness,
    evaluation?.completeness_score,
  );

  const communication = getNumericValue(
    evaluation?.communication,
    evaluation?.communication_score,
  );

  const evaluationFeedback = firstString(
    evaluation?.feedback,
    evaluation?.overall_feedback,
    evaluation?.comments,
  );

  const idealAnswer = firstString(
    evaluation?.ideal_answer,
    evaluation?.model_answer,
    evaluation?.suggested_answer,
  );

  const sessionActive = session?.status === "active";

  const scrollToPreparationSection = (id) => {
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };

  const openRoleForPractice = (role) => {
    const name = getRoleName(role);
    setTargetRole(name);
    scrollToPreparationSection("interview-practice");
  };

  /*
   * Internships in the preparation overview are produced by the backend
   * recommendation service. The backend uses `internship_id` as the
   * canonical database identifier, while different API versions may expose
   * the same identifier as `id`, `internshipId`, `pk`, or inside an
   * `internship` object.
   *
   * Always resolve the real database id before navigating. Never navigate
   * with an undefined id because the internship details page requires the
   * route parameter `/internships/:internshipId`.
   */
  const getInternshipId = (internship) => {
    if (!internship || typeof internship !== "object") {
      return "";
    }

    const isUsableInternshipId = (value) => {
      const normalized = firstString(value).trim();
      if (!normalized) return false;

      return !new Set(["undefined", "null", "nan", "[object object]"]).has(
        normalized.toLowerCase(),
      );
    };

    const directId = firstString(
      internship.id,
      internship.internship_id,
      internship.internshipId,
      internship.internshipID,
      internship.pk,
      internship.uuid,
      internship._id,
    );

    if (isUsableInternshipId(directId)) {
      return directId.trim();
    }

    const nested = internship.internship;
    if (nested && typeof nested === "object") {
      const nestedId = firstString(
        nested.id,
        nested.internship_id,
        nested.internshipId,
        nested.internshipID,
        nested.pk,
        nested.uuid,
        nested._id,
      );

      return isUsableInternshipId(nestedId) ? nestedId.trim() : "";
    }

    return "";
  };

  const openInternship = (internship) => {
    const internshipId = getInternshipId(internship);

    if (!internshipId) {
      /*
       * Do not construct `/internships/undefined` and do not silently route
       * to the detail page without an id. Open the real internship listing
       * instead, preserving the selected internship information so the
       * listing page can still be used safely.
       */
      const title = getInternshipTitle(internship);
      const company = getInternshipCompany(internship);

      const params = new URLSearchParams();
      if (title && title !== "Internship") {
        params.set("title", title);
      }
      if (company && company !== "Company") {
        params.set("company", company);
      }

      navigate(
        params.toString()
          ? `/internships?${params.toString()}`
          : "/internships",
      );
      return;
    }

    const normalizedId = String(internshipId);

    navigate(`/internships/${encodeURIComponent(normalizedId)}`, {
      state: {
        internshipId: normalizedId,
        internship_id: normalizedId,
        internship,
      },
    });
  };

  const handlePreparationAction = (prompt) => {
    setChatOpen(true);
    setChatHistoryOpen(false);
    window.setTimeout(() => {
      document
        .getElementById("preparation-ai-chat")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      inputRef.current?.focus();
      if (prompt) {
        window.setTimeout(() => sendMessage(prompt), 120);
      }
    }, 140);
  };

  useEffect(() => {
    if (chatOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [chatOpen]);

  const showChatSuggestions =
    messages.length <= 1 && !message.trim() && !chatLoading;

  if (
    new URLSearchParams(location.search).get("mode") ===
    "voice-interview-result"
  ) {
    if (!voiceInterviewResult?.progress && !voiceInterviewResult?.session) {
      return (
        <div className="voice-result-page">
          <style>{`
            .voice-result-page{min-height:100vh;padding:40px 24px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f7f8ff,#eef4ff);color:#172033}
            .voice-result-card{width:min(720px,100%);background:rgba(255,255,255,.94);border:1px solid rgba(120,100,200,.14);border-radius:28px;padding:44px;box-shadow:0 24px 80px rgba(35,45,90,.12);text-align:center}
            .voice-result-icon{width:64px;height:64px;border-radius:20px;display:grid;place-items:center;margin:0 auto 18px;background:#eefaf3;color:#16945b}
            .voice-result-card h1{margin:0 0 10px;font-size:32px}
            .voice-result-card p{margin:0 0 26px;color:#687189;line-height:1.6}
            .voice-result-button{border:0;border-radius:12px;padding:12px 18px;background:#5b4ce2;color:white;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:8px}
          `}</style>
          <div className="voice-result-card">
            <div className="voice-result-icon">
              <ShieldCheck size={28} />
            </div>
            <h1>No completed voice interview was found.</h1>
            <p>Start a new voice interview from your preparation dashboard.</p>
            <button
              type="button"
              className="voice-result-button"
              onClick={() => navigate("/preparation-agent", { replace: true })}
            >
              <ArrowLeft size={15} />
              Back to preparation
            </button>
          </div>
        </div>
      );
    }

    const resultProgress = voiceInterviewResult?.progress || {};
    const resultSession = voiceInterviewResult?.session || {};
    const resultAnswers = Array.isArray(voiceInterviewResult?.answers)
      ? voiceInterviewResult.answers
      : [];
    const averageScore = getNumericValue(
      resultProgress.average_score,
      resultProgress.avg_score,
      resultProgress.score,
    );
    const totalQuestions =
      getNumericValue(
        resultProgress.total_questions,
        resultSession.total_questions,
        voiceTotalQuestions,
      ) || 0;
    const answeredCount =
      getNumericValue(
        resultProgress.answered_count,
        resultProgress.total_answers,
        resultProgress.answers_count,
      ) ?? resultAnswers.length;
    const completionRate = clampPercent(
      totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0,
    );

    const restartVoiceInterview = () => {
      sessionStorage.removeItem(voiceInterviewResultStorageKey);
      sessionStorage.removeItem(voiceInterviewStorageKey);
      voiceGenerationSessionRef.current += 1;
      voiceQuestionRequestRef.current += 1;
      setVoiceInterviewResult(null);
      setVoiceAnswers([]);
      setSessionType("voice_interview");
      setCategory(resultSession.category || category || "mixed");
      setDifficulty(resultSession.difficulty || difficulty || "medium");
      setTargetRole(resultSession.target_role || targetRole || strongestRole);
      setVoiceTotalQuestions(totalQuestions || voiceTotalQuestions);
      navigate("/preparation-agent", { replace: true });
      window.setTimeout(
        () => scrollToPreparationSection("interview-practice"),
        80,
      );
    };

    const backToPreparation = () => {
      sessionStorage.removeItem(voiceInterviewResultStorageKey);
      setVoiceInterviewResult(null);
      setVoiceAnswers([]);
      navigate("/preparation-agent", { replace: true });
    };

    return (
      <div className="voice-result-page">
        <style>{`
          .voice-result-page{min-height:100vh;padding:28px 22px 60px;background:radial-gradient(circle at 15% 10%,rgba(112,92,235,.13),transparent 30%),radial-gradient(circle at 90% 20%,rgba(44,166,255,.12),transparent 28%),linear-gradient(135deg,#f8f9ff,#eef4ff);color:#172033}
          .voice-result-shell{width:min(1080px,100%);margin:0 auto}
          .voice-result-topbar{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:22px}
          .voice-result-back,.voice-result-restart{border:1px solid rgba(93,83,180,.14);background:rgba(255,255,255,.82);color:#3e4560;border-radius:12px;padding:10px 14px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:8px}
          .voice-result-restart{background:#5b4ce2;color:white;border-color:#5b4ce2}
          .voice-result-brand{display:flex;align-items:center;gap:11px}
          .voice-result-brand-icon{width:38px;height:38px;border-radius:12px;background:#5b4ce2;color:white;display:grid;place-items:center}
          .voice-result-brand strong,.voice-result-brand span{display:block}
          .voice-result-brand span{font-size:12px;color:#778098;margin-top:2px}
          .voice-result-hero{background:rgba(255,255,255,.88);border:1px solid rgba(105,93,190,.13);border-radius:26px;padding:30px;box-shadow:0 20px 70px rgba(39,48,90,.09)}
          .voice-result-kicker{font-size:11px;letter-spacing:.16em;color:#6a5be2;font-weight:800}
          .voice-result-hero h1{font-size:34px;margin:8px 0 7px}
          .voice-result-hero p{color:#707991;margin:0}
          .voice-result-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:24px}
          .voice-result-metric{padding:17px;border-radius:16px;background:#f7f8fd;border:1px solid #eceefa}
          .voice-result-metric span{display:block;color:#7c8499;font-size:12px}
          .voice-result-metric strong{display:block;font-size:23px;margin-top:5px}
          .voice-result-section{margin-top:16px;background:rgba(255,255,255,.9);border:1px solid rgba(105,93,190,.12);border-radius:22px;padding:24px}
          .voice-result-section h2{margin:0 0 5px;font-size:20px}
          .voice-result-section>p{margin:0 0 18px;color:#778098}
          .voice-answer-item{border:1px solid #e8eaf3;border-radius:16px;overflow:hidden;margin-top:10px;background:#fff}
          .voice-answer-summary{padding:15px 17px;display:flex;align-items:center;justify-content:space-between;gap:12px}
          .voice-answer-number{font-size:11px;letter-spacing:.1em;color:#7a8297;font-weight:800}
          .voice-answer-question{font-weight:700;margin-top:4px}
          .voice-answer-score{min-width:58px;text-align:center;border-radius:10px;padding:8px 9px;font-weight:800;background:#f2efff;color:#594bd1}
          .voice-answer-body{padding:0 17px 17px;border-top:1px solid #eef0f6}
          .voice-answer-body h4{margin:14px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#788097}
          .voice-answer-body p{margin:0;color:#4f586e;line-height:1.65;white-space:pre-wrap}
          .voice-result-actions{display:flex;justify-content:center;gap:10px;margin-top:20px}
          .voice-result-primary{border:0;background:#5b4ce2;color:white;border-radius:12px;padding:12px 17px;font-weight:800;cursor:pointer}
          @media(max-width:760px){.voice-result-topbar{flex-wrap:wrap}.voice-result-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.voice-result-hero h1{font-size:28px}}
          @media(max-width:480px){.voice-result-page{padding:18px 12px 40px}.voice-result-metrics{grid-template-columns:1fr 1fr}.voice-result-section,.voice-result-hero{padding:18px}}
        `}</style>

        <div className="voice-result-shell">
          <header className="voice-result-topbar">
            <button
              type="button"
              className="voice-result-back"
              onClick={backToPreparation}
            >
              <ArrowLeft size={15} />
              Preparation dashboard
            </button>

            <div className="voice-result-brand">
              <div className="voice-result-brand-icon">
                <Mic size={18} />
              </div>
              <div>
                <strong>AI Voice Interview</strong>
                <span>Interview report</span>
              </div>
            </div>

            <button
              type="button"
              className="voice-result-restart"
              onClick={restartVoiceInterview}
            >
              <Rocket size={15} />
              Practice again
            </button>
          </header>

          <section className="voice-result-hero">
            <span className="voice-result-kicker">
              VOICE INTERVIEW COMPLETE
            </span>
            <h1>{resultSession.target_role || strongestRole}</h1>
            <p>
              {resultSession.category || category} ·{" "}
              {resultSession.difficulty || difficulty} difficulty
            </p>

            <div className="voice-result-metrics">
              <div className="voice-result-metric">
                <span>Average score</span>
                <strong>
                  {averageScore !== null ? `${averageScore}/10` : "—"}
                </strong>
              </div>
              <div className="voice-result-metric">
                <span>Answered</span>
                <strong>
                  {answeredCount}/{totalQuestions}
                </strong>
              </div>
              <div className="voice-result-metric">
                <span>Completion</span>
                <strong>{Math.round(completionRate)}%</strong>
              </div>
              <div className="voice-result-metric">
                <span>Status</span>
                <strong>Completed</strong>
              </div>
            </div>
          </section>

          <section className="voice-result-section">
            <h2>Spoken answer review</h2>
            <p>
              Your browser transcript and AI evaluation are shown below. Only
              the transcript and evaluation were persisted; raw microphone audio
              was not uploaded.
            </p>

            {resultAnswers.length > 0 ? (
              resultAnswers.map((item, index) => {
                const score = getVoiceScore(item.evaluation) ?? item.score;
                const feedback = firstString(
                  item.evaluation?.feedback,
                  item.evaluation?.overall_feedback,
                  item.evaluation?.comments,
                  item.evaluation?.summary,
                  item.evaluation?.evaluation,
                );

                return (
                  <details
                    className="voice-answer-item"
                    key={`${item.question_id || index}-${index}`}
                  >
                    <summary className="voice-answer-summary">
                      <div>
                        <div className="voice-answer-number">
                          QUESTION {Number(item.question_number) || index + 1}
                        </div>
                        <div className="voice-answer-question">
                          {item.question || "Interview question"}
                        </div>
                      </div>
                      <span className="voice-answer-score">
                        {score !== null && score !== undefined
                          ? `${score}/10`
                          : "—"}
                      </span>
                    </summary>

                    <div className="voice-answer-body">
                      <h4>Your spoken answer</h4>
                      <p>{item.transcript || "No transcript available."}</p>

                      <h4>AI evaluation</h4>
                      <p>
                        {feedback || "Evaluation details are not available."}
                      </p>
                    </div>
                  </details>
                );
              })
            ) : (
              <div className="voice-answer-item">
                <div className="voice-answer-body">
                  <p>No local answer details were available for this report.</p>
                </div>
              </div>
            )}
          </section>

          <div className="voice-result-actions">
            <button
              type="button"
              className="voice-result-back"
              onClick={backToPreparation}
            >
              <ArrowLeft size={15} />
              Back to preparation
            </button>
            <button
              type="button"
              className="voice-result-primary"
              onClick={restartVoiceInterview}
            >
              <Mic size={15} />
              Start another voice interview
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (
    new URLSearchParams(location.search).get("mode") === "mock-interview-result"
  ) {
    if (!mockInterviewResult?.progress && !mockInterviewResult?.session) {
      return (
        <div className="mock-result-page mock-result-empty">
          <div className="mock-result-empty-card">
            <div className="mock-result-success-icon">
              <ShieldCheck size={28} />
            </div>
            <span className="mock-result-kicker">NO INTERVIEW RESULT</span>
            <h1>No completed interview was found.</h1>
            <p>Start a new mock interview from your preparation dashboard.</p>
            <button
              type="button"
              className="mock-result-primary"
              onClick={() => navigate("/preparation-agent", { replace: true })}
            >
              <ArrowLeft size={15} /> Back to preparation
            </button>
          </div>
        </div>
      );
    }

    const resultProgress = mockInterviewResult?.progress || {};
    const resultSession = mockInterviewResult?.session || {};
    const averageScore = getNumericValue(
      resultProgress.average_score,
      resultProgress.avg_score,
      resultProgress.score,
    );
    const totalQuestions =
      getNumericValue(
        resultProgress.total_questions,
        resultSession.total_questions,
        mockTotalQuestions,
      ) || 0;
    const totalAnswers =
      getNumericValue(
        resultProgress.total_answers,
        resultProgress.answers_count,
        resultProgress.evaluated_answers,
        resultProgress.answered_questions,
        resultProgress.completed_questions,
      ) ?? 0;
    const completionRate = clampPercent(
      getNumericValue(
        resultProgress.completion_rate,
        totalQuestions ? (totalAnswers / totalQuestions) * 100 : 0,
      ),
    );
    const derivedReadiness =
      averageScore === null
        ? "not_started"
        : averageScore >= 8
          ? "strong"
          : averageScore >= 6
            ? "developing"
            : "needs_improvement";
    const backendReadiness = firstString(resultProgress.readiness);
    const readiness =
      backendReadiness && backendReadiness !== "not_started"
        ? backendReadiness
        : derivedReadiness;
    const readinessLabel = readiness.replaceAll("_", " ");

    const goToDashboard = () => {
      sessionStorage.removeItem(mockInterviewResultStorageKey);
      setMockInterviewResult(null);
      setExpandedMockResultIds(new Set());
      setOverviewRefreshKey((value) => value + 1);
      navigate("/preparation-agent", { replace: true });
    };

    const restartMockInterview = () => {
      sessionStorage.removeItem(mockInterviewResultStorageKey);
      sessionStorage.removeItem(mockInterviewStorageKey);
      mockGenerationSessionRef.current += 1;
      mockQuestionRequestRef.current += 1;
      setMockInterviewResult(null);
      setExpandedMockResultIds(new Set());
      setSessionType("mock_interview");
      setCategory(resultSession.category || category || "mixed");
      setDifficulty(resultSession.difficulty || difficulty || "medium");
      setTargetRole(resultSession.target_role || targetRole || strongestRole);
      navigate("/preparation-agent", { replace: true });
      window.setTimeout(
        () => scrollToPreparationSection("interview-practice"),
        80,
      );
    };

    return (
      <div className="mock-result-page">
        <div className="mock-result-background" />
        <header className="mock-result-topbar">
          <button
            type="button"
            className="mock-result-back"
            onClick={goToDashboard}
          >
            <ArrowLeft size={16} />
            Preparation dashboard
          </button>
          <div className="mock-result-brand">
            <div className="mock-result-brand-icon">
              <Award size={18} />
            </div>
            <div>
              <strong>AI Mock Interview</strong>
              <span>Interview report</span>
            </div>
          </div>
          <button
            type="button"
            className="mock-result-primary"
            onClick={restartMockInterview}
          >
            <Rocket size={15} /> Restart interview
          </button>
        </header>

        <main className="mock-result-container">
          <section className="mock-result-hero-card">
            <div className="mock-result-success-icon">
              <CheckCircle2 size={31} />
            </div>
            <span className="mock-result-kicker">INTERVIEW COMPLETED</span>
            <h1>Your mock interview is complete.</h1>
            <p>
              Review your performance below. Your evaluation was generated from
              the answers you submitted during this interview.
            </p>
            <div className="mock-result-role">
              <span>{resultSession.target_role || strongestRole}</span>
              <span>{resultSession.category || category}</span>
              <span>{resultSession.difficulty || difficulty}</span>
            </div>
          </section>

          <section className="mock-result-summary-grid">
            <div className="mock-result-score-card">
              <span className="mock-result-card-label">OVERALL SCORE</span>
              <strong>
                {averageScore === null ? "—" : `${averageScore}/10`}
              </strong>
              <div className="mock-result-score-track">
                <span
                  style={{
                    width: `${clampPercent((averageScore || 0) * 10)}%`,
                  }}
                />
              </div>
              <small>{readinessLabel}</small>
            </div>
            <div className="mock-result-stat-card">
              <span>QUESTIONS</span>
              <strong>{totalQuestions}</strong>
              <small>Interview questions</small>
            </div>
            <div className="mock-result-stat-card">
              <span>ANSWERS</span>
              <strong>{totalAnswers}</strong>
              <small>Evaluated answers</small>
            </div>
            <div className="mock-result-stat-card">
              <span>COMPLETION</span>
              <strong>{Math.round(completionRate)}%</strong>
              <small>Interview progress</small>
            </div>
          </section>

          <section className="mock-result-detail-grid">
            <div className="mock-result-panel">
              <div className="mock-result-panel-heading">
                <div>
                  <span>PERFORMANCE</span>
                  <h2>Interview readiness</h2>
                </div>
                <TrendingUp size={20} />
              </div>
              <div className="mock-result-readiness">
                <div className={`mock-result-readiness-icon ${readiness}`}>
                  <Target size={20} />
                </div>
                <div>
                  <strong>{readinessLabel}</strong>
                  <p>
                    {averageScore === null
                      ? "Complete more evaluated answers to build a readiness score."
                      : averageScore >= 8
                        ? "You are showing strong interview readiness. Keep refining your explanations."
                        : averageScore >= 6
                          ? "You are developing well. Focus on the improvement areas from your evaluations."
                          : "More practice will help strengthen your interview performance and confidence."}
                  </p>
                </div>
              </div>
            </div>

            <div className="mock-result-panel">
              <div className="mock-result-panel-heading">
                <div>
                  <span>NEXT STEP</span>
                  <h2>Keep improving</h2>
                </div>
                <Lightbulb size={20} />
              </div>
              <p className="mock-result-next-text">
                Use your preparation roadmap and weak-topic analysis to target
                the areas that need the most improvement before your next real
                interview.
              </p>
              <button
                type="button"
                className="mock-result-secondary"
                onClick={goToDashboard}
              >
                Open preparation dashboard <ChevronRight size={15} />
              </button>
            </div>
          </section>

          <section className="mock-result-evaluations">
            <div className="mock-result-section-header">
              <div>
                <span className="mock-result-section-kicker">
                  DETAILED EVALUATION
                </span>
                <h2>Question-by-question performance</h2>
                <p>
                  Expand a question to review your answer, the correct reference
                  answer, AI scoring and actionable feedback.
                </p>
              </div>
              <div className="mock-result-section-badge">
                <CheckCircle2 size={16} /> AI evaluated
              </div>
            </div>

            <div className="mock-result-evaluation-list">
              {Array.isArray(resultProgress.answer_evaluations) &&
              resultProgress.answer_evaluations.length > 0 ? (
                resultProgress.answer_evaluations.map((item, index) => {
                  const parsed = {
                    ...(item || {}),
                    ...normalizeMockEvaluation(item?.evaluation),
                  };
                  const evaluationId =
                    item?.question_id || `evaluation-${index}`;
                  const isExpanded = expandedMockResultIds.has(evaluationId);
                  const itemScore = getNumericValue(item?.score, parsed?.score);
                  const verdict = firstString(
                    parsed?.answer_verdict,
                    parsed?.verdict,
                    "partially_correct",
                  )
                    .toLowerCase()
                    .replace(/\s+/g, "_");
                  const safeVerdict = [
                    "correct",
                    "partially_correct",
                    "incorrect",
                  ].includes(verdict)
                    ? verdict
                    : "partially_correct";
                  const verdictLabel =
                    safeVerdict === "correct"
                      ? "Correct"
                      : safeVerdict === "incorrect"
                        ? "Incorrect"
                        : "Partially correct";
                  const answerText = firstString(
                    item?.answer,
                    parsed?.candidate_answer,
                    "No candidate answer was recorded.",
                  );
                  const referenceText = firstString(
                    parsed?.reference_answer,
                    parsed?.ideal_answer,
                    parsed?.recommended_answer,
                    item?.reference_answer,
                    "A reference answer could not be generated for this question. Please retry the evaluation.",
                  );
                  const metricFallback = itemScore !== null ? itemScore : null;
                  const metrics = [
                    [
                      "Correctness",
                      getNumericValue(
                        parsed?.correctness,
                        parsed?.correctness_score,
                        item?.correctness,
                        metricFallback,
                      ),
                    ],
                    [
                      "Technical knowledge",
                      getNumericValue(
                        parsed?.technical_knowledge,
                        parsed?.technical_knowledge_score,
                        item?.technical_knowledge,
                        metricFallback,
                      ),
                    ],
                    [
                      "Relevance",
                      getNumericValue(
                        parsed?.relevance,
                        parsed?.relevance_score,
                        item?.relevance,
                        metricFallback,
                      ),
                    ],
                    [
                      "Completeness",
                      getNumericValue(
                        parsed?.completeness,
                        parsed?.completeness_score,
                        item?.completeness,
                        metricFallback,
                      ),
                    ],
                    [
                      "Communication",
                      getNumericValue(
                        parsed?.communication,
                        parsed?.communication_score,
                        item?.communication,
                        metricFallback,
                      ),
                    ],
                  ];
                  const expectedKeywords = toArray(
                    parsed?.expected_keywords || parsed?.key_points,
                  )
                    .map(itemText)
                    .filter(Boolean);
                  const keywordCoverage = getNumericValue(
                    parsed?.keyword_coverage,
                    expectedKeywords.length > 0
                      ? (toArray(
                          parsed?.matched_key_points || parsed?.matched_points,
                        ).length /
                          expectedKeywords.length) *
                          100
                      : null,
                  );
                  const matched = toArray(
                    parsed?.matched_key_points || parsed?.matched_points,
                  )
                    .map(itemText)
                    .filter(Boolean);
                  const missing = toArray(
                    parsed?.missing_or_incorrect_points ||
                      parsed?.missing_points,
                  )
                    .map(itemText)
                    .filter(Boolean);
                  const strengths = toArray(
                    parsed?.strengths || parsed?.what_was_good,
                  )
                    .map(itemText)
                    .filter(Boolean);
                  const improvements = toArray(
                    parsed?.improvements || parsed?.what_needs_improvement,
                  )
                    .map(itemText)
                    .filter(Boolean);

                  const keywordCoverageValue = keywordCoverage;

                  const toggleEvaluation = () => {
                    setExpandedMockResultIds((previous) => {
                      const next = new Set(previous);
                      if (next.has(evaluationId)) next.delete(evaluationId);
                      else next.add(evaluationId);
                      return next;
                    });
                  };

                  return (
                    <article
                      className={`mock-result-evaluation-item ${isExpanded ? "is-expanded" : ""}`}
                      key={evaluationId}
                    >
                      <button
                        type="button"
                        className="mock-result-evaluation-toggle"
                        onClick={toggleEvaluation}
                        aria-expanded={isExpanded}
                      >
                        <div className="mock-result-question-index">
                          Q{item?.question_number || index + 1}
                        </div>
                        <div className="mock-result-evaluation-item-title">
                          <span>
                            {item?.question_number
                              ? `QUESTION ${item.question_number}`
                              : `QUESTION ${index + 1}`}
                          </span>
                          <h3>
                            {item?.question ||
                              `Interview question ${index + 1}`}
                          </h3>
                        </div>
                        <div className="mock-result-evaluation-toggle-right">
                          <span
                            className={`mock-result-verdict-pill verdict-${safeVerdict}`}
                          >
                            {verdictLabel}
                          </span>
                          <span
                            className={`mock-result-score-pill ${itemScore !== null && itemScore >= 7 ? "score-good" : itemScore !== null && itemScore >= 5 ? "score-average" : "score-low"}`}
                          >
                            {itemScore !== null ? `${itemScore}/10` : "N/A"}
                          </span>
                          <span
                            className={`mock-result-plus ${isExpanded ? "is-open" : ""}`}
                            aria-hidden="true"
                          >
                            +
                          </span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="mock-result-evaluation-content">
                          <div className="mock-result-answer-comparison">
                            <div
                              className={`mock-result-answer-box candidate-answer verdict-${safeVerdict}`}
                            >
                              <div className="mock-result-answer-heading mock-result-answer-heading-row">
                                <div>
                                  <span>YOUR ANSWER</span>
                                  <strong>Candidate response</strong>
                                </div>
                                <span
                                  className={`mock-answer-verdict verdict-${safeVerdict}`}
                                >
                                  {verdictLabel}
                                </span>
                              </div>
                              <p>{answerText}</p>
                            </div>
                            <div className="mock-result-answer-box ideal-answer verdict-correct">
                              <div className="mock-result-answer-heading mock-result-answer-heading-row">
                                <div>
                                  <span>CORRECT ANSWER</span>
                                  <strong>Correct answer</strong>
                                </div>
                                <span className="mock-answer-verdict verdict-correct">
                                  Model answer
                                </span>
                              </div>
                              <p>{referenceText}</p>
                            </div>
                          </div>

                          {keywordCoverageValue !== null && (
                            <div className="mock-result-keyword-coverage">
                              <div className="mock-result-keyword-heading">
                                <span>KEYWORD / CONCEPT COVERAGE</span>
                                <strong>
                                  {Math.round(keywordCoverageValue)}%
                                </strong>
                              </div>
                              <div className="mock-result-keyword-track">
                                <span
                                  style={{
                                    width: `${clampPercent(keywordCoverageValue)}%`,
                                  }}
                                />
                              </div>
                              <small>
                                {matched.length} of {expectedKeywords.length}{" "}
                                expected concepts found in your answer.
                              </small>
                            </div>
                          )}

                          <div className="mock-result-metric-grid">
                            {metrics.map(([label, value]) => (
                              <div
                                className="mock-result-metric-card"
                                key={label}
                              >
                                <span>{label}</span>
                                <strong>
                                  {getNumericValue(value) !== null
                                    ? `${getNumericValue(value)}/10`
                                    : "N/A"}
                                </strong>
                                <div className="mock-result-mini-track">
                                  <span
                                    style={{
                                      width: `${clampPercent((getNumericValue(value) || 0) * 10)}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          {(matched.length > 0 || missing.length > 0) && (
                            <div className="mock-answer-point-grid">
                              {matched.length > 0 && (
                                <div className="mock-answer-points mock-answer-points-correct">
                                  <strong>Matched key points</strong>
                                  <ul>
                                    {matched.map((point, i) => (
                                      <li key={`match-${index}-${i}`}>
                                        {point}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {missing.length > 0 && (
                                <div className="mock-answer-points mock-answer-points-wrong">
                                  <strong>Missing or incorrect</strong>
                                  <ul>
                                    {missing.map((point, i) => (
                                      <li key={`missing-${index}-${i}`}>
                                        {point}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {parsed?.feedback && (
                            <div className="mock-result-feedback-block">
                              <strong>Interviewer feedback</strong>
                              <p>{parsed.feedback}</p>
                            </div>
                          )}

                          {(strengths.length > 0 ||
                            improvements.length > 0) && (
                            <div className="mock-result-feedback-columns">
                              {strengths.length > 0 && (
                                <div className="result-feedback-positive">
                                  <strong>What went well</strong>
                                  <ul>
                                    {strengths.map((value, i) => (
                                      <li key={`strength-${index}-${i}`}>
                                        {value}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {improvements.length > 0 && (
                                <div className="result-feedback-improvements">
                                  <strong>What to improve</strong>
                                  <ul>
                                    {improvements.map((value, i) => (
                                      <li key={`improvement-${index}-${i}`}>
                                        {value}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })
              ) : (
                <div className="mock-result-no-evaluations">
                  <CheckCircle2 size={22} />
                  <strong>No evaluated answers were saved.</strong>
                  <p>
                    Complete and save at least one answer to generate the
                    detailed interview evaluation.
                  </p>
                </div>
              )}
            </div>
          </section>

          <div className="mock-result-actions">
            <button
              type="button"
              className="mock-result-secondary"
              onClick={goToDashboard}
            >
              <ArrowLeft size={15} /> Back to preparation
            </button>
            <button
              type="button"
              className="mock-result-primary"
              onClick={restartMockInterview}
            >
              <Rocket size={15} /> Practice again
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (voiceInterviewMode) {
    const questionNumber = Number(
      voiceQuestion?.question_number || voiceSession?.question_number || 1,
    );
    const totalQuestions =
      Number(voiceSession?.total_questions) || voiceTotalQuestions;
    const answeredCount = Number(
      voiceProgress?.answered_count ?? voiceAnswers.length ?? 0,
    );
    const voicePercent = clampPercent(
      totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0,
    );

    return (
      <div className="voice-interview-page">
        <style>{`
          .voice-interview-page{min-height:100vh;padding:22px;background:radial-gradient(circle at 12% 10%,rgba(103,85,235,.13),transparent 28%),radial-gradient(circle at 88% 18%,rgba(47,164,255,.12),transparent 26%),linear-gradient(135deg,#f8f9ff,#edf3ff);color:#172033}
          .voice-interview-shell{width:min(1180px,100%);margin:0 auto}
          .voice-interview-topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}
          .voice-back-button,.voice-finish-button{border:1px solid rgba(90,82,176,.14);background:rgba(255,255,255,.84);color:#444b62;border-radius:12px;padding:10px 14px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:8px}
          .voice-finish-button{background:#5b4ce2;border-color:#5b4ce2;color:white}
          .voice-finish-button:disabled,.voice-back-button:disabled{opacity:.55;cursor:not-allowed}
          .voice-brand{display:flex;align-items:center;gap:11px}
          .voice-brand-icon{width:40px;height:40px;border-radius:13px;background:#5b4ce2;color:white;display:grid;place-items:center;box-shadow:0 10px 25px rgba(91,76,226,.2)}
          .voice-brand strong,.voice-brand span{display:block}
          .voice-brand span{font-size:12px;color:#788197;margin-top:2px}
          .voice-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px}
          .voice-main-card,.voice-side-card{background:rgba(255,255,255,.9);border:1px solid rgba(100,91,184,.13);border-radius:24px;box-shadow:0 18px 60px rgba(36,45,90,.08)}
          .voice-main-card{padding:28px}
          .voice-session-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}
          .voice-overline{font-size:11px;letter-spacing:.15em;color:#6859dc;font-weight:900}
          .voice-session-heading h1{font-size:30px;margin:7px 0 6px}
          .voice-session-heading p{margin:0;color:#758097}
          .voice-counter{min-width:88px;text-align:center;padding:11px 12px;border:1px solid #ececf6;border-radius:15px;background:#fafaff}
          .voice-counter span,.voice-counter small{display:block;font-size:10px;color:#8a91a4;font-weight:800;letter-spacing:.1em}
          .voice-counter strong{display:inline-block;font-size:25px;margin:3px 2px 0}
          .voice-progress-track{height:7px;background:#eceef7;border-radius:999px;overflow:hidden;margin:22px 0}
          .voice-progress-track span{display:block;height:100%;background:linear-gradient(90deg,#5b4ce2,#43a7ff);border-radius:inherit;transition:width .25s ease}
          .voice-error{display:flex;gap:8px;align-items:flex-start;padding:11px 13px;border-radius:12px;background:#fff2f2;color:#b23b45;border:1px solid #f4d5d8;margin-bottom:15px;font-size:13px;line-height:1.5}
          .voice-loading{min-height:400px;display:grid;place-items:center;text-align:center;color:#687188}
          .voice-loading-icon{width:68px;height:68px;border-radius:22px;display:grid;place-items:center;margin:0 auto 14px;background:#f1efff;color:#5b4ce2}
          .voice-question-card{padding:24px;border-radius:19px;background:linear-gradient(145deg,#fafaff,#f5f7ff);border:1px solid #e9eaf6}
          .voice-question-meta{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px}
          .voice-question-meta span{font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:800;color:#6256ce;background:#efedff;border-radius:999px;padding:6px 8px}
          .voice-question-label{font-size:10px;letter-spacing:.14em;color:#7e879b;font-weight:900}
          .voice-question-card h2{font-size:24px;line-height:1.4;margin:9px 0 0}
          .voice-listening-panel{margin-top:16px;border:1px solid #e7e9f3;border-radius:19px;padding:21px;text-align:center;background:#fff}
          .voice-mic-orb{width:82px;height:82px;border-radius:50%;margin:0 auto 14px;display:grid;place-items:center;background:#f0eeff;color:#5b4ce2;box-shadow:0 0 0 8px rgba(91,76,226,.06)}
          .voice-mic-orb.listening{animation:voicePulse 1.35s infinite;background:#5b4ce2;color:white}
          @keyframes voicePulse{0%,100%{box-shadow:0 0 0 0 rgba(91,76,226,.25)}50%{box-shadow:0 0 0 18px rgba(91,76,226,0)}}
          .voice-listening-panel strong{display:block;font-size:16px}
          .voice-listening-panel p{margin:5px 0 0;color:#7a8296;font-size:13px}
          .voice-transcript{margin-top:16px;padding:16px;border-radius:15px;background:#f8f9fd;border:1px solid #eceef5;min-height:100px;text-align:left;white-space:pre-wrap;color:#465069;line-height:1.65}
          .voice-transcript.empty{color:#969daf}
          .voice-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:16px;justify-content:center}
          .voice-primary-action,.voice-secondary-action{border-radius:12px;padding:11px 15px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px}
          .voice-primary-action{border:0;background:#5b4ce2;color:white}
          .voice-secondary-action{border:1px solid #dfe2ed;background:white;color:#4f5870}
          .voice-primary-action:disabled,.voice-secondary-action:disabled{opacity:.5;cursor:not-allowed}
          .voice-evaluation{margin-top:16px;padding:18px;border-radius:17px;background:#f6fbf8;border:1px solid #d7efdf}
          .voice-evaluation-header{display:flex;align-items:center;justify-content:space-between;gap:12px}
          .voice-evaluation-header span{font-size:10px;letter-spacing:.12em;color:#27845a;font-weight:900}
          .voice-score{font-size:23px;font-weight:900;color:#19784f}
          .voice-evaluation p{margin:11px 0 0;color:#4e5b67;line-height:1.65;white-space:pre-wrap}
          .voice-save-status{display:flex;align-items:center;gap:8px;margin-top:12px;color:#1d8758;font-size:13px;font-weight:800}
          .voice-side-card{padding:21px;height:max-content}
          .voice-side-icon{width:38px;height:38px;border-radius:12px;background:#f0eeff;color:#5b4ce2;display:grid;place-items:center}
          .voice-side-card>span{display:block;font-size:10px;letter-spacing:.13em;color:#80879a;font-weight:900;margin-top:13px}
          .voice-side-card h3{font-size:18px;margin:6px 0}
          .voice-side-card>p{color:#747d91;font-size:13px;line-height:1.6;margin:0}
          .voice-side-divider{height:1px;background:#eceef5;margin:17px 0}
          .voice-side-stat{display:flex;justify-content:space-between;gap:10px;padding:7px 0;font-size:13px}
          .voice-side-stat span{color:#7b8396}
          .voice-side-stat strong{text-transform:capitalize}
          .voice-side-tip{margin-top:15px;padding:13px;border-radius:14px;background:#f8f6ff;display:flex;gap:9px;color:#5b4ce2}
          .voice-side-tip p{margin:3px 0 0;color:#6f778b;font-size:12px;line-height:1.5}
          @media(max-width:860px){.voice-layout{grid-template-columns:1fr}.voice-side-card{display:none}}
          @media(max-width:600px){.voice-interview-page{padding:12px}.voice-main-card{padding:18px}.voice-session-heading h1{font-size:24px}.voice-question-card h2{font-size:20px}.voice-interview-topbar{align-items:flex-start}.voice-brand{display:none}.voice-actions{flex-direction:column}.voice-primary-action,.voice-secondary-action{width:100%}}
        `}</style>

        <div className="voice-interview-shell">
          <header className="voice-interview-topbar">
            <button
              type="button"
              className="voice-back-button"
              onClick={leaveVoiceInterview}
              disabled={voiceCompleting}
            >
              <ArrowLeft size={15} />
              Preparation dashboard
            </button>

            <div className="voice-brand">
              <div className="voice-brand-icon">
                <Mic size={18} />
              </div>
              <div>
                <strong>AI Voice Interview</strong>
                <span>Live speech interview simulation</span>
              </div>
            </div>

            <button
              type="button"
              className="voice-finish-button"
              onClick={completeVoiceInterview}
              disabled={voiceCompleting || !voiceSession?.id}
            >
              {voiceCompleting ? "Finishing..." : "Finish interview"}
            </button>
          </header>

          <main className="voice-layout">
            <section className="voice-main-card">
              <div className="voice-session-heading">
                <div>
                  <span className="voice-overline">VOICE INTERVIEW</span>
                  <h1>{voiceSession?.target_role || strongestRole}</h1>
                  <p>
                    {voiceSession?.category || category} ·{" "}
                    {voiceSession?.difficulty || difficulty} difficulty
                  </p>
                </div>

                <div className="voice-counter">
                  <span>QUESTION</span>
                  <strong>{questionNumber}</strong>
                  <small>of {totalQuestions}</small>
                </div>
              </div>

              <div className="voice-progress-track">
                <span style={{ width: `${voicePercent}%` }} />
              </div>

              {voiceError && (
                <div className="voice-error" role="alert">
                  <ShieldCheck size={15} />
                  {voiceError}
                </div>
              )}

              {voiceQuestionLoading ? (
                <div className="voice-loading">
                  <div>
                    <div className="voice-loading-icon">
                      <Loader2 size={27} className="preparation-spinner" />
                    </div>
                    <strong>AI interviewer is preparing your question</strong>
                    <p>
                      Personalizing the next question from your resume
                      profile...
                    </p>
                  </div>
                </div>
              ) : voiceQuestion ? (
                <>
                  <div className="voice-question-card">
                    <div className="voice-question-meta">
                      <span>{voiceQuestion.category || "Interview"}</span>
                      <span>{voiceQuestion.difficulty || difficulty}</span>
                    </div>
                    <span className="voice-question-label">
                      INTERVIEWER QUESTION
                    </span>
                    <h2>{voiceQuestion.question}</h2>
                  </div>

                  <div className="voice-listening-panel">
                    <div
                      className={`voice-mic-orb ${voiceListening ? "listening" : ""}`}
                    >
                      {voiceListening ? (
                        <MicOff size={30} />
                      ) : (
                        <Mic size={30} />
                      )}
                    </div>

                    <strong>
                      {!voiceSpeechSupported
                        ? "Voice input unavailable"
                        : voiceListening
                          ? "Listening..."
                          : voiceEvaluation
                            ? "Answer evaluated"
                            : "Speak your answer"}
                    </strong>

                    <p>
                      {voiceSpeechSupported
                        ? voiceListening
                          ? "Speak naturally. Click Stop when you finish."
                          : "Click the microphone and answer as if you are in a real interview."
                        : "Use Google Chrome or another browser that supports Speech Recognition."}
                    </p>

                    <div
                      className={`voice-transcript ${voiceTranscript ? "" : "empty"}`}
                    >
                      {voiceTranscript ||
                        "Your spoken answer will appear here as text."}
                    </div>

                    <div className="voice-actions">
                      {!voiceListening ? (
                        <button
                          type="button"
                          className="voice-primary-action"
                          onClick={startVoiceListening}
                          disabled={
                            !voiceSpeechSupported ||
                            voiceEvaluating ||
                            voiceSaving ||
                            voiceCompleting ||
                            !!voiceEvaluation
                          }
                        >
                          <Mic size={16} />
                          Start speaking
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="voice-primary-action"
                          onClick={stopVoiceListening}
                        >
                          <MicOff size={16} />
                          Stop listening
                        </button>
                      )}

                      <button
                        type="button"
                        className="voice-secondary-action"
                        onClick={() =>
                          speakVoiceQuestion(voiceQuestion.question)
                        }
                        disabled={!voiceQuestion?.question || voiceListening}
                      >
                        <Volume2 size={16} />
                        Hear question
                      </button>

                      <button
                        type="button"
                        className="voice-secondary-action"
                        onClick={evaluateVoiceAnswer}
                        disabled={
                          !voiceTranscript.trim() ||
                          voiceListening ||
                          voiceEvaluating ||
                          voiceSaving ||
                          !!voiceEvaluation
                        }
                      >
                        {voiceEvaluating ? (
                          <Loader2 size={16} className="preparation-spinner" />
                        ) : (
                          <Sparkles size={16} />
                        )}
                        {voiceEvaluating
                          ? "Evaluating..."
                          : voiceSaving
                            ? "Saving..."
                            : "Evaluate answer"}
                      </button>
                    </div>
                  </div>

                  {voiceEvaluation && (
                    <div className="voice-evaluation">
                      <div className="voice-evaluation-header">
                        <span>AI EVALUATION</span>
                        <strong className="voice-score">
                          {voiceScore !== null
                            ? `${voiceScore}/10`
                            : "Evaluated"}
                        </strong>
                      </div>
                      {voiceFeedback && <p>{voiceFeedback}</p>}
                      <div className="voice-save-status">
                        <CheckCircle2 size={15} />
                        Voice transcript and evaluation saved.
                      </div>

                      <div className="voice-actions">
                        <button
                          type="button"
                          className="voice-primary-action"
                          onClick={nextVoiceQuestion}
                          disabled={
                            voiceSaving ||
                            voiceEvaluating ||
                            voiceQuestionLoading ||
                            voiceCompleting
                          }
                        >
                          {questionNumber >= totalQuestions
                            ? "Finish interview"
                            : "Next question"}
                          <ArrowRight size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="voice-loading">
                  <div>
                    <div className="voice-loading-icon">
                      <Mic size={27} />
                    </div>
                    <strong>Voice interview ready</strong>
                    <p>Generate the first question to begin.</p>
                    <div className="voice-actions">
                      <button
                        type="button"
                        className="voice-primary-action"
                        onClick={() => generateVoiceQuestion(voiceSession, 1)}
                        disabled={!voiceSession?.id || voiceQuestionLoading}
                      >
                        <Sparkles size={15} />
                        Start questions
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <aside className="voice-side-card">
              <div className="voice-side-icon">
                <Target size={17} />
              </div>
              <span>INTERVIEW FOCUS</span>
              <h3>{voiceSession?.target_role || strongestRole}</h3>
              <p>
                The AI interviewer uses your resume profile, target role and
                selected difficulty to personalize every question.
              </p>

              <div className="voice-side-divider" />

              <div className="voice-side-stat">
                <span>Category</span>
                <strong>{voiceSession?.category || category}</strong>
              </div>
              <div className="voice-side-stat">
                <span>Difficulty</span>
                <strong>{voiceSession?.difficulty || difficulty}</strong>
              </div>
              <div className="voice-side-stat">
                <span>Answered</span>
                <strong>{answeredCount}</strong>
              </div>
              <div className="voice-side-stat">
                <span>Progress</span>
                <strong>{Math.round(voicePercent)}%</strong>
              </div>

              <div className="voice-side-tip">
                <Lightbulb size={15} />
                <div>
                  <strong>Voice interview tip</strong>
                  <p>
                    Speak clearly, keep your answer structured and give a
                    concrete example whenever possible.
                  </p>
                </div>
              </div>
            </aside>
          </main>
        </div>
      </div>
    );
  }

  if (mockInterviewMode) {
    const questionNumber = Number(
      mockQuestion?.question_number || mockSession?.question_number || 1,
    );
    const totalQuestions =
      Number(mockSession?.total_questions) || mockTotalQuestions;
    const completedQuestions = Math.min(
      Math.max(questionNumber - 1, 0),
      totalQuestions,
    );
    const mockPercent = clampPercent(
      mockProgress?.completion_rate ??
        (completedQuestions / Math.max(totalQuestions, 1)) * 100,
    );

    return (
      <div className="mock-interview-page">
        <div className="mock-interview-background" />

        <header className="mock-interview-topbar">
          <button
            type="button"
            className="mock-back-button"
            onClick={leaveMockInterview}
          >
            <ArrowLeft size={15} />
            Preparation dashboard
          </button>

          <div className="mock-interviewer-brand">
            <div className="mock-brand-icon">
              <Bot size={18} />
            </div>
            <div>
              <strong>AI Mock Interview</strong>
              <span>Live interview simulation</span>
            </div>
          </div>

          <button
            type="button"
            className="mock-finish-button"
            onClick={completeMockInterview}
            disabled={mockCompleteLoading || !mockSession?.id}
          >
            {mockCompleteLoading ? "Finishing..." : "Finish interview"}
          </button>
        </header>

        <main className="mock-interview-layout">
          <section className="mock-interview-main-card">
            <div className="mock-interview-header">
              <div>
                <span className="mock-overline">MOCK INTERVIEW</span>
                <h1>{mockSession?.target_role || strongestRole}</h1>
                <p>
                  {mockSession?.category || category} ·{" "}
                  {mockSession?.difficulty || difficulty} difficulty
                </p>
              </div>

              <div className="mock-question-counter">
                <span>QUESTION</span>
                <strong>{questionNumber}</strong>
                <small>of {totalQuestions}</small>
              </div>
            </div>

            <div className="mock-progress-track">
              <span style={{ width: `${mockPercent}%` }} />
            </div>

            {mockError && (
              <div className="mock-error" role="alert">
                <ShieldCheck size={15} />
                {mockError}
              </div>
            )}

            {mockQuestionLoading ? (
              <div className="mock-loading-state">
                <div className="mock-loading-orb">
                  <Loader2 size={26} className="preparation-spinner" />
                </div>
                <span>AI interviewer is thinking</span>
                <strong>Preparing your next personalized question...</strong>
              </div>
            ) : mockQuestion ? (
              <>
                <div className="mock-question-card">
                  <div className="mock-question-meta">
                    <span>{mockQuestion.category || "Interview"}</span>
                    {mockQuestion.topic && <span>{mockQuestion.topic}</span>}
                    <span>{mockQuestion.difficulty || difficulty}</span>
                  </div>
                  <span className="mock-question-label">
                    INTERVIEWER QUESTION
                  </span>
                  <h2>{mockQuestion.question}</h2>
                  <div className="mock-interviewer-note">
                    <div className="mock-note-avatar">
                      <Bot size={15} />
                    </div>
                    <span>
                      Take a moment to structure your answer before submitting.
                    </span>
                  </div>
                </div>

                <div className="mock-answer-card">
                  <div className="mock-answer-heading">
                    <div>
                      <span>YOUR ANSWER</span>
                      <strong>
                        Respond as if you are speaking to a real interviewer.
                      </strong>
                    </div>
                    <span>{mockAnswer.length}/10000</span>
                  </div>

                  <textarea
                    value={mockAnswer}
                    onChange={(event) => setMockAnswer(event.target.value)}
                    placeholder="Type your answer or use Answer by voice..."
                    maxLength={10000}
                    disabled={
                      mockEvaluationLoading ||
                      mockSaveLoading ||
                      !!mockEvaluation
                    }
                  />

                  <div className="mock-action-row">
                    <button
                      type="button"
                      className={
                        mockVoiceListening
                          ? "mock-primary-action mock-voice-listening"
                          : "mock-secondary-action"
                      }
                      onClick={
                        mockVoiceListening
                          ? stopMockVoiceListening
                          : startMockVoiceListening
                      }
                      disabled={
                        !voiceSpeechSupported ||
                        mockEvaluationLoading ||
                        mockSaveLoading ||
                        mockCompleteLoading ||
                        !!mockEvaluation
                      }
                    >
                      {mockVoiceListening ? (
                        <MicOff size={15} />
                      ) : (
                        <Mic size={15} />
                      )}
                      {mockVoiceListening ? "Stop speaking" : "Answer by voice"}
                    </button>

                    <button
                      type="button"
                      className="mock-secondary-action"
                      onClick={() => speakVoiceQuestion(mockQuestion?.question)}
                      disabled={
                        !mockQuestion?.question ||
                        mockEvaluationLoading ||
                        mockSaveLoading
                      }
                    >
                      <Volume2 size={15} />
                      Read question
                    </button>

                    <button
                      type="button"
                      className="mock-primary-action"
                      onClick={evaluateMockAnswer}
                      disabled={
                        !mockAnswer.trim() ||
                        mockEvaluationLoading ||
                        mockSaveLoading ||
                        !!mockEvaluation
                      }
                    >
                      {mockEvaluationLoading ? (
                        <Loader2 size={15} className="preparation-spinner" />
                      ) : (
                        <Sparkles size={15} />
                      )}
                      {mockEvaluationLoading
                        ? "Evaluating..."
                        : mockSaveLoading
                          ? "Saving..."
                          : "Evaluate & save answer"}
                    </button>

                    <button
                      type="button"
                      className="mock-secondary-action"
                      onClick={nextMockQuestion}
                      disabled={
                        !mockEvaluation ||
                        !mockAnswerSaved ||
                        mockSaveLoading ||
                        mockQuestionLoading
                      }
                    >
                      {questionNumber >= totalQuestions
                        ? "Finish interview"
                        : "Next question"}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>

                {mockAnswerSaved && (
                  <div
                    className="mock-answer-saved-status"
                    role="status"
                    aria-live="polite"
                  >
                    <CheckCircle2 size={16} />
                    <div>
                      <strong>Answer evaluated and saved</strong>
                      <span>
                        Your detailed evaluation will appear in the final
                        interview report.
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="mock-loading-state">
                <div className="mock-loading-orb">
                  <MessageCircle size={24} />
                </div>
                <span>Interview ready</span>
                <strong>Generate the first question to begin.</strong>
                <button
                  type="button"
                  className="mock-primary-action"
                  onClick={() => generateMockQuestion(mockSession, 1)}
                >
                  <Sparkles size={15} />
                  Start questions
                </button>
              </div>
            )}
          </section>

          <aside className="mock-interview-sidebar">
            <div className="mock-sidebar-card">
              <div className="mock-sidebar-icon">
                <Target size={17} />
              </div>
              <span className="mock-sidebar-label">INTERVIEW FOCUS</span>
              <h3>{mockSession?.target_role || strongestRole}</h3>
              <p>
                The interviewer uses your resume profile, target role and
                previous answers to keep the interview personalized.
              </p>

              <div className="mock-sidebar-divider" />

              <div className="mock-sidebar-stat">
                <span>Category</span>
                <strong>{mockSession?.category || category}</strong>
              </div>
              <div className="mock-sidebar-stat">
                <span>Difficulty</span>
                <strong>{mockSession?.difficulty || difficulty}</strong>
              </div>
              <div className="mock-sidebar-stat">
                <span>Progress</span>
                <strong>{Math.round(mockPercent)}%</strong>
              </div>
            </div>

            <div className="mock-sidebar-tip">
              <Lightbulb size={16} />
              <div>
                <strong>Interview strategy</strong>
                <p>
                  Use a clear structure, explain your reasoning and support
                  claims with examples from your experience.
                </p>
              </div>
            </div>
          </aside>
        </main>
      </div>
    );
  }

  if (
    practiceResult ||
    new URLSearchParams(location.search).get("mode") === "practice-result"
  ) {
    const resultData = practiceResult || {};
    const resultAverage = getNumericValue(resultData.average_score);
    const resultCompletion = clampPercent(resultData.completion_rate);
    const resultAnswers = Array.isArray(resultData.answers)
      ? resultData.answers
      : [];

    if (practiceResultLoading && !practiceResult) {
      return (
        <div className="preparation-loading-screen">
          <div className="loading-ai-orb">
            <Loader2 size={38} className="preparation-spinner" />
          </div>
          <div className="loading-content">
            <div className="loading-kicker">AI EVALUATION</div>
            <h2>Preparing your practice report</h2>
            <p>Loading your saved answers, scores and improvement feedback.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="preparation-agent-page">
        <div className="preparation-grid-overlay" />
        <div className="preparation-bg-orb orb-one" />
        <div className="preparation-bg-orb orb-two" />
        <main className="practice-result-page">
          <section className="practice-result-hero premium-glass-card">
            <span className="section-kicker">PRACTICE TEST COMPLETED</span>
            <h1>Your Interview Evaluation</h1>
            <p>
              Review your performance, understand your weak areas, and use the
              feedback for your next interview.
            </p>
            <div className="practice-result-summary-grid">
              <div>
                <span>Average score</span>
                <strong>
                  {resultAverage !== null ? `${resultAverage}/10` : "—"}
                </strong>
              </div>
              <div>
                <span>Questions answered</span>
                <strong>
                  {resultData.answered_questions || 0}/
                  {resultData.total_questions || 0}
                </strong>
              </div>
              <div>
                <span>Completion</span>
                <strong>{resultCompletion}%</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>
                  {resultData.completed ? "Completed" : "In progress"}
                </strong>
              </div>
            </div>
          </section>

          <section className="premium-glass-card practice-final-evaluations">
            <div className="section-heading">
              <div>
                <span className="section-kicker">ANSWER-BY-ANSWER REVIEW</span>
                <h2>AI Evaluation</h2>
                <p>
                  Every saved answer is shown below with its score and feedback.
                </p>
              </div>
            </div>
            {resultAnswers.length ? (
              <div className="practice-final-evaluation-list">
                {resultAnswers.map((item, index) => (
                  <article
                    className="practice-final-evaluation-item"
                    key={item.question_id || index}
                  >
                    <div className="practice-final-evaluation-top">
                      <span>QUESTION {index + 1}</span>
                      <strong>
                        {item.score !== null && item.score !== undefined
                          ? `${item.score}/10`
                          : "Not scored"}
                      </strong>
                    </div>
                    <h3>{item.question || "Interview question"}</h3>
                    {item.answer && (
                      <p>
                        <b>Your answer:</b> {item.answer}
                      </p>
                    )}
                    <div className="practice-final-feedback">
                      <b>AI feedback</b>
                      <pre>
                        {item.evaluation || "No detailed evaluation was saved."}
                      </pre>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mock-result-no-evaluations">
                <strong>No evaluated answers were saved.</strong>
                <span>
                  Complete at least one question and submit its answer before
                  finishing the practice test.
                </span>
              </div>
            )}
          </section>

          <div className="practice-result-actions">
            <button
              type="button"
              className="practice-primary-action"
              onClick={() => {
                setPracticeResult(null);
                setOverviewRefreshKey((value) => value + 1);
                navigate("/preparation-agent", { replace: true });
              }}
            >
              Back to Preparation Agent
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (practiceMode) {
    const questionNumber =
      session?.question_number || session?.current_question || 1;

    return (
      <div className="preparation-practice-page">
        <div className="practice-page-background" />

        <header className="practice-topbar">
          <button
            type="button"
            className="practice-back-button"
            onClick={() => {
              sessionStorage.removeItem(practiceStorageKey);
              roadmapActiveItemIdRef.current = "";
              roadmapForcedTopicRef.current = "";
              setPracticeMode(false);
              setSession(null);
              setCurrentQuestion(null);
              setEvaluation(null);
              setAnswerText("");
              setPracticeError("");
              navigate("/preparation-agent", { replace: true });
            }}
          >
            <ArrowLeft size={15} className="practice-back-icon" />
            Preparation dashboard
          </button>

          <div className="practice-topbar-brand">
            <div className="practice-brand-icon">
              <Bot size={17} />
            </div>
            <div>
              <strong>AI Interview Practice</strong>
              <span>Personalized session</span>
            </div>
          </div>

          <button
            type="button"
            className="practice-exit-button"
            onClick={completeSession}
            disabled={
              completeLoading ||
              evaluationLoading ||
              saveLoading ||
              !session?.id
            }
          >
            {completeLoading ? "Finishing..." : "Finish session"}
          </button>
        </header>

        <main className="practice-page-layout">
          <section className="practice-main-card">
            <div className="practice-session-heading">
              <div>
                <span className="practice-overline">LIVE PRACTICE SESSION</span>
                <h1>{session?.target_role || strongestRole}</h1>
                <p>
                  {session?.category || category} ·{" "}
                  {session?.difficulty || difficulty} difficulty
                </p>
              </div>

              <div className="practice-question-counter">
                <span>QUESTION</span>
                <strong>{questionNumber}</strong>
              </div>
            </div>

            {practiceError && (
              <div className="practice-error" role="alert">
                {practiceError}
              </div>
            )}

            {questionLoading ? (
              <div className="practice-loading-state">
                <div className="practice-loading-icon">
                  <Loader2 size={25} className="preparation-spinner" />
                </div>
                <span>AI is preparing your question</span>
                <strong>Personalizing for your profile...</strong>
              </div>
            ) : currentQuestion ? (
              <>
                <div className="practice-question-card">
                  <div className="practice-question-tags">
                    <span>{currentQuestion.category || "Interview"}</span>
                    {currentQuestion.topic && (
                      <span>{currentQuestion.topic}</span>
                    )}
                    <span>{currentQuestion.difficulty || difficulty}</span>
                  </div>

                  <div className="practice-question-label">YOUR QUESTION</div>
                  <h2>{currentQuestion.question}</h2>
                </div>

                <div className="practice-answer-card">
                  <div className="practice-answer-card-heading">
                    <div>
                      <span>YOUR RESPONSE</span>
                      <strong>Answer as you would in an interview</strong>
                    </div>
                    <span>{answerText.length}/5000</span>
                  </div>

                  <textarea
                    id="practice-answer"
                    value={answerText}
                    onChange={(event) => {
                      setAnswerText(event.target.value);
                      if (evaluation) setEvaluation(null);
                    }}
                    placeholder="Type your answer here..."
                    maxLength={5000}
                    disabled={evaluationLoading || saveLoading}
                  />

                  <div className="practice-page-actions">
                    <button
                      type="button"
                      className="practice-primary-action"
                      onClick={evaluateCurrentAnswer}
                      disabled={!answerText.trim() || evaluationLoading}
                    >
                      {evaluationLoading ? (
                        <Loader2 size={15} className="preparation-spinner" />
                      ) : (
                        <Sparkles size={15} />
                      )}
                      {evaluationLoading ? "Evaluating..." : "Get AI feedback"}
                    </button>

                    <button
                      type="button"
                      className="practice-secondary-action"
                      onClick={async () => {
                        if (!evaluation?.saved) return;
                        await generateNextQuestion();
                      }}
                      disabled={
                        questionLoading ||
                        evaluationLoading ||
                        saveLoading ||
                        !evaluation?.saved
                      }
                    >
                      Next question
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>

                {evaluation && (
                  <div className="practice-result-card">
                    <div className="practice-result-header">
                      <div>
                        <span>AI REVIEW</span>
                        <h3>How you performed</h3>
                      </div>
                      {practiceScore !== null && (
                        <div className="practice-result-score">
                          <strong>{practiceScore}</strong>
                          <span>/10</span>
                        </div>
                      )}
                    </div>

                    <div className="practice-result-metrics">
                      {[
                        ["Correctness", correctness],
                        ["Technical", technicalKnowledge],
                        ["Relevance", relevance],
                        ["Completeness", completeness],
                        ["Communication", communication],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <span>{label}</span>
                          <strong>{value !== null ? value : "—"}</strong>
                        </div>
                      ))}
                    </div>

                    {evaluationFeedback && (
                      <p className="practice-result-feedback">
                        <strong>Feedback</strong>
                        {evaluationFeedback}
                      </p>
                    )}

                    {idealAnswer && (
                      <div className="practice-ideal-answer">
                        <strong>Better answer approach</strong>
                        <span>{idealAnswer}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="practice-loading-state">
                <div className="practice-loading-icon">
                  <MessageCircle size={24} />
                </div>
                <span>Ready when you are</span>
                <strong>Generate your first interview question.</strong>
                <button
                  type="button"
                  className="practice-primary-action"
                  onClick={() => generateNextQuestion()}
                >
                  <Sparkles size={15} />
                  Generate question
                </button>
              </div>
            )}
          </section>

          <aside className="practice-side-card">
            <div className="practice-side-icon">
              <Target size={17} />
            </div>
            <span>SESSION FOCUS</span>
            <h3>{session?.target_role || strongestRole}</h3>
            <p>
              Questions are generated from your resume profile and selected
              interview focus.
            </p>

            <div className="practice-side-divider" />

            <div className="practice-side-stat">
              <span>Difficulty</span>
              <strong>{session?.difficulty || difficulty}</strong>
            </div>
            <div className="practice-side-stat">
              <span>Category</span>
              <strong>{session?.category || category}</strong>
            </div>

            <div className="practice-side-tip">
              <Lightbulb size={15} />
              <div>
                <strong>Interview tip</strong>
                <p>
                  Keep answers concise, structured and supported with examples.
                </p>
              </div>
            </div>
          </aside>
        </main>
      </div>
    );
  }

  return (
    <div className="preparation-agent-page preparation-dashboard-v3">
      <div className="preparation-grid-overlay" />
      <div className="preparation-bg-orb orb-one" />
      <div className="preparation-bg-orb orb-two" />
      <div className="preparation-bg-orb orb-three" />

      {overviewError && (
        <div className="preparation-error" role="alert">
          <X size={18} />
          <span>{overviewError}</span>
        </div>
      )}

      {overviewLoading ? (
        <div className="preparation-loading-screen">
          <div className="loading-ai-orb">
            <Bot size={38} />
            <span />
          </div>
          <div className="loading-content">
            <div className="loading-kicker">AI CAREER INTELLIGENCE</div>
            <h2>Analyzing your preparation profile</h2>
            <p>
              Connecting your resume profile, skills, experience and internship
              recommendations.
            </p>
            <div className="loading-progress">
              <span />
            </div>
          </div>
        </div>
      ) : (
        <div className="pa-dashboard-content">
          <section className="pa-hero-card">
            <div className="pa-hero-copy">
              <div className="hero-kicker">
                <span className="hero-kicker-dot" />
                <Sparkles size={14} /> AI-POWERED PREPARATION
              </div>
              <h1>
                Hi {candidateName}!{" "}
                <span className="hero-greeting-wave">👋</span>
              </h1>
              <h2>Your AI-Powered Interview Preparation Partner</h2>
              <p>
                Practice smarter. Improve faster. Get interview-ready with
                preparation built around your resume, skills and performance.
              </p>
              <div className="pa-hero-buttons">
                <button
                  type="button"
                  className="hero-primary-action"
                  onClick={() => {
                    setSessionType("practice");
                    scrollToPreparationSection("practice-setup");
                  }}
                >
                  <Rocket size={16} /> Start Interview Practice{" "}
                  <ArrowRight size={15} />
                </button>
                <button
                  type="button"
                  className="pa-secondary-button"
                  onClick={() =>
                    handlePreparationAction("Give me a preparation roadmap")
                  }
                >
                  <TrendingUp size={16} /> View Roadmap
                </button>
              </div>
            </div>

            <div className="pa-hero-art" aria-hidden="true">
              <div className="pa-mountain mountain-back" />
              <div className="pa-mountain mountain-front" />
              <div className="pa-neon-path" />
              <div className="pa-hero-meta">
                <div className="pa-hero-date">
                  <CalendarDays size={15} />
                  <span>{todayLabel}</span>
                </div>
                <div className="pa-hero-quote">
                  <strong>
                    Discipline today.
                    <br />
                    Success tomorrow.
                  </strong>
                  <span>Keep going 🚀</span>
                </div>
              </div>
              <div className="pa-robot">
                <div className="pa-robot-head">
                  <div className="pa-robot-eye" />
                  <div className="pa-robot-eye" />
                </div>
                <div className="pa-robot-body">
                  <Bot size={48} />
                </div>
                <div className="pa-robot-arm left" />
                <div className="pa-robot-arm right" />
              </div>
            </div>
          </section>

          <section className="pa-kpi-grid">
            <div className="pa-kpi-card blue">
              <div className="pa-kpi-icon">
                <BookOpen size={20} />
              </div>
              <div>
                <strong>{preparationQuestionCount ?? 0}</strong>
                <span>Questions Practiced</span>
              </div>
            </div>
            <div className="pa-kpi-card green">
              <div className="pa-kpi-icon">
                <BarChart3 size={20} />
              </div>
              <div>
                <strong>
                  {preparationAverageScore !== null
                    ? `${Math.round(preparationAverageScore * 10)}%`
                    : "—"}
                </strong>
                <span>Average Score</span>
              </div>
            </div>
            <div className="pa-kpi-card purple">
              <div className="pa-kpi-icon">
                <UserRound size={20} />
              </div>
              <div>
                <strong>{progress?.total_sessions ?? 0}</strong>
                <span>Mock Sessions</span>
              </div>
            </div>
            <div className="pa-kpi-card orange">
              <div className="pa-kpi-icon">
                <Code2 size={20} />
              </div>
              <div>
                <strong>{technicalSkills.length}</strong>
                <span>Skills Detected</span>
              </div>
            </div>
            <div className="pa-kpi-card red">
              <div className="pa-kpi-icon">
                <Target size={20} />
              </div>
              <div>
                <strong>{topWeakTopics.length}</strong>
                <span>Weak Areas</span>
              </div>
            </div>
          </section>

          <section className="pa-card pa-topic-performance-card">
            <div className="pa-card-heading">
              <div>
                <span className="section-kicker">PERFORMANCE INSIGHTS</span>
                <h2>Topic-wise Performance</h2>
                <p>
                  See how you are performing across the topics you have actually
                  practiced.
                </p>
              </div>
              <div className="pa-topic-performance-badge">
                <BarChart3 size={16} />
                <span>{topicPerformance.length} topics measured</span>
              </div>
            </div>

            {topicPerformanceVisible.length ? (
              <div className="pa-topic-performance-list">
                {topicPerformanceVisible.map((item, index) => (
                  <button
                    type="button"
                    className="pa-topic-performance-row"
                    key={`topic-performance-${item.topic}-${index}`}
                    onClick={() => setSelectedTopicPerformance(item)}
                    aria-label={`View details for ${item.topic}`}
                  >
                    <div className="pa-topic-performance-info">
                      <div className="pa-topic-performance-title">
                        <strong>{item.topic}</strong>
                        <span
                          className={`pa-topic-performance-status ${
                            item.score >= 75
                              ? "strong"
                              : item.score >= 50
                                ? "average"
                                : "weak"
                          }`}
                        >
                          {item.level}
                        </span>
                      </div>
                      <small>
                        {item.attempts}{" "}
                        {item.attempts === 1 ? "attempt" : "attempts"}
                      </small>
                    </div>
                    <div
                      className="pa-topic-performance-track"
                      aria-label={`${item.topic} score ${Math.round(item.score)} percent`}
                    >
                      <span style={{ width: `${item.score}%` }} />
                    </div>
                    <strong className="pa-topic-performance-score">
                      {Math.round(item.score)}%
                    </strong>
                    <span className="pa-topic-performance-open">
                      View details <ChevronRight size={13} />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="pa-topic-performance-empty">
                <div className="pa-topic-performance-empty-icon">
                  <Target size={22} />
                </div>
                <div>
                  <strong>No topic performance yet</strong>
                  <span>
                    Complete a few evaluated practice questions and your topic
                    scores will appear here automatically.
                  </span>
                </div>
              </div>
            )}
          </section>

          <div className="pa-main-grid">
            <div className="pa-left-column">
              <section className="pa-card pa-profile-card pa-profile-redesigned">
                <div className="pa-card-heading pa-profile-heading">
                  <div>
                    <span className="section-kicker">
                      YOUR PREPARATION PROFILE
                    </span>
                    <h2>Profile Overview</h2>
                    <p>
                      Your role, experience and technical skills in one place.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="pa-link-button"
                    onClick={() => navigate("/profile")}
                  >
                    Full Profile <ArrowRight size={14} />
                  </button>
                </div>

                <div className="pa-profile-clean-grid">
                  <div className="pa-profile-detail pa-profile-status-card">
                    <span>
                      <UserRound size={14} /> Profile status
                    </span>
                    <strong>Profile connected</strong>
                    <em>Personalized preparation enabled</em>
                  </div>
                  <div className="pa-profile-detail pa-profile-role-detail">
                    <span>
                      <Target size={14} /> Best-fit role
                    </span>
                    <strong>
                      {preparationTargetRole || "Not detected yet"}
                    </strong>
                    <em>
                      {preparationRoleMatch > 0
                        ? `${preparationRoleMatch}% profile match`
                        : "Match pending"}
                    </em>
                  </div>
                  <div className="pa-profile-detail pa-profile-experience-detail">
                    <span>
                      <GraduationCap size={14} /> Experience
                    </span>
                    <strong>
                      {preparationExperienceLevel || "Not available"}
                    </strong>
                    <em>
                      {estimatedExperienceYears > 0
                        ? `${estimatedExperienceYears}+ year${estimatedExperienceYears === 1 ? "" : "s"} estimated`
                        : "Based on profile data"}
                    </em>
                  </div>
                  <div className="pa-profile-skills">
                    <div className="pa-profile-skills-head">
                      <span>
                        <Code2 size={14} /> Technical skills
                      </span>
                      <b>{technicalSkills.length} detected</b>
                    </div>
                    <div className="pa-profile-skill-chips">
                      {technicalSkills.length ? (
                        technicalSkills.map((skill, i) => (
                          <span key={`profile-skill-${i}`}>{skill}</span>
                        ))
                      ) : (
                        <span className="empty-skill">
                          No technical skills detected yet.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <div
                className={`pa-practice-chat-layout ${chatOpen ? "chat-open" : ""}`}
              >
                <section className="pa-card" id="interview-practice">
                  <div className="pa-card-heading">
                    <div>
                      <span className="section-kicker">START PRACTICING</span>
                      <h2>Choose Your Preparation</h2>
                      <p>
                        Every mode is connected to AI evaluation and your
                        preparation progress.
                      </p>
                    </div>
                    <Sparkles size={20} />
                  </div>
                  <div className="pa-action-grid">
                    <button
                      type="button"
                      className="pa-action-card green"
                      onClick={() => {
                        setSessionType("practice");
                        scrollToPreparationSection("practice-setup");
                      }}
                    >
                      <div className="pa-action-icon">
                        <BookOpen size={24} />
                      </div>
                      <strong>Practice</strong>
                      <span>Topic-wise practice with instant AI feedback</span>
                      <b>
                        Start Practice <ArrowRight size={14} />
                      </b>
                    </button>
                    <button
                      type="button"
                      className="pa-action-card purple"
                      onClick={() => {
                        setSessionType("mock_interview");
                        scrollToPreparationSection("practice-setup");
                      }}
                    >
                      <div className="pa-action-icon">
                        <UserRound size={24} />
                      </div>
                      <strong>Mock Interview</strong>
                      <span>Full-length AI interview simulation</span>
                      <b>
                        Configure Mock <ArrowRight size={14} />
                      </b>
                    </button>
                    <button
                      type="button"
                      className="pa-action-card blue"
                      onClick={() => {
                        setSessionType("voice_interview");
                        scrollToPreparationSection("practice-setup");
                      }}
                    >
                      <div className="pa-action-icon">
                        <Mic size={24} />
                      </div>
                      <strong>Voice Interview</strong>
                      <span>Real-time voice interview experience</span>
                      <b>
                        Configure Voice <ArrowRight size={14} />
                      </b>
                    </button>
                    <button
                      type="button"
                      className="pa-action-card orange"
                      onClick={() => {
                        navigate("/preparation-chat");
                      }}
                    >
                      <div className="pa-action-icon">
                        <MessageCircle size={24} />
                      </div>
                      <strong>AI Chat Assistant</strong>
                      <span>Ask doubts, get explanations and tips</span>
                      <b>
                        Open Chat <ArrowRight size={14} />
                      </b>
                    </button>
                  </div>
                </section>

                {chatOpen && (
                  <section
                    className="pa-card pa-ai-card"
                    id="preparation-ai-chat"
                  >
                    <div className="pa-card-heading">
                      <div>
                        <span className="section-kicker">
                          AI PREPARATION ASSISTANT
                        </span>
                        <h2>Ask your AI coach</h2>
                      </div>
                      <div className="pa-chat-heading-actions">
                        <button
                          type="button"
                          className="pa-chat-history-button"
                          onClick={() => setChatHistoryOpen((open) => !open)}
                          aria-expanded={chatHistoryOpen}
                        >
                          <MessageCircle size={14} />
                          History
                          <span>{chatSessions.length}</span>
                        </button>
                        <button
                          type="button"
                          className="pa-chat-new-button"
                          onClick={createNewChat}
                        >
                          <Sparkles size={14} />
                          New
                        </button>
                        <span className="pa-online">
                          <i /> Online
                        </span>
                        <button
                          type="button"
                          className="pa-chat-close-button"
                          onClick={() => setChatOpen(false)}
                          aria-label="Close preparation chat"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>

                    {chatHistoryOpen && (
                      <div className="pa-chat-history-panel">
                        <div className="pa-history-panel-head">
                          <div>
                            <strong>Previous chats</strong>
                            <span>Your preparation conversations</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setChatHistoryOpen(false)}
                            aria-label="Close chat history"
                          >
                            <X size={15} />
                          </button>
                        </div>

                        <div className="pa-history-list">
                          {chatSessions.length ? (
                            chatSessions.map((chat) => (
                              <div
                                className={`pa-history-row ${chat.id === activeChatId ? "active" : ""}`}
                                key={chat.id}
                              >
                                <button
                                  type="button"
                                  className="pa-history-open"
                                  onClick={() => openChat(chat)}
                                >
                                  <div className="pa-history-icon">
                                    <MessageCircle size={14} />
                                  </div>
                                  <div>
                                    <strong>
                                      {chat.title || "Preparation chat"}
                                    </strong>
                                    <span>
                                      {Array.isArray(chat.messages)
                                        ? `${chat.messages.length} messages`
                                        : "Chat"}
                                    </span>
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  className="pa-history-delete"
                                  onClick={() => requestDeleteChat(chat.id)}
                                  aria-label={`Delete ${chat.title || "chat"}`}
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="pa-history-empty">
                              <MessageCircle size={20} />
                              <span>No previous chats yet.</span>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          className="pa-history-create"
                          onClick={createNewChat}
                        >
                          <Sparkles size={15} />
                          Start a new preparation chat
                        </button>
                      </div>
                    )}
                    <div className="pa-ai-welcome">
                      <div className="pa-ai-avatar">
                        <Bot size={19} />
                      </div>
                      <div>
                        <strong>
                          Hi{" "}
                          {firstString(candidateName, "Intern").split(" ")[0]}!
                          I'm your AI preparation assistant.
                        </strong>
                        <span>
                          I can help with concepts, questions, interview tips
                          and skill gaps.
                        </span>
                      </div>
                    </div>
                    <div className="pa-chat-messages">
                      {messages.map((item, index) => (
                        <div
                          className={`pa-chat-message ${item.role}`}
                          key={item.id || index}
                        >
                          <div className="pa-chat-avatar">
                            {item.role === "assistant" ? (
                              <Bot size={14} />
                            ) : (
                              <UserRound size={14} />
                            )}
                          </div>
                          <p>{item.content}</p>
                        </div>
                      ))}
                      <div ref={messagesEndRef} aria-hidden="true" />
                      {chatLoading && (
                        <div className="pa-chat-message assistant">
                          <div className="pa-chat-avatar">
                            <Bot size={14} />
                          </div>
                          <p className="pa-typing">
                            <i />
                            <i />
                            <i />
                          </p>
                        </div>
                      )}
                    </div>
                    {!messages.some((item) => item.role === "user") && (
                      <div className="pa-chat-suggestions">
                        {suggestions.slice(0, 4).map((suggestion, index) => (
                          <button
                            type="button"
                            key={`s-${index}`}
                            onClick={() => sendMessage(suggestion)}
                            disabled={chatLoading}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="pa-chat-input">
                      <input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask me anything..."
                        aria-label="Ask AI preparation assistant"
                      />
                      <button
                        type="button"
                        onClick={() => sendMessage()}
                        disabled={!message.trim() || chatLoading}
                        aria-label="Send message"
                      >
                        {chatLoading ? (
                          <Loader2 size={18} className="preparation-spinner" />
                        ) : (
                          <Send size={18} />
                        )}
                      </button>
                    </div>
                    <div className="chat-security-note">
                      <ShieldCheck size={12} /> Resume context is used to
                      personalize your guidance.
                    </div>
                  </section>
                )}
              </div>

              <section className="pa-card pa-focus-grid">
                <div className="pa-focus-panel">
                  <div className="pa-panel-title">
                    <div>
                      <span>WEAK AREAS</span>
                      <h3>What to improve next</h3>
                    </div>
                    <Target size={18} />
                  </div>
                  {topWeakTopics.length ? (
                    <div className="pa-weak-list">
                      {topWeakTopics.slice(0, 4).map((item, index) => {
                        const score = getWeakTopicScore(item);
                        const priority = firstString(
                          item?.priority,
                          "medium",
                        ).toLowerCase();
                        return (
                          <div
                            className="pa-weak-item"
                            key={`weak-ui-${index}`}
                          >
                            <div className="pa-weak-rank">{index + 1}</div>
                            <div className="pa-weak-main">
                              <strong>{getWeakTopicName(item)}</strong>
                              <div className="pa-mini-bar">
                                <span
                                  style={{
                                    width: `${score !== null ? clampPercent(score * 10) : 30}%`,
                                  }}
                                />
                              </div>
                            </div>
                            <span className={`pa-priority ${priority}`}>
                              {score !== null
                                ? `${Math.round(score * 10)}%`
                                : priority}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="pa-empty-inline">
                      <CheckCircle2 size={17} />
                      <span>
                        No weak areas yet. Complete evaluated questions to
                        unlock adaptive coaching.
                      </span>
                    </div>
                  )}
                </div>
                <div className="pa-focus-panel pa-roadmap-focus-panel">
                  <div className="pa-panel-title pa-roadmap-focus-title">
                    <div>
                      <span>PERSONALIZED ROADMAP</span>
                      <h3>Your Learning Roadmap</h3>
                    </div>
                    <div
                      className="pa-roadmap-progress-ring"
                      aria-label={`${roadmapCompletion}% roadmap complete`}
                    >
                      <strong>{roadmapCompletion}%</strong>
                      <span>done</span>
                    </div>
                  </div>

                  <p className="pa-roadmap-focus-summary">
                    Your next preparation topics are prioritized from your weak
                    areas, topic performance, role requirements and AI
                    recommendations.
                  </p>

                  {learningRecommendationsLoading ? (
                    <div className="pa-ai-recommendation-loading">
                      <Loader2 size={18} className="preparation-spinner" />
                      <span>Building your personalized roadmap...</span>
                    </div>
                  ) : personalizedRoadmap.length ? (
                    <div className="pa-roadmap-list pa-roadmap-focus-list">
                      {personalizedRoadmap.slice(0, 5).map((item, index) => {
                        const completed = roadmapCompleted.has(item.id);
                        return (
                          <article
                            className={`pa-roadmap-item ${completed ? "completed" : ""}`}
                            key={item.id}
                          >
                            <button
                              type="button"
                              className="pa-roadmap-check"
                              onClick={() => toggleRoadmapItem(item.id)}
                              aria-label={
                                completed
                                  ? `Mark ${item.topic} incomplete`
                                  : `Mark ${item.topic} complete`
                              }
                            >
                              {completed ? (
                                <CheckCircle2 size={16} />
                              ) : (
                                <span>{index + 1}</span>
                              )}
                            </button>

                            <div className="pa-roadmap-main">
                              <div className="pa-roadmap-topline">
                                <div>
                                  <span className="pa-roadmap-day">
                                    {item.day}
                                  </span>
                                  <h3>{item.topic}</h3>
                                </div>
                                <span
                                  className={`pa-roadmap-priority ${item.priority}`}
                                >
                                  {item.priority}
                                </span>
                              </div>

                              <p>{item.reason}</p>

                              <div className="pa-roadmap-meta">
                                <span>{item.difficulty} level</span>
                                {item.score !== null && (
                                  <span>
                                    {Math.round(item.score)}% topic score
                                  </span>
                                )}
                                {item.attempts > 0 && (
                                  <span>{item.attempts} attempts</span>
                                )}
                                <span>{item.practiceCount} questions</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              className="pa-roadmap-practice"
                              onClick={() => startRoadmapPractice(item)}
                            >
                              Practice <ArrowRight size={14} />
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="pa-empty-inline">
                      <Lightbulb size={17} />
                      <span>
                        {learningRecommendationsError ||
                          "Complete a few evaluated questions to build your personalized roadmap."}
                      </span>
                    </div>
                  )}
                </div>
              </section>

              <div className="pa-match-grid">
                <section className="pa-card">
                  <div className="pa-card-heading">
                    <div>
                      <span className="section-kicker">ROLE MATCHING</span>
                      <h2>Suitable Roles</h2>
                      <p>
                        Recommended from your resume and preparation profile.
                      </p>
                    </div>
                    <Target size={20} />
                  </div>
                  {recommendedRoles.length ? (
                    <div className="pa-role-grid">
                      {recommendedRoles.slice(0, 6).map((role, index) => {
                        const score = getRoleScore(role);
                        return (
                          <button
                            type="button"
                            className={`pa-role-card ${index === 0 ? "featured" : ""}`}
                            key={`role-v2-${index}`}
                            onClick={() => openRoleForPractice(role)}
                          >
                            <div className="pa-role-top">
                              <div className="pa-role-icon">
                                <Code2 size={18} />
                              </div>
                              {index === 0 && <span>BEST FIT</span>}
                            </div>
                            <strong>{getRoleName(role)}</strong>
                            {score !== null && (
                              <div className="pa-role-score">
                                <span>Profile match</span>
                                <b>{score}%</b>
                              </div>
                            )}
                            <p>{getRoleReason(role)}</p>
                            <em>
                              Practice this role <ArrowRight size={13} />
                            </em>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="premium-empty">
                      <Target size={28} />
                      <h3>No role recommendations yet</h3>
                      <p>
                        Analyze your resume to receive personalized
                        recommendations.
                      </p>
                    </div>
                  )}
                </section>
              </div>

              <section
                className="pa-card pa-practice-setup"
                id="practice-setup"
              >
                <div className="pa-card-heading">
                  <div>
                    <span className="section-kicker">PERSONALIZED PLAN</span>
                    <h2>Build Your Personalized Session</h2>
                    <p>
                      Choose your session type, category, difficulty, target
                      role and question count. AI will personalize the session
                      to your profile.
                    </p>
                  </div>
                  <Rocket size={20} />
                </div>
                <div className="pa-setup-grid">
                  <label>
                    <span>Session type</span>
                    <select
                      value={sessionType}
                      onChange={(e) => setSessionType(e.target.value)}
                    >
                      <option value="practice">Practice</option>
                      <option value="mock_interview">Mock Interview</option>
                      <option value="voice_interview">Voice Interview</option>
                    </select>
                  </label>
                  <label>
                    <span>Category</span>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="mixed">Mixed</option>
                      <option value="technical">Technical</option>
                      <option value="hr">HR / Behavioral</option>
                    </select>
                  </label>
                  <label>
                    <span>Difficulty</span>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </label>
                  <label>
                    <span>Target role</span>
                    <select
                      value={selectedTargetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                    >
                      {targetRoleOptions.map((role, index) => (
                        <option value={role} key={`target-${index}`}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Questions</span>
                    <select
                      value={
                        sessionType === "voice_interview"
                          ? voiceTotalQuestions
                          : mockTotalQuestions
                      }
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (sessionType === "voice_interview")
                          setVoiceTotalQuestions(value);
                        else setMockTotalQuestions(value);
                      }}
                    >
                      <option value={5}>5 questions</option>
                      <option value={10}>10 questions</option>
                      <option value={15}>15 questions</option>
                      <option value={20}>20 questions</option>
                    </select>
                  </label>
                  {(practiceError || mockError || voiceError) && (
                    <div className="pa-setup-error" role="alert">
                      <X size={14} />
                      <span>{practiceError || mockError || voiceError}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="pa-launch-session"
                    onClick={createPracticeSession}
                    disabled={
                      sessionLoading ||
                      mockSessionLoading ||
                      voiceQuestionLoading
                    }
                  >
                    {sessionLoading ||
                    mockSessionLoading ||
                    voiceQuestionLoading ? (
                      <Loader2 size={17} className="preparation-spinner" />
                    ) : (
                      <Rocket size={17} />
                    )}
                    {sessionLoading ||
                    mockSessionLoading ||
                    voiceQuestionLoading
                      ? "Starting..."
                      : "Start Selected Session"}
                    {!sessionLoading &&
                      !mockSessionLoading &&
                      !voiceQuestionLoading && <ArrowRight size={15} />}
                  </button>
                </div>
              </section>
            </div>

            <aside className="pa-right-column">
              <section className="pa-card pa-progress-card">
                <div className="pa-card-heading">
                  <div>
                    <span className="section-kicker">YOUR PROGRESS</span>
                    <h2>Preparation Score</h2>
                  </div>
                  <button
                    type="button"
                    className="pa-link-button"
                    onClick={() =>
                      handlePreparationAction(
                        "Show me my preparation analytics",
                      )
                    }
                  >
                    View Analytics <ArrowRight size={14} />
                  </button>
                </div>
                <div className="pa-progress-main">
                  <div
                    className="pa-donut"
                    style={{ "--progress": `${overallProgress}%` }}
                  >
                    <div>
                      <strong>{overallProgress}%</strong>
                      <span>Overall Progress</span>
                    </div>
                  </div>
                  <div className="pa-progress-bars">
                    <div>
                      <span>Technical Skills</span>
                      <b>
                        {technicalSkills.length
                          ? Math.min(100, technicalSkills.length * 10 + 40)
                          : 0}
                        %
                      </b>
                      <i>
                        <em
                          style={{
                            width: `${technicalSkills.length ? Math.min(100, technicalSkills.length * 10 + 40) : 0}%`,
                          }}
                        />
                      </i>
                    </div>
                    <div>
                      <span>Problem Solving</span>
                      <b>
                        {preparationAverageScore !== null
                          ? Math.round(preparationAverageScore * 10)
                          : 0}
                        %
                      </b>
                      <i>
                        <em
                          style={{
                            width: `${preparationAverageScore !== null ? Math.round(preparationAverageScore * 10) : 0}%`,
                          }}
                        />
                      </i>
                    </div>
                    <div>
                      <span>Interview Readiness</span>
                      <b>{profileCompleteness}%</b>
                      <i>
                        <em style={{ width: `${profileCompleteness}%` }} />
                      </i>
                    </div>
                    <div>
                      <span>Core Concepts</span>
                      <b>
                        {recentAverageScore !== null
                          ? Math.round(recentAverageScore * 10)
                          : 0}
                        %
                      </b>
                      <i>
                        <em
                          style={{
                            width: `${recentAverageScore !== null ? Math.round(recentAverageScore * 10) : 0}%`,
                          }}
                        />
                      </i>
                    </div>
                  </div>

                  <div className="pa-progress-encouragement">
                    <div className="pa-progress-trophy" aria-hidden="true">
                      <Trophy size={26} strokeWidth={2.2} />
                    </div>
                    <div>
                      <strong>You’re on the right track!</strong>
                      <span>
                        {overallProgress > 0
                          ? "Keep practicing to improve your preparation score."
                          : "Start practicing to build your preparation score."}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="pa-card pa-quick-card">
                <div className="pa-card-heading">
                  <div>
                    <span className="section-kicker">QUICK ACTIONS</span>
                    <h2>Focus your preparation</h2>
                  </div>
                  <Zap size={18} />
                </div>
                <div className="pa-quick-list">
                  <button
                    type="button"
                    onClick={() =>
                      handlePreparationAction("Give me a preparation roadmap")
                    }
                  >
                    <div>
                      <TrendingUp size={16} />
                    </div>
                    <span>
                      <strong>Preparation roadmap</strong>
                      <small>Build a focused learning path</small>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handlePreparationAction(
                        "Ask me technical interview questions",
                      )
                    }
                  >
                    <div>
                      <Code2 size={16} />
                    </div>
                    <span>
                      <strong>Technical practice</strong>
                      <small>Practice role-specific questions</small>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handlePreparationAction("Ask me HR interview questions")
                    }
                  >
                    <div>
                      <UserRound size={16} />
                    </div>
                    <span>
                      <strong>HR preparation</strong>
                      <small>Improve behavioral answers</small>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handlePreparationAction("What are my biggest skill gaps?")
                    }
                  >
                    <div>
                      <Target size={16} />
                    </div>
                    <span>
                      <strong>Find skill gaps</strong>
                      <small>Identify what to improve next</small>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </section>

              <section
                className="pa-card pa-quick-internship-card"
                id="internship-matching"
              >
                <div className="pa-card-heading">
                  <div>
                    <span className="section-kicker">INTERNSHIPS MATCHED</span>
                    <h2>Matched Internships</h2>
                    <p>Internships matched to your profile and skills.</p>
                  </div>
                  <button
                    type="button"
                    className="pa-link-button"
                    onClick={() => navigate("/internships")}
                  >
                    View All <ArrowRight size={14} />
                  </button>
                </div>

                {recommendedInternships.length ? (
                  <div className="pa-quick-internship-list">
                    {recommendedInternships
                      .slice(0, 4)
                      .map((internship, index) => {
                        const score = getInternshipScore(internship);
                        return (
                          <button
                            type="button"
                            className="pa-quick-internship-row"
                            key={`quick-intern-${index}`}
                            onClick={() => openInternship(internship)}
                          >
                            <span className="pa-quick-internship-icon">
                              <BriefcaseBusiness size={14} />
                            </span>
                            <span className="pa-quick-internship-copy">
                              <strong>{getInternshipTitle(internship)}</strong>
                              <small>
                                {getInternshipCompany(internship)}
                                {getInternshipLocation(internship)
                                  ? ` · ${getInternshipLocation(internship)}`
                                  : ""}
                              </small>
                            </span>
                            {score !== null && <b>{score}%</b>}
                            <ChevronRight size={14} />
                          </button>
                        );
                      })}
                  </div>
                ) : (
                  <div className="pa-empty-inline pa-internship-empty">
                    <BriefcaseBusiness size={17} />
                    <span>
                      No matched internships are available yet. Upload or update
                      your resume to refresh matching.
                    </span>
                  </div>
                )}
              </section>
            </aside>
          </div>

          {selectedTopicPerformance && (
            <div
              className="pa-topic-modal-backdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setSelectedTopicPerformance(null);
                }
              }}
            >
              <div
                className="pa-topic-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="pa-topic-modal-title"
              >
                <div className="pa-topic-modal-header">
                  <div>
                    <span className="section-kicker">TOPIC PERFORMANCE</span>
                    <h2 id="pa-topic-modal-title">
                      {
                        getTopicPerformanceDetails(selectedTopicPerformance)
                          .topic
                      }
                    </h2>
                    <p>
                      A detailed view of your current performance and what to
                      practice next.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="pa-topic-modal-close"
                    onClick={() => setSelectedTopicPerformance(null)}
                    aria-label="Close topic details"
                  >
                    <X size={18} />
                  </button>
                </div>

                {(() => {
                  const details = getTopicPerformanceDetails(
                    selectedTopicPerformance,
                  );

                  return (
                    <>
                      <div className="pa-topic-modal-stats">
                        <div className="pa-topic-modal-stat primary">
                          <span>Current Score</span>
                          <strong>{Math.round(details.score)}%</strong>
                        </div>
                        <div className="pa-topic-modal-stat">
                          <span>Attempts</span>
                          <strong>{details.attempts}</strong>
                        </div>
                        <div className="pa-topic-modal-stat">
                          <span>Status</span>
                          <strong>{details.level}</strong>
                        </div>
                        <div className="pa-topic-modal-stat">
                          <span>Priority</span>
                          <strong>{details.priority}</strong>
                        </div>
                      </div>

                      <div className="pa-topic-modal-score">
                        <div className="pa-topic-modal-score-head">
                          <span>Performance</span>
                          <b>{Math.round(details.score)}%</b>
                        </div>
                        <div className="pa-topic-modal-track">
                          <span style={{ width: `${details.score}%` }} />
                        </div>
                      </div>

                      <div className="pa-topic-modal-section">
                        <span className="section-kicker">WHAT THIS MEANS</span>
                        <p>{details.summary}</p>
                      </div>

                      <div className="pa-topic-modal-section">
                        <span className="section-kicker">RECOMMENDED NEXT</span>
                        <p>{details.recommendation}</p>
                        <div className="pa-topic-modal-steps">
                          {details.nextSteps.map((step, index) => (
                            <div key={`topic-step-${index}`}>
                              <span>{index + 1}</span>
                              <strong>{step}</strong>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="pa-topic-modal-action"
                        onClick={() => {
                          setSelectedTopicPerformance(null);
                          setSessionType("practice");
                          scrollToPreparationSection("practice-setup");
                        }}
                      >
                        Practice {details.topic}
                        <ArrowRight size={15} />
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {deleteChatConfirmation && (
            <div
              className="pa-delete-confirm-backdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  cancelDeleteChat();
                }
              }}
            >
              <div
                className="pa-delete-confirm-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="pa-delete-confirm-title"
              >
                <div className="pa-delete-confirm-icon">
                  <X size={20} />
                </div>

                <div className="pa-delete-confirm-content">
                  <span className="pa-delete-confirm-kicker">DELETE CHAT</span>
                  <h2 id="pa-delete-confirm-title">
                    Delete this conversation?
                  </h2>
                  <p>
                    Are you sure you want to delete{" "}
                    <strong>&quot;{deleteChatConfirmation.title}&quot;</strong>?
                    This action cannot be undone.
                  </p>
                </div>

                <div className="pa-delete-confirm-actions">
                  <button
                    type="button"
                    className="pa-delete-confirm-cancel"
                    onClick={cancelDeleteChat}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="pa-delete-confirm-delete"
                    onClick={confirmDeleteChat}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PreparationAgent;

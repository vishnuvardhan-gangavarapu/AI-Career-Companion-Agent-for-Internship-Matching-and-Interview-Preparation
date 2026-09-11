import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  Search,
  UploadCloud,
  FileText,
  CheckCircle2,
  Sparkles,
  X,
  ShieldCheck,
  ArrowRight,
  MoreVertical,
  RotateCcw,
  Trash2,
  Eye,
  UserCircle,
  Brain,
  Target,
  BarChart3,
  GraduationCap,
  BriefcaseBusiness,
  AlertCircle,
  Clock3,
  FileCheck2,
  ChevronRight,
  LoaderCircle,
} from "lucide-react";

import "../styles/Resume.css";

const API_BASE_URL = "http://127.0.0.1:8000";

const API = {
  upload: `${API_BASE_URL}/api/resumes/upload`,
  resumes: `${API_BASE_URL}/api/resumes`,
};

const ANALYSIS_PIPELINE = [
  {
    id: "upload",
    title: "Resume uploaded",
    subtitle: "File saved securely",
    icon: UploadCloud,
  },
  {
    id: "extract",
    title: "Text extraction",
    subtitle: "Reading resume content",
    icon: FileText,
  },
  {
    id: "regex",
    title: "Regex scanning",
    subtitle: "Detecting structured information",
    icon: Target,
  },
  {
    id: "groq",
    title: "Groq AI analysis",
    subtitle: "Understanding skills & experience",
    icon: Brain,
  },
  {
    id: "profile",
    title: "Profile creation",
    subtitle: "Building your professional profile",
    icon: FileCheck2,
  },
  {
    id: "matches",
    title: "Internship matching",
    subtitle: "Preparing relevant opportunities",
    icon: Sparkles,
  },
];

const getAuthHeaders = () => {
  const token =
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken");

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
};

const getResumeId = (item) =>
  item?.id ??
  item?.resume_id ??
  item?.resumeId ??
  item?.data?.id ??
  item?.data?.resume_id ??
  item?.resume?.id ??
  item?.resume?.resume_id;

const getResumeName = (item) =>
  item?.file_name ??
  item?.filename ??
  item?.fileName ??
  item?.name ??
  item?.resume?.file_name ??
  "Resume";

const getResumeStatus = (item) => {
  const status = String(
    item?.analysis_status ?? item?.status ?? item?.analysisStatus ?? "uploaded",
  ).toLowerCase();

  if (["analyzed", "completed", "complete", "success"].includes(status)) {
    return "Analyzed";
  }

  if (["processing", "analyzing", "in_progress"].includes(status)) {
    return "Analyzing";
  }

  if (["failed", "error"].includes(status)) {
    return "Analysis Failed";
  }

  return "Uploaded";
};

const getResumeScore = (item) =>
  item?.score ??
  item?.match_score ??
  item?.profile_score ??
  item?.analysis?.score ??
  item?.analysis?.match_score ??
  null;

const normalizeResumeList = (payload) => {
  const list = Array.isArray(payload)
    ? payload
    : (payload?.resumes ??
      payload?.data ??
      payload?.items ??
      payload?.results ??
      []);

  return Array.isArray(list) ? list : [];
};

const getServerAnalysisProgress = (payload) => {
  const source =
    payload?.resume ?? payload?.data?.resume ?? payload?.data ?? payload;

  const rawProgress =
    source?.analysis_progress ??
    source?.progress ??
    source?.analysisProgress ??
    source?.progress_percent ??
    source?.progressPercent;

  const numericProgress = Number(rawProgress);
  if (
    Number.isFinite(numericProgress) &&
    numericProgress >= 0 &&
    numericProgress <= 100
  ) {
    return Math.max(
      0,
      Math.min(
        ANALYSIS_PIPELINE.length,
        Math.round((numericProgress / 100) * ANALYSIS_PIPELINE.length),
      ),
    );
  }

  const rawStep =
    source?.analysis_step ??
    source?.current_step ??
    source?.currentStep ??
    source?.analysis_stage ??
    source?.stage ??
    source?.step;

  if (typeof rawStep === "number") {
    return Math.max(
      0,
      Math.min(
        ANALYSIS_PIPELINE.length,
        rawStep <= ANALYSIS_PIPELINE.length
          ? rawStep
          : Math.round((rawStep / 100) * ANALYSIS_PIPELINE.length),
      ),
    );
  }

  if (typeof rawStep === "string") {
    const value = rawStep.toLowerCase();
    const index = ANALYSIS_PIPELINE.findIndex(
      (step) =>
        value.includes(step.id) || value.includes(step.title.toLowerCase()),
    );

    if (index >= 0) {
      return index;
    }
  }

  const completedSteps = source?.completed_steps ?? source?.completedSteps;

  if (Array.isArray(completedSteps)) {
    const indexes = completedSteps
      .map((step) => String(step).toLowerCase())
      .map((step) =>
        ANALYSIS_PIPELINE.findIndex(
          (item) =>
            step.includes(item.id) || step.includes(item.title.toLowerCase()),
        ),
      )
      .filter((index) => index >= 0);

    if (indexes.length) {
      return Math.max(...indexes) + 1;
    }
  }

  return null;
};

const formatBytes = (bytes) => {
  const value = Number(bytes || 0);

  if (!value) {
    return "Size unavailable";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const formatUploadedDate = (date) => {
  if (!date) {
    return "Not available";
  }

  try {
    const value = String(date).trim();

    if (!value) {
      return "Not available";
    }

    const hasTimezone = /[zZ]$/.test(value) || /[+-]\d{2}:\d{2}$/.test(value);

    let parsed;

    if (hasTimezone) {
      parsed = new Date(value);
    } else {
      parsed = new Date(value.replace(" ", "T"));
    }

    if (Number.isNaN(parsed.getTime())) {
      return "Not available";
    }

    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(parsed);
  } catch (error) {
    console.error("Uploaded date formatting error:", error);

    return "Not available";
  }
};

const formatAnalyzedDate = (date) => {
  if (!date) {
    return "Not available";
  }

  try {
    let value = String(date).trim();

    if (!value) {
      return "Not available";
    }

    const hasTimezone = /[zZ]$/.test(value) || /[+-]\d{2}:\d{2}$/.test(value);

    if (!hasTimezone) {
      value = value.replace(" ", "T") + "Z";
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return "Not available";
    }

    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(parsed);
  } catch (error) {
    console.error("Analysed date formatting error:", error);

    return "Not available";
  }
};

const getApiErrorMessage = async (response, fallback) => {
  try {
    const data = await response.json();

    return data?.detail || data?.message || data?.error || fallback;
  } catch {
    return fallback;
  }
};

const Resume = () => {
  const navigate = useNavigate();

  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);

  const [dragActive, setDragActive] = useState(false);

  const [resumes, setResumes] = useState([]);

  const [loadingResumes, setLoadingResumes] = useState(true);

  const [uploading, setUploading] = useState(false);

  const [analyzingId, setAnalyzingId] = useState(null);

  const [deletingId, setDeletingId] = useState(null);

  const [openMenu, setOpenMenu] = useState(null);

  const [message, setMessage] = useState(null);

  const [internshipWarning, setInternshipWarning] = useState("");

  const [search, setSearch] = useState("");

  const [viewingResume, setViewingResume] = useState(null);

  const [viewingResumeLoading, setViewingResumeLoading] = useState(false);

  const [viewingResumeError, setViewingResumeError] = useState("");

  const [analysisCompleted, setAnalysisCompleted] = useState(0);

  const [analysisRunning, setAnalysisRunning] = useState(false);

  const analysisTimerRef = useRef(null);

  const analysisPollRef = useRef(null);

  const loadResumes = useCallback(async () => {
    setLoadingResumes(true);

    try {
      const response = await fetch(API.resumes, {
        method: "GET",

        headers: {
          Accept: "application/json",

          ...getAuthHeaders(),
        },
      });

      if (response.status === 401) {
        navigate("/login", {
          replace: true,
        });

        return;
      }

      if (!response.ok) {
        const errorMessage = await getApiErrorMessage(
          response,
          `Unable to load resumes (${response.status}).`,
        );

        throw new Error(errorMessage);
      }

      const data = await response.json();

      setResumes(normalizeResumeList(data));
    } catch (error) {
      console.error("Get resumes error:", error);

      setMessage({
        type: "error",

        text:
          error?.message ||
          "Unable to load your saved resumes. Please try again.",
      });
    } finally {
      setLoadingResumes(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadResumes();
  }, [loadResumes]);

  useEffect(() => {
    const closeMenu = (event) => {
      if (!event.target.closest(".resume-menu-wrapper")) {
        setOpenMenu(null);
      }
    };

    document.addEventListener("click", closeMenu);

    return () => {
      document.removeEventListener("click", closeMenu);
    };
  }, []);

  const handlePointerMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();

    event.currentTarget.style.setProperty(
      "--pointer-x",
      `${event.clientX - rect.left}px`,
    );

    event.currentTarget.style.setProperty(
      "--pointer-y",
      `${event.clientY - rect.top}px`,
    );
  };

  const resetInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);

    setDragActive(false);

    resetInput();

    setMessage(null);
  };

  const validateFile = (file) => {
    if (!file) {
      return false;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!["pdf", "docx"].includes(extension)) {
      setMessage({
        type: "error",

        text: "Only PDF and DOCX resumes are supported.",
      });

      return false;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({
        type: "error",

        text: "The maximum resume size is 5MB.",
      });

      return false;
    }

    return true;
  };

  const chooseFile = (file) => {
    if (!validateFile(file)) {
      resetInput();
      return;
    }

    setMessage(null);

    setSelectedFile(file);
  };

  const handleFileChange = (event) => {
    chooseFile(event.target.files?.[0]);
  };

  const handleDrop = (event) => {
    event.preventDefault();

    setDragActive(false);

    chooseFile(event.dataTransfer.files?.[0]);
  };

  const uploadResume = async () => {
    if (!selectedFile || uploading || analyzingId) {
      return;
    }

    setUploading(true);

    setMessage(null);

    try {
      const formData = new FormData();

      formData.append("file", selectedFile);

      const response = await fetch(API.upload, {
        method: "POST",

        headers: {
          ...getAuthHeaders(),
        },

        body: formData,
      });

      if (response.status === 401) {
        navigate("/login", {
          replace: true,
        });

        return;
      }

      if (!response.ok) {
        const errorMessage = await getApiErrorMessage(
          response,
          `Resume upload failed (${response.status}).`,
        );

        throw new Error(errorMessage);
      }

      const data = await response.json();

      const uploadedResume = data?.resume ?? data?.data ?? data?.result ?? data;

      const resumeId = getResumeId(uploadedResume);

      if (!resumeId) {
        throw new Error(
          "Resume uploaded, but the API did not return a resume ID.",
        );
      }

      setResumes((previous) => [
        uploadedResume,

        ...previous.filter((item) => getResumeId(item) !== resumeId),
      ]);

      setSelectedFile(null);

      resetInput();

      setMessage({
        type: "success",

        text: "Resume uploaded successfully. You can now analyse it.",
      });

      await loadResumes();
    } catch (error) {
      console.error("Upload resume error:", error);

      setMessage({
        type: "error",

        text:
          error?.message || "Unable to upload the resume. Please try again.",
      });
    } finally {
      setUploading(false);
    }
  };

  const analyzeResume = async (resumeId, options = {}) => {
    const { isReanalysis = false, redirectAfter = false } = options;

    if (!resumeId || analyzingId) {
      return;
    }

    setAnalyzingId(resumeId);

    startAnalysisProgress(resumeId);

    setOpenMenu(null);

    setMessage({
      type: "success",

      text: isReanalysis
        ? "Re-analysing your resume from the original file. Text extraction, Regex and Groq AI are running again..."
        : "Analysing your resume. Text extraction, Regex and Groq AI are running...",
    });

    setResumes((previous) =>
      previous.map((item) =>
        getResumeId(item) === resumeId
          ? {
              ...item,

              analysis_status: "analyzing",
            }
          : item,
      ),
    );

    try {
      const response = await fetch(`${API.resumes}/${resumeId}/analyze`, {
        method: "POST",

        headers: {
          Accept: "application/json",

          ...getAuthHeaders(),
        },
      });

      if (response.status === 401) {
        navigate("/login", {
          replace: true,
        });

        return;
      }

      if (response.status === 409) {
        throw new Error(
          "This resume is already being analysed. Please wait for the current analysis to finish.",
        );
      }

      if (!response.ok) {
        const errorMessage = await getApiErrorMessage(
          response,
          `Resume analysis failed (${response.status}).`,
        );

        throw new Error(errorMessage);
      }

      const result = await response.json();

      await loadResumes();

      setMessage({
        type: "success",

        text:
          result?.message ||
          (isReanalysis
            ? "Resume re-analysed successfully. Your profile has been completely refreshed."
            : "Resume analysed successfully."),
      });

      if (redirectAfter) {
        window.setTimeout(() => {
          navigate("/dashboard", {
            state: {
              resumeAnalyzed: true,

              resumeId: resumeId,

              reanalyzed: isReanalysis,
            },
          });
        }, 1800);
      }
    } catch (error) {
      console.error(
        isReanalysis ? "Re-analyse resume error:" : "Analyse resume error:",
        error,
      );

      await loadResumes();

      setMessage({
        type: "error",

        text:
          error?.message ||
          (isReanalysis
            ? "Unable to re-analyse the resume. Please try again."
            : "Unable to analyse this resume. Please try again."),
      });
    } finally {
      setAnalyzingId(null);
    }
  };

  const analyzeUploadedResume = async () => {
    if (!selectedFile || uploading || analyzingId) {
      return;
    }

    setUploading(true);

    setMessage({
      type: "success",

      text: "Uploading your resume...",
    });

    try {
      const formData = new FormData();

      formData.append("file", selectedFile);

      const uploadResponse = await fetch(API.upload, {
        method: "POST",

        headers: {
          ...getAuthHeaders(),
        },

        body: formData,
      });

      if (uploadResponse.status === 401) {
        navigate("/login", {
          replace: true,
        });

        return;
      }

      if (!uploadResponse.ok) {
        const errorMessage = await getApiErrorMessage(
          uploadResponse,
          `Resume upload failed (${uploadResponse.status}).`,
        );

        throw new Error(errorMessage);
      }

      const uploadData = await uploadResponse.json();

      const uploadedResume =
        uploadData?.resume ??
        uploadData?.data ??
        uploadData?.result ??
        uploadData;

      const resumeId = getResumeId(uploadedResume);

      if (!resumeId) {
        throw new Error(
          "Resume uploaded, but no resume ID was returned by the backend.",
        );
      }

      setResumes((previous) => [
        uploadedResume,

        ...previous.filter((item) => getResumeId(item) !== resumeId),
      ]);

      setSelectedFile(null);

      resetInput();

      setMessage({
        type: "success",

        text: "Resume uploaded. Starting complete AI analysis...",
      });

      await analyzeResume(resumeId, {
        isReanalysis: false,

        redirectAfter: true,
      });
    } catch (error) {
      console.error("Upload + analyse error:", error);

      setMessage({
        type: "error",

        text: error?.message || "Unable to upload and analyse the resume.",
      });
    } finally {
      setUploading(false);
    }
  };

  const reanalyzeResume = async (resumeId) => {
    if (!resumeId || analyzingId) {
      return;
    }

    await analyzeResume(resumeId, {
      isReanalysis: true,

      redirectAfter: false,
    });
  };

  /* =========================================================
     VIEW RESUME DETAILS
     ========================================================= */

  const viewResumeDetails = async (resumeId) => {
    if (!resumeId) {
      setViewingResumeError(
        "Unable to load resume details because the resume ID is missing.",
      );

      return;
    }

    setOpenMenu(null);
    setViewingResume(null);
    setViewingResumeError("");
    setViewingResumeLoading(true);

    try {
      const response = await fetch(`${API.resumes}/${resumeId}`, {
        method: "GET",

        headers: {
          Accept: "application/json",

          ...getAuthHeaders(),
        },
      });

      if (response.status === 401) {
        navigate("/login", {
          replace: true,
        });

        return;
      }

      if (response.status === 404) {
        throw new Error(
          "Resume details were not found. The resume may have been deleted.",
        );
      }

      if (!response.ok) {
        const errorMessage = await getApiErrorMessage(
          response,
          `Unable to load resume details (${response.status}).`,
        );

        throw new Error(errorMessage);
      }

      const data = await response.json();

      /*
       * Support the common response wrappers used by the
       * resume API while preserving the complete response
       * as a fallback.
       */
      const details =
        data?.resume ??
        data?.data?.resume ??
        data?.data ??
        data?.result ??
        data;

      if (!details || typeof details !== "object") {
        throw new Error("The resume details API returned an invalid response.");
      }

      setViewingResume(details);
    } catch (error) {
      console.error("View resume details error:", error);

      setViewingResumeError(
        error?.message || "Unable to load resume details. Please try again.",
      );
    } finally {
      setViewingResumeLoading(false);
    }
  };

  /* =========================================================
     DELETE RESUME
     ========================================================= */

  const deleteResume = async (resumeId) => {
    if (!resumeId || deletingId) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this resume permanently? This will remove it from your database.",
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(resumeId);

    setOpenMenu(null);

    setMessage(null);

    try {
      const response = await fetch(`${API.resumes}/${resumeId}`, {
        method: "DELETE",

        headers: {
          Accept: "application/json",

          ...getAuthHeaders(),
        },
      });

      if (response.status === 401) {
        navigate("/login", {
          replace: true,
        });

        return;
      }

      if (!response.ok) {
        const errorMessage = await getApiErrorMessage(
          response,
          `Delete failed (${response.status}).`,
        );

        throw new Error(errorMessage);
      }

      setResumes((previous) =>
        previous.filter((item) => getResumeId(item) !== resumeId),
      );

      setMessage({
        type: "success",

        text: "Resume deleted successfully.",
      });

      /*
       * The resume state in the database has changed.
       * Ask the dashboard API for the CURRENT dashboard
       * eligibility instead of relying on localStorage.
       *
       * This also handles the future case where a user has
       * more than one resume: if another analysed resume
       * still exists, the backend can return "user".
       */
      try {
        const dashboardResponse = await fetch(`${API_BASE_URL}/api/dashboard`, {
          method: "GET",

          headers: {
            Accept: "application/json",

            ...getAuthHeaders(),
          },
        });

        if (dashboardResponse.status === 401) {
          navigate("/login", {
            replace: true,
          });

          return;
        }

        if (!dashboardResponse.ok) {
          throw new Error(
            `Unable to refresh dashboard status (${dashboardResponse.status}).`,
          );
        }

        const dashboardData = await dashboardResponse.json();

        const dashboardType =
          dashboardData?.dashboard_type === "user" ? "user" : "default";

        localStorage.setItem("dashboard_type", dashboardType);

        if (dashboardType === "user") {
          navigate("/userDashboard", {
            replace: true,
          });
        } else {
          navigate("/defaultDashboard", {
            replace: true,
          });
        }
      } catch (dashboardError) {
        console.error(
          "Dashboard refresh after resume deletion error:",
          dashboardError,
        );

        /*
         * Safe fallback: after a successful delete, never
         * leave an old User Dashboard state active when the
         * dashboard status cannot be verified.
         */
        localStorage.setItem("dashboard_type", "default");

        navigate("/defaultDashboard", {
          replace: true,
        });
      }
    } catch (error) {
      console.error("Delete resume error:", error);

      setMessage({
        type: "error",

        text: error?.message || "Unable to delete the resume.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredResumes = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return resumes;
    }

    return resumes.filter((resume) =>
      getResumeName(resume).toLowerCase().includes(query),
    );
  }, [resumes, search]);

  const analyzedCount = resumes.filter(
    (resume) => getResumeStatus(resume) === "Analyzed",
  ).length;

  const uploadedCount = resumes.length;

  const selectedFileReady = Boolean(selectedFile);

  const stopAnalysisProgress = useCallback(() => {
    if (analysisTimerRef.current) {
      clearInterval(analysisTimerRef.current);
      analysisTimerRef.current = null;
    }

    if (analysisPollRef.current) {
      clearInterval(analysisPollRef.current);
      analysisPollRef.current = null;
    }

    setAnalysisRunning(false);
  }, []);

  const startAnalysisProgress = useCallback(
    (resumeId) => {
      if (!resumeId) return;

      if (analysisTimerRef.current) {
        clearInterval(analysisTimerRef.current);
      }

      if (analysisPollRef.current) {
        clearInterval(analysisPollRef.current);
      }

      setAnalysisRunning(true);

      setAnalysisCompleted(1);

      let localStage = 1;

      analysisTimerRef.current = setInterval(() => {
        localStage = Math.min(ANALYSIS_PIPELINE.length - 1, localStage + 1);

        setAnalysisCompleted((previous) => Math.max(previous, localStage));
      }, 2400);

      analysisPollRef.current = setInterval(async () => {
        try {
          const response = await fetch(`${API.resumes}/${resumeId}`, {
            method: "GET",
            headers: {
              Accept: "application/json",
              ...getAuthHeaders(),
            },
          });

          if (!response.ok) return;

          const data = await response.json();

          const progress = getServerAnalysisProgress(data);

          if (progress !== null) {
            localStage = Math.max(localStage, progress);

            setAnalysisCompleted((previous) => Math.max(previous, progress));
          }

          const resume =
            data?.resume ?? data?.data?.resume ?? data?.data ?? data;

          const status = String(
            resume?.analysis_status ?? resume?.status ?? "",
          ).toLowerCase();

          if (
            ["analyzed", "completed", "complete", "success"].includes(status)
          ) {
            setAnalysisCompleted(ANALYSIS_PIPELINE.length);
            stopAnalysisProgress();
          }
        } catch {}
      }, 1500);
    },
    [stopAnalysisProgress],
  );

  useEffect(() => {
    return () => {
      stopAnalysisProgress();
    };
  }, [stopAnalysisProgress]);

  useEffect(() => {
    if (analyzingId) return;

    if (analyzedCount > 0) {
      setAnalysisCompleted(ANALYSIS_PIPELINE.length);
    } else if (uploadedCount > 0) {
      setAnalysisCompleted(1);
    } else {
      setAnalysisCompleted(0);
    }
  }, [analyzedCount, uploadedCount, analyzingId]);

  return (
    <div className="resume-page" onMouseMove={handlePointerMove}>
      <div className="resume-pointer-light" />

      <main className="resume-main">
        <div className="resume-content">
          <div className="resume-breadcrumb">
            <button type="button" onClick={() => navigate("/defaultDashboard")}>
              Home
            </button>
            <ChevronRight size={14} />
            <strong>Resume</strong>
          </div>

          <section className="resume-hero glass-panel">
            <div className="resume-hero-copy">
              <span className="resume-hero-eyebrow">
                <Sparkles size={14} />
                AI CAREER ASSISTANT
              </span>

              <h1>
                Build a resume that
                <span> gets noticed.</span>
              </h1>

              <p>
                Upload your resume and let our AI extract your skills, education
                and experience, create your professional profile and prepare
                personalized internship matches.
              </p>

              <div className="resume-hero-pills">
                <div className="resume-hero-pill">
                  <ShieldCheck size={16} />
                  Private &amp; secure
                </div>
                <div className="resume-hero-pill">
                  <Brain size={16} />
                  AI powered analysis
                </div>
              </div>
            </div>

            <div className="resume-hero-visual">
              <div className="resume-hero-ring ring-one" />
              <div className="resume-hero-ring ring-two" />
              <div className="resume-hero-image-wrap">
                <img
                  src="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=85"
                  alt="Professional working with documents on a laptop"
                />
                <div className="resume-hero-image-overlay" />
                <div className="resume-hero-image-badge">
                  <ShieldCheck size={17} />
                  <span>Profile protected</span>
                </div>
                <div className="resume-hero-floating-card">
                  <div className="resume-hero-floating-icon">
                    <CheckCircle2 size={17} />
                  </div>
                  <div>
                    <strong>
                      {analyzedCount > 0
                        ? "AI analysis ready"
                        : "AI analysis ready"}
                    </strong>
                    <span>
                      {uploadedCount} resume{uploadedCount === 1 ? "" : "s"} in
                      your library
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="resume-workspace">
            <div className="resume-primary-column">
              <section className="resume-process-card glass-panel">
                <div className="process-card-heading">
                  <div>
                    <span className="resume-section-label">LIVE PIPELINE</span>
                    <h2>Resume analysis process</h2>
                    <p>
                      Each stage starts in red and turns green only after it is
                      completed.
                    </p>
                  </div>

                  <div
                    className={`process-live-indicator ${
                      analysisRunning
                        ? "is-running"
                        : analysisCompleted === ANALYSIS_PIPELINE.length
                          ? "is-complete"
                          : ""
                    }`}
                  >
                    <span />
                    {analysisRunning
                      ? "AI PROCESSING"
                      : analysisCompleted === ANALYSIS_PIPELINE.length
                        ? "ANALYSIS COMPLETE"
                        : "WAITING"}
                  </div>
                </div>

                <div className="analysis-progress-track">
                  <div
                    className="analysis-progress-fill"
                    style={{
                      width: `${
                        (analysisCompleted / ANALYSIS_PIPELINE.length) * 100
                      }%`,
                    }}
                  />
                </div>

                <div className="analysis-pipeline">
                  {ANALYSIS_PIPELINE.map((step, index) => {
                    const Icon = step.icon;
                    const completed = index < analysisCompleted;
                    const active =
                      analysisRunning && index === analysisCompleted;

                    return (
                      <div
                        className={`analysis-step ${
                          completed
                            ? "is-completed"
                            : active
                              ? "is-active"
                              : "is-pending"
                        }`}
                        key={step.id}
                      >
                        <div className="analysis-step-marker">
                          {completed ? (
                            <CheckCircle2 size={17} />
                          ) : active ? (
                            <LoaderCircle size={17} className="spin" />
                          ) : (
                            <Icon size={17} />
                          )}
                        </div>

                        <div className="analysis-step-copy">
                          <div className="analysis-step-topline">
                            <span>0{index + 1}</span>
                            <strong>{step.title}</strong>
                          </div>
                          <p>{step.subtitle}</p>
                        </div>

                        <span className="analysis-step-state">
                          {completed
                            ? "Completed"
                            : active
                              ? "Processing"
                              : "Pending"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section
                className={`resume-dropzone glass-panel ${
                  dragActive ? "dropzone-active" : ""
                } ${selectedFile ? "has-file" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
              >
                <div className="dropzone-pointer-glow" />

                {!selectedFile ? (
                  <>
                    <div className="upload-orb">
                      <UploadCloud size={35} />
                    </div>

                    <span className="dropzone-badge">
                      <Sparkles size={12} />
                      STEP 01 · SELECT RESUME
                    </span>

                    <h2>Drop your resume here</h2>

                    <p>
                      Drag and drop your latest resume or choose a file from
                      your computer.
                    </p>

                    <div className="dropzone-or">
                      <span />
                      <b>OR</b>
                      <span />
                    </div>

                    <button
                      type="button"
                      className="primary-resume-button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FileText size={17} />
                      Choose Resume
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx"
                      hidden
                      onChange={handleFileChange}
                    />

                    <div className="upload-requirements">
                      <span>PDF</span>
                      <span>DOCX</span>
                      <i />
                      <span>Maximum 5MB</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="selected-file-icon">
                      <FileText size={32} />
                      <span>
                        <CheckCircle2 size={13} />
                      </span>
                    </div>

                    <span className="dropzone-badge success-badge">
                      <CheckCircle2 size={12} />
                      FILE SELECTED
                    </span>

                    <h2>Resume is ready</h2>

                    <p>
                      Your file is ready to upload. Remove it to select a
                      different resume.
                    </p>

                    <div className="selected-file-card">
                      <div className="selected-file-left">
                        <div className="pdf-mini">FILE</div>

                        <div>
                          <strong>{selectedFile.name}</strong>
                          <span>
                            {formatBytes(selectedFile.size)}
                            {" · "}
                            {selectedFile.type || "Resume document"}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="remove-file-button"
                        onClick={clearSelectedFile}
                        aria-label="Remove selected resume"
                        title="Remove selected resume"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="selected-file-actions">
                      <button
                        type="button"
                        className="secondary-resume-button"
                        onClick={clearSelectedFile}
                        disabled={uploading}
                      >
                        Choose Another
                      </button>

                      <button
                        type="button"
                        className="primary-resume-button"
                        onClick={uploadResume}
                        disabled={uploading || Boolean(analyzingId)}
                      >
                        {uploading ? (
                          <>
                            <span className="button-spinner" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <UploadCloud size={17} />
                            Upload Resume
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}

                {message && (
                  <div
                    className={`resume-inline-message ${
                      message.type === "error"
                        ? "error-message"
                        : "success-message"
                    }`}
                  >
                    {message.type === "error" ? (
                      <AlertCircle size={15} />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                    <span>{message.text}</span>
                  </div>
                )}

                <div className="secure-upload-note">
                  <ShieldCheck size={14} />
                  Secure upload · Your resume stays private
                </div>
              </section>

              <section className="saved-resumes-section">
                <div className="section-heading-row">
                  <div>
                    <span className="resume-section-label">
                      YOUR RESUME LIBRARY
                    </span>
                    <h2>Saved Resumes</h2>
                  </div>

                  <div className="resume-library-actions">
                    <div className="resume-library-search">
                      <Search size={15} />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search resumes..."
                        aria-label="Search resumes"
                      />

                      {search && (
                        <button
                          type="button"
                          onClick={() => setSearch("")}
                          aria-label="Clear search"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      className="refresh-resumes-button"
                      onClick={loadResumes}
                      disabled={loadingResumes || Boolean(analyzingId)}
                    >
                      <RotateCcw size={14} />
                      Refresh
                    </button>
                  </div>
                </div>

                {loadingResumes ? (
                  <div className="resume-loading-grid">
                    {[1, 2].map((item) => (
                      <div className="resume-skeleton glass-panel" key={item}>
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>
                    ))}
                  </div>
                ) : filteredResumes.length === 0 ? (
                  <div className="empty-resumes glass-panel">
                    <div className="empty-icon">
                      <FileText size={25} />
                    </div>
                    <h3>
                      {search ? "No matching resumes" : "No saved resumes yet"}
                    </h3>
                    <p>
                      {search
                        ? "Try another search term."
                        : "Upload a resume and it will appear here after the backend saves it."}
                    </p>
                  </div>
                ) : (
                  <div className="saved-resume-grid">
                    {filteredResumes.map((resume) => {
                      const id = getResumeId(resume);
                      const status = getResumeStatus(resume);
                      const score = getResumeScore(resume);
                      const isAnalyzing = analyzingId === id;
                      const isDeleting = deletingId === id;

                      return (
                        <article
                          className={`saved-resume-card glass-panel ${
                            isAnalyzing ? "resume-card-analyzing" : ""
                          }`}
                          key={id || getResumeName(resume)}
                        >
                          <div className="saved-card-top">
                            <div className="saved-file-icon">
                              <FileText size={23} />
                            </div>

                            <div className="resume-menu-wrapper">
                              <button
                                type="button"
                                className="resume-more-button"
                                onClick={(event) => {
                                  event.stopPropagation();

                                  if (isAnalyzing) {
                                    return;
                                  }

                                  setOpenMenu(openMenu === id ? null : id);
                                }}
                                aria-label="Resume options"
                              >
                                <MoreVertical size={18} />
                              </button>

                              {openMenu === id && (
                                <div className="resume-action-menu">
                                  <button
                                    type="button"
                                    disabled={!id}
                                    onClick={() => viewResumeDetails(id)}
                                  >
                                    <Eye size={14} />
                                    View Details
                                  </button>

                                  <button
                                    type="button"
                                    className="delete-action"
                                    disabled={!id || isDeleting || isAnalyzing}
                                    onClick={() => deleteResume(id)}
                                  >
                                    <Trash2 size={14} />
                                    {isDeleting
                                      ? "Deleting..."
                                      : "Delete Resume"}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="saved-resume-main">
                            <h3 title={getResumeName(resume)}>
                              {getResumeName(resume)}
                            </h3>

                            <p>
                              {formatBytes(resume?.file_size ?? resume?.size)}
                              <span>•</span>
                              {formatUploadedDate(
                                resume?.uploaded_at ?? resume?.uploadedAt,
                              )}
                            </p>
                          </div>

                          <div className="saved-card-bottom">
                            <span
                              className={`resume-status ${
                                status === "Analyzed"
                                  ? "analyzed"
                                  : status === "Analyzing"
                                    ? "processing"
                                    : status === "Analysis Failed"
                                      ? "failed"
                                      : ""
                              }`}
                            >
                              {status === "Analyzing" ? (
                                <Clock3 size={13} />
                              ) : status === "Analysis Failed" ? (
                                <AlertCircle size={13} />
                              ) : (
                                <CheckCircle2 size={13} />
                              )}

                              {status}
                            </span>

                            {score !== null && score !== undefined ? (
                              <strong>{score}%</strong>
                            ) : (
                              <span className="no-score">
                                {status === "Analyzed"
                                  ? "Profile ready"
                                  : status === "Analyzing"
                                    ? "AI processing..."
                                    : status === "Analysis Failed"
                                      ? "Try again"
                                      : "Not analyzed"}
                              </span>
                            )}
                          </div>

                          {id && (
                            <button
                              type="button"
                              className="card-analyze-button"
                              onClick={() =>
                                status === "Analyzed"
                                  ? reanalyzeResume(id)
                                  : analyzeResume(id, {
                                      isReanalysis: false,
                                      redirectAfter: true,
                                    })
                              }
                              disabled={isAnalyzing}
                            >
                              {isAnalyzing ? (
                                <>
                                  <span className="button-spinner small" />
                                  Analysing...
                                </>
                              ) : status === "Analyzed" ? (
                                <>
                                  <RotateCcw size={14} />
                                  Re-analyse Resume
                                </>
                              ) : (
                                <>
                                  <Sparkles size={14} />
                                  Analyse Resume
                                </>
                              )}
                            </button>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <aside className="resume-side-column">
              <section className="resume-tips-card glass-panel">
                <div className="tips-header">
                  <div className="tips-icon">
                    <Sparkles size={19} />
                  </div>

                  <div>
                    <span>AI GUIDANCE</span>
                    <h2>Resume Tips</h2>
                  </div>
                </div>

                {[
                  [
                    "Use a clear format",
                    "A structured resume helps AI extract information accurately.",
                    CheckCircle2,
                  ],
                  [
                    "Add education",
                    "Include your degree, college and graduation year.",
                    GraduationCap,
                  ],
                  [
                    "Highlight skills",
                    "Mention technical skills, tools and technologies you know.",
                    BarChart3,
                  ],
                  [
                    "Add experience",
                    "Include internships, projects and relevant work experience.",
                    BriefcaseBusiness,
                  ],
                  [
                    "Keep it updated",
                    "Upload your latest resume whenever your profile changes.",
                    RotateCcw,
                  ],
                ].map(([title, text, Icon]) => (
                  <div className="tip-item" key={title}>
                    <div className="tip-item-icon">
                      <Icon size={18} />
                    </div>
                    <div>
                      <h3>{title}</h3>
                      <p>{text}</p>
                    </div>
                  </div>
                ))}
              </section>

              <section className="resume-analysis-preview glass-panel">
                <div className="preview-icon">
                  <Brain size={20} />
                </div>

                <span>AFTER AI ANALYSIS</span>

                <h2>Your profile gets smarter</h2>

                <div className="preview-points">
                  {[
                    ["Skills extracted", analysisCompleted >= 4],
                    ["Education identified", analysisCompleted >= 4],
                    ["Experience mapped", analysisCompleted >= 5],
                    ["Internship matching", analysisCompleted >= 6],
                  ].map(([text, complete]) => (
                    <div
                      className={
                        complete
                          ? "preview-point-complete"
                          : "preview-point-pending"
                      }
                      key={text}
                    >
                      {complete ? (
                        <CheckCircle2 size={14} />
                      ) : (
                        <Clock3 size={14} />
                      )}
                      {text}
                    </div>
                  ))}
                </div>
              </section>

              <section className="resume-next-card glass-panel">
                <span className="resume-section-label">NEXT STEP</span>

                <h2>Ready to find your match?</h2>

                <p>
                  Once analysis finishes, your personalized dashboard can show
                  your profile and relevant internship opportunities.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    if (analyzedCount === 0) {
                      setInternshipWarning(
                        resumes.length === 0
                          ? "Please upload and analyse your resume before exploring internships. Your resume helps us find relevant opportunities for you."
                          : "Please analyse your uploaded resume before exploring internships. Internship recommendations are available after AI analysis is complete.",
                      );
                      return;
                    }

                    setInternshipWarning("");
                    navigate("/internships");
                  }}
                >
                  Explore Internships
                  <ArrowRight size={16} />
                </button>

                {internshipWarning && (
                  <div className="internship-warning-message" role="alert">
                    <AlertCircle size={15} />
                    <span>{internshipWarning}</span>
                  </div>
                )}
              </section>

              <section className="resume-security-card glass-panel">
                <div className="security-round">
                  <ShieldCheck size={20} />
                </div>

                <div>
                  <strong>Your data is safe</strong>
                  <p>
                    Resume records are linked to your account and managed by the
                    backend.
                  </p>
                </div>
              </section>
            </aside>
          </section>
        </div>
      </main>

      {/* =====================================================
          VIEW RESUME DETAILS MODAL
      ===================================================== */}

      {(viewingResumeLoading || viewingResumeError || viewingResume) && (
        <div
          className="resume-details-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Resume details"
          onClick={() => {
            if (!viewingResumeLoading) {
              setViewingResume(null);
              setViewingResumeError("");
            }
          }}
        >
          <div
            className="resume-details-modal glass-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="resume-details-header">
              <div>
                <span className="resume-section-label">RESUME DETAILS</span>

                <h2>
                  {viewingResume
                    ? getResumeName(viewingResume)
                    : "Resume Details"}
                </h2>
              </div>

              <button
                type="button"
                className="remove-file-button"
                onClick={() => {
                  setViewingResume(null);
                  setViewingResumeError("");
                }}
                aria-label="Close resume details"
                title="Close"
                disabled={viewingResumeLoading}
              >
                <X size={18} />
              </button>
            </div>

            {viewingResumeLoading && (
              <div className="resume-details-loading">
                <span className="button-spinner" />
                <p>Loading resume details...</p>
              </div>
            )}

            {viewingResumeError && !viewingResumeLoading && (
              <div className="resume-inline-message error-message">
                <AlertCircle size={15} />
                <span>{viewingResumeError}</span>
              </div>
            )}

            {viewingResume && !viewingResumeLoading && (
              <div className="resume-details-content">
                <div className="resume-details-section">
                  <div className="resume-details-section-title">
                    <FileText size={18} />
                    <h3>Resume Information</h3>
                  </div>

                  <div className="resume-details-grid">
                    <div className="resume-detail-item">
                      <span>File Name</span>
                      <strong>{getResumeName(viewingResume)}</strong>
                    </div>

                    <div className="resume-detail-item">
                      <span>Resume ID</span>
                      <strong>
                        {getResumeId(viewingResume) ?? "Unavailable"}
                      </strong>
                    </div>

                    <div className="resume-detail-item">
                      <span>Analysis Status</span>
                      <strong>{getResumeStatus(viewingResume)}</strong>
                    </div>

                    <div className="resume-detail-item">
                      <span>File Type</span>
                      <strong>
                        {viewingResume?.file_type ??
                          viewingResume?.fileType ??
                          "Unavailable"}
                      </strong>
                    </div>

                    <div className="resume-detail-item">
                      <span>File Size</span>
                      <strong>
                        {formatBytes(
                          viewingResume?.file_size ?? viewingResume?.size,
                        )}
                      </strong>
                    </div>

                    <div className="resume-detail-item">
                      <span>Uploaded At</span>
                      <strong>
                        {formatUploadedDate(
                          viewingResume?.uploaded_at ??
                            viewingResume?.uploadedAt,
                        )}
                      </strong>
                    </div>

                    <div className="resume-detail-item">
                      <span>Analysed At</span>
                      <strong>
                        {formatAnalyzedDate(
                          viewingResume?.analyzed_at ??
                            viewingResume?.analyzedAt,
                        )}
                      </strong>
                    </div>
                  </div>
                </div>

                {(() => {
                  const profile =
                    viewingResume?.resume_profile ??
                    viewingResume?.profile ??
                    viewingResume?.resumeProfile;

                  if (!profile) {
                    return null;
                  }

                  return (
                    <div className="resume-details-section">
                      <div className="resume-details-section-title">
                        <UserCircle size={18} />
                        <h3>Professional Profile</h3>
                      </div>

                      <div className="resume-details-grid">
                        <div className="resume-detail-item">
                          <span>Full Name</span>
                          <strong>
                            {profile?.full_name ??
                              profile?.fullName ??
                              "Not available"}
                          </strong>
                        </div>

                        <div className="resume-detail-item">
                          <span>Email</span>
                          <strong>{profile?.email ?? "Not available"}</strong>
                        </div>

                        <div className="resume-detail-item">
                          <span>Phone</span>
                          <strong>{profile?.phone ?? "Not available"}</strong>
                        </div>

                        <div className="resume-detail-item">
                          <span>Professional Summary</span>
                          <strong>
                            {profile?.professional_summary ??
                              profile?.professionalSummary ??
                              "Not available"}
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {(() => {
                  const extractedText =
                    viewingResume?.extracted_text ??
                    viewingResume?.text ??
                    viewingResume?.extractedText;

                  if (!extractedText) {
                    return null;
                  }

                  return (
                    <div className="resume-details-section">
                      <div className="resume-details-section-title">
                        <FileText size={18} />
                        <h3>Extracted Resume Text</h3>
                      </div>

                      <div className="resume-extracted-text">
                        {String(extractedText)}
                      </div>
                    </div>
                  );
                })()}

                {/*
                 * If the backend returns additional fields that
                 * are not displayed above, show them here. This
                 * prevents valid API data from silently disappearing.
                 */}
                <div className="resume-details-section">
                  <div className="resume-details-section-title">
                    <FileCheck2 size={18} />
                    <h3>Complete API Response</h3>
                  </div>

                  <pre className="resume-details-json">
                    {JSON.stringify(viewingResume, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Resume;

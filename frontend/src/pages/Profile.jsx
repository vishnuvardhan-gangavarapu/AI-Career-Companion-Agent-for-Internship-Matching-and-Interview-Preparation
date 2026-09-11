import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  UserRound,
  Camera,
  Edit3,
  Save,
  X,
  Mail,
  Phone,
  MapPin,
  BriefcaseBusiness,
  GraduationCap,
  Code2,
  Award,
  FolderKanban,
  ExternalLink,
  Plus,
  Trash2,
  CheckCircle2,
  Loader2,
  Upload,
  RefreshCw,
  Link2,
  Heart,
  Trophy,
  Languages,
  Sparkles,
  ChevronDown,
  CalendarDays,
  Building2,
  Globe,
  Target,
  FileText,
} from "lucide-react";

import "../styles/Profile.css";

/* =========================================================
   API
========================================================= */

const API_BASE_URL = "http://127.0.0.1:8000";

const API = {
  profile: `${API_BASE_URL}/api/profile`,
  resumes: `${API_BASE_URL}/api/resumes`,
};

/* =========================================================
   PROFILE IMAGE URL
========================================================= */

const getProfileImageUrl = (value) => {
  if (!value) return "";

  const image = String(value).trim();

  if (!image) return "";

  if (
    image.startsWith("http://") ||
    image.startsWith("https://") ||
    image.startsWith("data:") ||
    image.startsWith("blob:")
  ) {
    return image;
  }

  if (image.startsWith("/")) {
    return `${API_BASE_URL}${image}`;
  }

  return `${API_BASE_URL}/${image}`;
};

/* =========================================================
   AUTH
========================================================= */

const getToken = () => {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") ||
    ""
  );
};

const getAuthHeaders = () => {
  const token = getToken();

  return {
    Accept: "application/json",
    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),
  };
};

const getJsonHeaders = () => ({
  ...getAuthHeaders(),
  "Content-Type": "application/json",
});

/* =========================================================
   SAFE HELPERS
========================================================= */

const safeString = (...values) => {
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

const safeArray = (value) => {
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

      if (parsed && typeof parsed === "object") {
        return Object.values(parsed);
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

const displayValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(displayValue).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    return safeString(
      value.name,
      value.title,
      value.label,
      value.value,
      value.skill,
      value.degree,
      value.course,
      value.institution,
      value.company,
      value.description,
      value.text,
    );
  }

  return "";
};

const itemName = (item) => {
  return safeString(
    item?.name,
    item?.title,
    item?.skill,
    item?.label,
    item?.value,
    item?.language,
    item?.certification,
  );
};

const normalizeStringArray = (value) => {
  const output = [];

  const add = (item) => {
    if (item === null || item === undefined) {
      return;
    }

    if (typeof item === "string") {
      item
        .split(/[,\n;|]/)
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => output.push(part));
      return;
    }

    if (typeof item === "number" || typeof item === "boolean") {
      output.push(String(item));
      return;
    }

    if (Array.isArray(item)) {
      item.forEach(add);
      return;
    }

    if (typeof item === "object") {
      // Handle common skill-object shapes.
      const direct =
        item.name ??
        item.skill ??
        item.title ??
        item.label ??
        item.value ??
        item.technology ??
        item.technologies;

      if (direct !== undefined) {
        add(direct);
        return;
      }

      // Handle nested structures such as:
      // { technical: [...], soft: [...] }
      // { technical_skills: [...] }
      Object.values(item).forEach(add);
    }
  };

  add(value);

  return [
    ...new Map(
      output
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => [item.toLowerCase(), item]),
    ).values(),
  ];
};

const firstNonEmptySkillList = (...values) => {
  for (const value of values) {
    const result = normalizeStringArray(value);
    if (result.length > 0) {
      return result;
    }
  }
  return [];
};

const formatDate = (value) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const normalizeDateForInput = (value) => {
  if (!value) return "";

  const stringValue = String(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
    return stringValue;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
};

/* =========================================================
   STORED USER
========================================================= */

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

/* =========================================================
   EMPTY OBJECTS
========================================================= */

const emptyEducation = () => ({
  degree: "",
  field_of_study: "",
  institution: "",
  college: "",
  university: "",
  start_date: "",
  end_date: "",
  cgpa: "",
  percentage: "",
  marks: "",
  description: "",
});

const emptyExperience = () => ({
  position: "",
  company: "",
  organization: "",
  location: "",
  start_date: "",
  end_date: "",
  duration: "",
  description: "",
  responsibilities: "",
  technologies: [],
});

const emptyProject = () => ({
  name: "",
  role: "",
  description: "",
  details: "",
  start_date: "",
  end_date: "",
  link: "",
  technologies: [],
});

const emptyCertification = () => ({
  name: "",
  issuer: "",
  date: "",
});

/* =========================================================
   NORMALIZE PROFILE
========================================================= */

const normalizeProfile = (source = {}) => {
  const education = safeArray(source.education).map((item) => ({
    ...emptyEducation(),
    ...(item || {}),
    start_date: normalizeDateForInput(item?.start_date),
    end_date: normalizeDateForInput(item?.end_date),
    technologies: normalizeStringArray(item?.technologies),
  }));

  const experience = safeArray(source.work_experience ?? source.experience).map(
    (item) => ({
      ...emptyExperience(),
      ...(item || {}),
      technologies: normalizeStringArray(item?.technologies),
    }),
  );

  const projects = safeArray(source.projects).map((item) => ({
    ...emptyProject(),
    ...(item || {}),
    technologies: normalizeStringArray(item?.technologies ?? item?.skills),
  }));

  const certifications = safeArray(source.certifications).map((item) => ({
    ...emptyCertification(),
    ...(item || {}),
  }));

  return {
    id: source.id ?? null,
    user_id: source.user_id ?? null,
    resume_id: source.resume_id ?? null,

    full_name: safeString(source.full_name, source.name),

    email: safeString(source.email),

    phone: safeString(source.phone, source.phone_number),

    address: safeString(source.address),

    location: safeString(source.location, source.address),

    linkedin_url: safeString(source.linkedin_url, source.linkedin),

    github_url: safeString(source.github_url, source.github),

    portfolio_url: safeString(source.portfolio_url, source.portfolio),

    date_of_birth: normalizeDateForInput(source.date_of_birth),

    gender: safeString(source.gender),

    target_role: safeString(
      source.target_role,
      source.role,
      source.current_role,
    ),

    professional_summary: safeString(
      source.professional_summary,
      source.profile_summary,
      source.summary,
    ),

    // Backend currently returns these exact fields.
    // The additional fallbacks make the page tolerant of older
    // resume-parser/profile responses without losing skills.
    technical_skills: firstNonEmptySkillList(
      source.technical_skills,
      source.technicalSkills,
      source.tech_skills,
      source.techSkills,
      source.technical,
      source.programming_languages,
      source.programmingLanguages,
      source.technologies,
      source.tech_stack,
      source.techStack,
      source.skills?.technical_skills,
      source.skills?.technicalSkills,
      source.skills?.technical,
      source.resume?.technical_skills,
      source.resume?.technicalSkills,
      source.resume?.technical,
      source.resume?.technologies,
    ),

    soft_skills: firstNonEmptySkillList(
      source.soft_skills,
      source.softSkills,
      source.soft,
      source.skills?.soft_skills,
      source.skills?.softSkills,
      source.skills?.soft,
      source.resume?.soft_skills,
      source.resume?.softSkills,
      source.resume?.soft,
    ),

    skills: firstNonEmptySkillList(
      source.skills?.all,
      source.skills?.general,
      source.skills,
    ),

    education,

    work_experience: experience,

    projects,

    certifications,

    internships: safeArray(source.internships),

    languages: normalizeStringArray(source.languages),

    achievements: safeArray(source.achievements),

    publications: safeArray(source.publications),

    interests: normalizeStringArray(source.interests),

    profile_image: safeString(
      source.profile_image,
      source.profile_image_url,
      source.image_url,
      source.avatar_url,
    ),

    // Additional links shown through the Hero "View All" action.
    extra_links: safeArray(source.extra_links ?? source.extraLinks)
      .map((item) => ({
        label: safeString(item?.label, item?.name, item?.title),
        url: safeString(item?.url, item?.link, item?.href),
      }))
      .filter((item) => item.label || item.url),
  };
};

/* =========================================================
   FIELD
========================================================= */

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  textarea = false,
}) {
  return (
    <div className="edit-field">
      <label>{label}</label>

      {textarea ? (
        <textarea
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={5}
        />
      ) : (
        <input
          type={type}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

/* =========================================================
   TAG INPUT
========================================================= */

function TagInput({ items = [], setItems, placeholder }) {
  const [input, setInput] = useState("");

  const addItem = () => {
    const value = input.trim();

    if (!value) return;

    if (!items.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setItems([...items, value]);
    }

    setInput("");
  };

  const removeItem = (index) => {
    setItems(items.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="profile-tag-editor">
      <div className="profile-tag-input">
        <input
          value={input}
          placeholder={placeholder}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addItem();
            }
          }}
        />

        <button type="button" onClick={addItem}>
          <Plus size={16} />
          Add
        </button>
      </div>

      <div className="profile-edit-tags">
        {items.map((item, index) => (
          <span key={`${item}-${index}`} className="profile-edit-tag">
            {displayValue(item)}

            <button type="button" onClick={() => removeItem(index)}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   MODAL
========================================================= */

function EditModal({
  title,
  description,
  children,
  onClose,
  onSave,
  saving,
  saveLabel = "Save Changes",
}) {
  return (
    <div
      className="profile-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="profile-modal">
        <div className="profile-modal-header">
          <div>
            <span>EDIT PROFILE</span>
            <h2>{title}</h2>

            {description && <p>{description}</p>}
          </div>

          <button type="button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="profile-modal-body">{children}</div>

        <div className="profile-modal-footer">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="modal-cancel-button"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="modal-save-button"
          >
            {saving ? (
              <>
                <Loader2 size={17} className="spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={17} />
                {saveLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   SECTION CARD
========================================================= */

function SectionCard({ icon: Icon, title, subtitle, onEdit, children }) {
  return (
    <section className="profile-section-card">
      <div className="section-card-header">
        <div className="section-heading">
          <div className="section-icon">
            <Icon size={19} />
          </div>

          <div>
            <h2>{title}</h2>

            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>

        {onEdit && (
          <button
            type="button"
            className="section-edit-button"
            onClick={onEdit}
          >
            <Edit3 size={15} />
            Edit
          </button>
        )}
      </div>

      <div className="section-card-content">{children}</div>
    </section>
  );
}

/* =========================================================
   DETAIL
========================================================= */

function DetailItem({ label, value }) {
  return (
    <div className="profile-detail-item">
      <span>{label}</span>
      <strong>{displayValue(value) || "Not added"}</strong>
    </div>
  );
}

/* =========================================================
   PROFILE
========================================================= */

function Profile() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [resume, setResume] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [modal, setModal] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [showAllLinks, setShowAllLinks] = useState(false);

  const [profileImage, setProfileImage] = useState("");

  // Editable profile-image state
  const [selectedImageFile, setSelectedImageFile] = useState(null);

  const [imagePreviewUrl, setImagePreviewUrl] = useState("");

  const [imageSaving, setImageSaving] = useState(false);

  const imageInputRef = useRef(null);

  const storedUser = useMemo(() => getStoredUser(), []);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  /* =======================================================
     LOAD PROFILE
  ======================================================= */

  const loadProfile = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const token = getToken();

        if (!token) {
          navigate("/login", {
            replace: true,
          });
          return;
        }

        const response = await fetch(API.profile, {
          method: "GET",
          headers: getAuthHeaders(),
        });

        if (response.status === 401) {
          localStorage.removeItem("access_token");

          navigate("/login", {
            replace: true,
          });

          return;
        }

        if (!response.ok) {
          let message = "";

          try {
            const data = await response.json();

            message =
              displayValue(data?.detail) ||
              displayValue(data?.message) ||
              displayValue(data?.error);
          } catch {
            // Ignore invalid JSON.
          }

          throw new Error(
            message || `Profile request failed (${response.status})`,
          );
        }

        const payload = await response.json();

        const profileData =
          payload?.profile ?? payload?.data ?? payload?.result ?? payload;

        const normalized = normalizeProfile(profileData);

        // If the API only supplies a generic skills list, show it
        // under Technical Skills rather than leaving that section empty.
        if (
          normalized.technical_skills.length === 0 &&
          normalized.skills.length > 0
        ) {
          normalized.technical_skills = [...normalized.skills];
        }

        console.log(
          "Profile API technical_skills:",
          profileData?.technical_skills,
        );
        console.log(
          "Profile normalized technical_skills:",
          normalized.technical_skills,
        );

        setProfile(normalized);

        if (normalized.profile_image) {
          setProfileImage(normalized.profile_image);
        }

        if (payload?.resume) {
          setResume(payload.resume);
        }
      } catch (err) {
        console.error("Profile loading error:", err);

        setError(err?.message || "Unable to load your profile.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [navigate],
  );

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  /* =======================================================
     SAVE PROFILE
  ======================================================= */

  const saveProfile = async (nextProfile) => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        full_name: nextProfile.full_name,

        email: nextProfile.email,

        phone: nextProfile.phone,

        address: nextProfile.address,

        location: nextProfile.location,

        linkedin_url: nextProfile.linkedin_url,

        github_url: nextProfile.github_url,

        portfolio_url: nextProfile.portfolio_url,

        date_of_birth: nextProfile.date_of_birth || null,

        gender: nextProfile.gender,

        target_role: nextProfile.target_role,

        professional_summary: nextProfile.professional_summary,

        technical_skills: normalizeStringArray(nextProfile.technical_skills),

        soft_skills: normalizeStringArray(nextProfile.soft_skills),

        skills: normalizeStringArray(nextProfile.skills),

        education: safeArray(nextProfile.education),

        work_experience: safeArray(nextProfile.work_experience),

        projects: safeArray(nextProfile.projects),

        certifications: safeArray(nextProfile.certifications),

        internships: safeArray(nextProfile.internships),

        languages: normalizeStringArray(nextProfile.languages),

        achievements: safeArray(nextProfile.achievements),

        publications: safeArray(nextProfile.publications),

        interests: normalizeStringArray(nextProfile.interests),

        extra_links: safeArray(nextProfile.extra_links)
          .map((item) => ({
            label: safeString(item?.label),
            url: safeString(item?.url),
          }))
          .filter((item) => item.label && item.url),
      };

      const response = await fetch(API.profile, {
        method: "PATCH",
        headers: getJsonHeaders(),
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        localStorage.removeItem("access_token");

        navigate("/login", {
          replace: true,
        });

        return;
      }

      if (!response.ok) {
        let message = "";

        try {
          const data = await response.json();

          message =
            displayValue(data?.detail) ||
            displayValue(data?.message) ||
            displayValue(data?.error);

          if (Array.isArray(data?.detail)) {
            message = data.detail
              .map((item) => displayValue(item?.msg))
              .filter(Boolean)
              .join(", ");
          }
        } catch {
          // Ignore.
        }

        throw new Error(
          message || `Unable to save profile (${response.status})`,
        );
      }

      const responseData = await response.json();

      const returnedProfile =
        responseData?.profile ??
        responseData?.data ??
        responseData?.result ??
        nextProfile;

      const normalized = normalizeProfile(returnedProfile);

      setProfile(normalized);

      setSuccess("Profile updated successfully.");

      setModal(null);
      setModalData(null);

      setTimeout(() => {
        setSuccess("");
      }, 3500);
    } catch (err) {
      console.error("Profile save error:", err);

      setError(err?.message || "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  };

  /* =======================================================
     PROFILE IMAGE
  ======================================================= */

  const handleProfileImage = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setSuccess("");

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setError("Please select a JPG, PNG or WEBP image.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Profile image must be smaller than 5 MB.");
      event.target.value = "";
      return;
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    const preview = URL.createObjectURL(file);

    // Display the selected image immediately.
    // It is uploaded only after Save Photo is clicked.
    setSelectedImageFile(file);
    setImagePreviewUrl(preview);
  };

  const saveProfileImage = async () => {
    if (!selectedImageFile) {
      setError("Please select an image first.");
      return;
    }

    const token = getToken();

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    setImageSaving(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("file", selectedImageFile);

      const response = await fetch(`${API.profile}/image`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("token");
        localStorage.removeItem("authToken");
        localStorage.removeItem("accessToken");

        navigate("/login", {
          replace: true,
        });

        return;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          displayValue(data?.detail) ||
            displayValue(data?.message) ||
            `Image upload failed (${response.status})`,
        );
      }

      const savedPath =
        data?.profile_image ??
        data?.image_url ??
        data?.url ??
        data?.profile?.profile_image;

      if (!savedPath) {
        throw new Error(
          "Image was uploaded but the server did not return the saved image path.",
        );
      }

      setProfileImage(savedPath);

      setProfile((previous) => ({
        ...(previous || {}),
        profile_image: savedPath,
      }));

      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }

      setImagePreviewUrl("");
      setSelectedImageFile(null);

      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }

      setSuccess("Profile photo saved successfully.");

      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (err) {
      console.error("Profile image upload error:", err);

      setError(err?.message || "Unable to save profile image.");
    } finally {
      setImageSaving(false);
    }
  };

  const cancelProfileImage = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setImagePreviewUrl("");
    setSelectedImageFile(null);
    setError("");

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  /* =======================================================
     HERO EDIT
  ======================================================= */

  const openHeroEdit = () => {
    setModalData({
      full_name: profile.full_name,
      target_role: profile.target_role,
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      linkedin_url: profile.linkedin_url,
      github_url: profile.github_url,
      portfolio_url: profile.portfolio_url,
      extra_links: safeArray(profile.extra_links).map((item) => ({
        label: safeString(item?.label),
        url: safeString(item?.url),
      })),
    });

    setModal("hero");
  };

  const addHeroExtraLink = () => {
    setModalData({
      ...modalData,
      extra_links: [
        ...safeArray(modalData.extra_links),
        { label: "", url: "" },
      ],
    });
  };

  const updateHeroExtraLink = (index, field, value) => {
    const links = safeArray(modalData.extra_links).map((item) => ({
      ...item,
    }));

    links[index] = {
      ...(links[index] || { label: "", url: "" }),
      [field]: value,
    };

    setModalData({
      ...modalData,
      extra_links: links,
    });
  };

  const removeHeroExtraLink = (index) => {
    setModalData({
      ...modalData,
      extra_links: safeArray(modalData.extra_links).filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    });
  };

  /* =======================================================
     PERSONAL EDIT
  ======================================================= */

  const openPersonalEdit = () => {
    setModalData({
      full_name: profile.full_name,

      email: profile.email,

      phone: profile.phone,

      date_of_birth: profile.date_of_birth,

      gender: profile.gender,

      location: profile.location,

      address: profile.address,

      target_role: profile.target_role,

      linkedin_url: profile.linkedin_url,

      github_url: profile.github_url,

      portfolio_url: profile.portfolio_url,
    });

    setModal("personal");
  };

  /* =======================================================
     SUMMARY
  ======================================================= */

  const openSummaryEdit = () => {
    setModalData({
      professional_summary: profile.professional_summary,
    });

    setModal("summary");
  };

  /* =======================================================
     SKILLS
  ======================================================= */

  const openSkillsEdit = () => {
    setModalData({
      technical_skills: [...profile.technical_skills],

      soft_skills: [...profile.soft_skills],
    });

    setModal("skills");
  };

  /* =======================================================
     EDUCATION
  ======================================================= */

  const openEducationEdit = (index = null) => {
    const item =
      index === null
        ? emptyEducation()
        : {
            ...emptyEducation(),
            ...(profile.education[index] || {}),
          };

    setModalData({
      index,
      item,
    });

    setModal("education");
  };

  /* =======================================================
     EXPERIENCE
  ======================================================= */

  const openExperienceEdit = (index = null) => {
    const item =
      index === null
        ? emptyExperience()
        : {
            ...emptyExperience(),
            ...(profile.work_experience[index] || {}),
          };

    setModalData({
      index,
      item,
    });

    setModal("experience");
  };

  /* =======================================================
     PROJECT
  ======================================================= */

  const openProjectEdit = (index = null) => {
    const item =
      index === null
        ? emptyProject()
        : {
            ...emptyProject(),
            ...(profile.projects[index] || {}),
          };

    setModalData({
      index,
      item,
    });

    setModal("project");
  };

  /* =======================================================
     CERTIFICATION
  ======================================================= */

  const openCertificationEdit = (index = null) => {
    const item =
      index === null
        ? emptyCertification()
        : {
            ...emptyCertification(),
            ...(profile.certifications[index] || {}),
          };

    setModalData({
      index,
      item,
    });

    setModal("certification");
  };

  /* =======================================================
     SIMPLE ARRAY EDIT
  ======================================================= */

  const openSimpleEdit = (field, title, placeholder) => {
    setModalData({
      field,
      title,
      placeholder,
      values: normalizeStringArray(profile[field]),
    });

    setModal("simple");
  };

  /* =======================================================
     MODAL SAVE
  ======================================================= */

  const handleModalSave = async () => {
    if (!profile) return;

    const next = {
      ...profile,
    };

    switch (modal) {
      case "hero":
        Object.assign(next, {
          full_name: modalData.full_name,
          target_role: modalData.target_role,
          email: modalData.email,
          phone: modalData.phone,
          location: modalData.location,
          linkedin_url: modalData.linkedin_url,
          github_url: modalData.github_url,
          portfolio_url: modalData.portfolio_url,
          extra_links: safeArray(modalData.extra_links)
            .map((item) => ({
              label: safeString(item?.label),
              url: safeString(item?.url),
            }))
            .filter((item) => item.label && item.url),
        });
        break;

      case "personal":
        Object.assign(next, modalData);
        break;

      case "summary":
        next.professional_summary = modalData.professional_summary;
        break;

      case "skills":
        next.technical_skills = normalizeStringArray(
          modalData.technical_skills,
        );

        next.soft_skills = normalizeStringArray(modalData.soft_skills);

        break;

      case "education": {
        const items = [...profile.education];

        if (modalData.index === null) {
          items.push(modalData.item);
        } else {
          items[modalData.index] = modalData.item;
        }

        next.education = items;
        break;
      }

      case "experience": {
        const items = [...profile.work_experience];

        if (modalData.index === null) {
          items.push(modalData.item);
        } else {
          items[modalData.index] = modalData.item;
        }

        next.work_experience = items;

        break;
      }

      case "project": {
        const items = [...profile.projects];

        if (modalData.index === null) {
          items.push(modalData.item);
        } else {
          items[modalData.index] = modalData.item;
        }

        next.projects = items;

        break;
      }

      case "certification": {
        const items = [...profile.certifications];

        if (modalData.index === null) {
          items.push(modalData.item);
        } else {
          items[modalData.index] = modalData.item;
        }

        next.certifications = items;

        break;
      }

      case "simple":
        next[modalData.field] = normalizeStringArray(modalData.values);
        break;

      default:
        break;
    }

    await saveProfile(next);
  };

  /* =======================================================
     DELETE
  ======================================================= */

  const deleteItem = async (field, index) => {
    const confirmed = window.confirm(
      "Are you sure you want to remove this item?",
    );

    if (!confirmed) return;

    const next = {
      ...profile,
    };

    next[field] = safeArray(profile[field]).filter(
      (_, itemIndex) => itemIndex !== index,
    );

    await saveProfile(next);
  };

  /* =======================================================
     PROFILE COMPLETION
  ======================================================= */

  const profileCompletion = useMemo(() => {
    if (!profile) return 0;

    const sections = [
      Boolean(profile.full_name),
      Boolean(profile.email),
      Boolean(profile.phone),
      Boolean(profile.location),
      Boolean(profile.target_role),
      Boolean(profile.professional_summary),
      profile.technical_skills.length > 0,
      profile.soft_skills.length > 0,
      profile.education.length > 0,
      profile.work_experience.length > 0,
      profile.projects.length > 0,
      profile.certifications.length > 0,
      profile.languages.length > 0,
      profile.achievements.length > 0,
      profile.interests.length > 0,
    ];

    const completed = sections.filter(Boolean).length;

    return Math.round((completed / sections.length) * 100);
  }, [profile]);

  useEffect(() => {
    if (profile) {
      localStorage.setItem(
        "profile_completion_percentage",
        String(profileCompletion),
      );
    }
  }, [profile, profileCompletion]);

  /* =======================================================
     DISPLAY
  ======================================================= */

  const fullName =
    safeString(profile?.full_name, storedUser?.full_name, storedUser?.name) ||
    "Your Name";

  const email =
    safeString(profile?.email, storedUser?.email) || "Not available";

  const phone =
    safeString(profile?.phone, storedUser?.phone) || "Not available";

  const location =
    safeString(profile?.location, profile?.address, storedUser?.location) ||
    "Location not added";

  const role =
    safeString(profile?.target_role, storedUser?.role) ||
    "Internship Candidate";

  const allProfileLinks = [
    profile?.linkedin_url
      ? { label: "LinkedIn", url: profile.linkedin_url, icon: Link2 }
      : null,
    profile?.github_url
      ? { label: "GitHub", url: profile.github_url, icon: Code2 }
      : null,
    profile?.portfolio_url
      ? { label: "Portfolio", url: profile.portfolio_url, icon: Globe }
      : null,
    ...safeArray(profile?.extra_links).map((item) => ({
      label: safeString(item?.label) || "Extra Link",
      url: safeString(item?.url),
      icon: ExternalLink,
    })),
  ].filter((item) => item?.url);

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="profile-loading-screen">
        <div className="profile-loading-orb">
          <Sparkles size={30} />
        </div>

        <h2>Loading your profile</h2>

        <p>Fetching your latest profile information...</p>

        <Loader2 size={22} className="spin" />
      </div>
    );
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="profile-page">
      {/* =================================================
          CONTENT
      ================================================= */}

      <main className="profile-content">
        {/* TITLE */}

        <div className="profile-title-row">
          <div>
            <div className="profile-eyebrow">
              <Sparkles size={14} />
              PERSONAL PROFILE
            </div>

            <h1>My Profile</h1>

            <p>
              Manage your resume-derived profile information and keep it ready
              for better internship matches.
            </p>
          </div>

          <button
            type="button"
            className="profile-refresh-button"
            onClick={() => loadProfile(true)}
            disabled={refreshing}
          >
            <RefreshCw size={17} className={refreshing ? "spin" : ""} />
            Refresh
          </button>
        </div>

        {/* ALERTS */}

        {error && (
          <div className="profile-alert error">
            <X size={18} />

            <span>{error}</span>

            <button type="button" onClick={() => setError("")}>
              <X size={15} />
            </button>
          </div>
        )}

        {success && (
          <div className="profile-alert success">
            <CheckCircle2 size={18} />

            <span>{success}</span>

            <button type="button" onClick={() => setSuccess("")}>
              <X size={15} />
            </button>
          </div>
        )}

        {/* =================================================
            HERO
        ================================================= */}

        <section className="profile-hero">
          <div className="profile-hero-glow" />

          <div className="profile-photo-area">
            <div className="profile-photo">
              {imagePreviewUrl || profileImage ? (
                <img
                  src={imagePreviewUrl || getProfileImageUrl(profileImage)}
                  alt={fullName || "Profile"}
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <UserRound size={52} />
              )}
            </div>

            {/* PROFILE PHOTO EDIT */}
            <button
              type="button"
              className="profile-camera-button"
              onClick={() => imageInputRef.current?.click()}
              title="Edit profile picture"
              aria-label="Edit profile picture"
            >
              <Camera size={16} />
            </button>

            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={handleProfileImage}
            />

            {selectedImageFile && (
              <div className="profile-image-edit-actions">
                <button
                  type="button"
                  className="profile-image-save-button"
                  onClick={saveProfileImage}
                  disabled={imageSaving}
                >
                  {imageSaving ? (
                    <>
                      <Loader2 size={15} className="spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={15} />
                      Save Photo
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="profile-image-cancel-button"
                  onClick={cancelProfileImage}
                  disabled={imageSaving}
                >
                  <X size={15} />
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="profile-hero-details">
            <div className="profile-name-row">
              <div>
                <h2>{fullName}</h2>
                <p className="profile-role">{role}</p>
              </div>

              <span className="verified-badge">
                <CheckCircle2 size={14} />
                Profile
              </span>
            </div>

            <div className="profile-contact-list">
              <span>
                <Mail size={15} />
                {email}
              </span>

              <span>
                <Phone size={15} />
                {phone}
              </span>

              <span>
                <MapPin size={15} />
                {location}
              </span>
            </div>

            {/* HERO LINKS */}
            {allProfileLinks.length > 0 && (
              <div className="profile-hero-links">
                {allProfileLinks.slice(0, 3).map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <a
                      key={`${item.label}-${index}`}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="profile-hero-link"
                    >
                      <Icon size={14} />
                      <span>{item.label}</span>
                      <ExternalLink size={11} />
                    </a>
                  );
                })}

                {allProfileLinks.length > 3 && (
                  <button
                    type="button"
                    className="profile-view-all-links"
                    onClick={() => setShowAllLinks(true)}
                  >
                    View All ({allProfileLinks.length})
                  </button>
                )}

                {allProfileLinks.length <= 3 && (
                  <button
                    type="button"
                    className="profile-view-all-links"
                    onClick={() => setShowAllLinks(true)}
                  >
                    View All
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              className="hero-edit-button"
              onClick={openHeroEdit}
            >
              <Edit3 size={15} />
              Edit Hero
            </button>
          </div>

          <div className="profile-completion">
            <div className="completion-heading">
              <span>Profile Completion</span>
              <strong>{profileCompletion}%</strong>
            </div>

            <div className="completion-track">
              <span style={{ width: `${profileCompletion}%` }} />
            </div>

            <small>
              Add more information to improve your internship matches.
            </small>
          </div>
        </section>

        {/* =================================================
            PERSONAL INFORMATION
        ================================================= */}

        <SectionCard
          icon={UserRound}
          title="Personal Information"
          subtitle="Your basic personal and professional details"
          onEdit={openPersonalEdit}
        >
          <div className="profile-details-grid">
            <DetailItem label="Full Name" value={fullName} />

            <DetailItem label="Email" value={email} />

            <DetailItem label="Phone" value={phone} />

            <DetailItem
              label="Date of Birth"
              value={
                profile.date_of_birth ? formatDate(profile.date_of_birth) : ""
              }
            />

            <DetailItem label="Gender" value={profile.gender} />

            <DetailItem label="Location" value={location} />

            <DetailItem label="Address" value={profile.address} />

            <DetailItem label="Target Role" value={role} />
          </div>

          <div className="profile-social-links">
            {profile.linkedin_url && (
              <a href={profile.linkedin_url} target="_blank" rel="noreferrer">
                <Link2 size={15} />
                LinkedIn
                <ExternalLink size={12} />
              </a>
            )}

            {profile.github_url && (
              <a href={profile.github_url} target="_blank" rel="noreferrer">
                <Code2 size={15} />
                GitHub
                <ExternalLink size={12} />
              </a>
            )}

            {profile.portfolio_url && (
              <a href={profile.portfolio_url} target="_blank" rel="noreferrer">
                <Globe size={15} />
                Portfolio
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        </SectionCard>

        {/* =================================================
            ABOUT
        ================================================= */}

        <SectionCard
          icon={Target}
          title="About Me"
          subtitle="Your professional introduction"
          onEdit={openSummaryEdit}
        >
          <div className="profile-about-text">
            {profile.professional_summary ||
              "No professional summary added yet."}
          </div>
        </SectionCard>

        {/* =================================================
            SKILLS
        ================================================= */}

        <SectionCard
          icon={Code2}
          title="Skills"
          subtitle="Technical expertise and professional strengths"
          onEdit={openSkillsEdit}
        >
          <div className="skills-columns">
            {/* TECHNICAL */}

            <div className="skills-box technical">
              <div className="skills-box-header">
                <div>
                  <Code2 size={18} />
                </div>

                <section>
                  <h3>Technical Skills</h3>

                  <p>Programming, frameworks, databases and tools</p>
                </section>

                <strong>{profile.technical_skills.length}</strong>
              </div>

              <div className="skill-tags">
                {profile.technical_skills.length > 0 ? (
                  profile.technical_skills.map((skill, index) => (
                    <span key={`${skill}-${index}`} className="technical-tag">
                      {displayValue(skill)}
                    </span>
                  ))
                ) : (
                  <span className="empty-text">No technical skills added.</span>
                )}
              </div>
            </div>

            {/* SOFT */}

            <div className="skills-box soft">
              <div className="skills-box-header">
                <div>
                  <Heart size={18} />
                </div>

                <section>
                  <h3>Soft Skills</h3>

                  <p>Communication, teamwork and professional strengths</p>
                </section>

                <strong>{profile.soft_skills.length}</strong>
              </div>

              <div className="skill-tags">
                {profile.soft_skills.length > 0 ? (
                  profile.soft_skills.map((skill, index) => (
                    <span key={`${skill}-${index}`} className="soft-tag">
                      {displayValue(skill)}
                    </span>
                  ))
                ) : (
                  <span className="empty-text">No soft skills added.</span>
                )}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* =================================================
            EDUCATION
        ================================================= */}

        <SectionCard
          icon={GraduationCap}
          title="Education"
          subtitle={`${profile.education.length} education ${
            profile.education.length === 1 ? "entry" : "entries"
          }`}
          onEdit={() => openEducationEdit()}
        >
          {profile.education.length === 0 ? (
            <div className="empty-profile-state">
              <GraduationCap size={24} />

              <p>No education details added.</p>

              <button type="button" onClick={() => openEducationEdit()}>
                <Plus size={15} />
                Add Education
              </button>
            </div>
          ) : (
            <div className="timeline">
              {profile.education.map((education, index) => (
                <div className="timeline-item" key={index}>
                  <div className="timeline-icon">
                    <GraduationCap size={16} />
                  </div>

                  <div className="timeline-content">
                    <div className="timeline-title-row">
                      <div>
                        <h3>
                          {safeString(
                            education.degree,
                            education.course,
                            education.qualification,
                          ) || "Degree"}
                        </h3>

                        <p>
                          {safeString(
                            education.field_of_study,
                            education.field,
                          )}
                        </p>
                      </div>

                      <div className="item-actions">
                        <button
                          type="button"
                          onClick={() => openEducationEdit(index)}
                        >
                          <Edit3 size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteItem("education", index)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <strong className="institution">
                      {safeString(
                        education.institution,
                        education.college,
                        education.university,
                        education.school,
                      ) || "Institution not added"}
                    </strong>

                    <div className="education-meta">
                      {(education.start_date || education.end_date) && (
                        <span>
                          <CalendarDays size={13} />

                          {education.start_date
                            ? formatDate(education.start_date)
                            : ""}

                          {education.end_date &&
                            ` – ${formatDate(education.end_date)}`}
                        </span>
                      )}

                      {education.cgpa && (
                        <span className="score-pill">
                          CGPA {education.cgpa}
                        </span>
                      )}

                      {education.percentage && (
                        <span className="score-pill">
                          {education.percentage}%
                        </span>
                      )}

                      {education.marks && (
                        <span className="score-pill">
                          Marks {education.marks}
                        </span>
                      )}
                    </div>

                    {education.description && (
                      <p className="item-description">
                        {education.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="add-section-button"
            onClick={() => openEducationEdit()}
          >
            <Plus size={15} />
            Add Another Education
          </button>
        </SectionCard>

        {/* =================================================
            EXPERIENCE
        ================================================= */}

        <SectionCard
          icon={BriefcaseBusiness}
          title="Work Experience"
          subtitle={`${profile.work_experience.length} experience ${
            profile.work_experience.length === 1 ? "entry" : "entries"
          }`}
          onEdit={() => openExperienceEdit()}
        >
          {profile.work_experience.length === 0 ? (
            <div className="empty-profile-state">
              <BriefcaseBusiness size={24} />

              <p>No work experience added.</p>

              <button type="button" onClick={() => openExperienceEdit()}>
                <Plus size={15} />
                Add Experience
              </button>
            </div>
          ) : (
            <div className="timeline">
              {profile.work_experience.map((experience, index) => (
                <div className="timeline-item" key={index}>
                  <div className="timeline-icon experience">
                    <BriefcaseBusiness size={16} />
                  </div>

                  <div className="timeline-content">
                    <div className="timeline-title-row">
                      <div>
                        <h3>
                          {safeString(
                            experience.position,
                            experience.role,
                            experience.title,
                            experience.designation,
                          ) || "Experience"}
                        </h3>

                        <p>
                          {safeString(
                            experience.company,
                            experience.organization,
                            experience.employer,
                          )}
                        </p>
                      </div>

                      <div className="item-actions">
                        <button
                          type="button"
                          onClick={() => openExperienceEdit(index)}
                        >
                          <Edit3 size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteItem("work_experience", index)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="education-meta">
                      {experience.location && (
                        <span>
                          <MapPin size={13} />
                          {experience.location}
                        </span>
                      )}

                      {(experience.start_date || experience.end_date) && (
                        <span>
                          <CalendarDays size={13} />

                          {experience.start_date
                            ? formatDate(experience.start_date)
                            : ""}

                          {experience.end_date &&
                            ` – ${formatDate(experience.end_date)}`}
                        </span>
                      )}
                    </div>

                    {experience.description && (
                      <p className="item-description">
                        {experience.description}
                      </p>
                    )}

                    {experience.technologies?.length > 0 && (
                      <div className="project-tags">
                        {experience.technologies.map(
                          (technology, techIndex) => (
                            <span key={techIndex}>
                              {displayValue(technology)}
                            </span>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="add-section-button"
            onClick={() => openExperienceEdit()}
          >
            <Plus size={15} />
            Add Experience
          </button>
        </SectionCard>

        {/* =================================================
            PROJECTS
        ================================================= */}

        <SectionCard
          icon={FolderKanban}
          title="Projects"
          subtitle="Your practical projects and portfolio work"
          onEdit={() => openProjectEdit()}
        >
          {profile.projects.length === 0 ? (
            <div className="empty-profile-state">
              <FolderKanban size={24} />

              <p>No projects added.</p>

              <button type="button" onClick={() => openProjectEdit()}>
                <Plus size={15} />
                Add Project
              </button>
            </div>
          ) : (
            <div className="projects-grid">
              {profile.projects.map((project, index) => (
                <article className="project-card" key={index}>
                  <div className="project-card-header">
                    <div className="project-icon">
                      <FolderKanban size={19} />
                    </div>

                    <div className="item-actions">
                      <button
                        type="button"
                        onClick={() => openProjectEdit(index)}
                      >
                        <Edit3 size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteItem("projects", index)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <h3>
                    {safeString(project.name, project.title) ||
                      "Untitled Project"}
                  </h3>

                  {project.role && (
                    <span className="project-role">{project.role}</span>
                  )}

                  <p>
                    {safeString(project.description, project.details) ||
                      "No project description added."}
                  </p>

                  {project.details &&
                    project.description &&
                    project.details !== project.description && (
                      <div className="project-details">
                        <strong>Project Details</strong>

                        <p>{project.details}</p>
                      </div>
                    )}

                  {project.technologies?.length > 0 && (
                    <div className="project-tags">
                      {project.technologies.map((technology, techIndex) => (
                        <span key={techIndex}>{displayValue(technology)}</span>
                      ))}
                    </div>
                  )}

                  {project.link && (
                    <a
                      href={project.link}
                      target="_blank"
                      rel="noreferrer"
                      className="project-link"
                    >
                      View Project
                      <ExternalLink size={13} />
                    </a>
                  )}
                </article>
              ))}
            </div>
          )}

          <button
            type="button"
            className="add-section-button"
            onClick={() => openProjectEdit()}
          >
            <Plus size={15} />
            Add Another Project
          </button>
        </SectionCard>

        {/* =================================================
            CERTIFICATIONS
        ================================================= */}

        <SectionCard
          icon={Award}
          title="Certifications"
          subtitle={`${profile.certifications.length} certificates`}
          onEdit={() => openCertificationEdit()}
        >
          {profile.certifications.length > 0 ? (
            <div className="compact-list">
              {profile.certifications.map((certification, index) => (
                <div className="compact-item" key={index}>
                  <div className="compact-icon">
                    <Award size={16} />
                  </div>

                  <div>
                    <strong>
                      {safeString(
                        certification.name,
                        certification.title,
                        certification.certification,
                      ) || displayValue(certification)}
                    </strong>

                    <span>
                      {safeString(
                        certification.issuer,
                        certification.organization,
                      )}

                      {certification.date &&
                        ` • ${displayValue(certification.date)}`}
                    </span>
                  </div>

                  <div className="item-actions">
                    <button
                      type="button"
                      onClick={() => openCertificationEdit(index)}
                    >
                      <Edit3 size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteItem("certifications", index)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-profile-state">
              <Award size={24} />

              <p>No certifications added.</p>

              <button type="button" onClick={() => openCertificationEdit()}>
                <Plus size={15} />
                Add Certification
              </button>
            </div>
          )}

          <button
            type="button"
            className="add-section-button"
            onClick={() => openCertificationEdit()}
          >
            <Plus size={15} />
            Add Certification
          </button>
        </SectionCard>

        {/* =================================================
            LANGUAGES / INTERNSHIPS
        ================================================= */}

        <div className="profile-two-column">
          <SectionCard
            icon={Languages}
            title="Languages"
            subtitle={`${profile.languages.length} languages`}
            onEdit={() =>
              openSimpleEdit("languages", "Edit Languages", "Example: English")
            }
          >
            <div className="simple-chip-list">
              {profile.languages.length > 0 ? (
                profile.languages.map((language, index) => (
                  <span key={index}>
                    <Languages size={14} />
                    {displayValue(language)}
                  </span>
                ))
              ) : (
                <span className="empty-text">No languages added.</span>
              )}
            </div>
          </SectionCard>

          <SectionCard
            icon={BriefcaseBusiness}
            title="Internships"
            subtitle={`${profile.internships.length} internship entries`}
            onEdit={() =>
              openSimpleEdit(
                "internships",
                "Edit Internships",
                "Internship name",
              )
            }
          >
            <div className="simple-chip-list">
              {profile.internships.length > 0 ? (
                profile.internships.map((internship, index) => (
                  <span key={index}>
                    <BriefcaseBusiness size={14} />
                    {displayValue(internship)}
                  </span>
                ))
              ) : (
                <span className="empty-text">No internships added.</span>
              )}
            </div>
          </SectionCard>
        </div>

        {/* =================================================
            ACHIEVEMENTS / PUBLICATIONS
        ================================================= */}

        <div className="profile-two-column">
          <SectionCard
            icon={Trophy}
            title="Achievements"
            subtitle="Awards and accomplishments"
            onEdit={() =>
              openSimpleEdit(
                "achievements",
                "Edit Achievements",
                "Add achievement",
              )
            }
          >
            <div className="simple-list">
              {profile.achievements.length > 0 ? (
                profile.achievements.map((achievement, index) => (
                  <div key={index}>
                    <Trophy size={16} />
                    {displayValue(achievement)}
                  </div>
                ))
              ) : (
                <span className="empty-text">No achievements added.</span>
              )}
            </div>
          </SectionCard>

          <SectionCard
            icon={FileText}
            title="Publications"
            subtitle="Research papers and articles"
            onEdit={() =>
              openSimpleEdit(
                "publications",
                "Edit Publications",
                "Publication name",
              )
            }
          >
            <div className="simple-list">
              {profile.publications.length > 0 ? (
                profile.publications.map((publication, index) => (
                  <div key={index}>
                    <FileText size={16} />
                    {displayValue(publication)}
                  </div>
                ))
              ) : (
                <span className="empty-text">No publications added.</span>
              )}
            </div>
          </SectionCard>
        </div>

        {/* =================================================
            INTERESTS
        ================================================= */}

        <SectionCard
          icon={Heart}
          title="Interests"
          subtitle="Topics and activities you're interested in"
          onEdit={() =>
            openSimpleEdit("interests", "Edit Interests", "Example: AI")
          }
        >
          <div className="interest-tags">
            {profile.interests.length > 0 ? (
              profile.interests.map((interest, index) => (
                <span key={index}>
                  <Heart size={13} />
                  {displayValue(interest)}
                </span>
              ))
            ) : (
              <span className="empty-text">No interests added.</span>
            )}
          </div>
        </SectionCard>

        {/* =================================================
            RESUME
        ================================================= */}

        <section className="resume-source-card">
          <div className="resume-source-info">
            <div className="resume-icon">
              <FileText size={25} />
            </div>

            <div>
              <span>SOURCE RESUME</span>

              <h3>{resume?.file_name || resume?.filename || "Resume"}</h3>

              <p>Resume used to generate your profile data.</p>
            </div>
          </div>

          <div className="resume-actions">
            <span>
              <CheckCircle2 size={15} />
              Profile Ready
            </span>

            <button type="button" onClick={() => navigate("/resume")}>
              <Upload size={15} />
              Manage Resume
            </button>
          </div>
        </section>
      </main>

      {/* =====================================================
          HERO EDIT MODAL
      ===================================================== */}

      {modal === "hero" && (
        <EditModal
          title="Edit Hero Section"
          description="Update the information displayed at the top of your profile and manage your public links."
          onClose={() => {
            setModal(null);
            setModalData(null);
          }}
          onSave={handleModalSave}
          saving={saving}
        >
          <div className="edit-form-grid">
            <Field
              label="Full Name"
              value={modalData.full_name}
              onChange={(value) =>
                setModalData({ ...modalData, full_name: value })
              }
            />

            <Field
              label="Professional Role"
              value={modalData.target_role}
              placeholder="Example: Full Stack Developer"
              onChange={(value) =>
                setModalData({ ...modalData, target_role: value })
              }
            />

            <Field
              label="Email"
              type="email"
              value={modalData.email}
              onChange={(value) => setModalData({ ...modalData, email: value })}
            />

            <Field
              label="Phone"
              value={modalData.phone}
              onChange={(value) => setModalData({ ...modalData, phone: value })}
            />

            <Field
              label="Location"
              value={modalData.location}
              onChange={(value) =>
                setModalData({ ...modalData, location: value })
              }
            />

            <Field
              label="LinkedIn URL"
              value={modalData.linkedin_url}
              placeholder="https://linkedin.com/in/your-name"
              onChange={(value) =>
                setModalData({ ...modalData, linkedin_url: value })
              }
            />

            <Field
              label="GitHub URL"
              value={modalData.github_url}
              placeholder="https://github.com/your-name"
              onChange={(value) =>
                setModalData({ ...modalData, github_url: value })
              }
            />

            <Field
              label="Portfolio URL"
              value={modalData.portfolio_url}
              placeholder="https://yourportfolio.com"
              onChange={(value) =>
                setModalData({ ...modalData, portfolio_url: value })
              }
            />
          </div>

          <div className="hero-extra-links-editor">
            <div className="hero-extra-links-heading">
              <div>
                <h3>Extra Links</h3>
                <p>
                  Add certificates, projects, blogs, demos or any other public
                  link.
                </p>
              </div>

              <button
                type="button"
                className="section-edit-button"
                onClick={addHeroExtraLink}
              >
                <Plus size={15} />
                Add Link
              </button>
            </div>

            {safeArray(modalData.extra_links).length === 0 ? (
              <div className="empty-profile-state">
                <Link2 size={22} />
                <p>No extra links added.</p>
              </div>
            ) : (
              <div className="hero-extra-links-list">
                {safeArray(modalData.extra_links).map((link, index) => (
                  <div className="hero-extra-link-row" key={index}>
                    <Field
                      label="Link Name"
                      value={link.label}
                      placeholder="Example: Live Project"
                      onChange={(value) =>
                        updateHeroExtraLink(index, "label", value)
                      }
                    />

                    <Field
                      label="URL"
                      value={link.url}
                      placeholder="https://example.com"
                      onChange={(value) =>
                        updateHeroExtraLink(index, "url", value)
                      }
                    />

                    <button
                      type="button"
                      className="item-delete-button"
                      onClick={() => removeHeroExtraLink(index)}
                      title="Remove link"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </EditModal>
      )}

      {/* =====================================================
          PERSONAL MODAL
      ===================================================== */}

      {modal === "personal" && (
        <EditModal
          title="Personal Information"
          description="Edit each personal field separately."
          onClose={() => {
            setModal(null);
            setModalData(null);
          }}
          onSave={handleModalSave}
          saving={saving}
        >
          <div className="edit-form-grid">
            <Field
              label="Full Name"
              value={modalData.full_name}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  full_name: value,
                })
              }
            />

            <Field
              label="Email"
              type="email"
              value={modalData.email}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  email: value,
                })
              }
            />

            <Field
              label="Phone"
              value={modalData.phone}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  phone: value,
                })
              }
            />

            <Field
              label="Date of Birth"
              type="date"
              value={modalData.date_of_birth}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  date_of_birth: value,
                })
              }
            />

            <div className="edit-field">
              <label>Gender</label>

              <select
                value={modalData.gender || ""}
                onChange={(event) =>
                  setModalData({
                    ...modalData,
                    gender: event.target.value,
                  })
                }
              >
                <option value="">Select Gender</option>

                <option value="Male">Male</option>

                <option value="Female">Female</option>

                <option value="Other">Other</option>

                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>

            <Field
              label="Target Role"
              value={modalData.target_role}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  target_role: value,
                })
              }
            />

            <Field
              label="Location"
              value={modalData.location}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  location: value,
                })
              }
            />

            <Field
              label="Address"
              value={modalData.address}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  address: value,
                })
              }
            />

            <Field
              label="LinkedIn URL"
              value={modalData.linkedin_url}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  linkedin_url: value,
                })
              }
            />

            <Field
              label="GitHub URL"
              value={modalData.github_url}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  github_url: value,
                })
              }
            />

            <Field
              label="Portfolio URL"
              value={modalData.portfolio_url}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  portfolio_url: value,
                })
              }
            />
          </div>
        </EditModal>
      )}

      {/* =====================================================
          SUMMARY MODAL
      ===================================================== */}

      {modal === "summary" && (
        <EditModal
          title="About Me"
          description="Edit your professional summary."
          onClose={() => {
            setModal(null);
            setModalData(null);
          }}
          onSave={handleModalSave}
          saving={saving}
        >
          <Field
            label="Professional Summary"
            textarea
            value={modalData.professional_summary}
            onChange={(value) =>
              setModalData({
                ...modalData,
                professional_summary: value,
              })
            }
            placeholder="Write your professional summary..."
          />
        </EditModal>
      )}

      {/* =====================================================
          SKILLS MODAL
      ===================================================== */}

      {modal === "skills" && (
        <EditModal
          title="Skills"
          description="Maintain technical and soft skills separately."
          onClose={() => {
            setModal(null);
            setModalData(null);
          }}
          onSave={handleModalSave}
          saving={saving}
        >
          <div className="skills-edit-block">
            <div className="skills-edit-heading">
              <Code2 size={18} />

              <div>
                <strong>Technical Skills</strong>

                <span>Programming, frameworks, databases and tools</span>
              </div>
            </div>

            <TagInput
              items={modalData.technical_skills}
              setItems={(items) =>
                setModalData({
                  ...modalData,
                  technical_skills: items,
                })
              }
              placeholder="Example: React"
            />
          </div>

          <div className="skills-edit-block">
            <div className="skills-edit-heading">
              <Heart size={18} />

              <div>
                <strong>Soft Skills</strong>

                <span>Communication, teamwork and leadership</span>
              </div>
            </div>

            <TagInput
              items={modalData.soft_skills}
              setItems={(items) =>
                setModalData({
                  ...modalData,
                  soft_skills: items,
                })
              }
              placeholder="Example: Communication"
            />
          </div>
        </EditModal>
      )}

      {/* =====================================================
          EDUCATION MODAL
      ===================================================== */}

      {modal === "education" && (
        <EditModal
          title={modalData.index === null ? "Add Education" : "Edit Education"}
          description="Edit every education detail including degree, college, university, dates and scores."
          onClose={() => {
            setModal(null);
            setModalData(null);
          }}
          onSave={handleModalSave}
          saving={saving}
        >
          <div className="edit-form-grid">
            <Field
              label="Degree"
              value={modalData.item.degree}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    degree: value,
                  },
                })
              }
            />

            <Field
              label="Field of Study"
              value={modalData.item.field_of_study}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    field_of_study: value,
                  },
                })
              }
            />

            <Field
              label="College / Institution"
              value={modalData.item.institution}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    institution: value,
                  },
                })
              }
            />

            <Field
              label="College Name"
              value={modalData.item.college}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    college: value,
                  },
                })
              }
            />

            <Field
              label="University"
              value={modalData.item.university}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    university: value,
                  },
                })
              }
            />

            <Field
              label="Start Date"
              type="date"
              value={modalData.item.start_date}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    start_date: value,
                  },
                })
              }
            />

            <Field
              label="End Date"
              type="date"
              value={modalData.item.end_date}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    end_date: value,
                  },
                })
              }
            />

            <Field
              label="CGPA"
              value={modalData.item.cgpa}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    cgpa: value,
                  },
                })
              }
            />

            <Field
              label="Percentage"
              value={modalData.item.percentage}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    percentage: value,
                  },
                })
              }
            />

            <Field
              label="Marks"
              value={modalData.item.marks}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    marks: value,
                  },
                })
              }
            />
          </div>

          <Field
            label="Education Description"
            textarea
            value={modalData.item.description}
            onChange={(value) =>
              setModalData({
                ...modalData,
                item: {
                  ...modalData.item,
                  description: value,
                },
              })
            }
          />
        </EditModal>
      )}

      {/* =====================================================
          EXPERIENCE MODAL
      ===================================================== */}

      {modal === "experience" && (
        <EditModal
          title={
            modalData.index === null ? "Add Experience" : "Edit Experience"
          }
          description="Edit position, company, duration, responsibilities and technologies."
          onClose={() => {
            setModal(null);
            setModalData(null);
          }}
          onSave={handleModalSave}
          saving={saving}
        >
          <div className="edit-form-grid">
            <Field
              label="Position"
              value={modalData.item.position}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    position: value,
                  },
                })
              }
            />

            <Field
              label="Company"
              value={modalData.item.company}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    company: value,
                  },
                })
              }
            />

            <Field
              label="Location"
              value={modalData.item.location}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    location: value,
                  },
                })
              }
            />

            <Field
              label="Duration"
              value={modalData.item.duration}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    duration: value,
                  },
                })
              }
            />

            <Field
              label="Start Date"
              type="date"
              value={modalData.item.start_date}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    start_date: value,
                  },
                })
              }
            />

            <Field
              label="End Date"
              type="date"
              value={modalData.item.end_date}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    end_date: value,
                  },
                })
              }
            />
          </div>

          <Field
            label="Description"
            textarea
            value={modalData.item.description}
            onChange={(value) =>
              setModalData({
                ...modalData,
                item: {
                  ...modalData.item,
                  description: value,
                },
              })
            }
          />

          <Field
            label="Responsibilities"
            textarea
            value={modalData.item.responsibilities}
            onChange={(value) =>
              setModalData({
                ...modalData,
                item: {
                  ...modalData.item,
                  responsibilities: value,
                },
              })
            }
          />

          <div className="edit-field">
            <label>Technologies</label>

            <TagInput
              items={modalData.item.technologies}
              setItems={(items) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    technologies: items,
                  },
                })
              }
              placeholder="Example: React"
            />
          </div>
        </EditModal>
      )}

      {/* =====================================================
          PROJECT MODAL
      ===================================================== */}

      {modal === "project" && (
        <EditModal
          title={modalData.index === null ? "Add Project" : "Edit Project"}
          description="Edit project name, role, dates, details and technologies."
          onClose={() => {
            setModal(null);
            setModalData(null);
          }}
          onSave={handleModalSave}
          saving={saving}
        >
          <div className="edit-form-grid">
            <Field
              label="Project Name"
              value={modalData.item.name}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    name: value,
                  },
                })
              }
            />

            <Field
              label="Your Role"
              value={modalData.item.role}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    role: value,
                  },
                })
              }
            />

            <Field
              label="Start Date"
              type="date"
              value={modalData.item.start_date}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    start_date: value,
                  },
                })
              }
            />

            <Field
              label="End Date"
              type="date"
              value={modalData.item.end_date}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    end_date: value,
                  },
                })
              }
            />

            <Field
              label="Project URL"
              value={modalData.item.link}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    link: value,
                  },
                })
              }
            />
          </div>

          <Field
            label="Short Description"
            textarea
            value={modalData.item.description}
            onChange={(value) =>
              setModalData({
                ...modalData,
                item: {
                  ...modalData.item,
                  description: value,
                },
              })
            }
          />

          <Field
            label="Detailed Project Information"
            textarea
            value={modalData.item.details}
            onChange={(value) =>
              setModalData({
                ...modalData,
                item: {
                  ...modalData.item,
                  details: value,
                },
              })
            }
          />

          <div className="edit-field">
            <label>Technologies</label>

            <TagInput
              items={modalData.item.technologies}
              setItems={(items) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    technologies: items,
                  },
                })
              }
              placeholder="Example: JavaScript"
            />
          </div>
        </EditModal>
      )}

      {/* =====================================================
          CERTIFICATION MODAL
      ===================================================== */}

      {modal === "certification" && (
        <EditModal
          title={
            modalData.index === null
              ? "Add Certification"
              : "Edit Certification"
          }
          description="Edit certification details."
          onClose={() => {
            setModal(null);
            setModalData(null);
          }}
          onSave={handleModalSave}
          saving={saving}
        >
          <div className="edit-form-grid">
            <Field
              label="Certification Name"
              value={modalData.item.name}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    name: value,
                  },
                })
              }
            />

            <Field
              label="Issuer"
              value={modalData.item.issuer}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    issuer: value,
                  },
                })
              }
            />

            <Field
              label="Date / Year"
              value={modalData.item.date}
              onChange={(value) =>
                setModalData({
                  ...modalData,
                  item: {
                    ...modalData.item,
                    date: value,
                  },
                })
              }
            />
          </div>
        </EditModal>
      )}

      {/* =====================================================
          VIEW ALL LINKS MODAL
      ===================================================== */}

      {showAllLinks && (
        <EditModal
          title="All Profile Links"
          description="Open your GitHub, portfolio, LinkedIn and other public links."
          onClose={() => setShowAllLinks(false)}
          onSave={() => setShowAllLinks(false)}
          saving={false}
          saveLabel="Close"
        >
          <div className="profile-all-links-list">
            {allProfileLinks.length > 0 ? (
              allProfileLinks.map((item, index) => {
                const Icon = item.icon;
                return (
                  <a
                    key={`${item.label}-${index}`}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="profile-all-link-item"
                  >
                    <span className="profile-all-link-icon">
                      <Icon size={18} />
                    </span>

                    <span className="profile-all-link-content">
                      <strong>{item.label}</strong>
                      <small>{item.url}</small>
                    </span>

                    <ExternalLink size={16} />
                  </a>
                );
              })
            ) : (
              <div className="empty-profile-state">
                <Link2 size={24} />
                <p>No public links have been added yet.</p>
              </div>
            )}
          </div>
        </EditModal>
      )}

      {/* =====================================================
          SIMPLE ARRAY MODAL
      ===================================================== */}

      {modal === "simple" && (
        <EditModal
          title={modalData.title}
          description="Add, remove or update individual items."
          onClose={() => {
            setModal(null);
            setModalData(null);
          }}
          onSave={handleModalSave}
          saving={saving}
        >
          <TagInput
            items={modalData.values}
            setItems={(items) =>
              setModalData({
                ...modalData,
                values: items,
              })
            }
            placeholder={modalData.placeholder}
          />
        </EditModal>
      )}
    </div>
  );
}

export default Profile;

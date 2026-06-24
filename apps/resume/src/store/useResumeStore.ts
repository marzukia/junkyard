import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ExperienceEntry {
  id: string;
  company: string;
  title: string;
  startDate: string;
  endDate: string; // empty = "Present"
  bullets: string[]; // one per line
}

export interface EducationEntry {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
}

export interface ProjectEntry {
  id: string;
  name: string;
  url: string;
  description: string;
}

export interface CertificationEntry {
  id: string;
  name: string;
  issuer: string;
  date: string;
}

// Template controls what the preview/PDF layout looks like
export type TemplateId = "clean" | "compact" | "bold";

export interface ResumeState {
  // Contact
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  website: string;

  // Summary
  summary: string;

  // Experience
  experience: ExperienceEntry[];

  // Education
  education: EducationEntry[];

  // Skills (comma-separated groups)
  skills: string;

  // Projects
  projects: ProjectEntry[];

  // Certifications
  certifications: CertificationEntry[];

  // Languages (comma or newline separated)
  languages: string;

  // Template
  template: TemplateId;

  // Actions
  setFullName: (v: string) => void;
  setEmail: (v: string) => void;
  setPhone: (v: string) => void;
  setLocation: (v: string) => void;
  setLinkedin: (v: string) => void;
  setWebsite: (v: string) => void;
  setSummary: (v: string) => void;
  setSkills: (v: string) => void;
  setLanguages: (v: string) => void;
  setTemplate: (v: TemplateId) => void;

  addExperience: () => void;
  updateExperience: (id: string, patch: Partial<Omit<ExperienceEntry, "id">>) => void;
  removeExperience: (id: string) => void;
  moveExperience: (id: string, dir: "up" | "down") => void;

  addEducation: () => void;
  updateEducation: (id: string, patch: Partial<Omit<EducationEntry, "id">>) => void;
  removeEducation: (id: string) => void;
  moveEducation: (id: string, dir: "up" | "down") => void;

  addProject: () => void;
  updateProject: (id: string, patch: Partial<Omit<ProjectEntry, "id">>) => void;
  removeProject: (id: string) => void;
  moveProject: (id: string, dir: "up" | "down") => void;

  addCertification: () => void;
  updateCertification: (id: string, patch: Partial<Omit<CertificationEntry, "id">>) => void;
  removeCertification: (id: string) => void;
  moveCertification: (id: string, dir: "up" | "down") => void;

  /** Wipe persisted data and reset to defaults. */
  resetAll: () => void;

  /** Load a sample resume so new users can see the output format immediately. */
  loadSample: () => void;

  /** Load resume data from a JSON object (JSON Resume or internal format). */
  loadFromJson: (data: unknown) => { ok: boolean; error?: string };
}

function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

function moveItem<T extends { id: string }>(arr: T[], id: string, dir: "up" | "down"): T[] {
  const idx = arr.findIndex((x) => x.id === id);
  if (idx < 0) return arr;
  const next = dir === "up" ? idx - 1 : idx + 1;
  if (next < 0 || next >= arr.length) return arr;
  const copy = [...arr];
  [copy[idx], copy[next]] = [copy[next], copy[idx]];
  return copy;
}

// Exported type for the plain data shape (no actions)
export type ResumeData = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  website: string;
  summary: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  skills: string;
  projects: ProjectEntry[];
  certifications: CertificationEntry[];
  languages: string;
  template: TemplateId;
};

const DEFAULT_DATA: ResumeData = {
  fullName: "",
  email: "",
  phone: "",
  location: "",
  linkedin: "",
  website: "",
  summary: "",
  experience: [],
  education: [],
  skills: "",
  projects: [],
  certifications: [],
  languages: "",
  template: "clean",
};

export const PERSIST_KEY = "mrzk-resume-v1";

export const SAMPLE_DATA: ResumeData = {
  fullName: "Alex Tane",
  email: "alex.tane@example.com",
  phone: "+64 21 555 0123",
  location: "Wellington, NZ",
  linkedin: "linkedin.com/in/alextane",
  website: "alextane.dev",
  summary:
    "Full-stack engineer with 7 years building customer-facing products at scale. Strong background in distributed systems, developer tooling, and cross-functional delivery.",
  experience: [
    {
      id: uid(),
      company: "Koru Technologies",
      title: "Senior Software Engineer",
      startDate: "Mar 2021",
      endDate: "",
      bullets: [
        "Led re-architecture of the payments pipeline, cutting p99 latency from 820 ms to 190 ms",
        "Mentored 3 junior engineers; introduced structured code review practices adopted team-wide",
        "Shipped self-serve onboarding flow that reduced support tickets by 35%",
      ],
    },
    {
      id: uid(),
      company: "Tiaki Systems",
      title: "Software Engineer",
      startDate: "Jan 2018",
      endDate: "Feb 2021",
      bullets: [
        "Built real-time telemetry dashboard handling 50k events/min using Go and ClickHouse",
        "Drove migration from monolith to event-driven services with zero downtime",
      ],
    },
  ],
  education: [
    {
      id: uid(),
      institution: "Victoria University of Wellington",
      degree: "Bachelor of Science",
      field: "Computer Science",
      startDate: "2014",
      endDate: "2017",
    },
  ],
  skills: "TypeScript, React, Go, PostgreSQL, Redis, Kubernetes, Terraform, CI/CD",
  projects: [
    {
      id: uid(),
      name: "Harakeke CLI",
      url: "https://github.com/alextane/harakeke",
      description:
        "Open-source Go CLI tool for generating structured project scaffolds. 1.2k GitHub stars.",
    },
  ],
  certifications: [
    {
      id: uid(),
      name: "AWS Solutions Architect",
      issuer: "Amazon Web Services",
      date: "2022",
    },
  ],
  languages: "English (native), Te Reo Maori (conversational)",
  template: "clean",
};

/**
 * Parse an unknown JSON blob into ResumeData, accepting both our internal
 * format and the JSON Resume standard (https://jsonresume.org/schema/).
 */
export function parseJsonResume(
  raw: unknown
): { ok: true; data: Partial<ResumeData> } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "File must contain a JSON object." };
  }
  const obj = raw as Record<string, unknown>;

  // Check if it looks like JSON Resume schema (has "basics" key)
  const isJsonResumeSchema = typeof obj.basics === "object" && obj.basics !== null;

  if (isJsonResumeSchema) {
    return parseJsonResumeStandard(obj);
  }

  return parseInternalFormat(obj);
}

function parseJsonResumeStandard(
  obj: Record<string, unknown>
): { ok: true; data: Partial<ResumeData> } | { ok: false; error: string } {
  const basics = obj.basics as Record<string, unknown>;
  const data: Partial<ResumeData> = {};

  if (typeof basics.name === "string") data.fullName = basics.name;
  if (typeof basics.email === "string") data.email = basics.email;
  if (typeof basics.phone === "string") data.phone = basics.phone;
  if (typeof basics.summary === "string") data.summary = basics.summary;

  const loc = basics.location;
  if (typeof loc === "object" && loc !== null) {
    const l = loc as Record<string, unknown>;
    const parts = [l.city, l.region, l.countryCode].filter(
      (x): x is string => typeof x === "string" && x.length > 0
    );
    if (parts.length > 0) data.location = parts.join(", ");
  }

  const profiles = basics.profiles;
  if (Array.isArray(profiles)) {
    for (const p of profiles) {
      if (typeof p !== "object" || p === null) continue;
      const prof = p as Record<string, unknown>;
      const network = typeof prof.network === "string" ? prof.network.toLowerCase() : "";
      if (network === "linkedin" && typeof prof.url === "string") {
        data.linkedin = prof.url.replace(/^https?:\/\/(www\.)?linkedin\.com\//, "linkedin.com/");
      } else if (typeof prof.url === "string" && !data.website) {
        data.website = prof.url;
      }
    }
  }
  if (typeof basics.url === "string") data.website = data.website || basics.url;

  // Work experience
  if (Array.isArray(obj.work)) {
    data.experience = obj.work.map((w: unknown) => {
      const e = (typeof w === "object" && w !== null ? w : {}) as Record<string, unknown>;
      return {
        id: uid(),
        company: typeof e.name === "string" ? e.name : "",
        title: typeof e.position === "string" ? e.position : "",
        startDate: formatJsonResumeDate(e.startDate),
        endDate: formatJsonResumeDate(e.endDate),
        bullets: Array.isArray(e.highlights)
          ? (e.highlights as unknown[]).filter((h): h is string => typeof h === "string")
          : typeof e.summary === "string" && e.summary.trim()
            ? [e.summary.trim()]
            : [],
      };
    });
  }

  // Education
  if (Array.isArray(obj.education)) {
    data.education = obj.education.map((e: unknown) => {
      const ed = (typeof e === "object" && e !== null ? e : {}) as Record<string, unknown>;
      return {
        id: uid(),
        institution: typeof ed.institution === "string" ? ed.institution : "",
        degree: typeof ed.studyType === "string" ? ed.studyType : "",
        field: typeof ed.area === "string" ? ed.area : "",
        startDate: formatJsonResumeDate(ed.startDate),
        endDate: formatJsonResumeDate(ed.endDate),
      };
    });
  }

  // Skills
  if (Array.isArray(obj.skills)) {
    const skillNames = (obj.skills as unknown[]).flatMap((s) => {
      if (typeof s !== "object" || s === null) return [];
      const sk = s as Record<string, unknown>;
      // keywords within a skill group
      if (Array.isArray(sk.keywords)) {
        return (sk.keywords as unknown[]).filter((k): k is string => typeof k === "string");
      }
      return typeof sk.name === "string" ? [sk.name] : [];
    });
    if (skillNames.length > 0) data.skills = skillNames.join(", ");
  }

  // Projects
  if (Array.isArray(obj.projects)) {
    data.projects = (obj.projects as unknown[]).map((p) => {
      const pr = (typeof p === "object" && p !== null ? p : {}) as Record<string, unknown>;
      return {
        id: uid(),
        name: typeof pr.name === "string" ? pr.name : "",
        url: typeof pr.url === "string" ? pr.url : "",
        description: typeof pr.description === "string" ? pr.description : "",
      };
    });
  }

  // Certificates
  if (Array.isArray(obj.certificates)) {
    data.certifications = (obj.certificates as unknown[]).map((c) => {
      const ce = (typeof c === "object" && c !== null ? c : {}) as Record<string, unknown>;
      return {
        id: uid(),
        name: typeof ce.name === "string" ? ce.name : "",
        issuer: typeof ce.issuer === "string" ? ce.issuer : "",
        date: formatJsonResumeDate(ce.date),
      };
    });
  }

  // Languages
  if (Array.isArray(obj.languages)) {
    const langs = (obj.languages as unknown[])
      .map((l) => {
        if (typeof l !== "object" || l === null) return "";
        const lang = l as Record<string, unknown>;
        const name = typeof lang.language === "string" ? lang.language : "";
        const fluency = typeof lang.fluency === "string" ? lang.fluency : "";
        return fluency ? `${name} (${fluency})` : name;
      })
      .filter(Boolean);
    if (langs.length > 0) data.languages = langs.join(", ");
  }

  return { ok: true, data };
}

function parseInternalFormat(
  obj: Record<string, unknown>
): { ok: true; data: Partial<ResumeData> } | { ok: false; error: string } {
  const data: Partial<ResumeData> = {};

  const strFields: (keyof ResumeData)[] = [
    "fullName",
    "email",
    "phone",
    "location",
    "linkedin",
    "website",
    "summary",
    "skills",
    "languages",
  ];
  for (const f of strFields) {
    if (typeof obj[f] === "string") (data as Record<string, unknown>)[f] = obj[f];
  }

  if (Array.isArray(obj.experience)) {
    data.experience = (obj.experience as unknown[]).map((e) => {
      const entry = (typeof e === "object" && e !== null ? e : {}) as Record<string, unknown>;
      return {
        id: uid(),
        company: typeof entry.company === "string" ? entry.company : "",
        title: typeof entry.title === "string" ? entry.title : "",
        startDate: typeof entry.startDate === "string" ? entry.startDate : "",
        endDate: typeof entry.endDate === "string" ? entry.endDate : "",
        bullets: Array.isArray(entry.bullets)
          ? (entry.bullets as unknown[]).filter((b): b is string => typeof b === "string")
          : [],
      };
    });
  }

  if (Array.isArray(obj.education)) {
    data.education = (obj.education as unknown[]).map((e) => {
      const entry = (typeof e === "object" && e !== null ? e : {}) as Record<string, unknown>;
      return {
        id: uid(),
        institution: typeof entry.institution === "string" ? entry.institution : "",
        degree: typeof entry.degree === "string" ? entry.degree : "",
        field: typeof entry.field === "string" ? entry.field : "",
        startDate: typeof entry.startDate === "string" ? entry.startDate : "",
        endDate: typeof entry.endDate === "string" ? entry.endDate : "",
      };
    });
  }

  if (Array.isArray(obj.projects)) {
    data.projects = (obj.projects as unknown[]).map((p) => {
      const pr = (typeof p === "object" && p !== null ? p : {}) as Record<string, unknown>;
      return {
        id: uid(),
        name: typeof pr.name === "string" ? pr.name : "",
        url: typeof pr.url === "string" ? pr.url : "",
        description: typeof pr.description === "string" ? pr.description : "",
      };
    });
  }

  if (Array.isArray(obj.certifications)) {
    data.certifications = (obj.certifications as unknown[]).map((c) => {
      const ce = (typeof c === "object" && c !== null ? c : {}) as Record<string, unknown>;
      return {
        id: uid(),
        name: typeof ce.name === "string" ? ce.name : "",
        issuer: typeof ce.issuer === "string" ? ce.issuer : "",
        date: typeof ce.date === "string" ? ce.date : "",
      };
    });
  }

  if (typeof obj.template === "string" && ["clean", "compact", "bold"].includes(obj.template)) {
    data.template = obj.template as TemplateId;
  }

  return { ok: true, data };
}

function formatJsonResumeDate(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "";
  // ISO date YYYY-MM-DD or YYYY-MM -> format as "Mon YYYY"
  const m = raw.match(/^(\d{4})-(\d{2})/);
  if (m) {
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = monthNames[Number.parseInt(m[2], 10) - 1];
    return month ? `${month} ${m[1]}` : m[1];
  }
  // Already just a year
  return raw;
}

export const useResumeStore = create<ResumeState>()(
  persist(
    (set) => ({
      ...DEFAULT_DATA,
      // Spread creates fresh mutable objects on first load
      experience: [
        { id: uid(), company: "", title: "", startDate: "", endDate: "", bullets: [""] },
      ],
      education: [
        { id: uid(), institution: "", degree: "", field: "", startDate: "", endDate: "" },
      ],
      projects: [],
      certifications: [],
      languages: "",
      template: "clean" as TemplateId,

      setFullName: (v) => set({ fullName: v }),
      setEmail: (v) => set({ email: v }),
      setPhone: (v) => set({ phone: v }),
      setLocation: (v) => set({ location: v }),
      setLinkedin: (v) => set({ linkedin: v }),
      setWebsite: (v) => set({ website: v }),
      setSummary: (v) => set({ summary: v }),
      setSkills: (v) => set({ skills: v }),
      setLanguages: (v) => set({ languages: v }),
      setTemplate: (v) => set({ template: v }),

      addExperience: () =>
        set((s) => ({
          experience: [
            ...s.experience,
            { id: uid(), company: "", title: "", startDate: "", endDate: "", bullets: [""] },
          ],
        })),

      updateExperience: (id, patch) =>
        set((s) => ({
          experience: s.experience.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),

      removeExperience: (id) =>
        set((s) => ({ experience: s.experience.filter((e) => e.id !== id) })),

      moveExperience: (id, dir) => set((s) => ({ experience: moveItem(s.experience, id, dir) })),

      addEducation: () =>
        set((s) => ({
          education: [
            ...s.education,
            { id: uid(), institution: "", degree: "", field: "", startDate: "", endDate: "" },
          ],
        })),

      updateEducation: (id, patch) =>
        set((s) => ({
          education: s.education.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),

      removeEducation: (id) => set((s) => ({ education: s.education.filter((e) => e.id !== id) })),

      moveEducation: (id, dir) => set((s) => ({ education: moveItem(s.education, id, dir) })),

      addProject: () =>
        set((s) => ({
          projects: [...s.projects, { id: uid(), name: "", url: "", description: "" }],
        })),

      updateProject: (id, patch) =>
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      removeProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),

      moveProject: (id, dir) => set((s) => ({ projects: moveItem(s.projects, id, dir) })),

      addCertification: () =>
        set((s) => ({
          certifications: [...s.certifications, { id: uid(), name: "", issuer: "", date: "" }],
        })),

      updateCertification: (id, patch) =>
        set((s) => ({
          certifications: s.certifications.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      removeCertification: (id) =>
        set((s) => ({ certifications: s.certifications.filter((c) => c.id !== id) })),

      moveCertification: (id, dir) =>
        set((s) => ({ certifications: moveItem(s.certifications, id, dir) })),

      resetAll: () => {
        try {
          localStorage.removeItem(PERSIST_KEY);
        } catch {
          // localStorage unavailable (e.g. test env)
        }
        set({
          fullName: "",
          email: "",
          phone: "",
          location: "",
          linkedin: "",
          website: "",
          summary: "",
          experience: [
            { id: uid(), company: "", title: "", startDate: "", endDate: "", bullets: [""] },
          ],
          education: [
            { id: uid(), institution: "", degree: "", field: "", startDate: "", endDate: "" },
          ],
          skills: "",
          projects: [],
          certifications: [],
          languages: "",
          template: "clean",
        });
      },

      loadSample: () => {
        set({
          fullName: SAMPLE_DATA.fullName,
          email: SAMPLE_DATA.email,
          phone: SAMPLE_DATA.phone,
          location: SAMPLE_DATA.location,
          linkedin: SAMPLE_DATA.linkedin,
          website: SAMPLE_DATA.website,
          summary: SAMPLE_DATA.summary,
          experience: SAMPLE_DATA.experience.map((e) => ({ ...e, id: uid() })),
          education: SAMPLE_DATA.education.map((e) => ({ ...e, id: uid() })),
          skills: SAMPLE_DATA.skills,
          projects: SAMPLE_DATA.projects.map((p) => ({ ...p, id: uid() })),
          certifications: SAMPLE_DATA.certifications.map((c) => ({ ...c, id: uid() })),
          languages: SAMPLE_DATA.languages,
        });
      },

      loadFromJson: (raw) => {
        const result = parseJsonResume(raw);
        if (!result.ok) return { ok: false, error: result.error };
        const d = result.data;
        set((s) => ({
          fullName: d.fullName ?? s.fullName,
          email: d.email ?? s.email,
          phone: d.phone ?? s.phone,
          location: d.location ?? s.location,
          linkedin: d.linkedin ?? s.linkedin,
          website: d.website ?? s.website,
          summary: d.summary ?? s.summary,
          experience: d.experience ?? s.experience,
          education: d.education ?? s.education,
          skills: d.skills ?? s.skills,
          projects: d.projects ?? s.projects,
          certifications: d.certifications ?? s.certifications,
          languages: d.languages ?? s.languages,
          template: d.template ?? s.template,
        }));
        return { ok: true };
      },
    }),
    {
      name: PERSIST_KEY,
      partialize: (s) => ({
        fullName: s.fullName,
        email: s.email,
        phone: s.phone,
        location: s.location,
        linkedin: s.linkedin,
        website: s.website,
        summary: s.summary,
        experience: s.experience,
        education: s.education,
        skills: s.skills,
        projects: s.projects,
        certifications: s.certifications,
        languages: s.languages,
        template: s.template,
      }),
      // Validate persisted shape on rehydrate so a wrong-typed field (e.g.
      // experience:"x" instead of an array) falls back to the in-memory default
      // rather than crashing render with a .map() TypeError.
      // Mirrors the per-field type-checking used by the Import-JSON path.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Record<string, unknown>;
        const strField = (key: keyof ResumeData): string =>
          typeof p[key] === "string" ? (p[key] as string) : (current as Record<string, unknown>)[key] as string;
        return {
          ...current,
          fullName: strField("fullName"),
          email: strField("email"),
          phone: strField("phone"),
          location: strField("location"),
          linkedin: strField("linkedin"),
          website: strField("website"),
          summary: strField("summary"),
          skills: strField("skills"),
          languages: strField("languages"),
          experience: Array.isArray(p.experience) ? (p.experience as ExperienceEntry[]) : (current as ResumeState).experience,
          education: Array.isArray(p.education) ? (p.education as EducationEntry[]) : (current as ResumeState).education,
          projects: Array.isArray(p.projects) ? (p.projects as ProjectEntry[]) : (current as ResumeState).projects,
          certifications: Array.isArray(p.certifications) ? (p.certifications as CertificationEntry[]) : (current as ResumeState).certifications,
          template: (["clean", "compact", "bold"] as TemplateId[]).includes(p.template as TemplateId)
            ? (p.template as TemplateId)
            : (current as ResumeState).template,
        };
      },
    }
  )
);

import { useEffect, useRef, useState } from "react";
import { downloadJson, exportResumeJson } from "../lib/resumeJson";
import { generateResumePdf } from "../lib/resumePdf";
import type { ResumeData } from "../store/useResumeStore";
import { useResumeStore } from "../store/useResumeStore";

type ExportStatus = "idle" | "busy" | "done" | "error";

function getResumeData(s: ReturnType<typeof useResumeStore.getState>): ResumeData {
  return {
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
  };
}

export function ExportButton() {
  const s = useResumeStore();
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleExportPdf() {
    if (status === "busy") return;
    setStatus("busy");
    setError(null);
    try {
      const data = getResumeData(s);
      const pdfBytes = await generateResumePdf(data);
      const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const name = s.fullName.trim().replace(/\s+/g, "-").toLowerCase() || "resume";
      a.download = `${name}-resume.pdf`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setStatus("done");
      if (doneTimer.current) clearTimeout(doneTimer.current);
      doneTimer.current = setTimeout(() => setStatus("idle"), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF generation failed.");
      setStatus("error");
    }
  }

  function handleSaveJson() {
    const data = getResumeData(s);
    const json = exportResumeJson(data);
    const name = s.fullName.trim().replace(/\s+/g, "-").toLowerCase() || "resume";
    downloadJson(json, `${name}-resume.json`);
  }

  // Cmd+Enter / Ctrl+Enter triggers PDF download (fleet-wide shortcut)
  // biome-ignore lint/correctness/useExhaustiveDependencies: handleExportPdf closes over status; re-registering on status change is intentional
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleExportPdf();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [status]);

  const label =
    status === "busy" ? "Generating..." : status === "done" ? "Downloaded!" : "Download PDF";

  return (
    <div className="export-actions">
      <button
        type="button"
        className={`btn-primary${status === "done" ? " btn-primary--done" : ""}`}
        onClick={handleExportPdf}
        disabled={status === "busy"}
        aria-busy={status === "busy"}
        aria-live="polite"
        title="Download PDF (Cmd+Enter)"
      >
        {label}
      </button>
      <button
        type="button"
        className="btn-secondary"
        onClick={handleSaveJson}
        title="Save as JSON (re-importable)"
      >
        Save JSON
      </button>
      {status === "error" && error && (
        <output role="alert" style={{ fontSize: "0.8rem", color: "#c0392b" }}>
          {error}
        </output>
      )}
    </div>
  );
}

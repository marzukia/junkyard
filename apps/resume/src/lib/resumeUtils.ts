import type { EducationEntry, ExperienceEntry } from "../store/useResumeStore";

/** Format a date range for display. Empty endDate becomes "Present". */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = startDate.trim();
  const end = endDate.trim();
  if (!start && !end) return "";
  if (!start) return end || "";
  if (!end) return `${start} - Present`;
  return `${start} - ${end}`;
}

/** Parse a skills string into an array of non-empty trimmed tokens. */
export function parseSkills(skills: string): string[] {
  return skills
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Return true if at least one meaningful field is filled in a contact block. */
export function hasContactInfo(fields: {
  fullName: string;
  email: string;
  phone: string;
  location: string;
}): boolean {
  return (
    fields.fullName.trim().length > 0 ||
    fields.email.trim().length > 0 ||
    fields.phone.trim().length > 0 ||
    fields.location.trim().length > 0
  );
}

/** Return true if a single experience entry has any meaningful content. */
export function hasExperienceContent(entry: ExperienceEntry): boolean {
  return (
    entry.company.trim().length > 0 ||
    entry.title.trim().length > 0 ||
    entry.bullets.some((b) => b.trim().length > 0)
  );
}

/** Return true if a single education entry has any meaningful content. */
export function hasEducationContent(entry: EducationEntry): boolean {
  return (
    entry.institution.trim().length > 0 ||
    entry.degree.trim().length > 0 ||
    entry.field.trim().length > 0
  );
}

/** Filter bullets to non-empty lines for PDF/preview rendering. */
export function filteredBullets(bullets: string[]): string[] {
  return bullets.map((b) => b.trim()).filter((b) => b.length > 0);
}

/**
 * Return the URL if it uses a safe scheme (https / http / mailto), or null.
 * Blocks javascript:, data:, and any other non-safe schemes so project URLs
 * cannot become clickable code-execution vectors. Mirrors the guard in
 * mdInline.ts runsToHtml() which covers inline markdown links.
 */
export function safeProjectUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  return /^(https?:\/\/|mailto:)/i.test(trimmed) ? trimmed : null;
}

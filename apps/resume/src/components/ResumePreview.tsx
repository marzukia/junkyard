import { mdToHtml } from "../lib/mdInline";
import { filteredBullets, formatDateRange, parseSkills } from "../lib/resumeUtils";
import { useResumeStore } from "../store/useResumeStore";
import { LoadSampleButton } from "./LoadSampleButton";

/**
 * Per-template CSS variable overrides applied to the .resume-doc element.
 * "clean" is the baseline (teal accent, normal spacing).
 * "compact" uses a slate-blue accent with tighter line spacing.
 * "bold" uses a red-ink accent with heavier section headings.
 */
const TEMPLATE_VARS: Record<string, React.CSSProperties> = {
  clean: {},
  compact: {
    "--tmpl-accent": "#5b6acc",
    "--tmpl-name-size": "1.45rem",
    "--tmpl-section-gap": "0.9rem",
    "--tmpl-entry-gap": "0.4rem",
  } as React.CSSProperties,
  bold: {
    "--tmpl-accent": "#c0392b",
    "--tmpl-name-size": "2rem",
    "--tmpl-section-gap": "1.5rem",
    "--tmpl-entry-gap": "0.7rem",
  } as React.CSSProperties,
};

export function ResumePreview() {
  const s = useResumeStore();

  const contactParts: string[] = [];
  if (s.email.trim()) contactParts.push(s.email.trim());
  if (s.phone.trim()) contactParts.push(s.phone.trim());
  if (s.location.trim()) contactParts.push(s.location.trim());
  if (s.linkedin.trim()) contactParts.push(s.linkedin.trim());
  if (s.website.trim()) contactParts.push(s.website.trim());

  const expEntries = s.experience.filter(
    (e) => e.company.trim() || e.title.trim() || filteredBullets(e.bullets).length > 0
  );
  const eduEntries = s.education.filter(
    (e) => e.institution.trim() || e.degree.trim() || e.field.trim()
  );
  const skills = parseSkills(s.skills);
  const projectEntries = s.projects.filter((p) => p.name.trim() || p.description.trim());
  const certEntries = s.certifications.filter((c) => c.name.trim());
  const languages = parseSkills(s.languages);

  const isEmpty =
    !s.fullName.trim() &&
    contactParts.length === 0 &&
    !s.summary.trim() &&
    expEntries.length === 0 &&
    eduEntries.length === 0 &&
    skills.length === 0 &&
    projectEntries.length === 0 &&
    certEntries.length === 0 &&
    languages.length === 0;

  const tmplVars = TEMPLATE_VARS[s.template] ?? {};

  return (
    <div className="preview-pane">
      <div className="preview-card">
        <div className="preview-header">
          <span className="preview-label">Preview</span>
        </div>

        {isEmpty ? (
          <div className="preview-empty">
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path
                d="M6 3 L22 3 L26 7 L26 29 L6 29 Z"
                stroke="#2f9d8d"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M22 3 L22 7 L26 7"
                stroke="#2f9d8d"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <circle cx="13" cy="11" r="2.5" stroke="#e8b04b" strokeWidth="1.2" />
              <path
                d="M8.5 17.5 C8.5 14.5 17.5 14.5 17.5 17.5"
                stroke="#e8b04b"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <line x1="9" y1="21" x2="23" y2="21" stroke="#2f9d8d" strokeWidth="1" opacity="0.4" />
              <line x1="9" y1="24" x2="20" y2="24" stroke="#2f9d8d" strokeWidth="1" opacity="0.3" />
            </svg>
            <p>Start filling in your details to see a live preview.</p>
            <LoadSampleButton variant="secondary" />
          </div>
        ) : (
          <section
            className={`resume-doc resume-doc--${s.template}`}
            aria-label="Resume preview"
            style={tmplVars}
          >
            <div className="resume-doc-accent" />

            {s.fullName.trim() && <div className="resume-doc-name">{s.fullName.trim()}</div>}

            {contactParts.length > 0 && (
              <div className="resume-doc-contact">
                {contactParts.map((part, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: contact parts are positional display items
                  <span key={i}>
                    {i > 0 && <span className="contact-sep"> | </span>}
                    {part}
                  </span>
                ))}
              </div>
            )}

            {s.summary.trim() && (
              <div className="resume-section">
                <div className="resume-section-heading">Summary</div>
                <div className="resume-section-rule" />
                {/* dangerouslySetInnerHTML is safe here: mdToHtml escapes all text and
                    only allows <strong>, <em>, <code>, and <a href="https?://..."> */}
                <p
                  className="resume-summary"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: mdToHtml sanitises; allowlist is <strong|em|code|a href=https?>
                  dangerouslySetInnerHTML={{ __html: mdToHtml(s.summary.trim()) }}
                />
              </div>
            )}

            {expEntries.length > 0 && (
              <div className="resume-section">
                <div className="resume-section-heading">Experience</div>
                <div className="resume-section-rule" />
                {expEntries.map((entry) => {
                  const dateRange = formatDateRange(entry.startDate, entry.endDate);
                  const bullets = filteredBullets(entry.bullets);
                  return (
                    <div key={entry.id} className="resume-entry">
                      <div className="resume-entry-header">
                        <span className="resume-entry-title">
                          {entry.title.trim() || "(Untitled)"}
                        </span>
                        {dateRange && <span className="resume-entry-date">{dateRange}</span>}
                      </div>
                      {entry.company.trim() && (
                        <div className="resume-entry-sub">{entry.company.trim()}</div>
                      )}
                      {bullets.length > 0 && (
                        <ul className="resume-bullets">
                          {bullets.map((b, i) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: bullets are ordered display lines
                            // biome-ignore lint/security/noDangerouslySetInnerHtml: mdToHtml sanitises; allowlist is <strong|em|code|a href=https?>
                            <li key={i} dangerouslySetInnerHTML={{ __html: mdToHtml(b) }} />
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {eduEntries.length > 0 && (
              <div className="resume-section">
                <div className="resume-section-heading">Education</div>
                <div className="resume-section-rule" />
                {eduEntries.map((entry) => {
                  const dateRange = formatDateRange(entry.startDate, entry.endDate);
                  const degreeField = [entry.degree.trim(), entry.field.trim()]
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <div key={entry.id} className="resume-entry">
                      <div className="resume-entry-header">
                        <span className="resume-entry-title">
                          {entry.institution.trim() || "(Institution)"}
                        </span>
                        {dateRange && <span className="resume-entry-date">{dateRange}</span>}
                      </div>
                      {degreeField && <div className="resume-entry-sub">{degreeField}</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {skills.length > 0 && (
              <div className="resume-section">
                <div className="resume-section-heading">Skills</div>
                <div className="resume-section-rule" />
                <div className="resume-skills">
                  {skills.map((skill, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: skills are ordered display chips
                    <span key={i} className="resume-skill-chip">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {projectEntries.length > 0 && (
              <div className="resume-section">
                <div className="resume-section-heading">Projects</div>
                <div className="resume-section-rule" />
                {projectEntries.map((p) => (
                  <div key={p.id} className="resume-entry">
                    <div className="resume-entry-header">
                      <span className="resume-entry-title">
                        {p.url.trim() ? (
                          <a
                            href={p.url.trim()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="resume-entry-link"
                          >
                            {p.name.trim() || p.url.trim()}
                          </a>
                        ) : (
                          p.name.trim() || "(Untitled project)"
                        )}
                      </span>
                    </div>
                    {p.description.trim() && (
                      <div
                        className="resume-entry-sub"
                        // biome-ignore lint/security/noDangerouslySetInnerHtml: mdToHtml sanitises
                        dangerouslySetInnerHTML={{ __html: mdToHtml(p.description.trim()) }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {certEntries.length > 0 && (
              <div className="resume-section">
                <div className="resume-section-heading">Certifications</div>
                <div className="resume-section-rule" />
                {certEntries.map((c) => (
                  <div key={c.id} className="resume-entry">
                    <div className="resume-entry-header">
                      <span className="resume-entry-title">{c.name.trim()}</span>
                      {c.date.trim() && <span className="resume-entry-date">{c.date.trim()}</span>}
                    </div>
                    {c.issuer.trim() && <div className="resume-entry-sub">{c.issuer.trim()}</div>}
                  </div>
                ))}
              </div>
            )}

            {languages.length > 0 && (
              <div className="resume-section">
                <div className="resume-section-heading">Languages</div>
                <div className="resume-section-rule" />
                <div className="resume-skills">
                  {languages.map((lang, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: language chips are ordered display items
                    <span key={i} className="resume-skill-chip">
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

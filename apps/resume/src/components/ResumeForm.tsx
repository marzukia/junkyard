import type {
  CertificationEntry,
  EducationEntry,
  ExperienceEntry,
  ProjectEntry,
} from "../store/useResumeStore";
import { useResumeStore } from "../store/useResumeStore";

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

interface ExperienceCardProps {
  entry: ExperienceEntry;
  index: number;
  total: number;
}

function ExperienceCard({ entry, index, total }: ExperienceCardProps) {
  const { updateExperience, removeExperience, moveExperience } = useResumeStore();

  function setBullets(raw: string) {
    updateExperience(entry.id, { bullets: raw.split("\n") });
  }

  return (
    <div className="entry-card">
      <div className="entry-card-controls">
        <button
          type="button"
          className="btn-icon"
          onClick={() => moveExperience(entry.id, "up")}
          disabled={index === 0}
          aria-label="Move up"
        >
          <ChevronUpIcon />
        </button>
        <button
          type="button"
          className="btn-icon"
          onClick={() => moveExperience(entry.id, "down")}
          disabled={index === total - 1}
          aria-label="Move down"
        >
          <ChevronDownIcon />
        </button>
        <button
          type="button"
          className="btn-icon btn-icon--danger"
          onClick={() => removeExperience(entry.id)}
          aria-label="Remove experience"
        >
          <TrashIcon />
        </button>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label htmlFor={`exp-title-${entry.id}`}>Job Title</label>
          <input
            id={`exp-title-${entry.id}`}
            className="text-input"
            type="text"
            value={entry.title}
            onChange={(e) => updateExperience(entry.id, { title: e.target.value })}
            placeholder="Software Engineer"
          />
        </div>
        <div className="form-field">
          <label htmlFor={`exp-company-${entry.id}`}>Company</label>
          <input
            id={`exp-company-${entry.id}`}
            className="text-input"
            type="text"
            value={entry.company}
            onChange={(e) => updateExperience(entry.id, { company: e.target.value })}
            placeholder="Acme Corp"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label htmlFor={`exp-start-${entry.id}`}>Start</label>
          <input
            id={`exp-start-${entry.id}`}
            className="text-input"
            type="text"
            value={entry.startDate}
            onChange={(e) => updateExperience(entry.id, { startDate: e.target.value })}
            placeholder="Jan 2022"
          />
        </div>
        <div className="form-field">
          <label htmlFor={`exp-end-${entry.id}`}>End (blank = Present)</label>
          <input
            id={`exp-end-${entry.id}`}
            className="text-input"
            type="text"
            value={entry.endDate}
            onChange={(e) => updateExperience(entry.id, { endDate: e.target.value })}
            placeholder="Present"
          />
        </div>
      </div>

      <div className="form-field">
        <label htmlFor={`exp-bullets-${entry.id}`}>Bullet points (one per line)</label>
        <textarea
          id={`exp-bullets-${entry.id}`}
          className="textarea-input"
          rows={4}
          value={entry.bullets.join("\n")}
          onChange={(e) => setBullets(e.target.value)}
          placeholder="Built scalable REST API handling 10k req/s&#10;Reduced deploy time by 40% via CI pipeline improvements"
        />
      </div>
    </div>
  );
}

interface EducationCardProps {
  entry: EducationEntry;
  index: number;
  total: number;
}

function EducationCard({ entry, index, total }: EducationCardProps) {
  const { updateEducation, removeEducation, moveEducation } = useResumeStore();

  return (
    <div className="entry-card">
      <div className="entry-card-controls">
        <button
          type="button"
          className="btn-icon"
          onClick={() => moveEducation(entry.id, "up")}
          disabled={index === 0}
          aria-label="Move up"
        >
          <ChevronUpIcon />
        </button>
        <button
          type="button"
          className="btn-icon"
          onClick={() => moveEducation(entry.id, "down")}
          disabled={index === total - 1}
          aria-label="Move down"
        >
          <ChevronDownIcon />
        </button>
        <button
          type="button"
          className="btn-icon btn-icon--danger"
          onClick={() => removeEducation(entry.id)}
          aria-label="Remove education"
        >
          <TrashIcon />
        </button>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label htmlFor={`edu-inst-${entry.id}`}>Institution</label>
          <input
            id={`edu-inst-${entry.id}`}
            className="text-input"
            type="text"
            value={entry.institution}
            onChange={(e) => updateEducation(entry.id, { institution: e.target.value })}
            placeholder="University of Auckland"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label htmlFor={`edu-degree-${entry.id}`}>Degree</label>
          <input
            id={`edu-degree-${entry.id}`}
            className="text-input"
            type="text"
            value={entry.degree}
            onChange={(e) => updateEducation(entry.id, { degree: e.target.value })}
            placeholder="Bachelor of Science"
          />
        </div>
        <div className="form-field">
          <label htmlFor={`edu-field-${entry.id}`}>Field of Study</label>
          <input
            id={`edu-field-${entry.id}`}
            className="text-input"
            type="text"
            value={entry.field}
            onChange={(e) => updateEducation(entry.id, { field: e.target.value })}
            placeholder="Computer Science"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label htmlFor={`edu-start-${entry.id}`}>Start</label>
          <input
            id={`edu-start-${entry.id}`}
            className="text-input"
            type="text"
            value={entry.startDate}
            onChange={(e) => updateEducation(entry.id, { startDate: e.target.value })}
            placeholder="2018"
          />
        </div>
        <div className="form-field">
          <label htmlFor={`edu-end-${entry.id}`}>End</label>
          <input
            id={`edu-end-${entry.id}`}
            className="text-input"
            type="text"
            value={entry.endDate}
            onChange={(e) => updateEducation(entry.id, { endDate: e.target.value })}
            placeholder="2022"
          />
        </div>
      </div>
    </div>
  );
}

interface ProjectCardProps {
  entry: ProjectEntry;
  index: number;
  total: number;
}

function ProjectCard({ entry, index, total }: ProjectCardProps) {
  const { updateProject, removeProject, moveProject } = useResumeStore();

  return (
    <div className="entry-card">
      <div className="entry-card-controls">
        <button
          type="button"
          className="btn-icon"
          onClick={() => moveProject(entry.id, "up")}
          disabled={index === 0}
          aria-label="Move up"
        >
          <ChevronUpIcon />
        </button>
        <button
          type="button"
          className="btn-icon"
          onClick={() => moveProject(entry.id, "down")}
          disabled={index === total - 1}
          aria-label="Move down"
        >
          <ChevronDownIcon />
        </button>
        <button
          type="button"
          className="btn-icon btn-icon--danger"
          onClick={() => removeProject(entry.id)}
          aria-label="Remove project"
        >
          <TrashIcon />
        </button>
      </div>

      <div className="form-row">
        <div className="form-field" style={{ flex: 2 }}>
          <label htmlFor={`proj-name-${entry.id}`}>Project Name</label>
          <input
            id={`proj-name-${entry.id}`}
            className="text-input"
            type="text"
            value={entry.name}
            onChange={(e) => updateProject(entry.id, { name: e.target.value })}
            placeholder="My Open Source Tool"
          />
        </div>
        <div className="form-field" style={{ flex: 3 }}>
          <label htmlFor={`proj-url-${entry.id}`}>URL (optional)</label>
          <input
            id={`proj-url-${entry.id}`}
            className="text-input"
            type="url"
            value={entry.url}
            onChange={(e) => updateProject(entry.id, { url: e.target.value })}
            placeholder="https://github.com/you/project"
          />
        </div>
      </div>

      <div className="form-field">
        <label htmlFor={`proj-desc-${entry.id}`}>Description</label>
        <textarea
          id={`proj-desc-${entry.id}`}
          className="textarea-input"
          rows={2}
          value={entry.description}
          onChange={(e) => updateProject(entry.id, { description: e.target.value })}
          placeholder="What it does, notable metrics, stack used..."
        />
      </div>
    </div>
  );
}

interface CertificationCardProps {
  entry: CertificationEntry;
  index: number;
  total: number;
}

function CertificationCard({ entry, index, total }: CertificationCardProps) {
  const { updateCertification, removeCertification, moveCertification } = useResumeStore();

  return (
    <div className="entry-card">
      <div className="entry-card-controls">
        <button
          type="button"
          className="btn-icon"
          onClick={() => moveCertification(entry.id, "up")}
          disabled={index === 0}
          aria-label="Move up"
        >
          <ChevronUpIcon />
        </button>
        <button
          type="button"
          className="btn-icon"
          onClick={() => moveCertification(entry.id, "down")}
          disabled={index === total - 1}
          aria-label="Move down"
        >
          <ChevronDownIcon />
        </button>
        <button
          type="button"
          className="btn-icon btn-icon--danger"
          onClick={() => removeCertification(entry.id)}
          aria-label="Remove certification"
        >
          <TrashIcon />
        </button>
      </div>

      <div className="form-row">
        <div className="form-field" style={{ flex: 3 }}>
          <label htmlFor={`cert-name-${entry.id}`}>Certification</label>
          <input
            id={`cert-name-${entry.id}`}
            className="text-input"
            type="text"
            value={entry.name}
            onChange={(e) => updateCertification(entry.id, { name: e.target.value })}
            placeholder="AWS Solutions Architect"
          />
        </div>
        <div className="form-field" style={{ flex: 2 }}>
          <label htmlFor={`cert-issuer-${entry.id}`}>Issuer</label>
          <input
            id={`cert-issuer-${entry.id}`}
            className="text-input"
            type="text"
            value={entry.issuer}
            onChange={(e) => updateCertification(entry.id, { issuer: e.target.value })}
            placeholder="Amazon Web Services"
          />
        </div>
        <div className="form-field" style={{ flex: 1 }}>
          <label htmlFor={`cert-date-${entry.id}`}>Date</label>
          <input
            id={`cert-date-${entry.id}`}
            className="text-input"
            type="text"
            value={entry.date}
            onChange={(e) => updateCertification(entry.id, { date: e.target.value })}
            placeholder="2023"
          />
        </div>
      </div>
    </div>
  );
}

export function ResumeForm() {
  const s = useResumeStore();

  return (
    <div className="resume-form">
      {/* Contact */}
      <div className="form-section">
        <div className="form-section-title">Contact</div>
        <div className="form-row">
          <div className="form-field" style={{ flex: 2 }}>
            <label htmlFor="full-name">Full Name</label>
            <input
              id="full-name"
              className="text-input"
              type="text"
              value={s.fullName}
              onChange={(e) => s.setFullName(e.target.value)}
              placeholder="Jane Smith"
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="text-input"
              type="email"
              value={s.email}
              onChange={(e) => s.setEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </div>
          <div className="form-field">
            <label htmlFor="phone">Phone</label>
            <input
              id="phone"
              className="text-input"
              type="tel"
              value={s.phone}
              onChange={(e) => s.setPhone(e.target.value)}
              placeholder="+64 21 000 0000"
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="location">Location</label>
            <input
              id="location"
              className="text-input"
              type="text"
              value={s.location}
              onChange={(e) => s.setLocation(e.target.value)}
              placeholder="Auckland, NZ"
            />
          </div>
          <div className="form-field">
            <label htmlFor="linkedin">LinkedIn (optional)</label>
            <input
              id="linkedin"
              className="text-input"
              type="text"
              value={s.linkedin}
              onChange={(e) => s.setLinkedin(e.target.value)}
              placeholder="linkedin.com/in/janesmith"
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="website">Website (optional)</label>
            <input
              id="website"
              className="text-input"
              type="text"
              value={s.website}
              onChange={(e) => s.setWebsite(e.target.value)}
              placeholder="janesmith.dev"
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="form-section">
        <div className="form-section-title">Summary</div>
        <div className="form-field">
          <label htmlFor="summary">Professional summary</label>
          <textarea
            id="summary"
            className="textarea-input"
            rows={3}
            value={s.summary}
            onChange={(e) => s.setSummary(e.target.value)}
            placeholder="Results-driven engineer with 5+ years experience building scalable products..."
          />
        </div>
      </div>

      {/* Experience */}
      <div className="form-section">
        <div className="form-section-title">Experience</div>
        {s.experience.map((entry, i) => (
          <ExperienceCard key={entry.id} entry={entry} index={i} total={s.experience.length} />
        ))}
        <button type="button" className="btn-add" onClick={s.addExperience}>
          <PlusIcon />
          Add position
        </button>
      </div>

      {/* Education */}
      <div className="form-section">
        <div className="form-section-title">Education</div>
        {s.education.map((entry, i) => (
          <EducationCard key={entry.id} entry={entry} index={i} total={s.education.length} />
        ))}
        <button type="button" className="btn-add" onClick={s.addEducation}>
          <PlusIcon />
          Add education
        </button>
      </div>

      {/* Skills */}
      <div className="form-section">
        <div className="form-section-title">Skills</div>
        <div className="form-field">
          <label htmlFor="skills">Skills (comma or newline separated)</label>
          <textarea
            id="skills"
            className="textarea-input"
            rows={3}
            value={s.skills}
            onChange={(e) => s.setSkills(e.target.value)}
            placeholder="TypeScript, React, Go, PostgreSQL, Docker, CI/CD"
          />
        </div>
      </div>

      {/* Projects */}
      <div className="form-section">
        <div className="form-section-title">Projects</div>
        {s.projects.map((entry, i) => (
          <ProjectCard key={entry.id} entry={entry} index={i} total={s.projects.length} />
        ))}
        <button type="button" className="btn-add" onClick={s.addProject}>
          <PlusIcon />
          Add project
        </button>
      </div>

      {/* Certifications */}
      <div className="form-section">
        <div className="form-section-title">Certifications</div>
        {s.certifications.map((entry, i) => (
          <CertificationCard
            key={entry.id}
            entry={entry}
            index={i}
            total={s.certifications.length}
          />
        ))}
        <button type="button" className="btn-add" onClick={s.addCertification}>
          <PlusIcon />
          Add certification
        </button>
      </div>

      {/* Languages */}
      <div className="form-section">
        <div className="form-section-title">Languages</div>
        <div className="form-field">
          <label htmlFor="languages">Languages (comma separated)</label>
          <input
            id="languages"
            className="text-input"
            type="text"
            value={s.languages}
            onChange={(e) => s.setLanguages(e.target.value)}
            placeholder="English (native), Spanish (professional)"
          />
        </div>
      </div>
    </div>
  );
}

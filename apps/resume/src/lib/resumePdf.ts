import { embedUnicodeFonts, sanitizeWinAnsi } from "@junkyardsh/ui";
import { PDFDocument, type PDFFont, PageSizes, StandardFonts, rgb } from "pdf-lib";
import type {
  CertificationEntry,
  EducationEntry,
  ExperienceEntry,
  ProjectEntry,
  TemplateId,
} from "../store/useResumeStore";
import { tokenizeLine } from "./mdInline";
import { filteredBullets, formatDateRange, parseSkills } from "./resumeUtils";

export interface ResumePdfInput {
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
}

// Template-specific palette
interface TemplatePalette {
  accent: ReturnType<typeof rgb>;
  nameSize: number;
  bodySize: number;
  sectionGap: number;
}

function getPalette(template: TemplateId): TemplatePalette {
  switch (template) {
    case "compact":
      return {
        accent: rgb(0.357, 0.416, 0.8), // slate-blue
        nameSize: 18,
        bodySize: 9,
        sectionGap: 4,
      };
    case "bold":
      return {
        accent: rgb(0.753, 0.224, 0.169), // red
        nameSize: 26,
        bodySize: 9.5,
        sectionGap: 8,
      };
    default: // "clean"
      return {
        accent: rgb(0.184, 0.616, 0.553), // teal
        nameSize: 22,
        bodySize: 9.5,
        sectionGap: 6,
      };
  }
}

// Shared ink colours
const INK = rgb(0.102, 0.145, 0.188);
const INK_MID = rgb(0.357, 0.4, 0.443);
const INK_FAINT = rgb(0.604, 0.639, 0.675);
const RULE = rgb(0.91, 0.918, 0.929);

const MARGIN = 50;
const PAGE_WIDTH = PageSizes.Letter[0];
const PAGE_HEIGHT = PageSizes.Letter[1];
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

interface DrawCtx {
  page: ReturnType<PDFDocument["addPage"]>;
  doc: PDFDocument;
  boldFont: PDFFont;
  regularFont: PDFFont;
  italicFont: PDFFont;
  y: number;
  pages: ReturnType<PDFDocument["addPage"]>[];
  palette: TemplatePalette;
  /** True when boldFont/regularFont/italicFont support full Unicode */
  unicodeMode: boolean;
}

/** Sanitize text if not in Unicode mode */
function enc(ctx: DrawCtx, text: string): string {
  return ctx.unicodeMode ? text : sanitizeWinAnsi(text);
}

function newPage(ctx: DrawCtx): void {
  const page = ctx.doc.addPage(PageSizes.Letter);
  ctx.pages.push(page);
  ctx.page = page;
  ctx.y = PAGE_HEIGHT - MARGIN;
}

function ensureSpace(ctx: DrawCtx, needed: number): void {
  if (ctx.y - needed < MARGIN + 20) {
    newPage(ctx);
  }
}

function drawText(
  ctx: DrawCtx,
  text: string,
  opts: {
    x?: number;
    size: number;
    font?: "bold" | "regular";
    color?: ReturnType<typeof rgb>;
    maxWidth?: number;
  }
): void {
  const font = opts.font === "bold" ? ctx.boldFont : ctx.regularFont;
  const color = opts.color ?? INK;
  const x = opts.x ?? MARGIN;
  const maxWidth = opts.maxWidth ?? CONTENT_WIDTH;
  const safeText = enc(ctx, text);

  // Word-wrap
  const words = safeText.split(" ");
  let line = "";
  const lines: string[] = [];
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    const w = font.widthOfTextAtSize(candidate, opts.size);
    if (w > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);

  for (const l of lines) {
    ensureSpace(ctx, opts.size + 4);
    ctx.page.drawText(l, { x, y: ctx.y, size: opts.size, font, color });
    ctx.y -= opts.size + 4;
  }
}

/**
 * Draw a line of inline-markdown text, selecting bold/italic/regular fonts
 * per run and advancing x by each segment's measured width.
 * Wraps at contentX + maxWidth when a word-boundary is crossed.
 */
function drawMdText(
  ctx: DrawCtx,
  mdInput: string,
  opts: {
    x?: number;
    size: number;
    color?: ReturnType<typeof rgb>;
    maxWidth?: number;
  }
): void {
  const startX = opts.x ?? MARGIN;
  const maxWidth = opts.maxWidth ?? CONTENT_WIDTH;
  const size = opts.size;
  const color = opts.color ?? INK;

  type Atom = { text: string; font: PDFFont };

  function fontFor(type: string): PDFFont {
    if (type === "bold") return ctx.boldFont;
    if (type === "italic") return ctx.italicFont;
    return ctx.regularFont;
  }

  const tokens = tokenizeLine(mdInput);
  const atoms: Atom[] = [];

  for (const token of tokens) {
    const words = enc(ctx, token.text).split(/(\s+)/); // split keeping separators
    const f = fontFor(token.type);
    for (const w of words) {
      if (w.length > 0) atoms.push({ text: w, font: f });
    }
  }

  type LineSegment = { text: string; font: PDFFont };
  type Line = LineSegment[];

  const lines: Line[] = [];
  let currentLine: LineSegment[] = [];
  let currentWidth = 0;

  for (const atom of atoms) {
    if (/^\s+$/.test(atom.text)) {
      if (currentLine.length > 0) {
        const w = atom.font.widthOfTextAtSize(atom.text, size);
        currentLine.push({ text: atom.text, font: atom.font });
        currentWidth += w;
      }
      continue;
    }

    const w = atom.font.widthOfTextAtSize(atom.text, size);
    if (currentWidth + w > maxWidth && currentLine.length > 0) {
      while (currentLine.length > 0 && /^\s+$/.test(currentLine[currentLine.length - 1]!.text)) {
        currentLine.pop();
      }
      lines.push(currentLine);
      currentLine = [];
      currentWidth = 0;
    }
    currentLine.push({ text: atom.text, font: atom.font });
    currentWidth += w;
  }
  if (currentLine.length > 0) {
    while (currentLine.length > 0 && /^\s+$/.test(currentLine[currentLine.length - 1]!.text)) {
      currentLine.pop();
    }
    lines.push(currentLine);
  }

  for (const segs of lines) {
    ensureSpace(ctx, size + 4);
    let cx = startX;
    for (const seg of segs) {
      ctx.page.drawText(seg.text, {
        x: cx,
        y: ctx.y,
        size,
        font: seg.font,
        color,
      });
      cx += seg.font.widthOfTextAtSize(seg.text, size);
    }
    ctx.y -= size + 4;
  }
}

function drawRule(ctx: DrawCtx): void {
  ensureSpace(ctx, 4);
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_WIDTH - MARGIN, y: ctx.y },
    thickness: 0.5,
    color: RULE,
  });
  ctx.y -= 8;
}

function drawSectionHeading(ctx: DrawCtx, label: string): void {
  ctx.y -= ctx.palette.sectionGap;
  ensureSpace(ctx, 20);
  drawText(ctx, label.toUpperCase(), {
    size: 8,
    font: "bold",
    color: ctx.palette.accent,
  });
  drawRule(ctx);
}

function drawTwoCol(
  ctx: DrawCtx,
  left: string,
  right: string,
  opts: {
    leftSize: number;
    rightSize: number;
    leftFont?: "bold" | "regular";
    leftColor?: ReturnType<typeof rgb>;
    rightColor?: ReturnType<typeof rgb>;
  }
): void {
  ensureSpace(ctx, opts.leftSize + 6);
  const leftFont = opts.leftFont === "bold" ? ctx.boldFont : ctx.regularFont;
  const rightFont = ctx.regularFont;
  ctx.page.drawText(enc(ctx, left), {
    x: MARGIN,
    y: ctx.y,
    size: opts.leftSize,
    font: leftFont,
    color: opts.leftColor ?? INK,
  });
  const safeRight = enc(ctx, right);
  const rw = rightFont.widthOfTextAtSize(safeRight, opts.rightSize);
  ctx.page.drawText(safeRight, {
    x: PAGE_WIDTH - MARGIN - rw,
    y: ctx.y,
    size: opts.rightSize,
    font: rightFont,
    color: opts.rightColor ?? INK_FAINT,
  });
  ctx.y -= opts.leftSize + 4;
}

export async function generateResumePdf(input: ResumePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();

  // Attempt Unicode fonts; fall back to Helvetica variants on failure.
  const unicodeFonts = await embedUnicodeFonts(doc);

  let boldFont: PDFFont;
  let regularFont: PDFFont;
  let italicFont: PDFFont;
  let unicodeMode: boolean;

  if (unicodeFonts) {
    boldFont = unicodeFonts.bold;
    regularFont = unicodeFonts.regular;
    // Noto Sans doesn't have a separate italic in the same CDN file;
    // use regular as fallback -- acceptable for resume body text.
    italicFont = unicodeFonts.regular;
    unicodeMode = true;
  } else {
    console.warn(
      "[resume-pdf] Unicode font unavailable; falling back to Helvetica (non-Latin chars will be sanitized)"
    );
    boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
    regularFont = await doc.embedFont(StandardFonts.Helvetica);
    italicFont = await doc.embedFont(StandardFonts.HelveticaOblique);
    unicodeMode = false;
  }

  const palette = getPalette(input.template);

  const firstPage = doc.addPage(PageSizes.Letter);
  const ctx: DrawCtx = {
    page: firstPage,
    doc,
    boldFont,
    regularFont,
    italicFont,
    y: PAGE_HEIGHT - MARGIN,
    pages: [firstPage],
    palette,
    unicodeMode,
  };

  // ---- Accent bar ----
  ctx.page.drawRectangle({
    x: MARGIN,
    y: PAGE_HEIGHT - MARGIN - 3,
    width: CONTENT_WIDTH,
    height: 3,
    color: palette.accent,
  });
  ctx.y = PAGE_HEIGHT - MARGIN - 14;

  // ---- Name ----
  if (input.fullName.trim()) {
    ensureSpace(ctx, palette.nameSize + 8);
    ctx.page.drawText(enc(ctx, input.fullName.trim()), {
      x: MARGIN,
      y: ctx.y,
      size: palette.nameSize,
      font: boldFont,
      color: INK,
    });
    ctx.y -= palette.nameSize + 8;
  }

  // ---- Contact line ----
  const contactParts: string[] = [];
  if (input.email.trim()) contactParts.push(input.email.trim());
  if (input.phone.trim()) contactParts.push(input.phone.trim());
  if (input.location.trim()) contactParts.push(input.location.trim());
  if (input.linkedin.trim()) contactParts.push(input.linkedin.trim());
  if (input.website.trim()) contactParts.push(input.website.trim());

  if (contactParts.length > 0) {
    drawText(ctx, contactParts.join("  |  "), {
      size: 9,
      font: "regular",
      color: INK_MID,
      maxWidth: CONTENT_WIDTH,
    });
    ctx.y -= 2;
  }

  // ---- Summary ----
  if (input.summary.trim()) {
    drawSectionHeading(ctx, "Summary");
    drawMdText(ctx, input.summary.trim(), { size: palette.bodySize, color: INK });
    ctx.y -= 2;
  }

  // ---- Experience ----
  const expEntries = input.experience.filter(
    (e) => e.company.trim() || e.title.trim() || filteredBullets(e.bullets).length > 0
  );
  if (expEntries.length > 0) {
    drawSectionHeading(ctx, "Experience");
    for (const entry of expEntries) {
      ctx.y -= 2;
      ensureSpace(ctx, 20);
      const dateRange = formatDateRange(entry.startDate, entry.endDate);
      drawTwoCol(ctx, entry.title.trim() || "(Untitled)", dateRange, {
        leftSize: 10,
        rightSize: 9,
        leftFont: "bold",
        leftColor: INK,
        rightColor: INK_MID,
      });
      if (entry.company.trim()) {
        drawText(ctx, entry.company.trim(), { size: 9, font: "regular", color: INK_MID });
      }
      const bullets = filteredBullets(entry.bullets);
      for (const bullet of bullets) {
        ctx.y -= 1;
        ensureSpace(ctx, 12);
        ctx.page.drawText("*", {
          x: MARGIN + 6,
          y: ctx.y,
          size: 9,
          font: regularFont,
          color: palette.accent,
        });
        drawMdText(ctx, bullet, {
          x: MARGIN + 16,
          size: 9,
          color: INK,
          maxWidth: CONTENT_WIDTH - 16,
        });
      }
      ctx.y -= 2;
    }
  }

  // ---- Education ----
  const eduEntries = input.education.filter(
    (e) => e.institution.trim() || e.degree.trim() || e.field.trim()
  );
  if (eduEntries.length > 0) {
    drawSectionHeading(ctx, "Education");
    for (const entry of eduEntries) {
      ctx.y -= 2;
      ensureSpace(ctx, 20);
      const dateRange = formatDateRange(entry.startDate, entry.endDate);
      const degreeField = [entry.degree.trim(), entry.field.trim()].filter(Boolean).join(", ");
      drawTwoCol(ctx, entry.institution.trim() || "(Institution)", dateRange, {
        leftSize: 10,
        rightSize: 9,
        leftFont: "bold",
        leftColor: INK,
        rightColor: INK_MID,
      });
      if (degreeField) {
        drawText(ctx, degreeField, { size: 9, font: "regular", color: INK_MID });
      }
      ctx.y -= 2;
    }
  }

  // ---- Skills ----
  const skillList = parseSkills(input.skills);
  if (skillList.length > 0) {
    drawSectionHeading(ctx, "Skills");
    drawText(ctx, skillList.join("  *  "), {
      size: 9,
      font: "regular",
      color: INK,
    });
  }

  // ---- Projects ----
  const projectEntries = input.projects.filter((p) => p.name.trim() || p.description.trim());
  if (projectEntries.length > 0) {
    drawSectionHeading(ctx, "Projects");
    for (const p of projectEntries) {
      ctx.y -= 2;
      ensureSpace(ctx, 16);
      const nameLabel = p.name.trim() || p.url.trim() || "(Untitled)";
      const urlSuffix = p.url.trim() ? `  ${p.url.trim()}` : "";
      drawText(ctx, `${nameLabel}${urlSuffix}`, {
        size: 10,
        font: "bold",
        color: INK,
        maxWidth: CONTENT_WIDTH,
      });
      if (p.description.trim()) {
        drawMdText(ctx, p.description.trim(), { size: 9, color: INK_MID });
      }
      ctx.y -= 2;
    }
  }

  // ---- Certifications ----
  const certEntries = input.certifications.filter((c) => c.name.trim());
  if (certEntries.length > 0) {
    drawSectionHeading(ctx, "Certifications");
    for (const c of certEntries) {
      ctx.y -= 2;
      ensureSpace(ctx, 16);
      const dateStr = c.date.trim();
      drawTwoCol(ctx, c.name.trim(), dateStr, {
        leftSize: 10,
        rightSize: 9,
        leftFont: "bold",
        leftColor: INK,
        rightColor: INK_FAINT,
      });
      if (c.issuer.trim()) {
        drawText(ctx, c.issuer.trim(), { size: 9, font: "regular", color: INK_MID });
      }
      ctx.y -= 2;
    }
  }

  // ---- Languages ----
  const langList = parseSkills(input.languages);
  if (langList.length > 0) {
    drawSectionHeading(ctx, "Languages");
    drawText(ctx, langList.join("  *  "), {
      size: 9,
      font: "regular",
      color: INK,
    });
  }

  // ---- Footer page numbers ----
  const totalPages = ctx.pages.length;
  if (totalPages > 1) {
    for (let i = 0; i < totalPages; i++) {
      const pg = ctx.pages[i]!;
      const label = `${i + 1} / ${totalPages}`;
      const lw = regularFont.widthOfTextAtSize(label, 8);
      pg.drawText(label, {
        x: PAGE_WIDTH / 2 - lw / 2,
        y: 30,
        size: 8,
        font: regularFont,
        color: INK_FAINT,
      });
    }
  }

  return doc.save();
}

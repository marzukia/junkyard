import { embedUnicodeFonts, sanitizeWinAnsi } from "../../../kit/lib/unicodeFont";
import { PDFDocument, type PDFFont, type PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { DocType, LineItem } from "../store/useInvoiceStore";
import { calcTotals, formatMoney } from "./invoiceCalc";

const DOC_TITLE_MAP: Record<DocType, string> = {
  invoice: "INVOICE",
  quote: "QUOTE",
  receipt: "RECEIPT",
};

interface PdfInvoiceData {
  docType: DocType;
  senderName: string;
  senderEmail: string;
  senderAddress: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  items: LineItem[];
  taxRate: number;
  discountPercent: number;
  shipping: number;
  amountPaid: number;
  taxOnGross: boolean;
  notes: string;
  logoDataUrl: string | null;
}

// Brand palette as pdf-lib rgb values
const TEAL = rgb(0.184, 0.616, 0.553); // #2f9d8d
const AMBER = rgb(0.91, 0.69, 0.294); // #e8b04b
const CORAL = rgb(0.851, 0.349, 0.298); // #d9594c
const INK = rgb(0.102, 0.145, 0.188); // #1a2530
const INK_MID = rgb(0.357, 0.4, 0.443); // #5b6671
const INK_FAINT = rgb(0.604, 0.639, 0.675); // #9aa3ac
const RULE = rgb(0.91, 0.918, 0.929); // #e8eaed

// Page dimensions & layout constants
const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN_X = 50;
const MARGIN_BOTTOM = 50;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

interface DrawState {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  bold: PDFFont;
  regular: PDFFont;
  oblique: PDFFont;
  /** True when the current font set supports full Unicode */
  unicodeMode: boolean;
}

/** Encode text for the current font, sanitizing if not in Unicode mode. */
function enc(state: DrawState, text: string): string {
  return state.unicodeMode ? text : sanitizeWinAnsi(text);
}

function addPage(state: DrawState): void {
  state.page = state.doc.addPage([PAGE_W, PAGE_H]);
  state.y = PAGE_H - MARGIN_X;
  drawAccentBars(state.page);
}

function drawAccentBars(page: PDFPage): void {
  page.drawRectangle({ x: 0, y: PAGE_H - 6, width: PAGE_W * 0.55, height: 6, color: TEAL });
  page.drawRectangle({
    x: PAGE_W * 0.55,
    y: PAGE_H - 6,
    width: PAGE_W * 0.28,
    height: 6,
    color: AMBER,
  });
  page.drawRectangle({
    x: PAGE_W * 0.83,
    y: PAGE_H - 6,
    width: PAGE_W * 0.17,
    height: 6,
    color: CORAL,
  });
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W * 0.55, height: 3, color: TEAL });
  page.drawRectangle({ x: PAGE_W * 0.55, y: 0, width: PAGE_W * 0.28, height: 3, color: AMBER });
  page.drawRectangle({ x: PAGE_W * 0.83, y: 0, width: PAGE_W * 0.17, height: 3, color: CORAL });
}

function ensureSpace(state: DrawState, needed: number): void {
  if (state.y - needed < MARGIN_BOTTOM + 20) {
    addPage(state);
  }
}

function splitLines(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  if (!text) return [""];
  const lines: string[] = [];
  for (const rawLine of text.split("\n")) {
    const words = rawLine.split(" ");
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
          let chunk = "";
          for (const ch of word) {
            const next = chunk + ch;
            if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
              chunk = next;
            } else {
              if (chunk) lines.push(chunk);
              chunk = ch;
            }
          }
          current = chunk;
        } else {
          current = word;
        }
      }
    }
    lines.push(current);
  }
  return lines;
}

function drawTableHeader(state: DrawState, col: Record<string, { x: number; w: number }>): void {
  const headers: [string, { x: number; w: number }][] = [
    ["DESCRIPTION", col.desc],
    ["QTY", col.qty],
    ["UNIT PRICE", col.unit],
    ["AMOUNT", col.amount],
  ];
  for (const [label, c] of headers) {
    const isRight = label !== "DESCRIPTION";
    const tw = state.bold.widthOfTextAtSize(label, 7);
    const tx = isRight ? c.x + c.w - tw : c.x;
    state.page.drawText(label, { x: tx, y: state.y, size: 7, font: state.bold, color: INK_FAINT });
  }
  state.y -= 6;
  state.page.drawLine({
    start: { x: MARGIN_X, y: state.y },
    end: { x: PAGE_W - MARGIN_X, y: state.y },
    thickness: 1.5,
    color: RULE,
  });
  state.y -= 12;
}

export async function generateInvoicePdf(data: PdfInvoiceData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  // Attempt to embed Unicode fonts; fall back to StandardFonts on failure.
  const unicodeFonts = await embedUnicodeFonts(pdfDoc);

  let bold: PDFFont;
  let regular: PDFFont;
  let oblique: PDFFont;
  let unicodeMode: boolean;

  if (unicodeFonts) {
    // Noto Sans does not ship a separate oblique; use the bold for headers and
    // regular everywhere else. Oblique fallback to regular is acceptable here.
    bold = unicodeFonts.bold;
    regular = unicodeFonts.regular;
    oblique = unicodeFonts.regular; // best available without a third fetch
    unicodeMode = true;
  } else {
    console.warn(
      "[invoice-pdf] Unicode font unavailable; falling back to Helvetica (non-Latin chars will be sanitized)"
    );
    bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    oblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    unicodeMode = false;
  }

  const firstPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const state: DrawState = {
    doc: pdfDoc,
    page: firstPage,
    y: PAGE_H - 40,
    bold,
    regular,
    oblique,
    unicodeMode,
  };
  drawAccentBars(firstPage);

  // Logo (if provided)
  if (data.logoDataUrl) {
    try {
      const logoBase64 = data.logoDataUrl.split(",")[1] ?? "";
      const logoBytes = Uint8Array.from(atob(logoBase64), (c) => c.charCodeAt(0));
      const isJpeg =
        data.logoDataUrl.startsWith("data:image/jpeg") ||
        data.logoDataUrl.startsWith("data:image/jpg");
      const logoImg = isJpeg ? await pdfDoc.embedJpg(logoBytes) : await pdfDoc.embedPng(logoBytes);
      const logoMax = { w: 120, h: 60 };
      const scale = Math.min(logoMax.w / logoImg.width, logoMax.h / logoImg.height);
      const logoW = logoImg.width * scale;
      const logoH = logoImg.height * scale;
      state.page.drawImage(logoImg, {
        x: MARGIN_X,
        y: state.y - logoH,
        width: logoW,
        height: logoH,
      });
    } catch (logoErr) {
      throw new Error(
        `Logo could not be embedded in the PDF: ${logoErr instanceof Error ? logoErr.message : String(logoErr)}. Remove the logo or use a valid PNG/JPEG file.`
      );
    }
  }

  // Document title (right side)
  const titleText = DOC_TITLE_MAP[data.docType] ?? "INVOICE";
  const titleW = bold.widthOfTextAtSize(titleText, 28);
  state.page.drawText(enc(state, titleText), {
    x: PAGE_W - MARGIN_X - titleW,
    y: state.y - 22,
    size: 28,
    font: bold,
    color: INK,
  });

  const numText = `#${enc(state, data.invoiceNumber)}`;
  const numW = regular.widthOfTextAtSize(numText, 10);
  state.page.drawText(numText, {
    x: PAGE_W - MARGIN_X - numW,
    y: state.y - 38,
    size: 10,
    font: regular,
    color: TEAL,
  });

  const issueTxt = `Issue: ${enc(state, data.issueDate)}`;
  const issueW = regular.widthOfTextAtSize(issueTxt, 8);
  state.page.drawText(issueTxt, {
    x: PAGE_W - MARGIN_X - issueW,
    y: state.y - 52,
    size: 8,
    font: regular,
    color: INK_FAINT,
  });
  if (data.docType !== "receipt" && data.dueDate) {
    const dueTxt = `Due: ${enc(state, data.dueDate)}`;
    const dueW = regular.widthOfTextAtSize(dueTxt, 8);
    state.page.drawText(dueTxt, {
      x: PAGE_W - MARGIN_X - dueW,
      y: state.y - 64,
      size: 8,
      font: regular,
      color: INK_FAINT,
    });
  }

  state.y -= 90;

  state.page.drawLine({
    start: { x: MARGIN_X, y: state.y },
    end: { x: PAGE_W - MARGIN_X, y: state.y },
    thickness: 0.5,
    color: RULE,
  });
  state.y -= 18;

  // FROM / TO blocks
  const colW = CONTENT_W / 2 - 10;

  const drawParty = (
    label: string,
    name: string,
    email: string,
    address: string,
    startX: number,
    startY: number
  ): number => {
    let ly = startY;
    state.page.drawText(enc(state, label), { x: startX, y: ly, size: 7, font: bold, color: TEAL });
    ly -= 14;
    if (name) {
      state.page.drawText(enc(state, name), { x: startX, y: ly, size: 10, font: bold, color: INK });
      ly -= 13;
    }
    if (email) {
      state.page.drawText(enc(state, email), {
        x: startX,
        y: ly,
        size: 8,
        font: regular,
        color: INK_MID,
      });
      ly -= 12;
    }
    if (address) {
      const addrLines = splitLines(enc(state, address), regular, 8, colW);
      for (const line of addrLines) {
        state.page.drawText(line, { x: startX, y: ly, size: 8, font: regular, color: INK_MID });
        ly -= 11;
      }
    }
    return ly;
  };

  const fromBottom = drawParty(
    "FROM",
    data.senderName,
    data.senderEmail,
    data.senderAddress,
    MARGIN_X,
    state.y
  );
  const toBottom = drawParty(
    data.docType === "receipt" ? "RECEIVED FROM" : "BILL TO",
    data.clientName,
    data.clientEmail,
    data.clientAddress,
    MARGIN_X + colW + 20,
    state.y
  );

  state.y = Math.min(fromBottom, toBottom) - 18;

  state.page.drawLine({
    start: { x: MARGIN_X, y: state.y },
    end: { x: PAGE_W - MARGIN_X, y: state.y },
    thickness: 0.5,
    color: RULE,
  });
  state.y -= 14;

  // Column layout
  const col = {
    desc: { x: MARGIN_X, w: CONTENT_W * 0.45 },
    qty: { x: MARGIN_X + CONTENT_W * 0.45, w: CONTENT_W * 0.12 },
    unit: { x: MARGIN_X + CONTENT_W * 0.57, w: CONTENT_W * 0.2 },
    amount: { x: MARGIN_X + CONTENT_W * 0.77, w: CONTENT_W * 0.23 },
  };

  drawTableHeader(state, col);

  // Line items with pagination
  for (const item of data.items) {
    const effectiveQty = Math.max(0, item.qty);
    const lineTotal = effectiveQty * item.unitPrice;
    const descLines = splitLines(enc(state, item.description || "-"), regular, 9, col.desc.w - 4);
    const rowH = descLines.length * 12 + 6;

    // If this row won't fit, add a new page and redraw the table header
    if (state.y - rowH < MARGIN_BOTTOM + 20) {
      addPage(state);
      // redraw column headers on the continuation page
      drawTableHeader(state, col);
    }

    // Zebra stripe
    const stripeY = state.y - rowH + 6;
    state.page.drawRectangle({
      x: MARGIN_X - 2,
      y: stripeY,
      width: CONTENT_W + 4,
      height: rowH,
      color: rgb(0.976, 0.98, 0.984),
      opacity: 0.5,
    });

    let dy = state.y;
    for (const line of descLines) {
      state.page.drawText(line, { x: col.desc.x, y: dy, size: 9, font: regular, color: INK });
      dy -= 12;
    }

    const midY = state.y - (descLines.length - 1) * 6;

    const qtyStr = enc(state, String(effectiveQty));
    const qtyW = regular.widthOfTextAtSize(qtyStr, 9);
    state.page.drawText(qtyStr, {
      x: col.qty.x + col.qty.w - qtyW,
      y: midY,
      size: 9,
      font: regular,
      color: INK,
    });

    const unitStr = enc(state, formatMoney(item.unitPrice, data.currency));
    const unitW = regular.widthOfTextAtSize(unitStr, 9);
    state.page.drawText(unitStr, {
      x: col.unit.x + col.unit.w - unitW,
      y: midY,
      size: 9,
      font: regular,
      color: INK,
    });

    const amtStr = enc(state, formatMoney(lineTotal, data.currency));
    const amtW = regular.widthOfTextAtSize(amtStr, 9);
    state.page.drawText(amtStr, {
      x: col.amount.x + col.amount.w - amtW,
      y: midY,
      size: 9,
      font: regular,
      color: INK,
    });

    state.y -= rowH;

    state.page.drawLine({
      start: { x: MARGIN_X, y: state.y + 4 },
      end: { x: PAGE_W - MARGIN_X, y: state.y + 4 },
      thickness: 0.5,
      color: RULE,
    });
    state.y -= 4;
  }

  state.y -= 10;

  // Totals block -- ensure it fits; if not, start a new page
  const totals = calcTotals(
    data.items,
    data.taxRate,
    data.discountPercent,
    data.shipping,
    data.amountPaid,
    data.taxOnGross
  );
  const totalsX = PAGE_W - MARGIN_X - 200;

  // Estimate total height of the totals block so we don't orphan it across pages
  const totalsRowCount =
    1 + // subtotal
    (data.discountPercent > 0 ? 1 : 0) +
    (data.taxRate > 0 ? 1 : 0) +
    (data.shipping > 0 ? 1 : 0) +
    1 + // total
    (data.amountPaid > 0 ? 2 : 0); // amount paid + balance due
  const totalsEstH = totalsRowCount * 20 + 30;

  if (state.y - totalsEstH < MARGIN_BOTTOM + 20) {
    addPage(state);
  }

  const drawTotalRow = (label: string, value: string, isGrand = false): void => {
    const lineY = isGrand ? state.y - 4 : state.y;
    if (isGrand) {
      state.page.drawLine({
        start: { x: totalsX, y: state.y + 2 },
        end: { x: PAGE_W - MARGIN_X, y: state.y + 2 },
        thickness: 0.75,
        color: RULE,
      });
    }
    const labelFont = isGrand ? bold : regular;
    const valueFont = isGrand ? bold : regular;
    const labelSize = isGrand ? 9 : 8;
    const valueSize = isGrand ? 11 : 9;
    const valueColor = isGrand ? TEAL : INK;

    state.page.drawText(enc(state, label), {
      x: totalsX,
      y: lineY,
      size: labelSize,
      font: labelFont,
      color: INK_FAINT,
    });
    const vw = valueFont.widthOfTextAtSize(enc(state, value), valueSize);
    state.page.drawText(enc(state, value), {
      x: PAGE_W - MARGIN_X - vw,
      y: lineY,
      size: valueSize,
      font: valueFont,
      color: valueColor,
    });
    state.y -= isGrand ? 20 : 15;
  };

  drawTotalRow("Subtotal", formatMoney(totals.subtotal, data.currency));
  if (data.discountPercent > 0) {
    drawTotalRow(
      `Discount (${data.discountPercent}%)`,
      `-${formatMoney(totals.discountAmount, data.currency)}`
    );
  }
  if (data.taxRate > 0) {
    drawTotalRow(`Tax (${data.taxRate}%)`, formatMoney(totals.taxAmount, data.currency));
  }
  if (data.shipping > 0) {
    drawTotalRow("Shipping", formatMoney(totals.shipping, data.currency));
  }
  drawTotalRow("Total", formatMoney(totals.total, data.currency), true);
  if (data.amountPaid > 0) {
    drawTotalRow("Amount Paid", `-${formatMoney(totals.amountPaid, data.currency)}`);
    drawTotalRow("Balance Due", formatMoney(totals.balanceDue, data.currency), true);
  }

  // Notes
  if (data.notes) {
    state.y -= 10;
    ensureSpace(state, 40);
    state.page.drawLine({
      start: { x: MARGIN_X, y: state.y },
      end: { x: PAGE_W - MARGIN_X, y: state.y },
      thickness: 0.5,
      color: RULE,
    });
    state.y -= 14;
    state.page.drawText("NOTES", {
      x: MARGIN_X,
      y: state.y,
      size: 7,
      font: bold,
      color: INK_FAINT,
    });
    state.y -= 12;
    const noteLines = splitLines(enc(state, data.notes), oblique, 9, CONTENT_W);
    for (const line of noteLines) {
      ensureSpace(state, 14);
      state.page.drawText(line, {
        x: MARGIN_X,
        y: state.y,
        size: 9,
        font: oblique,
        color: INK_MID,
      });
      state.y -= 12;
    }
  }

  // Footer on the last page
  const footerY = 24;
  state.page.drawLine({
    start: { x: MARGIN_X, y: footerY + 10 },
    end: { x: PAGE_W - MARGIN_X, y: footerY + 10 },
    thickness: 0.5,
    color: RULE,
  });
  const footerTxt = "Generated with junkyard.mrzk.io/invoice/";
  const ftW = regular.widthOfTextAtSize(footerTxt, 7);
  state.page.drawText(footerTxt, {
    x: (PAGE_W - ftW) / 2,
    y: footerY,
    size: 7,
    font: regular,
    color: INK_FAINT,
  });

  pdfDoc.setTitle(`Invoice ${data.invoiceNumber}`);
  pdfDoc.setAuthor(enc(state, data.senderName || "Invoice Generator"));
  pdfDoc.setCreator("junkyard.mrzk.io/invoice/");

  return pdfDoc.save();
}

import { PDFDocument, type PDFFont, StandardFonts, rgb } from "pdf-lib";
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
        // Word wider than column: break at character level
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

export async function generateInvoicePdf(data: PdfInvoiceData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const oblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const marginX = 50;
  const contentWidth = width - marginX * 2;
  let y = height - 40;

  // Accent bar at top
  page.drawRectangle({ x: 0, y: height - 6, width: width * 0.55, height: 6, color: TEAL });
  page.drawRectangle({
    x: width * 0.55,
    y: height - 6,
    width: width * 0.28,
    height: 6,
    color: AMBER,
  });
  page.drawRectangle({
    x: width * 0.83,
    y: height - 6,
    width: width * 0.17,
    height: 6,
    color: CORAL,
  });

  y = height - 50;

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
      page.drawImage(logoImg, {
        x: marginX,
        y: y - logoH,
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
  page.drawText(titleText, {
    x: width - marginX - titleW,
    y: y - 22,
    size: 28,
    font: bold,
    color: INK,
  });

  // Invoice number
  const numText = `#${data.invoiceNumber}`;
  const numW = regular.widthOfTextAtSize(numText, 10);
  page.drawText(numText, {
    x: width - marginX - numW,
    y: y - 38,
    size: 10,
    font: regular,
    color: TEAL,
  });

  // Dates
  const issueTxt = `Issue: ${data.issueDate}`;
  const issueW = regular.widthOfTextAtSize(issueTxt, 8);
  page.drawText(issueTxt, {
    x: width - marginX - issueW,
    y: y - 52,
    size: 8,
    font: regular,
    color: INK_FAINT,
  });
  if (data.docType !== "receipt" && data.dueDate) {
    const dueTxt = `Due: ${data.dueDate}`;
    const dueW = regular.widthOfTextAtSize(dueTxt, 8);
    page.drawText(dueTxt, {
      x: width - marginX - dueW,
      y: y - 64,
      size: 8,
      font: regular,
      color: INK_FAINT,
    });
  }

  y -= 90;

  // Horizontal rule
  page.drawLine({
    start: { x: marginX, y },
    end: { x: width - marginX, y },
    thickness: 0.5,
    color: RULE,
  });
  y -= 18;

  // FROM / TO blocks
  const colW = contentWidth / 2 - 10;
  const drawParty = (
    label: string,
    name: string,
    email: string,
    address: string,
    startX: number,
    startY: number
  ): number => {
    let ly = startY;
    page.drawText(label, { x: startX, y: ly, size: 7, font: bold, color: TEAL });
    ly -= 14;
    if (name) {
      page.drawText(name, { x: startX, y: ly, size: 10, font: bold, color: INK });
      ly -= 13;
    }
    if (email) {
      page.drawText(email, { x: startX, y: ly, size: 8, font: regular, color: INK_MID });
      ly -= 12;
    }
    if (address) {
      const addrLines = splitLines(address, regular, 8, colW);
      for (const line of addrLines) {
        page.drawText(line, { x: startX, y: ly, size: 8, font: regular, color: INK_MID });
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
    marginX,
    y
  );
  const toBottom = drawParty(
    data.docType === "receipt" ? "RECEIVED FROM" : "BILL TO",
    data.clientName,
    data.clientEmail,
    data.clientAddress,
    marginX + colW + 20,
    y
  );

  y = Math.min(fromBottom, toBottom) - 18;

  // Rule
  page.drawLine({
    start: { x: marginX, y },
    end: { x: width - marginX, y },
    thickness: 0.5,
    color: RULE,
  });
  y -= 14;

  // Table headers
  const col = {
    desc: { x: marginX, w: contentWidth * 0.45 },
    qty: { x: marginX + contentWidth * 0.45, w: contentWidth * 0.12 },
    unit: { x: marginX + contentWidth * 0.57, w: contentWidth * 0.2 },
    amount: { x: marginX + contentWidth * 0.77, w: contentWidth * 0.23 },
  };

  const headers: [string, typeof col.desc][] = [
    ["DESCRIPTION", col.desc],
    ["QTY", col.qty],
    ["UNIT PRICE", col.unit],
    ["AMOUNT", col.amount],
  ];
  for (const [label, c] of headers) {
    const isRight = label !== "DESCRIPTION";
    const tw = bold.widthOfTextAtSize(label, 7);
    const tx = isRight ? c.x + c.w - tw : c.x;
    page.drawText(label, { x: tx, y, size: 7, font: bold, color: INK_FAINT });
  }
  y -= 6;

  // Header rule
  page.drawLine({
    start: { x: marginX, y },
    end: { x: width - marginX, y },
    thickness: 1.5,
    color: RULE,
  });
  y -= 12;

  // Line items
  for (const item of data.items) {
    const effectiveQty = Math.max(0, item.qty);
    const lineTotal = effectiveQty * item.unitPrice;
    const descLines = splitLines(item.description || "-", regular, 9, col.desc.w - 4);
    const rowH = descLines.length * 12 + 6;

    // Zebra stripe
    const stripeY = y - rowH + 6;
    page.drawRectangle({
      x: marginX - 2,
      y: stripeY,
      width: contentWidth + 4,
      height: rowH,
      color: rgb(0.976, 0.98, 0.984),
      opacity: 0.5,
    });

    // Description (multiline)
    let dy = y;
    for (const line of descLines) {
      page.drawText(line, { x: col.desc.x, y: dy, size: 9, font: regular, color: INK });
      dy -= 12;
    }

    // Qty, unit price, amount (right-aligned, vertically centered)
    const midY = y - (descLines.length - 1) * 6;

    const qtyStr = String(effectiveQty);
    const qtyW = regular.widthOfTextAtSize(qtyStr, 9);
    page.drawText(qtyStr, {
      x: col.qty.x + col.qty.w - qtyW,
      y: midY,
      size: 9,
      font: regular,
      color: INK,
    });

    const unitStr = formatMoney(item.unitPrice, data.currency);
    const unitW = regular.widthOfTextAtSize(unitStr, 9);
    page.drawText(unitStr, {
      x: col.unit.x + col.unit.w - unitW,
      y: midY,
      size: 9,
      font: regular,
      color: INK,
    });

    const amtStr = formatMoney(lineTotal, data.currency);
    const amtW = regular.widthOfTextAtSize(amtStr, 9);
    page.drawText(amtStr, {
      x: col.amount.x + col.amount.w - amtW,
      y: midY,
      size: 9,
      font: regular,
      color: INK,
    });

    y -= rowH;

    // Row rule
    page.drawLine({
      start: { x: marginX, y: y + 4 },
      end: { x: width - marginX, y: y + 4 },
      thickness: 0.5,
      color: RULE,
    });
    y -= 4;
  }

  y -= 10;

  // Totals block
  const totals = calcTotals(
    data.items,
    data.taxRate,
    data.discountPercent,
    data.shipping,
    data.amountPaid,
    data.taxOnGross
  );
  const totalsX = width - marginX - 200;

  const drawTotalRow = (label: string, value: string, startY: number, isGrand = false): number => {
    const lineY = isGrand ? startY - 4 : startY;
    if (isGrand) {
      page.drawLine({
        start: { x: totalsX, y: startY + 2 },
        end: { x: width - marginX, y: startY + 2 },
        thickness: 0.75,
        color: RULE,
      });
    }
    const labelFont = isGrand ? bold : regular;
    const valueFont = isGrand ? bold : regular;
    const labelSize = isGrand ? 9 : 8;
    const valueSize = isGrand ? 11 : 9;
    const valueColor = isGrand ? TEAL : INK;

    page.drawText(label, {
      x: totalsX,
      y: lineY,
      size: labelSize,
      font: labelFont,
      color: INK_FAINT,
    });
    const vw = valueFont.widthOfTextAtSize(value, valueSize);
    page.drawText(value, {
      x: width - marginX - vw,
      y: lineY,
      size: valueSize,
      font: valueFont,
      color: valueColor,
    });
    return lineY - (isGrand ? 20 : 15);
  };

  y = drawTotalRow("Subtotal", formatMoney(totals.subtotal, data.currency), y);
  if (data.discountPercent > 0) {
    y = drawTotalRow(
      `Discount (${data.discountPercent}%)`,
      `-${formatMoney(totals.discountAmount, data.currency)}`,
      y
    );
  }
  if (data.taxRate > 0) {
    y = drawTotalRow(`Tax (${data.taxRate}%)`, formatMoney(totals.taxAmount, data.currency), y);
  }
  if (data.shipping > 0) {
    y = drawTotalRow("Shipping", formatMoney(totals.shipping, data.currency), y);
  }
  y = drawTotalRow("Total", formatMoney(totals.total, data.currency), y, true);
  if (data.amountPaid > 0) {
    y = drawTotalRow("Amount Paid", `-${formatMoney(totals.amountPaid, data.currency)}`, y);
    y = drawTotalRow("Balance Due", formatMoney(totals.balanceDue, data.currency), y, true);
  }

  // Notes
  if (data.notes) {
    y -= 10;
    page.drawLine({
      start: { x: marginX, y },
      end: { x: width - marginX, y },
      thickness: 0.5,
      color: RULE,
    });
    y -= 14;
    page.drawText("NOTES", { x: marginX, y, size: 7, font: bold, color: INK_FAINT });
    y -= 12;
    const noteLines = splitLines(data.notes, oblique, 9, contentWidth);
    for (const line of noteLines) {
      page.drawText(line, { x: marginX, y, size: 9, font: oblique, color: INK_MID });
      y -= 12;
    }
  }

  // Footer
  const footerY = 24;
  page.drawLine({
    start: { x: marginX, y: footerY + 10 },
    end: { x: width - marginX, y: footerY + 10 },
    thickness: 0.5,
    color: RULE,
  });
  const footerTxt = "Generated with junkyard.mrzk.io/invoice/";
  const ftW = regular.widthOfTextAtSize(footerTxt, 7);
  page.drawText(footerTxt, {
    x: (width - ftW) / 2,
    y: footerY,
    size: 7,
    font: regular,
    color: INK_FAINT,
  });

  // Accent bar bottom
  page.drawRectangle({ x: 0, y: 0, width: width * 0.55, height: 3, color: TEAL });
  page.drawRectangle({ x: width * 0.55, y: 0, width: width * 0.28, height: 3, color: AMBER });
  page.drawRectangle({ x: width * 0.83, y: 0, width: width * 0.17, height: 3, color: CORAL });

  pdfDoc.setTitle(`Invoice ${data.invoiceNumber}`);
  pdfDoc.setAuthor(data.senderName || "Invoice Generator");
  pdfDoc.setCreator("junkyard.mrzk.io/invoice/");

  return pdfDoc.save();
}

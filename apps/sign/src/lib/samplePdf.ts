import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Generate a minimal sample PDF suitable for demoing the signing flow.
 * Returns the PDF as an ArrayBuffer.
 */
export async function generateSamplePdf(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([595, 842]); // A4 at 72 dpi
  const { height } = page.getSize();

  const teal = rgb(0.18, 0.61, 0.55);
  const ink = rgb(0.1, 0.14, 0.19);
  const midInk = rgb(0.36, 0.4, 0.44);

  // Heading
  page.drawText("Sample Agreement", {
    x: 60,
    y: height - 100,
    size: 28,
    font: boldFont,
    color: ink,
  });

  // Accent underline
  page.drawLine({
    start: { x: 60, y: height - 112 },
    end: { x: 535, y: height - 112 },
    thickness: 2,
    color: teal,
  });

  // Body paragraphs
  const lines = [
    "This is a sample document created for demonstration purposes.",
    "It is not a legally binding agreement.",
    "",
    "The party identified below agrees to the following terms:",
    "",
    "  1. This document will be signed using the PDF Sign tool.",
    "  2. The signature is applied locally in your browser.",
    "  3. No data leaves your device at any point.",
    "",
    "You can drag and resize your signature below before downloading.",
  ];

  let y = height - 160;
  for (const line of lines) {
    page.drawText(line, { x: 60, y, size: 13, font, color: line === "" ? ink : midInk });
    y -= 24;
  }

  // Signature line
  y -= 60;
  page.drawLine({
    start: { x: 60, y },
    end: { x: 300, y },
    thickness: 1,
    color: midInk,
  });

  page.drawText("Signature", {
    x: 60,
    y: y - 18,
    size: 10,
    font,
    color: midInk,
  });

  page.drawLine({
    start: { x: 340, y },
    end: { x: 535, y },
    thickness: 1,
    color: midInk,
  });

  page.drawText("Date", {
    x: 340,
    y: y - 18,
    size: 10,
    font,
    color: midInk,
  });

  const bytes = await doc.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

import { useEffect, useState } from "react";
import { generateInvoicePdf } from "../lib/invoicePdf";
import { useInvoiceStore } from "../store/useInvoiceStore";

export function ExportButton() {
  const store = useInvoiceStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Clear success flash after 2.5 s
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(false), 2500);
    return () => clearTimeout(t);
  }, [success]);

  // Cmd/Ctrl+Enter triggers PDF download from anywhere on the page
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleExport();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  async function handleExport() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const pdfBytes = await generateInvoicePdf({
        docType: store.docType,
        senderName: store.senderName,
        senderEmail: store.senderEmail,
        senderAddress: store.senderAddress,
        clientName: store.clientName,
        clientEmail: store.clientEmail,
        clientAddress: store.clientAddress,
        invoiceNumber: store.invoiceNumber,
        issueDate: store.issueDate,
        dueDate: store.dueDate,
        currency: store.currency,
        items: store.items,
        taxRate: store.taxRate,
        discountPercent: store.discountPercent,
        shipping: store.shipping,
        amountPaid: store.amountPaid,
        taxOnGross: store.taxOnGross,
        notes: store.notes,
        logoDataUrl: store.logoDataUrl,
      });
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${store.invoiceNumber || "invoice"}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF generation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="export-actions">
      <button
        type="button"
        className="btn-primary"
        onClick={handleExport}
        disabled={busy}
        aria-busy={busy}
        title="Download PDF (Cmd+Enter)"
      >
        {busy ? "Generating..." : success ? "Downloaded!" : "Download PDF"}
      </button>
      <span className="export-shortcut-hint" aria-hidden="true">
        Cmd+Enter
      </span>
      {error && (
        <output role="alert" style={{ fontSize: "0.8rem", color: "#c0392b" }}>
          {error}
        </output>
      )}
    </div>
  );
}

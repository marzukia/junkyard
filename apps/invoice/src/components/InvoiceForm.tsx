import { useRef } from "react";
import { CURRENCIES } from "../lib/invoiceCalc";
import type { DocType } from "../store/useInvoiceStore";
import { useInvoiceStore } from "../store/useInvoiceStore";
import type { SerializableInvoice } from "../store/useInvoiceStore";

const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: "invoice", label: "Invoice" },
  { value: "quote", label: "Quote" },
  { value: "receipt", label: "Receipt" },
];

export function InvoiceForm() {
  const store = useInvoiceStore();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        store.setLogoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleSaveJson() {
    const data: SerializableInvoice = {
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
      notes: store.notes,
      logoDataUrl: store.logoDataUrl,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${store.invoiceNumber || "invoice"}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function handleLoadJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as Partial<SerializableInvoice>;
        store.loadInvoice(data);
      } catch {
        alert("Could not read that file. Make sure it is a valid invoice JSON.");
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-loaded
    e.target.value = "";
  }

  return (
    <div className="invoice-form">
      {/* Logo */}
      <div className="form-section">
        <div className="form-section-title">Logo</div>
        <div className="logo-upload-area">
          {store.logoDataUrl && (
            <img src={store.logoDataUrl} alt="Logo preview" className="logo-preview" />
          )}
          <button
            type="button"
            className="logo-upload-btn"
            onClick={() => logoInputRef.current?.click()}
            aria-label="Upload logo image"
          >
            {store.logoDataUrl ? "Change logo" : "Upload logo"}
          </button>
          {store.logoDataUrl && (
            <button
              type="button"
              className="btn-icon btn-icon--danger"
              onClick={() => store.setLogoDataUrl(null)}
              aria-label="Remove logo"
              title="Remove logo"
            >
              x
            </button>
          )}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            tabIndex={-1}
            onChange={handleLogoChange}
          />
        </div>
      </div>

      {/* Invoice meta */}
      <div className="form-section">
        <div className="form-section-title">Document Details</div>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="inv-doctype">Document type</label>
            <select
              id="inv-doctype"
              className="select-input"
              value={store.docType}
              onChange={(e) => store.setDocType(e.target.value as DocType)}
            >
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="inv-currency">Currency</label>
            <select
              id="inv-currency"
              className="select-input"
              value={store.currency}
              onChange={(e) => store.setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="inv-number">
            {store.docType === "invoice"
              ? "Invoice"
              : store.docType === "quote"
                ? "Quote"
                : "Receipt"}{" "}
            number
          </label>
          <input
            id="inv-number"
            type="text"
            className="text-input"
            value={store.invoiceNumber}
            onChange={(e) => store.setInvoiceNumber(e.target.value)}
            placeholder="INV-001"
          />
        </div>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="inv-issue">Issue date</label>
            <input
              id="inv-issue"
              type="date"
              className="text-input"
              value={store.issueDate}
              onChange={(e) => store.setIssueDate(e.target.value)}
            />
          </div>
          {store.docType !== "receipt" && (
            <div className="form-field">
              <label htmlFor="inv-due">Due date</label>
              <input
                id="inv-due"
                type="date"
                className="text-input"
                value={store.dueDate}
                onChange={(e) => store.setDueDate(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Sender */}
      <div className="form-section">
        <div className="form-section-title">From (you)</div>
        <div className="form-field">
          <label htmlFor="sender-name">Name / Business</label>
          <input
            id="sender-name"
            type="text"
            className="text-input"
            value={store.senderName}
            onChange={(e) => store.setSenderName(e.target.value)}
            placeholder="Acme Ltd"
          />
        </div>
        <div className="form-field">
          <label htmlFor="sender-email">Email</label>
          <input
            id="sender-email"
            type="email"
            className="text-input"
            value={store.senderEmail}
            onChange={(e) => store.setSenderEmail(e.target.value)}
            placeholder="hello@acme.com"
          />
        </div>
        <div className="form-field">
          <label htmlFor="sender-address">Address</label>
          <textarea
            id="sender-address"
            className="textarea-input"
            value={store.senderAddress}
            onChange={(e) => store.setSenderAddress(e.target.value)}
            placeholder="123 Street, City, Country"
          />
        </div>
      </div>

      {/* Client */}
      <div className="form-section">
        <div className="form-section-title">Bill to (client)</div>
        <div className="form-field">
          <label htmlFor="client-name">Name / Business</label>
          <input
            id="client-name"
            type="text"
            className="text-input"
            value={store.clientName}
            onChange={(e) => store.setClientName(e.target.value)}
            placeholder="Client Corp"
          />
        </div>
        <div className="form-field">
          <label htmlFor="client-email">Email</label>
          <input
            id="client-email"
            type="email"
            className="text-input"
            value={store.clientEmail}
            onChange={(e) => store.setClientEmail(e.target.value)}
            placeholder="accounts@client.com"
          />
        </div>
        <div className="form-field">
          <label htmlFor="client-address">Address</label>
          <textarea
            id="client-address"
            className="textarea-input"
            value={store.clientAddress}
            onChange={(e) => store.setClientAddress(e.target.value)}
            placeholder="456 Avenue, City, Country"
          />
        </div>
      </div>

      {/* Line items */}
      <LineItemsSection />

      {/* Tax + discount */}
      <div className="form-section">
        <div className="form-section-title">Tax and Discount</div>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="tax-rate">Tax rate (%)</label>
            <input
              id="tax-rate"
              type="number"
              min="0"
              max="100"
              step="0.1"
              className="text-input"
              value={store.taxRate}
              onChange={(e) => store.setTaxRate(Number(e.target.value))}
              placeholder="0"
            />
          </div>
          <div className="form-field">
            <label htmlFor="discount">Discount (%)</label>
            <input
              id="discount"
              type="number"
              min="0"
              max="100"
              step="0.1"
              className="text-input"
              value={store.discountPercent}
              onChange={(e) => store.setDiscountPercent(Number(e.target.value))}
              placeholder="0"
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="shipping">Shipping / freight</label>
            <input
              id="shipping"
              type="number"
              min="0"
              step="0.01"
              className="text-input"
              value={store.shipping}
              onChange={(e) => store.setShipping(Number(e.target.value))}
              placeholder="0.00"
            />
          </div>
          <div className="form-field">
            <label htmlFor="amount-paid">Amount paid</label>
            <input
              id="amount-paid"
              type="number"
              min="0"
              step="0.01"
              className="text-input"
              value={store.amountPaid}
              onChange={(e) => store.setAmountPaid(Number(e.target.value))}
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="form-section">
        <div className="form-section-title">Notes</div>
        <div className="form-field">
          <label htmlFor="inv-notes">Notes / payment instructions</label>
          <textarea
            id="inv-notes"
            className="textarea-input"
            rows={3}
            value={store.notes}
            onChange={(e) => store.setNotes(e.target.value)}
            placeholder="Bank details, payment terms, thank-you note..."
          />
        </div>
      </div>

      {/* Save / Load / Reset */}
      <div className="form-section form-reset-row">
        <div className="form-actions-row">
          <button type="button" className="btn-secondary" onClick={handleSaveJson}>
            Save as JSON
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => jsonInputRef.current?.click()}
            aria-label="Load invoice from JSON file"
          >
            Load JSON
          </button>
          <input
            ref={jsonInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            onChange={handleLoadJson}
          />
          <button
            type="button"
            className="btn-secondary btn-danger-subtle"
            onClick={() => {
              if (window.confirm("Clear all fields and start a new invoice?")) {
                store.resetInvoice();
              }
            }}
          >
            New invoice
          </button>
        </div>
      </div>
    </div>
  );
}

function LineItemsSection() {
  const { items, addItem, updateItem, removeItem } = useInvoiceStore();

  return (
    <div className="form-section">
      <div className="form-section-title">Line Items</div>
      <div className="line-items">
        <div className="line-item-header">
          <span>Description</span>
          <span>Qty</span>
          <span>Unit price</span>
          <span />
        </div>
        {items.map((item, idx) => (
          <div key={item.id} className="line-item-group">
            <div className="line-item-row">
              <input
                type="text"
                className="text-input"
                value={item.description}
                onChange={(e) => updateItem(item.id, { description: e.target.value })}
                placeholder={`Item ${idx + 1}`}
                aria-label={`Line item ${idx + 1} description`}
              />
              <input
                type="number"
                min="0"
                step="1"
                className={`text-input${item.qty < 0 ? " input--warn" : ""}`}
                value={item.qty}
                onChange={(e) => updateItem(item.id, { qty: Number(e.target.value) })}
                aria-label={`Line item ${idx + 1} quantity`}
                aria-describedby={item.qty < 0 ? `qty-warn-${item.id}` : undefined}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                className="text-input"
                value={item.unitPrice}
                onChange={(e) => updateItem(item.id, { unitPrice: Number(e.target.value) })}
                aria-label={`Line item ${idx + 1} unit price`}
              />
              <button
                type="button"
                className="btn-icon btn-icon--danger"
                onClick={() => removeItem(item.id)}
                disabled={items.length === 1}
                aria-label={`Remove line item ${idx + 1}`}
                title="Remove item"
              >
                x
              </button>
            </div>
            {item.qty < 0 && (
              <p id={`qty-warn-${item.id}`} className="field-hint field-hint--warn">
                Quantity cannot be negative. This line will be treated as 0.
              </p>
            )}
          </div>
        ))}
        <button type="button" className="btn-secondary" onClick={addItem}>
          + Add item
        </button>
      </div>
    </div>
  );
}

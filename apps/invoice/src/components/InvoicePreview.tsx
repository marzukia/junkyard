import { calcTotals, formatMoney } from "../lib/invoiceCalc";
import { useInvoiceStore } from "../store/useInvoiceStore";

const DOC_TITLE: Record<string, string> = {
  invoice: "INVOICE",
  quote: "QUOTE",
  receipt: "RECEIPT",
};

export function InvoicePreview() {
  const store = useInvoiceStore();
  const totals = calcTotals(
    store.items,
    store.taxRate,
    store.discountPercent,
    store.shipping,
    store.amountPaid
  );

  const docTitle = DOC_TITLE[store.docType] ?? "INVOICE";

  return (
    <div className="preview-pane" aria-label="Invoice preview">
      <div className="preview-card">
        <div className="preview-header">
          <span className="preview-label">Live Preview</span>
        </div>
        <div className="invoice-doc">
          {/* Accent bar */}
          <div className="invoice-doc-accent" aria-hidden="true" />

          {/* Header row: logo + title */}
          <div className="invoice-doc-header">
            <div>
              {store.logoDataUrl ? (
                <img src={store.logoDataUrl} alt="Invoice logo" className="invoice-doc-logo" />
              ) : (
                <div style={{ height: "40px" }} />
              )}
            </div>
            <div className="invoice-doc-title-block">
              <div className="invoice-doc-title">{docTitle}</div>
              <div className="invoice-doc-number">#{store.invoiceNumber || "INV-001"}</div>
              {store.issueDate && <div className="invoice-doc-date">Issued: {store.issueDate}</div>}
              {store.dueDate && store.docType !== "receipt" && (
                <div className="invoice-doc-date">Due: {store.dueDate}</div>
              )}
            </div>
          </div>

          {/* Parties */}
          <div className="invoice-doc-parties">
            <div>
              <div className="invoice-party-label">From</div>
              {store.senderName && <div className="invoice-party-name">{store.senderName}</div>}
              {store.senderEmail && <div className="invoice-party-detail">{store.senderEmail}</div>}
              {store.senderAddress && (
                <div className="invoice-party-detail">{store.senderAddress}</div>
              )}
              {!store.senderName && !store.senderEmail && !store.senderAddress && (
                <div className="invoice-party-detail" style={{ opacity: 0.4 }}>
                  Your details
                </div>
              )}
            </div>
            <div>
              <div className="invoice-party-label">
                {store.docType === "receipt" ? "Received from" : "Bill to"}
              </div>
              {store.clientName && <div className="invoice-party-name">{store.clientName}</div>}
              {store.clientEmail && <div className="invoice-party-detail">{store.clientEmail}</div>}
              {store.clientAddress && (
                <div className="invoice-party-detail">{store.clientAddress}</div>
              )}
              {!store.clientName && !store.clientEmail && !store.clientAddress && (
                <div className="invoice-party-detail" style={{ opacity: 0.4 }}>
                  Client details
                </div>
              )}
            </div>
          </div>

          {/* Items table */}
          <table className="invoice-table" aria-label="Invoice line items">
            <thead>
              <tr>
                <th scope="col">Description</th>
                <th scope="col">Qty</th>
                <th scope="col">Unit Price</th>
                <th scope="col">Amount</th>
              </tr>
            </thead>
            <tbody>
              {store.items.map((item) => {
                const effectiveQty = Math.max(0, item.qty);
                return (
                  <tr key={item.id}>
                    <td>{item.description || <span style={{ opacity: 0.35 }}>-</span>}</td>
                    <td>{effectiveQty}</td>
                    <td>{formatMoney(item.unitPrice, store.currency)}</td>
                    <td>{formatMoney(effectiveQty * item.unitPrice, store.currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals */}
          <div className="invoice-totals">
            <div className="invoice-totals-inner">
              <div className="invoice-total-row">
                <span>Subtotal</span>
                <span>{formatMoney(totals.subtotal, store.currency)}</span>
              </div>
              {store.discountPercent > 0 && (
                <div className="invoice-total-row">
                  <span>Discount ({store.discountPercent}%)</span>
                  <span>-{formatMoney(totals.discountAmount, store.currency)}</span>
                </div>
              )}
              {store.taxRate > 0 && (
                <div className="invoice-total-row">
                  <span>Tax ({store.taxRate}%)</span>
                  <span>{formatMoney(totals.taxAmount, store.currency)}</span>
                </div>
              )}
              {store.shipping > 0 && (
                <div className="invoice-total-row">
                  <span>Shipping</span>
                  <span>{formatMoney(totals.shipping, store.currency)}</span>
                </div>
              )}
              <div className="invoice-total-row invoice-total-row--grand">
                <span>Total</span>
                <span data-testid="invoice-total">{formatMoney(totals.total, store.currency)}</span>
              </div>
              {store.amountPaid > 0 && (
                <>
                  <div className="invoice-total-row">
                    <span>Amount paid</span>
                    <span>-{formatMoney(totals.amountPaid, store.currency)}</span>
                  </div>
                  <div className="invoice-total-row invoice-total-row--balance">
                    <span>Balance due</span>
                    <span data-testid="invoice-balance">
                      {formatMoney(totals.balanceDue, store.currency)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          {store.notes && (
            <div className="invoice-notes">
              <div className="invoice-notes-label">Notes</div>
              <div>{store.notes}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

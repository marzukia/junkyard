import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface LineItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
}

export type DocType = "invoice" | "quote" | "receipt";

export interface InvoiceState {
  // Sender
  senderName: string;
  senderEmail: string;
  senderAddress: string;

  // Client
  clientName: string;
  clientEmail: string;
  clientAddress: string;

  // Invoice meta
  docType: DocType;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;

  // Line items
  items: LineItem[];

  // Totals config
  taxRate: number; // e.g. 15 = 15%
  discountPercent: number; // e.g. 10 = 10%
  shipping: number;
  amountPaid: number;

  // Extras
  notes: string;
  logoDataUrl: string | null;

  // Actions
  setSenderName: (v: string) => void;
  setSenderEmail: (v: string) => void;
  setSenderAddress: (v: string) => void;
  setClientName: (v: string) => void;
  setClientEmail: (v: string) => void;
  setClientAddress: (v: string) => void;
  setDocType: (v: DocType) => void;
  setInvoiceNumber: (v: string) => void;
  setIssueDate: (v: string) => void;
  setDueDate: (v: string) => void;
  setCurrency: (v: string) => void;
  setTaxRate: (v: number) => void;
  setDiscountPercent: (v: number) => void;
  setShipping: (v: number) => void;
  setAmountPaid: (v: number) => void;
  setNotes: (v: string) => void;
  setLogoDataUrl: (v: string | null) => void;

  addItem: () => void;
  updateItem: (id: string, patch: Partial<Omit<LineItem, "id">>) => void;
  removeItem: (id: string) => void;
  resetInvoice: () => void;
  loadInvoice: (data: Partial<SerializableInvoice>) => void;
}

/** Shape that can be serialised to / deserialised from JSON. */
export interface SerializableInvoice {
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
  notes: string;
  logoDataUrl: string | null;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function dueDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const BLANK_STATE = {
  docType: "invoice" as DocType,
  senderName: "",
  senderEmail: "",
  senderAddress: "",
  clientName: "",
  clientEmail: "",
  clientAddress: "",
  invoiceNumber: "INV-001",
  issueDate: todayStr(),
  dueDate: dueDateStr(),
  currency: "USD",
  items: [{ id: uid(), description: "", qty: 1, unitPrice: 0 }] as LineItem[],
  taxRate: 0,
  discountPercent: 0,
  shipping: 0,
  amountPaid: 0,
  notes: "",
  logoDataUrl: null as string | null,
};

export const useInvoiceStore = create<InvoiceState>()(
  persist(
    (set) => ({
      ...BLANK_STATE,

      setSenderName: (v) => set({ senderName: v }),
      setSenderEmail: (v) => set({ senderEmail: v }),
      setSenderAddress: (v) => set({ senderAddress: v }),
      setClientName: (v) => set({ clientName: v }),
      setClientEmail: (v) => set({ clientEmail: v }),
      setClientAddress: (v) => set({ clientAddress: v }),
      setDocType: (v) => set({ docType: v }),
      setInvoiceNumber: (v) => set({ invoiceNumber: v }),
      setIssueDate: (v) => set({ issueDate: v }),
      setDueDate: (v) => set({ dueDate: v }),
      setCurrency: (v) => set({ currency: v }),
      setTaxRate: (v) => set({ taxRate: v }),
      setDiscountPercent: (v) => set({ discountPercent: v }),
      setShipping: (v) => set({ shipping: v }),
      setAmountPaid: (v) => set({ amountPaid: v }),
      setNotes: (v) => set({ notes: v }),
      setLogoDataUrl: (v) => set({ logoDataUrl: v }),

      addItem: () =>
        set((s) => ({
          items: [...s.items, { id: uid(), description: "", qty: 1, unitPrice: 0 }],
        })),

      updateItem: (id, patch) =>
        set((s) => ({
          items: s.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        })),

      removeItem: (id) =>
        set((s) => ({
          items: s.items.filter((item) => item.id !== id),
        })),

      resetInvoice: () =>
        set({
          ...BLANK_STATE,
          // Fresh dates and id on reset
          issueDate: todayStr(),
          dueDate: dueDateStr(),
          items: [{ id: uid(), description: "", qty: 1, unitPrice: 0 }],
        }),

      loadInvoice: (data) =>
        set((s) => ({
          ...s,
          ...data,
          // Re-assign ids in case of collision
          items: (data.items ?? s.items).map((item) => ({ ...item, id: uid() })),
        })),
    }),
    {
      name: "invoice-draft",
      // Only persist the data fields, not the action functions
      partialize: (s) => ({
        docType: s.docType,
        senderName: s.senderName,
        senderEmail: s.senderEmail,
        senderAddress: s.senderAddress,
        clientName: s.clientName,
        clientEmail: s.clientEmail,
        clientAddress: s.clientAddress,
        invoiceNumber: s.invoiceNumber,
        issueDate: s.issueDate,
        dueDate: s.dueDate,
        currency: s.currency,
        items: s.items,
        taxRate: s.taxRate,
        discountPercent: s.discountPercent,
        shipping: s.shipping,
        amountPaid: s.amountPaid,
        notes: s.notes,
        logoDataUrl: s.logoDataUrl,
      }),
    }
  )
);

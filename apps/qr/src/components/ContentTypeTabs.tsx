import { useCallback, useEffect, useState } from "react";
import type {
  ContentType,
  EmailFields,
  PhoneFields,
  SmsFields,
  VCardFields,
  WifiFields,
} from "../lib/templates";
import {
  CONTENT_TYPE_LABELS,
  buildEmailPayload,
  buildPhonePayload,
  buildSmsPayload,
  buildVCardPayload,
  buildWifiPayload,
} from "../lib/templates";

interface ContentTypeTabsProps {
  activeType: ContentType;
  onTypeChange: (type: ContentType) => void;
  onPayload: (payload: string) => void;
  /** Raw text value (used to keep URL tab in sync with manual edits). */
  rawText: string;
}

const TABS: ContentType[] = ["url", "wifi", "vcard", "email", "sms", "phone"];

// ── Shared field component ────────────────────────────────────────────────────

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "email" | "tel" | "url" | "password";
  placeholder?: string;
  required?: boolean;
}

function Field({ id, label, value, onChange, type = "text", placeholder, required }: FieldProps) {
  return (
    <div className="qr-field-group">
      <label className="qr-field-label" htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        className="qr-template-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}

// ── Template forms ────────────────────────────────────────────────────────────

function WifiForm({ onPayload }: { onPayload: (s: string) => void }) {
  const [fields, setFields] = useState<WifiFields>({
    ssid: "",
    password: "",
    security: "WPA",
    hidden: false,
  });

  const update = useCallback(
    <K extends keyof WifiFields>(key: K, val: WifiFields[K]) => {
      setFields((prev) => {
        const next = { ...prev, [key]: val };
        onPayload(buildWifiPayload(next));
        return next;
      });
    },
    [onPayload]
  );

  // Emit on mount so switching to this tab shows a payload even with blank fields
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional one-time emit
  useEffect(() => {
    onPayload(buildWifiPayload(fields));
  }, []);

  return (
    <div className="qr-template-form">
      <Field
        id="wifi-ssid"
        label="Network name (SSID)"
        value={fields.ssid}
        onChange={(v) => update("ssid", v)}
        placeholder="My Home Network"
        required
      />
      <div className="qr-field-group">
        <span className="qr-field-label">Security</span>
        <div className="qr-ec-row" role="radiogroup" aria-label="WiFi security type">
          {(["WPA", "WEP", "nopass"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={`qr-ec-btn${fields.security === s ? " qr-ec-btn--active" : ""}`}
              onClick={() => update("security", s)}
              aria-pressed={fields.security === s}
            >
              {s === "nopass" ? "None" : s}
            </button>
          ))}
        </div>
      </div>
      {fields.security !== "nopass" && (
        <Field
          id="wifi-password"
          label="Password"
          value={fields.password}
          onChange={(v) => update("password", v)}
          type="password"
          placeholder="network password"
        />
      )}
      <label className="qr-checkbox-label">
        <input
          type="checkbox"
          checked={fields.hidden}
          onChange={(e) => update("hidden", e.target.checked)}
        />
        Hidden network
      </label>
    </div>
  );
}

function VCardForm({ onPayload }: { onPayload: (s: string) => void }) {
  const [fields, setFields] = useState<VCardFields>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    organisation: "",
    url: "",
  });

  const update = useCallback(
    <K extends keyof VCardFields>(key: K, val: string) => {
      setFields((prev) => {
        const next = { ...prev, [key]: val };
        onPayload(buildVCardPayload(next));
        return next;
      });
    },
    [onPayload]
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional one-time emit
  useEffect(() => {
    onPayload(buildVCardPayload(fields));
  }, []);

  return (
    <div className="qr-template-form">
      <div className="qr-template-row">
        <Field
          id="vc-first"
          label="First name"
          value={fields.firstName}
          onChange={(v) => update("firstName", v)}
          placeholder="Jane"
        />
        <Field
          id="vc-last"
          label="Last name"
          value={fields.lastName}
          onChange={(v) => update("lastName", v)}
          placeholder="Doe"
        />
      </div>
      <Field
        id="vc-phone"
        label="Phone"
        value={fields.phone}
        onChange={(v) => update("phone", v)}
        type="tel"
        placeholder="+1 555 123 4567"
      />
      <Field
        id="vc-email"
        label="Email"
        value={fields.email}
        onChange={(v) => update("email", v)}
        type="email"
        placeholder="jane@example.com"
      />
      <Field
        id="vc-org"
        label="Organisation"
        value={fields.organisation}
        onChange={(v) => update("organisation", v)}
        placeholder="Acme Corp"
      />
      <Field
        id="vc-url"
        label="Website"
        value={fields.url}
        onChange={(v) => update("url", v)}
        type="url"
        placeholder="https://example.com"
      />
    </div>
  );
}

function EmailForm({ onPayload }: { onPayload: (s: string) => void }) {
  const [fields, setFields] = useState<EmailFields>({ to: "", subject: "", body: "" });

  const update = useCallback(
    <K extends keyof EmailFields>(key: K, val: string) => {
      setFields((prev) => {
        const next = { ...prev, [key]: val };
        onPayload(buildEmailPayload(next));
        return next;
      });
    },
    [onPayload]
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional one-time emit
  useEffect(() => {
    onPayload(buildEmailPayload(fields));
  }, []);

  return (
    <div className="qr-template-form">
      <Field
        id="em-to"
        label="To"
        value={fields.to}
        onChange={(v) => update("to", v)}
        type="email"
        placeholder="recipient@example.com"
        required
      />
      <Field
        id="em-subject"
        label="Subject"
        value={fields.subject}
        onChange={(v) => update("subject", v)}
        placeholder="Optional subject line"
      />
      <div className="qr-field-group">
        <label className="qr-field-label" htmlFor="em-body">
          Body
        </label>
        <textarea
          id="em-body"
          className="qr-text-input"
          style={{ minHeight: 64 }}
          value={fields.body}
          onChange={(e) => update("body", e.target.value)}
          placeholder="Optional message body"
        />
      </div>
    </div>
  );
}

function SmsForm({ onPayload }: { onPayload: (s: string) => void }) {
  const [fields, setFields] = useState<SmsFields>({ to: "", message: "" });

  const update = useCallback(
    <K extends keyof SmsFields>(key: K, val: string) => {
      setFields((prev) => {
        const next = { ...prev, [key]: val };
        onPayload(buildSmsPayload(next));
        return next;
      });
    },
    [onPayload]
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional one-time emit
  useEffect(() => {
    onPayload(buildSmsPayload(fields));
  }, []);

  return (
    <div className="qr-template-form">
      <Field
        id="sms-to"
        label="Phone number"
        value={fields.to}
        onChange={(v) => update("to", v)}
        type="tel"
        placeholder="+1 555 123 4567"
        required
      />
      <div className="qr-field-group">
        <label className="qr-field-label" htmlFor="sms-body">
          Message
        </label>
        <textarea
          id="sms-body"
          className="qr-text-input"
          style={{ minHeight: 64 }}
          value={fields.message}
          onChange={(e) => update("message", e.target.value)}
          placeholder="Optional pre-filled message"
        />
      </div>
    </div>
  );
}

function PhoneForm({ onPayload }: { onPayload: (s: string) => void }) {
  const [fields, setFields] = useState<PhoneFields>({ number: "" });

  const update = useCallback(
    (val: string) => {
      setFields({ number: val });
      onPayload(buildPhonePayload({ number: val }));
    },
    [onPayload]
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional one-time emit
  useEffect(() => {
    onPayload(buildPhonePayload(fields));
  }, []);

  return (
    <div className="qr-template-form">
      <Field
        id="ph-number"
        label="Phone number"
        value={fields.number}
        onChange={update}
        type="tel"
        placeholder="+1 555 123 4567"
        required
      />
    </div>
  );
}

// ── Main exported component ───────────────────────────────────────────────────

export function ContentTypeTabs({
  activeType,
  onTypeChange,
  onPayload,
  rawText,
}: ContentTypeTabsProps) {
  return (
    <div className="qr-content-type-wrap">
      {/* Tab bar */}
      <div className="qr-type-tabs" role="tablist" aria-label="QR content type">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={activeType === t}
            className={`qr-type-tab${activeType === t ? " qr-type-tab--active" : ""}`}
            onClick={() => onTypeChange(t)}
          >
            {CONTENT_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tab panel */}
      <div role="tabpanel" className="qr-type-panel">
        {activeType === "url" && (
          <div className="qr-field-group">
            <label className="qr-field-label" htmlFor="qr-text">
              URL or text
            </label>
            <textarea
              id="qr-text"
              className="qr-text-input"
              value={rawText}
              onChange={(e) => onPayload(e.target.value)}
              placeholder="https://example.com"
              aria-label="QR code content"
            />
          </div>
        )}
        {activeType === "wifi" && <WifiForm onPayload={onPayload} key="wifi" />}
        {activeType === "vcard" && <VCardForm onPayload={onPayload} key="vcard" />}
        {activeType === "email" && <EmailForm onPayload={onPayload} key="email" />}
        {activeType === "sms" && <SmsForm onPayload={onPayload} key="sms" />}
        {activeType === "phone" && <PhoneForm onPayload={onPayload} key="phone" />}
      </div>
    </div>
  );
}

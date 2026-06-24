import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import {
  HMAC_SIGN_ALGS,
  type HmacSignAlg,
  type JwtPayload,
  type VerifyResult,
  decodeErrorMessage,
  decodeJwt,
  formatUnixTimestamp,
  getExpiryStatus,
  isAsymmetricAlg,
  relativeTime,
  signJwt,
  verifyAsymmetricSignature,
  verifyHmacSignature,
} from "./lib/jwt";
import { useJwtStore } from "./store/jwtStore";

// A valid HS256 token (secret: "your-256-bit-secret"), exp far in the future
const SAMPLE_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +
  ".eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkphbmUgRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9" +
  ".ikBKG65h42nupXVFKK_FTt6Rt4EqR2caklTK-PdDtVI";
const SAMPLE_SECRET = "your-256-bit-secret";

// ── Brand mark glyph (three JWT segments as coloured pills) ──────────────────

function JwtBrandGlyph() {
  return (
    <>
      {/* Header: teal stroke pill */}
      <rect
        x="2"
        y="12.5"
        width="8"
        height="7"
        rx="3.5"
        stroke="#2f9d8d"
        strokeWidth="2.3"
        strokeLinejoin="round"
      />
      {/* Separator dot */}
      <circle cx="11.5" cy="16" r="1.5" fill="#2f9d8d" />
      {/* Payload: amber stroke pill */}
      <rect
        x="13"
        y="12.5"
        width="6"
        height="7"
        rx="3"
        stroke="#e8b04b"
        strokeWidth="2.3"
        strokeLinejoin="round"
      />
      {/* Separator dot */}
      <circle cx="20.5" cy="16" r="1.5" fill="#e8b04b" />
      {/* Signature: coral stroke pill */}
      <rect
        x="22"
        y="12.5"
        width="8"
        height="7"
        rx="3.5"
        stroke="#d9594c"
        strokeWidth="2.3"
        strokeLinejoin="round"
      />
    </>
  );
}

// ── Coloured token display ───────────────────────────────────────────────────

interface TokenDisplayProps {
  token: string;
}

function TokenDisplay({ token }: TokenDisplayProps) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return (
      <span
        style={{ fontFamily: "var(--font-mono)", color: "var(--ink-mid)", wordBreak: "break-all" }}
      >
        {token}
      </span>
    );
  }
  const [header, payload, sig] = parts as [string, string, string];
  return (
    <span style={{ fontFamily: "var(--font-mono)", wordBreak: "break-all", fontSize: "0.8rem" }}>
      <span style={{ color: "#2f9d8d" }}>{header}</span>
      <span style={{ color: "var(--ink-faint)" }}>.</span>
      <span style={{ color: "#e8b04b" }}>{payload}</span>
      <span style={{ color: "var(--ink-faint)" }}>.</span>
      <span style={{ color: "#d9594c" }}>{sig}</span>
    </span>
  );
}

// ── Copy button ──────────────────────────────────────────────────────────────

interface CopyButtonProps {
  text: string;
  label: string;
}

function CopyButton({ text, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable in some contexts
    }
  }, [text]);

  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={() => void handleCopy()}
      aria-label={label}
      title={copied ? "Copied!" : label}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ── JSON pretty printer ──────────────────────────────────────────────────────

interface JsonBlockProps {
  value: Record<string, unknown>;
}

function JsonBlock({ value }: JsonBlockProps) {
  return (
    <pre
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "0.78rem",
        lineHeight: 1.6,
        background: "var(--surface-sunken)",
        borderRadius: "var(--radius-sm)",
        padding: "1rem",
        overflowX: "auto",
        margin: 0,
        color: "var(--ink)",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
      }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

// ── Standard claim rows ──────────────────────────────────────────────────────

const TIMESTAMP_CLAIMS = ["exp", "iat", "nbf"] as const;
type TimestampClaim = (typeof TIMESTAMP_CLAIMS)[number];

const CLAIM_LABELS: Record<string, string> = {
  iss: "Issuer",
  sub: "Subject",
  aud: "Audience",
  exp: "Expires",
  nbf: "Not before",
  iat: "Issued at",
  jti: "JWT ID",
};

function isTimestampClaim(key: string): key is TimestampClaim {
  return TIMESTAMP_CLAIMS.includes(key as TimestampClaim);
}

/** Humanize a timestamp claim: "Jan 18 2018, 2 years ago" */
function TimestampValue({ epoch, claimKey }: { epoch: number; claimKey: string }) {
  const humanDate = formatUnixTimestamp(epoch);
  const rel = relativeTime(epoch);
  return (
    <span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>{humanDate}</span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.66rem",
          color: claimKey === "exp" ? undefined : "var(--ink-faint)",
          marginLeft: "0.5rem",
        }}
      >
        {rel}
      </span>
    </span>
  );
}

/** Prominent expiry status badge with humanized time delta. */
function ExpiryBadge({ payload }: { payload: JwtPayload }) {
  const status = getExpiryStatus(payload);
  let detail = "";
  if (status === "expired" && typeof payload.exp === "number") {
    detail = relativeTime(payload.exp); // "3 years ago"
  } else if (status === "valid" && typeof payload.exp === "number") {
    detail = relativeTime(payload.exp); // "in 6 hours"
  } else if (status === "not-yet-valid" && typeof payload.nbf === "number") {
    detail = relativeTime(payload.nbf); // "in 2 days"
  }
  // Suppress detail if it echoes "0 seconds ago" (edge case)
  if (detail === "0 seconds ago" || detail === "in 0 seconds") detail = "";

  return (
    <span
      className={`jwt-badge jwt-badge--${status}`}
      aria-label={`Token status: ${status.replace(/-/g, " ")}`}
    >
      {status === "valid" && "Valid"}
      {status === "expired" && "Expired"}
      {status === "not-yet-valid" && "Not yet valid"}
      {status === "no-expiry" && "No expiry"}
      {detail && (
        <span style={{ marginLeft: "0.45em", opacity: 0.8, fontWeight: 400 }}>{detail}</span>
      )}
    </span>
  );
}

interface ClaimsTableProps {
  payload: JwtPayload;
}

function ClaimsTable({ payload }: ClaimsTableProps) {
  const standardKeys = Object.keys(CLAIM_LABELS).filter((k) => k in payload);
  if (standardKeys.length === 0) return null;

  return (
    <div className="jwt-claims-table">
      {standardKeys.map((key) => {
        const raw = payload[key];
        const isTs = isTimestampClaim(key);

        return (
          <div key={key} className="jwt-claim-row">
            <span className="jwt-claim-key mono-label">{CLAIM_LABELS[key] ?? key}</span>
            <span className="jwt-claim-value">
              {isTs && typeof raw === "number" ? (
                <TimestampValue epoch={raw} claimKey={key} />
              ) : (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                  {Array.isArray(raw) ? raw.join(", ") : String(raw)}
                </span>
              )}
            </span>
          </div>
        );
      })}

      {/* Expiry badge row */}
      <div className="jwt-claim-row">
        <span className="jwt-claim-key mono-label">Status</span>
        <span className="jwt-claim-value">
          <ExpiryBadge payload={payload} />
        </span>
      </div>
    </div>
  );
}

// ── Segment panel ────────────────────────────────────────────────────────────

interface SegmentPanelProps {
  label: string;
  accent: string;
  data: Record<string, unknown>;
  copyText: string;
  children?: React.ReactNode;
}

function SegmentPanel({ label, accent, data, copyText, children }: SegmentPanelProps) {
  return (
    <div className="jwt-segment-panel" style={{ borderTopColor: accent }}>
      <div className="jwt-segment-header">
        <span className="mono-label" style={{ color: accent }}>
          {label}
        </span>
        <CopyButton text={copyText} label={`Copy ${label} JSON`} />
      </div>
      <JsonBlock value={data} />
      {children}
    </div>
  );
}

// ── Signature panel ──────────────────────────────────────────────────────────

const HMAC_ALGS = ["HS256", "HS384", "HS512"];

interface SignaturePanelProps {
  headerB64: string;
  payloadB64: string;
  sig: string;
  alg?: string;
}

function SignaturePanel({ headerB64, payloadB64, sig, alg }: SignaturePanelProps) {
  const [secret, setSecret] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const isHmac = alg !== undefined && HMAC_ALGS.includes(alg);
  const isAsym = alg !== undefined && isAsymmetricAlg(alg);
  const canVerify = isHmac || isAsym;

  // Reset verification state when token changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset
  useEffect(() => {
    setVerifyResult(null);
  }, [headerB64, payloadB64, sig]);

  const handleVerify = useCallback(async () => {
    if (!alg) return;
    setVerifying(true);
    setVerifyResult(null);
    let result: VerifyResult;
    if (isHmac) {
      result = await verifyHmacSignature(headerB64, payloadB64, sig, secret, alg);
    } else {
      result = await verifyAsymmetricSignature(headerB64, payloadB64, sig, publicKey, alg);
    }
    setVerifyResult(result);
    setVerifying(false);
  }, [headerB64, payloadB64, sig, secret, publicKey, alg, isHmac]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void handleVerify();
      }
    },
    [handleVerify]
  );

  return (
    <div className="jwt-segment-panel" style={{ borderTopColor: "#d9594c" }}>
      <div className="jwt-segment-header">
        <span className="mono-label" style={{ color: "#d9594c" }}>
          Signature
        </span>
        <CopyButton text={sig} label="Copy signature" />
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.78rem",
          background: "var(--surface-sunken)",
          borderRadius: "var(--radius-sm)",
          padding: "1rem",
          wordBreak: "break-all",
          color: "#d9594c",
        }}
      >
        {sig}
      </div>

      {/* Verification section */}
      {canVerify ? (
        <div className="jwt-verify-section">
          <span className="mono-label">Verify signature</span>
          {isHmac ? (
            <div className="jwt-verify-row">
              <input
                className="jwt-secret-input"
                type="text"
                placeholder={`${alg} secret key`}
                value={secret}
                onChange={(e) => {
                  setSecret(e.target.value);
                  setVerifyResult(null);
                }}
                onKeyDown={handleKeyDown}
                autoComplete="off"
                spellCheck={false}
                aria-label="HMAC secret key"
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void handleVerify()}
                disabled={verifying || secret.trim() === ""}
              >
                {verifying ? "Checking..." : "Verify"}
              </button>
            </div>
          ) : (
            <div className="jwt-verify-col">
              <textarea
                className="jwt-textarea jwt-pubkey-textarea"
                placeholder={`Paste ${alg} public key (PEM, -----BEGIN PUBLIC KEY-----)`}
                value={publicKey}
                onChange={(e) => {
                  setPublicKey(e.target.value);
                  setVerifyResult(null);
                }}
                onKeyDown={handleKeyDown}
                autoComplete="off"
                spellCheck={false}
                aria-label="Public key PEM"
                rows={5}
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => void handleVerify()}
                  disabled={verifying || publicKey.trim() === ""}
                >
                  {verifying ? "Checking..." : "Verify with public key"}
                </button>
              </div>
            </div>
          )}
          {verifyResult && (
            <output
              className={`jwt-verify-result jwt-verify-result--${verifyResult.status}`}
              aria-live="polite"
            >
              {verifyResult.status === "valid" && "Signature is valid"}
              {verifyResult.status === "invalid" && "Signature is invalid"}
              {verifyResult.status === "error" && `Error: ${verifyResult.message}`}
              {verifyResult.status === "unsupported" &&
                `${verifyResult.alg} verification is not supported in-browser`}
            </output>
          )}
        </div>
      ) : (
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.64rem",
            color: "var(--ink-faint)",
            marginTop: "0.75rem",
          }}
        >
          Algorithm: {alg ?? "unknown"} · Signature verification requires the server-side key.
        </p>
      )}
    </div>
  );
}

// ── JWT Encoder / Signer ─────────────────────────────────────────────────────

const DEFAULT_PAYLOAD = JSON.stringify(
  {
    sub: "1234567890",
    name: "Jane Doe",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  },
  null,
  2
);

function EncoderPanel({ onTokenGenerated }: { onTokenGenerated: (token: string) => void }) {
  const [payloadText, setPayloadText] = useState(DEFAULT_PAYLOAD);
  const [secret, setSecret] = useState("");
  const [alg, setAlg] = useState<HmacSignAlg>("HS256");
  const [result, setResult] = useState<
    { ok: true; token: string } | { ok: false; error: string } | null
  >(null);
  const [signing, setSigning] = useState(false);
  const [payloadError, setPayloadError] = useState<string | null>(null);

  const validatePayload = useCallback((text: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setPayloadError("Payload must be a JSON object.");
        return null;
      }
      setPayloadError(null);
      return parsed as Record<string, unknown>;
    } catch {
      setPayloadError("Invalid JSON.");
      return null;
    }
  }, []);

  const handleSign = useCallback(async () => {
    const payload = validatePayload(payloadText);
    if (!payload || !secret.trim()) return;
    setSigning(true);
    setResult(null);
    const r = await signJwt(payload, secret, alg);
    setResult(r);
    setSigning(false);
    if (r.ok) {
      onTokenGenerated(r.token);
    }
  }, [payloadText, secret, alg, validatePayload, onTokenGenerated]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void handleSign();
      }
    },
    [handleSign]
  );

  return (
    <div className="card">
      <h2 className="jwt-section-heading">Encode / Sign</h2>

      <div className="jwt-encode-grid">
        {/* Payload editor */}
        <div>
          <label
            className="mono-label"
            htmlFor="jwt-encode-payload"
            style={{ display: "block", marginBottom: "0.4rem" }}
          >
            Payload (JSON)
          </label>
          <textarea
            id="jwt-encode-payload"
            className={`jwt-textarea${payloadError ? " jwt-textarea--error" : ""}`}
            value={payloadText}
            onChange={(e) => {
              setPayloadText(e.target.value);
              validatePayload(e.target.value);
              setResult(null);
            }}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
            rows={7}
            aria-label="JWT payload JSON"
          />
          {payloadError && (
            <p className="jwt-error" role="alert">
              {payloadError}
            </p>
          )}
        </div>

        {/* Algorithm + secret */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div>
            <span className="mono-label" style={{ display: "block", marginBottom: "0.4rem" }}>
              Algorithm
            </span>
            <fieldset
              className="space-toggle"
              style={{ border: "none", padding: 0 }}
              aria-label="Signing algorithm"
            >
              {HMAC_SIGN_ALGS.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`space-btn${alg === a ? " space-btn--active" : ""}`}
                  onClick={() => {
                    setAlg(a);
                    setResult(null);
                  }}
                  aria-pressed={alg === a}
                >
                  {a}
                </button>
              ))}
            </fieldset>
          </div>

          <div>
            <label
              className="mono-label"
              htmlFor="jwt-encode-secret"
              style={{ display: "block", marginBottom: "0.4rem" }}
            >
              Secret key
            </label>
            <input
              id="jwt-encode-secret"
              className="jwt-secret-input"
              type="text"
              placeholder="your-256-bit-secret"
              value={secret}
              onChange={(e) => {
                setSecret(e.target.value);
                setResult(null);
              }}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              spellCheck={false}
              aria-label="HMAC signing secret"
              style={{ width: "100%" }}
            />
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={() => void handleSign()}
            disabled={signing || !secret.trim() || !!payloadError}
            style={{ alignSelf: "flex-start" }}
            title="Sign JWT (Cmd/Ctrl+Enter)"
          >
            {signing ? "Signing..." : "Sign JWT"}
          </button>
        </div>
      </div>

      {result && (
        <div style={{ marginTop: "1rem" }}>
          {result.ok ? (
            <div className="jwt-encode-result">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "0.4rem",
                }}
              >
                <span className="mono-label" style={{ color: "#2f9d8d" }}>
                  Signed token
                </span>
                <CopyButton text={result.token} label="Copy signed token" />
              </div>
              <div className="jwt-token-preview">
                <TokenDisplay token={result.token} />
              </div>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.64rem",
                  color: "var(--ink-faint)",
                  marginTop: "0.5rem",
                }}
              >
                Token loaded into decoder above.
              </p>
            </div>
          ) : (
            <p className="jwt-error" role="alert">
              {result.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

type ActiveTab = "decode" | "encode";

export function App() {
  const { rawToken, setRawToken, clearToken } = useJwtStore();
  const [activeTab, setActiveTab] = useState<ActiveTab>("decode");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const result = rawToken.trim() ? decodeJwt(rawToken) : null;
  const hasParsed = result?.ok === true;

  const loadSample = useCallback(() => {
    setRawToken(SAMPLE_TOKEN);
  }, [setRawToken]);

  // Cmd/Ctrl+Enter from the main textarea doesn't need to do anything special
  // since decoding is live; but we wire it anyway to match fleet convention.
  const handleTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      // Decoding is reactive; just blur to signal intent
      textareaRef.current?.blur();
    }
  }, []);

  return (
    <div className="app-root">
      <Header
        title="JWT Decoder"
        subtitle="decode, inspect &amp; sign json web tokens — free, in-browser, no upload"
        brandMark={
          <BrandMark label="JWT Decoder">
            <JwtBrandGlyph />
          </BrandMark>
        }
      />

      <main className="site-main">
        {/* Tab switcher */}
        <div className="jwt-tabs">
          <div className="space-toggle" role="tablist" aria-label="Tool mode">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "decode"}
              className={`space-btn${activeTab === "decode" ? " space-btn--active" : ""}`}
              onClick={() => setActiveTab("decode")}
            >
              Decode
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "encode"}
              className={`space-btn${activeTab === "encode" ? " space-btn--active" : ""}`}
              onClick={() => setActiveTab("encode")}
            >
              Encode / Sign
            </button>
          </div>
        </div>

        {activeTab === "decode" ? (
          <>
            {/* Input card */}
            <div className="card">
              <div className="jwt-input-header">
                <label className="mono-label" htmlFor="jwt-input">
                  Paste your JWT
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {!rawToken && (
                    <button
                      type="button"
                      className="btn-secondary jwt-clear-btn"
                      onClick={loadSample}
                      title="Load a sample HS256 token"
                    >
                      Try sample
                    </button>
                  )}
                  {rawToken && (
                    <button
                      type="button"
                      className="btn-secondary jwt-clear-btn"
                      onClick={clearToken}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <textarea
                id="jwt-input"
                ref={textareaRef}
                className="jwt-textarea"
                value={rawToken}
                onChange={(e) => setRawToken(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                aria-label="JWT token input"
                rows={4}
              />

              {/* Coloured token preview */}
              {rawToken.trim() && (
                <div className="jwt-token-preview">
                  <TokenDisplay token={rawToken.trim()} />
                </div>
              )}

              {/* Parse error */}
              {result && !result.ok && (
                <p className="jwt-error" role="alert">
                  {decodeErrorMessage(result.error)}
                </p>
              )}

              {/* Sample token hint */}
              {!rawToken && (
                <p className="jwt-sample-hint">
                  No token? Click <strong>Try sample</strong> to load an example HS256 token.
                  Secret: <code>{SAMPLE_SECRET}</code>
                </p>
              )}
            </div>

            {/* Decoded output */}
            {hasParsed && result.ok && (
              <>
                {/* Claims summary */}
                <div className="card">
                  <h2 className="jwt-section-heading">Claims</h2>
                  <ClaimsTable payload={result.value.payload} />
                </div>

                {/* Header */}
                <SegmentPanel
                  label="Header"
                  accent="#2f9d8d"
                  data={result.value.header as Record<string, unknown>}
                  copyText={JSON.stringify(result.value.header, null, 2)}
                />

                {/* Payload */}
                <SegmentPanel
                  label="Payload"
                  accent="#e8b04b"
                  data={result.value.payload as Record<string, unknown>}
                  copyText={JSON.stringify(result.value.payload, null, 2)}
                />

                {/* Signature */}
                <SignaturePanel
                  headerB64={result.value.segments.header}
                  payloadB64={result.value.segments.payload}
                  sig={result.value.segments.signature}
                  alg={result.value.header.alg}
                />
              </>
            )}
          </>
        ) : (
          <EncoderPanel
            onTokenGenerated={(token) => {
              setRawToken(token);
              setActiveTab("decode");
            }}
          />
        )}

        <p className="jwt-privacy-note">
          Your token never leaves your browser. All decoding and signing runs locally in JS.
        </p>
      </main>

      <Footer blurb="Runs entirely in your browser. Your tokens are never uploaded." />
    </div>
  );
}

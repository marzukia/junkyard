import { useCallback, useEffect, useRef, useState } from "react";
import { useCmdEnter } from "./components/useCmdEnter";
import { BrandMark } from "./components/BrandMark";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import {
  entropyToCrackTime,
  entropyToStrength,
  generatePassphrase,
  generatePassword,
  passphraseEntropy,
  passwordEntropy,
} from "./lib/password";
import { WORD_LIST } from "./lib/wordlist";
import { usePasswordStore } from "./store/passwordStore";

// ── Brand glyph, minimalist key / lock mark in brand palette ─────────────────
// No coloured background square; clean flat geometry on transparent.

function PasswordBrandGlyph() {
  return (
    <>
      {/* Lock shackle, teal stroke */}
      <path
        d="M11 16v-4.5a5 5 0 0 1 10 0V16"
        stroke="#2f9d8d"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Lock body, teal stroke outline */}
      <rect
        x="7.5"
        y="15.5"
        width="17"
        height="12"
        rx="2.2"
        stroke="#2f9d8d"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Keyhole circle, coral */}
      <circle cx="16" cy="20.5" r="2" fill="#d9594c" />
      {/* Keyhole slot */}
      <rect x="15.1" y="22" width="1.8" height="2.8" rx="0.5" fill="#d9594c" />
      {/* Password character dots, amber accent */}
      <circle cx="11" cy="20.5" r="1.3" fill="#e8b04b" />
      <circle cx="21" cy="20.5" r="1.3" fill="#e8b04b" />
    </>
  );
}

// ── Strength meter ─────────────────────────────────────────────────────────────

interface StrengthMeterProps {
  bits: number;
}

const STRENGTH_COLORS = ["#d9594c", "#e8b04b", "#e8b04b", "#2f9d8d", "#2f9d8d"] as const;

function StrengthMeter({ bits }: StrengthMeterProps) {
  const result = entropyToStrength(bits);
  const pct = Math.min(100, (bits / 120) * 100);
  const color = STRENGTH_COLORS[result.score];
  const crackTime = entropyToCrackTime(bits);

  return (
    <div className="pw-strength">
      <div
        className="pw-strength-bar-wrap"
        role="meter"
        aria-valuenow={Math.round(bits)}
        aria-valuemin={0}
        aria-valuemax={128}
        aria-label="Password strength"
      >
        <div className="pw-strength-bar" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="pw-strength-row">
        <span className="pw-strength-label" style={{ color }}>
          {result.label}
        </span>
        <span className="pw-entropy-badge">{Math.round(bits)} bits</span>
      </div>
      {bits > 0 && (
        <p className="pw-crack-time">
          ~{crackTime} to brute-force at 10<sup>12</sup> guesses/sec
        </p>
      )}
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text, label, compact }: { text: string; label?: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(() => {
    if (!text) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    });
  }, [text]);

  return (
    <button
      type="button"
      className={`pw-copy-btn${copied ? " pw-copy-btn--copied" : ""}${compact ? " pw-copy-btn--compact" : ""}`}
      onClick={copy}
      aria-label={label ?? "Copy to clipboard"}
      title={copied ? "Copied!" : "Copy"}
    >
      {copied ? (
        <>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <span className="pw-copy-label" aria-hidden="true">
            Copied!
          </span>
        </>
      ) : (
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

// ── Download button ───────────────────────────────────────────────────────────

function DownloadButton({ passwords }: { passwords: string[] }) {
  const download = useCallback(() => {
    const content = passwords.join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "passwords.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [passwords]);

  return (
    <button
      type="button"
      className="pw-copy-btn"
      onClick={download}
      aria-label="Download passwords as text file"
      title="Download .txt"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    </button>
  );
}

// ── Password list item ────────────────────────────────────────────────────────

function PasswordRow({ value, index, bits }: { value: string; index: number; bits: number }) {
  const strength = entropyToStrength(bits);
  const color = STRENGTH_COLORS[strength.score];

  return (
    <div className="pw-row">
      <span className="pw-row-index">{index + 1}</span>
      <code className="pw-row-value">{value}</code>
      <span className="pw-row-strength" style={{ color }} title={`${Math.round(bits)} bits`}>
        {strength.label}
      </span>
      <CopyButton compact text={value} label={`Copy password ${index + 1}`} />
    </div>
  );
}

// ── Checkbox toggle ───────────────────────────────────────────────────────────

function CheckToggle({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`pw-check${disabled ? " pw-check--disabled" : ""}`} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="pw-check-input"
      />
      <span className="pw-check-box" aria-hidden="true" />
      <span className="pw-check-label">{label}</span>
    </label>
  );
}

// ── Preset definitions ────────────────────────────────────────────────────────

type Preset = {
  label: string;
  title: string;
  apply: (store: ReturnType<typeof usePasswordStore.getState>) => void;
};

// These functions are called with setters from the store to apply the preset.
// Defined outside component so they don't recreate on every render.
const PRESETS: Preset[] = [
  {
    label: "PIN",
    title: "4-digit PIN",
    apply: (s) => {
      s.setMode("random");
      s.setLength(4);
      s.setUpper(false);
      s.setLower(false);
      s.setDigits(true);
      s.setSymbols(false);
      s.setExcludeAmbiguous(false);
      s.setMinDigits(0);
      s.setMinSymbols(0);
    },
  },
  {
    label: "Easy read",
    title: "No ambiguous chars, letters + digits",
    apply: (s) => {
      s.setMode("random");
      s.setLength(16);
      s.setUpper(true);
      s.setLower(true);
      s.setDigits(true);
      s.setSymbols(false);
      s.setExcludeAmbiguous(true);
      s.setMinDigits(0);
      s.setMinSymbols(0);
    },
  },
  {
    label: "Strong",
    title: "20 chars, all sets",
    apply: (s) => {
      s.setMode("random");
      s.setLength(20);
      s.setUpper(true);
      s.setLower(true);
      s.setDigits(true);
      s.setSymbols(true);
      s.setExcludeAmbiguous(false);
      s.setMinDigits(2);
      s.setMinSymbols(2);
    },
  },
];

// ── Main App ──────────────────────────────────────────────────────────────────

export function App() {
  const store = usePasswordStore();
  const {
    mode,
    length,
    upper,
    lower,
    digits,
    symbols,
    excludeAmbiguous,
    minDigits,
    minSymbols,
    wordCount,
    separator,
    capitalize,
    appendNumber,
    count,
    setMode,
    setLength,
    setUpper,
    setLower,
    setDigits,
    setSymbols,
    setExcludeAmbiguous,
    setMinDigits,
    setMinSymbols,
    setWordCount,
    setSeparator,
    setCapitalize,
    setAppendNumber,
    setCount,
    passwordOptions,
    passphraseOpts,
  } = store;

  const [passwords, setPasswords] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const hasAtLeastOne = upper || lower || digits || symbols;

  const generate = useCallback(() => {
    setError(null);
    try {
      const results: string[] = [];
      for (let i = 0; i < count; i++) {
        if (mode === "random") {
          results.push(generatePassword(passwordOptions()));
        } else {
          results.push(
            generatePassphrase({
              ...passphraseOpts(),
              wordList: WORD_LIST,
            })
          );
        }
      }
      setPasswords(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    }
    // Include concrete option values so changing length/charsets/passphrase settings
    // gives `generate` a new identity and triggers the auto-generate effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, count, length, upper, lower, digits, symbols, excludeAmbiguous, minDigits, minSymbols, wordCount, separator, capitalize, appendNumber]);

  // Auto-generate on settings change.
  useEffect(() => {
    if (mode === "random" && !hasAtLeastOne) {
      setPasswords([]);
      return;
    }
    generate();
  }, [generate, mode, hasAtLeastOne]);

  // Cmd/Ctrl+Enter regenerates.
  useCmdEnter(() => {
    if (!(mode === "random" && !hasAtLeastOne)) generate();
  });

  // Entropy for the current settings.
  const bits =
    mode === "random"
      ? passwordEntropy(passwordOptions())
      : passphraseEntropy(wordCount, WORD_LIST.length);

  const applyPreset = useCallback((preset: Preset) => {
    preset.apply(usePasswordStore.getState());
  }, []);

  const modeToggle = (
    <div className="space-toggle-wrapper">
      <div className="space-toggle" aria-label="Generator mode">
        <button
          type="button"
          className={`space-btn${mode === "random" ? " space-btn--active" : ""}`}
          onClick={() => setMode("random")}
          aria-pressed={mode === "random"}
        >
          Random
        </button>
        <button
          type="button"
          className={`space-btn${mode === "passphrase" ? " space-btn--active" : ""}`}
          onClick={() => setMode("passphrase")}
          aria-pressed={mode === "passphrase"}
        >
          Passphrase
        </button>
      </div>
    </div>
  );

  return (
    <div className="app-root">
      <Header
        title="Password Generator"
        subtitle="strong random passwords &amp; passphrases, free, in-browser, private"
        brandMark={
          <BrandMark label="Password Generator">
            <PasswordBrandGlyph />
          </BrandMark>
        }
        controls={modeToggle}
      />

      <main className="site-main">
        <div className="pw-layout">
          {/* Settings panel */}
          <div className="card pw-settings">
            <p className="mono-label">Settings</p>

            {mode === "random" ? (
              <div className="pw-fields">
                {/* Presets */}
                <div className="pw-field-group">
                  <span className="pw-field-label">Presets</span>
                  <div className="pw-presets">
                    {PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        className="pw-preset-btn"
                        title={preset.title}
                        onClick={() => applyPreset(preset)}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Length slider */}
                <div className="pw-field-group">
                  <div className="pw-field-header">
                    <label className="pw-field-label" htmlFor="pw-length">
                      Length
                    </label>
                    <input
                      type="number"
                      className="pw-length-num"
                      min={4}
                      max={72}
                      value={length}
                      onChange={(e) => {
                        const v = Math.max(4, Math.min(72, Number(e.target.value)));
                        if (!Number.isNaN(v)) setLength(v);
                      }}
                      aria-label="Password length (4-72)"
                    />
                  </div>
                  <input
                    id="pw-length"
                    type="range"
                    min={4}
                    max={72}
                    value={length}
                    onChange={(e) => setLength(Number(e.target.value))}
                    className="pw-slider"
                    aria-valuemin={4}
                    aria-valuemax={72}
                    aria-valuenow={length}
                  />
                  <div className="pw-slider-labels">
                    <span>4</span>
                    <span>72</span>
                  </div>
                </div>

                {/* Character sets */}
                <div className="pw-field-group">
                  <span className="pw-field-label">Characters</span>
                  <div className="pw-checks">
                    <CheckToggle
                      id="pw-upper"
                      label="Uppercase (A-Z)"
                      checked={upper}
                      onChange={setUpper}
                      disabled={upper && !lower && !digits && !symbols}
                    />
                    <CheckToggle
                      id="pw-lower"
                      label="Lowercase (a-z)"
                      checked={lower}
                      onChange={setLower}
                      disabled={lower && !upper && !digits && !symbols}
                    />
                    <CheckToggle
                      id="pw-digits"
                      label="Digits (0-9)"
                      checked={digits}
                      onChange={setDigits}
                      disabled={digits && !upper && !lower && !symbols}
                    />
                    <CheckToggle
                      id="pw-symbols"
                      label="Symbols (!@#...)"
                      checked={symbols}
                      onChange={setSymbols}
                      disabled={symbols && !upper && !lower && !digits}
                    />
                  </div>
                </div>

                {/* Min constraints */}
                {(digits || symbols) && (
                  <div className="pw-field-group">
                    <span className="pw-field-label">Minimums</span>
                    <div className="pw-minimums">
                      {digits && (
                        <label className="pw-min-label" htmlFor="pw-min-digits">
                          <span className="pw-check-label">Min digits</span>
                          <input
                            id="pw-min-digits"
                            type="number"
                            className="pw-min-input"
                            min={0}
                            max={Math.max(0, length - 1)}
                            value={minDigits}
                            onChange={(e) => {
                              const v = Math.max(0, Math.min(length - 1, Number(e.target.value)));
                              if (!Number.isNaN(v)) setMinDigits(v);
                            }}
                          />
                        </label>
                      )}
                      {symbols && (
                        <label className="pw-min-label" htmlFor="pw-min-symbols">
                          <span className="pw-check-label">Min symbols</span>
                          <input
                            id="pw-min-symbols"
                            type="number"
                            className="pw-min-input"
                            min={0}
                            max={Math.max(0, length - 1)}
                            value={minSymbols}
                            onChange={(e) => {
                              const v = Math.max(0, Math.min(length - 1, Number(e.target.value)));
                              if (!Number.isNaN(v)) setMinSymbols(v);
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {/* Exclude ambiguous */}
                <div className="pw-field-group">
                  <span className="pw-field-label">Options</span>
                  <CheckToggle
                    id="pw-ambig"
                    label="Exclude ambiguous (I, l, O, 0, 1)"
                    checked={excludeAmbiguous}
                    onChange={setExcludeAmbiguous}
                  />
                </div>
              </div>
            ) : (
              <div className="pw-fields">
                {/* Word count */}
                <div className="pw-field-group">
                  <div className="pw-field-header">
                    <label className="pw-field-label" htmlFor="pw-word-count">
                      Word count
                    </label>
                    <span className="pw-field-value">{wordCount}</span>
                  </div>
                  <input
                    id="pw-word-count"
                    type="range"
                    min={3}
                    max={10}
                    value={wordCount}
                    onChange={(e) => setWordCount(Number(e.target.value))}
                    className="pw-slider"
                    aria-valuemin={3}
                    aria-valuemax={10}
                    aria-valuenow={wordCount}
                  />
                  <div className="pw-slider-labels">
                    <span>3</span>
                    <span>10</span>
                  </div>
                </div>

                {/* Separator */}
                <div className="pw-field-group">
                  <label className="pw-field-label" htmlFor="pw-separator">
                    Separator
                  </label>
                  <input
                    id="pw-separator"
                    type="text"
                    value={separator}
                    maxLength={4}
                    onChange={(e) => setSeparator(e.target.value)}
                    className="pw-sep-input"
                    aria-label="Word separator"
                    placeholder="-"
                  />
                </div>

                {/* Passphrase options */}
                <div className="pw-field-group">
                  <span className="pw-field-label">Options</span>
                  <div className="pw-checks">
                    <CheckToggle
                      id="pw-capitalize"
                      label="Capitalize words"
                      checked={capitalize}
                      onChange={setCapitalize}
                    />
                    <CheckToggle
                      id="pw-append-number"
                      label="Append number (e.g. ...42)"
                      checked={appendNumber}
                      onChange={setAppendNumber}
                    />
                  </div>
                </div>

                <p className="pw-passphrase-info">Word list: {WORD_LIST.length} words</p>
              </div>
            )}

            {/* Count */}
            <div className="pw-field-group">
              <div className="pw-field-header">
                <label className="pw-field-label" htmlFor="pw-count">
                  Generate
                </label>
                <span className="pw-field-value">{count}</span>
              </div>
              <input
                id="pw-count"
                type="range"
                min={1}
                max={20}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="pw-slider"
                aria-valuemin={1}
                aria-valuemax={20}
                aria-valuenow={count}
              />
              <div className="pw-slider-labels">
                <span>1</span>
                <span>20</span>
              </div>
            </div>

            {/* Strength meter */}
            <StrengthMeter bits={bits} />

            {error && <p className="pw-error">{error}</p>}
          </div>

          {/* Output panel */}
          <div className="card pw-output">
            <div className="pw-output-header">
              <p className="mono-label">Generated</p>
              <div className="pw-output-actions">
                {passwords.length > 1 && (
                  <>
                    <CopyButton text={passwords.join("\n")} label="Copy all passwords" />
                    <DownloadButton passwords={passwords} />
                  </>
                )}
                <button
                  type="button"
                  className="btn-primary"
                  onClick={generate}
                  disabled={mode === "random" && !hasAtLeastOne}
                  aria-label="Regenerate passwords (Ctrl+Enter)"
                  title="Regenerate (Ctrl+Enter / Cmd+Enter)"
                >
                  Regenerate
                </button>
              </div>
            </div>

            {passwords.length > 0 ? (
              <div className="pw-list" aria-label="Generated passwords">
                {passwords.map((pw, i) => (
                  // Using index is fine: list length is fixed per render batch
                  // biome-ignore lint/suspicious/noArrayIndexKey: stable fixed-length list
                  <PasswordRow key={i} value={pw} index={i} bits={bits} />
                ))}
              </div>
            ) : (
              <div className="pw-empty">
                <svg width="36" height="36" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                  <PasswordBrandGlyph />
                </svg>
                <span>Select at least one character set</span>
              </div>
            )}
          </div>
        </div>

        <p className="pw-footer-note">
          All passwords are generated in your browser using <code>crypto.getRandomValues</code>, no
          data is ever sent anywhere.
        </p>
      </main>

      <Footer blurb="Runs entirely in your browser. No passwords leave your device." />
    </div>
  );
}

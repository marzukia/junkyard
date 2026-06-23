import { useCallback, useEffect, useRef, useState } from "react";
import { DETECT_CODE, type Language } from "../lib/languages";

/** Synthetic entry prepended to the source-language list. */
const DETECT_OPTION: Language = {
  code: DETECT_CODE,
  label: "Detect language",
};

interface Props {
  id: string;
  label: string;
  value: string;
  languages: Language[];
  onChange: (code: string) => void;
  disabled?: boolean;
  /** When true, prepends a "Detect language" option at the top of the list. */
  showDetect?: boolean;
}

/**
 * Searchable language picker that replaces the native 200-option <select>.
 * Renders a trigger button + an absolutely-positioned dropdown with a filter
 * input and a scrollable list of buttons. Keyboard-navigable (Arrow keys,
 * Enter, Escape).
 *
 * Biome a11y rules fire on ARIA combobox patterns (role=listbox on a div,
 * role=option on buttons) because the canonical semantic equivalents are
 * <select>/<option>, which can't be styled and don't support a search input.
 * We suppress those two rules on the relevant elements.
 */
export function LanguagePicker({
  id,
  label,
  value,
  languages,
  onChange,
  disabled,
  showDetect,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const allOptions: Language[] = showDetect ? [DETECT_OPTION, ...languages] : languages;
  const selected = allOptions.find((l) => l.code === value);

  const filtered =
    query.trim() === ""
      ? allOptions
      : allOptions.filter((l) => l.label.toLowerCase().includes(query.toLowerCase().trim()));

  // Reset active index when filtered list changes. `filtered` changes when
  // `query` changes, but biome's dep-lint would flag `filtered` as a derived
  // value -- using `query` as the dep is semantically correct here.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on query change, not on every filtered re-derive
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handlePointer(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("pointerdown", handlePointer);
    return () => document.removeEventListener("pointerdown", handlePointer);
  }, [open]);

  // Scroll active item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const active = listRef.current.children[activeIdx] as HTMLElement | undefined;
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  const openPicker = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [disabled]);

  const select = useCallback(
    (code: string) => {
      onChange(code);
      setOpen(false);
      setQuery("");
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          openPicker();
        }
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const lang = filtered[activeIdx];
        if (lang) select(lang.code);
      }
    },
    [open, openPicker, filtered, activeIdx, select]
  );

  return (
    <div ref={wrapRef} className="lp-wrap" onKeyDown={handleKeyDown}>
      <label htmlFor={`${id}-trigger`} className="tr-lang-label">
        {label}
      </label>

      {/* Trigger button -- shows selected language name */}
      <button
        id={`${id}-trigger`}
        type="button"
        className={`lp-trigger${open ? " lp-trigger--open" : ""}`}
        onClick={openPicker}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${selected?.label ?? "select language"}`}
      >
        <span className="lp-trigger-text">{selected?.label ?? "Select language"}</span>
        <svg
          className={`lp-chevron${open ? " lp-chevron--up" : ""}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="lp-dropdown" aria-label={`Choose ${label} language`}>
          <div className="lp-search-wrap">
            <svg
              className="lp-search-icon"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              className="lp-search"
              placeholder="Search languages..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filter languages"
              aria-controls={`${id}-list`}
              aria-autocomplete="list"
            />
            {query && (
              <button
                type="button"
                className="lp-clear-query"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <p className="lp-empty">No languages match "{query}"</p>
          ) : (
            <div id={`${id}-list`} ref={listRef} className="lp-list" aria-label={label}>
              {filtered.map((lang, i) => (
                <button
                  key={lang.code}
                  type="button"
                  aria-pressed={lang.code === value}
                  className={`lp-option${lang.code === value ? " lp-option--selected" : ""}${i === activeIdx ? " lp-option--active" : ""}`}
                  onPointerDown={(e) => {
                    // Commit before blur fires on the search input
                    e.preventDefault();
                    select(lang.code);
                  }}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { CATEGORIES, convert, formatResultHuman, getCommonConversions } from "./lib/units";
import type { CategoryId } from "./lib/units";
import { useUnitsStore } from "./store/unitsStore";
import "./styles.css";

// ── Brand glyph: ruler + arrows, flat, bg-less ────────────────────────────────

function UnitsBrandGlyph() {
  return (
    <>
      {/* Ruler body, teal stroke outline, no fill */}
      <rect
        x="2"
        y="12.5"
        width="28"
        height="7"
        rx="1.5"
        stroke="#2f9d8d"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Tick marks on ruler, teal strokes */}
      <line
        x1="8"
        y1="12.5"
        x2="8"
        y2="10"
        stroke="#2f9d8d"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="13"
        y1="12.5"
        x2="13"
        y2="11"
        stroke="#2f9d8d"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="18"
        y1="12.5"
        x2="18"
        y2="10"
        stroke="#2f9d8d"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="23"
        y1="12.5"
        x2="23"
        y2="11"
        stroke="#2f9d8d"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Up arrowhead, amber */}
      <path d="M26 9.5 L28.2 13 L23.8 13Z" fill="#e8b04b" />
      {/* Down arrowhead, coral */}
      <path d="M26 22.5 L23.8 19 L28.2 19Z" fill="#d9594c" />
      {/* Vertical shaft connecting arrowheads, amber stroke */}
      <line
        x1="26"
        y1="13"
        x2="26"
        y2="19"
        stroke="#e8b04b"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  );
}

// ── Category tab strip ────────────────────────────────────────────────────────

function CategoryTabs() {
  const { categoryId, setCategory } = useUnitsStore();
  return (
    <div className="units-category-scroll" role="tablist" aria-label="Unit category">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.id}
          type="button"
          role="tab"
          aria-selected={categoryId === cat.id}
          className={`units-cat-btn${categoryId === cat.id ? " units-cat-btn--active" : ""}`}
          onClick={() => setCategory(cat.id as CategoryId)}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}

// ── Unit selector (native <select>) ──────────────────────────────────────────

interface UnitSelectProps {
  id: string;
  label: string;
  categoryId: CategoryId;
  value: string;
  onChange: (v: string) => void;
}

function UnitSelect({ id, label, categoryId, value, onChange }: UnitSelectProps) {
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  return (
    <div className="units-select-wrap">
      <label className="units-field-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="units-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} unit`}
      >
        {cat?.units.map((u) => (
          <option key={u.id} value={u.id}>
            {u.label} ({u.symbol})
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Main converter card ───────────────────────────────────────────────────────

function ConverterCard() {
  const {
    categoryId,
    fromUnit,
    toUnit,
    inputValue,
    resultValue,
    inputIsInvalid,
    fullPrecision,
    setFromUnit,
    setToUnit,
    setInputValue,
    swap,
    togglePrecision,
  } = useUnitsStore();

  const cat = CATEGORIES.find((c) => c.id === categoryId);
  const fromDef = cat?.units.find((u) => u.id === fromUnit);
  const toDef = cat?.units.find((u) => u.id === toUnit);
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  // Cmd/Ctrl+Enter swaps units (primary action for a converter)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        swap();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [swap]);

  function handleCopy() {
    if (resultValue === "—") return;
    navigator.clipboard.writeText(resultValue).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="card units-converter-card">
      <div className="units-converter-grid">
        {/* FROM */}
        <div className="units-side">
          <UnitSelect
            id="unit-from"
            label="From"
            categoryId={categoryId}
            value={fromUnit}
            onChange={setFromUnit}
          />
          <div className="units-value-wrap">
            <input
              ref={inputRef}
              id="units-input"
              type="number"
              className="units-value-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="0"
              aria-label={`Value in ${fromDef?.label ?? fromUnit}`}
              autoComplete="off"
            />
            <span className="units-symbol" aria-hidden="true">
              {fromDef?.symbol ?? fromUnit}
            </span>
          </div>
          {inputIsInvalid && (
            <p className="units-input-hint" role="alert">
              Enter a number to convert
            </p>
          )}
        </div>

        {/* SWAP */}
        <div className="units-swap-col">
          <button
            type="button"
            className="units-swap-btn"
            onClick={swap}
            aria-label="Swap from and to units (Cmd+Enter)"
            title="Swap (Cmd+Enter)"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M5 7L1 11L5 15"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M1 11H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path
                d="M15 5L19 9L15 13"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M19 9H7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* TO */}
        <div className="units-side">
          <UnitSelect
            id="unit-to"
            label="To"
            categoryId={categoryId}
            value={toUnit}
            onChange={setToUnit}
          />
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: tap-to-copy is supplementary; the copy button provides full keyboard access */}
          <div
            className={`units-value-wrap units-value-wrap--result${resultValue !== "—" ? " units-value-wrap--copyable" : ""}`}
            onClick={handleCopy}
            title={resultValue !== "—" ? (copied ? "Copied!" : "Click to copy") : undefined}
          >
            <output
              htmlFor="units-input"
              className="units-value-output"
              aria-label={`Result in ${toDef?.label ?? toUnit}`}
              aria-live="polite"
            >
              {resultValue}
            </output>
            <span className="units-symbol" aria-hidden="true">
              {toDef?.symbol ?? toUnit}
            </span>
            <button
              type="button"
              className={`units-copy-btn${copied ? " units-copy-btn--copied" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              aria-label={copied ? "Copied!" : "Copy result"}
              disabled={resultValue === "—"}
              title={copied ? "Copied!" : "Copy result"}
            >
              {copied ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                    <path
                      d="M2.5 7.5L6 11L12.5 4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="units-copy-label" aria-hidden="true">
                    Copied!
                  </span>
                </>
              ) : (
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <rect
                    x="5"
                    y="5"
                    width="8"
                    height="8"
                    rx="1.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M10 5V3.5C10 2.67 9.33 2 8.5 2H3.5C2.67 2 2 2.67 2 3.5V8.5C2 9.33 2.67 10 3.5 10H5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Precision toggle */}
      <div className="units-precision-row">
        <button
          type="button"
          className={`units-precision-btn${fullPrecision ? " units-precision-btn--active" : ""}`}
          onClick={togglePrecision}
          aria-pressed={fullPrecision}
          title="Toggle full precision display"
        >
          {fullPrecision ? "Full precision" : "Rounded"}
        </button>
      </div>
    </div>
  );
}

// ── All-units result grid ─────────────────────────────────────────────────────

function AllUnitsCard() {
  const { categoryId, fromUnit, inputValue, fullPrecision, setToUnit } = useUnitsStore();
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  const n = Number(inputValue.trim());
  const isValid = inputValue.trim() !== "" && Number.isFinite(n);
  const fromDef = cat?.units.find((u) => u.id === fromUnit);

  if (!cat || !isValid) return null;

  return (
    <div className="card units-allunits-card">
      <h2 className="units-common-title">
        All {cat.label.toLowerCase()} units
        {fromDef ? ` from ${n} ${fromDef.symbol}` : ""}
      </h2>
      <div className="units-allunits-grid">
        {cat.units.map((u) => {
          if (u.id === fromUnit) return null;
          const result = convert(n, fromUnit, u.id, categoryId);
          const formatted = formatResultHuman(result, fullPrecision);
          return (
            <button
              key={u.id}
              type="button"
              className="units-allunits-item"
              onClick={() => setToUnit(u.id)}
              aria-label={`Set result unit to ${u.label}: ${formatted} ${u.symbol}`}
            >
              <span className="units-allunits-label">{u.label}</span>
              <span className="units-allunits-value">
                <span className="units-common-val">{formatted}</span>{" "}
                <span className="units-common-sym">{u.symbol}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Common conversions panel ──────────────────────────────────────────────────

function CommonConversionsCard() {
  const { categoryId, setInputValue, setFromUnit, setToUnit } = useUnitsStore();
  const commons = getCommonConversions(categoryId);
  const cat = CATEGORIES.find((c) => c.id === categoryId);

  function handlePick(fromSymbol: string, toSymbol: string, fromValue: number) {
    const fromDef = cat?.units.find((u) => u.symbol === fromSymbol);
    const toDef = cat?.units.find((u) => u.symbol === toSymbol);
    if (!fromDef || !toDef) return;
    setFromUnit(fromDef.id);
    setToUnit(toDef.id);
    setInputValue(String(fromValue));
  }

  return (
    <div className="card units-common-card">
      <h2 className="units-common-title">Common conversions</h2>
      <div className="units-common-grid">
        {commons.map((item) => (
          <button
            key={item.label}
            type="button"
            className="units-common-item"
            onClick={() => handlePick(item.from.unit, item.to.unit, item.from.value)}
            aria-label={`Use conversion: ${item.from.value} ${item.from.unit} = ${formatResultHuman(item.to.value)} ${item.to.unit}`}
          >
            <span className="units-common-from">
              <span className="units-common-val">{item.from.value}</span>{" "}
              <span className="units-common-sym">{item.from.unit}</span>
            </span>
            <span className="units-common-eq">=</span>
            <span className="units-common-to">
              <span className="units-common-val">
                {typeof item.to.value === "number"
                  ? formatResultHuman(item.to.value)
                  : item.to.value}
              </span>{" "}
              <span className="units-common-sym">{item.to.unit}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────

export function App() {
  return (
    <div className="app-root">
      <Header
        title="Unit Converter"
        subtitle="length · mass · temperature · area · volume · speed · data · time · pressure · energy · angle · power · force · fuel"
        brandMark={
          <BrandMark label="Unit Converter">
            <UnitsBrandGlyph />
          </BrandMark>
        }
      />

      <main className="site-main">
        <CategoryTabs />
        <ConverterCard />
        <AllUnitsCard />
        <CommonConversionsCard />

        <p className="units-footer-note">
          Runs entirely in your browser. No data leaves your device.
        </p>
      </main>

      <Footer blurb="Instant unit conversion. No signup, no upload." />
    </div>
  );
}

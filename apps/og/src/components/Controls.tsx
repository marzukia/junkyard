import { useRef, useState } from "react";
import { SIZE_PRESETS, TEMPLATES, clamp, estimateTitleLines } from "../ogLogic";
import type { BgType, FontPreset, Layout } from "../ogLogic";
import { useOgStore } from "../store";

const CHAR_BUDGET = 80; // beyond this, title overflow is likely

const TEMPLATE_LABELS: Record<string, string> = {
  dark: "Dark",
  brand: "Brand",
  light: "Light",
  coral: "Coral",
  mono: "Mono",
};

const LAYOUT_OPTIONS: { value: Layout; label: string }[] = [
  { value: "centered", label: "Centered" },
  { value: "left", label: "Left-aligned" },
  { value: "brand", label: "Brand" },
];

const FONT_OPTIONS: { value: FontPreset; label: string }[] = [
  { value: "inter", label: "Inter (sans)" },
  { value: "mono", label: "JetBrains Mono" },
  { value: "serif", label: "Serif" },
];

function ColorField({
  label,
  value,
  onChange,
  id,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  id: string;
}) {
  return (
    <div className="og-field">
      <label htmlFor={id}>{label}</label>
      <div className="og-color-row">
        <input
          type="color"
          id={`${id}-picker`}
          className="og-color-swatch"
          value={value.startsWith("#") && value.length === 7 ? value : "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} colour picker`}
          style={{ background: value }}
        />
        <input
          type="text"
          id={id}
          className="og-color-hex"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} hex`}
          spellCheck={false}
          maxLength={7}
        />
      </div>
    </div>
  );
}

/** Collapsible section wrapper for mobile */
function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="og-section">
      <button
        type="button"
        className="og-section-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="og-section-title">{title}</span>
        <span className="og-section-chevron" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && <div className="og-section-body">{children}</div>}
    </div>
  );
}

export function Controls() {
  const store = useOgStore();
  const { config, activeTemplate, canvasWidth, canvasHeight } = store;
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  // Title overflow warning: more than 2 lines is a problem
  const titleFontSize = Math.round(canvasHeight * 0.113);
  const titleLines = estimateTitleLines(config.title, canvasWidth, titleFontSize);
  const titleOverflow = titleLines > 2;
  const titleTooLong = config.title.length > CHAR_BUDGET;

  function handleBgImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === "string") store.setBgImage(result);
    };
    reader.readAsDataURL(file);
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === "string") store.setLogoImage(result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="og-controls">
      {/* Templates */}
      <Section title="Template">
        <div className="og-template-chips">
          {Object.keys(TEMPLATES).map((key) => (
            <button
              key={key}
              type="button"
              className={`og-template-chip${activeTemplate === key ? " og-template-chip--active" : ""}`}
              onClick={() => store.applyTemplate(key)}
              aria-pressed={activeTemplate === key}
            >
              {TEMPLATE_LABELS[key] ?? key}
            </button>
          ))}
        </div>
      </Section>

      {/* Size presets */}
      <Section title="Size" defaultOpen={false}>
        <div className="og-template-chips">
          {SIZE_PRESETS.map((p) => {
            const active = store.canvasWidth === p.width && store.canvasHeight === p.height;
            return (
              <button
                key={p.label}
                type="button"
                className={`og-template-chip${active ? " og-template-chip--active" : ""}`}
                onClick={() => {
                  store.setCanvasWidth(p.width);
                  store.setCanvasHeight(p.height);
                }}
                aria-pressed={active}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <p className="og-hint">
          {store.canvasWidth} x {store.canvasHeight} px
        </p>
      </Section>

      {/* Text content */}
      <Section title="Content">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div className="og-field">
            <div className="og-field-label-row">
              <label htmlFor="og-title">Title</label>
              <span
                className={`og-char-count${titleTooLong ? " og-char-count--warn" : ""}`}
                aria-live="polite"
              >
                {config.title.length}/{CHAR_BUDGET}
              </span>
            </div>
            <input
              type="text"
              id="og-title"
              className={`og-input${titleOverflow ? " og-input--warn" : ""}`}
              value={config.title}
              onChange={(e) => store.setTitle(e.target.value)}
              placeholder="Your headline here"
              aria-describedby={titleOverflow ? "og-title-warn" : undefined}
            />
            {titleOverflow && (
              <p id="og-title-warn" className="og-field-warn">
                Long title: auto-shrink applied ({titleLines} lines). Export may look different.
              </p>
            )}
          </div>
          <div className="og-field">
            <label htmlFor="og-subtitle">Subtitle</label>
            <input
              type="text"
              id="og-subtitle"
              className="og-input"
              value={config.subtitle}
              onChange={(e) => store.setSubtitle(e.target.value)}
              placeholder="A short supporting line"
            />
          </div>
          <div className="og-field">
            <label htmlFor="og-badge">Badge</label>
            <input
              type="text"
              id="og-badge"
              className="og-input"
              value={config.badge}
              onChange={(e) => store.setBadge(e.target.value)}
              placeholder="junkyard.mrzk.io/og/"
            />
          </div>
        </div>
      </Section>

      {/* Background */}
      <Section title="Background">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <fieldset
            className="og-bg-toggle"
            aria-label="Background type"
            style={{ border: "none", padding: 0 }}
          >
            {(["solid", "gradient"] as BgType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`og-bg-btn${config.bgType === t ? " og-bg-btn--active" : ""}`}
                onClick={() => store.setBgType(t)}
                aria-pressed={config.bgType === t}
              >
                {t === "solid" ? "Solid" : "Gradient"}
              </button>
            ))}
          </fieldset>

          <div className={config.bgType === "gradient" ? "og-gradient-row" : ""}>
            <ColorField
              label={config.bgType === "gradient" ? "Colour A" : "Background"}
              value={config.bgColor}
              onChange={store.setBgColor}
              id="og-bg-color"
            />
            {config.bgType === "gradient" && (
              <ColorField
                label="Colour B"
                value={config.bgColorEnd}
                onChange={store.setBgColorEnd}
                id="og-bg-color-end"
              />
            )}
          </div>

          {config.bgType === "gradient" && (
            <div className="og-field">
              <label htmlFor="og-angle">Angle: {config.gradientAngle}&deg;</label>
              <input
                type="range"
                id="og-angle"
                min={0}
                max={360}
                value={config.gradientAngle}
                onChange={(e) => store.setGradientAngle(Number(e.target.value))}
                style={{ width: "100%", accentColor: "var(--accent)" }}
              />
            </div>
          )}

          {/* Image upload */}
          <div className="og-field">
            <label htmlFor="og-upload-btn">Background image</label>
            <div className="og-upload-area">
              <button
                id="og-upload-btn"
                type="button"
                className="og-upload-btn"
                onClick={() => fileRef.current?.click()}
              >
                {config.bgImage ? "Change image" : "Upload image"}
              </button>
              {config.bgImage && (
                <>
                  <span className="og-upload-filename">Image loaded</span>
                  <button
                    type="button"
                    className="og-upload-clear"
                    onClick={() => store.setBgImage(null)}
                    aria-label="Remove background image"
                  >
                    remove
                  </button>
                </>
              )}
            </div>
            {config.bgImage && (
              <div className="og-field" style={{ marginTop: "0.5rem" }}>
                <label htmlFor="og-img-opacity">
                  Opacity: {Math.round(config.bgImageOpacity * 100)}%
                </label>
                <input
                  type="range"
                  id="og-img-opacity"
                  min={0}
                  max={1}
                  step={0.01}
                  value={config.bgImageOpacity}
                  onChange={(e) => store.setBgImageOpacity(clamp(Number(e.target.value), 0, 1))}
                  style={{ width: "100%", accentColor: "var(--accent)" }}
                />
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleBgImageUpload}
              aria-label="Upload background image"
            />
          </div>

          {/* Logo overlay */}
          <div className="og-field">
            <label htmlFor="og-logo-btn">Logo overlay</label>
            <div className="og-upload-area">
              <button
                id="og-logo-btn"
                type="button"
                className="og-upload-btn"
                onClick={() => logoRef.current?.click()}
              >
                {config.logoImage ? "Change logo" : "Upload logo"}
              </button>
              {config.logoImage && (
                <>
                  <span className="og-upload-filename">Logo loaded</span>
                  <button
                    type="button"
                    className="og-upload-clear"
                    onClick={() => store.setLogoImage(null)}
                    aria-label="Remove logo"
                  >
                    remove
                  </button>
                </>
              )}
            </div>
            {config.logoImage && (
              <div className="og-field" style={{ marginTop: "0.5rem" }}>
                <label htmlFor="og-logo-size">Size: {config.logoSize}px</label>
                <input
                  type="range"
                  id="og-logo-size"
                  min={32}
                  max={200}
                  step={4}
                  value={config.logoSize}
                  onChange={(e) => store.setLogoSize(clamp(Number(e.target.value), 32, 200))}
                  style={{ width: "100%", accentColor: "var(--accent)" }}
                />
              </div>
            )}
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleLogoUpload}
              aria-label="Upload logo image"
            />
          </div>
        </div>
      </Section>

      {/* Typography + layout */}
      <Section title="Typography &amp; Layout" defaultOpen={false}>
        <div className="og-preset-row">
          <div className="og-field">
            <label htmlFor="og-font">Font</label>
            <select
              id="og-font"
              className="og-select"
              value={config.font}
              onChange={(e) => store.setFont(e.target.value as FontPreset)}
            >
              {FONT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="og-field">
            <label htmlFor="og-layout">Layout</label>
            <select
              id="og-layout"
              className="og-select"
              value={config.layout}
              onChange={(e) => store.setLayout(e.target.value as Layout)}
            >
              {LAYOUT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      {/* Colours */}
      <Section title="Text &amp; Badge colours" defaultOpen={false}>
        <div className="og-colour-fields">
          <ColorField
            label="Text"
            value={config.textColor}
            onChange={store.setTextColor}
            id="og-text-color"
          />
          <ColorField
            label="Badge BG"
            value={config.badgeBg}
            onChange={store.setBadgeBg}
            id="og-badge-bg"
          />
          <ColorField
            label="Badge text"
            value={config.badgeText}
            onChange={store.setBadgeText}
            id="og-badge-text"
          />
        </div>
      </Section>
    </div>
  );
}

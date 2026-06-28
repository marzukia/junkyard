# junkyard — shared kit

Canonical source for shared UI components, theme, and utilities across every tool at `junkyard.sh`.
The kit is consumed via the `@junkyardsh/ui` npm package (`packages/ui/`), which re-exports
from `kit/`. Apps import from `@junkyardsh/ui` — they do **not** copy kit files directly.

## Kit contents

```
kit/
  theme.ts                  — Mantine createTheme (Roboto + Roboto Mono, teal primary)
  styles.css                — Design-system CSS vars light+dark, site layout, touch zoom fixes
  components/
    BrandMark.tsx           — SVG glyph wrapper (pass glyph as children)
    Header.tsx              — Utility bar + ThemeToggle + title slot + optional controls
    Footer.tsx              — "Made by Andryo Marzuki" + colours cross-link
    ThemeToggle.tsx         — System/Light/Dark pill toggle
    AppSwitcher.tsx         — Nav switcher, fetches /catalogue.json at runtime
    MobileWarning.tsx       — Mobile warning overlay for heavy AI apps
    format.ts               — formatBytes utility
  lib/
    base64url.ts            — Base64URL encode/decode
    cronGrammar.ts          — Cron expression parser/validator
    csvParse.ts             — CSV delimiter detection and row splitting
    imageHelpers.ts         — Shared image helpers (ACCEPTED_TYPES, isSupportedImage, formatBytes, formatProgress)
    qrContent.ts            — WiFi/VCARD QR payload builders
    unicodeFont.ts          — Unicode font conversion
    unitsData.ts            — Unit conversion data and logic
    workerInference.ts      — Shared worker boilerplate (env config, progress posting, model caching)
    workerTask.ts           — useWorkerTask React hook for worker communication
  seo/
    index-template.html     — Full <head>: SEO + OG + Twitter + JSON-LD + no-flash + Umami
  deploy/
    deploy-pages.yml        — GitHub Pages CI/CD workflow (build → upload → deploy)
  vite.config.ts            — Vite config (react plugin, base "/", es2022 target)
  tsconfig.json             — Strict TS, bundler resolution, react-jsx
  biome.json                — Biome lint + format config
  package.json              — Baseline deps
```

## How to consume (per tool)

Apps import from `@junkyardsh/ui`, not from `kit/` directly. See
[CONTRIBUTING.md](../CONTRIBUTING.md) §Adding a new tool for the current workflow.

### main.tsx wiring

```tsx
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@fontsource/roboto-mono/400.css";
import "@fontsource/roboto-mono/500.css";
import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { fleetTheme } from "@junkyardsh/ui";
import { App } from "./App";
import "@junkyardsh/ui/styles.css";
import "./styles.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

createRoot(rootEl).render(
  <StrictMode>
    <MantineProvider theme={fleetTheme} defaultColorScheme="auto">
      <App />
    </MantineProvider>
  </StrictMode>
);
```

### App.tsx wiring

```tsx
import { BrandMark, Footer, Header } from "@junkyardsh/ui";

function ToolGlyph() {
  return (
    <>
      <rect x="2" y="2" width="28" height="28" rx="4" fill="#2f9d8d" />
    </>
  );
}

export function App() {
  return (
    <div className="app-root">
      <Header
        title="Tool Name"
        subtitle="One-line descriptor"
        brandMark={<BrandMark><ToolGlyph /></BrandMark>}
      />
      <main className="site-main">
        {/* tool UI here — wrap cards in <div className="card"> */}
      </main>
      <Footer blurb="Runs in your browser — no data leaves your device" />
    </div>
  );
}
```

## Design tokens (quick reference)

| Token              | Light          | Dark       |
|--------------------|----------------|------------|
| `--canvas`         | `#fafafa`      | `#13171a`  |
| `--surface`        | `#ffffff`      | `#1b2126`  |
| `--surface-sunken` | `#f4f5f6`      | `#161b1f`  |
| `--ink`            | `#1a2530`      | `#e9eef1`  |
| `--ink-mid`        | `#5b6671`      | `#9aa6b0`  |
| `--ink-faint`      | `#9aa3ac`      | `#5f6e78`  |
| `--accent`         | `#2f9d8d`      | `#41b6a6`  |
| `--radius`         | `16px`         | `16px`     |
| `--font-text`      | Roboto         | Roboto     |
| `--font-mono`      | Roboto Mono    | Roboto Mono    |

Brand palette (use for glyphs/accents): teal `#2f9d8d`, amber `#e8b04b`, coral `#d9594c`.

## Extraction note

The kit was originally vendored (copy-paste per app) and has since been extracted to the
`@junkyardsh/ui` npm package (`packages/ui/`). All apps import from `@junkyardsh/ui`.
The kit remains the source of truth — `packages/ui/src/index.ts` re-exports from `kit/`.

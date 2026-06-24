# junkyard — shared kit

Vendored shared code for every tool at `junkyard.sh`. Not an npm package — copy the files
and fill the placeholders. When `@junkyard/ui` is eventually extracted, this kit becomes
the source of truth for that package.

## Kit contents

```
kit/
  theme.ts                  — Mantine createTheme (Inter + JetBrains Mono, teal primary)
  styles.css                — Design-system CSS vars light+dark, card/pill/button/footer
  components/
    BrandMark.tsx           — SVG glyph wrapper (pass glyph as children)
    Header.tsx              — Utility bar + ThemeToggle + title slot + optional controls
    Footer.tsx              — "Made by Andryo Marzuki" + colours cross-link
    ThemeToggle.tsx         — System/Light/Dark pill toggle
  seo/
    index-template.html     — Full <head>: SEO + OG + Twitter + JSON-LD + no-flash + Umami
  deploy/
    deploy-pages.yml        — GitHub Pages CI/CD workflow (build → upload → deploy)
  vite.config.ts            — Vite config (react plugin, base "/", es2022 target)
  tsconfig.json             — Strict TS, bundler resolution, react-jsx
  biome.json                — Biome lint + format config
  package.json              — Baseline deps (rename "name" field)
```

## How to consume the kit (per tool)

### 1. Bootstrap the tool directory

```bash
mkdir /home/planky/projects/_fleet/tool-<slug>
cd /home/planky/projects/_fleet/tool-<slug>
git init
git config user.name "Andryo Marzuki"
git config user.email "42439397+marzukia@users.noreply.github.com"
```

### 2. Copy kit files

```bash
KIT=/home/planky/projects/_fleet/kit
TOOL=/home/planky/projects/_fleet/tool-<slug>

cp $KIT/vite.config.ts $TOOL/
cp $KIT/tsconfig.json  $TOOL/
cp $KIT/biome.json     $TOOL/
cp $KIT/package.json   $TOOL/          # then edit "name" field

mkdir -p $TOOL/src/kit/components $TOOL/.github/workflows $TOOL/public

cp $KIT/theme.ts                        $TOOL/src/kit/
cp $KIT/styles.css                      $TOOL/src/kit/
cp $KIT/components/BrandMark.tsx        $TOOL/src/kit/components/
cp $KIT/components/Header.tsx           $TOOL/src/kit/components/
cp $KIT/components/Footer.tsx           $TOOL/src/kit/components/
cp $KIT/components/ThemeToggle.tsx      $TOOL/src/kit/components/
cp $KIT/seo/index-template.html         $TOOL/index.html
cp $KIT/deploy/deploy-pages.yml         $TOOL/.github/workflows/deploy-pages.yml
```

### 3. Fill placeholders in index.html

Open `index.html` and replace every `{{...}}` token:

| Placeholder      | Example value                                                    |
|------------------|------------------------------------------------------------------|
| `{{TITLE}}`      | `Typecheck — Free Font Pairing Tool`                             |
| `{{DESC}}`       | `Free font pairing tool. Preview Inter, DM Sans, ... no signup.` |
| `{{KEYWORDS}}`   | `font pairing, google fonts alternative, ...`                    |
| `{{SLUG}}`       | `typecheck`                                                      |
| `{{APP_CAT}}`    | `DesignApplication`                                              |
| `{{FEATURE_LIST}}`| `["Font preview", "Pairing suggestions", "Export CSS"]`         |

Replace `__UMAMI_ID__` with the real Umami site ID after creating the site.

### 4. Add public/ files

```
public/
  CNAME        — one line: <slug>.mrzk.io
  favicon.svg  — tool's unique glyph (32×32, brand palette)
  og.png       — 1200×630 OG banner
  robots.txt   — (see below)
  sitemap.xml  — (see below)
```

**robots.txt**:
```
User-agent: *
Allow: /
Sitemap: https://<slug>.mrzk.io/sitemap.xml
```

**sitemap.xml**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://<slug>.mrzk.io/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

### 5. Wire up main.tsx

```tsx
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/800.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./kit/styles.css";
import { fleetTheme } from "./kit/theme";

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

### 6. Wire up App.tsx

```tsx
import { BrandMark } from "./kit/components/BrandMark";
import { Footer } from "./kit/components/Footer";
import { Header } from "./kit/components/Header";

// Define the tool's unique glyph inline — must fit a 32×32 viewBox.
function ToolGlyph() {
  return (
    <>
      <rect x="2" y="2" width="28" height="28" rx="4" fill="#2f9d8d" />
      {/* ... */}
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
        controls={/* optional tool controls */}
      />
      <main className="site-main">
        {/* tool UI here — wrap cards in <div className="card"> */}
      </main>
      <Footer blurb="Runs in your browser — no data leaves your device" />
    </div>
  );
}
```

### 7. Validate before committing

```bash
npm ci
npx biome ci src/          # must exit 0
npx tsc --noEmit           # must exit 0
npm run test               # must pass
npm run build              # must succeed

# Confirm dist/ contains:
ls dist/CNAME dist/og.png dist/robots.txt dist/sitemap.xml dist/favicon.svg
grep '<slug>.mrzk.io' dist/index.html     # canonical, og:url, JSON-LD
```

### 8. Initial commit

```bash
git add <specific files>
git commit -m "feat: <slug> — <one-liner>"
```

Do NOT push — the orchestrator creates repos and deploys.

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
| `--font-text`      | Inter          | Inter      |
| `--font-mono`      | JetBrains Mono | JetBrains Mono |

Brand palette (use for glyphs/accents): teal `#2f9d8d`, amber `#e8b04b`, coral `#d9594c`.

## Deferral note

The kit is vendored (copy-paste) rather than published to npm so that parallel tool builds
don't block on a package registry publish step. The next natural extraction point is after
2–3 tools are live and the component API has stabilised — at that point, move `src/kit/`
into a proper `@junkyard/ui` workspace package and update each tool's imports.

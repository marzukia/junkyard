# Contributing to junkyard

A monorepo of 44 free, client-side web tools served at `junkyard.mrzk.io/<slug>/`.

## Repo layout

```
junkyard/
  apps/<slug>/        # 44 standalone Vite apps, one per tool
  kit/                # shared design-system kit (vendored into each app)
  hub/                # landing page (Vite + React 18 + TS, built to dist root)
  packages/
    core/             # @junkyard/core - 17 pure-logic headless tools (Node/vitest)
    mcp-server/       # @junkyard/mcp-server - MCP stdio server over @junkyard/core
  scripts/
    build-site.sh       # consolidated CI build
    gen-catalogue.ts    # reads apps/*/junkyard.ts, emits catalogue artifacts
    catalogue-schema.ts # JunkyardApp type + enums (Category, Runtime, AppTag)
    vendor-switcher.mjs # copies AppSwitcher into every app (idempotent)
    vendor-mobilewarn.mjs # copies MobileWarning into heavy-AI apps (idempotent)
    inject-umami.mjs    # injects Umami <script> into dist/<slug>/index.html
    umami.config.json   # { "host": "umami.junkyard.sh" }
  umami-ids.txt       # slug -> Umami website-id map (one line per tool)
```

## Per-app stack

Every app under `apps/<slug>/` uses the same stack:

| Concern | Choice |
|---------|--------|
| Bundler | Vite 6 |
| UI | React 18 + Mantine v7 |
| Language | TypeScript (strict) |
| State | Zustand |
| Lint/format | Biome |
| Test | Vitest + @testing-library/react |
| Node | 22 |

Fonts: Inter (UI/headings, 800 weight) and JetBrains Mono (mono/numbers) via `@fontsource`.

## Running a single app locally

```bash
cd apps/<slug>
npm ci
npm run dev        # Vite dev server, hot-reload
```

The app runs at `http://localhost:5173` by default.

Available scripts (same for every app):

| Script | What it does |
|--------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | tsc + vite build |
| `npm run preview` | Preview built dist (port varies per app, typically 4173-4175) |
| `npm run lint` | `biome check src/` (report only) |
| `npm run format` | `biome check --write src/` |
| `npm run ci` | `biome ci src/` (zero-exit required in CI) |
| `npm run test` | vitest run |

For the hub landing page:

```bash
cd hub
npm ci
npm run dev        # runs gen-catalogue first via predev hook, then Vite on :5173
```

## Adding a new tool

### 1. Create the app directory

Copy the structure of an existing simple app (e.g. `apps/json/`) as a starting point:

```
apps/<slug>/
  src/
  public/
    CNAME          # content: junkyard.mrzk.io  (single line, no newline)
    favicon.svg
    og.png         # 1200x630
    robots.txt
    sitemap.xml
  index.html
  junkyard.ts      # REQUIRED - the self-describing app manifest
  package.json
  tsconfig.json
  vite.config.ts
  biome.json
```

### 2. Write junkyard.ts

Every app must export a typed `JunkyardApp` constant named `app`. The schema is defined in `scripts/catalogue-schema.ts`:

```typescript
import type { JunkyardApp } from "../../scripts/catalogue-schema";

export const app: JunkyardApp = {
  slug: "mytool",          // must match directory name exactly
  name: "My Tool",
  category: "text",        // "image" | "text" | "ai" | "docs"
  order: 45,               // unique positive integer, 1..N across ALL apps
  tagline: "One short line",
  description: "A sentence of at least 40 chars ending with a period, exclamation, or question mark.",
  incumbent: "incumbentname",
  path: "/mytool/",
  runtime: "client",       // "client" | "client-ai"
  mcp: {
    exposed: false,        // true if logic is also in @junkyard/core
    lib: "src/lib/mytool.ts",
    tools: [],             // array of { name: string; summary?: string }
  },
  // tags is optional: ("webgpu" | "on-device-ai" | "large-download" | "beta")[]
};
```

Field rules enforced by the validator in `gen-catalogue.ts`:

- `slug` must match the directory name.
- `order` must be a unique positive integer covering exactly 1..N (no gaps or duplicates).
- `description` must be at least 40 characters and end with `.`, `!`, or `?`.
- `category` must be one of `image | text | ai | docs`.
- `runtime` must be one of `client | client-ai`.
- Every entry in `mcp.tools` must have a non-empty `name` string.

### 3. Regenerate the catalogue

After creating or editing any `apps/*/junkyard.ts` you must regenerate the catalogue artifacts before committing:

```bash
cd hub
npm ci          # provides tsx (pinned devDep)
npx tsx ../scripts/gen-catalogue.ts
```

This writes:
- `hub/src/catalogue.generated.ts` - typed `TOOLS` array consumed by the hub React app
- `hub/public/catalogue.json` - full catalogue JSON served at `/catalogue.json` and read by AppSwitcher

CI runs this and fails with `git diff --exit-code` if the artifacts are stale. There is no way to bypass this gate.

### 4. Vendor the shared kit components

The AppSwitcher navigation component is vendored (copied) into every app rather than imported from a package. If you edit `kit/components/AppSwitcher.tsx` or `AppSwitcher.css`, run:

```bash
node scripts/vendor-switcher.mjs
```

This copies the canonical files into every `apps/<slug>/src/` directory that contains a `utility-bar` div. The script is idempotent and safe to re-run.

Similarly, if you edit `kit/components/MobileWarning.tsx` or `MobileWarning.css`:

```bash
node scripts/vendor-mobilewarn.mjs
```

MobileWarning is only vendored into the heavy-AI apps (`bg, caption, depth, summarize, transcribe, translate, upscale, chat, video`).

CI checks that all vendored copies match the canonical source via `git diff --exit-code` after re-running the vendor script.

### 5. SEO and domain rules

Apps must only reference `junkyard.mrzk.io` (not any `<slug>.mrzk.io` subdomain) in their `index.html`, `sitemap.xml`, and `robots.txt`. CI enforces this with a regex grep that fails the build on any stale per-app subdomain.

### 6. Testing conventions

Each app should have vitest tests for its core pure logic. The standard is: at least one happy-path test and two negative/edge-case tests per non-trivial function.

`@junkyard/core` has its own test suite at `packages/core/src/index.test.ts`. Run it with:

```bash
cd packages/core
npm ci
npm test
```

### 7. Lint and typecheck

Before committing, run from the app directory:

```bash
npm run ci          # biome CI (must exit 0)
npx tsc --noEmit    # must exit 0
npm test            # must pass
```

## Git identity

All commits must be authored as **Andryo Marzuki**:

```bash
git config user.name "Andryo Marzuki"
git config user.email "42439397+marzukia@users.noreply.github.com"
```

Set this per-worktree. Never commit as an automation or bot account.

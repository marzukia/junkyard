# Deployment

junkyard deploys as a single consolidated GitHub Pages site at `junkyard.mrzk.io`.

## Trigger

Push to `main` with changes under any of these paths:

```
hub/**
apps/**
scripts/**
.github/workflows/deploy-pages.yml
```

Changes outside these paths (e.g. README edits, package docs) do not trigger a deploy.

## Pipeline overview

```
push to main
  └── verify job
        ├── catalogue-drift check
        ├── vendored-AppSwitcher-drift check
        └── SEO domain guard
            └── build job (needs: verify)
                  ├── scripts/build-site.sh
                  └── GitHub Pages publish
```

## verify job

Three checks run before the build is allowed to proceed.

### Catalogue drift

```bash
cd hub && npx tsx ../scripts/gen-catalogue.ts
git diff --exit-code hub/src/catalogue.generated.ts hub/public/catalogue.json
```

Fails if any `apps/*/junkyard.ts` was added or edited without regenerating the catalogue artifacts. The generator also validates description quality (min 40 chars, terminal punctuation) and `mcp.tools` shape, so this gate also catches malformed manifests.

### Vendored AppSwitcher drift

```bash
node scripts/vendor-switcher.mjs
git diff --exit-code
```

Fails if `kit/components/AppSwitcher.tsx` or `AppSwitcher.css` was edited without running the vendor script to propagate the change to all apps.

### SEO domain guard

```bash
grep -rE '[a-z0-9-]+\.mrzk\.io' \
     --include='index.html' --include='sitemap.xml' --include='robots.txt' \
     apps/ | grep -v 'junkyard\.mrzk\.io'
```

Fails if any app's `index.html`, `sitemap.xml`, or `robots.txt` still contains a non-junkyard `*.mrzk.io` subdomain (stale from old per-app deploy configs).

## build job

Runs `bash scripts/build-site.sh`, then uploads `dist/` as a Pages artifact and publishes it.

### What build-site.sh does, step by step

1. Sets two env vars to skip the onnxruntime-node CUDA binary download. Several apps (`bg, caption, depth, summarize, transcribe, translate, upscale`) depend on transformers.js which pulls in onnxruntime-node as a transitive dep. Its postinstall tries to download GPU binaries and 403s on CI. These apps only use onnxruntime-web in the browser bundle, so the Node CUDA EP is irrelevant:
   ```bash
   export npm_config_onnxruntime_node_install_cuda=skip
   export ONNXRUNTIME_NODE_INSTALL_CUDA=skip
   ```

2. Installs hub dependencies (`npm ci` in `hub/`). This also installs `tsx`, which is a pinned devDep of the hub and is used to run gen-catalogue.

3. Runs `npx tsx scripts/gen-catalogue.ts` to regenerate the catalogue artifacts. The hub `prebuild` hook also does this, but `build-site.sh` calls `npx vite build` directly (bypassing npm run build) to avoid running the hook twice, so the explicit generate call is required here.

4. Builds the hub: `npx vite build --outDir dist/ --emptyOutDir`. This produces the landing page at `dist/index.html`.

5. For each `apps/<slug>/`: installs deps (`npm ci`) then builds with `npx vite build --base=/<slug>/ --outDir dist/<slug>/ --emptyOutDir`. The `--base=/<slug>/` flag ensures all asset paths are rooted at the tool's subdirectory path.

6. Runs `node scripts/inject-umami.mjs` to inject the Umami analytics `<script>` tag into each `dist/<slug>/index.html`. The script reads `scripts/umami.config.json` for the host (`umami.junkyard.sh`) and `umami-ids.txt` for the per-slug UUID mapping. Slugs with no entry in `umami-ids.txt` are skipped with a warning. The injection is idempotent.

7. Writes `dist/CNAME` containing `junkyard.mrzk.io` and `dist/.nojekyll` (empty, prevents GitHub Pages from running Jekyll which would silently 404 any `_`-prefixed asset).

## Custom domain

`junkyard.mrzk.io` is served via GitHub Pages with the CNAME record managed by the `dist/CNAME` file written by `build-site.sh`. DNS is a wildcard `*.mrzk.io` CNAME pointing to `marzukia.github.io`.

## Umami analytics

Analytics are injected at build time rather than baked into each app's source `index.html`.

- Host configured in `scripts/umami.config.json`: `{ "host": "umami.junkyard.sh" }`
- Slug-to-UUID mapping in `umami-ids.txt` (one `<slug> <uuid>` pair per line; blank lines and `#` comments are ignored)
- The injected tag format: `<script defer src="https://umami.junkyard.sh/script.js" data-website-id="<uuid>"></script>`
- Slugs absent from `umami-ids.txt` (currently `video` and `cleanup`) are skipped; see issue #12

To add analytics for a new tool: create the Umami website in the admin, then add a `<slug> <uuid>` line to `umami-ids.txt`.

## Pending: hydrogen apex

`junkyard.sh` is currently served from an nginx container on hydrogen (`andryo@REDACTED`) at the apex, hosting the old prototype. Migrating to serve the consolidated Pages-built `dist/` from hydrogen is an open item. The Bun-based MCP server (`packages/mcp-server`) is also intended to run on hydrogen. See HANDOVER.md for details.

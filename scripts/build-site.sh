#!/usr/bin/env bash
set -euo pipefail

# The transformers.js apps (bg, caption, depth, summarize, transcribe,
# translate, upscale) pull onnxruntime-node, whose postinstall tries to
# download CUDA GPU binaries and 403s on CI. These are browser apps that only
# use onnxruntime-web in the bundle, so skip the Node CUDA EP download.
# Belt-and-suspenders: bun also blocks lifecycle scripts by default, so these
# would not run under bun anyway. Keep both vars for any npm fallback context.
export npm_config_onnxruntime_node_install_cuda=skip
export ONNXRUNTIME_NODE_INSTALL_CUDA=skip

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"

echo "==> Building hub into $DIST"
cd "$ROOT/hub"
bun install --frozen-lockfile
# Generate the catalogue - bun runs the script directly with no deps needed.
# We invoke vite directly below rather than `bun run build`, so the prebuild
# hook does not fire - generate explicitly.
echo "==> Generating catalogue from apps/*/junkyard.ts"
bun "$ROOT/scripts/gen-catalogue.ts"
bunx vite build --outDir "$DIST" --emptyOutDir

echo "==> Building local packages"
if [ -d "$ROOT/packages/ui" ]; then
  cd "$ROOT/packages/ui"
  bun install --frozen-lockfile
  SKIP_DTS=1 bun run build
fi
if [ -d "$ROOT/packages/vite-config" ]; then
  cd "$ROOT/packages/vite-config"
  bun install --frozen-lockfile 2>/dev/null
  bun run build
fi
cd "$ROOT"

echo "==> Installing app deps (parallel, max 4 jobs)"
# Run bun install for all apps concurrently (bounded at 4) before the serial
# vite build loop. This is safe because installs are independent; builds must
# remain serial to avoid I/O contention on the dist/ tree.
pids=()
running=0
for d in "$ROOT"/apps/*/; do
  (cd "$d" && bun install --frozen-lockfile 2>&1 | sed "s|^|  [install $(basename "$d")] |") &
  pids+=($!)
  running=$((running + 1))
  if [ "$running" -ge 4 ]; then
    wait "${pids[0]}"
    pids=("${pids[@]:1}")
    running=$((running - 1))
  fi
done
# Wait for remaining installs
for pid in "${pids[@]}"; do
  wait "$pid"
done
echo "  App deps installed."

# Symlink the local @junkyardsh/ui build into each app's node_modules so
# they pick up subpath exports (./ai, ./pdf) not yet published to npm.
# Also symlink at repo root for imports resolved from kit/ (e.g. workerInference.ts).
echo "  Symlinking local @junkyardsh/ui into app node_modules..."
mkdir -p "$ROOT/node_modules/@junkyardsh"
rm -rf "$ROOT/node_modules/@junkyardsh/ui"
ln -s "$ROOT/packages/ui" "$ROOT/node_modules/@junkyardsh/ui"
for d in "$ROOT"/apps/*/; do
  target="$d/node_modules/@junkyardsh/ui"
  if [ -d "$target" ]; then
    rm -rf "$target"
    ln -s "$ROOT/packages/ui" "$target"
  fi
done

echo "==> Building apps"
built=0
for d in "$ROOT"/apps/*/; do
  slug="$(basename "$d")"
  echo "  -> $slug"
  cd "$d"
  bunx vite build --base="/$slug/" --outDir "$DIST/$slug" --emptyOutDir
  built=$((built + 1))
done

echo "==> Injecting Umami analytics into dist/"
bun "$ROOT/scripts/inject-umami.mjs"

# Ensure CNAME is correct at root - defensive re-write in case an app build
# somehow touched the dist root (it won't since each app uses --outDir to a
# subdirectory, but be explicit).
printf 'junkyard.mrzk.io' > "$DIST/CNAME"
# Prevent GitHub Pages from running Jekyll, which silently 404s any _-prefixed asset.
printf '' > "$DIST/.nojekyll"

echo ""
echo "==> Build complete"
echo "    Apps built: $built"
echo -n "    dist/index.html: "
test -f "$DIST/index.html" || { echo "MISSING"; exit 1; }
echo "OK"

# Spot-check a few app index files
for slug in json css pdf depth; do
  echo -n "    dist/$slug/index.html: "
  if test -f "$DIST/$slug/index.html"; then echo "OK"; else echo "MISSING"; exit 1; fi
done

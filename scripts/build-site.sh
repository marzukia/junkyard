#!/usr/bin/env bash
set -euo pipefail

# The transformers.js apps (bg, caption, depth, summarize, transcribe,
# translate, upscale) pull onnxruntime-node, whose postinstall tries to
# download CUDA GPU binaries and 403s on CI. These are browser apps that only
# use onnxruntime-web in the bundle, so skip the Node CUDA EP download.
export npm_config_onnxruntime_node_install_cuda=skip
export ONNXRUNTIME_NODE_INSTALL_CUDA=skip

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"

echo "==> Generating catalogue from apps/*/junkyard.json"
node "$ROOT/scripts/gen-catalogue.mjs"

echo "==> Building hub into $DIST"
cd "$ROOT/hub"
npm ci
npx vite build --outDir "$DIST" --emptyOutDir

echo "==> Building apps"
built=0
for d in "$ROOT"/apps/*/; do
  slug="$(basename "$d")"
  echo "  -> $slug"
  cd "$d"
  npm ci
  npx vite build --base="/$slug/" --outDir "$DIST/$slug" --emptyOutDir
  built=$((built + 1))
done

# Ensure CNAME is correct at root - defensive re-write in case an app build
# somehow touched the dist root (it won't since each app uses --outDir to a
# subdirectory, but be explicit).
printf 'junkyard.mrzk.io' > "$DIST/CNAME"

echo ""
echo "==> Build complete"
echo "    Apps built: $built"
echo -n "    dist/index.html: "
test -f "$DIST/index.html" && echo "OK" || echo "MISSING"

# Spot-check a few app index files
for slug in json css pdf depth; do
  echo -n "    dist/$slug/index.html: "
  test -f "$DIST/$slug/index.html" && echo "OK" || echo "MISSING (app may not exist)"
done

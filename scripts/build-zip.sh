#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

DIST_DIR="dist"
ZIP_NAME="mini-translate-extension.zip"

rm -rf "$DIST_DIR" "$ZIP_NAME"

mkdir -p "$DIST_DIR"

# Copy extension assets and source modules required by MV3 service worker/options
rsync -a public/ "$DIST_DIR"/
rsync -a src/ "$DIST_DIR"/src/

# Fix import paths in background.js (portable sed)
echo "🔧 Fixing import paths in background.js (portable sed)..."
# Determine sed in-place syntax across environments
if command -v gsed >/dev/null 2>&1; then
  SED_INPLACE=(gsed -i)
elif sed --version >/dev/null 2>&1; then
  # GNU sed
  SED_INPLACE=(sed -i)
else
  # BSD sed (macOS)
  SED_INPLACE=(sed -i '')
fi

if [ -f "$DIST_DIR/background.js" ]; then
  "${SED_INPLACE[@]}" $'s|from '\''../src/|from '\''./src/|g' "$DIST_DIR/background.js" || true
  "${SED_INPLACE[@]}" $'s|from "../src/|from "./src/|g' "$DIST_DIR/background.js" || true
else
  echo "(info) $DIST_DIR/background.js not found; skip path fix"
fi

(
  cd "$DIST_DIR"
  zip -r "../$ZIP_NAME" . >/dev/null
)

echo "Created $ZIP_NAME (load the unzipped dist/ directory for development)."

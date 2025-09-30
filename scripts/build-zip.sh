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

# Fix import paths in background.js
echo "🔧 Fixing import paths in background.js..."
sed -i '' 's|from '\''../src/|from '\''./src/|g' "$DIST_DIR/background.js"
sed -i '' 's|from "../src/|from "./src/|g' "$DIST_DIR/background.js"

(
  cd "$DIST_DIR"
  zip -r "../$ZIP_NAME" . >/dev/null
)

echo "Created $ZIP_NAME (load the unzipped dist/ directory for development)."

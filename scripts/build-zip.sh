#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

DIST_DIR="dist"
ZIP_NAME="mini-translate-extension.zip"

rm -rf "$DIST_DIR" "$ZIP_NAME"

mkdir -p "$DIST_DIR"

# Copy extension assets
rsync -a public/ "$DIST_DIR"/

# Copy shared modules needed by background/options/content
rsync -a src/ "$DIST_DIR"/src/

# Adjust module import paths for packaged artifacts
if [[ -f "$DIST_DIR/background.js" ]]; then
  perl -0pi -e 's#\./src/#./src/#g; s#\.\./src/#./src/#g' "$DIST_DIR/background.js"
fi
if [[ -f "$DIST_DIR/options.js" ]]; then
  perl -0pi -e 's#\./src/#./src/#g; s#\.\./src/#./src/#g' "$DIST_DIR/options.js"
fi

(
  cd "$DIST_DIR"
  zip -r "../$ZIP_NAME" . >/dev/null
)

echo "Created $ZIP_NAME (load the unzipped dist/ directory for development)."

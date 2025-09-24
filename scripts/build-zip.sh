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
(
  cd "$DIST_DIR"
  zip -r "../$ZIP_NAME" . >/dev/null
)

echo "Created $ZIP_NAME (load the unzipped dist/ directory for development)."

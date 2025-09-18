#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

ZIP_NAME="mini-translate.zip"
rm -f "$ZIP_NAME"

zip -r "$ZIP_NAME" public src docs package.json package-lock.json README.md >/dev/null
echo "Created $ZIP_NAME"



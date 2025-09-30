#!/usr/bin/env bash
set -euo pipefail

# 修复dist/background.js中的import路径
# 将 ../src/ 替换为 ./src/

DIST_DIR="dist"
BACKGROUND_FILE="$DIST_DIR/background.js"

if [[ -f "$BACKGROUND_FILE" ]]; then
  echo "🔧 Fixing import paths in background.js..."
  
  # 备份原文件
  cp "$BACKGROUND_FILE" "$BACKGROUND_FILE.backup"
  
  # 替换import路径
  sed -i '' 's|from '\''../src/|from '\''./src/|g' "$BACKGROUND_FILE"
  sed -i '' 's|from "../src/|from "./src/|g' "$BACKGROUND_FILE"
  
  echo "✅ Import paths fixed in background.js"
else
  echo "❌ background.js not found in $DIST_DIR"
  exit 1
fi

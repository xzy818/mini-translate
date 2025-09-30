#!/usr/bin/env bash
set -euo pipefail

# 将ES6模块转换为传统脚本的构建脚本
# 解决Chrome扩展Service Worker中ES6模块兼容性问题

DIST_DIR="dist"
BACKGROUND_FILE="$DIST_DIR/background.js"

echo "🔧 Converting ES6 modules to traditional scripts..."

# 备份原文件
cp "$BACKGROUND_FILE" "$BACKGROUND_FILE.es6-backup"

# 创建新的background.js，使用importScripts而不是import
cat > "$BACKGROUND_FILE" << 'EOF'
// 使用importScripts加载依赖模块
importScripts('./src/services/context-menu.js');
importScripts('./src/services/translator.js');
importScripts('./src/services/ai-api-client.js');
importScripts('./src/config/model-providers.js');

let initialized = false;
let aiApiClient = null;
EOF

# 添加原始background.js的其余内容（跳过import语句）
tail -n +16 "$BACKGROUND_FILE.es6-backup" >> "$BACKGROUND_FILE"

echo "✅ Converted to traditional script format"

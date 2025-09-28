#!/bin/bash

# 构建保护脚本 - 防止手动修改 dist 文件
# 此脚本确保 dist 目录始终从源码构建，不会被手动修改

echo "🔒 构建保护: 检查 dist 目录状态..."

# 检查 dist 目录是否存在
if [ ! -d "dist" ]; then
    echo "❌ dist 目录不存在，需要重新构建"
    exit 1
fi

# 检查关键文件是否存在
REQUIRED_FILES=(
    "dist/background.js"
    "dist/content.js"
    "dist/qa-bridge.js"
    "dist/services/context-menu.js"
    "dist/services/translator.js"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ 缺少必要文件: $file"
        exit 1
    fi
done

# 检查 background.js 中的 import 路径
if grep -q "from '../src/services/" dist/background.js; then
    echo "❌ 检测到错误的 import 路径，需要重新构建"
    echo "请运行: npm run build"
    exit 1
fi

# 检查 qa-bridge.js 中是否包含新的 API 方法
if ! grep -q "applyTerm" dist/qa-bridge.js; then
    echo "❌ 检测到缺失的 QA API 方法，需要重新构建"
    echo "请运行: npm run build"
    exit 1
fi

echo "✅ 构建保护检查完成"

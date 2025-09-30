#!/usr/bin/env bash
set -euo pipefail

# 测试扩展加载的脚本
echo "🧪 Testing Chrome Extension Loading..."

# 清理现有Chrome进程
bash scripts/kill-chrome-mcp.sh

# 启动Chrome with extension
echo "🚀 Starting Chrome with extension..."
bash scripts/start-chrome-mcp.sh &
CHROME_PID=$!

# 等待Chrome启动
sleep 5

# 检查Chrome是否启动
if ! curl -s "http://localhost:9222/json" > /dev/null; then
    echo "❌ Chrome failed to start"
    exit 1
fi

echo "✅ Chrome started successfully"

# 检查扩展是否加载
echo "🔍 Checking for loaded extensions..."
EXTENSIONS=$(curl -s "http://localhost:9222/json" | jq '.[] | select(.url | contains("chrome-extension"))')

if [ -z "$EXTENSIONS" ]; then
    echo "❌ No extensions found loaded"
    echo "🔍 Available targets:"
    curl -s "http://localhost:9222/json" | jq '.[] | {type, url, title}'
    exit 1
else
    echo "✅ Extensions found:"
    echo "$EXTENSIONS"
fi

# 检查Service Worker
echo "🔍 Checking for Service Workers..."
SERVICE_WORKERS=$(curl -s "http://localhost:9222/json" | jq '.[] | select(.type == "service_worker")')

if [ -z "$SERVICE_WORKERS" ]; then
    echo "❌ No Service Workers found"
    exit 1
else
    echo "✅ Service Workers found:"
    echo "$SERVICE_WORKERS"
fi

echo "🎉 Extension loading test passed!"
bash scripts/kill-chrome-mcp.sh

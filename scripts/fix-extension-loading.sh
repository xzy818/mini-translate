#!/usr/bin/env bash
set -euo pipefail

# 修复Chrome扩展加载问题的脚本
echo "🔧 Fixing Chrome Extension Loading Issues..."

# 清理现有Chrome进程
echo "🧹 Cleaning up existing Chrome processes..."
pkill -f "Google Chrome for Testing" || true
sleep 2

# 检查Chrome for Testing是否存在
CHROME_PATH="/Users/dr.yang/code/mini-translate/.cache/chrome-for-testing/140.0.7339.207/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"

if [[ ! -x "$CHROME_PATH" ]]; then
    echo "❌ Chrome for Testing not found. Please install Chrome for Testing manually."
    echo "   Download from: https://developer.chrome.com/docs/chrome-for-testing/"
    exit 1
fi

# 检查扩展目录
DIST_DIR="$(pwd)/dist"
if [[ ! -d "$DIST_DIR" ]]; then
    echo "❌ dist/ directory not found. Building..."
    npm run build
fi

# 检查manifest.json
if [[ ! -f "$DIST_DIR/manifest.json" ]]; then
    echo "❌ manifest.json not found in dist/"
    exit 1
fi

echo "✅ Extension files verified"

# 尝试不同的Chrome启动参数
echo "🚀 Trying different Chrome startup approaches..."

# 方法1: 使用Chrome for Testing with minimal flags
echo "📋 Method 1: Chrome for Testing with minimal flags"
"$CHROME_PATH" \
  --remote-debugging-port=9225 \
  --user-data-dir=/tmp/mini-translate-method1 \
  --no-first-run \
  --load-extension="$DIST_DIR" \
  --disable-web-security \
  --disable-features=VizDisplayCompositor \
  --auto-open-devtools-for-tabs &
CHROME_PID1=$!

sleep 5

# 检查方法1是否成功
if curl -s "http://localhost:9225/json" > /dev/null; then
    echo "✅ Method 1: Chrome started successfully"
    
    # 检查扩展是否加载
    EXTENSIONS=$(curl -s "http://localhost:9225/json" | jq '.[] | select(.url | contains("chrome-extension"))')
    if [[ -n "$EXTENSIONS" ]]; then
        echo "✅ Method 1: Extensions loaded successfully"
        echo "$EXTENSIONS"
        kill $CHROME_PID1
        exit 0
    else
        echo "❌ Method 1: No extensions found"
    fi
else
    echo "❌ Method 1: Chrome failed to start"
fi

kill $CHROME_PID1 2>/dev/null || true
sleep 2

# 方法2: 使用Chrome for Testing with development flags
echo "📋 Method 2: Chrome for Testing with development flags"
"$CHROME_PATH" \
  --remote-debugging-port=9226 \
  --user-data-dir=/tmp/mini-translate-method2 \
  --no-first-run \
  --load-extension="$DIST_DIR" \
  --enable-extensions \
  --disable-extensions-file-access-check \
  --disable-extensions-content-verification \
  --auto-open-devtools-for-tabs &
CHROME_PID2=$!

sleep 5

# 检查方法2是否成功
if curl -s "http://localhost:9226/json" > /dev/null; then
    echo "✅ Method 2: Chrome started successfully"
    
    # 检查扩展是否加载
    EXTENSIONS=$(curl -s "http://localhost:9226/json" | jq '.[] | select(.url | contains("chrome-extension"))')
    if [[ -n "$EXTENSIONS" ]]; then
        echo "✅ Method 2: Extensions loaded successfully"
        echo "$EXTENSIONS"
        kill $CHROME_PID2
        exit 0
    else
        echo "❌ Method 2: No extensions found"
    fi
else
    echo "❌ Method 2: Chrome failed to start"
fi

kill $CHROME_PID2 2>/dev/null || true
sleep 2

# 方法3: 使用标准Chrome (如果可用)
echo "📋 Method 3: Standard Chrome (if available)"
STANDARD_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if [[ -x "$STANDARD_CHROME" ]]; then
    "$STANDARD_CHROME" \
      --remote-debugging-port=9227 \
      --user-data-dir=/tmp/mini-translate-method3 \
      --no-first-run \
      --load-extension="$DIST_DIR" \
      --auto-open-devtools-for-tabs &
    CHROME_PID3=$!
    
    sleep 5
    
    # 检查方法3是否成功
    if curl -s "http://localhost:9227/json" > /dev/null; then
        echo "✅ Method 3: Chrome started successfully"
        
        # 检查扩展是否加载
        EXTENSIONS=$(curl -s "http://localhost:9227/json" | jq '.[] | select(.url | contains("chrome-extension"))')
        if [[ -n "$EXTENSIONS" ]]; then
            echo "✅ Method 3: Extensions loaded successfully"
            echo "$EXTENSIONS"
            kill $CHROME_PID3
            exit 0
        else
            echo "❌ Method 3: No extensions found"
        fi
    else
        echo "❌ Method 3: Chrome failed to start"
    fi
    
    kill $CHROME_PID3 2>/dev/null || true
else
    echo "❌ Method 3: Standard Chrome not available"
fi

echo "💥 All methods failed. Chrome extension loading issue confirmed."
exit 1

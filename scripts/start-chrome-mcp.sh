#!/usr/bin/env bash
set -euo pipefail

# CI 保护：禁止在 CI 环境运行 chrome-mcp 启动脚本
if [[ "${CI:-}" == "true" || "${CI:-}" == "1" ]]; then
  echo "[start-chrome-mcp] Detected CI environment. chrome-mcp is local-only. Aborting." >&2
  exit 0
fi

CFT_CACHE_DIR="$(pwd)/.cache/chrome-for-testing"
if [[ -z "${CHROME_PATH:-}" ]]; then
  if [[ -d "$CFT_CACHE_DIR" ]]; then
    CFT_CANDIDATE=$(find "$CFT_CACHE_DIR" -path '*chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' -maxdepth 6 2>/dev/null | sort | tail -n 1)
    if [[ -n "$CFT_CANDIDATE" ]]; then
      CHROME_PATH="$CFT_CANDIDATE"
    fi
  fi
fi
CHROME_PATH=${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}
PROFILE_DIR=${CHROME_PROFILE:-/tmp/mini-translate-mcp}
PORT=${MCP_CHROME_PORT:-9222}
EXT_DIR=${EXTENSION_DIR:-$(pwd)/dist}
LOG_FILE=${CHROME_LOG_FILE:-/tmp/mini-translate-mcp.log}

if [[ ! -x "$CHROME_PATH" ]]; then
  echo "[start-chrome-mcp] Chrome executable not found: $CHROME_PATH" >&2
  echo "[start-chrome-mcp] Hint: run 'node scripts/mcp/install-chrome.mjs' to download Chrome for Testing." >&2
  exit 1
fi

if [[ "$CHROME_PATH" == */Google\ Chrome.app/* ]]; then
  echo "[start-chrome-mcp] WARNING: Standard Google Chrome blocks --load-extension. Install Chrome for Testing and set CHROME_PATH accordingly." >&2
fi

mkdir -p "$PROFILE_DIR"

"$CHROME_PATH" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE_DIR" \
  --no-first-run \
  --no-default-browser-check \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --disable-component-update \
  --disable-extensions-file-access-check \
  --disable-extensions-content-verification \
  --disable-extensions-http-throttling \
  --disable-ipc-flooding-protection \
  --disable-site-isolation-trials \
  --disable-features=DialMediaRouter,PreloadMediaEngagementData \
  --enable-logging \
  --v=1 \
  --vmodule=*extensions*=3 \
  --load-extension="$EXT_DIR" \
  --auto-open-devtools-for-tabs \
  "https://example.com/" \
  >"$LOG_FILE" 2>&1 &

PID=$!
echo $PID > "$PROFILE_DIR/chrome.pid"

echo "[start-chrome-mcp] Chrome started on port $PORT (pid=$PID). Logs: $LOG_FILE"

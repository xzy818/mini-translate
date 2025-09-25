#!/usr/bin/env bash
set -euo pipefail

PROFILE_DIR=${PROFILE_DIR:-"/tmp/mini-translate-mcp"}
PID_FILE="$PROFILE_DIR/chrome.pid"

if [[ -f "$PID_FILE" ]]; then
  CHROME_PID=$(cat "$PID_FILE")
  if kill -0 "$CHROME_PID" >/dev/null 2>&1; then
    echo "[stop-chrome] Terminating Chrome PID $CHROME_PID"
    kill "$CHROME_PID"
    sleep 2
  fi
  rm -f "$PID_FILE"
fi

# 清理由我们创建的 profile 以避免下次启动混淆
rm -rf "$PROFILE_DIR"

echo "[stop-chrome] Chrome (profile $PROFILE_DIR) stopped."

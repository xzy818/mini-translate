#!/usr/bin/env bash
set -euo pipefail

PROFILE_DIR=${CHROME_PROFILE:-/tmp/mini-translate-mcp}
PORT=${MCP_CHROME_PORT:-9222}

if [[ -f "$PROFILE_DIR/chrome.pid" ]]; then
  PID=$(cat "$PROFILE_DIR/chrome.pid")
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    wait "$PID" 2>/dev/null || true
    echo "[kill-chrome-mcp] Terminated Chrome process $PID"
  fi
  rm -f "$PROFILE_DIR/chrome.pid"
fi

# Fallback: ensure no stray process listening on port
PIDS=$(lsof -t -i :"$PORT" || true)
if [[ -n "$PIDS" ]]; then
  echo "[kill-chrome-mcp] Forcing termination for processes on port $PORT: $PIDS"
  kill $PIDS || true
fi

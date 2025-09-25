#!/usr/bin/env bash
set -euo pipefail

CHROME_PATH=${CHROME_PATH:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
PROFILE_DIR=${PROFILE_DIR:-"/tmp/mini-translate-mcp"}
EXT_DIR=${EXT_DIR:-"$(pwd)/dist"}
PORT=${PORT:-9222}
LOG_FILE=${LOG_FILE:-"/tmp/mini-translate-mcp.log"}

if [[ ! -d "$EXT_DIR" ]]; then
  echo "[start-chrome] dist directory not found at $EXT_DIR. Run npm run build first." >&2
  exit 1
fi

if lsof -i :"$PORT" >/dev/null 2>&1; then
  echo "[start-chrome] Port $PORT already in use. Stop existing Chrome or change PORT env." >&2
  exit 1
fi

rm -rf "$PROFILE_DIR"
mkdir -p "$PROFILE_DIR"

echo "[start-chrome] Launching Chrome with extension from $EXT_DIR using profile $PROFILE_DIR"
"$CHROME_PATH" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE_DIR" \
  --load-extension="$EXT_DIR" \
  --disable-backgrounding-occluded-windows \
  --autoplay-policy=no-user-gesture-required \
  --no-first-run \
  --enable-automation \
  --disable-infobars \
  --disable-gpu \
  --disable-dev-shm-usage \
  --window-size=1280,800 \
  --allow-file-access-from-files \
  --no-default-browser-check \
  >"$LOG_FILE" 2>&1 &

CHROME_PID=$!

echo "$CHROME_PID" > "$PROFILE_DIR/chrome.pid"

echo "[start-chrome] Chrome started with PID $CHROME_PID; logs at $LOG_FILE"

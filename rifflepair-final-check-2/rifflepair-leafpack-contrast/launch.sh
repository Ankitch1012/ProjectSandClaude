#!/usr/bin/env bash
set -u

TASK_ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG="${BOOT_LOG:-/tmp/launch.log}"; : > "$LOG"
log(){ echo "launch.sh: $*"; echo "$*" >> "$LOG"; }

BACKEND_PORT="${BACKEND_PORT:-5000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

find_app() {
  local base d n
  for base in "$TASK_ROOT/environment" /app "$TASK_ROOT"; do
    [ -d "$base" ] || continue
    for d in "$base"/*/; do
      d="${d%/}"; n="$(basename "$d")"
      case "$n" in problem_assets|tests|solution|node_modules|.*) continue;; esac
      if [ -d "$d/backend" ] && [ -d "$d/frontend" ]; then echo "$d"; return 0; fi
    done
  done
  return 1
}
APP="${APP_DIR:-$(find_app || true)}"
[ -n "$APP" ] && [ -d "$APP" ] || { log "ERROR: could not locate the Python app"; exit 3; }
log "app dir: $APP"

wait_url() {
  local url="$1" t="$2" label="$3" i=0
  while [ "$i" -lt "$t" ]; do
    if curl -sf -o /dev/null "$url" 2>/dev/null; then
      log "$label is up"; return 0
    fi
    sleep 1; i=$((i+1))
  done
  return 1
}

BE_PID=""; FE_PID=""
cleanup(){ [ -n "$FE_PID" ] && kill "$FE_PID" 2>/dev/null; [ -n "$BE_PID" ] && kill "$BE_PID" 2>/dev/null; }
trap cleanup EXIT INT TERM

( cd "$APP" && PYTHONDONTWRITEBYTECODE=1 PORT="$BACKEND_PORT" python3 backend/server.py ) >> "$LOG" 2>&1 &
BE_PID=$!
wait_url "http://localhost:$BACKEND_PORT/api/health" 120 backend \
  || { log "ERROR: backend did not become reachable"; exit 1; }

( cd "$APP" && PYTHONDONTWRITEBYTECODE=1 PORT="$FRONTEND_PORT" python3 frontend/server.py ) >> "$LOG" 2>&1 &
FE_PID=$!
APP_URL="http://127.0.0.1:$FRONTEND_PORT"
if wait_url "$APP_URL" 120 app; then
  echo "APP_URL=${APP_URL}"
  log "app is up at ${APP_URL}"
else
  log "ERROR: app did not become reachable"
  exit 1
fi
wait

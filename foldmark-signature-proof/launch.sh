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
      if [ -f "$d/package.json" ] || [ -d "$d/backend" ]; then echo "$d"; return 0; fi
    done
  done
  return 1
}
APP="${APP_DIR:-$(find_app || true)}"
[ -n "$APP" ] && [ -d "$APP" ] || { log "ERROR: could not locate the app dir under environment/ or /app"; exit 3; }
log "app dir: $APP"

wait_url() {
  local url="$1" t="$2" label="$3" i=0
  while [ "$i" -lt "$t" ]; do
    if curl -sf -o /dev/null "$url" 2>/dev/null || \
       curl -s -o /dev/null -w '%{http_code}' "$url" 2>/dev/null | grep -qE '^(200|301|302|401|404)$'; then
      log "$label is up"; return 0
    fi
    sleep 2; i=$((i+2))
  done
  return 1
}

BE_PID=""; FE_PID=""
cleanup(){ [ -n "$FE_PID" ] && kill "$FE_PID" 2>/dev/null; [ -n "$BE_PID" ] && kill "$BE_PID" 2>/dev/null; }
trap cleanup EXIT INT TERM

APP_URL="http://127.0.0.1:$FRONTEND_PORT"

boot_backend() {
  log "starting backend on :$BACKEND_PORT..."
  ( cd "$APP/backend" && NODE_ENV=development PORT="$BACKEND_PORT" node server.js ) >> "$LOG" 2>&1 &
  BE_PID=$!
  wait_url "http://localhost:$BACKEND_PORT/api/health" 90 backend \
    || wait_url "http://localhost:$BACKEND_PORT" 30 backend \
    || log "WARN: backend health not confirmed, continuing"
}

boot_frontend() {
  log "starting frontend on :$FRONTEND_PORT..."
  # Do not remove DANGEROUSLY_DISABLE_HOST_CHECK: without it react-scripts 5 /
  # webpack-dev-server 4 rejects its own config in the container and never starts.
  ( cd "$APP/frontend" && BROWSER=none CI=false PORT="$FRONTEND_PORT" HOST=0.0.0.0 \
      DANGEROUSLY_DISABLE_HOST_CHECK=true npm start ) >> "$LOG" 2>&1 &
  FE_PID=$!
}

boot_backend
boot_frontend

if wait_url "$APP_URL" 300 app; then
  echo "APP_URL=${APP_URL}"
  log "app is up at ${APP_URL}"
else
  log "ERROR: app did not become reachable at ${APP_URL} (see $LOG)"
  tail -30 "$LOG" >&2 2>/dev/null || true
  exit 1
fi
wait

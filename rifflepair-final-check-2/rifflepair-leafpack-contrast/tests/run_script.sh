#!/usr/bin/env bash
set -u

LOG_DIR="/logs/verifier"
mkdir -p "$LOG_DIR" /logs/artifacts
OUT="$LOG_DIR/test_output.txt"; : > "$OUT"
export ARTIFACTS_DIR="/logs/artifacts"

BACKEND_PORT="${BACKEND_PORT:-5000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
TESTS_DIR="$(cd "$(dirname "$0")" && pwd)"
log(){ echo "[run_script] $*" | tee -a "$OUT"; }

REPO_DIR="${REPO_DIR:-}"
if [ -z "$REPO_DIR" ]; then
  for base in /app /workspace /repo /code "$(pwd)"; do
    [ -d "$base" ] || continue
    if [ -d "$base/backend" ] && [ -d "$base/frontend" ]; then REPO_DIR="$base"; break; fi
    for d in "$base"/*/; do
      d="${d%/}"
      case "$(basename "$d")" in problem_assets|tests|solution|node_modules|.*) continue;; esac
      if [ -d "$d/backend" ] && [ -d "$d/frontend" ]; then REPO_DIR="$d"; break 2; fi
    done
  done
fi
[ -n "$REPO_DIR" ] && [ -d "$REPO_DIR" ] || {
  log "ERROR: could not locate Python application"
  echo "PLAYWRIGHT_EXIT=99" >> "$OUT"
  exit 1
}
log "repo: $REPO_DIR"

if [ ! -e "$TESTS_DIR/node_modules" ]; then
  if [ -d /opt/playwright-runner/node_modules ]; then
    ln -sfn /opt/playwright-runner/node_modules "$TESTS_DIR/node_modules"
  else
    log "ERROR: Playwright runner unavailable"
    echo "PLAYWRIGHT_EXIT=95" >> "$OUT"
    exit 1
  fi
fi
PW_BIN="$TESTS_DIR/node_modules/.bin/playwright"
[ -x "$PW_BIN" ] || {
  log "ERROR: Playwright binary unavailable"
  echo "PLAYWRIGHT_EXIT=94" >> "$OUT"
  exit 1
}

BE_PID=""; FE_PID=""
cleanup(){
  [ -n "$BE_PID" ] && kill "$BE_PID" 2>/dev/null || true
  [ -n "$FE_PID" ] && kill "$FE_PID" 2>/dev/null || true
}
trap cleanup EXIT

wait_url(){
  local url="$1" limit="$2" i=0
  while [ "$i" -lt "$limit" ]; do
    curl -sf -o /dev/null "$url" 2>/dev/null && return 0
    sleep 1; i=$((i+1))
  done
  return 1
}

( cd "$REPO_DIR" && PYTHONDONTWRITEBYTECODE=1 PORT="$BACKEND_PORT" python3 backend/server.py ) >> "$OUT" 2>&1 &
BE_PID=$!
wait_url "http://localhost:$BACKEND_PORT/api/health" 120 || {
  log "ERROR: backend failed to start"
  echo "PLAYWRIGHT_EXIT=98" >> "$OUT"
  exit 1
}

FIXTURE_PATH="/logs/verifier/fixture.json" node "$TESTS_DIR/seed_fixtures.js" >> "$OUT" 2>&1
SEED_EXIT=$?
if [ "$SEED_EXIT" -ne 0 ] || ! grep -q "SEED_OK" "$OUT"; then
  log "ERROR: fixture seeding failed"
  echo "SEED_STATUS=FAIL" >> "$OUT"
else
  echo "SEED_STATUS=OK" >> "$OUT"
fi

( cd "$REPO_DIR" && PYTHONDONTWRITEBYTECODE=1 PORT="$FRONTEND_PORT" python3 frontend/server.py ) >> "$OUT" 2>&1 &
FE_PID=$!
wait_url "http://localhost:$FRONTEND_PORT" 120 || {
  log "ERROR: frontend failed to start"
  echo "PLAYWRIGHT_EXIT=97" >> "$OUT"
  exit 1
}

BACKEND_URL="http://localhost:$BACKEND_PORT"
FRONTEND_URL="http://localhost:$FRONTEND_PORT"
PW_JSON="$LOG_DIR/playwright_results.json"
rm -f "$PW_JSON"
echo "===PLAYWRIGHT_BEGIN===" >> "$OUT"
( cd "$TESTS_DIR" \
  && FRONTEND_URL="$FRONTEND_URL" BACKEND_URL="$BACKEND_URL" \
     PLAYWRIGHT_JSON_OUTPUT_NAME="$PW_JSON" \
     "$PW_BIN" test --reporter=list,json ) >> "$OUT" 2>&1
TEST_EXIT=$?
echo "===PLAYWRIGHT_END===" >> "$OUT"
echo "PLAYWRIGHT_EXIT=$TEST_EXIT" >> "$OUT"
[ -f "$PW_JSON" ] && echo "PLAYWRIGHT_JSON=$PW_JSON" >> "$OUT"
cp "$OUT" "$ARTIFACTS_DIR/test_output.txt" 2>/dev/null || true
cp "$PW_JSON" "$ARTIFACTS_DIR/playwright_results.json" 2>/dev/null || true
log "playwright exit code: $TEST_EXIT"
exit "$TEST_EXIT"

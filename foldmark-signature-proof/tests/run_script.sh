#!/usr/bin/env bash
set -u

LOG_DIR="/logs/verifier"
mkdir -p "$LOG_DIR"
OUT="$LOG_DIR/test_output.txt"
: > "$OUT"

ARTIFACTS_DIR="/logs/artifacts"
mkdir -p "$ARTIFACTS_DIR"
export ARTIFACTS_DIR

BACKEND_PORT="${BACKEND_PORT:-5000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

log() { echo "[run_script] $*" | tee -a "$OUT"; }

TESTS_DIR="$(cd "$(dirname "$0")" && pwd)"

is_app_root() {
  [ -f "$1/package.json" ] || [ -f "$1/angular.json" ] || [ -d "$1/backend" ] \
    || ls "$1"/*.sln >/dev/null 2>&1 || ls "$1"/backend/*.csproj >/dev/null 2>&1
}

REPO_DIR="${REPO_DIR:-}"
if [ -z "$REPO_DIR" ]; then
  for base in /app /workspace /repo /code "$(pwd)"; do
    [ -d "$base" ] || continue
    if is_app_root "$base"; then REPO_DIR="$base"; break; fi
    for d in "$base"/*/; do
      d="${d%/}"
      case "$(basename "$d")" in problem_assets|tests|solution|node_modules|.*) continue;; esac
      if is_app_root "$d"; then REPO_DIR="$d"; break 2; fi
    done
  done
fi
if [ -z "$REPO_DIR" ] || [ ! -d "$REPO_DIR" ]; then
  log "ERROR: could not locate the application repository"
  echo "PLAYWRIGHT_EXIT=99" >> "$OUT"
  exit 1
fi
log "repo:  $REPO_DIR"
log "tests: $TESTS_DIR"

MANIFEST="$TESTS_DIR/repo_test_manifest.sha256"
if [ -f "$MANIFEST" ]; then
  integrity_ok=1
  if ! ( cd "$REPO_DIR" && sha256sum -c --quiet "$MANIFEST" ) >>"$OUT" 2>&1; then
    log "ERROR: a test file was modified or deleted"
    integrity_ok=0
  fi
  if [ "$integrity_ok" -ne 1 ]; then
    log "ERROR: test-file integrity check FAILED -- run rejected"
    echo "TEST_INTEGRITY=FAIL" >> "$OUT"
    echo "PLAYWRIGHT_EXIT=97" >> "$OUT"
    exit 1
  fi
  echo "TEST_INTEGRITY=OK" >> "$OUT"
  log "test-file integrity check passed"
else
  log "WARNING: test manifest not found ($MANIFEST) -- integrity check skipped"
  echo "TEST_INTEGRITY=SKIPPED" >> "$OUT"
fi

if [ ! -e "$TESTS_DIR/node_modules" ]; then
  if [ -d /opt/playwright-runner/node_modules ]; then
    ln -sfn /opt/playwright-runner/node_modules "$TESTS_DIR/node_modules"
    log "linked Playwright runner from /opt/playwright-runner"
  else
    log "ERROR: Playwright runner not found at /opt/playwright-runner"
    echo "PLAYWRIGHT_EXIT=95" >> "$OUT"
    exit 1
  fi
fi
PW_BIN="$TESTS_DIR/node_modules/.bin/playwright"
if [ ! -x "$PW_BIN" ]; then
  log "ERROR: Playwright binary not found at $PW_BIN"
  echo "PLAYWRIGHT_EXIT=94" >> "$OUT"
  exit 1
fi

BACKEND_PID=""
FRONTEND_PID=""
cleanup() {
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT

wait_url() {
  local url="$1" t="$2" label="$3" i=0
  while [ "$i" -lt "$t" ]; do
    if curl -sf -o /dev/null "$url" 2>/dev/null || \
       curl -s -o /dev/null -w '%{http_code}' "$url" 2>/dev/null | grep -qE '^(200|301|302|401|404)$'; then
      log "$label is up"
      return 0
    fi
    sleep 1; i=$((i+1))
  done
  return 1
}

BACKEND_HEALTH_PATH="${BACKEND_HEALTH_PATH:-/api/health}"
BACKEND_URL="http://localhost:$BACKEND_PORT"
FRONTEND_URL="http://localhost:$FRONTEND_PORT"

boot_backend() {
  rm -f "$REPO_DIR/backend/database.sqlite"
  log "starting backend on :$BACKEND_PORT..."
  ( cd "$REPO_DIR/backend" && NODE_ENV=development PORT="$BACKEND_PORT" node server.js ) >> "$OUT" 2>&1 &
  BACKEND_PID=$!
  wait_url "$BACKEND_URL$BACKEND_HEALTH_PATH" 180 backend || wait_url "$BACKEND_URL" 30 backend || return 1
}

boot_frontend() {
  log "starting frontend on :$FRONTEND_PORT..."
  # Do not remove DANGEROUSLY_DISABLE_HOST_CHECK: without it react-scripts 5 /
  # webpack-dev-server 4 rejects its own config in the container and never starts.
  ( cd "$REPO_DIR/frontend" && BROWSER=none CI=false PORT="$FRONTEND_PORT" HOST=0.0.0.0 \
      DANGEROUSLY_DISABLE_HOST_CHECK=true npm start ) >> "$OUT" 2>&1 &
  FRONTEND_PID=$!
  wait_url "$FRONTEND_URL" 240 frontend || return 1
}

if ! boot_backend; then
  log "ERROR: backend did not become ready"
  echo "PLAYWRIGHT_EXIT=98" >> "$OUT"
  exit 1
fi

SEEDER="$TESTS_DIR/seed_fixtures.js"
if [ -f "$SEEDER" ]; then
  SEED_CWD="$REPO_DIR/backend"
  [ -d "$SEED_CWD" ] || SEED_CWD="$REPO_DIR"
  log "seeding behavioral fixtures (cwd $SEED_CWD)..."
  echo "===SEED_BEGIN===" >> "$OUT"
  ( cd "$SEED_CWD" && node "$SEEDER" ) >> "$OUT" 2>&1
  SEED_EXIT=$?
  echo "===SEED_END===" >> "$OUT"
  if [ "$SEED_EXIT" -ne 0 ] || ! grep -q "SEED_OK" "$OUT"; then
    log "ERROR: fixture seeding failed (exit $SEED_EXIT)"
    echo "SEED_STATUS=FAIL" >> "$OUT"
  else
    log "fixture seeding completed"
    echo "SEED_STATUS=OK" >> "$OUT"
  fi
else
  log "no seed_fixtures.js -- skipping fixture seeding"
  echo "SEED_STATUS=SKIPPED" >> "$OUT"
fi

if ! boot_frontend; then
  log "ERROR: frontend did not become ready"
  echo "PLAYWRIGHT_EXIT=97" >> "$OUT"
  exit 1
fi

log "running Playwright behavioral tests..."
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
if [ -f "$PW_JSON" ]; then
  echo "PLAYWRIGHT_JSON=$PW_JSON" >> "$OUT"
else
  log "WARNING: Playwright JSON report not produced"
fi

cp "$OUT" "$ARTIFACTS_DIR/test_output.txt" 2>/dev/null || true
cp "$PW_JSON" "$ARTIFACTS_DIR/playwright_results.json" 2>/dev/null || true

log "playwright exit code: $TEST_EXIT"
log "run artifacts written to: $ARTIFACTS_DIR"
exit "$TEST_EXIT"

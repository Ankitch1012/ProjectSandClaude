#!/usr/bin/env bash
# Drive the verifier against one tree.  usage: ./run-suite.sh <app-dir> <label>
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$1"
LABEL="$2"
BE_PORT="${BE_PORT:-5091}"
FE_PORT="${FE_PORT:-3091}"

OUT="$HERE/out/$LABEL"
mkdir -p "$OUT"
export FIXTURE_PATH="$OUT/fixture.json"
export FIXTURE_OUT="$FIXTURE_PATH"
export ARTIFACTS_DIR="$OUT/artifacts"
export FRONTEND_URL="http://127.0.0.1:$FE_PORT"
export BACKEND_URL="http://127.0.0.1:$BE_PORT"
export SPEC_DIR="$HERE/cribstave-dance-desk/tests"
mkdir -p "$ARTIFACTS_DIR"

free_port() {
  local pid
  for pid in $(lsof -ti "tcp:$1" -sTCP:LISTEN 2>/dev/null); do
    kill -9 "$pid" 2>/dev/null
  done
}

cleanup() {
  [ -n "${BE_PID:-}" ] && kill -9 "$BE_PID" 2>/dev/null
  [ -n "${FE_PID:-}" ] && kill -9 "$FE_PID" 2>/dev/null
  free_port "$BE_PORT"
  free_port "$FE_PORT"
  wait 2>/dev/null
}
trap cleanup EXIT

free_port "$BE_PORT"
free_port "$FE_PORT"
sleep 0.3

# exec so the recorded pid is node itself and nothing survives the run
( cd "$APP/backend" && exec env PORT="$BE_PORT" node server.js ) > "$OUT/backend.log" 2>&1 &
BE_PID=$!
( cd "$APP/frontend" && exec env PORT="$FE_PORT" BACKEND_PORT="$BE_PORT" node server.js ) > "$OUT/frontend.log" 2>&1 &
FE_PID=$!

READY=no
for i in $(seq 1 60); do
  if curl -sf -o /dev/null "$BACKEND_URL/api/health" && curl -sf -o /dev/null "$FRONTEND_URL/"; then
    READY=yes; break
  fi
  sleep 0.25
done
if [ "$READY" != yes ]; then
  echo "SERVERS DID NOT START for $LABEL"; tail -20 "$OUT/backend.log" "$OUT/frontend.log"; exit 1
fi

# prove the suite is talking to the tree it was handed
SERVED="$(curl -s "$FRONTEND_URL/app.js" | grep -c 'slice(0, 1)')"
echo "$LABEL: shell shows $SERVED first-fault-only markers"

node "$HERE/cribstave-dance-desk/tests/seed_fixtures.js" > "$OUT/seed.log" 2>&1
if ! grep -q SEED_OK "$OUT/seed.log"; then
  echo "SEED FAILED for $LABEL"; cat "$OUT/seed.log"; exit 1
fi

PLAYWRIGHT_JSON_OUTPUT_NAME="$OUT/results.json" \
"$HERE/pw/node_modules/.bin/playwright" test \
  --config "$HERE/pw/local.config.js" \
  --reporter=list,json > "$OUT/run.log" 2>&1
EXIT=$?

echo "playwright exit for $LABEL: $EXIT"
exit $EXIT

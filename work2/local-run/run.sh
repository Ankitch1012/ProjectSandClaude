#!/usr/bin/env bash
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="${APP_DIR:-$HERE/../bywash-lock-flight/environment/app}"
TESTS="$HERE/../bywash-lock-flight/tests"
BE=5071; FE=3071
pkill -f "node backend/server.js" 2>/dev/null
pkill -f "node frontend/server.js" 2>/dev/null
sleep 0.5
( cd "$APP" && PORT=$BE node backend/server.js > /tmp/by-be.log 2>&1 & echo $! > /tmp/by-be.pid )
( cd "$APP" && PORT=$FE BACKEND_PORT=$BE node frontend/server.js > /tmp/by-fe.log 2>&1 & echo $! > /tmp/by-fe.pid )
for i in $(seq 1 40); do curl -sf -o /dev/null "http://localhost:$FE/api/health" && break; sleep 0.25; done
ln -sfn "$HERE/node_modules" "$TESTS/node_modules"
trap 'rm -f "$TESTS/node_modules"' EXIT
mkdir -p /tmp/by-fixture
FIXTURE_OUT=/tmp/by-fixture/fixture.json BACKEND_URL="http://localhost:$BE" \
  node "$TESTS/seed_fixtures.js" || { echo "SEED FAILED"; exit 1; }
FRONTEND_URL="http://localhost:$FE" BACKEND_URL="http://localhost:$BE" \
  FIXTURE_PATH=/tmp/by-fixture/fixture.json ARTIFACTS_DIR=/tmp/by-artifacts \
  "$HERE/node_modules/.bin/playwright" test --config "$HERE/playwright.config.js" --reporter=list "$@"
CODE=$?
kill "$(cat /tmp/by-be.pid)" "$(cat /tmp/by-fe.pid)" 2>/dev/null
exit $CODE

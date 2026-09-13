#!/usr/bin/env bash
set -u

mkdir -p /logs/verifier /logs/artifacts
REWARD="/logs/verifier/reward.txt"
THIS_DIR="$(cd "$(dirname "$0")" && pwd)"

bash "$THIS_DIR/run_script.sh" || true
if python3 "$THIS_DIR/parser.py"; then
  echo 1 > "$REWARD"
else
  echo 0 > "$REWARD"
fi
echo "[test.sh] reward = $(cat "$REWARD")"
exit 0

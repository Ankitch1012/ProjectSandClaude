#!/usr/bin/env bash
set -u

LOG_DIR="/logs/verifier"
mkdir -p "$LOG_DIR"
mkdir -p /logs/artifacts
REWARD="$LOG_DIR/reward.txt"

THIS_DIR="$(cd "$(dirname "$0")" && pwd)"

bash "$THIS_DIR/run_script.sh" || true

if python3 "$THIS_DIR/parser.py"; then
  echo 1 > "$REWARD"
else
  echo 0 > "$REWARD"
fi

echo "[test.sh] reward = $(cat "$REWARD")"
exit 0

#!/usr/bin/env bash
set -euo pipefail

PATCH="${PATCH:-/solution/patches/source_patch.diff}"

find_app_dir(){
  local base d
  for base in /app /workspace /repo /code; do
    [ -d "$base" ] || continue
    if [ -d "$base/backend" ] && [ -d "$base/frontend" ]; then echo "$base"; return 0; fi
    for d in "$base"/*/; do
      d="${d%/}"
      case "$(basename "$d")" in problem_assets|tests|solution|node_modules|.*) continue;; esac
      if [ -d "$d/backend" ] && [ -d "$d/frontend" ]; then echo "$d"; return 0; fi
    done
  done
  return 1
}

APP_DIR="${APP_DIR:-$(find_app_dir || true)}"
[ -n "$APP_DIR" ] && [ -d "$APP_DIR" ] || { echo "[solve.sh] app not found" >&2; exit 1; }
[ -f "$PATCH" ] || { echo "[solve.sh] patch not found" >&2; exit 1; }
cd "$APP_DIR"
git apply --ignore-whitespace "$PATCH"
echo "[solve.sh] applied $PATCH"

#!/usr/bin/env bash
set -euo pipefail

PATCH="${PATCH:-/solution/patches/source_patch.diff}"

find_app_dir() {
  local base d
  for base in /app /workspace /repo /code; do
    [ -d "$base" ] || continue
    for d in "$base"/*/; do
      d="${d%/}"
      case "$(basename "$d")" in problem_assets|tests|solution|node_modules|.*) continue;; esac
      if [ -f "$d/package.json" ] || [ -f "$d/angular.json" ] || [ -d "$d/backend" ] \
         || ls "$d"/*.sln >/dev/null 2>&1; then
        echo "$d"; return 0
      fi
    done
  done
  return 1
}

# Do not remove `|| true`: under set -e a failing command substitution inside an
# assignment aborts the script before the guard below can print anything.
APP_DIR="${APP_DIR:-$(find_app_dir || true)}"
[ -n "$APP_DIR" ] && [ -d "$APP_DIR" ] || { echo "[solve.sh] ERROR: could not locate the app dir" >&2; exit 1; }
[ -f "$PATCH" ] || { echo "[solve.sh] ERROR: patch not found at $PATCH" >&2; exit 1; }

cd "$APP_DIR"
git apply --ignore-whitespace "$PATCH"
echo "[solve.sh] applied $PATCH in $APP_DIR"

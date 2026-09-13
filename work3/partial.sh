#!/usr/bin/env bash
# Fix exactly one family on top of the base and see how much of the suite clears.
set -u
cd "$(dirname "$0")"
for D in D1 D2 D3 D4 D5 D6 D7 D8 D9 D10 D11; do
  rm -rf partial-app && cp -R correct-app partial-app
  APP=partial-app python3 - "$D" <<'PY'
import pathlib, subprocess, sys, os
os.environ['PLANT_TARGET'] = 'partial-app'
PY
  # re-point plant.py at the partial tree by temporary copy
  sed "s#cribstave-dance-desk/environment/app#partial-app#" plant.py > plant-partial.py
  python3 plant-partial.py --except "$D" >/dev/null
  ./run-suite.sh "$PWD/partial-app" "partial-$D" >/dev/null 2>&1
  PASSF=$(grep -oE "✓ +[0-9]+ .*›.*" "out/partial-$D/run.log" | grep -c '\[F2P\]')
  PASSP=$(grep -oE "✓ +[0-9]+ .*›.*" "out/partial-$D/run.log" | grep -c '\[P2P\]')
  WHICH=$(grep -oE "✓ +[0-9]+ .*›.*" "out/partial-$D/run.log" | grep -oE '\[F2P\]\[D[0-9]+\]' | sort -u | tr '\n' ' ')
  printf "  fix %-4s alone -> %2d of 32 F2P green, %2d of 11 P2P green   %s\n" "$D" "$PASSF" "$PASSP" "$WHICH"
done
rm -f plant-partial.py; rm -rf partial-app

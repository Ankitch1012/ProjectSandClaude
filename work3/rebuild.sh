#!/usr/bin/env bash
# correct-app is the source of truth for the working desk.
# The task's environment/app is always rebuilt from it plus the planted families.
set -euo pipefail
cd "$(dirname "$0")"
rm -rf cribstave-dance-desk/environment/app
cp -R correct-app cribstave-dance-desk/environment/app
python3 plant.py

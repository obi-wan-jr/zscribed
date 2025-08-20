#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "[clean] Removing queue and memory json"
rm -f storage/queue.json storage/memory.json || true

echo "[clean] Clearing outputs"
find storage/outputs -type f -delete 2>/dev/null || true

echo "[clean] Clearing logs"
find storage/logs -type f -delete 2>/dev/null || true

echo "[clean] Done."

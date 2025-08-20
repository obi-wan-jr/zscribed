#!/usr/bin/env bash
set -euo pipefail

echo "[deploy] Starting dev deployment..."

if ! command -v git >/dev/null; then echo "git not found"; exit 1; fi
if ! command -v node >/dev/null; then echo "node not found"; exit 1; fi
if ! command -v npm >/dev/null; then echo "npm not found"; exit 1; fi
if ! command -v pm2 >/dev/null; then echo "pm2 not found"; exit 1; fi

BRANCH="main"
APP_NAME="dscribe"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

echo "[deploy] Resetting local changes"
git reset --hard

echo "[deploy] Pulling latest: $BRANCH"
git pull origin "$BRANCH"

echo "[deploy] Installing deps (ci)"
npm ci

echo "[deploy] Building CSS"
npx --yes tailwindcss -i public/styles.css -o public/styles.build.css --minify

echo "[deploy] Restarting PM2 app: $APP_NAME"
pm2 restart "$APP_NAME" || pm2 start ecosystem.config.cjs
pm2 save || true

sleep 1
echo "[deploy] Health check"
curl -s http://localhost:3005/api/health || true

echo "[deploy] Recent logs"
pm2 logs "$APP_NAME" --lines 50

echo "[deploy] Done."

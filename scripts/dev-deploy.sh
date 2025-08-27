#!/usr/bin/env bash
set -euo pipefail

echo "[deploy] Starting git-based deployment..."

# Validate required commands
if ! command -v git >/dev/null; then echo "git not found"; exit 1; fi
if ! command -v curl >/dev/null; then echo "curl not found"; exit 1; fi

BRANCH="main"
APP_NAME="dscribe"
DEPLOY_USER="inggo"  # Using your username for deployment
SERVER_URL="http://localhost:3005"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

echo "[deploy] Pushing local changes to origin/$BRANCH"
git push origin "$BRANCH"

echo "[deploy] Triggering remote deployment via API"
# Get session cookie and use it for deployment request
curl -s -c /tmp/deploy-cookie -X POST "$SERVER_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"user\":\"$DEPLOY_USER\"}"

echo -e "\n[deploy] Deployment API response:"
curl -s -b /tmp/deploy-cookie -X POST "$SERVER_URL/api/deploy"

echo -e "\n[deploy] Deployment triggered successfully"
echo "[deploy] Done."

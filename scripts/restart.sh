#!/bin/bash

# Simple restart script for dScribe on meatpi
# Usage: ./scripts/restart.sh

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_info "🔄 Restarting dScribe service on meatpi..."

# Check if we can connect to meatpi
log_info "Testing connection to meatpi..."
if ! ping -c 1 meatpi.local > /dev/null 2>&1; then
    echo "❌ Cannot reach meatpi at meatpi.local"
    exit 1
fi

log_info "Connection successful! Restarting service..."

# Restart the service
ssh meatpi.local "pm2 restart dscribe && pm2 status dscribe"

log_success "✅ dScribe service restarted successfully!"
log_info "🌐 Service available at http://meatpi.local:3005"

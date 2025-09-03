#!/bin/bash

# Simple Git-based deployment script for meatpi
# Usage: ./scripts/deploy-git.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_info "🚀 Starting Git-based deployment to meatpi..."

# Check if we can connect to meatpi
log_info "Testing connection to meatpi..."
if ! ping -c 1 meatpi.local > /dev/null 2>&1; then
    log_error "Cannot reach meatpi at meatpi.local"
    exit 1
fi

log_info "Connection successful! Deploying to meatpi..."

# Execute deployment on meatpi
log_info "Executing deployment on meatpi..."
ssh meatpi.local << 'EOF'
    set -e
    
    echo "📁 Updating dScribe from git..."
    cd /home/inggo/dscribe
    
    # Stash any local changes
    git stash 2>/dev/null || true
    
    # Pull latest changes
    git pull origin main
    
    echo "📦 Installing dependencies..."
    npm ci --only=production
    
    echo "🎨 Building CSS..."
    npm run build:css
    
    echo "🔄 Restarting dScribe service..."
    pm2 restart dscribe
    
    echo "✅ Deployment completed successfully!"
    echo "📊 PM2 Status:"
    pm2 status dscribe
EOF

log_success "🎉 Git-based deployment completed successfully!"
log_info "🌐 dScribe is now running at http://meatpi.local:3005"
log_info "📊 Check PM2 status with: ssh meatpi.local 'pm2 status dscribe'"
log_info "🔄 For future updates, just run: ./scripts/deploy-git.sh"

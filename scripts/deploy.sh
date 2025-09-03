#!/bin/bash

# dScribe Production Deployment Script
# This script deploys the dScribe application to a Raspberry Pi

set -e

echo "🚀 Starting dScribe Production Deployment..."

# Configuration
PI_HOST=${PI_HOST:-"raspberrypi.local"}
PI_USER=${PI_USER:-"pi"}
PI_DIR=${PI_DIR:-"/home/pi/dScribe"}
PI_PORT=${PI_PORT:-"3005"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we can connect to the Pi
log_info "Testing connection to Raspberry Pi..."
if ! ping -c 1 $PI_HOST > /dev/null 2>&1; then
    log_error "Cannot reach Raspberry Pi at $PI_HOST"
    log_error "Please check your network connection and Pi hostname/IP"
    exit 1
fi

log_info "Connection successful! Deploying to $PI_HOST..."

# Build CSS for production
log_info "Building CSS for production..."
npm run build:css

# Create deployment package
log_info "Creating deployment package..."
DEPLOY_DIR="deploy-$(date +%Y%m%d-%H%M%S)"
mkdir -p $DEPLOY_DIR

# Copy necessary files
cp -r server/ $DEPLOY_DIR/
cp -r public/ $DEPLOY_DIR/
cp -r config/ $DEPLOY_DIR/
cp package.json $DEPLOY_DIR/
cp package-lock.json $DEPLOY_DIR/
cp ecosystem.config.cjs $DEPLOY_DIR/
cp README.md $DEPLOY_DIR/
cp .gitignore $DEPLOY_DIR/

# Remove development files
rm -rf $DEPLOY_DIR/public/styles.build.css.new
rm -rf $DEPLOY_DIR/public/styles.build.v2.css
rm -rf $DEPLOY_DIR/public/main.js

# Create deployment archive
log_info "Creating deployment archive..."
tar -czf $DEPLOY_DIR.tar.gz $DEPLOY_DIR/

# Deploy to Raspberry Pi
log_info "Deploying to Raspberry Pi..."
scp $DEPLOY_DIR.tar.gz $PI_USER@$PI_HOST:/tmp/

# Execute deployment on Pi
log_info "Executing deployment on Raspberry Pi..."
ssh $PI_USER@$PI_HOST << EOF
    set -e
    
    echo "📦 Extracting deployment package..."
    cd /tmp
    tar -xzf $DEPLOY_DIR.tar.gz
    
    echo "🔄 Stopping existing service..."
    pm2 stop dscribe 2>/dev/null || true
    pm2 delete dscribe 2>/dev/null || true
    
    echo "📁 Updating application files..."
    sudo rm -rf $PI_DIR
    sudo mkdir -p $PI_DIR
    sudo mv $DEPLOY_DIR/* $PI_DIR/
    sudo chown -R $PI_USER:$PI_USER $PI_DIR
    
    echo "📦 Installing dependencies..."
    cd $PI_DIR
    npm ci --only=production
    
    echo "🔧 Setting up storage directories..."
    mkdir -p storage/logs storage/outputs storage/temp
    
    echo "🚀 Starting dScribe service..."
    pm2 start ecosystem.config.cjs
    pm2 save
    
    echo "🧹 Cleaning up..."
    rm -rf /tmp/$DEPLOY_DIR*
    
    echo "✅ Deployment completed successfully!"
    echo "🌐 Service available at: http://$PI_HOST:$PI_PORT"
    echo "📊 PM2 Status:"
    pm2 status dscribe
EOF

# Clean up local deployment files
log_info "Cleaning up local deployment files..."
rm -rf $DEPLOY_DIR
rm -f $DEPLOY_DIR.tar.gz

log_info "🎉 Deployment completed successfully!"
log_info "🌐 dScribe is now running at http://$PI_HOST:$PI_PORT"
log_info "📊 Check PM2 status with: ssh $PI_USER@$PI_HOST 'pm2 status dscribe'"

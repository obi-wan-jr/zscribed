# Developer Deployment Guide (Raspberry Pi Test Server)

This guide describes how to deploy updates to the Raspberry Pi test server (port 3005, managed by PM2). No local testing required; deploy and test directly on the Pi.

## Prerequisites (first time only)
- Raspberry Pi with internet access
- Node.js >= 18, npm, pm2, git, ffmpeg

Install (if needed):
```bash
sudo apt update
sudo apt install -y git ffmpeg
# If Node not installed or < 18:
# curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
# sudo apt install -y nodejs
sudo npm i -g pm2
```

Verify:
```bash
node -v
npm -v
pm2 -v
```

## First-time setup
```bash
cd ~
git clone https://github.com/obi-wan-jr/zscribed.git dscribe
cd dscribe
cp config/config.example.json config/config.json
nano config/config.json # set allowedUsers, voiceModels, and later fishAudioApiKey
npm ci
npx --yes tailwindcss -i public/styles.css -o public/styles.build.css --minify
pm2 start ecosystem.config.cjs
pm2 save
```

Health check:
```bash
curl -s http://localhost:3005/api/health
```

Open in browser: http://<pi-host-or-ip>:3005

## Deploying an update (standard)
From the Pi:
```bash
cd ~/dscribe
# Ensure no local changes
git reset --hard
# Pull latest
git pull origin main
# Install exact dependency versions
npm ci
# Build Tailwind CSS
npx --yes tailwindcss -i public/styles.css -o public/styles.build.css --minify
# Restart the service
pm2 restart dscribe
# Persist process list (optional if already done)
pm2 save
```

Quick verification:
```bash
curl -s http://localhost:3005/api/health
pm2 logs dscribe --lines 100
```

## One-command deployment (script)
You can run the included script to perform a safe deployment:
```bash
cd ~/dscribe
bash scripts/dev-deploy.sh
```
What it does:
- Verifies tools
- Pulls main, installs deps, rebuilds CSS
- Restarts PM2 app `dscribe`
- Shows health and recent logs

## Configuration changes
Config lives in `config/config.json` (never committed):
- `fishAudioApiKey`: Fish.audio API key (admin-only)
- `voiceModels`: list of global voice models `{ id, name }`
- `allowedUsers`: users shown in the identity selector

After editing, restart the app:
```bash
pm2 restart dscribe
```

## Maintenance
- View logs: `pm2 logs dscribe --lines 200`
- Check status: `pm2 status`
- Start on boot: `pm2 startup systemd -u $USER --hp $HOME && pm2 save`
- Clear outputs/logs (use with care):
```bash
find storage/outputs -type f -delete
find storage/logs -type f -delete
```

## Rollback
If the latest deploy causes issues:
```bash
cd ~/dscribe
git log --oneline -n 5
# pick a known-good commit SHA and reset
git reset --hard <GOOD_SHA>
npm ci
npx --yes tailwindcss -i public/styles.css -o public/styles.build.css --minify
pm2 restart dscribe
```

## QA Checklist (high level)
- App loads; health check returns ok
- TTS (dummy) runs end-to-end; outputs appear and can be renamed/deleted
- Bible fetch (dummy) respects verse ranges and cleanup toggles
- Bible TTS (dummy) runs; outputs appear
- Voice models add/remove works; dropdowns update
- Preferences save/load per user
- Queue status updates while multiple jobs are queued

# Tech Context

Stack:
- Node.js 18+
- Vanilla JavaScript front-end, TailwindCSS
- ffmpeg (system-level dependency)
- PM2 for process management (port 3005)

Services & APIs:
- Fish.audio (API key and model IDs in `config/config.json`)
- Bible text API/source (WEB translation, local Bible provider)
- EventSource for real-time progress updates

Security:
- API key masked in UI; config file readable only by admins
- Logs pruned after 30 days
- Authentication system with user management

Performance:
- Sequential job processing by default; configurable concurrency with care
- Streamed generation where available (WebSocket/REST streaming)
- Progress tracking with fallback indicators
- Cache-busting for JavaScript files

Deployment:
- Server: Raspberry Pi (meatpi) running on port 3005
- Git-based deployment workflow
- PM2 process management with auto-restart

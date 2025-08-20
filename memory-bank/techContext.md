# Tech Context

Stack:
- Node.js 18+
- Vanilla JavaScript front-end, TailwindCSS
- ffmpeg (system-level dependency)
- PM2 for process management (port 3005)

Services & APIs:
- Fish.audio (API key and model IDs in `config/config.json`)
- Bible text API/source (pluggable; start with BibleGateway/alternatives)

Security:
- API key masked in UI; config file readable only by admins
- Logs pruned after 30 days

Performance:
- Sequential job processing by default; configurable concurrency with care
- Streamed generation where available (WebSocket/REST streaming)

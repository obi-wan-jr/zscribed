# Tech Context

Stack:
- Node.js 18+ with ES modules
- Vanilla JavaScript front-end with TailwindCSS
- Express.js server with middleware and routing
- FFmpeg (system-level dependency) for audio/video processing
- PM2 for process management (port 3005)
- UUID for job identification
- Morgan for HTTP request logging
- **PLANNED: GStreamer for video caption overlay and text rendering**

Services & APIs:
- Fish.audio API (API key and model IDs in `config/config.json`)
- Local Bible data provider (WEB translation, JSON files)
- EventSource for real-time progress updates
- File upload system for video backgrounds
- Session-based authentication system
- **PLANNED: Text-to-timing estimation service (150-180 WPM)**
- **PLANNED: Caption file generation service (SRT, VTT, JSON)**

Security:
- API key masked in UI; config file readable only by admins
- Session-based authentication with secure cookies
- Rate limiting for login attempts and API calls
- User-specific job isolation and access control
- Input validation and sanitization for all user inputs
- Logs pruned after 30 days
- **PLANNED: Caption file access control and user isolation**

Performance:
- Multi-job processing (up to 3 concurrent jobs) with fair scheduling
- Per-chapter processing for large books to ensure manageable file sizes
- Progress tracking with fallback indicators and reconnection logic
- Cache-busting for JavaScript files
- Automatic cleanup of orphaned files and old sessions
- Job recovery system with timeout detection and automatic retry
- **PLANNED: Caption timing estimation optimized for Raspberry Pi**
- **PLANNED: GStreamer hardware acceleration for video processing**

Storage:
- File-based storage with organized directory structure
- `storage/outputs/` for generated audio/video files
- `storage/logs/` for user activity logs
- `storage/uploads/` for uploaded background files
- `storage/queue.json` for job queue persistence
- Automatic cleanup and maintenance
- **PLANNED: `storage/captions/` for caption files and timing data**

Deployment:
- Server: Raspberry Pi (meatpi) running on port 3005
- Git-based deployment workflow with PM2 process management
- Automatic CSS building with TailwindCSS
- Health checks and monitoring
- Rollback capabilities with git reset
- **PLANNED: GStreamer installation and configuration on Raspberry Pi**

Monitoring & Admin:
- Real-time log streaming with categorization
- Debug session tracking for video generation
- User management interface
- System health monitoring
- Job queue status and management
- Export functionality for logs and debug reports
- **PLANNED: Caption generation monitoring and timing analysis**
- **PLANNED: Caption style and timing adjustment interface**

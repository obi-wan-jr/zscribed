# System Patterns

Architecture:
- Client: Vanilla JS + TailwindCSS, dark "midnight" theme with responsive design
- Server: Node.js Express server with SSE, job queue, and recovery mechanisms
- Processing: Multi-job queue manager with fair scheduling and automatic recovery
- Integrations: Fish.audio API, local Bible data provider, FFmpeg for audio/video processing
- Storage: File-based storage with organized directory structure and automatic cleanup
- **PLANNED: GStreamer for video caption overlay and text rendering**

Key Patterns:
- Job Queue with multi-runner (up to 3 concurrent jobs) with fair scheduling per user
- Bible processing pipeline: book/chapters → per-chapter processing → text chunks → TTS segments → stitch → output
- SSE channels per job for realtime progress reporting with fallback indicators
- Session-based authentication with user management and rate limiting
- Output storage organized by user/date/jobId with proper naming conventions
- Automatic cleanup of orphaned files and old sessions
- **PLANNED: Caption processing pipeline: text input → timing estimation → caption generation → video overlay**

Bible Audio Creation Patterns:
- Support for "Entire Book" mode (processes all chapters as separate files)
- Support for "Multiple Chapters" mode (processes specified ranges as separate files)
- Per-chapter processing to ensure manageable file sizes and better error recovery
- Job types: `bible-tts` and `bible-video` with comprehensive payload structure
- Progress tracking via EventSource with fallback indicators and reconnection logic
- File naming: `{user}-bible-{book}-{reference}-{voiceId}-{timestamp}.mp3`
- **PLANNED: Caption file naming: `{user}-bible-{book}-{reference}-{voiceId}-{timestamp}.srt`**

Video Generation Patterns:
- FFmpeg-based video generation with background image/video support
- File upload system for custom backgrounds
- Video settings with resolution and background type selection
- Debug session tracking for troubleshooting video generation issues
- Automatic cleanup of temporary video files
- **PLANNED: GStreamer-based caption overlay with text styling and positioning**
- **PLANNED: Caption timing estimation using text analysis (150-180 WPM)**
- **PLANNED: Multiple caption styles: sentence, paragraph, karaoke, end credits**

Error Handling:
- Comprehensive error handling with specific troubleshooting guidance
- Retries with exponential backoff for external APIs
- Idempotent job resumption via job metadata and checkpoints
- Graceful shutdown via PM2 hooks with queue persistence to disk
- Fallback progress indicators when server doesn't provide detailed updates
- Automatic recovery of stuck jobs with timeout detection
- Detailed error logging with categorization and context
- **PLANNED: Caption timing fallback and manual adjustment capabilities**

UI/UX Patterns:
- Dark "midnight" theme with high contrast and accessibility
- Radio button selection for Bible processing modes
- Real-time progress tracking with visual indicators and status updates
- Button state management (disabled during processing)
- Cache-busting for JavaScript files to ensure updates
- Auto-refresh of outputs list on completion
- Comprehensive admin panel with collapsible sections
- Session management with login/logout functionality
- **PLANNED: Caption style selection and customization interface**
- **PLANNED: Caption timing preview and adjustment controls**

Admin and Monitoring Patterns:
- Real-time log streaming with categorization and filtering
- Debug session tracking for video generation troubleshooting
- User management with add/delete capabilities
- System health monitoring with job status and queue information
- Automatic cleanup of old logs and debug sessions
- Export functionality for logs and debug reports
- **PLANNED: Caption generation monitoring and timing analysis**

Security Patterns:
- Session-based authentication with secure cookie handling
- Rate limiting for login attempts and API calls
- API key masking in UI with secure configuration storage
- User-specific job isolation and access control
- Input validation and sanitization for all user inputs
- **PLANNED: Caption file access control and user isolation**

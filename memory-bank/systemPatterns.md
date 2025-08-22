# System Patterns

Architecture:
- Client: Vanilla JS + TailwindCSS, dark "midnight" theme
- Server: Node.js (Express-like minimal server), SSE for progress updates
- Processing: Queue manager for TTS and Bible audio jobs
- Integrations: Fish.audio API, Bible text source API, ffmpeg for audio/video

Key Patterns:
- Job Queue with single-runner (sequential) to match Raspberry Pi constraints
- Bible processing pipeline: book/chapters → text chunks → TTS segments → stitch → output
- SSE channels per job/user for realtime progress reporting
- Memory Bank (Cline format) for preferences and recent jobs
- Output storage organized by user/date/jobId

Bible Audio Creation Patterns:
- Support for "Entire Book" mode (processes all chapters)
- Support for "Multiple Chapters" mode (processes specified ranges)
- Job types: `bible-tts` with payload containing book, type, chapters, voiceModelId
- Progress tracking via EventSource with fallback indicators
- File naming: `{user}-bible-{book}-{reference}-{voiceId}-{timestamp}.mp3`

Error Handling:
- Retries with backoff for external APIs
- Idempotent job resumption via job metadata
- Graceful shutdown via PM2 hooks; queue persistence to disk
- Fallback progress indicators when server doesn't provide detailed updates
- Comprehensive error logging and user feedback

UI/UX Patterns:
- Radio button selection for Bible processing modes
- Real-time progress tracking with visual indicators
- Button state management (disabled during processing)
- Cache-busting for JavaScript files to ensure updates
- Auto-refresh of outputs list on completion

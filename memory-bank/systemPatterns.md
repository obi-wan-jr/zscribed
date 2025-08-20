# System Patterns

Architecture:
- Client: Vanilla JS + TailwindCSS, dark "midnight" theme
- Server: Node.js (Express-like minimal server), SSE for progress updates
- Processing: Queue manager for TTS and rendering jobs
- Integrations: Fish.audio API, Bible text source API, ffmpeg for audio/video

Key Patterns:
- Job Queue with single-runner (sequential) to match Raspberry Pi constraints
- Segmentation pipeline: text → sentence chunks → TTS segments → stitch → output
- SSE channels per job/user for realtime progress reporting
- Memory Bank (Cline format) for preferences and recent jobs
- Output storage organized by user/date/jobId

Error Handling:
- Retries with backoff for external APIs
- Idempotent job resumption via job metadata
- Graceful shutdown via PM2 hooks; queue persistence to disk

# Active Context

Current Focus:
- Production-ready Bible audio and video creation system
- Comprehensive admin and monitoring capabilities
- Multi-user support with session management (Inggo, Gelo, JM, Irish)
- Advanced job processing with recovery mechanisms
- **PLANNED: Video captioning feature with text-based timing and GStreamer integration**

Recent Achievements:
- ✅ Complete Bible audio creation workflow (Entire Book + Multiple Chapters)
- ✅ Real-time progress tracking with visual indicators and SSE
- ✅ Voice model loading and selection with Fish.Audio API integration
- ✅ Job queue management with proper error handling and recovery
- ✅ File output management with refresh, rename, and delete capabilities
- ✅ Authentication system with user management and session handling (Inggo, Gelo, JM, Irish)
- ✅ Video generation with background image/video support
- ✅ Admin panel with comprehensive logging, debug sessions, and user management
- ✅ Multi-job processing system with fair scheduling and recovery
- ✅ Automatic cleanup of orphaned files and old sessions
- ✅ File upload system for video backgrounds
- ✅ Job cancellation and recovery mechanisms

Current Decisions:
- Use Fish.Audio API for TTS with comprehensive error handling and fallback to config voices
- Support WEB translation for Bible text with local data storage
- Job-based processing with SSE progress updates and recovery mechanisms
- File storage under `storage/outputs/` with user prefixes and proper naming
- Queue persisted to `storage/queue.json` with automatic recovery
- Per-chapter processing for books and multiple chapters to ensure manageable file sizes
- Video generation with FFmpeg and background image/video support
- Session-based authentication with user management (Inggo, Gelo, JM, Irish)
- Comprehensive admin panel for monitoring and management
- **PLANNED: Video captioning using text-based timing estimation and GStreamer for video overlay**

Next Steps:
- Monitor and optimize performance for very large books (e.g., Psalms with 150 chapters)
- Consider adding more Bible translations beyond WEB
- Implement rate limiting for Fish.Audio API calls
- **IMPLEMENT: Video captioning feature with text-based timing and GStreamer integration**
- Add advanced video generation features (captions, synchronization)
- Consider export/import functionality for configurations and preferences
- Implement backup and restore capabilities for user data

Technical Notes:
- Bible TTS jobs use `type: 'book'` or `type: 'chapters'` for different modes
- Progress tracking uses EventSource for real-time updates with fallback indicators
- Multi-job processing supports up to 3 concurrent jobs with fair scheduling
- Job recovery system handles stuck jobs and automatic retry mechanisms
- File naming convention: `{user}-{type}-{reference}-{voiceId}-{timestamp}.mp3`
- Cache-busting implemented for JavaScript files to ensure updates
- Comprehensive error handling with specific troubleshooting guidance
- Admin panel provides real-time monitoring of system health and job status
- All team members (Inggo, Gelo, JM, Irish) have full access to system features
- **PLANNED: Caption timing will use text-based estimation (150-180 WPM) with manual adjustment capabilities**
- **PLANNED: GStreamer will be used for video caption overlay instead of FFmpeg subtitle filters**

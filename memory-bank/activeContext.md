# Active Context

Current Focus:
- Bible audio creation system with full UI/UX implementation
- Real-time progress tracking and visual feedback
- Support for entire books and multiple chapters
- Voice model management and selection

Recent Achievements:
- ✅ Complete Bible audio creation workflow (Entire Book + Multiple Chapters)
- ✅ Real-time progress tracking with visual indicators
- ✅ Voice model loading and selection
- ✅ Job queue management with proper error handling
- ✅ File output management with refresh capabilities
- ✅ Authentication system with user management

Current Decisions:
- Use Fish.Audio API for TTS with fallback to config voices
- Support WEB translation for Bible text
- Job-based processing with SSE progress updates
- File storage under `storage/outputs/` with user prefixes
- Queue persisted to `storage/queue.json`

Next Steps:
- Monitor and optimize performance for large books
- Consider adding more Bible translations
- Enhance error handling and user feedback
- Add audio file management features (rename, delete, download)

Technical Notes:
- Bible TTS jobs use `type: 'book'` or `type: 'chapters'` for different modes
- Progress tracking uses EventSource for real-time updates
- Fallback progress indicator for when server doesn't provide detailed updates
- Cache-busting implemented for JavaScript files to ensure updates

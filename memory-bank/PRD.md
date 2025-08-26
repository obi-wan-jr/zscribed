# Product Requirements Document (PRD)
## dScribe - Bible Text-to-Speech & Video Generation System

### Version: 1.1
### Date: December 2024
### Status: Production Ready + Planned Enhancements

---

## 1. Executive Summary

### 1.1 Product Overview
dScribe is a production-ready web application that generates high-quality audio and video content from Bible text using Fish.Audio's custom voice models. The system is designed for deployment on Raspberry Pi hardware and serves small teams producing Bible audio/video content.

### 1.2 Target Users
- **Primary**: Small teams (Inggo, Gelo, JM, Irish) producing Bible audio/video content
- **Secondary**: Individual content creators needing Bible text-to-speech capabilities
- **Use Case**: Creating consistent, branded Bible audio and video content for distribution

### 1.3 Key Value Propositions
- Dramatically reduces time to produce consistent Bible audio outputs
- Leverages custom voice models for brand consistency
- Operates reliably on Raspberry Pi hardware
- Provides comprehensive workflow management and monitoring
- Supports both audio-only and video generation workflows
- **PLANNED: Advanced video captioning with text-based timing and GStreamer integration**

---

## 2. Product Goals & Success Metrics

### 2.1 Primary Goals
- ✅ **Complete Bible Audio Creation**: Generate high-quality audio from Bible text
- ✅ **Video Generation**: Create MP4 videos with audio and custom backgrounds
- ✅ **Multi-User Support**: Session-based authentication and user management
- ✅ **Real-Time Progress Tracking**: Live updates during processing
- ✅ **Job Queue Management**: Handle multiple concurrent processing jobs
- ✅ **Production Deployment**: Stable operation on Raspberry Pi hardware
- **PLANNED: Video Captioning**: Text-based timing with GStreamer video overlay

### 2.2 Success Metrics
- **Functionality**: 100% of core features implemented and working
- **Performance**: Stable operation with up to 3 concurrent jobs
- **Reliability**: Automatic error recovery and job management
- **User Experience**: Intuitive dark-themed interface with real-time feedback
- **Monitoring**: Comprehensive admin panel for system management
- **PLANNED: Caption Quality**: Accurate timing and professional caption styling

---

## 3. Functional Requirements

### 3.1 Core Features

#### 3.1.1 Bible Audio Creation
**Requirement**: Users must be able to generate audio from Bible text with multiple processing modes.

**Specifications**:
- **Entire Book Mode**: Process all chapters of a selected book as separate audio files
- **Multiple Chapters Mode**: Process specified chapter ranges as separate audio files
- **Single Chapter Mode**: Process individual chapters with optional verse ranges
- **Text Processing**: Automatic cleanup of verse numbers and footnotes
- **Voice Selection**: Choose from available Fish.Audio voice models
- **Output Format**: MP3 files with standardized naming convention

**Acceptance Criteria**:
- ✅ All 66 Bible books supported with correct chapter counts
- ✅ WEB translation with local data storage
- ✅ Per-chapter processing for manageable file sizes
- ✅ Proper text cleanup and segmentation
- ✅ Fish.Audio API integration with error handling

#### 3.1.2 Text-to-Speech (TTS)
**Requirement**: Users must be able to convert arbitrary text to speech.

**Specifications**:
- **Text Input**: Large text area for content entry
- **Voice Selection**: Choose from available voice models
- **Chunking**: Configurable sentences per chunk for processing
- **Output**: MP3 files with proper naming

**Acceptance Criteria**:
- ✅ Arbitrary text processing with segmentation
- ✅ Fish.Audio API integration
- ✅ Configurable chunking parameters
- ✅ Error handling and fallback mechanisms

#### 3.1.3 Video Generation
**Requirement**: Users must be able to create MP4 videos with audio and custom backgrounds.

**Specifications**:
- **Background Types**: Static images or looping videos
- **Resolution Options**: 720p, 1080p, 4K support
- **File Upload**: Background image/video upload capability
- **FFmpeg Integration**: Professional video processing
- **Debug Tracking**: Session-based debugging for troubleshooting

**Acceptance Criteria**:
- ✅ Multiple resolution support
- ✅ Background image and video upload
- ✅ FFmpeg-based video generation
- ✅ Debug session tracking
- ✅ Automatic cleanup of temporary files

#### 3.1.4 User Authentication & Management
**Requirement**: Secure multi-user access with session management.

**Specifications**:
- **Session-Based Auth**: Secure cookie-based authentication
- **User Management**: Add/remove users through admin panel
- **Rate Limiting**: Protection against abuse
- **User Isolation**: Jobs and files isolated per user

**Acceptance Criteria**:
- ✅ Session-based authentication
- ✅ Admin user management interface
- ✅ Rate limiting for login attempts
- ✅ User-specific job and file isolation

### 3.2 Advanced Features

#### 3.2.1 Job Queue Management
**Requirement**: Robust job processing with queue management and recovery.

**Specifications**:
- **Multi-Job Processing**: Up to 3 concurrent jobs with fair scheduling
- **Job Recovery**: Automatic detection and recovery of stuck jobs
- **Queue Persistence**: Job queue saved to disk for recovery
- **Progress Tracking**: Real-time updates via Server-Sent Events (SSE)
- **Error Handling**: Comprehensive error management with retry logic

**Acceptance Criteria**:
- ✅ Multi-job processing with fair scheduling
- ✅ Automatic job recovery and timeout detection
- ✅ Queue persistence and recovery
- ✅ Real-time progress tracking with fallback indicators
- ✅ Comprehensive error handling and troubleshooting

#### 3.2.2 File Management
**Requirement**: Complete file lifecycle management for generated content.

**Specifications**:
- **File Organization**: User-specific storage with proper naming
- **File Operations**: Download, rename, delete capabilities
- **Auto-Refresh**: Automatic list updates on completion
- **Cleanup**: Automatic removal of temporary and orphaned files

**Acceptance Criteria**:
- ✅ Organized file storage with user prefixes
- ✅ Complete file management operations
- ✅ Automatic list refresh
- ✅ Automatic cleanup of temporary files

#### 3.2.3 Admin Panel & Monitoring
**Requirement**: Comprehensive system monitoring and management capabilities.

**Specifications**:
- **Real-Time Logs**: Live log streaming with categorization
- **Debug Sessions**: Video generation troubleshooting
- **System Health**: Job queue status and system monitoring
- **User Management**: Add/remove users interface
- **Export Capabilities**: Log and debug report downloads

**Acceptance Criteria**:
- ✅ Real-time log streaming with filtering
- ✅ Debug session tracking and reporting
- ✅ System health monitoring
- ✅ User management interface
- ✅ Export functionality for logs and reports

### 3.3 Planned Features

#### 3.3.1 Video Captioning System
**Requirement**: Advanced video captioning with text-based timing and GStreamer integration.

**Specifications**:
- **Text-Based Timing**: Estimate caption timing using text analysis (150-180 WPM)
- **Caption Styles**: Multiple styles (sentence, paragraph, karaoke, end credits)
- **GStreamer Integration**: Video caption overlay with text styling and positioning
- **Manual Adjustment**: Fine-tune timing and positioning after auto-generation
- **File Formats**: SRT, VTT, and internal JSON caption files
- **User Interface**: Caption style selection and customization controls

**Acceptance Criteria**:
- **PLANNED**: Accurate text-to-timing estimation with configurable speaking rates
- **PLANNED**: Multiple caption styles with professional styling options
- **PLANNED**: GStreamer-based video processing with hardware acceleration
- **PLANNED**: Manual timing adjustment and preview capabilities
- **PLANNED**: Caption file management integrated with existing file system
- **PLANNED**: User-friendly caption customization interface

---

## 4. Non-Functional Requirements

### 4.1 Performance Requirements
- **Concurrent Jobs**: Support up to 3 simultaneous processing jobs
- **Response Time**: UI updates within 2 seconds
- **File Processing**: Handle books up to 150 chapters (Psalms)
- **Memory Usage**: Optimized for Raspberry Pi hardware constraints
- **PLANNED: Caption Processing**: Efficient text analysis and timing estimation

### 4.2 Reliability Requirements
- **Uptime**: 99%+ availability on Raspberry Pi deployment
- **Error Recovery**: Automatic recovery from common failure modes
- **Data Persistence**: Job queue and user data persistence
- **Graceful Degradation**: Fallback mechanisms for API failures
- **PLANNED: Caption Reliability**: Fallback timing estimation and manual adjustment

### 4.3 Security Requirements
- **Authentication**: Secure session-based user authentication
- **API Key Protection**: Secure storage and masking of API keys
- **Input Validation**: Comprehensive input sanitization
- **Rate Limiting**: Protection against abuse and API limits
- **PLANNED: Caption Security**: User-specific caption file access control

### 4.4 Usability Requirements
- **Interface**: Dark "midnight" theme with high contrast
- **Responsive Design**: Works on desktop and tablet devices
- **Real-Time Feedback**: Live progress updates and status indicators
- **Error Messages**: Clear, actionable error messages with troubleshooting
- **PLANNED: Caption Usability**: Intuitive caption style selection and timing adjustment

---

## 5. Technical Architecture

### 5.1 Technology Stack
- **Frontend**: Vanilla JavaScript + TailwindCSS
- **Backend**: Node.js 18+ with Express.js
- **TTS Service**: Fish.Audio API integration
- **Video Processing**: FFmpeg for audio/video, **PLANNED: GStreamer for captions**
- **Storage**: File-based with organized directory structure
- **Deployment**: PM2 on Raspberry Pi

### 5.2 System Components
- **Web Server**: Express.js with middleware and routing
- **Job Queue**: Multi-job processor with fair scheduling
- **TTS Engine**: Fish.Audio API with error handling
- **Bible Provider**: Local JSON-based data storage
- **Video Generator**: FFmpeg-based video processing
- **Admin System**: Monitoring and management tools
- **PLANNED: Caption Engine**: Text-to-timing estimation and GStreamer integration

### 5.3 Data Flow
1. User selects Bible content or enters text
2. Job created and queued for processing
3. Text segmented and sent to Fish.Audio API
4. Audio segments stitched together using FFmpeg
5. **PLANNED: Caption timing estimated and files generated**
6. **PLANNED: Video generated with GStreamer caption overlay**
7. File saved to organized storage structure
8. Real-time progress updates throughout process

---

## 6. User Interface Requirements

### 6.1 Design Principles
- **Dark Theme**: "Midnight" theme with high contrast
- **Responsive**: Works on desktop and tablet devices
- **Intuitive**: Clear navigation and workflow
- **Accessible**: High contrast and readable typography

### 6.2 Key Pages
- **Home**: Welcome page with navigation
- **Bible**: Bible audio creation interface
- **TTS**: Text-to-speech interface
- **Admin**: System monitoring and management
- **Settings**: User preferences and configuration
- **Login**: User authentication
- **PLANNED: Caption Settings**: Caption style and timing configuration

### 6.3 User Experience
- **Real-Time Feedback**: Live progress indicators
- **Error Handling**: Clear error messages with solutions
- **File Management**: Easy download, rename, and delete
- **Job Monitoring**: Queue status and active job tracking
- **PLANNED: Caption Experience**: Style selection, timing preview, and adjustment

---

## 7. Deployment & Operations

### 7.1 Deployment Target
- **Platform**: Raspberry Pi (meatpi)
- **Port**: 3005
- **Process Manager**: PM2
- **Update Method**: Git-based deployment
- **PLANNED: GStreamer Installation**: System-level dependency for caption processing

### 7.2 Operational Requirements
- **Monitoring**: Health checks and system status
- **Logging**: Comprehensive logging with rotation
- **Backup**: Configuration and user data backup
- **Maintenance**: Automatic cleanup and maintenance tasks
- **PLANNED: Caption Monitoring**: Caption generation performance and quality tracking

### 7.3 Configuration
- **API Keys**: Fish.Audio API key management
- **Voice Models**: Configurable voice model list
- **Users**: Configurable user access list
- **Settings**: System-wide configuration options
- **PLANNED: Caption Settings**: Speaking rate, style defaults, and timing preferences

---

## 8. Future Enhancements

### 8.1 Potential Additions
- **Additional Bible Translations**: Beyond WEB translation
- **Advanced Video Features**: Captions, synchronization, effects
- **Export/Import**: Configuration and preference management
- **Backup/Restore**: User data protection capabilities
- **Performance Optimization**: Enhanced processing for large books
- **PLANNED: Advanced Caption Features**: AI-powered timing optimization, multiple language support

### 8.2 Scalability Considerations
- **Concurrent Processing**: Increase job concurrency limits
- **Storage**: Enhanced file organization and management
- **Caching**: Implement caching for frequently accessed data
- **Load Balancing**: Multiple server deployment support
- **PLANNED: Caption Scalability**: Distributed caption processing and caching

---

## 9. Success Criteria

### 9.1 Functional Success
- ✅ All core features implemented and working
- ✅ Multi-user support with proper isolation
- ✅ Real-time progress tracking and feedback
- ✅ Comprehensive error handling and recovery
- ✅ Production-ready deployment on Raspberry Pi
- **PLANNED: Professional-quality video captions with accurate timing**

### 9.2 Technical Success
- ✅ Stable operation with up to 3 concurrent jobs
- ✅ Automatic error recovery and job management
- ✅ Comprehensive monitoring and admin capabilities
- ✅ Secure authentication and user management
- ✅ Professional video generation with FFmpeg
- **PLANNED: Efficient caption processing with GStreamer integration**

### 9.3 User Experience Success
- ✅ Intuitive dark-themed interface
- ✅ Real-time feedback and progress tracking
- ✅ Clear error messages with troubleshooting
- ✅ Efficient file management and organization
- ✅ Comprehensive admin and monitoring tools
- **PLANNED: Seamless caption customization and timing adjustment**

---

## 10. Conclusion

The dScribe system has successfully achieved all primary goals and is production-ready for deployment. The implementation includes comprehensive features that go beyond the original scope, providing a robust, user-friendly platform for Bible audio and video generation.

The system demonstrates excellent technical architecture, comprehensive error handling, and professional-grade user experience. All functional and non-functional requirements have been met, and the system is ready for production use on the target Raspberry Pi deployment platform.

**Planned video captioning feature** will further enhance the system's capabilities, providing professional-quality captions with text-based timing estimation and GStreamer integration, making dScribe a complete Bible content creation platform.

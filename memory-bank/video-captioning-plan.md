# Video Captioning Feature Plan
## dScribe - Advanced Video Captioning with Text-Based Timing and GStreamer Integration

### Version: 1.0
### Date: December 2024
### Status: Planned Implementation

---

## 1. Executive Summary

### 1.1 Feature Overview
Add an advanced video captioning capability to dScribe, using text-based timing estimation synchronized with Fish.Audio-generated audio. Supports multiple caption styles and integrates with the current audio/video generation pipeline on Raspberry Pi using GStreamer for video overlay.

### 1.2 Key Benefits
- **Professional Captions**: Generate accurate, timed captions for Bible content
- **Multiple Styles**: Support for karaoke, sentence captions, scrolling paragraphs, end credits
- **Seamless Integration**: Works with existing TTS and video workflows
- **User Control**: Customizable caption styles and manual timing adjustments
- **Raspberry Pi Optimized**: Efficient processing suitable for Pi hardware

### 1.3 Technical Approach
- **Text-Based Timing**: Estimate timing using text analysis (150-180 WPM) instead of Fish.Audio metadata
- **GStreamer Integration**: Use GStreamer for video caption overlay instead of FFmpeg subtitle filters
- **Hybrid Architecture**: Keep FFmpeg for audio processing, use GStreamer for video caption rendering

---

## 2. Goals & Success Metrics

### 2.1 Primary Goals
- Enable script-based captioning synchronized accurately with audio using text-based timing estimation
- Support multiple caption styles (karaoke, sentence captions, scrolling paragraphs, end credits)
- Integrate caption generation seamlessly into existing TTS and video workflows
- Provide user control over caption style selection and customization
- Maintain system performance and usability on Raspberry Pi hardware

### 2.2 Success Metrics
- **Timing Accuracy**: Captions synchronized within ±0.5 seconds of audio
- **Style Variety**: Support for at least 4 different caption styles
- **Performance**: Caption generation adds <30% to total processing time
- **User Experience**: Intuitive caption customization interface
- **Reliability**: 99%+ success rate for caption generation

---

## 3. Functional Requirements

### 3.1 Caption Timing & Generation
**Requirement**: Generate accurate timing for captions using text analysis.

**Specifications**:
- **Text-to-Timing Algorithm**: Use character count, word count, and speaking rate (150-180 WPM)
- **Punctuation Weighting**: Add pauses for commas, periods, question marks, etc.
- **Configurable Speaking Rate**: Allow user adjustment of WPM for different voices
- **Manual Adjustment**: Provide interface for fine-tuning timing after auto-generation
- **Output Formats**: Generate SRT, VTT, and internal JSON caption files

**Acceptance Criteria**:
- Timing estimation within ±0.5 seconds of actual audio
- Support for configurable speaking rates (120-200 WPM)
- Manual timing adjustment interface with visual timeline
- Standard caption file formats (SRT, VTT) for external use

### 3.2 Caption Style Support
**Requirement**: Support multiple professional caption styles.

**Specifications**:
- **Karaoke Style**: Word/syllable highlighting in sync with audio
- **Sentence-per-Caption**: One sentence shown at a time with fade transitions
- **End Credits Scroll**: Continuous caption scrolling after main video content
- **Scrolling Paragraph**: Continuous text scroll during video playback
- **Static Captions**: Fixed position captions with configurable styling

**Acceptance Criteria**:
- All 4 caption styles implemented and functional
- Professional styling with configurable fonts, colors, sizes
- Smooth transitions and animations
- Consistent rendering across different video resolutions

### 3.3 Video Integration
**Requirement**: Integrate captions into video generation pipeline.

**Specifications**:
- **GStreamer Pipeline**: Use GStreamer for video caption overlay and rendering
- **Text Overlay**: Rich text formatting with fonts, colors, positioning
- **Hardware Acceleration**: Leverage Pi's video processing capabilities
- **Sidecar Files**: Option to generate separate caption files for external players
- **Burned-in Captions**: Embed captions directly into video for guaranteed compatibility

**Acceptance Criteria**:
- GStreamer integration working reliably on Raspberry Pi
- Caption overlay with professional styling and positioning
- Hardware acceleration for improved performance
- Both burned-in and sidecar caption file options

### 3.4 User Interface
**Requirement**: Provide intuitive caption customization interface.

**Specifications**:
- **Caption Upload/Input**: Field for reference scripts and text input
- **Style Selector**: Dropdown for caption style selection
- **Customization Options**: Font, color, size, position controls
- **Timing Preview**: Visual timeline showing caption timing
- **Manual Adjustment**: Interface for fine-tuning timing and positioning

**Acceptance Criteria**:
- Intuitive caption style selection interface
- Real-time preview of caption styling
- Visual timeline for timing adjustment
- Integration with existing Bible/TTS forms

### 3.5 Error and Edge Case Handling
**Requirement**: Robust error handling and edge case management.

**Specifications**:
- **Timing Fallback**: Graceful handling of timing estimation failures
- **Manual Adjustment**: Allow manual timing correction when auto-generation fails
- **Partial Alignment**: Handle cases where only partial timing is available
- **Performance Monitoring**: Track caption generation performance and errors

**Acceptance Criteria**:
- Graceful fallback for timing estimation failures
- Manual timing adjustment capabilities
- Comprehensive error logging and user feedback
- Performance monitoring and optimization

---

## 4. Non-Functional Requirements

### 4.1 Performance Requirements
- **Processing Time**: Caption generation adds <30% to total video processing time
- **Memory Usage**: Efficient memory usage suitable for Raspberry Pi constraints
- **Concurrent Processing**: Support caption generation in multi-job environment
- **Hardware Acceleration**: Leverage Pi's video processing capabilities

### 4.2 Reliability Requirements
- **Success Rate**: 99%+ success rate for caption generation
- **Error Recovery**: Automatic recovery from common caption generation failures
- **Data Persistence**: Caption files and timing data properly stored and managed
- **Graceful Degradation**: System continues working if caption generation fails

### 4.3 Usability Requirements
- **Interface Responsiveness**: UI remains responsive during caption generation
- **Real-Time Feedback**: Live progress updates for caption generation
- **Error Messages**: Clear, actionable error messages with troubleshooting
- **Accessibility**: Caption interface accessible to all team members

### 4.4 Security Requirements
- **User Isolation**: Caption files isolated per user
- **File Access Control**: Secure access to caption files and timing data
- **Input Validation**: Comprehensive validation of caption text and settings
- **Data Protection**: Secure storage of caption preferences and timing data

---

## 5. Technical Architecture

### 5.1 System Integration
```
Current Pipeline:
Audio Generation → Video Generation (FFmpeg)

Enhanced Pipeline:
Audio Generation → Caption Timing → Caption Generation → Video with GStreamer
```

### 5.2 Technology Stack
- **Timing Engine**: Node.js text analysis service
- **Caption Generation**: Custom caption file generation service
- **Video Processing**: GStreamer for caption overlay
- **Storage**: File-based storage with organized directory structure
- **UI**: Vanilla JavaScript + TailwindCSS integration

### 5.3 File Organization
```
storage/outputs/{user}/{jobId}/
├── audio.mp3
├── captions/
│   ├── timing.json          # Timing data and metadata
│   ├── captions.srt         # SRT format captions
│   ├── captions.vtt         # VTT format captions
│   └── captions.json        # Internal caption data
└── video.mp4                # Video with burned-in captions
```

### 5.4 GStreamer Pipeline Example
```bash
# Basic caption overlay pipeline
gst-launch-1.0 \
  filesrc location=audio.mp3 ! decodebin ! audioconvert ! \
  videotestsrc ! video/x-raw,width=1920,height=1080 ! \
  textoverlay text="Caption text" font-desc="Sans 24" color=0xFFFFFFFF ! \
  videoconvert ! x264enc ! mp4mux ! filesink location=output.mp4
```

---

## 6. Implementation Plan

### Phase 1: Core Caption Generation (2 weeks)

#### Week 1: Backend Foundation
- **Day 1-2**: Research and implement text-to-timing estimation algorithm
- **Day 3-4**: Create caption timing extraction service
- **Day 5**: Generate SRT/VTT files from reference scripts

#### Week 2: Integration & Basic Video
- **Day 1-2**: Integrate caption generation into job queue pipeline
- **Day 3-4**: Implement basic GStreamer text overlay
- **Day 5**: Update video generation workflow with caption support

**Deliverables**:
- Text-to-timing estimation service
- Basic caption file generation (SRT, VTT)
- GStreamer integration for simple text overlay
- Job queue integration

### Phase 2: Caption Styles & UI (2 weeks)

#### Week 3: Caption Styles
- **Day 1-2**: Implement sentence-per-caption style
- **Day 3-4**: Add scrolling paragraph and end credits styles
- **Day 5**: Create caption style selection UI

#### Week 4: Advanced Features
- **Day 1-2**: Implement karaoke-style word highlighting
- **Day 3-4**: Add caption customization controls (font, color, size)
- **Day 5**: Caption preview panel with audio sync

**Deliverables**:
- Multiple caption styles (sentence, paragraph, karaoke, end credits)
- Caption style selection and customization interface
- Caption preview with audio synchronization
- Manual timing adjustment interface

### Phase 3: Polish & Production (1 week)

#### Week 5: Testing & Deployment
- **Day 1-2**: Comprehensive testing on Raspberry Pi
- **Day 3-4**: Performance optimization and error handling
- **Day 5**: Documentation updates and production deployment

**Deliverables**:
- Production-ready caption system
- Performance optimization
- Comprehensive documentation
- Production deployment

---

## 7. Risk Assessment & Mitigation

### 7.1 Technical Risks

#### GStreamer Learning Curve
- **Risk**: Team unfamiliar with GStreamer pipelines
- **Impact**: Medium
- **Mitigation**: Start with simple text overlay, build complexity gradually
- **Contingency**: Fallback to FFmpeg subtitle filters if needed

#### Timing Estimation Accuracy
- **Risk**: Text-to-timing algorithm may not be accurate enough
- **Impact**: High
- **Mitigation**: Provide manual adjustment tools, multiple estimation methods
- **Contingency**: Allow manual timing input as primary method

#### Performance on Raspberry Pi
- **Risk**: GStreamer may be resource-intensive for Pi hardware
- **Impact**: Medium
- **Mitigation**: Optimize pipeline, use hardware acceleration, test thoroughly
- **Contingency**: Implement performance monitoring and fallback options

### 7.2 Project Risks

#### Timeline Slippage
- **Risk**: Complex integration may take longer than estimated
- **Impact**: Medium
- **Mitigation**: Incremental delivery, prioritize core functionality
- **Contingency**: Extend timeline or reduce scope for initial release

#### User Adoption
- **Risk**: Users may find caption interface complex
- **Impact**: Low
- **Mitigation**: User testing, intuitive interface design
- **Contingency**: Provide default settings and simplified mode

---

## 8. Success Criteria

### 8.1 Functional Success
- ✅ Accurate caption timing (within ±0.5 seconds)
- ✅ Multiple caption styles implemented and working
- ✅ Seamless integration with existing audio/video pipeline
- ✅ User-friendly caption customization interface
- ✅ Reliable caption generation (99%+ success rate)

### 8.2 Technical Success
- ✅ GStreamer integration working on Raspberry Pi
- ✅ Efficient caption processing (<30% time increase)
- ✅ Comprehensive error handling and recovery
- ✅ Hardware acceleration utilization
- ✅ Proper file organization and management

### 8.3 User Experience Success
- ✅ Intuitive caption style selection
- ✅ Real-time caption preview and adjustment
- ✅ Clear error messages and troubleshooting
- ✅ Responsive interface during processing
- ✅ Professional-quality caption output

---

## 9. Conclusion

The video captioning feature represents a significant enhancement to dScribe's capabilities, transforming it from an audio/video generation tool into a complete Bible content creation platform.

The revised approach using text-based timing estimation and GStreamer integration provides a more reliable and flexible solution than the original Fish.Audio metadata dependency. This approach is well-suited for Raspberry Pi deployment and offers superior video processing capabilities.

**Estimated Timeline**: 5 weeks total implementation
**Priority**: High - this feature will significantly enhance dScribe's value proposition
**Risk Level**: Medium - manageable with proper planning and incremental delivery

The feature will provide professional-quality captions with accurate timing, multiple styling options, and seamless integration with the existing dScribe workflow, making it an essential addition to the platform.

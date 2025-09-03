# dScribe - Bible TTS & Video Generation Service

A production-ready web application for generating high-quality audio and video content from Bible text using Fish.Audio's custom voice models. Designed for deployment on Raspberry Pi hardware.

## Features

- **Bible Text Processing**: Fetch and clean Bible text from local data sources
- **Text-to-Speech**: Generate audio using Fish.Audio API with custom voice models
- **Video Generation**: Create MP4 videos with audio and custom backgrounds using FFmpeg
- **Job Queue Management**: Handle multiple concurrent processing jobs with real-time progress
- **File Management**: Download, rename, and delete generated content
- **Raspberry Pi Optimized**: Lightweight and efficient for Pi hardware

## Quick Start

### Prerequisites

- Node.js 18+ 
- FFmpeg installed on system
- Fish.Audio API key

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd dScribe

# Install dependencies
npm install

# Configure Fish.Audio API key
cp config/config.example.json config/config.json
# Edit config/config.json with your API key and voice models

# Build CSS
npm run build:css

# Start the service
npm start
```

### Production Deployment

```bash
# Install production dependencies only
npm run install:prod

# Start with PM2
npm run pm2:start

# Other PM2 commands
npm run pm2:stop
npm run pm2:restart
npm run pm2:reload
```

## Configuration

Edit `config/config.json`:

```json
{
  "fishAudioApiKey": "YOUR_FISH_AUDIO_API_KEY",
  "voiceModels": [
    {
      "id": "your-voice-model-id",
      "name": "Your Voice Model Name"
    }
  ]
}
```

## API Endpoints

- `POST /api/tts/generate` - Generate audio from text
- `POST /api/video/generate` - Generate video from audio
- `POST /api/bible/generate` - Process Bible text with optional audio/video
- `GET /api/jobs` - List all jobs
- `GET /api/outputs` - List generated files

## Architecture

- **Server**: Express.js with job queue management
- **TTS**: Fish.Audio API integration
- **Video**: FFmpeg-based video generation
- **Bible**: Local Bible data processing
- **Jobs**: Concurrent job processing with progress tracking

## License

Private - All rights reserved

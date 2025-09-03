# System Patterns

## Current Architecture: Simplified Bible Transcription Service

The dScribe application has been transformed from a complex multi-service system into a lean, focused Bible transcription service.

## System Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client UI     │    │   Express        │    │   Bible Data    │
│   (bible.html)  │◄──►│   Server         │◄──►│   Provider      │
│   + bible.js    │    │   (index.js)     │    │   (local data)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   File Outputs  │    │   Text           │    │   Storage       │
│   (download,    │    │   Processing     │    │   (outputs/)    │
│    rename,      │    │   (cleanup,      │    │                 │
│    delete)      │    │    format)       │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Core Components

### 1. Client Layer
- **Single Page**: `bible.html` - Main transcription interface
- **JavaScript**: `bible.js` - Transcription logic and UI interactions
- **Utilities**: `common.js` - Essential helper functions
- **Styling**: `styles.build.css` - Optimized TailwindCSS

### 2. Server Layer
- **Express Server**: `server/index.js` - HTTP API and file serving
- **Bible API**: Text fetching, validation, and processing
- **File Management**: Output listing, renaming, and deletion
- **Static Assets**: Efficient serving with cache control

### 3. Data Layer
- **Bible Provider**: Local JSON data with WEB translation
- **Text Processing**: Cleanup, formatting, and validation
- **File Storage**: Local file system for outputs

## Key Design Patterns

### 1. Server-Side Processing
```javascript
// All heavy lifting done on server
app.post('/api/jobs/bible', async (req, res) => {
    const result = await processBibleTranscription(payload);
    res.json(result);
});
```

### 2. Direct Response Pattern
```javascript
// No job queues - immediate processing
const result = await processBibleTranscription(payload);
return result; // Direct response
```

### 3. Simplified Error Handling
```javascript
try {
    const result = await processBibleTranscription(payload);
    res.json(result);
} catch (error) {
    res.status(500).json({ error: error.message });
}
```

### 4. Minimal Client Logic
```javascript
// Client only handles UI and makes API calls
async function createTranscription() {
    const payload = getFormPayload();
    const response = await fetch('/api/jobs/bible', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    const result = await response.json();
    // Handle result
}
```

## Data Flow

### 1. Bible Text Request
```
User Input → Client Validation → Server API → Bible Provider → Text Processing → Response
```

### 2. Transcription Creation
```
User Selection → Form Data → Server Processing → Text Generation → File Save → Success Response
```

### 3. File Management
```
List Request → Server File Scan → File List → Client Display → User Actions → Server Operations
```

## Performance Patterns

### 1. Minimal Dependencies
- **Express**: Web framework only
- **Compression**: Response compression
- **CORS**: Cross-origin support
- **Morgan**: Request logging

### 2. Efficient Caching
```javascript
// Smart cache control based on file type
if (path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
} else if (path.endsWith('.css')) {
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
}
```

### 3. Server-Side Processing
- **No Client Computation**: All processing on server
- **Direct File Operations**: No complex job queues
- **Immediate Response**: No waiting for background jobs

## Security Patterns

### 1. No Authentication Required
- **Single User**: No login system needed
- **Direct Access**: All features available immediately
- **No Session Management**: Stateless operation

### 2. Input Validation
```javascript
// Server-side validation for all inputs
if (!book) {
    return res.status(400).json({ error: 'Book is required' });
}
```

### 3. File Path Security
```javascript
// Secure file operations
const filePath = path.join(OUTPUTS_DIR, filename);
if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
}
```

## Error Handling Patterns

### 1. Graceful Degradation
```javascript
try {
    const result = await processBibleTranscription(payload);
    res.json(result);
} catch (error) {
    console.error('[API] Bible transcription error:', error);
    res.status(500).json({ error: error.message });
}
```

### 2. User-Friendly Messages
```javascript
res.status(500).json({ 
    error: error.message,
    troubleshooting: [
        'Check the book name and chapter number',
        'Verify the translation is available',
        'Ensure verse ranges are valid'
    ]
});
```

### 3. Client-Side Feedback
```javascript
function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `text-sm ${type === 'error' ? 'text-red-400' : 'text-green-400'}`;
}
```

## File Management Patterns

### 1. Organized Storage
```
storage/
├── outputs/          # Transcription files
└── logs/            # Server logs (if needed)
```

### 2. Consistent Naming
```javascript
const filename = `bible-${book}-${type === 'book' ? 'entire' : chapters}-${translation}-${timestamp}.txt`;
```

### 3. File Operations
- **List**: Scan directory and return file list
- **Download**: Direct file serving with proper headers
- **Rename**: Secure file renaming with validation
- **Delete**: Safe file deletion with confirmation

## Maintenance Patterns

### 1. Simple Codebase
- **Single Server File**: All logic in one place
- **Minimal Dependencies**: Easy to update and maintain
- **Clear Structure**: Obvious data flow and responsibilities

### 2. Easy Deployment
```bash
npm install    # Install minimal dependencies
npm start      # Start production server
npm run dev    # Start development server
```

### 3. Scalability Considerations
- **Single Instance**: Designed for single-user operation
- **Local Storage**: File-based storage for simplicity
- **No Database**: Eliminates database complexity and maintenance

## Summary

The new system architecture follows these core principles:

1. **Simplicity**: Minimal components and dependencies
2. **Performance**: Server-side processing with fast response times
3. **Maintainability**: Clean, focused code with clear responsibilities
4. **Reliability**: Simple error handling and graceful degradation
5. **Efficiency**: Direct operations without complex queuing systems

This architecture provides a fast, lightweight, and maintainable Bible transcription service that meets all specified requirements.

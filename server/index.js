import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import compression from 'compression';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig } from './config.js';
import { FishAudioService } from './tts/fishAudioService.js';
import { VideoGenerator } from './videoGenerator.js';
import { JobQueue } from './jobs/jobQueue.js';
import { BibleService } from './bible/bibleService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3005;

// Enable compression for all responses
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
const logFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(logFormat));

// Directories
const ROOT = path.resolve(__dirname, '..');
const STORAGE_DIR = path.join(ROOT, 'storage');
const OUTPUTS_DIR = path.join(STORAGE_DIR, 'outputs');
const TEMP_DIR = path.join(STORAGE_DIR, 'temp');
const PUBLIC_DIR = path.join(ROOT, 'public');

// Ensure directories exist
[STORAGE_DIR, OUTPUTS_DIR, TEMP_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Load configuration
let config = loadConfig(ROOT);
let fishAudioService = null;
let videoGenerator = null;
let jobQueue = null;
let bibleService = null;

// Initialize services
if (config.fishAudioApiKey) {
    fishAudioService = new FishAudioService(config.fishAudioApiKey, OUTPUTS_DIR);
    videoGenerator = new VideoGenerator(OUTPUTS_DIR);
    jobQueue = new JobQueue(OUTPUTS_DIR);
    bibleService = new BibleService();
    console.log('[Server] All services initialized successfully');
} else {
    console.log('[Server] Fish.Audio API key not configured - running in limited mode');
}

// Middleware
app.use((req, res, next) => {
    req.clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection.remoteAddress || req.socket.remoteAddress || req.ip || 'unknown';
    next();
});

// Static files
app.use('/', express.static(PUBLIC_DIR, {
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (filePath.match(/\.(css|js)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=300');
        }
    }
}));

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ 
        ok: true, 
        uptime: process.uptime(),
        services: {
            tts: !!fishAudioService,
            video: !!videoGenerator,
            jobs: !!jobQueue,
            bible: !!bibleService
        }
    });
});

// Root redirect
app.get('/', (_req, res) => {
    res.redirect('/bible.html');
});

// TTS API endpoints
app.post('/api/tts/generate', async (req, res) => {
    try {
        if (!fishAudioService) {
            return res.status(503).json({ error: 'TTS service not configured' });
        }

        const { text, voiceModelId, format = 'mp3', quality = 'high', speed = 1.0, pitch = 0, sentencesPerChunk = 1 } = req.body;
        
        if (!text || !voiceModelId) {
            return res.status(400).json({ error: 'Text and voiceModelId are required' });
        }

        // Create job
        const jobId = uuidv4();
        const job = {
            id: jobId,
            type: 'tts',
            status: 'processing',
            progress: 0,
            data: { text, voiceModelId, format, quality, speed, pitch, sentencesPerChunk },
            createdAt: new Date().toISOString()
        };

        jobQueue.addJob(job);

        // Process TTS asynchronously
        processTTSJob(job).catch(error => {
            console.error('[TTS] Job failed:', error);
            jobQueue.updateJob(jobId, { status: 'failed', error: error.message });
        });

        res.json({
            success: true,
            jobId,
            message: 'TTS job started'
        });

    } catch (error) {
        console.error('[API] TTS generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tts/test', async (_req, res) => {
    try {
        if (!fishAudioService) {
            return res.status(503).json({ error: 'TTS service not configured' });
        }

        const result = await fishAudioService.testConnection();
        res.json(result);
    } catch (error) {
        console.error('[API] TTS test error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Video generation API endpoints
app.post('/api/video/generate', async (req, res) => {
    try {
        if (!videoGenerator) {
            return res.status(503).json({ error: 'Video service not configured' });
        }

        const { audioFile, videoSettings } = req.body;
        
        if (!audioFile) {
            return res.status(400).json({ error: 'Audio file is required' });
        }

        // Create job
        const jobId = uuidv4();
        const job = {
            id: jobId,
            type: 'video',
            status: 'processing',
            progress: 0,
            data: { audioFile, videoSettings },
            createdAt: new Date().toISOString()
        };

        jobQueue.addJob(job);

        // Process video generation asynchronously
        processVideoJob(job).catch(error => {
            console.error('[Video] Job failed:', error);
            jobQueue.updateJob(jobId, { status: 'failed', error: error.message });
        });

        res.json({
            success: true,
            jobId,
            message: 'Video generation job started'
        });

    } catch (error) {
        console.error('[API] Video generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/video/test', async (_req, res) => {
    try {
        if (!videoGenerator) {
            return res.status(503).json({ error: 'Video service not configured' });
        }

        const result = await videoGenerator.testFFmpeg();
        res.json(result);
    } catch (error) {
        console.error('[API] Video test error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Bible API endpoints
app.get('/api/bible/books', (_req, res) => {
    try {
        const books = bibleService.getBooks();
        res.json(books);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/bible/translations', (_req, res) => {
    try {
        const translations = bibleService.getTranslations();
        res.json(translations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/bible/generate', async (req, res) => {
    try {
        if (!fishAudioService) {
            return res.status(503).json({ error: 'TTS service not configured' });
        }

        const { 
            translation, 
            book, 
            chapter, 
            verseRanges, 
            excludeNumbers, 
            excludeFootnotes, 
            type, 
            chapters,
            generateAudio,
            voiceModelId,
            generateVideo,
            videoSettings
        } = req.body;

        // Create job
        const jobId = uuidv4();
        const job = {
            id: jobId,
            type: 'bible',
            status: 'processing',
            progress: 0,
            data: { 
                translation, 
                book, 
                chapter, 
                verseRanges, 
                excludeNumbers, 
                excludeFootnotes, 
                type, 
                chapters,
                generateAudio,
                voiceModelId,
                generateVideo,
                videoSettings
            },
            createdAt: new Date().toISOString()
        };

        jobQueue.addJob(job);

        // Process Bible job asynchronously
        processBibleJob(job).catch(error => {
            console.error('[Bible] Job failed:', error);
            jobQueue.updateJob(jobId, { status: 'failed', error: error.message });
        });

        res.json({
            success: true,
            jobId,
            message: 'Bible processing job started'
        });

    } catch (error) {
        console.error('[API] Bible generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Job management API endpoints
app.get('/api/jobs', (_req, res) => {
    try {
        const jobs = jobQueue.getJobs();
        res.json({ jobs });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/jobs/:jobId', (req, res) => {
    try {
        const { jobId } = req.params;
        const job = jobQueue.getJob(jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        res.json({ job });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/jobs/:jobId', (req, res) => {
    try {
        const { jobId } = req.params;
        const success = jobQueue.removeJob(jobId);
        res.json({ success, message: success ? 'Job removed' : 'Job not found' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Outputs management
app.get('/api/outputs', (_req, res) => {
    try {
        const files = fs.readdirSync(OUTPUTS_DIR)
            .filter(f => !f.startsWith('.'))
            .map(name => {
                const filePath = path.join(OUTPUTS_DIR, name);
                const stats = fs.statSync(filePath);
                return {
                    name,
                    size: stats.size,
                    modified: stats.mtime,
                    url: `/outputs/${name}`
                };
            })
            .sort((a, b) => b.modified - a.modified);
        
        res.json({ files });
    } catch (error) {
        console.error('[API] Error listing outputs:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/outputs/rename', (req, res) => {
    try {
        const { oldName, newName } = req.body;
        if (!oldName || !newName) {
            return res.status(400).json({ error: 'Missing names' });
        }
        
        const oldPath = path.join(OUTPUTS_DIR, oldName);
        const newPath = path.join(OUTPUTS_DIR, newName);
        
        if (!fs.existsSync(oldPath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        fs.renameSync(oldPath, newPath);
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Error renaming output:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/outputs/delete', (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Missing name' });
        }
        
        const filePath = path.join(OUTPUTS_DIR, name);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        fs.unlinkSync(filePath);
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Error deleting output:', error);
        res.status(500).json({ error: error.message });
    }
});

// Serve outputs
app.use('/outputs', express.static(OUTPUTS_DIR, {
    maxAge: '1h',
    etag: true,
    lastModified: true
}));

// Job processing functions
async function processTTSJob(job) {
    try {
        const { text, voiceModelId, format, quality, speed, pitch, sentencesPerChunk } = job.data;
        
        jobQueue.updateJob(job.id, { progress: 10, status: 'processing' });
        
        const audioFile = await fishAudioService.generateAudio(text, voiceModelId, {
            format, quality, speed, pitch, sentencesPerChunk
        });
        
        jobQueue.updateJob(job.id, { 
            progress: 100, 
            status: 'completed',
            result: { audioFile: path.basename(audioFile) }
        });
        
    } catch (error) {
        jobQueue.updateJob(job.id, { status: 'failed', error: error.message });
        throw error;
    }
}

async function processVideoJob(job) {
    try {
        const { audioFile, videoSettings } = job.data;
        
        jobQueue.updateJob(job.id, { progress: 10, status: 'processing' });
        
        const broadcastLog = (message) => {
            console.log(`[Video] ${message}`);
        };
        
        const videoFile = await videoGenerator.createVideo(audioFile, videoSettings, job.id, broadcastLog);
        
        jobQueue.updateJob(job.id, { 
            progress: 100, 
            status: 'completed',
            result: { videoFile: path.basename(videoFile) }
        });
        
    } catch (error) {
        jobQueue.updateJob(job.id, { status: 'failed', error: error.message });
        throw error;
    }
}

async function processBibleJob(job) {
    try {
        const { 
            translation, 
            book, 
            chapter, 
            verseRanges, 
            excludeNumbers, 
            excludeFootnotes, 
            type, 
            chapters,
            generateAudio,
            voiceModelId,
            generateVideo,
            videoSettings
        } = job.data;
        
        jobQueue.updateJob(job.id, { progress: 20, status: 'processing' });
        
        // Fetch and process Bible text
        const bibleText = await bibleService.getBibleText({
            translation, book, chapter, verseRanges, excludeNumbers, excludeFootnotes, type, chapters
        });
        
        jobQueue.updateJob(job.id, { progress: 40, status: 'processing' });
        
        // Save text file
        const timestamp = Date.now();
        const textFilename = `bible-${book}-${type === 'book' ? 'entire' : type === 'chapters' ? chapters : chapter}-${translation}-${timestamp}.txt`;
        const textFilePath = path.join(OUTPUTS_DIR, textFilename);
        fs.writeFileSync(textFilePath, bibleText);
        
        let audioFile = null;
        let videoFile = null;
        
        // Generate audio if requested
        if (generateAudio && voiceModelId) {
            jobQueue.updateJob(job.id, { progress: 60, status: 'processing' });
            
            audioFile = await fishAudioService.generateAudio(bibleText, voiceModelId, {
                format: 'mp3',
                quality: 'high',
                sentencesPerChunk: 2
            });
            
            jobQueue.updateJob(job.id, { progress: 80, status: 'processing' });
        }
        
        // Generate video if requested
        if (generateVideo && audioFile) {
            const broadcastLog = (message) => {
                console.log(`[Video] ${message}`);
            };
            
            videoFile = await videoGenerator.createVideo(audioFile, videoSettings, job.id, broadcastLog);
        }
        
        jobQueue.updateJob(job.id, { 
            progress: 100, 
            status: 'completed',
            result: { 
                textFile: textFilename,
                audioFile: audioFile ? path.basename(audioFile) : null,
                videoFile: videoFile ? path.basename(videoFile) : null
            }
        });
        
    } catch (error) {
        jobQueue.updateJob(job.id, { status: 'failed', error: error.message });
        throw error;
    }
}

// Start server
app.listen(PORT, () => {
    console.log(`[Server] dScribe TTS & Video Generation Service listening on http://localhost:${PORT}`);
    console.log(`[Server] Services: TTS=${!!fishAudioService}, Video=${!!videoGenerator}, Jobs=${!!jobQueue}, Bible=${!!bibleService}`);
});

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig, saveConfig } from './config.js';
import { UserLogger } from './logger.js';
import { parseVerseRanges } from './bible/verseRange.js';
import { fetchBibleText, cleanupBibleText, AVAILABLE_TRANSLATIONS, testBibleApiConnection } from './bible/bibleApiProvider.js';
import { splitIntoSentences, groupSentences } from './text/segment.js';
import { createTTSService } from './tts/service.js';
import { loadPreferences, savePreferences } from './memory.js';
import { requireAuth, getAuthMiddleware, createSession, deleteSession, checkRateLimit } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Cookie parsing for sessions
app.use((req, res, next) => {
	const cookies = {};
	if (req.headers.cookie) {
		req.headers.cookie.split(';').forEach(cookie => {
			const [name, value] = cookie.trim().split('=');
			cookies[name] = value;
		});
	}
	req.cookies = cookies;
	
	// Get client IP
	req.clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection.remoteAddress || req.socket.remoteAddress || req.ip || 'unknown';
	
	next();
});

const ROOT = path.resolve(__dirname, '..');
const STORAGE_DIR = path.join(ROOT, 'storage');
const OUTPUTS_DIR = path.join(STORAGE_DIR, 'outputs');
const LOGS_DIR = path.join(STORAGE_DIR, 'logs');
const PUBLIC_DIR = path.join(ROOT, 'public');
const CONFIG_DIR = path.join(ROOT, 'config');
const QUEUE_FILE = path.join(STORAGE_DIR, 'queue.json');

ensureDir(STORAGE_DIR);
ensureDir(OUTPUTS_DIR);
ensureDir(LOGS_DIR);
ensureDir(CONFIG_DIR);

function ensureDir(dirPath) {
	if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

let config = loadConfig(ROOT);
const logger = new UserLogger(LOGS_DIR);

// Initialize TTS service with error handling
let ttsService = null;
try {
	ttsService = createTTSService(config);
	console.log('[Server] TTS service initialized successfully');
} catch (error) {
	console.error('[Server] TTS service initialization failed:', error.message);
	// Continue without TTS service - will show errors in UI
}

logger.prune();
setInterval(() => logger.prune(), 24 * 60 * 60 * 1000);

// Auth middleware for all routes
app.use(getAuthMiddleware());

// Static assets (no auth required)
app.use('/', express.static(PUBLIC_DIR));

// Auth endpoints (no auth required)
app.post('/api/auth/login', (req, res) => {
	// Check rate limit
	if (!checkRateLimit(req.clientIP)) {
		return res.status(429).json({ error: 'Too many login attempts. Please try again in 15 minutes.' });
	}
	
	const { user } = req.body || {};
	if (!user) {
		return res.status(400).json({ error: 'Please enter your name' });
	}
	
	const normalizedInput = user.trim().toLowerCase();
	const allowedUsers = config.allowedUsers || [];
	const isValidUser = allowedUsers.some(allowedUser => 
		allowedUser.toLowerCase() === normalizedInput
	);
	
	if (!isValidUser) {
		return res.status(400).json({ error: 'Invalid user name' });
	}
	
	// Use the original case from config
	const normalizedUser = allowedUsers.find(allowedUser => 
		allowedUser.toLowerCase() === normalizedInput
	);
	
	const sessionId = createSession(normalizedUser);
	res.cookie('sessionId', sessionId, { 
		httpOnly: true, 
		secure: false, // set to true in production with HTTPS
		maxAge: 24 * 60 * 60 * 1000 // 24 hours
	});
	res.json({ ok: true });
});

app.post('/api/auth/logout', (req, res) => {
	const sessionId = req.cookies?.sessionId;
	if (sessionId) {
		deleteSession(sessionId);
	}
	res.clearCookie('sessionId');
	res.json({ ok: true });
});

// Basic health (no auth required)
app.get('/api/health', (_req, res) => {
	res.json({ ok: true, uptime: process.uptime() });
});

// Public config meta (no auth required)
app.get('/api/config/meta', (_req, res) => {
	res.json({
		voiceModels: (config.voiceModels || []).map(v => ({ id: v.id, name: v.name })),
	});
});

// Voice models endpoint (no auth required for reading)
app.get('/api/models', async (_req, res) => {
	try {
		if (!ttsService) {
			// If TTS service is not available, return config voice models as fallback
			const configVoices = config.voiceModels || [];
			const defaultVoices = [
				{ id: 'default-voice-1', name: 'Default Voice 1' },
				{ id: 'default-voice-2', name: 'Default Voice 2' }
			];
			const voices = configVoices.length > 0 ? configVoices : defaultVoices;
			
			return res.json({ 
				voiceModels: voices.map(v => ({ id: v.id, name: v.name })),
				note: configVoices.length > 0 ? 'Using config voice models' : 'Using default voice models (no config found)'
			});
		}
		
		const voices = await ttsService.getAvailableVoices();
		res.json({ voiceModels: voices.map(v => ({ id: v.id, name: v.name })) });
	} catch (error) {
		console.error('[API] Error fetching voices:', error);
		// Fallback to config voice models or defaults
		const configVoices = config.voiceModels || [];
		const defaultVoices = [
			{ id: 'default-voice-1', name: 'Default Voice 1' },
			{ id: 'default-voice-2', name: 'Default Voice 2' }
		];
		const voices = configVoices.length > 0 ? configVoices : defaultVoices;
		
		res.json({ 
			voiceModels: voices.map(v => ({ id: v.id, name: v.name })),
			note: configVoices.length > 0 ? 'Using config voice models (API error)' : 'Using default voice models (API error)'
		});
	}
});

// Protected routes (require auth)
app.use(requireAuth);

// Voice model management (protected)
app.post('/api/models', (req, res) => {
	const { id, name } = req.body || {};
	if (!id) return res.status(400).json({ error: 'Missing id' });
	const list = Array.isArray(config.voiceModels) ? [...config.voiceModels] : [];
	if (list.some(v => v.id === id)) return res.status(409).json({ error: 'Exists' });
	list.push({ id, name: name || id });
	config = saveConfig(ROOT, { ...config, voiceModels: list });
	res.json({ ok: true });
});

app.post('/api/models/delete', (req, res) => {
	const { id } = req.body || {};
	const list = Array.isArray(config.voiceModels) ? config.voiceModels.filter(v => v.id !== id) : [];
	config = saveConfig(ROOT, { ...config, voiceModels: list });
	res.json({ ok: true });
});

// Preferences
app.get('/api/memory/preferences', (_req, res) => {
	const prefs = loadPreferences(ROOT);
	res.json(prefs);
});
app.post('/api/memory/preferences', (req, res) => {
	const current = loadPreferences(ROOT);
	const merged = { ...current, ...req.body };
	const saved = savePreferences(ROOT, merged);
	res.json(saved);
});

// Bible fetch endpoint
app.post('/api/bible/fetch', async (req, res) => {
	try {
		const { translation = 'web', book = 'John', chapter = 1, verseRanges = '', excludeNumbers = true, excludeFootnotes = true } = req.body || {};
		const verses = parseVerseRanges(String(verseRanges || ''));
		
		console.log(`[API] Bible fetch request: ${book} ${chapter} verses ${verses.join(',')} (${translation})`);
		
		const raw = await fetchBibleText({ translation, book, chapter, verses });
		const cleaned = cleanupBibleText(raw, { excludeNumbers, excludeFootnotes });
		
		res.json({
			text: cleaned,
			reference: `${book} ${chapter}:${verses.join(',')}`,
			translation: translation,
			originalLength: raw.length,
			cleanedLength: cleaned.length
		});
	} catch (error) {
		console.error('[API] Bible fetch error:', error.message);
		res.status(500).json({ 
			error: error.message,
			troubleshooting: error.troubleshooting || [
				'Check the book name and chapter number',
				'Verify the translation is available',
				'Ensure verse ranges are valid'
			]
		});
	}
});

// Get available Bible translations
app.get('/api/bible/translations', (_req, res) => {
	res.json({ translations: AVAILABLE_TRANSLATIONS });
});

// Test Bible API connection
app.get('/api/bible/test', async (_req, res) => {
	try {
		const result = await testBibleApiConnection();
		res.json(result);
	} catch (error) {
		console.error('[API] Bible test error:', error);
		res.status(500).json({ 
			error: error.message,
			troubleshooting: [
				'Check your internet connection',
				'Verify bible-api.com is accessible',
				'Try again in a few moments'
			]
		});
	}
});

// SSE for progress updates
const clients = new Map(); // jobId -> res
app.get('/api/progress/:jobId', (req, res) => {
	const { jobId } = req.params;
	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Connection', 'keep-alive');
	res.flushHeaders();
	clients.set(jobId, res);
	req.on('close', () => {
		clients.delete(jobId);
	});
});

function emitProgress(jobId, data) {
	const client = clients.get(jobId);
	if (client) {
		client.write(`data: ${JSON.stringify(data)}\n\n`);
	}
}

// In-memory queue with persistence
const jobQueue = [];
let isProcessing = false;

function saveQueue() {
	try {
		fs.writeFileSync(QUEUE_FILE, JSON.stringify({ jobQueue }, null, 2));
	} catch {}
}

function loadQueue() {
	try {
		if (!fs.existsSync(QUEUE_FILE)) return;
		const raw = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
		if (Array.isArray(raw.jobQueue)) {
			jobQueue.splice(0, jobQueue.length, ...raw.jobQueue);
		}
	} catch {}
}

loadQueue();

async function processQueue() {
	if (isProcessing) return;
	isProcessing = true;
	while (jobQueue.length > 0) {
		const job = jobQueue[0];
		try {
			logger.log(job.user, { event: 'job_start', jobId: job.id, type: job.type });
			emitProgress(job.id, { status: 'started', step: 'init' });

			if (job.type === 'tts') {
				await processTTSJob(job);
			} else if (job.type === 'bible-tts') {
				await handleBibleTtsJob(job);
			} else {
				await new Promise(r => setTimeout(r, 500));
				emitProgress(job.id, { status: 'progress', step: 'processing', progress: 50 });
				await new Promise(r => setTimeout(r, 700));
				const outPath = path.join(OUTPUTS_DIR, `${job.id}.txt`);
				fs.writeFileSync(outPath, `Job ${job.id} placeholder output`);
				emitProgress(job.id, { status: 'completed', output: `/outputs/${job.id}.txt` });
			}

			logger.log(job.user, { event: 'job_complete', jobId: job.id });
		} catch (err) {
			console.error(err);
			emitProgress(job.id, { status: 'error', message: String(err) });
			logger.log(job.user, { event: 'job_error', jobId: job.id, error: String(err) });
		}
		finally {
			jobQueue.shift();
			saveQueue();
		}
	}
	isProcessing = false;
}

app.get('/api/queue/status', (_req, res) => {
	res.json({ pending: jobQueue.length, processing: isProcessing });
});

async function processTTSJob(job) {
	if (!ttsService) {
		const error = 'TTS service not available. Please check your Fish.Audio API key configuration.';
		emitProgress(job.id, { 
			status: 'error', 
			error,
			troubleshooting: [
				'Add "fishAudioApiKey" to your config.json file',
				'Get your API key from https://fish.audio',
				'Restart the server after adding the API key'
			]
		});
		return;
	}
	
	const segmentFiles = [];
	
	try {
		const { text, voiceModelId, format = 'mp3', sentencesPerChunk = 3, bibleReference = null } = job.data;
		const chunks = groupSentences(splitIntoSentences(text), sentencesPerChunk);
		
		emitProgress(job.id, { status: 'progress', step: 'tts', chunk: 0, total: chunks.length });
		
		for (let i = 0; i < chunks.length; i++) {
			emitProgress(job.id, { status: 'progress', step: 'tts', chunk: i + 1, total: chunks.length });
			const file = await ttsService.synthesizeChunkToFile({ 
				chunkText: chunks[i], 
				voiceModelId, 
				format, 
				outputsDir: OUTPUTS_DIR, 
				jobId: job.id, 
				index: i,
				user: job.user,
				bibleReference
			});
			segmentFiles.push(file);
		}
		
		const stitched = await ttsService.stitchSegments({ 
			segmentFiles, 
			outputsDir: OUTPUTS_DIR, 
			jobId: job.id, 
			format,
			user: job.user,
			voiceModelId: job.data.voiceModelId,
			bibleReference
		});
		
		emitProgress(job.id, { status: 'completed', output: stitched.replace(OUTPUTS_DIR, '/outputs') });
	} catch (error) {
		console.error('[TTS Job] Error processing TTS job:', error);
		
		// Clean up segment files even if stitching failed
		if (segmentFiles.length > 0) {
			await cleanupSegmentFiles(segmentFiles);
		}
		
		emitProgress(job.id, { 
			status: 'error', 
			error: error.message,
			troubleshooting: error.troubleshooting || [
				'Check your internet connection',
				'Verify your API key is correct',
				'Ensure your Fish.Audio account is active'
			]
		});
	}
}

async function cleanupSegmentFiles(segmentFiles) {
	try {
		console.log(`[TTS Job] Cleaning up ${segmentFiles.length} segment files after error`);
		
		for (const file of segmentFiles) {
			try {
				if (fs.existsSync(file)) {
					fs.unlinkSync(file);
					console.log(`[TTS Job] Deleted segment file: ${path.basename(file)}`);
				}
			} catch (deleteError) {
				console.warn(`[TTS Job] Failed to delete segment file ${file}:`, deleteError.message);
				// Don't throw error for cleanup failures - continue with other files
			}
		}
		
		console.log(`[TTS Job] Segment cleanup completed`);
	} catch (error) {
		console.error(`[TTS Job] Error during segment cleanup:`, error);
		// Don't throw error for cleanup failures
	}
}

async function handleBibleTtsJob(job) {
	const { translation, book, chapter, verseRanges, excludeNumbers, excludeFootnotes, voiceModelId, format = 'mp3', sentencesPerChunk = 3 } = job.payload;
	const verses = parseVerseRanges(String(verseRanges || ''));
	const raw = await fetchBibleText({ translation, book, chapter, verses });
	const text = cleanupBibleText(raw, { excludeNumbers, excludeFootnotes });
	
	// Create Bible reference for file naming
	const bibleReference = `${book}-${chapter}-${verses.join('-')}`;
	
	await processTTSJob({ 
		id: job.id, 
		user: job.user, 
		data: { 
			text, 
			voiceModelId, 
			format, 
			sentencesPerChunk,
			bibleReference 
		} 
	});
}

// Start TTS job
app.post('/api/jobs/tts', (req, res) => {
	const id = uuidv4();
	const user = req.user; // from auth middleware
	const payload = {
		text: String(req.body?.text || ''),
		voiceModelId: req.body?.voiceModelId || (config.voiceModels?.[0]?.id || 'default'),
		format: req.body?.format || 'mp3',
		sentencesPerChunk: Number(req.body?.sentencesPerChunk || 3)
	};
	const job = { id, type: 'tts', user, createdAt: Date.now(), data: payload };
	jobQueue.push(job);
	saveQueue();
	processQueue();
	res.json({ id });
});

// Start Bible TTS job
app.post('/api/jobs/bible', (req, res) => {
	const id = uuidv4();
	const user = req.user; // from auth middleware
	const payload = {
		translation: req.body?.translation || 'WEB',
		book: req.body?.book || 'John',
		chapter: Number(req.body?.chapter || 1),
		verseRanges: req.body?.verseRanges || '',
		excludeNumbers: Boolean(req.body?.excludeNumbers ?? true),
		excludeFootnotes: Boolean(req.body?.excludeFootnotes ?? true),
		voiceModelId: req.body?.voiceModelId || (config.voiceModels?.[0]?.id || 'default'),
		format: req.body?.format || 'mp3',
		sentencesPerChunk: Number(req.body?.sentencesPerChunk || 3)
	};
	const job = { id, type: 'bible-tts', user, createdAt: Date.now(), payload };
	jobQueue.push(job);
	saveQueue();
	processQueue();
	res.json({ id });
});

// Outputs list
app.get('/api/outputs', (_req, res) => {
	const files = fs.readdirSync(OUTPUTS_DIR)
		.filter(f => !f.startsWith('.'))
		.map(name => ({ name, url: `/outputs/${name}` }));
	res.json({ files });
});

// Outputs rename
app.post('/api/outputs/rename', (req, res) => {
	const { oldName, newName } = req.body || {};
	if (!oldName || !newName) return res.status(400).json({ error: 'Missing names' });
	const oldPath = path.join(OUTPUTS_DIR, oldName);
	const newPath = path.join(OUTPUTS_DIR, newName);
	if (!fs.existsSync(oldPath)) return res.status(404).json({ error: 'Not found' });
	fs.renameSync(oldPath, newPath);
	res.json({ ok: true });
});

// Outputs delete
app.post('/api/outputs/delete', (req, res) => {
	const { name } = req.body || {};
	if (!name) return res.status(400).json({ error: 'Missing name' });
	const p = path.join(OUTPUTS_DIR, name);
	if (!fs.existsSync(p)) return res.status(404).json({ error: 'Not found' });
	fs.unlinkSync(p);
	res.json({ ok: true });
});

// Serve stored outputs
app.use('/outputs', express.static(OUTPUTS_DIR));

// Add TTS connection test endpoint
app.get('/api/tts/test', async (_req, res) => {
	try {
		if (!ttsService) {
			return res.json({
				provider: 'fish-audio',
				success: false,
				error: 'TTS service not available',
				troubleshooting: [
					'Add "fishAudioApiKey" to your config.json file',
					'Get your API key from https://fish.audio',
					'Restart the server after adding the API key'
				]
			});
		}
		
		const result = await ttsService.testConnection();
		res.json(result);
	} catch (error) {
		console.error('[API] TTS test error:', error);
		res.status(500).json({ 
			error: error.message,
			troubleshooting: error.troubleshooting || [
				'Check your internet connection',
				'Verify your API key is correct',
				'Ensure your Fish.Audio account is active'
			]
		});
	}
});

// Add TTS status endpoint
app.get('/api/tts/status', (_req, res) => {
	if (!ttsService) {
		return res.json({
			configured: false,
			initialized: false,
			available: false,
			apiKeyPresent: false,
			apiKeyMasked: 'Not configured',
			error: 'TTS service not available'
		});
	}
	
	res.json(ttsService.getStatus());
});

process.on('SIGINT', () => { saveQueue(); process.exit(0); });
process.on('SIGTERM', () => { saveQueue(); process.exit(0); });

app.listen(PORT, () => {
	console.log(`Server listening on http://localhost:${PORT}`);
});

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
import { fetchBibleText, cleanupBibleText, AVAILABLE_TRANSLATIONS, testLocalBibleConnection, BIBLE_BOOKS, validateChapter, validateVerseRanges } from './bible/localBibleProvider.js';
import { groupSentences, splitIntoSentences } from './text/segment.js';
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

function getMaxChapters(book) {
	const chapterCounts = {
		'Genesis': 50, 'Exodus': 40, 'Leviticus': 27, 'Numbers': 36, 'Deuteronomy': 34,
		'Joshua': 24, 'Judges': 21, 'Ruth': 4, '1 Samuel': 31, '2 Samuel': 24,
		'1 Kings': 22, '2 Kings': 25, '1 Chronicles': 29, '2 Chronicles': 36,
		'Ezra': 10, 'Nehemiah': 13, 'Esther': 10, 'Job': 42, 'Psalms': 150,
		'Proverbs': 31, 'Ecclesiastes': 12, 'Song of Solomon': 8, 'Isaiah': 66,
		'Jeremiah': 52, 'Lamentations': 5, 'Ezekiel': 48, 'Daniel': 12,
		'Hosea': 14, 'Joel': 3, 'Amos': 9, 'Obadiah': 1, 'Jonah': 4, 'Micah': 7,
		'Nahum': 3, 'Habakkuk': 3, 'Zephaniah': 3, 'Haggai': 2, 'Zechariah': 14, 'Malachi': 4,
		'Matthew': 28, 'Mark': 16, 'Luke': 24, 'John': 21, 'Acts': 28,
		'Romans': 16, '1 Corinthians': 16, '2 Corinthians': 13, 'Galatians': 6,
		'Ephesians': 6, 'Philippians': 4, 'Colossians': 4, '1 Thessalonians': 5,
		'2 Thessalonians': 3, '1 Timothy': 6, '2 Timothy': 4, 'Titus': 3, 'Philemon': 1,
		'Hebrews': 13, 'James': 5, '1 Peter': 5, '2 Peter': 3, '1 John': 5,
		'2 John': 1, '3 John': 1, 'Jude': 1, 'Revelation': 22
	};
	return chapterCounts[book] || 1;
}

let config = loadConfig(ROOT);
const logger = new UserLogger(LOGS_DIR);

// Logging system - initialize before TTS service
const logSubscribers = new Map();
const recentLogs = [];
const MAX_RECENT_LOGS = 100;

function broadcastLog(level, category, message, details = null) {
	const logEntry = {
		timestamp: new Date().toISOString(),
		level,
		category,
		message,
		details
	};

	// Add to recent logs
	recentLogs.unshift(logEntry);
	if (recentLogs.length > MAX_RECENT_LOGS) {
		recentLogs.pop();
	}

	// Broadcast to all connected clients
	const logData = `data: ${JSON.stringify(logEntry)}\n\n`;
	logSubscribers.forEach((res) => {
		try {
			res.write(logData);
		} catch (error) {
			// Client disconnected, will be cleaned up on next iteration
		}
	});

	// Also log to console for debugging
	console.log(`[${level.toUpperCase()}] [${category}] ${message}${details ? ` - ${details}` : ''}`);
}

function sendRecentLogs(res) {
	recentLogs.forEach(logEntry => {
		const logData = `data: ${JSON.stringify(logEntry)}\n\n`;
		try {
			res.write(logData);
		} catch (error) {
			// Client disconnected
		}
	});
}

// Initialize TTS service with error handling
let ttsService = null;
try {
	ttsService = createTTSService(config);
	console.log('[Server] TTS service initialized successfully');
	broadcastLog('success', 'system', 'TTS service initialized successfully');
} catch (error) {
	console.error('[Server] TTS service initialization failed:', error.message);
	broadcastLog('error', 'system', 'TTS service initialization failed', error.message);
	// Continue without TTS service - will show errors in UI
}

logger.prune();
setInterval(() => logger.prune(), 24 * 60 * 60 * 1000);

// Periodic cleanup of orphaned chunk files
async function cleanupOrphanedChunkFiles() {
	try {
		const files = fs.readdirSync(OUTPUTS_DIR);
		const chunkFiles = files.filter(f => /-\d\.mp3$/.test(f));
		
		if (chunkFiles.length > 0) {
			broadcastLog('info', 'system', `Cleaning up ${chunkFiles.length} orphaned chunk files`);
			
			for (const file of chunkFiles) {
				try {
					const filePath = path.join(OUTPUTS_DIR, file);
					fs.unlinkSync(filePath);
					broadcastLog('debug', 'system', `Deleted orphaned chunk file: ${file}`);
				} catch (error) {
					broadcastLog('warning', 'system', `Failed to delete orphaned chunk file: ${file}`, error.message);
				}
			}
			
			broadcastLog('success', 'system', `Cleanup completed - removed ${chunkFiles.length} orphaned chunk files`);
		}
	} catch (error) {
		broadcastLog('error', 'system', 'Error during orphaned chunk cleanup', error.message);
	}
}

// Run cleanup every hour
setInterval(cleanupOrphanedChunkFiles, 60 * 60 * 1000);

// Public Bible endpoints (no auth required)
app.get('/api/bible/books', (_req, res) => {
	res.json({ books: BIBLE_BOOKS });
});

app.get('/api/bible/translations', (_req, res) => {
	res.json({ translations: AVAILABLE_TRANSLATIONS });
});

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
		const { translation = 'web', book = 'John', chapter = 1, verseRanges = '', excludeNumbers = true, excludeFootnotes = true, type = 'chapter', chapters = '' } = req.body;
		
		let allText = '';
		
		if (type === 'book') {
			// Handle entire book
			const maxChapters = getMaxChapters(book);
			for (let ch = 1; ch <= maxChapters; ch++) {
				const chapterValidation = validateChapter(book, ch);
				if (!chapterValidation.valid) {
					continue; // Skip invalid chapters
				}
				
				const rawText = await fetchBibleText({ translation, book, chapter: ch });
				const cleanedText = cleanupBibleText(rawText, { excludeNumbers, excludeFootnotes });
				allText += cleanedText + '\n\n';
			}
		} else if (type === 'chapters' && chapters) {
			// Handle multiple chapters
			const chapterRanges = chapters.split(',').map(range => range.trim());
			for (const range of chapterRanges) {
				if (range.includes('-')) {
					const [start, end] = range.split('-').map(n => parseInt(n.trim()));
					if (!isNaN(start) && !isNaN(end)) {
						for (let ch = start; ch <= end; ch++) {
							const chapterValidation = validateChapter(book, ch);
							if (!chapterValidation.valid) {
								continue;
							}
							
							const rawText = await fetchBibleText({ translation, book, chapter: ch });
							const cleanedText = cleanupBibleText(rawText, { excludeNumbers, excludeFootnotes });
							allText += cleanedText + '\n\n';
						}
					}
				} else {
					const ch = parseInt(range);
					if (!isNaN(ch)) {
						const chapterValidation = validateChapter(book, ch);
						if (chapterValidation.valid) {
							const rawText = await fetchBibleText({ translation, book, chapter: ch });
							const cleanedText = cleanupBibleText(rawText, { excludeNumbers, excludeFootnotes });
							allText += cleanedText + '\n\n';
						}
					}
				}
			}
		} else {
			// Handle single chapter (original logic)
			const chapterNum = parseInt(chapter);
			if (isNaN(chapterNum)) {
				return res.status(400).json({ error: 'Chapter must be a number' });
			}
			
			const chapterValidation = validateChapter(book, chapterNum);
			if (!chapterValidation.valid) {
				return res.status(400).json({ error: chapterValidation.error });
			}
			
			// Validate verse ranges if provided
			if (verseRanges && verseRanges.trim()) {
				const verseValidation = validateVerseRanges(book, chapterNum, verseRanges);
				if (!verseValidation.valid) {
					return res.status(400).json({ error: verseValidation.error });
				}
			}
			
			// Parse verse ranges
			const verses = verseRanges ? parseVerseRanges(verseRanges) : null;
			
			// Fetch Bible text
			const rawText = await fetchBibleText({ translation, book, chapter: chapterNum, verses });
			allText = cleanupBibleText(rawText, { excludeNumbers, excludeFootnotes });
		}
		
		res.json({ text: allText });
		
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

// Validate Bible reference
app.post('/api/bible/validate', (req, res) => {
	try {
		const { book, chapter, verses } = req.body;
		
		if (!book) {
			return res.status(400).json({ error: 'Book is required' });
		}
		
		if (!chapter) {
			return res.status(400).json({ error: 'Chapter is required' });
		}
		
		const chapterNum = parseInt(chapter);
		if (isNaN(chapterNum)) {
			return res.status(400).json({ error: 'Chapter must be a number' });
		}
		
		// Validate chapter
		const chapterValidation = validateChapter(book, chapterNum);
		if (!chapterValidation.valid) {
			return res.status(400).json({ error: chapterValidation.error });
		}
		
		// Validate verses if provided
		if (verses && verses.trim()) {
			const verseValidation = validateVerseRanges(book, chapterNum, verses);
			if (!verseValidation.valid) {
				return res.status(400).json({ error: verseValidation.error });
			}
		}
		
		res.json({ 
			valid: true, 
			bookInfo: chapterValidation.bookInfo,
			message: 'Bible reference is valid'
		});
		
	} catch (error) {
		console.error('[API] Bible validation error:', error.message);
		res.status(500).json({ error: 'Validation failed' });
	}
});

// Test Bible API connection
app.get('/api/bible/test', async (_req, res) => {
	try {
		const result = await testLocalBibleConnection();
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
			broadcastLog('info', 'job', `Job ${job.id} started`, `Type: ${job.type}, User: ${job.user}`);
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
			broadcastLog('success', 'job', `Job ${job.id} completed successfully`);
		} catch (err) {
			console.error(err);
			broadcastLog('error', 'job', `Job ${job.id} failed`, `Error: ${err.message}`);
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
		
		broadcastLog('info', 'audio', `Starting TTS processing`, `Job: ${job.id}, Chunks: ${chunks.length}, Voice: ${voiceModelId}`);
		emitProgress(job.id, { status: 'progress', step: 'tts', chunk: 0, total: chunks.length });
		
		for (let i = 0; i < chunks.length; i++) {
			broadcastLog('info', 'audio', `Processing chunk ${i + 1}/${chunks.length}`, `Job: ${job.id}, Voice: ${voiceModelId}`);
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
		
		broadcastLog('info', 'audio', `Stitching ${segmentFiles.length} audio segments`, `Job: ${job.id}, User: ${job.user}`);
		const stitched = await ttsService.stitchSegments({ 
			segmentFiles, 
			outputsDir: OUTPUTS_DIR, 
			jobId: job.id, 
			format,
			user: job.user,
			voiceModelId: job.data.voiceModelId,
			bibleReference
		});
		
		broadcastLog('success', 'audio', `Audio creation completed`, `Job: ${job.id}, File: ${path.basename(stitched)}`);
		
		// Clean up any remaining segment files that might not have been cleaned up
		await cleanupSegmentFiles(segmentFiles);
		
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
	const { translation, book, chapter, verseRanges, excludeNumbers, excludeFootnotes, voiceModelId, format = 'mp3', sentencesPerChunk = 3, type = 'chapter', chapters = '' } = job.payload;
	
	broadcastLog('info', 'audio', `Starting Bible TTS job`, `Job: ${job.id}, Book: ${book}, Type: ${type}, Voice: ${voiceModelId}`);
	
	let allText = '';
	let bibleReference = '';
	
	if (type === 'book') {
		// Handle entire book
		const maxChapters = getMaxChapters(book);
		broadcastLog('info', 'audio', `Processing entire book: ${book}`, `Job: ${job.id}, Chapters: 1-${maxChapters}`);
		for (let ch = 1; ch <= maxChapters; ch++) {
			const chapterValidation = validateChapter(book, ch);
			if (!chapterValidation.valid) {
				continue; // Skip invalid chapters
			}
			
			broadcastLog('debug', 'audio', `Fetching chapter ${ch}`, `Job: ${job.id}, Book: ${book}`);
			const rawText = await fetchBibleText({ translation, book, chapter: ch });
			const cleanedText = cleanupBibleText(rawText, { excludeNumbers, excludeFootnotes });
			allText += cleanedText + '\n\n';
		}
		bibleReference = `${book}-entire`;
	} else if (type === 'chapters' && chapters) {
		// Handle multiple chapters
		const chapterRanges = chapters.split(',').map(range => range.trim());
		broadcastLog('info', 'audio', `Processing multiple chapters: ${chapters}`, `Job: ${job.id}, Book: ${book}`);
		for (const range of chapterRanges) {
			if (range.includes('-')) {
				const [start, end] = range.split('-').map(n => parseInt(n.trim()));
				if (!isNaN(start) && !isNaN(end)) {
					broadcastLog('debug', 'audio', `Processing chapter range ${start}-${end}`, `Job: ${job.id}, Book: ${book}`);
					for (let ch = start; ch <= end; ch++) {
						const chapterValidation = validateChapter(book, ch);
						if (!chapterValidation.valid) {
							continue;
						}
						
						broadcastLog('debug', 'audio', `Fetching chapter ${ch}`, `Job: ${job.id}, Book: ${book}`);
						const rawText = await fetchBibleText({ translation, book, chapter: ch });
						const cleanedText = cleanupBibleText(rawText, { excludeNumbers, excludeFootnotes });
						allText += cleanedText + '\n\n';
					}
				}
			} else {
				const ch = parseInt(range);
				if (!isNaN(ch)) {
					const chapterValidation = validateChapter(book, ch);
					if (chapterValidation.valid) {
						broadcastLog('debug', 'audio', `Fetching chapter ${ch}`, `Job: ${job.id}, Book: ${book}`);
						const rawText = await fetchBibleText({ translation, book, chapter: ch });
						const cleanedText = cleanupBibleText(rawText, { excludeNumbers, excludeFootnotes });
						allText += cleanedText + '\n\n';
					}
				}
			}
		}
		bibleReference = `${book}-${chapters}`;
	} else {
		// Handle single chapter (original logic)
		const verses = parseVerseRanges(String(verseRanges || ''));
		const raw = await fetchBibleText({ translation, book, chapter, verses });
		allText = cleanupBibleText(raw, { excludeNumbers, excludeFootnotes });
		bibleReference = `${book}-${chapter}-${verses.join('-')}`;
	}
	
	await processTTSJob({ 
		id: job.id, 
		user: job.user, 
		data: { 
			text: allText, 
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
		translation: req.body?.translation || 'web',
		book: req.body?.book || 'John',
		chapter: Number(req.body?.chapter || 1),
		verseRanges: req.body?.verseRanges || '',
		excludeNumbers: Boolean(req.body?.excludeNumbers ?? true),
		excludeFootnotes: Boolean(req.body?.excludeFootnotes ?? true),
		voiceModelId: req.body?.voiceModelId || (config.voiceModels?.[0]?.id || 'default'),
		format: req.body?.format || 'mp3',
		sentencesPerChunk: Number(req.body?.sentencesPerChunk || 3),
		type: req.body?.type || 'chapter',
		chapters: req.body?.chapters || ''
	};
	const job = { id, type: 'bible-tts', user, createdAt: Date.now(), payload };
	jobQueue.push(job);
	saveQueue();
	processQueue();
	res.json({ id });
});

// Logs streaming endpoint
app.get('/api/logs/stream', (req, res) => {
	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive',
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Headers': 'Cache-Control'
	});

	// Send initial connection message
	const initialMessage = {
		timestamp: new Date().toISOString(),
		level: 'info',
		category: 'system',
		message: 'Log stream connected'
	};
	res.write(`data: ${JSON.stringify(initialMessage)}\n\n`);

	// Add this client to the log subscribers
	const clientId = Date.now() + Math.random();
	logSubscribers.set(clientId, res);

	// Send recent logs
	sendRecentLogs(res);

	// Handle client disconnect
	req.on('close', () => {
		logSubscribers.delete(clientId);
	});
});

// Outputs list
app.get('/api/outputs', (_req, res) => {
	const files = fs.readdirSync(OUTPUTS_DIR)
		.filter(f => !f.startsWith('.'))
		// Filter out temporary chunk files
		.filter(f => {
			// Final files have format: {user}-{type}-{reference}-{voiceId}-{timestamp}.mp3
			// Chunk files have format: {user}-{type}-{reference}-{voiceId}-{chunkNumber}-{timestamp}.mp3
			// The key difference is that chunk files end with -{single digit}.mp3
			// Pattern: ends with -{single digit}.mp3
			const isChunkFile = /-\d\.mp3$/.test(f);
			return !isChunkFile;
		})
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

// Manual cleanup endpoint
app.post('/api/cleanup/chunks', (req, res) => {
	try {
		const files = fs.readdirSync(OUTPUTS_DIR);
		const chunkFiles = files.filter(f => /-\d\.mp3$/.test(f));
		
		let deletedCount = 0;
		for (const file of chunkFiles) {
			try {
				const filePath = path.join(OUTPUTS_DIR, file);
				fs.unlinkSync(filePath);
				deletedCount++;
				broadcastLog('info', 'system', `Manually deleted chunk file: ${file}`);
			} catch (error) {
				broadcastLog('warning', 'system', `Failed to delete chunk file: ${file}`, error.message);
			}
		}
		
		broadcastLog('success', 'system', `Manual cleanup completed - removed ${deletedCount} chunk files`);
		res.json({ success: true, deletedCount });
	} catch (error) {
		broadcastLog('error', 'system', 'Error during manual cleanup', error.message);
		res.status(500).json({ error: error.message });
	}
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
	broadcastLog('info', 'system', `Server started`, `Port: ${PORT}, Environment: ${process.env.NODE_ENV || 'development'}`);
});

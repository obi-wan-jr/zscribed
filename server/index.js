import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import { loadConfig, saveConfig } from './config.js';
import { VideoGenerator } from './videoGenerator.js';
import { VideoDebugger } from './videoDebugger.js';
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

// Generate cache buster based on deployment time
const CACHE_BUSTER = Date.now().toString();

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

// Initialize video generator and debugger
const videoGenerator = new VideoGenerator(OUTPUTS_DIR, STORAGE_DIR);
const videoDebugger = new VideoDebugger(OUTPUTS_DIR);

// Multi-job processing system constants
const MAX_CONCURRENT_JOBS = 3; // Allow up to 3 jobs to run simultaneously
const JOB_TIMEOUT = 30 * 60 * 1000; // 30 minutes timeout per job
const RECOVERY_CHECK_INTERVAL = 5 * 60 * 1000; // Check for stuck jobs every 5 minutes
const MAX_RETRY_ATTEMPTS = 3; // Maximum retry attempts for failed jobs
const RETRY_DELAY_BASE = 5000; // Base delay for retries (5 seconds)
const RETRY_DELAY_MULTIPLIER = 2; // Exponential backoff multiplier

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

// Job recovery and monitoring system
async function checkForStuckJobs() {
	try {
		const now = Date.now();
		const stuckJobs = [];

		for (const [jobId, jobInfo] of activeJobs.entries()) {
			const duration = now - jobInfo.startTime;
			
			if (duration > JOB_TIMEOUT) {
				stuckJobs.push({ jobId, jobInfo, duration });
			}
		}

		if (stuckJobs.length > 0) {
			broadcastLog('warning', 'system', `Found ${stuckJobs.length} stuck jobs, attempting recovery`);
			
			for (const { jobId, jobInfo, duration } of stuckJobs) {
				broadcastLog('warning', 'job', `Job ${jobId} appears stuck`, `Duration: ${Math.round(duration / 1000)}s, User: ${jobInfo.job.user}`);
				
				// Force terminate the stuck job
				activeJobs.delete(jobId);
				
				// Emit error progress
				emitProgress(jobId, { 
					status: 'error', 
					message: `Job timed out after ${Math.round(duration / 1000)} seconds` 
				});
				
				// Log the timeout
				logger.log(jobInfo.job.user, { 
					event: 'job_timeout', 
					jobId, 
					duration: Math.round(duration / 1000) 
				});
			}
			
			// Try to process more jobs after cleanup
			setTimeout(() => processQueue(), 1000);
		}
	} catch (error) {
		broadcastLog('error', 'system', 'Error during stuck job check', error.message);
	}
}



// Public Bible endpoints (no auth required)
app.get('/api/bible/books', (_req, res) => {
	res.json({ books: BIBLE_BOOKS });
});

app.get('/api/bible/translations', (_req, res) => {
	res.json({ translations: AVAILABLE_TRANSLATIONS });
});

// Auth middleware for all routes
app.use(getAuthMiddleware());

// Cache buster middleware for HTML files
app.use((req, res, next) => {
	if (req.path.endsWith('.html')) {
		// Store original send function
		const originalSend = res.send;
		
		res.send = function(data) {
			if (typeof data === 'string') {
				// Replace manual cache buster versions with automatic one
				data = data.replace(/\.js\?v=\d+\.\d+/g, `.js?v=${CACHE_BUSTER}`);
				// Also handle cases where no cache buster exists
				data = data.replace(/\.js"/g, `.js?v=${CACHE_BUSTER}"`);
				data = data.replace(/\.js'/g, `.js?v=${CACHE_BUSTER}'`);
			}
			return originalSend.call(this, data);
		};
	}
	next();
});

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

// Multi-job processing system with recovery
const jobQueue = [];
const activeJobs = new Map(); // Track currently processing jobs
const jobStates = new Map(); // Track job state for resumption

function saveQueue() {
	try {
		const queueData = {
			jobQueue,
			jobStates: Array.from(jobStates.entries()),
			timestamp: Date.now()
		};
		fs.writeFileSync(QUEUE_FILE, JSON.stringify(queueData, null, 2));
	} catch (error) {
		console.error('[Queue] Failed to save queue:', error);
	}
}

function loadQueue() {
	try {
		if (!fs.existsSync(QUEUE_FILE)) return;
		const raw = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
		if (Array.isArray(raw.jobQueue)) {
			jobQueue.splice(0, jobQueue.length, ...raw.jobQueue);
		}
		if (Array.isArray(raw.jobStates)) {
			jobStates.clear();
			for (const [jobId, state] of raw.jobStates) {
				jobStates.set(jobId, state);
			}
		}
	} catch (error) {
		console.error('[Queue] Failed to load queue:', error);
	}
}

loadQueue();

// Server startup recovery - check for any jobs that might have been interrupted
function recoverInterruptedJobs() {
	try {
		// Check if there are any jobs in the queue that might be from a previous server session
		const now = Date.now();
		const maxJobAge = 24 * 60 * 60 * 1000; // 24 hours
		
		const oldJobs = jobQueue.filter(job => (now - job.createdAt) > maxJobAge);
		if (oldJobs.length > 0) {
			broadcastLog('warning', 'system', `Found ${oldJobs.length} old jobs from previous session, removing them`);
			
			// Remove old jobs and their states
			jobQueue.splice(0, jobQueue.length, ...jobQueue.filter(job => (now - job.createdAt) <= maxJobAge));
			
			// Clear job states for old jobs
			for (const job of oldJobs) {
				jobStates.delete(job.id);
				broadcastLog('info', 'system', `Removed old job ${job.id}`, `User: ${job.user}, Age: ${Math.round((now - job.createdAt) / (60 * 60 * 1000))}h`);
			}
			
			saveQueue();
		}
		
		// Clear any job states that are older than 24 hours OR don't have a corresponding job in the queue
		const oldJobStates = [];
		for (const [jobId, state] of jobStates.entries()) {
			const isOld = state.startTime && (now - state.startTime) > maxJobAge;
			const hasNoJob = !jobQueue.find(job => job.id === jobId);
			
			if (isOld || hasNoJob) {
				oldJobStates.push(jobId);
			}
		}
		
		if (oldJobStates.length > 0) {
			broadcastLog('warning', 'system', `Found ${oldJobStates.length} orphaned job states, clearing them`);
			for (const jobId of oldJobStates) {
				jobStates.delete(jobId);
			}
			saveQueue();
		}
		
		broadcastLog('info', 'system', `Job recovery completed`, `Queue: ${jobQueue.length} jobs, Active: ${activeJobs.size} jobs`);
	} catch (error) {
		broadcastLog('error', 'system', 'Error during job recovery', error.message);
	}
}

// Run recovery on startup
setTimeout(recoverInterruptedJobs, 5000); // Wait 5 seconds after startup

async function processQueue() {
	// Don't start new jobs if we're at capacity
	if (activeJobs.size >= MAX_CONCURRENT_JOBS) {
		return;
	}

	// Process jobs from the queue with fair scheduling
	while (jobQueue.length > 0 && activeJobs.size < MAX_CONCURRENT_JOBS) {
		// Get active users to implement fair scheduling
		const activeUsers = new Set(Array.from(activeJobs.values()).map(jobInfo => jobInfo.job.user));
		
		// Find the next job from a user who doesn't have an active job (fair scheduling)
		let jobIndex = -1;
		for (let i = 0; i < jobQueue.length; i++) {
			if (!activeUsers.has(jobQueue[i].user)) {
				jobIndex = i;
				break;
			}
		}
		
		// If no fair job found, take the first one
		if (jobIndex === -1) {
			jobIndex = 0;
		}
		
		const job = jobQueue.splice(jobIndex, 1)[0];
		if (!job) break;

		// Start processing this job
		processJob(job);
	}

	saveQueue();
}

async function processJob(job) {
	// Initialize or get job state
	let jobState = jobStates.get(job.id) || {
		retryCount: 0,
		lastError: null,
		checkpoint: null,
		startTime: Date.now()
	};

	// Mark job as active
	activeJobs.set(job.id, {
		job,
		startTime: Date.now(),
		status: 'processing',
		retryCount: jobState.retryCount
	});

	broadcastLog('info', 'job', `Job ${job.id} started processing`, `Type: ${job.type}, User: ${job.user}, Active jobs: ${activeJobs.size}, Retry: ${jobState.retryCount}`);

	try {
		logger.log(job.user, { event: 'job_start', jobId: job.id, type: job.type, retryCount: jobState.retryCount });
		emitProgress(job.id, { status: 'started', step: 'init', retryCount: jobState.retryCount });

		// Process the job based on type
		if (job.type === 'tts') {
			await processTTSJob(job, jobState);
		} else if (job.type === 'bible-tts') {
			await handleBibleTtsJob(job, jobState);
		} else if (job.type === 'bible-video') {
			await handleBibleVideoJob(job, jobState);
		} else {
			await new Promise(r => setTimeout(r, 500));
			emitProgress(job.id, { status: 'progress', step: 'processing', progress: 50 });
			await new Promise(r => setTimeout(r, 700));
			const outPath = path.join(OUTPUTS_DIR, `${job.id}.txt`);
			fs.writeFileSync(outPath, `Job ${job.id} placeholder output`);
			emitProgress(job.id, { status: 'completed', output: `/outputs/${job.id}.txt` });
		}

		// Job completed successfully
		logger.log(job.user, { event: 'job_complete', jobId: job.id });
		broadcastLog('success', 'job', `Job ${job.id} completed successfully`, `Duration: ${Math.round((Date.now() - activeJobs.get(job.id).startTime) / 1000)}s, Retries: ${jobState.retryCount}`);
		
		// Clean up job state
		jobStates.delete(job.id);

	} catch (err) {
		console.error(`[Job ${job.id}] Error:`, err);
		
		// Update job state
		jobState.lastError = err.message;
		jobState.retryCount++;
		jobStates.set(job.id, jobState);

		broadcastLog('error', 'job', `Job ${job.id} failed`, `Error: ${err.message}, Duration: ${Math.round((Date.now() - activeJobs.get(job.id).startTime) / 1000)}s, Retry: ${jobState.retryCount}/${MAX_RETRY_ATTEMPTS}`);
		emitProgress(job.id, { status: 'error', message: String(err), retryCount: jobState.retryCount });
		logger.log(job.user, { event: 'job_error', jobId: job.id, error: String(err), retryCount: jobState.retryCount });

		// Handle retry logic
		if (isRecoverableError(err) && jobState.retryCount < MAX_RETRY_ATTEMPTS) {
			const retryDelay = RETRY_DELAY_BASE * Math.pow(RETRY_DELAY_MULTIPLIER, jobState.retryCount - 1);
			broadcastLog('warning', 'job', `Job ${job.id} will retry in ${Math.round(retryDelay / 1000)}s`, `Attempt ${jobState.retryCount}/${MAX_RETRY_ATTEMPTS}, Error: ${err.message}`);
			
			// Re-queue the job for retry
			setTimeout(() => {
				jobQueue.unshift(job); // Add to front of queue for priority
				saveQueue();
				processQueue();
			}, retryDelay);
		} else {
			// Job failed permanently
			broadcastLog('error', 'job', `Job ${job.id} failed permanently`, `Max retries reached (${MAX_RETRY_ATTEMPTS}) or non-recoverable error`);
			jobStates.delete(job.id); // Clean up failed job state
		}
	} finally {
		// Remove from active jobs
		activeJobs.delete(job.id);
		
		// Try to process more jobs
		setTimeout(() => processQueue(), 100);
	}
}

function isRecoverableError(error) {
	// Define which errors are recoverable (network issues, temporary API failures, etc.)
	const recoverablePatterns = [
		/network/i,
		/timeout/i,
		/connection/i,
		/rate limit/i,
		/temporary/i,
		/503/i,
		/502/i,
		/504/i
	];
	
	return recoverablePatterns.some(pattern => pattern.test(error.message));
}

app.get('/api/queue/status', (_req, res) => {
	const activeJobDetails = Array.from(activeJobs.values()).map(jobInfo => ({
		id: jobInfo.job.id,
		type: jobInfo.job.type,
		user: jobInfo.job.user,
		startTime: jobInfo.startTime,
		duration: Math.round((Date.now() - jobInfo.startTime) / 1000),
		status: jobInfo.status
	}));

	res.json({ 
		pending: jobQueue.length, 
		processing: activeJobs.size,
		maxConcurrent: MAX_CONCURRENT_JOBS,
		activeJobs: activeJobDetails
	});
});

async function processTTSJob(job, jobState = {}) {
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
		const { text, voiceModelId, format = 'mp3', sentencesPerChunk = 3, bibleReference = null } = job.payload || job.data || {};
		const chunks = groupSentences(splitIntoSentences(text), sentencesPerChunk);
		
		// Check for checkpoint to resume from
		const startChunk = jobState.checkpoint?.chunkIndex || 0;
		
		broadcastLog('info', 'audio', `Starting TTS processing`, `Job: ${job.id}, Chunks: ${chunks.length}, Voice: ${voiceModelId}, Resume from: ${startChunk}`);
		emitProgress(job.id, { status: 'progress', step: 'tts', chunk: startChunk, total: chunks.length });
		
		for (let i = startChunk; i < chunks.length; i++) {
			// Update checkpoint
			jobState.checkpoint = { chunkIndex: i, totalChunks: chunks.length };
			jobStates.set(job.id, jobState);
			
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
			voiceModelId: (job.payload || job.data || {}).voiceModelId,
			bibleReference
		});
		
		broadcastLog('success', 'audio', `Audio creation completed`, `Job: ${job.id}, File: ${path.basename(stitched)}`);
		
		// Clean up any remaining segment files that might not have been cleaned up
		await cleanupSegmentFiles(segmentFiles);
		
		// Check if video creation is requested
		const jobData = job.payload || job.data || {};
		if (jobData.createVideo && jobData.videoSettings) {
			broadcastLog('info', 'video', `Starting video creation`, `Job: ${job.id}, Audio: ${path.basename(stitched)}`);
			emitProgress(job.id, { status: 'progress', step: 'video', message: 'Creating video with audio...' });
			
			try {
				const videoOutput = await createVideoFromAudio(stitched, jobData.videoSettings, job.id);
				broadcastLog('success', 'video', `Video creation completed`, `Job: ${job.id}, File: ${path.basename(videoOutput)}`);
				emitProgress(job.id, { status: 'completed', output: videoOutput.replace(OUTPUTS_DIR, '/outputs') });
			} catch (videoError) {
				broadcastLog('error', 'video', `Video creation failed`, `Job: ${job.id}, Error: ${videoError.message}`);
				// Still return the audio file even if video creation failed
				emitProgress(job.id, { status: 'completed', output: stitched.replace(OUTPUTS_DIR, '/outputs'), warning: 'Video creation failed, audio file available' });
			}
		} else {
			emitProgress(job.id, { status: 'completed', output: stitched.replace(OUTPUTS_DIR, '/outputs') });
		}
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
		console.log(`[TTS Job] Cleaning up ${segmentFiles.length} segment files`);
		broadcastLog('info', 'cleanup', `Starting cleanup of ${segmentFiles.length} segment files`);
		
		let deletedCount = 0;
		let failedCount = 0;
		
		for (const file of segmentFiles) {
			try {
				if (fs.existsSync(file)) {
					fs.unlinkSync(file);
					deletedCount++;
					console.log(`[TTS Job] Deleted segment file: ${path.basename(file)}`);
					broadcastLog('debug', 'cleanup', `Deleted segment file: ${path.basename(file)}`);
				} else {
					console.log(`[TTS Job] Segment file already deleted: ${path.basename(file)}`);
				}
			} catch (deleteError) {
				failedCount++;
				console.warn(`[TTS Job] Failed to delete segment file ${file}:`, deleteError.message);
				broadcastLog('warning', 'cleanup', `Failed to delete segment file: ${path.basename(file)}`, deleteError.message);
			}
		}
		
		// Verify cleanup
		const remainingFiles = segmentFiles.filter(file => fs.existsSync(file));
		if (remainingFiles.length > 0) {
			broadcastLog('warning', 'cleanup', `${remainingFiles.length} segment files still exist after cleanup`, remainingFiles.map(f => path.basename(f)).join(', '));
		}
		
		console.log(`[TTS Job] Segment cleanup completed - Deleted: ${deletedCount}, Failed: ${failedCount}, Remaining: ${remainingFiles.length}`);
		broadcastLog('success', 'cleanup', `Segment cleanup completed`, `Deleted: ${deletedCount}, Failed: ${failedCount}, Remaining: ${remainingFiles.length}`);
		
		return { deletedCount, failedCount, remainingCount: remainingFiles.length };
	} catch (error) {
		console.error(`[TTS Job] Error during segment cleanup:`, error);
		broadcastLog('error', 'cleanup', 'Error during segment cleanup', error.message);
		// Don't throw error for cleanup failures
		return { deletedCount: 0, failedCount: segmentFiles.length, remainingCount: segmentFiles.length };
	}
}

async function createVideoFromAudio(audioFile, videoSettings, jobId) {
	// Extract book name and chapter number from the job data if available
	const job = activeJobs.get(jobId);
	let bookName = null;
	let chapterNumber = null;
	
	if (job && job.job) {
		const jobData = job.job.payload || job.job.data || {};
		bookName = jobData.book || jobData.bibleReference?.split('-')[0];
		chapterNumber = jobData.chapter || jobData.bibleReference?.split('-')[1];
	}
	
	// Add book name and chapter number to video settings
	const enhancedVideoSettings = {
		...videoSettings,
		bookName,
		chapterNumber
	};
	
	return await videoGenerator.createVideo(audioFile, enhancedVideoSettings, jobId, broadcastLog);
}



async function handleBibleTtsJob(job, jobState = {}) {
	const { translation, book, chapter, verseRanges, excludeNumbers, excludeFootnotes, voiceModelId, format = 'mp3', sentencesPerChunk = 3, type = 'chapter', chapters = '' } = job.payload || job.data || {};
	
	// Validate required parameters
	if (!book) {
		throw new Error('Book parameter is required for Bible transcription');
	}
	
	broadcastLog('info', 'audio', `Starting Bible TTS job`, `Job: ${job.id}, Book: ${book}, Type: ${type}, Voice: ${voiceModelId}`);
	
	let allText = '';
	let bibleReference = '';
	
			if (type === 'book') {
		// Handle entire book - create separate files for each chapter
		const maxChapters = getMaxChapters(book);
		broadcastLog('info', 'audio', `Processing entire book: ${book}`, `Job: ${job.id}, Chapters: 1-${maxChapters}`);
		
		// Process each chapter separately
		for (let ch = 1; ch <= maxChapters; ch++) {
			const chapterValidation = validateChapter(book, ch);
			if (!chapterValidation.valid) {
				continue; // Skip invalid chapters
			}
			
			broadcastLog('debug', 'audio', `Processing chapter ${ch}`, `Job: ${job.id}, Book: ${book}`);
			const rawText = await fetchBibleText({ translation, book, chapter: ch });
			const cleanedText = cleanupBibleText(rawText, { excludeNumbers, excludeFootnotes });
			const chapterText = `${book}, Chapter ${ch}.\n${cleanedText}`;
			
			// Create separate job for each chapter
			const chapterJobId = uuidv4();
			const chapterJob = {
				id: chapterJobId,
				type: 'tts',
				user: job.user,
				data: {
					text: chapterText,
					voiceModelId,
					format,
					sentencesPerChunk,
					bibleReference: `${book}-${ch}`,
					createVideo: job.payload?.createVideo || false,
					videoSettings: job.payload?.videoSettings || null
				}
			};
			
			// Add chapter job to queue
			jobQueue.push(chapterJob);
			broadcastLog('info', 'audio', `Queued chapter ${ch}`, `Job: ${chapterJobId}, Book: ${book}`);
		}
		
		// Save queue and start processing
		saveQueue();
		processQueue();
		
		// Mark original job as completed since we've queued individual chapters
		emitProgress(job.id, { status: 'completed', message: `Queued ${maxChapters} chapters for processing` });
		return;
	} else if (type === 'chapters' && chapters) {
		// Handle multiple chapters - create separate files for each chapter
		const chapterRanges = chapters.split(',').map(range => range.trim());
		broadcastLog('info', 'audio', `Processing multiple chapters: ${chapters}`, `Job: ${job.id}, Book: ${book}`);
		
		let chapterCount = 0;
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
						
						broadcastLog('debug', 'audio', `Processing chapter ${ch}`, `Job: ${job.id}, Book: ${book}`);
						const rawText = await fetchBibleText({ translation, book, chapter: ch });
						const cleanedText = cleanupBibleText(rawText, { excludeNumbers, excludeFootnotes });
						const chapterText = `${book}, Chapter ${ch}.\n${cleanedText}`;
						
									// Create separate TTS job for each chapter
			const chapterJobId = uuidv4();
			const chapterJob = {
				id: chapterJobId,
				type: 'tts',
				user: job.user,
				payload: {
					text: chapterText,
					voiceModelId,
					format,
					sentencesPerChunk,
					bibleReference: `${book}-${ch}`,
					createVideo: job.payload?.createVideo || false,
					videoSettings: job.payload?.videoSettings || null
				}
			};
						
						// Add chapter job to queue
						jobQueue.push(chapterJob);
						chapterCount++;
						broadcastLog('info', 'audio', `Queued chapter ${ch}`, `Job: ${chapterJobId}, Book: ${book}`);
					}
				}
			} else {
				const ch = parseInt(range);
									if (!isNaN(ch)) {
						const chapterValidation = validateChapter(book, ch);
						if (chapterValidation.valid) {
							broadcastLog('debug', 'audio', `Processing chapter ${ch}`, `Job: ${job.id}, Book: ${book}`);
							const rawText = await fetchBibleText({ translation, book, chapter: ch });
							const cleanedText = cleanupBibleText(rawText, { excludeNumbers, excludeFootnotes });
							const chapterText = `${book}, Chapter ${ch}.\n${cleanedText}`;
							
							// Create separate job for each chapter
							const chapterJobId = uuidv4();
							const chapterJob = {
								id: chapterJobId,
								type: 'tts',
								user: job.user,
								data: {
									text: chapterText,
									voiceModelId,
									format,
									sentencesPerChunk,
									bibleReference: `${book}-${ch}`,
									createVideo: job.payload?.createVideo || false,
									videoSettings: job.payload?.videoSettings || null
								}
							};
						
						// Add chapter job to queue
						jobQueue.push(chapterJob);
						chapterCount++;
						broadcastLog('info', 'audio', `Queued chapter ${ch}`, `Job: ${chapterJobId}, Book: ${book}`);
					}
				}
			}
		}
		
		// Save queue and start processing
		saveQueue();
		processQueue();
		
		// Mark original job as completed since we've queued individual chapters
		emitProgress(job.id, { status: 'completed', message: `Queued ${chapterCount} chapters for processing` });
		return;
	} else {
		// Handle single chapter (original logic)
		const verses = parseVerseRanges(String(verseRanges || ''));
		const raw = await fetchBibleText({ translation, book, chapter, verses });
		const cleanedText = cleanupBibleText(raw, { excludeNumbers, excludeFootnotes });
		// Add book name and chapter number at the beginning
		allText = `${book}, Chapter ${chapter}.\n${cleanedText}`;
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

async function handleBibleVideoJob(job, jobState = {}) {
	const { translation, book, chapter, verseRanges, excludeNumbers, excludeFootnotes, voiceModelId, format = 'mp3', sentencesPerChunk = 3, type = 'chapter', chapters = '', videoSettings } = job.payload || job.data || {};
	
	// Validate required parameters
	if (!book) {
		throw new Error('Book parameter is required for Bible video creation');
	}
	
	broadcastLog('info', 'video', `Starting Bible video job`, `Job: ${job.id}, Book: ${book}, Type: ${type}, Voice: ${voiceModelId}`);
	
	// For video jobs, we'll use the same per-chapter logic as audio jobs
	// This ensures each chapter gets its own video file
	if (type === 'book') {
		// Handle entire book - create separate video files for each chapter
		const maxChapters = getMaxChapters(book);
		broadcastLog('info', 'video', `Processing entire book: ${book}`, `Job: ${job.id}, Chapters: 1-${maxChapters}`);
		
		// Process each chapter separately
		for (let ch = 1; ch <= maxChapters; ch++) {
			const chapterValidation = validateChapter(book, ch);
			if (!chapterValidation.valid) {
				continue; // Skip invalid chapters
			}
			
			broadcastLog('debug', 'video', `Processing chapter ${ch}`, `Job: ${job.id}, Book: ${book}`);
			const rawText = await fetchBibleText({ translation, book, chapter: ch });
			const cleanedText = cleanupBibleText(rawText, { excludeNumbers, excludeFootnotes });
			const chapterText = `${book}, Chapter ${ch}.\n${cleanedText}`;
			
			// Create separate TTS job for each chapter with video creation
			const chapterJobId = uuidv4();
			const chapterJob = {
				id: chapterJobId,
				type: 'tts',
				user: job.user,
				data: {
					text: chapterText,
					voiceModelId,
					format,
					sentencesPerChunk,
					bibleReference: `${book}-${ch}`,
					createVideo: true,
					videoSettings
				}
			};
			
			// Add chapter job to queue
			jobQueue.push(chapterJob);
			broadcastLog('info', 'video', `Queued video chapter ${ch}`, `Job: ${chapterJobId}, Book: ${book}`);
		}
		
		// Save queue and start processing
		saveQueue();
		processQueue();
		
		// Mark original job as completed since we've queued individual chapters
		emitProgress(job.id, { status: 'completed', message: `Queued ${maxChapters} video chapters for processing` });
		return;
	} else if (type === 'chapters' && chapters) {
		// Handle multiple chapters - create separate video files for each chapter
		const chapterRanges = chapters.split(',').map(range => range.trim());
		broadcastLog('info', 'video', `Processing multiple chapters: ${chapters}`, `Job: ${job.id}, Book: ${book}`);
		
		let chapterCount = 0;
		for (const range of chapterRanges) {
			if (range.includes('-')) {
				const [start, end] = range.split('-').map(n => parseInt(n.trim()));
				if (!isNaN(start) && !isNaN(end)) {
					broadcastLog('debug', 'video', `Processing chapter range ${start}-${end}`, `Job: ${job.id}, Book: ${book}`);
					for (let ch = start; ch <= end; ch++) {
						const chapterValidation = validateChapter(book, ch);
						if (!chapterValidation.valid) {
							continue;
						}
						
						broadcastLog('debug', 'video', `Processing chapter ${ch}`, `Job: ${job.id}, Book: ${book}`);
						const rawText = await fetchBibleText({ translation, book, chapter: ch });
						const cleanedText = cleanupBibleText(rawText, { excludeNumbers, excludeFootnotes });
						const chapterText = `${book}, Chapter ${ch}.\n${cleanedText}`;
						
						// Create separate video job for each chapter
						const chapterJobId = uuidv4();
						const chapterJob = {
							id: chapterJobId,
							type: 'bible-video',
							user: job.user,
							payload: {
								book: book,
								chapter: ch,
								translation,
								excludeNumbers,
								excludeFootnotes,
								voiceModelId,
								format,
								sentencesPerChunk,
								bibleReference: `${book}-${ch}`,
								createVideo: true,
								videoSettings
							}
						};
						
						// Add chapter job to queue
						jobQueue.push(chapterJob);
						chapterCount++;
						broadcastLog('info', 'video', `Queued video chapter ${ch}`, `Job: ${chapterJobId}, Book: ${book}`);
					}
				}
			} else {
				const ch = parseInt(range);
				if (!isNaN(ch)) {
					const chapterValidation = validateChapter(book, ch);
					if (chapterValidation.valid) {
						broadcastLog('debug', 'video', `Processing chapter ${ch}`, `Job: ${job.id}, Book: ${book}`);
						const rawText = await fetchBibleText({ translation, book, chapter: ch });
						const cleanedText = cleanupBibleText(rawText, { excludeNumbers, excludeFootnotes });
						const chapterText = `${book}, Chapter ${ch}.\n${cleanedText}`;
						
						// Create separate video job for each chapter
						const chapterJobId = uuidv4();
						const chapterJob = {
							id: chapterJobId,
							type: 'bible-video',
							user: job.user,
							payload: {
								book: book,
								chapter: ch,
								translation,
								excludeNumbers,
								excludeFootnotes,
								voiceModelId,
								format,
								sentencesPerChunk,
								bibleReference: `${book}-${ch}`,
								createVideo: true,
								videoSettings
							}
						};
						
						// Add chapter job to queue
						jobQueue.push(chapterJob);
						chapterCount++;
						broadcastLog('info', 'video', `Queued video chapter ${ch}`, `Job: ${chapterJobId}, Book: ${book}`);
					}
				}
			}
		}
		
		// Save queue and start processing
		saveQueue();
		processQueue();
		
		// Mark original job as completed since we've queued individual chapters
		emitProgress(job.id, { status: 'completed', message: `Queued ${chapterCount} video chapters for processing` });
		return;
	} else {
		// Handle single chapter (original logic)
		const verses = parseVerseRanges(String(verseRanges || ''));
		const raw = await fetchBibleText({ translation, book, chapter, verses });
		const cleanedText = cleanupBibleText(raw, { excludeNumbers, excludeFootnotes });
		// Add book name and chapter number at the beginning
		const allText = `${book}, Chapter ${chapter}.\n${cleanedText}`;
		const bibleReference = `${book}-${chapter}-${verses.join('-')}`;
		
		// Create audio first
		broadcastLog('info', 'video', `Creating audio for video`, `Job: ${job.id}, Text length: ${allText.length}`);
		emitProgress(job.id, { status: 'progress', step: 'audio', message: 'Creating audio track...' });
		
		await processTTSJob({ 
			id: job.id, 
			user: job.user, 
			data: { 
				text: allText, 
				voiceModelId, 
				format, 
				sentencesPerChunk,
				bibleReference,
				createVideo: true,
				videoSettings
			} 
		});
	}
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
		chapters: req.body?.chapters || '',
		createVideo: Boolean(req.body?.createVideo || false),
		videoSettings: req.body?.videoSettings || null
	};
	
	// Determine job type based on whether video is requested
	const jobType = payload.createVideo ? 'bible-video' : 'bible-tts';
	const job = { id, type: jobType, user, createdAt: Date.now(), payload };
	
	jobQueue.push(job);
	saveQueue();
	processQueue();
	res.json({ id });
});

// Logs streaming endpoint
app.get('/api/logs/stream', (req, res) => {
	// Check if user is authenticated
	if (!req.user) {
		res.writeHead(401, {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive'
		});
		res.write(`data: ${JSON.stringify({
			timestamp: new Date().toISOString(),
			level: 'error',
			category: 'system',
			message: 'Authentication required for logs access'
		})}\n\n`);
		res.end();
		return;
	}

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

// Logs API endpoints
app.get('/api/logs', (req, res) => {
	try {
		// Check if user is authenticated
		if (!req.user) {
			return res.status(401).json({ error: 'Authentication required' });
		}

		// Return recent logs from memory
		const recentLogs = Array.from(logBuffer).slice(-100); // Last 100 logs
		res.json(recentLogs);
	} catch (error) {
		console.error('[API] Error fetching logs:', error);
		res.status(500).json({ error: error.message });
	}
});

app.delete('/api/logs', (req, res) => {
	try {
		// Check if user is authenticated
		if (!req.user) {
			return res.status(401).json({ error: 'Authentication required' });
		}

		// Clear log buffer
		logBuffer.clear();
		res.json({ success: true, message: 'Logs cleared' });
	} catch (error) {
		console.error('[API] Error clearing logs:', error);
		res.status(500).json({ error: error.message });
	}
});

app.get('/api/logs/download', (req, res) => {
	try {
		// Check if user is authenticated
		if (!req.user) {
			return res.status(401).json({ error: 'Authentication required' });
		}

		// Create log data
		const logs = Array.from(logBuffer);
		const logData = JSON.stringify(logs, null, 2);
		
		// Set headers for download
		res.setHeader('Content-Type', 'application/json');
		res.setHeader('Content-Disposition', `attachment; filename="dScribe-logs-${new Date().toISOString().split('T')[0]}.json"`);
		res.send(logData);
	} catch (error) {
		console.error('[API] Error downloading logs:', error);
		res.status(500).json({ error: error.message });
	}
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

// File upload for video backgrounds
app.post('/api/upload/background', (req, res) => {
	console.log('[Upload] Background upload request received');
	console.log('[Upload] Headers:', req.headers);
	console.log('[Upload] Body keys:', Object.keys(req.body || {}));
	
	const user = req.user; // from auth middleware
	console.log('[Upload] User:', user);
	
	if (!user) {
		console.log('[Upload] No user found, returning 401');
		return res.status(401).json({ error: 'Authentication required' });
	}
	
	// Ensure uploads directory exists
	const uploadsDir = path.join(STORAGE_DIR, 'uploads');
	if (!fs.existsSync(uploadsDir)) {
		fs.mkdirSync(uploadsDir, { recursive: true });
	}
	
	// Handle file upload using multer or similar
	// For now, we'll use a simple approach with base64 encoding
	const { file, filename, fileType } = req.body || {};
	
	if (!file || !filename) {
		console.log('[Upload] Missing file data');
		return res.status(400).json({ error: 'Missing file data' });
	}
	
	try {
		// Decode base64 file data
		const fileData = Buffer.from(file, 'base64');
		const filePath = path.join(uploadsDir, filename);
		
		// Write file
		fs.writeFileSync(filePath, fileData);
		
		console.log('[Upload] File saved successfully:', filename);
		broadcastLog('info', 'upload', `Background file uploaded`, `User: ${user}, File: ${filename}`);
		
		res.json({ success: true, filename });
	} catch (error) {
		console.log('[Upload] Error saving file:', error.message);
		broadcastLog('error', 'upload', `Upload failed`, `User: ${user}, File: ${filename}, Error: ${error.message}`);
		res.status(500).json({ error: error.message });
	}
});



// Cancel current user's job endpoint
app.post('/api/jobs/cancel-current', (req, res) => {
	const user = req.user; // from auth middleware
	
	// Find the user's active job
	let userJob = null;
	for (const [jobId, jobInfo] of activeJobs.entries()) {
		if (jobInfo.job.user === user) {
			userJob = { jobId, jobInfo };
			break;
		}
	}
	
	if (!userJob) {
		return res.status(404).json({ error: 'No active job found for current user' });
	}
	
	// Cancel the job
	activeJobs.delete(userJob.jobId);
	broadcastLog('info', 'job', `Job ${userJob.jobId} cancelled by user`, `User: ${user}`);
	
	// Emit cancellation progress
	emitProgress(userJob.jobId, { 
		status: 'cancelled', 
		message: 'Job cancelled by user' 
	});
	
	logger.log(user, { event: 'job_cancelled', jobId: userJob.jobId });
	
	res.json({ success: true, message: 'Current job cancelled successfully' });
});

// Clear all job states endpoint
app.post('/api/jobs/clear-all', (req, res) => {
	try {
		// Clear all job states
		jobStates.clear();
		
		// Clear all active jobs
		activeJobs.clear();
		
		// Clear job queue
		jobQueue.splice(0, jobQueue.length);
		
		// Save empty state
		saveQueue();
		
		broadcastLog('info', 'system', 'All jobs and job states cleared manually');
		
		res.json({ success: true, message: 'All jobs and job states cleared successfully' });
	} catch (error) {
		console.error('Error clearing jobs:', error);
		res.status(500).json({ error: 'Failed to clear jobs' });
	}
});

// Job recovery and management endpoints
app.post('/api/jobs/recover', (req, res) => {
	const { jobId } = req.body || {};
	const user = req.user; // from auth middleware
	
	if (!jobId) {
		return res.status(400).json({ error: 'Job ID required' });
	}
	
	// Check if job state exists
	const jobState = jobStates.get(jobId);
	if (!jobState) {
		return res.status(404).json({ error: 'Job state not found' });
	}
	
	// Check if job belongs to user
	const job = jobQueue.find(j => j.id === jobId) || Array.from(activeJobs.values()).find(jobInfo => jobInfo.job.id === jobId)?.job;
	if (!job || job.user !== user) {
		return res.status(403).json({ error: 'Cannot recover another user\'s job' });
	}
	
	// Reset retry count and re-queue
	jobState.retryCount = 0;
	jobState.lastError = null;
	jobStates.set(jobId, jobState);
	
	// Add to front of queue for priority
	if (!jobQueue.find(j => j.id === jobId)) {
		jobQueue.unshift(job);
	}
	
	saveQueue();
	broadcastLog('info', 'job', `Job ${jobId} manually recovered by user`, `User: ${user}, Retry count reset`);
	
	res.json({ success: true, message: 'Job recovered and queued for retry' });
});

app.get('/api/jobs/state/:jobId', (req, res) => {
	const { jobId } = req.params;
	const user = req.user; // from auth middleware
	
	const jobState = jobStates.get(jobId);
	if (!jobState) {
		return res.status(404).json({ error: 'Job state not found' });
	}
	
	// Check if job belongs to user
	const job = jobQueue.find(j => j.id === jobId) || Array.from(activeJobs.values()).find(jobInfo => jobInfo.job.id === jobId)?.job;
	if (!job || job.user !== user) {
		return res.status(403).json({ error: 'Cannot access another user\'s job state' });
	}
	
	res.json({
		jobId,
		retryCount: jobState.retryCount,
		lastError: jobState.lastError,
		checkpoint: jobState.checkpoint,
		startTime: jobState.startTime
	});
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

// Debug API endpoints
app.get('/api/debug/sessions', (req, res) => {
	try {
		const sessions = videoDebugger.getDebugSessions();
		res.json(sessions);
	} catch (error) {
		console.error('[API] Error fetching debug sessions:', error);
		res.status(500).json({ error: error.message });
	}
});

app.get('/api/debug/session/:sessionId', (req, res) => {
	try {
		const { sessionId } = req.params;
		const sessions = videoDebugger.getDebugSessions();
		const session = sessions.find(s => s.id === sessionId);
		
		if (!session) {
			return res.status(404).json({ error: 'Session not found' });
		}
		
		const report = videoDebugger.generateDebugReport(session);
		res.json(report);
	} catch (error) {
		console.error('[API] Error fetching session details:', error);
		res.status(500).json({ error: error.message });
	}
});

app.post('/api/debug/cleanup', (req, res) => {
	try {
		videoDebugger.cleanupOldSessions();
		res.json({ success: true, message: 'Old debug sessions cleaned up' });
	} catch (error) {
		console.error('[API] Error cleaning up debug sessions:', error);
		res.status(500).json({ error: error.message });
	}
});

// User management endpoints
app.get('/api/users', (req, res) => {
	try {
		const allowedUsers = config.allowedUsers || [];
		res.json(allowedUsers);
	} catch (error) {
		console.error('[API] Error fetching users:', error);
		res.status(500).json({ error: error.message });
	}
});

app.post('/api/users', (req, res) => {
	try {
		const { username } = req.body;
		
		if (!username || typeof username !== 'string' || username.trim().length === 0) {
			return res.status(400).json({ error: 'Username is required and must be a non-empty string' });
		}
		
		const normalizedUsername = username.trim();
		const allowedUsers = config.allowedUsers || [];
		
		// Check if user already exists (case-insensitive)
		const existingUser = allowedUsers.find(user => user.toLowerCase() === normalizedUsername.toLowerCase());
		if (existingUser) {
			return res.status(409).json({ error: 'User already exists' });
		}
		
		// Add new user
		allowedUsers.push(normalizedUsername);
		config = saveConfig(ROOT, { ...config, allowedUsers });
		
		broadcastLog('info', 'system', `User added: ${normalizedUsername}`);
		res.json({ success: true, message: 'User added successfully' });
	} catch (error) {
		console.error('[API] Error adding user:', error);
		res.status(500).json({ error: error.message });
	}
});

app.delete('/api/users/:username', (req, res) => {
	try {
		const { username } = req.params;
		const allowedUsers = config.allowedUsers || [];
		
		// Find user (case-insensitive)
		const userIndex = allowedUsers.findIndex(user => user.toLowerCase() === username.toLowerCase());
		
		if (userIndex === -1) {
			return res.status(404).json({ error: 'User not found' });
		}
		
		// Remove user
		const removedUser = allowedUsers.splice(userIndex, 1)[0];
		config = saveConfig(ROOT, { ...config, allowedUsers });
		
		broadcastLog('info', 'system', `User deleted: ${removedUser}`);
		res.json({ success: true, message: 'User deleted successfully' });
	} catch (error) {
		console.error('[API] Error deleting user:', error);
		res.status(500).json({ error: error.message });
	}
});

process.on('SIGINT', () => { saveQueue(); process.exit(0); });
process.on('SIGTERM', () => { saveQueue(); process.exit(0); });

app.listen(PORT, () => {
	console.log(`Server listening on http://localhost:${PORT}`);
	broadcastLog('info', 'system', `Server started`, `Port: ${PORT}, Environment: ${process.env.NODE_ENV || 'development'}`);
	
	// Start the stuck job checker after server is running
	setInterval(checkForStuckJobs, RECOVERY_CHECK_INTERVAL);
});


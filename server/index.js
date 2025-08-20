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
import { fetchBibleText, cleanupBibleText } from './bible/dummyProvider.js';
import { splitIntoSentences, groupSentences } from './text/segment.js';
import { synthesizeChunkToFile, stitchSegments } from './tts/dummyTts.js';
import { loadPreferences, savePreferences } from './memory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

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
logger.prune();
setInterval(() => logger.prune(), 24 * 60 * 60 * 1000);

// Static assets
app.use('/', express.static(PUBLIC_DIR));

// Basic health
app.get('/api/health', (_req, res) => {
	res.json({ ok: true, uptime: process.uptime() });
});

// Public config meta (no secrets)
app.get('/api/config/meta', (_req, res) => {
	res.json({
		allowedUsers: config.allowedUsers || ['Inggo', 'Gelo', 'JM'],
		voiceModels: (config.voiceModels || []).map(v => ({ id: v.id, name: v.name })),
	});
});

// Voice models management (no API key exposure)
app.get('/api/models', (_req, res) => {
	res.json({ voiceModels: (config.voiceModels || []).map(v => ({ id: v.id, name: v.name })) });
});
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

// Bible fetch (dummy provider)
app.post('/api/bible/fetch', async (req, res) => {
	try {
		const { translation = 'WEB', book = 'John', chapter = 1, verseRanges = '', excludeNumbers = true, excludeFootnotes = true } = req.body || {};
		const verses = parseVerseRanges(String(verseRanges || ''));
		const raw = await fetchBibleText({ translation, book, chapter, verses });
		const cleaned = cleanupBibleText(raw, { excludeNumbers, excludeFootnotes });
		res.json({ text: cleaned });
	} catch (e) {
		res.status(500).json({ error: String(e) });
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
				await handleTtsJob(job);
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

async function handleTtsJob(job) {
	const { text, voiceModelId, format = 'mp3', sentencesPerChunk = 3 } = job.payload;
	const sentences = splitIntoSentences(text);
	const chunks = groupSentences(sentences, sentencesPerChunk);
	const segmentFiles = [];
	for (let i = 0; i < chunks.length; i++) {
		emitProgress(job.id, { status: 'progress', step: 'tts', chunk: i + 1, total: chunks.length });
		const file = await synthesizeChunkToFile({ chunkText: chunks[i], voiceModelId, format, outputsDir: OUTPUTS_DIR, jobId: job.id, index: i });
		segmentFiles.push(file);
	}
	const stitched = await stitchSegments({ segmentFiles, outputsDir: OUTPUTS_DIR, jobId: job.id, format });
	emitProgress(job.id, { status: 'completed', output: stitched.replace(OUTPUTS_DIR, '/outputs') });
}

async function handleBibleTtsJob(job) {
	const { translation, book, chapter, verseRanges, excludeNumbers, excludeFootnotes, voiceModelId, format = 'mp3', sentencesPerChunk = 3 } = job.payload;
	const verses = parseVerseRanges(String(verseRanges || ''));
	const raw = await fetchBibleText({ translation, book, chapter, verses });
	const text = cleanupBibleText(raw, { excludeNumbers, excludeFootnotes });
	await handleTtsJob({ id: job.id, payload: { text, voiceModelId, format, sentencesPerChunk } });
}

// Start TTS job
app.post('/api/jobs/tts', (req, res) => {
	const id = uuidv4();
	const user = req.body?.user || 'Unknown';
	const payload = {
		text: String(req.body?.text || ''),
		voiceModelId: req.body?.voiceModelId || (config.voiceModels?.[0]?.id || 'default'),
		format: req.body?.format || 'mp3',
		sentencesPerChunk: Number(req.body?.sentencesPerChunk || 3)
	};
	const job = { id, type: 'tts', user, createdAt: Date.now(), payload };
	jobQueue.push(job);
	saveQueue();
	processQueue();
	res.json({ id });
});

// Start Bible TTS job
app.post('/api/jobs/bible', (req, res) => {
	const id = uuidv4();
	const user = req.body?.user || 'Unknown';
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

process.on('SIGINT', () => { saveQueue(); process.exit(0); });
process.on('SIGTERM', () => { saveQueue(); process.exit(0); });

app.listen(PORT, () => {
	console.log(`Server listening on http://localhost:${PORT}`);
});

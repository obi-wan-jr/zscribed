import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import compression from 'compression';
import { loadConfig } from './config.js';
import { parseVerseRanges } from './bible/verseRange.js';
import { fetchBibleText, cleanupBibleText, AVAILABLE_TRANSLATIONS, testLocalBibleConnection, BIBLE_BOOKS, validateChapter, validateVerseRanges } from './bible/localBibleProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3005;

// Enable compression for all responses
app.use(compression());

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Use a more efficient logging format for production
const logFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(logFormat));

// Generate cache buster based on deployment time and version
let CACHE_BUSTER = process.env.CACHE_BUSTER || Date.now().toString();
let APP_VERSION = process.env.APP_VERSION || '1.0.0';

// Cache busting middleware
app.use((req, res, next) => {
	// Add cache buster to response headers for static assets
	if (req.path.match(/\.(js|css|html)$/)) {
		res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
		res.set('Pragma', 'no-cache');
		res.set('Expires', '0');
	}
	next();
});

// Simplified request processing
app.use((req, res, next) => {
	// Get client IP for logging
	req.clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection.remoteAddress || req.socket.remoteAddress || req.ip || 'unknown';
	next();
});

const ROOT = path.resolve(__dirname, '..');
const STORAGE_DIR = path.join(ROOT, 'storage');
const OUTPUTS_DIR = path.join(STORAGE_DIR, 'outputs');
const PUBLIC_DIR = path.join(ROOT, 'public');

ensureDir(STORAGE_DIR);
ensureDir(OUTPUTS_DIR);

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

// Simplified logging for Bible transcription
function log(level, message) {
	const timestamp = new Date().toISOString();
	console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
}

console.log('[Server] Bible transcription service initialized');

// Root path handler - redirect to Bible transcription page
app.get('/', (req, res) => {
	res.redirect('/bible.html');
});

// Static assets with comprehensive cache control
app.use('/', express.static(PUBLIC_DIR, {
	etag: true,
	lastModified: true,
	setHeaders: (res, path) => {
		// Add cache buster to all static assets
		res.setHeader('X-Cache-Buster', CACHE_BUSTER);
		res.setHeader('X-App-Version', APP_VERSION);
		
		// Smart caching based on file type
		if (path.endsWith('.html')) {
			// HTML files - no cache to ensure fresh content
			res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
			res.setHeader('Pragma', 'no-cache');
			res.setHeader('Expires', '0');
		} else if (path.endsWith('.css')) {
			// CSS files - allow caching but with version control
			res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate'); // 5 minutes
			res.setHeader('Pragma', 'no-cache');
			res.setHeader('Expires', '0');
		} else if (path.endsWith('.js')) {
			// JS files - allow caching but with version control
			res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate'); // 5 minutes
			res.setHeader('Pragma', 'no-cache');
			res.setHeader('Expires', '0');
		} else if (path.match(/\.(png|jpg|jpeg|gif|svg|ico|ttf|woff|woff2)$/)) {
			// Images and fonts - long cache
			res.setHeader('Cache-Control', 'public, max-age=604800, immutable'); // 1 week, immutable
		} else {
			// Default for other files - no cache
			res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
			res.setHeader('Pragma', 'no-cache');
			res.setHeader('Expires', '0');
		}
	}
}));

// Basic health check
app.get('/api/health', (_req, res) => {
	res.json({ 
		ok: true, 
		uptime: process.uptime(),
		version: APP_VERSION,
		cacheBuster: CACHE_BUSTER
	});
});

// Bible books endpoint
app.get('/api/bible/books', (_req, res) => {
	res.json(BIBLE_BOOKS);
});

// Bible translations endpoint
app.get('/api/bible/translations', (_req, res) => {
	res.json(AVAILABLE_TRANSLATIONS);
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

// Start Bible transcription job
app.post('/api/jobs/bible', async (req, res) => {
	try {
		const payload = {
			translation: req.body?.translation || 'web',
			book: req.body?.book || 'John',
			chapter: Number(req.body?.chapter || 1),
			verseRanges: req.body?.verseRanges || '',
			excludeNumbers: Boolean(req.body?.excludeNumbers ?? true),
			excludeFootnotes: Boolean(req.body?.excludeFootnotes ?? true),
			type: req.body?.type || 'chapter',
			chapters: req.body?.chapters || ''
		};
		
		// Process Bible text immediately on server side
		const result = await processBibleTranscription(payload);
		res.json(result);
	} catch (error) {
		console.error('[API] Bible transcription error:', error);
		res.status(500).json({ error: error.message });
	}
});

// Outputs list
app.get('/api/outputs', (_req, res) => {
	try {
		const files = fs.readdirSync(OUTPUTS_DIR)
			.filter(f => !f.startsWith('.'))
			.map(name => ({ name, url: `/outputs/${name}` }));
		res.json({ files });
	} catch (error) {
		console.error('[API] Error listing outputs:', error);
		res.status(500).json({ error: error.message });
	}
});

// Outputs rename
app.post('/api/outputs/rename', (req, res) => {
	try {
		const { oldName, newName } = req.body || {};
		if (!oldName || !newName) return res.status(400).json({ error: 'Missing names' });
		const oldPath = path.join(OUTPUTS_DIR, oldName);
		const newPath = path.join(OUTPUTS_DIR, newName);
		if (!fs.existsSync(oldPath)) return res.status(404).json({ error: 'Not found' });
		fs.renameSync(oldPath, newPath);
		res.json({ ok: true });
	} catch (error) {
		console.error('[API] Error renaming output:', error);
		res.status(500).json({ error: error.message });
	}
});

// Outputs delete
app.post('/api/outputs/delete', (req, res) => {
	try {
		const { name } = req.body || {};
		if (!name) return res.status(400).json({ error: 'Missing name' });
		const p = path.join(OUTPUTS_DIR, name);
		if (!fs.existsSync(p)) return res.status(404).json({ error: 'Not found' });
		fs.unlinkSync(p);
		res.json({ ok: true });
	} catch (error) {
		console.error('[API] Error deleting output:', error);
		res.status(500).json({ error: error.message });
	}
});

// Serve stored outputs
app.use('/outputs', express.static(OUTPUTS_DIR, {
	maxAge: '30m', // Cache outputs for 30 minutes
	etag: true,
	lastModified: true
}));

// Bible transcription processing function
async function processBibleTranscription(payload) {
	try {
		const { translation, book, chapter, verseRanges, excludeNumbers, excludeFootnotes, type, chapters } = payload;
		
		log('info', `Processing Bible transcription: ${book} ${type === 'book' ? 'entire book' : type === 'chapters' ? `chapters ${chapters}` : `chapter ${chapter}`}`);
		
		let allText = '';
		let processedChapters = [];
		
		if (type === 'book') {
			// Handle entire book
			const maxChapters = getMaxChapters(book);
			log('info', `Processing entire book: ${book} with ${maxChapters} chapters`);
			
			for (let ch = 1; ch <= maxChapters; ch++) {
				const chapterValidation = validateChapter(book, ch);
				if (!chapterValidation.valid) {
					continue; // Skip invalid chapters
				}
				
				const rawText = await fetchBibleText({ translation, book, chapter: ch });
				const cleanedText = cleanupBibleText(rawText, { excludeNumbers, excludeFootnotes });
				allText += `${book}, Chapter ${ch}.\n${cleanedText}\n\n`;
				processedChapters.push(ch);
			}
		} else if (type === 'chapters' && chapters) {
			// Handle multiple chapters
			const chapterRanges = chapters.split(',').map(range => range.trim());
			log('info', `Processing multiple chapters: ${chapters}`);
			
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
							allText += `${book}, Chapter ${ch}.\n${cleanedText}\n\n`;
							processedChapters.push(ch);
						}
					}
				} else {
					const ch = parseInt(range);
					if (!isNaN(ch)) {
						const chapterValidation = validateChapter(book, ch);
						if (chapterValidation.valid) {
							const rawText = await fetchBibleText({ translation, book, chapter: ch });
							const cleanedText = cleanupBibleText(rawText, { excludeNumbers, excludeFootnotes });
							allText += `${book}, Chapter ${ch}.\n${cleanedText}\n\n`;
							processedChapters.push(ch);
						}
					}
				}
			}
		} else {
			// Handle single chapter
			const chapterNum = parseInt(chapter);
			if (isNaN(chapterNum)) {
				throw new Error('Chapter must be a number');
			}
			
			const chapterValidation = validateChapter(book, chapterNum);
			if (!chapterValidation.valid) {
				throw new Error(chapterValidation.error);
			}
			
			// Validate verse ranges if provided
			if (verseRanges && verseRanges.trim()) {
				const verseValidation = validateVerseRanges(book, chapterNum, verseRanges);
				if (!verseValidation.valid) {
					throw new Error(verseValidation.error);
				}
			}
			
			// Parse verse ranges
			const verses = verseRanges ? parseVerseRanges(verseRanges) : null;
			
			// Fetch Bible text
			const rawText = await fetchBibleText({ translation, book, chapter: chapterNum, verses });
			allText = cleanupBibleText(rawText, { excludeNumbers, excludeFootnotes });
			processedChapters.push(chapterNum);
		}
		
		// Save transcription to file
		const timestamp = Date.now();
		const filename = `bible-${book}-${type === 'book' ? 'entire' : type === 'chapters' ? chapters : chapter}-${translation}-${timestamp}.txt`;
		const filePath = path.join(OUTPUTS_DIR, filename);
		
		fs.writeFileSync(filePath, allText);
		
		log('success', `Bible transcription completed: ${filename}`);
		
		return {
			success: true,
			filename,
			text: allText,
			processedChapters,
			translation,
			book,
			type,
			excludeNumbers,
			excludeFootnotes,
			fileUrl: `/outputs/${filename}`
		};
		
	} catch (error) {
		log('error', `Bible transcription failed: ${error.message}`);
		throw error;
	}
}

app.listen(PORT, () => {
	console.log(`[Server] Bible transcription service listening on http://localhost:${PORT}`);
	log('info', `Server started on port ${PORT}`);
});

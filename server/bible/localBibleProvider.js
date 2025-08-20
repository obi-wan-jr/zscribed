// Local Bible Provider - for hosting Bible data locally
// This provides better performance and reliability than external APIs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bible data directory
const BIBLE_DATA_DIR = path.join(__dirname, '../../data/bible');

// Available translations for local hosting (only WEB for now)
export const AVAILABLE_TRANSLATIONS = [
	{ id: 'web', name: 'World English Bible', language: 'English' }
];

// Bible books with their chapter counts for validation
export const BIBLE_BOOKS = [
	{ name: 'Genesis', chapters: 50, testament: 'old' },
	{ name: 'Exodus', chapters: 40, testament: 'old' },
	{ name: 'Leviticus', chapters: 27, testament: 'old' },
	{ name: 'Numbers', chapters: 36, testament: 'old' },
	{ name: 'Deuteronomy', chapters: 34, testament: 'old' },
	{ name: 'Joshua', chapters: 24, testament: 'old' },
	{ name: 'Judges', chapters: 21, testament: 'old' },
	{ name: 'Ruth', chapters: 4, testament: 'old' },
	{ name: '1 Samuel', chapters: 31, testament: 'old' },
	{ name: '2 Samuel', chapters: 24, testament: 'old' },
	{ name: '1 Kings', chapters: 22, testament: 'old' },
	{ name: '2 Kings', chapters: 25, testament: 'old' },
	{ name: '1 Chronicles', chapters: 29, testament: 'old' },
	{ name: '2 Chronicles', chapters: 36, testament: 'old' },
	{ name: 'Ezra', chapters: 10, testament: 'old' },
	{ name: 'Nehemiah', chapters: 13, testament: 'old' },
	{ name: 'Esther', chapters: 10, testament: 'old' },
	{ name: 'Job', chapters: 42, testament: 'old' },
	{ name: 'Psalms', chapters: 150, testament: 'old' },
	{ name: 'Proverbs', chapters: 31, testament: 'old' },
	{ name: 'Ecclesiastes', chapters: 12, testament: 'old' },
	{ name: 'Song of Solomon', chapters: 8, testament: 'old' },
	{ name: 'Isaiah', chapters: 66, testament: 'old' },
	{ name: 'Jeremiah', chapters: 52, testament: 'old' },
	{ name: 'Lamentations', chapters: 5, testament: 'old' },
	{ name: 'Ezekiel', chapters: 48, testament: 'old' },
	{ name: 'Daniel', chapters: 12, testament: 'old' },
	{ name: 'Hosea', chapters: 14, testament: 'old' },
	{ name: 'Joel', chapters: 3, testament: 'old' },
	{ name: 'Amos', chapters: 9, testament: 'old' },
	{ name: 'Obadiah', chapters: 1, testament: 'old' },
	{ name: 'Jonah', chapters: 4, testament: 'old' },
	{ name: 'Micah', chapters: 7, testament: 'old' },
	{ name: 'Nahum', chapters: 3, testament: 'old' },
	{ name: 'Habakkuk', chapters: 3, testament: 'old' },
	{ name: 'Zephaniah', chapters: 3, testament: 'old' },
	{ name: 'Haggai', chapters: 2, testament: 'old' },
	{ name: 'Zechariah', chapters: 14, testament: 'old' },
	{ name: 'Malachi', chapters: 4, testament: 'old' },
	{ name: 'Matthew', chapters: 28, testament: 'new' },
	{ name: 'Mark', chapters: 16, testament: 'new' },
	{ name: 'Luke', chapters: 24, testament: 'new' },
	{ name: 'John', chapters: 21, testament: 'new' },
	{ name: 'Acts', chapters: 28, testament: 'new' },
	{ name: 'Romans', chapters: 16, testament: 'new' },
	{ name: '1 Corinthians', chapters: 16, testament: 'new' },
	{ name: '2 Corinthians', chapters: 13, testament: 'new' },
	{ name: 'Galatians', chapters: 6, testament: 'new' },
	{ name: 'Ephesians', chapters: 6, testament: 'new' },
	{ name: 'Philippians', chapters: 4, testament: 'new' },
	{ name: 'Colossians', chapters: 4, testament: 'new' },
	{ name: '1 Thessalonians', chapters: 5, testament: 'new' },
	{ name: '2 Thessalonians', chapters: 3, testament: 'new' },
	{ name: '1 Timothy', chapters: 6, testament: 'new' },
	{ name: '2 Timothy', chapters: 4, testament: 'new' },
	{ name: 'Titus', chapters: 3, testament: 'new' },
	{ name: 'Philemon', chapters: 1, testament: 'new' },
	{ name: 'Hebrews', chapters: 13, testament: 'new' },
	{ name: 'James', chapters: 5, testament: 'new' },
	{ name: '1 Peter', chapters: 5, testament: 'new' },
	{ name: '2 Peter', chapters: 3, testament: 'new' },
	{ name: '1 John', chapters: 5, testament: 'new' },
	{ name: '2 John', chapters: 1, testament: 'new' },
	{ name: '3 John', chapters: 1, testament: 'new' },
	{ name: 'Jude', chapters: 1, testament: 'new' },
	{ name: 'Revelation', chapters: 22, testament: 'new' }
];

// Book name mappings for common variations
const BOOK_NAME_MAPPINGS = {
	'genesis': 'genesis',
	'gen': 'genesis',
	'exodus': 'exodus',
	'exo': 'exodus',
	'leviticus': 'leviticus',
	'lev': 'leviticus',
	'numbers': 'numbers',
	'num': 'numbers',
	'deuteronomy': 'deuteronomy',
	'deut': 'deuteronomy',
	'joshua': 'joshua',
	'josh': 'joshua',
	'judges': 'judges',
	'judg': 'judges',
	'ruth': 'ruth',
	'1 samuel': '1-samuel',
	'1 sam': '1-samuel',
	'2 samuel': '2-samuel',
	'2 sam': '2-samuel',
	'1 kings': '1-kings',
	'1 kgs': '1-kings',
	'2 kings': '2-kings',
	'2 kgs': '2-kings',
	'1 chronicles': '1-chronicles',
	'1 chr': '1-chronicles',
	'2 chronicles': '2-chronicles',
	'2 chr': '2-chronicles',
	'ezra': 'ezra',
	'nehemiah': 'nehemiah',
	'neh': 'nehemiah',
	'esther': 'esther',
	'est': 'esther',
	'job': 'job',
	'psalms': 'psalms',
	'psalm': 'psalms',
	'ps': 'psalms',
	'proverbs': 'proverbs',
	'prov': 'proverbs',
	'ecclesiastes': 'ecclesiastes',
	'eccl': 'ecclesiastes',
	'song of solomon': 'song-of-solomon',
	'song': 'song-of-solomon',
	'isaiah': 'isaiah',
	'isa': 'isaiah',
	'jeremiah': 'jeremiah',
	'jer': 'jeremiah',
	'lam': 'lamentations',
	'lamentations': 'lamentations',
	'ezekiel': 'ezekiel',
	'ezek': 'ezekiel',
	'daniel': 'daniel',
	'dan': 'daniel',
	'hosea': 'hosea',
	'joel': 'joel',
	'amos': 'amos',
	'obadiah': 'obadiah',
	'obad': 'obadiah',
	'jonah': 'jonah',
	'micah': 'micah',
	'nahum': 'nahum',
	'habakkuk': 'habakkuk',
	'hab': 'habakkuk',
	'zephaniah': 'zephaniah',
	'zeph': 'zephaniah',
	'haggai': 'haggai',
	'hag': 'haggai',
	'zechariah': 'zechariah',
	'zech': 'zechariah',
	'malachi': 'malachi',
	'mal': 'malachi',
	'matthew': 'matthew',
	'matt': 'matthew',
	'mark': 'mark',
	'luke': 'luke',
	'john': 'john',
	'acts': 'acts',
	'romans': 'romans',
	'rom': 'romans',
	'1 corinthians': '1-corinthians',
	'1 cor': '1-corinthians',
	'2 corinthians': '2-corinthians',
	'2 cor': '2-corinthians',
	'galatians': 'galatians',
	'gal': 'galatians',
	'ephesians': 'ephesians',
	'eph': 'ephesians',
	'philippians': 'philippians',
	'phil': 'philippians',
	'colossians': 'colossians',
	'col': 'colossians',
	'1 thessalonians': '1-thessalonians',
	'1 thess': '1-thessalonians',
	'2 thessalonians': '2-thessalonians',
	'2 thess': '2-thessalonians',
	'1 timothy': '1-timothy',
	'1 tim': '1-timothy',
	'2 timothy': '2-timothy',
	'2 tim': '2-timothy',
	'titus': 'titus',
	'philemon': 'philemon',
	'philem': 'philemon',
	'hebrews': 'hebrews',
	'heb': 'hebrews',
	'james': 'james',
	'1 peter': '1-peter',
	'1 pet': '1-peter',
	'2 peter': '2-peter',
	'2 pet': '2-peter',
	'1 john': '1-john',
	'2 john': '2-john',
	'3 john': '3-john',
	'jude': 'jude',
	'revelation': 'revelation',
	'rev': 'revelation'
};

// Cache for loaded Bible data
const bibleCache = new Map();

export async function fetchBibleText({ translation = 'web', book, chapter, verses }) {
	try {
		console.log(`[LocalBible] Fetching ${book} ${chapter} verses ${verses?.join(',') || 'all'} (${translation})`);
		
		// Only support WEB translation for now
		if (translation !== 'web') {
			throw new Error(`Translation "${translation}" not available locally. Only WEB (World English Bible) is supported.`);
		}
		
		// Normalize book name
		const normalizedBook = BOOK_NAME_MAPPINGS[book.toLowerCase()] || book.toLowerCase().replace(/\s+/g, '-');
		
		// Check if we have local data for this translation
		const translationDir = path.join(BIBLE_DATA_DIR, translation);
		if (!fs.existsSync(translationDir)) {
			throw new Error(`Local Bible data not found. Please run the download script first: node scripts/download-web-bible.js`);
		}
		
		// Load the chapter data
		const chapterFile = path.join(translationDir, `${normalizedBook}-${chapter}.json`);
		
		if (!fs.existsSync(chapterFile)) {
			throw new Error(`Chapter ${chapter} not found for ${book} in local WEB translation. File: ${chapterFile}`);
		}
		
		// Load from cache or file
		let chapterData;
		const cacheKey = `${translation}-${normalizedBook}-${chapter}`;
		
		if (bibleCache.has(cacheKey)) {
			chapterData = bibleCache.get(cacheKey);
		} else {
			const fileContent = fs.readFileSync(chapterFile, 'utf8');
			chapterData = JSON.parse(fileContent);
			bibleCache.set(cacheKey, chapterData);
		}
		
		// Extract requested verses
		let selectedVerses = chapterData.verses;
		if (verses && verses.length > 0) {
			selectedVerses = chapterData.verses.filter(verse => verses.includes(verse.verse));
		}
		
		if (selectedVerses.length === 0) {
			throw new Error(`No verses found for ${book} ${chapter}`);
		}
		
		// Extract text from verses
		const verseTexts = selectedVerses.map(verse => verse.text.trim());
		const fullText = verseTexts.join(' ');
		
		console.log(`[LocalBible] Successfully fetched ${selectedVerses.length} verses from ${book} ${chapter}`);
		
		return fullText;
		
	} catch (error) {
		console.error(`[LocalBible] Error fetching Bible text:`, error.message);
		throw error;
	}
}

export function cleanupBibleText(raw, { excludeNumbers = true, excludeFootnotes = true } = {}) {
	let text = raw || '';
	
	if (excludeNumbers) {
		// Remove verse numbers at the beginning of lines/sentences
		text = text.replace(/^\s*\d+\s+/gm, '');
		text = text.replace(/\s+\d+\s+/g, ' ');
	}
	
	if (excludeFootnotes) {
		// Remove footnotes, cross-references, and other annotations
		text = text.replace(/\[[^\]]*\]/g, ''); // [a], [b], etc.
		text = text.replace(/\([^\)]*\)/g, ''); // (a), (footnote), etc.
		text = text.replace(/\*[^*]*\*/g, ''); // *footnote*
		text = text.replace(/†[^†]*†/g, ''); // †footnote†
		text = text.replace(/‡[^‡]*‡/g, ''); // ‡footnote‡
	}
	
	// Clean up extra whitespace
	text = text.replace(/\s+/g, ' ').trim();
	
	return text;
}

export async function testLocalBibleConnection() {
	try {
		console.log('[LocalBible] Testing local Bible data availability');
		
		// Check if data directory exists
		if (!fs.existsSync(BIBLE_DATA_DIR)) {
			return {
				success: false,
				error: 'Bible data directory not found',
				troubleshooting: [
					'Create the data/bible directory',
					'Run: node scripts/download-web-bible.js',
					'This will download all WEB Bible chapters'
				]
			};
		}
		
		// Check for WEB translation
		const webDir = path.join(BIBLE_DATA_DIR, 'web');
		if (!fs.existsSync(webDir)) {
			return {
				success: false,
				error: 'WEB Bible data not found',
				troubleshooting: [
					'Run: node scripts/download-web-bible.js',
					'This will download all WEB Bible chapters',
					'Check that the download completed successfully'
				]
			};
		}
		
		// Count available chapters
		const files = fs.readdirSync(webDir, { withFileTypes: true })
			.filter(dirent => dirent.isFile() && dirent.name.endsWith('.json'))
			.map(dirent => dirent.name);
		
		if (files.length === 0) {
			return {
				success: false,
				error: 'No Bible chapters found',
				troubleshooting: [
					'Run: node scripts/download-web-bible.js',
					'This will download all WEB Bible chapters',
					'Check that the download completed successfully'
				]
			};
		}
		
		// Try to load a sample verse
		const sampleFile = path.join(webDir, 'john-3.json');
		
		if (!fs.existsSync(sampleFile)) {
			return {
				success: false,
				error: 'Sample Bible data not found',
				troubleshooting: [
					'Run: node scripts/download-web-bible.js',
					'This will download all WEB Bible chapters',
					'Check that the download completed successfully'
				]
			};
		}
		
		const sampleData = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
		
		return {
			success: true,
			message: 'Local WEB Bible data is available',
			sample: {
				translation: 'WEB',
				book: sampleData.book_name,
				chapter: sampleData.chapter,
				verses: sampleData.verses.length
			},
			availableChapters: files.length,
			note: 'Only WEB (World English Bible) translation is available locally'
		};
		
	} catch (error) {
		console.error('[LocalBible] Connection test failed:', error.message);
		
		return {
			success: false,
			error: error.message,
			troubleshooting: [
				'Check file permissions',
				'Verify data directory structure',
				'Ensure JSON files are valid',
				'Run: node scripts/download-web-bible.js'
			]
		};
	}
}

// Function to get book information by name
export function getBookInfo(bookName) {
	return BIBLE_BOOKS.find(book => book.name === bookName);
}

// Function to validate chapter number for a book
export function validateChapter(bookName, chapterNumber) {
	const bookInfo = getBookInfo(bookName);
	if (!bookInfo) {
		return { valid: false, error: `Book "${bookName}" not found` };
	}
	
	if (chapterNumber < 1 || chapterNumber > bookInfo.chapters) {
		return { 
			valid: false, 
			error: `Chapter ${chapterNumber} is invalid for ${bookName}. Valid range: 1-${bookInfo.chapters}` 
		};
	}
	
	return { valid: true, bookInfo };
}

// Function to validate verse ranges for a chapter
export function validateVerseRanges(bookName, chapterNumber, verseRanges) {
	const chapterValidation = validateChapter(bookName, chapterNumber);
	if (!chapterValidation.valid) {
		return chapterValidation;
	}
	
	const bookInfo = chapterValidation.bookInfo;
	
	// Parse verse ranges (e.g., "1-10, 15, 20-25")
	const ranges = verseRanges.split(',').map(range => range.trim());
	const validRanges = [];
	const invalidRanges = [];
	
	for (const range of ranges) {
		if (range.includes('-')) {
			// Range like "1-10"
			const [start, end] = range.split('-').map(v => parseInt(v.trim()));
			if (isNaN(start) || isNaN(end) || start < 1 || end > bookInfo.chapters || start > end) {
				invalidRanges.push(range);
			} else {
				validRanges.push({ start, end, type: 'range' });
			}
		} else {
			// Single verse like "15"
			const verse = parseInt(range);
			if (isNaN(verse) || verse < 1 || verse > bookInfo.chapters) {
				invalidRanges.push(range);
			} else {
				validRanges.push({ start: verse, end: verse, type: 'single' });
			}
		}
	}
	
	if (invalidRanges.length > 0) {
		return {
			valid: false,
			error: `Invalid verse ranges: ${invalidRanges.join(', ')}. Valid range: 1-${bookInfo.chapters}`
		};
	}
	
	return { valid: true, validRanges };
}

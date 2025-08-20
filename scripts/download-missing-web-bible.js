#!/usr/bin/env node

// Download Missing WEB Bible Data Script
// Identifies missing chapters and downloads them with slower rate limiting

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BIBLE_API_BASE_URL = 'https://bible-api.com';
const TRANSLATION = 'web';
const OUTPUT_DIR = path.join(__dirname, '../data/bible/web');
const DELAY_BETWEEN_REQUESTS = 3000; // 3 seconds delay between requests (much slower)

// Bible books with their chapter counts
const BIBLE_BOOKS = [
	{ name: 'Genesis', chapters: 50 },
	{ name: 'Exodus', chapters: 40 },
	{ name: 'Leviticus', chapters: 27 },
	{ name: 'Numbers', chapters: 36 },
	{ name: 'Deuteronomy', chapters: 34 },
	{ name: 'Joshua', chapters: 24 },
	{ name: 'Judges', chapters: 21 },
	{ name: 'Ruth', chapters: 4 },
	{ name: '1 Samuel', chapters: 31 },
	{ name: '2 Samuel', chapters: 24 },
	{ name: '1 Kings', chapters: 22 },
	{ name: '2 Kings', chapters: 25 },
	{ name: '1 Chronicles', chapters: 29 },
	{ name: '2 Chronicles', chapters: 36 },
	{ name: 'Ezra', chapters: 10 },
	{ name: 'Nehemiah', chapters: 13 },
	{ name: 'Esther', chapters: 10 },
	{ name: 'Job', chapters: 42 },
	{ name: 'Psalms', chapters: 150 },
	{ name: 'Proverbs', chapters: 31 },
	{ name: 'Ecclesiastes', chapters: 12 },
	{ name: 'Song of Solomon', chapters: 8 },
	{ name: 'Isaiah', chapters: 66 },
	{ name: 'Jeremiah', chapters: 52 },
	{ name: 'Lamentations', chapters: 5 },
	{ name: 'Ezekiel', chapters: 48 },
	{ name: 'Daniel', chapters: 12 },
	{ name: 'Hosea', chapters: 14 },
	{ name: 'Joel', chapters: 3 },
	{ name: 'Amos', chapters: 9 },
	{ name: 'Obadiah', chapters: 1 },
	{ name: 'Jonah', chapters: 4 },
	{ name: 'Micah', chapters: 7 },
	{ name: 'Nahum', chapters: 3 },
	{ name: 'Habakkuk', chapters: 3 },
	{ name: 'Zephaniah', chapters: 3 },
	{ name: 'Haggai', chapters: 2 },
	{ name: 'Zechariah', chapters: 14 },
	{ name: 'Malachi', chapters: 4 },
	{ name: 'Matthew', chapters: 28 },
	{ name: 'Mark', chapters: 16 },
	{ name: 'Luke', chapters: 24 },
	{ name: 'John', chapters: 21 },
	{ name: 'Acts', chapters: 28 },
	{ name: 'Romans', chapters: 16 },
	{ name: '1 Corinthians', chapters: 16 },
	{ name: '2 Corinthians', chapters: 13 },
	{ name: 'Galatians', chapters: 6 },
	{ name: 'Ephesians', chapters: 6 },
	{ name: 'Philippians', chapters: 4 },
	{ name: 'Colossians', chapters: 4 },
	{ name: '1 Thessalonians', chapters: 5 },
	{ name: '2 Thessalonians', chapters: 3 },
	{ name: '1 Timothy', chapters: 6 },
	{ name: '2 Timothy', chapters: 4 },
	{ name: 'Titus', chapters: 3 },
	{ name: 'Philemon', chapters: 1 },
	{ name: 'Hebrews', chapters: 13 },
	{ name: 'James', chapters: 5 },
	{ name: '1 Peter', chapters: 5 },
	{ name: '2 Peter', chapters: 3 },
	{ name: '1 John', chapters: 5 },
	{ name: '2 John', chapters: 1 },
	{ name: '3 John', chapters: 1 },
	{ name: 'Jude', chapters: 1 },
	{ name: 'Revelation', chapters: 22 }
];

// Utility function to delay execution
function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// Utility function to normalize book names for filenames
function normalizeBookName(bookName) {
	return bookName.toLowerCase().replace(/\s+/g, '-');
}

// Get list of existing files
function getExistingFiles() {
	if (!fs.existsSync(OUTPUT_DIR)) {
		return new Set();
	}
	
	const files = fs.readdirSync(OUTPUT_DIR, { withFileTypes: true })
		.filter(dirent => dirent.isFile() && dirent.name.endsWith('.json'))
		.map(dirent => dirent.name.replace('.json', ''));
	
	return new Set(files);
}

// Find missing chapters
function findMissingChapters(existingFiles) {
	const missing = [];
	
	for (const book of BIBLE_BOOKS) {
		const normalizedBook = normalizeBookName(book.name);
		
		for (let chapter = 1; chapter <= book.chapters; chapter++) {
			const expectedFile = `${normalizedBook}-${chapter}`;
			
			if (!existingFiles.has(expectedFile)) {
				missing.push({
					book: book.name,
					chapter: chapter,
					file: expectedFile
				});
			}
		}
	}
	
	return missing;
}

// Fetch a single chapter
async function fetchChapter(bookName, chapterNumber) {
	const normalizedBook = bookName.toLowerCase().replace(/\s+/g, '+');
	const url = `${BIBLE_API_BASE_URL}/${normalizedBook}+${chapterNumber}?translation=${TRANSLATION}`;
	
	console.log(`Fetching ${bookName} ${chapterNumber}...`);
	
	try {
		const response = await fetch(url);
		
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}
		
		const data = await response.json();
		
		if (!data.verses || data.verses.length === 0) {
			throw new Error(`No verses found for ${bookName} ${chapterNumber}`);
		}
		
		return data;
		
	} catch (error) {
		console.error(`Error fetching ${bookName} ${chapterNumber}:`, error.message);
		throw error;
	}
}

// Save chapter data to file
function saveChapter(bookName, chapterNumber, data) {
	const normalizedBook = normalizeBookName(bookName);
	const filename = `${normalizedBook}-${chapterNumber}.json`;
	const filepath = path.join(OUTPUT_DIR, filename);
	
	try {
		fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
		console.log(`✅ Saved ${filename}`);
		return true;
	} catch (error) {
		console.error(`Error saving ${filename}:`, error.message);
		return false;
	}
}

// Main download function
async function downloadMissingChapters() {
	console.log('🔍 Finding missing WEB Bible chapters...');
	console.log(`📁 Output directory: ${OUTPUT_DIR}`);
	console.log(`⏱️  Delay between requests: ${DELAY_BETWEEN_REQUESTS}ms (slower to avoid rate limits)`);
	console.log('');
	
	// Get existing files
	const existingFiles = getExistingFiles();
	console.log(`📊 Found ${existingFiles.size} existing chapters`);
	
	// Find missing chapters
	const missingChapters = findMissingChapters(existingFiles);
	
	if (missingChapters.length === 0) {
		console.log('🎉 All chapters are already downloaded!');
		return;
	}
	
	console.log(`📋 Found ${missingChapters.length} missing chapters:`);
	
	// Group missing chapters by book for better reporting
	const missingByBook = {};
	for (const missing of missingChapters) {
		if (!missingByBook[missing.book]) {
			missingByBook[missing.book] = [];
		}
		missingByBook[missing.book].push(missing.chapter);
	}
	
	for (const [book, chapters] of Object.entries(missingByBook)) {
		console.log(`   ${book}: ${chapters.join(', ')}`);
	}
	
	console.log('');
	console.log('🚀 Starting download of missing chapters...');
	console.log('');
	
	let successfulDownloads = 0;
	let failedDownloads = 0;
	
	// Download missing chapters
	for (let i = 0; i < missingChapters.length; i++) {
		const missing = missingChapters[i];
		const progress = ((i + 1) / missingChapters.length * 100).toFixed(1);
		
		console.log(`📈 Progress: ${progress}% (${i + 1}/${missingChapters.length}) - ${missing.book} ${missing.chapter}`);
		
		try {
			const data = await fetchChapter(missing.book, missing.chapter);
			const saved = saveChapter(missing.book, missing.chapter, data);
			
			if (saved) {
				successfulDownloads++;
			} else {
				failedDownloads++;
			}
			
			// Delay between requests to respect rate limits
			if (i < missingChapters.length - 1) {
				console.log(`⏳ Waiting ${DELAY_BETWEEN_REQUESTS}ms before next request...`);
				await delay(DELAY_BETWEEN_REQUESTS);
			}
			
		} catch (error) {
			failedDownloads++;
			console.error(`❌ Failed to download ${missing.book} ${missing.chapter}:`, error.message);
			
			// Continue with next chapter even if this one fails
			if (i < missingChapters.length - 1) {
				console.log(`⏳ Waiting ${DELAY_BETWEEN_REQUESTS}ms before next request...`);
				await delay(DELAY_BETWEEN_REQUESTS);
			}
		}
	}
	
	// Final summary
	console.log('');
	console.log('🎉 Download of missing chapters completed!');
	console.log(`📊 Summary:`);
	console.log(`   Missing chapters: ${missingChapters.length}`);
	console.log(`   Successful: ${successfulDownloads}`);
	console.log(`   Failed: ${failedDownloads}`);
	console.log(`   Success rate: ${((successfulDownloads / missingChapters.length) * 100).toFixed(1)}%`);
	console.log(`📁 Files saved to: ${OUTPUT_DIR}`);
	
	// Check final count
	const finalFiles = getExistingFiles();
	console.log(`📊 Total chapters now available: ${finalFiles.size}/1189`);
	
	if (failedDownloads > 0) {
		console.log(`⚠️  ${failedDownloads} chapters still failed to download.`);
		console.log(`💡 You may need to run this script again with an even slower rate.`);
	}
}

// Run the download
downloadMissingChapters().catch(error => {
	console.error('💥 Download failed:', error);
	process.exit(1);
});

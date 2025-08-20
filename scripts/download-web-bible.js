#!/usr/bin/env node

// Download WEB Bible Data Script
// Downloads the entire World English Bible from bible-api.com
// Saves each chapter as a separate JSON file for local hosting

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BIBLE_API_BASE_URL = 'https://bible-api.com';
const TRANSLATION = 'web';
const OUTPUT_DIR = path.join(__dirname, '../data/bible/web');
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second delay between requests

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
async function downloadWebBible() {
	console.log('🚀 Starting WEB Bible download...');
	console.log(`📁 Output directory: ${OUTPUT_DIR}`);
	console.log(`⏱️  Delay between requests: ${DELAY_BETWEEN_REQUESTS}ms`);
	console.log('');
	
	// Create output directory
	if (!fs.existsSync(OUTPUT_DIR)) {
		fs.mkdirSync(OUTPUT_DIR, { recursive: true });
		console.log(`📂 Created directory: ${OUTPUT_DIR}`);
	}
	
	// Calculate total chapters
	const totalChapters = BIBLE_BOOKS.reduce((sum, book) => sum + book.chapters, 0);
	let completedChapters = 0;
	let successfulDownloads = 0;
	let failedDownloads = 0;
	
	console.log(`📊 Total chapters to download: ${totalChapters}`);
	console.log('');
	
	// Download each book
	for (const book of BIBLE_BOOKS) {
		console.log(`📖 Processing ${book.name} (${book.chapters} chapters)...`);
		
		for (let chapter = 1; chapter <= book.chapters; chapter++) {
			completedChapters++;
			
			try {
				const data = await fetchChapter(book.name, chapter);
				const saved = saveChapter(book.name, chapter, data);
				
				if (saved) {
					successfulDownloads++;
				} else {
					failedDownloads++;
				}
				
				// Progress update
				const progress = ((completedChapters / totalChapters) * 100).toFixed(1);
				console.log(`📈 Progress: ${progress}% (${completedChapters}/${totalChapters}) - ${book.name} ${chapter}`);
				
				// Delay between requests to respect rate limits
				if (completedChapters < totalChapters) {
					await delay(DELAY_BETWEEN_REQUESTS);
				}
				
			} catch (error) {
				failedDownloads++;
				console.error(`❌ Failed to download ${book.name} ${chapter}:`, error.message);
				
				// Continue with next chapter even if this one fails
				await delay(DELAY_BETWEEN_REQUESTS);
			}
		}
		
		console.log(`✅ Completed ${book.name}`);
		console.log('');
	}
	
	// Final summary
	console.log('🎉 Download completed!');
	console.log(`📊 Summary:`);
	console.log(`   Total chapters: ${totalChapters}`);
	console.log(`   Successful: ${successfulDownloads}`);
	console.log(`   Failed: ${failedDownloads}`);
	console.log(`   Success rate: ${((successfulDownloads / totalChapters) * 100).toFixed(1)}%`);
	console.log(`📁 Files saved to: ${OUTPUT_DIR}`);
	
	if (failedDownloads > 0) {
		console.log(`⚠️  ${failedDownloads} chapters failed to download. You may want to retry them.`);
	}
}

// Run the download
downloadWebBible().catch(error => {
	console.error('💥 Download failed:', error);
	process.exit(1);
});

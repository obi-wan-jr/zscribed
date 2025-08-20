// Bible API Provider using bible-api.com
// Available translations: https://bible-api.com/data

const BIBLE_API_BASE_URL = 'https://bible-api.com';

// Available translations from bible-api.com
export const AVAILABLE_TRANSLATIONS = [
	{ id: 'web', name: 'World English Bible', language: 'English' },
	{ id: 'kjv', name: 'King James Version', language: 'English' },
	{ id: 'asv', name: 'American Standard Version (1901)', language: 'English' },
	{ id: 'bbe', name: 'Bible in Basic English', language: 'English' },
	{ id: 'darby', name: 'Darby Bible', language: 'English' },
	{ id: 'dra', name: 'Douay-Rheims 1899 American Edition', language: 'English' },
	{ id: 'ylt', name: "Young's Literal Translation (NT only)", language: 'English' },
	{ id: 'oeb-cw', name: 'Open English Bible, Commonwealth Edition', language: 'English (UK)' },
	{ id: 'webbe', name: 'World English Bible, British Edition', language: 'English (UK)' },
	{ id: 'oeb-us', name: 'Open English Bible, US Edition', language: 'English (US)' },
	{ id: 'cherokee', name: 'Cherokee New Testament', language: 'Cherokee' },
	{ id: 'cuv', name: 'Chinese Union Version', language: 'Chinese' },
	{ id: 'bkr', name: 'Bible kralická', language: 'Czech' },
	{ id: 'clementine', name: 'Clementine Latin Vulgate', language: 'Latin' },
	{ id: 'almeida', name: 'João Ferreira de Almeida', language: 'Portuguese' },
	{ id: 'rccv', name: 'Protestant Romanian Corrected Cornilescu Version', language: 'Romanian' },
	{ id: 'synodal', name: 'Russian Synodal Translation', language: 'Russian' }
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
	'1 samuel': '1 samuel',
	'1 sam': '1 samuel',
	'1 samuel': '1 samuel',
	'2 samuel': '2 samuel',
	'2 sam': '2 samuel',
	'2 samuel': '2 samuel',
	'1 kings': '1 kings',
	'1 kgs': '1 kings',
	'1 kings': '1 kings',
	'2 kings': '2 kings',
	'2 kgs': '2 kings',
	'2 kings': '2 kings',
	'1 chronicles': '1 chronicles',
	'1 chr': '1 chronicles',
	'1 chronicles': '1 chronicles',
	'2 chronicles': '2 chronicles',
	'2 chr': '2 chronicles',
	'2 chronicles': '2 chronicles',
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
	'song of solomon': 'song of solomon',
	'song': 'song of solomon',
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
	'1 corinthians': '1 corinthians',
	'1 cor': '1 corinthians',
	'1 corinthians': '1 corinthians',
	'2 corinthians': '2 corinthians',
	'2 cor': '2 corinthians',
	'2 corinthians': '2 corinthians',
	'galatians': 'galatians',
	'gal': 'galatians',
	'ephesians': 'ephesians',
	'eph': 'ephesians',
	'philippians': 'philippians',
	'phil': 'philippians',
	'colossians': 'colossians',
	'col': 'colossians',
	'1 thessalonians': '1 thessalonians',
	'1 thess': '1 thessalonians',
	'1 thessalonians': '1 thessalonians',
	'2 thessalonians': '2 thessalonians',
	'2 thess': '2 thessalonians',
	'2 thessalonians': '2 thessalonians',
	'1 timothy': '1 timothy',
	'1 tim': '1 timothy',
	'1 timothy': '1 timothy',
	'2 timothy': '2 timothy',
	'2 tim': '2 timothy',
	'2 timothy': '2 timothy',
	'titus': 'titus',
	'philemon': 'philemon',
	'philem': 'philemon',
	'hebrews': 'hebrews',
	'heb': 'hebrews',
	'james': 'james',
	'1 peter': '1 peter',
	'1 pet': '1 peter',
	'1 peter': '1 peter',
	'2 peter': '2 peter',
	'2 pet': '2 peter',
	'2 peter': '2 peter',
	'1 john': '1 john',
	'1 john': '1 john',
	'2 john': '2 john',
	'2 john': '2 john',
	'3 john': '3 john',
	'3 john': '3 john',
	'jude': 'jude',
	'revelation': 'revelation',
	'rev': 'revelation'
};

export async function fetchBibleText({ translation = 'web', book, chapter, verses }) {
	try {
		console.log(`[BibleAPI] Fetching ${book} ${chapter} verses ${verses?.join(',') || 'all'} (${translation})`);
		
		// Normalize book name
		const normalizedBook = BOOK_NAME_MAPPINGS[book.toLowerCase()] || book.toLowerCase();
		
		// Build the API URL
		let url = `${BIBLE_API_BASE_URL}/${normalizedBook}+${chapter}`;
		
		// Add verse range if specified
		if (verses && verses.length > 0) {
			const verseRange = verses.join(',');
			url += `:${verseRange}`;
		}
		
		// Add translation parameter
		url += `?translation=${translation}`;
		
		console.log(`[BibleAPI] Requesting: ${url}`);
		
		const response = await fetch(url);
		
		if (!response.ok) {
			throw new Error(`Bible API error: ${response.status} - ${response.statusText}`);
		}
		
		const data = await response.json();
		
		if (!data.verses || data.verses.length === 0) {
			throw new Error(`No verses found for ${book} ${chapter}`);
		}
		
		// Extract text from verses
		const verseTexts = data.verses.map(verse => verse.text.trim());
		const fullText = verseTexts.join(' ');
		
		console.log(`[BibleAPI] Successfully fetched ${data.verses.length} verses from ${data.reference}`);
		
		return fullText;
		
	} catch (error) {
		console.error(`[BibleAPI] Error fetching Bible text:`, error.message);
		
		// Provide specific error messages for common issues
		if (error.message.includes('404') || error.message.includes('Not Found')) {
			throw new Error(`Bible reference not found: ${book} ${chapter}. Please check the book name and chapter number.`);
		} else if (error.message.includes('400') || error.message.includes('Bad Request')) {
			throw new Error(`Invalid Bible reference: ${book} ${chapter}. Please check the format.`);
		} else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
			throw new Error(`Bible API server error. Please try again later.`);
		} else if (error.message.includes('fetch')) {
			throw new Error(`Network error connecting to Bible API. Please check your internet connection.`);
		} else {
			throw new Error(`Bible API error: ${error.message}`);
		}
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

export async function testBibleApiConnection() {
	try {
		console.log('[BibleAPI] Testing connection to bible-api.com');
		
		const response = await fetch(`${BIBLE_API_BASE_URL}/john+3:16?translation=web`);
		
		if (!response.ok) {
			return {
				success: false,
				error: `HTTP ${response.status}: ${response.statusText}`,
				troubleshooting: [
					'Check your internet connection',
					'Verify bible-api.com is accessible',
					'Try again in a few moments'
				]
			};
		}
		
		const data = await response.json();
		
		if (!data.text || !data.reference) {
			return {
				success: false,
				error: 'Invalid response format from Bible API',
				troubleshooting: [
					'The Bible API response format has changed',
					'Check bible-api.com status',
					'Try again later'
				]
			};
		}
		
		return {
			success: true,
			message: `Successfully connected to Bible API`,
			sample: {
				reference: data.reference,
				translation: data.translation_name,
				text: data.text.substring(0, 100) + '...'
			}
		};
		
	} catch (error) {
		console.error('[BibleAPI] Connection test failed:', error.message);
		
		return {
			success: false,
			error: error.message,
			troubleshooting: [
				'Check your internet connection',
				'Verify bible-api.com is accessible',
				'Try again in a few moments'
			]
		};
	}
}

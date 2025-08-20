// Translation Service using LibreTranslate (free, open-source)
// Alternative: Google Translate API (requires API key)

const LIBRE_TRANSLATE_URL = 'https://libretranslate.de/translate';

export async function translateText({ text, fromLanguage = 'auto', toLanguage = 'en' }) {
	try {
		console.log(`[Translation] Translating from ${fromLanguage} to ${toLanguage}`);
		
		if (!text || text.trim().length === 0) {
			throw new Error('No text provided for translation');
		}
		
		// Use LibreTranslate (free, no API key required)
		const response = await fetch(LIBRE_TRANSLATE_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				q: text,
				source: fromLanguage === 'auto' ? 'auto' : fromLanguage,
				target: toLanguage,
				format: 'text'
			})
		});
		
		if (!response.ok) {
			throw new Error(`Translation API error: ${response.status} - ${response.statusText}`);
		}
		
		const data = await response.json();
		
		if (!data.translatedText) {
			throw new Error('No translation received from API');
		}
		
		console.log(`[Translation] Successfully translated ${text.length} characters`);
		
		return {
			originalText: text,
			translatedText: data.translatedText,
			fromLanguage: data.detectedLanguage?.confidence ? data.detectedLanguage.language : fromLanguage,
			toLanguage: toLanguage,
			confidence: data.detectedLanguage?.confidence || null
		};
		
	} catch (error) {
		console.error(`[Translation] Error translating text:`, error.message);
		
		// Provide specific error messages for common issues
		if (error.message.includes('fetch')) {
			throw new Error(`Network error connecting to translation service. Please check your internet connection.`);
		} else if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
			throw new Error(`Translation rate limit exceeded. Please wait before trying again.`);
		} else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
			throw new Error(`Translation service error. Please try again later.`);
		} else {
			throw new Error(`Translation failed: ${error.message}`);
		}
	}
}

export async function testTranslationService() {
	try {
		console.log('[Translation] Testing connection to translation service');
		
		const result = await translateText({
			text: 'Hello world',
			fromLanguage: 'en',
			toLanguage: 'es'
		});
		
		if (!result.translatedText) {
			return {
				success: false,
				error: 'No translation received from service',
				troubleshooting: [
					'Check your internet connection',
					'Verify the translation service is accessible',
					'Try again in a few moments'
				]
			};
		}
		
		return {
			success: true,
			message: 'Successfully connected to translation service',
			sample: {
				original: result.originalText,
				translated: result.translatedText,
				from: result.fromLanguage,
				to: result.toLanguage
			}
		};
		
	} catch (error) {
		console.error('[Translation] Connection test failed:', error.message);
		
		return {
			success: false,
			error: error.message,
			troubleshooting: [
				'Check your internet connection',
				'Verify the translation service is accessible',
				'Try again in a few moments'
			]
		};
	}
}

// Available languages for the UI
export const AVAILABLE_LANGUAGES = [
	{ code: 'en', name: 'English' },
	{ code: 'es', name: 'Spanish' },
	{ code: 'fr', name: 'French' },
	{ code: 'de', name: 'German' },
	{ code: 'it', name: 'Italian' },
	{ code: 'pt', name: 'Portuguese' },
	{ code: 'ru', name: 'Russian' },
	{ code: 'ja', name: 'Japanese' },
	{ code: 'ko', name: 'Korean' },
	{ code: 'zh', name: 'Chinese' },
	{ code: 'ar', name: 'Arabic' },
	{ code: 'hi', name: 'Hindi' },
	{ code: 'nl', name: 'Dutch' },
	{ code: 'pl', name: 'Polish' },
	{ code: 'tr', name: 'Turkish' },
	{ code: 'sv', name: 'Swedish' },
	{ code: 'da', name: 'Danish' },
	{ code: 'no', name: 'Norwegian' },
	{ code: 'fi', name: 'Finnish' },
	{ code: 'cs', name: 'Czech' },
	{ code: 'hu', name: 'Hungarian' },
	{ code: 'ro', name: 'Romanian' },
	{ code: 'bg', name: 'Bulgarian' },
	{ code: 'hr', name: 'Croatian' },
	{ code: 'sk', name: 'Slovak' },
	{ code: 'sl', name: 'Slovenian' },
	{ code: 'et', name: 'Estonian' },
	{ code: 'lv', name: 'Latvian' },
	{ code: 'lt', name: 'Lithuanian' },
	{ code: 'mt', name: 'Maltese' },
	{ code: 'el', name: 'Greek' },
	{ code: 'he', name: 'Hebrew' },
	{ code: 'th', name: 'Thai' },
	{ code: 'vi', name: 'Vietnamese' },
	{ code: 'id', name: 'Indonesian' },
	{ code: 'ms', name: 'Malay' },
	{ code: 'tl', name: 'Filipino' },
	{ code: 'bn', name: 'Bengali' },
	{ code: 'ur', name: 'Urdu' },
	{ code: 'fa', name: 'Persian' },
	{ code: 'uk', name: 'Ukrainian' },
	{ code: 'be', name: 'Belarusian' },
	{ code: 'ka', name: 'Georgian' },
	{ code: 'hy', name: 'Armenian' },
	{ code: 'az', name: 'Azerbaijani' },
	{ code: 'kk', name: 'Kazakh' },
	{ code: 'ky', name: 'Kyrgyz' },
	{ code: 'uz', name: 'Uzbek' },
	{ code: 'tg', name: 'Tajik' },
	{ code: 'mn', name: 'Mongolian' },
	{ code: 'ne', name: 'Nepali' },
	{ code: 'si', name: 'Sinhala' },
	{ code: 'my', name: 'Myanmar' },
	{ code: 'km', name: 'Khmer' },
	{ code: 'lo', name: 'Lao' },
	{ code: 'gl', name: 'Galician' },
	{ code: 'eu', name: 'Basque' },
	{ code: 'ca', name: 'Catalan' },
	{ code: 'cy', name: 'Welsh' },
	{ code: 'ga', name: 'Irish' },
	{ code: 'is', name: 'Icelandic' },
	{ code: 'mk', name: 'Macedonian' },
	{ code: 'sq', name: 'Albanian' },
	{ code: 'bs', name: 'Bosnian' },
	{ code: 'sr', name: 'Serbian' },
	{ code: 'me', name: 'Montenegrin' }
];

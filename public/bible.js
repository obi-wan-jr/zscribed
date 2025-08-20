import { fetchMeta, getActiveUser, setActiveUser, updateAuthLink, requireAuth, authenticatedFetch, handleUnauthorizedError } from './common.js';

// Check authentication for protected features
console.log('[Bible] Checking authentication...');
requireAuth().then(isAuthenticated => {
	console.log('[Bible] Authentication result:', isAuthenticated);
	if (!isAuthenticated) return; // Will redirect to login
	
	// Initialize the page
	init();
});

// DOM elements
let voiceModel, translation, book, chapter, verses, selectAllVerses, excludeNumbers, excludeFootnotes, sentencesPerChunkBible;
let bibleFetchBtn, bibleTtsBtn, bibleProgress, userWelcome, outputsList, refreshOutputsBtn, queueStatus;

async function init() {
	console.log('[Bible] Initializing Bible page...');
	
	// Initialize DOM elements
	voiceModel = document.getElementById('voiceModel');
	translation = document.getElementById('translation');
	book = document.getElementById('book');
	chapter = document.getElementById('chapter');
	verses = document.getElementById('verses');
	selectAllVerses = document.getElementById('selectAllVerses');
	excludeNumbers = document.getElementById('excludeNumbers');
	excludeFootnotes = document.getElementById('excludeFootnotes');
	sentencesPerChunkBible = document.getElementById('sentencesPerChunkBible');
	bibleFetchBtn = document.getElementById('bibleFetchBtn');
	bibleTtsBtn = document.getElementById('bibleTtsBtn');
	bibleProgress = document.getElementById('bibleProgress');
	userWelcome = document.getElementById('userWelcome');
	outputsList = document.getElementById('outputsList');
	refreshOutputsBtn = document.getElementById('refreshOutputsBtn');
	queueStatus = document.getElementById('queueStatus');
	
	console.log('[Bible] DOM elements initialized:', {
		book: !!book,
		voiceModel: !!voiceModel,
		userWelcome: !!userWelcome
	});
	
	// Update the login/logout link
	await updateAuthLink();
	
	// Set welcome message
	const currentUser = getActiveUser();
	if (userWelcome) {
		userWelcome.textContent = `Welcome, ${currentUser}! Ready to create Bible audio.`;
	}
	
	// Set up chapter validation for hardcoded books
	setupChapterValidation();
	
	// Load voice models
	await loadVoiceModels();
	
	// Load outputs
	refreshOutputs();
	
	// Start polling queue status
	setInterval(pollQueueStatus, 2000);
	
	// Set up event listeners
	setupEventListeners();
}

async function loadVoiceModels() {
	try {
		const res = await authenticatedFetch('/api/models');
		if (!res) return; // Redirect happened
		
		const data = await res.json();
		voiceModel.innerHTML = '';
		for (const m of data.voiceModels || []) {
			const opt = document.createElement('option');
			opt.value = m.id; 
			opt.textContent = m.name || m.id; 
			voiceModel.appendChild(opt);
		}
	} catch (error) {
		if (handleUnauthorizedError(error)) return; // Redirect happened
		
		console.error('Failed to load voice models:', error);
		voiceModel.innerHTML = '<option value="">No voice models available</option>';
	}
}

function setupChapterValidation() {
	// Bible books with their chapter counts for validation
	const bibleBooks = {
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
	
	// Store the books data globally for validation
	window.bibleBooks = bibleBooks;
	
	// Set up initial chapter validation
	updateChapterMax();
}

// Update chapter input max value based on selected book
function updateChapterMax() {
	if (!book || !chapter || !verses) return;
	
	const selectedBook = book.value;
	const maxChapters = window.bibleBooks[selectedBook];
	
	if (maxChapters) {
		chapter.max = maxChapters;
		chapter.placeholder = `1-${maxChapters}`;
		verses.placeholder = `e.g. 1-10, 15, 20-25 (max: ${maxChapters})`;
	}
}

// Validate verse ranges
function validateVerseRanges(verseRanges, maxChapters) {
	if (!verseRanges || !verseRanges.trim()) {
		return { valid: false, error: 'Please enter verse ranges' };
	}
	
	const ranges = verseRanges.split(',').map(range => range.trim()).filter(Boolean);
	const validRanges = [];
	const invalidRanges = [];
	
	for (const range of ranges) {
		if (range.includes('-')) {
			// Range like "1-10"
			const [start, end] = range.split('-').map(v => parseInt(v.trim()));
			if (isNaN(start) || isNaN(end) || start < 1 || end > maxChapters || start > end) {
				invalidRanges.push(range);
			} else {
				validRanges.push({ start, end, type: 'range' });
			}
		} else {
			// Single verse like "15"
			const verse = parseInt(range);
			if (isNaN(verse) || verse < 1 || verse > maxChapters) {
				invalidRanges.push(range);
			} else {
				validRanges.push({ start: verse, end: verse, type: 'single' });
			}
		}
	}
	
	if (invalidRanges.length > 0) {
		return {
			valid: false,
			error: `Invalid verse ranges: ${invalidRanges.join(', ')}. Valid range: 1-${maxChapters}`
		};
	}
	
	return { valid: true, validRanges };
}

// Select all verses for the current chapter
function selectAllVersesForChapter() {
	if (!book || !chapter || !verses) return;
	
	const selectedBook = book.value;
	const chapterNum = parseInt(chapter.value);
	const maxChapters = window.bibleBooks[selectedBook];
	
	if (!maxChapters) {
		alert('Please select a valid book');
		return;
	}
	
	if (isNaN(chapterNum) || chapterNum < 1 || chapterNum > maxChapters) {
		alert('Please enter a valid chapter number');
		return;
	}
	
	// Set verses to "1-[maxChapters]" for the selected chapter
	verses.value = `1-${maxChapters}`;
}

// Validate Bible reference before submitting
async function validateBibleReference() {
	const selectedBook = book.value;
	const chapterNum = parseInt(chapter.value);
	const verseRanges = verses.value.trim();
	
	if (!selectedBook) {
		alert('Please select a book');
		return false;
	}
	
	if (isNaN(chapterNum) || chapterNum < 1) {
		alert('Please enter a valid chapter number');
		return false;
	}
	
	// Get max chapters for the selected book
	const maxChapters = window.bibleBooks[selectedBook];
	if (!maxChapters) {
		alert('Please select a valid book');
		return false;
	}
	
	// Validate chapter number
	if (chapterNum > maxChapters) {
		alert(`Chapter ${chapterNum} is invalid for ${selectedBook}. Valid range: 1-${maxChapters}`);
		return false;
	}
	
	// Validate verse ranges
	const verseValidation = validateVerseRanges(verseRanges, maxChapters);
	if (!verseValidation.valid) {
		alert(`Verse Validation Error: ${verseValidation.error}`);
		return false;
	}
	
	return true;
}

async function refreshOutputs() {
	try {
		const res = await authenticatedFetch('/api/outputs');
		if (!res) return; // Redirect happened
		
		const data = await res.json();
		outputsList.innerHTML = '';
		for (const f of data.files || []) {
			const row = document.createElement('div');
			row.className = 'flex items-center gap-3';
			const a = document.createElement('a');
			a.href = f.url;
			a.textContent = f.name;
			a.className = 'text-indigo-300 hover:underline';
			const renameBtn = document.createElement('button');
			renameBtn.textContent = 'Rename';
			renameBtn.className = 'px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600';
			renameBtn.onclick = async () => {
				const newName = prompt('New name:', f.name);
				if (!newName || newName === f.name) return;
				const renameRes = await authenticatedFetch('/api/outputs/rename', { 
					method: 'POST', 
					headers: { 'Content-Type': 'application/json' }, 
					body: JSON.stringify({ oldName: f.name, newName }) 
				});
				if (!renameRes) return; // Redirect happened
				refreshOutputs();
			};
			const delBtn = document.createElement('button');
			delBtn.textContent = 'Delete';
			delBtn.className = 'px-2 py-1 text-xs rounded bg-red-700 hover:bg-red-600';
			delBtn.onclick = async () => {
				if (!confirm('Delete ' + f.name + '?')) return;
				const deleteRes = await authenticatedFetch('/api/outputs/delete', { 
					method: 'POST', 
					headers: { 'Content-Type': 'application/json' }, 
					body: JSON.stringify({ name: f.name }) 
				});
				if (!deleteRes) return; // Redirect happened
				refreshOutputs();
			};
			row.append(a, renameBtn, delBtn);
			outputsList.appendChild(row);
		}
	} catch (e) {
		if (handleUnauthorizedError(e)) return; // Redirect happened
		outputsList.textContent = 'Failed to load outputs';
	}
}

async function pollQueueStatus() {
	try {
		const res = await authenticatedFetch('/api/queue/status');
		if (!res) return; // Redirect happened
		
		const data = await res.json();
		queueStatus.textContent = `Queue: ${data.pending} pending${data.processing ? ' (processing)' : ''}`;
	} catch (error) {
		if (handleUnauthorizedError(error)) return; // Redirect happened
		// Silently ignore other errors for queue status
	}
}

function listenToProgress(jobId) {
	const ev = new EventSource(`/api/progress/${jobId}`);
	ev.onmessage = (e) => {
		const data = JSON.parse(e.data);
		if (data.status === 'progress') {
			bibleProgress.textContent = `Processing chunk ${data.chunk}/${data.total}...`;
		} else if (data.status === 'completed') {
			bibleProgress.innerHTML = `✅ Complete! <a href="${data.output}" class="text-indigo-300 hover:underline">Download</a>`;
			bibleTtsBtn.disabled = false;
			bibleTtsBtn.textContent = 'Create Audio';
			// Refresh outputs list to show new file
			refreshOutputs();
		} else if (data.status === 'error') {
			let troubleshootingHtml = '';
			if (data.troubleshooting && data.troubleshooting.length > 0) {
				troubleshootingHtml = `
					<div class="mt-3 p-3 bg-yellow-900/20 border border-yellow-700 rounded">
						<strong class="text-yellow-400">Troubleshooting Steps:</strong>
						<ul class="mt-2 list-disc list-inside text-sm">
							${data.troubleshooting.map(step => `<li>${step}</li>`).join('')}
						</ul>
					</div>
				`;
			}
			
			bibleProgress.innerHTML = `
				<div class="text-red-400">❌ Error: ${data.error}</div>
				${troubleshootingHtml}
			`;
			bibleTtsBtn.disabled = false;
			bibleTtsBtn.textContent = 'Create Audio';
		}
	};
	return ev;
}

function setupEventListeners() {
	// Book selection change
	book?.addEventListener('change', updateChapterMax);
	
	// Chapter selection change
	chapter?.addEventListener('change', updateChapterMax);
	
	// Select all verses button
	selectAllVerses?.addEventListener('click', selectAllVersesForChapter);

	bibleFetchBtn?.addEventListener('click', async () => {
		// Validate before fetching
		if (!(await validateBibleReference())) {
			return;
		}
		
		bibleProgress.textContent = 'Fetching...';
		try {
			const res = await authenticatedFetch('/api/bible/fetch', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					translation: translation.value,
					book: book.value,
					chapter: Number(chapter.value || 1),
					verseRanges: verses.value,
					excludeNumbers: excludeNumbers.checked,
					excludeFootnotes: excludeFootnotes.checked
				})
			});
			if (!res) return; // Redirect happened
			
			const data = await res.json();
			if (data.error) throw new Error(data.error);
			bibleProgress.textContent = data.text || '';
		} catch (e) {
			if (handleUnauthorizedError(e)) return; // Redirect happened
			bibleProgress.textContent = 'Error: ' + e.message;
		}
	});

	bibleTtsBtn?.addEventListener('click', async () => {
		// Validate before creating audio
		if (!(await validateBibleReference())) {
			return;
		}
		
		const user = getActiveUser();
		const voiceModelId = voiceModel.value;
		const format = 'mp3';
		const sentencesPerChunk = Number(sentencesPerChunkBible.value || 3);
		
		if (!voiceModelId) {
			bibleProgress.textContent = 'Please select a voice model';
			return;
		}
		
		bibleTtsBtn.disabled = true;
		bibleTtsBtn.textContent = 'Creating Audio...';
		bibleProgress.textContent = 'Starting Bible audio creation...';
		
		try {
			const res = await authenticatedFetch('/api/jobs/bible', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					user, voiceModelId, format, sentencesPerChunk,
					translation: translation.value,
					book: book.value,
					chapter: Number(chapter.value || 1),
					verseRanges: verses.value,
					excludeNumbers: excludeNumbers.checked,
					excludeFootnotes: excludeFootnotes.checked
				})
			});
			
			if (!res) return; // Redirect happened
			
			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.error || 'Failed to start Bible audio creation');
			}
			
			const { id } = await res.json();
			listenToProgress(id);
		} catch (error) {
			if (handleUnauthorizedError(error)) return; // Redirect happened
			
			bibleProgress.innerHTML = `
				<div class="text-red-400">❌ Error: ${error.message}</div>
				<div class="mt-3 p-3 bg-yellow-900/20 border border-yellow-700 rounded">
					<strong class="text-yellow-400">Troubleshooting Steps:</strong>
					<ul class="mt-2 list-disc list-inside text-sm">
						<li>Check your Fish.Audio API key configuration</li>
						<li>Ensure your voice model is valid</li>
						<li>Verify your Bible reference is correct</li>
						<li>Try again in a few moments</li>
					</ul>
				</div>
			`;
			bibleTtsBtn.disabled = false;
			bibleTtsBtn.textContent = 'Create Audio';
		}
	});

	refreshOutputsBtn?.addEventListener('click', refreshOutputs);
}

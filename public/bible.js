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
let voiceModel, translation, book, chapter, verses, chapterRange, selectAllChapters, selectAllVerses, selectEntireChapter;
let excludeNumbers, excludeFootnotes, sentencesPerChunkBible, audioFormat;
let previewBtn, createAudioBtn, progress, userWelcome, outputsList, refreshOutputsBtn, queueStatus;
let chaptersSelection, versesSelection;

// Bible books with their chapter counts
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

async function init() {
	console.log('[Bible] Initializing Bible page...');
	
	// Initialize DOM elements
	voiceModel = document.getElementById('voiceModel');
	translation = document.getElementById('translation');
	book = document.getElementById('book');
	chapter = document.getElementById('chapter');
	verses = document.getElementById('verses');
	chapterRange = document.getElementById('chapterRange');
	selectAllChapters = document.getElementById('selectAllChapters');
	selectAllVerses = document.getElementById('selectAllVerses');
	selectEntireChapter = document.getElementById('selectEntireChapter');
	excludeNumbers = document.getElementById('excludeNumbers');
	excludeFootnotes = document.getElementById('excludeFootnotes');
	sentencesPerChunkBible = document.getElementById('sentencesPerChunkBible');
	audioFormat = document.getElementById('audioFormat');
	previewBtn = document.getElementById('previewBtn');
	createAudioBtn = document.getElementById('createAudioBtn');
	progress = document.getElementById('progress');
	userWelcome = document.getElementById('userWelcome');
	outputsList = document.getElementById('outputsList');
	refreshOutputsBtn = document.getElementById('refreshOutputsBtn');
	queueStatus = document.getElementById('queueStatus');
	chaptersSelection = document.getElementById('chaptersSelection');
	versesSelection = document.getElementById('versesSelection');
	
	console.log('[Bible] DOM elements initialized');
	
	// Update the login/logout link
	await updateAuthLink();
	
	// Set welcome message
	const currentUser = getActiveUser();
	if (userWelcome) {
		userWelcome.textContent = `Welcome, ${currentUser}! Ready to create Bible audio.`;
	}
	
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

// Update chapter input max value based on selected book
function updateChapterMax() {
	if (!book || !chapter) return;
	
	const selectedBook = book.value;
	const maxChapters = bibleBooks[selectedBook];
	
	if (maxChapters) {
		chapter.max = maxChapters;
		chapter.placeholder = `1-${maxChapters}`;
	}
}

// Validate chapter ranges
function validateChapterRanges(chapterRanges, maxChapters) {
	if (!chapterRanges || !chapterRanges.trim()) {
		return { valid: false, error: 'Please enter chapter ranges' };
	}
	
	const ranges = chapterRanges.split(',').map(range => range.trim()).filter(Boolean);
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
			// Single chapter like "15"
			const chapter = parseInt(range);
			if (isNaN(chapter) || chapter < 1 || chapter > maxChapters) {
				invalidRanges.push(range);
			} else {
				validRanges.push({ start: chapter, end: chapter, type: 'single' });
			}
		}
	}
	
	if (invalidRanges.length > 0) {
		return {
			valid: false,
			error: `Invalid chapter ranges: ${invalidRanges.join(', ')}. Valid range: 1-${maxChapters}`
		};
	}
	
	return { valid: true, validRanges };
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

// Get current selection type
function getSelectionType() {
	const radioButtons = document.querySelectorAll('input[name="selectionType"]');
	for (const radio of radioButtons) {
		if (radio.checked) {
			return radio.value;
		}
	}
	return 'verses'; // default
}

// Validate current selection
function validateSelection() {
	const selectedBook = book.value;
	const selectionType = getSelectionType();
	
	if (!selectedBook) {
		alert('Please select a book');
		return false;
	}
	
	const maxChapters = bibleBooks[selectedBook];
	if (!maxChapters) {
		alert('Please select a valid book');
		return false;
	}
	
	switch (selectionType) {
		case 'entireBook':
			// No additional validation needed
			return true;
			
		case 'chapters':
			const chapterRanges = chapterRange.value.trim();
			const chapterValidation = validateChapterRanges(chapterRanges, maxChapters);
			if (!chapterValidation.valid) {
				alert(`Chapter Validation Error: ${chapterValidation.error}`);
				return false;
			}
			return true;
			
		case 'verses':
			const chapterNum = parseInt(chapter.value);
			const verseRanges = verses.value.trim();
			
			if (isNaN(chapterNum) || chapterNum < 1 || chapterNum > maxChapters) {
				alert(`Chapter ${chapterNum} is invalid for ${selectedBook}. Valid range: 1-${maxChapters}`);
				return false;
			}
			
			const verseValidation = validateVerseRanges(verseRanges, maxChapters);
			if (!verseValidation.valid) {
				alert(`Verse Validation Error: ${verseValidation.error}`);
				return false;
			}
			return true;
			
		default:
			alert('Please select a valid transcription type');
			return false;
	}
}

// Build request payload based on selection type
function buildRequestPayload() {
	const selectedBook = book.value;
	const selectionType = getSelectionType();
	
	const basePayload = {
		translation: translation.value,
		book: selectedBook,
		excludeNumbers: excludeNumbers.checked,
		excludeFootnotes: excludeFootnotes.checked
	};
	
	switch (selectionType) {
		case 'entireBook':
			return {
				...basePayload,
				type: 'entireBook'
			};
			
		case 'chapters':
			return {
				...basePayload,
				type: 'chapters',
				chapterRanges: chapterRange.value.trim()
			};
			
		case 'verses':
			return {
				...basePayload,
				type: 'verses',
				chapter: parseInt(chapter.value),
				verseRanges: verses.value.trim()
			};
	}
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
			progress.textContent = `Processing chunk ${data.chunk}/${data.total}...`;
		} else if (data.status === 'completed') {
			progress.innerHTML = `✅ Complete! <a href="${data.output}" class="text-indigo-300 hover:underline">Download</a>`;
			createAudioBtn.disabled = false;
			createAudioBtn.textContent = 'Create Audio';
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
			
			progress.innerHTML = `
				<div class="text-red-400">❌ Error: ${data.error}</div>
				${troubleshootingHtml}
			`;
			createAudioBtn.disabled = false;
			createAudioBtn.textContent = 'Create Audio';
		}
	};
	return ev;
}

function setupEventListeners() {
	// Book selection change
	book?.addEventListener('change', updateChapterMax);
	
	// Chapter selection change
	chapter?.addEventListener('change', updateChapterMax);
	
	// Selection type radio buttons
	document.querySelectorAll('input[name="selectionType"]').forEach(radio => {
		radio.addEventListener('change', handleSelectionTypeChange);
	});
	
	// Select all chapters button
	selectAllChapters?.addEventListener('click', () => {
		const selectedBook = book.value;
		const maxChapters = bibleBooks[selectedBook];
		if (maxChapters) {
			chapterRange.value = `1-${maxChapters}`;
		}
	});
	
	// Select all verses button
	selectAllVerses?.addEventListener('click', () => {
		const selectedBook = book.value;
		const maxChapters = bibleBooks[selectedBook];
		if (maxChapters) {
			verses.value = `1-${maxChapters}`;
		}
	});
	
	// Select entire chapter button
	selectEntireChapter?.addEventListener('click', () => {
		const selectedBook = book.value;
		const maxChapters = bibleBooks[selectedBook];
		if (maxChapters) {
			verses.value = `1-${maxChapters}`;
		}
	});

	// Preview button
	previewBtn?.addEventListener('click', async () => {
		if (!validateSelection()) return;
		
		progress.textContent = 'Fetching preview...';
		try {
			const payload = buildRequestPayload();
			const res = await authenticatedFetch('/api/bible/fetch', {
				method: 'POST', 
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!res) return; // Redirect happened
			
			const data = await res.json();
			if (data.error) throw new Error(data.error);
			
			progress.innerHTML = `
				<div class="mt-4 p-4 bg-slate-800 rounded border border-slate-600">
					<h4 class="font-medium text-indigo-300 mb-2">Preview:</h4>
					<div class="text-sm text-slate-300 max-h-64 overflow-y-auto">${data.text || 'No text returned'}</div>
				</div>
			`;
		} catch (e) {
			if (handleUnauthorizedError(e)) return; // Redirect happened
			progress.textContent = 'Error: ' + e.message;
		}
	});

	// Create audio button
	createAudioBtn?.addEventListener('click', async () => {
		if (!validateSelection()) return;
		
		const user = getActiveUser();
		const voiceModelId = voiceModel.value;
		const format = audioFormat.value;
		const sentencesPerChunk = Number(sentencesPerChunkBible.value || 3);
		
		if (!voiceModelId) {
			progress.textContent = 'Please select a voice model';
			return;
		}
		
		createAudioBtn.disabled = true;
		createAudioBtn.textContent = 'Creating Audio...';
		progress.textContent = 'Starting Bible audio creation...';
		
		try {
			const payload = buildRequestPayload();
			const res = await authenticatedFetch('/api/jobs/bible', {
				method: 'POST', 
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					user, 
					voiceModelId, 
					format, 
					sentencesPerChunk,
					...payload
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
			
			progress.innerHTML = `
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
			createAudioBtn.disabled = false;
			createAudioBtn.textContent = 'Create Audio';
		}
	});

	refreshOutputsBtn?.addEventListener('click', refreshOutputs);
}

function handleSelectionTypeChange() {
	const selectionType = getSelectionType();
	
	// Hide all selection divs
	chaptersSelection.classList.add('hidden');
	versesSelection.classList.add('hidden');
	
	// Show the appropriate selection div
	switch (selectionType) {
		case 'entireBook':
			// No additional selection needed
			break;
		case 'chapters':
			chaptersSelection.classList.remove('hidden');
			break;
		case 'verses':
			versesSelection.classList.remove('hidden');
			break;
	}
}

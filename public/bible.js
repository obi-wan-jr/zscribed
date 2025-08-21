import { getActiveUser, updateAuthLink, requireAuth, authenticatedFetch, handleUnauthorizedError } from './common.js';

// Simple global variables
let currentMode = null; // 'book', 'chapters', or 'verses'
let bibleBooks = {
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

// Initialize when page loads
console.log('Bible.js: Starting authentication check...');

// Set up radio button listeners immediately (don't wait for auth)
console.log('Bible.js: Setting up radio button listeners immediately...');
setupRadioButtonListeners();

requireAuth().then(isAuthenticated => {
	console.log('Bible.js: Authentication result:', isAuthenticated);
	if (!isAuthenticated) {
		console.log('Bible.js: Not authenticated, returning early');
		return;
	}
	console.log('Bible.js: Authenticated, calling init()');
	init();
}).catch(error => {
	console.error('Bible.js: Authentication error:', error);
});

async function init() {
	console.log('Bible.js: init() called');
	
	// Set welcome message
	const userWelcome = document.getElementById('userWelcome');
	const currentUser = getActiveUser();
	console.log('Bible.js: Current user:', currentUser);
	if (userWelcome) {
		userWelcome.textContent = `Welcome, ${currentUser}! Ready to create Bible audio.`;
		console.log('Bible.js: Welcome message set');
	} else {
		console.error('Bible.js: userWelcome element not found');
	}
	
	// Update auth link
	await updateAuthLink();
	
	// Load voice models
	await loadVoiceModels();
	
	// Set up event listeners
	setupEventListeners();
	
	// Load outputs
	refreshOutputs();
	
	// Start polling queue status
	setInterval(pollQueueStatus, 2000);
}

async function loadVoiceModels() {
	try {
		const res = await authenticatedFetch('/api/models');
		if (!res) return;
		
		const data = await res.json();
		const voiceModel = document.getElementById('voiceModel');
		voiceModel.innerHTML = '';
		
		for (const m of data.voiceModels || []) {
			const opt = document.createElement('option');
			opt.value = m.id;
			opt.textContent = m.name || m.id;
			voiceModel.appendChild(opt);
		}
	} catch (error) {
		if (handleUnauthorizedError(error)) return;
		console.error('Failed to load voice models:', error);
	}
}

function setupRadioButtonListeners() {
	console.log('Bible.js: setupRadioButtonListeners() called');
	
	// Radio button listeners for mode selection
	const radioButtons = document.querySelectorAll('input[name="transcribeMode"]');
	console.log('Bible.js: Found radio buttons:', radioButtons.length);
	radioButtons.forEach((radio, index) => {
		console.log(`Bible.js: Radio button ${index}:`, radio.value, radio);
		radio.addEventListener('change', (e) => {
			if (e.target.checked) {
				console.log('Bible.js: Radio changed to:', e.target.value);
				selectMode(e.target.value);
			}
		});
	});
	
	// Initialize visual state based on any pre-checked radio button
	const checkedRadio = document.querySelector('input[name="transcribeMode"]:checked');
	if (checkedRadio) {
		console.log('Bible.js: Found pre-checked radio:', checkedRadio.value);
		selectMode(checkedRadio.value);
	}
}

function setupEventListeners() {
	console.log('Bible.js: setupEventListeners() called');
	
	// Action buttons (always visible)
	const previewBtn = document.getElementById('previewBtn');
	if (previewBtn) previewBtn.addEventListener('click', previewText);
	
	const createAudioBtn = document.getElementById('createAudioBtn');
	if (createAudioBtn) createAudioBtn.addEventListener('click', createAudio);
	
	const refreshBtn = document.getElementById('refreshBtn');
	if (refreshBtn) refreshBtn.addEventListener('click', refreshOutputs);
}

function setupChapterEventListeners() {
	console.log('Bible.js: setupChapterEventListeners() called');
	
	// Verse loading and selection
	const loadVersesBtn = document.getElementById('loadVersesBtn');
	if (loadVersesBtn) {
		console.log('Bible.js: loadVersesBtn found and listener added');
		loadVersesBtn.addEventListener('click', loadVerses);
	} else {
		console.error('Bible.js: loadVersesBtn not found');
	}
	
	const selectAllVersesBtn = document.getElementById('selectAllVersesBtn');
	if (selectAllVersesBtn) {
		selectAllVersesBtn.addEventListener('click', () => {
			document.querySelectorAll('#versesCheckboxList input[type="checkbox"]').forEach(cb => cb.checked = true);
		});
	}
	
	const deselectAllVersesBtn = document.getElementById('deselectAllVersesBtn');
	if (deselectAllVersesBtn) {
		deselectAllVersesBtn.addEventListener('click', () => {
			document.querySelectorAll('#versesCheckboxList input[type="checkbox"]').forEach(cb => cb.checked = false);
		});
	}
}

function setupChaptersEventListeners() {
	console.log('Bible.js: setupChaptersEventListeners() called');
	
	// Quick action buttons
	const allChaptersBtn = document.getElementById('allChaptersBtn');
	if (allChaptersBtn) {
		console.log('Bible.js: allChaptersBtn found and listener added');
		allChaptersBtn.addEventListener('click', () => {
			const book = document.getElementById('book').value;
			const maxChapters = bibleBooks[book];
			if (maxChapters) {
				document.getElementById('chapters').value = `1-${maxChapters}`;
			}
		});
	} else {
		console.error('Bible.js: allChaptersBtn not found');
	}
}

function selectMode(mode) {
	console.log('Bible.js: selectMode called with mode:', mode);
	currentMode = mode;
	
	// Force sync: uncheck all radio buttons first, then check the correct one
	const radioButtons = document.querySelectorAll('input[name="transcribeMode"]');
	radioButtons.forEach(radio => {
		radio.checked = (radio.value === mode);
	});
	
	// Reset all visual states - be more explicit about which elements to reset
	const bookOption = document.getElementById('bookOption');
	const chapterOption = document.getElementById('chapterOption');
	const chaptersOption = document.getElementById('chaptersOption');
	
	console.log('Bible.js: Found elements - bookOption:', bookOption?.id, 'chapterOption:', chapterOption?.id, 'chaptersOption:', chaptersOption?.id);
	
	// Reset all options explicitly
	[bookOption, chapterOption, chaptersOption].forEach(option => {
		if (option && option.classList) {
			console.log('Bible.js: Resetting option:', option.id);
			// Reset border and background
			option.classList.remove('border-indigo-500', 'bg-indigo-900/20');
			option.classList.add('border-slate-600');
			
			// Reset radio indicator
			const radioIndicator = option.querySelector('.w-3.h-3');
			if (radioIndicator) {
				radioIndicator.classList.remove('bg-indigo-500');
				radioIndicator.classList.add('bg-transparent');
			}
			
			// Reset border color of radio circle
			const radioCircle = option.querySelector('.w-8.h-8');
			if (radioCircle) {
				radioCircle.classList.remove('border-indigo-500');
				radioCircle.classList.add('border-slate-400');
			}
		}
	});
	
	// Update selected option - be more explicit
	let selectedOption = null;
	if (mode === 'book') {
		selectedOption = bookOption;
	} else if (mode === 'chapter') {
		selectedOption = chapterOption;
	} else if (mode === 'chapters') {
		selectedOption = chaptersOption;
	}
	
	console.log('Bible.js: Selected option for mode', mode, ':', selectedOption?.id);
	
	if (selectedOption) {
		console.log('Bible.js: Applying selected state to:', selectedOption.id);
		// Set selected visual state
		selectedOption.classList.add('border-indigo-500', 'bg-indigo-900/20');
		selectedOption.classList.remove('border-slate-600');
		
		// Update radio indicator
		const selectedRadioIndicator = selectedOption.querySelector('.w-3.h-3');
		if (selectedRadioIndicator) {
			selectedRadioIndicator.classList.add('bg-indigo-500');
			selectedRadioIndicator.classList.remove('bg-transparent');
		}
		
		// Update border color of radio circle
		const selectedRadioCircle = selectedOption.querySelector('.w-8.h-8');
		if (selectedRadioCircle) {
			selectedRadioCircle.classList.add('border-indigo-500');
			selectedRadioCircle.classList.remove('border-slate-400');
		}
	} else {
		console.error('Bible.js: No selected option found for mode:', mode);
	}
	
	// Verify state is correct
	console.log('Bible.js: Final state verification:');
	console.log('  - currentMode:', currentMode);
	console.log('  - checked radio:', document.querySelector('input[name="transcribeMode"]:checked')?.value);
	console.log('  - selected option has border-indigo-500:', selectedOption?.classList.contains('border-indigo-500'));
	
	// Hide all input sections
	const chapterInput = document.getElementById('chapterInput');
	if (chapterInput) chapterInput.classList.add('hidden');
	
	const chaptersInput = document.getElementById('chaptersInput');
	if (chaptersInput) chaptersInput.classList.add('hidden');
	
	const versesCheckboxContainer = document.getElementById('versesCheckboxContainer');
	if (versesCheckboxContainer) versesCheckboxContainer.classList.add('hidden');
	
	// Show relevant input section
	if (mode === 'chapter') {
		const chapterInput = document.getElementById('chapterInput');
		if (chapterInput) {
			chapterInput.classList.remove('hidden');
			console.log('Chapter input shown');
			// Set up event listeners for chapter-specific elements
			setupChapterEventListeners();
		} else {
			console.error('chapterInput element not found');
		}
	} else if (mode === 'chapters') {
		const chaptersInput = document.getElementById('chaptersInput');
		if (chaptersInput) {
			chaptersInput.classList.remove('hidden');
			console.log('Chapters input shown');
			// Set up event listeners for chapters-specific elements
			setupChaptersEventListeners();
		} else {
			console.error('chaptersInput element not found');
		}
	}
	
	updateStatus(`Selected: ${mode === 'book' ? 'Entire Book' : mode === 'chapter' ? 'Specific Chapter' : 'Multiple Chapters'}`);
}

function updateStatus(message) {
	document.getElementById('status').textContent = message;
}

async function loadVerses() {
	console.log('Bible.js: loadVerses() called');
	
	const book = document.getElementById('book').value;
	const chapter = parseInt(document.getElementById('singleChapter').value);
	
	console.log('Bible.js: loadVerses - book:', book, 'chapter:', chapter);
	
	if (!book || !chapter) {
		updateStatus('Please select a book and chapter first');
		return;
	}
	
	updateStatus('Loading verses...');
	
	try {
		// Prepare the request data
		const requestData = {
			translation: 'web',
			book: book,
			chapter: chapter,
			verseRanges: '1-999', // Get all verses to count them
			excludeNumbers: false, // Keep verse numbers for counting
			excludeFootnotes: true
		};
		
		console.log('Bible.js: loadVerses request data:', requestData);
		
		// Fetch the chapter data to get verse count
		const res = await authenticatedFetch('/api/bible/fetch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(requestData)
		});
		
		if (!res) return;
		
		const result = await res.json();
		console.log('Bible.js: loadVerses response:', result);
		if (result.error) throw new Error(result.error);
		
		// Parse the text to count verses (verses are numbered)
		const verseMatches = result.text.match(/\d+/g);
		let maxVerse = 1;
		if (verseMatches) {
			// Find the highest verse number
			maxVerse = Math.max(...verseMatches.map(v => parseInt(v)).filter(n => !isNaN(n)));
		}
		
		// Generate checkboxes
		const container = document.getElementById('versesCheckboxList');
		container.innerHTML = '';
		
		for (let i = 1; i <= maxVerse; i++) {
			const label = document.createElement('label');
			label.className = 'flex items-center text-sm cursor-pointer';
			label.innerHTML = `
				<input type="checkbox" value="${i}" class="mr-1 text-indigo-600 bg-transparent border-slate-400 rounded">
				<span>${i}</span>
			`;
			container.appendChild(label);
		}
		
		// Show the checkbox container
		document.getElementById('versesCheckboxContainer').classList.remove('hidden');
		updateStatus(`Loaded ${maxVerse} verses for ${book} ${chapter}`);
		
	} catch (error) {
		if (handleUnauthorizedError(error)) return;
		updateStatus(`Error loading verses: ${error.message}`);
	}
}

function validateSelection() {
	if (!currentMode) {
		updateStatus('Please select what to transcribe');
		return false;
	}
	
	const book = document.getElementById('book').value;
	if (!book) {
		updateStatus('Please select a book');
		return false;
	}
	
	const maxChapters = bibleBooks[book];
	
	if (currentMode === 'book') {
		// No additional validation needed for entire book
	} else if (currentMode === 'chapter') {
		const chapter = parseInt(document.getElementById('singleChapter').value);
		
		if (isNaN(chapter) || chapter < 1 || chapter > maxChapters) {
			updateStatus(`Invalid chapter: ${chapter}. Valid range: 1-${maxChapters}`);
			return false;
		}
		
		// Check if any verses are selected (only if verses are loaded)
		const versesCheckboxContainer = document.getElementById('versesCheckboxContainer');
		if (versesCheckboxContainer && !versesCheckboxContainer.classList.contains('hidden')) {
			const selectedVerses = document.querySelectorAll('#versesCheckboxList input[type="checkbox"]:checked');
			if (selectedVerses.length === 0) {
				updateStatus('Please select at least one verse');
				return false;
			}
		}
	} else if (currentMode === 'chapters') {
		const chapters = document.getElementById('chapters').value.trim();
		if (!chapters) {
			updateStatus('Please enter chapter numbers');
			return false;
		}
		
		// Basic validation for chapter ranges
		const ranges = chapters.split(',').map(r => r.trim());
		for (const range of ranges) {
			if (range.includes('-')) {
				const [start, end] = range.split('-').map(n => parseInt(n.trim()));
				if (isNaN(start) || isNaN(end) || start > maxChapters || end > maxChapters) {
					updateStatus(`Invalid chapter range: ${range}. Max chapters: ${maxChapters}`);
					return false;
				}
			} else {
				const chapter = parseInt(range);
				if (isNaN(chapter) || chapter > maxChapters) {
					updateStatus(`Invalid chapter: ${range}. Max chapters: ${maxChapters}`);
					return false;
				}
			}
		}
	}
	
	return true;
}

function buildRequestData() {
	const book = document.getElementById('book').value;
	const excludeNumbersElement = document.getElementById('excludeNumbers');
	const excludeFootnotesElement = document.getElementById('excludeFootnotes');
	
	console.log('Bible.js: buildRequestData - excludeNumbers element:', excludeNumbersElement);
	console.log('Bible.js: buildRequestData - excludeFootnotes element:', excludeFootnotesElement);
	
	if (!excludeNumbersElement || !excludeFootnotesElement) {
		console.error('Bible.js: Missing excludeNumbers or excludeFootnotes elements');
		return null;
	}
	
	const excludeNumbers = excludeNumbersElement.checked;
	const excludeFootnotes = excludeFootnotesElement.checked;
	
	const baseData = {
		translation: 'web',
		book: book,
		excludeNumbers: excludeNumbers,
		excludeFootnotes: excludeFootnotes
	};
	
	if (currentMode === 'book') {
		return { ...baseData, type: 'book' };
	} else if (currentMode === 'chapter') {
		// Check if verses are loaded and selected
		const versesCheckboxContainer = document.getElementById('versesCheckboxContainer');
		if (versesCheckboxContainer && !versesCheckboxContainer.classList.contains('hidden')) {
			// Get selected verses from checkboxes
			const selectedVerses = Array.from(document.querySelectorAll('#versesCheckboxList input[type="checkbox"]:checked'))
				.map(cb => parseInt(cb.value))
				.sort((a, b) => a - b);
			
			// Convert to ranges format
			const verseRanges = convertToRanges(selectedVerses);
			
			return {
				...baseData,
				type: 'verses',
				chapter: parseInt(document.getElementById('singleChapter').value),
				verseRanges: verseRanges
			};
		} else {
			// No verses selected, treat as entire chapter
			return {
				...baseData,
				type: 'verses',
				chapter: parseInt(document.getElementById('singleChapter').value),
				verseRanges: '1-999' // All verses in the chapter
			};
		}
	} else if (currentMode === 'chapters') {
		return {
			...baseData,
			type: 'chapters',
			chapters: document.getElementById('chapters').value.trim()
		};
	}
}

function convertToRanges(numbers) {
	if (numbers.length === 0) return '';
	
	const ranges = [];
	let start = numbers[0];
	let end = numbers[0];
	
	for (let i = 1; i < numbers.length; i++) {
		if (numbers[i] === end + 1) {
			end = numbers[i];
		} else {
			// Add the current range to the list
			if (start === end) {
				ranges.push(start.toString());
			} else {
				ranges.push(`${start}-${end}`);
			}
			start = numbers[i];
			end = numbers[i];
		}
	}
	
	// Add the final range
	if (start === end) {
		ranges.push(start.toString());
	} else {
		ranges.push(`${start}-${end}`);
	}
	
	return ranges.join(', ');
}

async function previewText() {
	if (!validateSelection()) return;
	
	updateStatus('Loading preview...');
	
	try {
		const data = buildRequestData();
		const res = await authenticatedFetch('/api/bible/fetch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});
		
		if (!res) return;
		
		const result = await res.json();
		if (result.error) throw new Error(result.error);
		
		// Show preview in status area
		const preview = result.text.substring(0, 500) + (result.text.length > 500 ? '...' : '');
		updateStatus(`Preview: ${preview}`);
		
	} catch (error) {
		if (handleUnauthorizedError(error)) return;
		updateStatus(`Error: ${error.message}`);
	}
}

async function createAudio() {
	if (!validateSelection()) return;
	
	const voiceModelId = document.getElementById('voiceModel').value;
	if (!voiceModelId) {
		updateStatus('Please select a voice model');
		return;
	}
	
	updateStatus('Creating audio...');
	const createBtn = document.getElementById('createAudioBtn');
	createBtn.disabled = true;
	createBtn.textContent = 'Creating...';
	
	try {
		const data = buildRequestData();
		const user = getActiveUser();
		const sentencesPerChunk = parseInt(document.getElementById('sentencesPerChunk').value) || 3;
		
		const res = await authenticatedFetch('/api/jobs/bible', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				user,
				voiceModelId,
				format: 'mp3',
				sentencesPerChunk,
				...data
			})
		});
		
		if (!res) return;
		
		if (!res.ok) {
			const errorData = await res.json();
			throw new Error(errorData.error || 'Failed to start audio creation');
		}
		
		const { id } = await res.json();
		listenToProgress(id);
		
	} catch (error) {
		if (handleUnauthorizedError(error)) return;
		updateStatus(`Error: ${error.message}`);
		createBtn.disabled = false;
		createBtn.textContent = 'Create Audio';
	}
}

function listenToProgress(jobId) {
	const ev = new EventSource(`/api/progress/${jobId}`);
	ev.onmessage = (e) => {
		const data = JSON.parse(e.data);
		if (data.status === 'progress') {
			updateStatus(`Processing chunk ${data.chunk}/${data.total}...`);
		} else if (data.status === 'completed') {
			updateStatus(`✅ Complete! Audio created successfully.`);
			document.getElementById('createAudioBtn').disabled = false;
			document.getElementById('createAudioBtn').textContent = 'Create Audio';
			refreshOutputs();
		} else if (data.status === 'error') {
			updateStatus(`❌ Error: ${data.error}`);
			document.getElementById('createAudioBtn').disabled = false;
			document.getElementById('createAudioBtn').textContent = 'Create Audio';
		}
	};
	return ev;
}

async function refreshOutputs() {
	try {
		const res = await authenticatedFetch('/api/outputs');
		if (!res) return;
		
		const data = await res.json();
		const outputsList = document.getElementById('outputsList');
		outputsList.innerHTML = '';
		
		for (const file of data.files || []) {
			const div = document.createElement('div');
			div.className = 'flex items-center justify-between p-3 bg-[#0a0f1a] rounded border border-slate-600';
			div.innerHTML = `
				<a href="${file.url}" class="text-indigo-300 hover:underline font-medium">${file.name}</a>
				<div class="flex gap-2">
					<button class="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded" onclick="renameFile('${file.name}')">Rename</button>
					<button class="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 rounded" onclick="deleteFile('${file.name}')">Delete</button>
				</div>
			`;
			outputsList.appendChild(div);
		}
	} catch (e) {
		if (handleUnauthorizedError(e)) return;
		console.error('Failed to load outputs:', e);
	}
}

async function pollQueueStatus() {
	try {
		const res = await authenticatedFetch('/api/queue/status');
		if (!res) return;
		
		const data = await res.json();
		document.getElementById('queueStatus').textContent = 
			`Queue: ${data.pending} pending${data.processing ? ' (processing)' : ''}`;
	} catch (error) {
		if (handleUnauthorizedError(error)) return;
	}
}

// Global functions for file operations
window.renameFile = async (oldName) => {
	const newName = prompt('New name:', oldName);
	if (!newName || newName === oldName) return;
	
	try {
		const res = await authenticatedFetch('/api/outputs/rename', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ oldName, newName })
		});
		if (res) refreshOutputs();
	} catch (e) {
		if (handleUnauthorizedError(e)) return;
		alert('Failed to rename file');
	}
};

window.deleteFile = async (name) => {
	if (!confirm(`Delete ${name}?`)) return;
	
	try {
		const res = await authenticatedFetch('/api/outputs/delete', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name })
		});
		if (res) refreshOutputs();
	} catch (e) {
		if (handleUnauthorizedError(e)) return;
		alert('Failed to delete file');
	}
};
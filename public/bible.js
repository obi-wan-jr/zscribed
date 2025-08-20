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
requireAuth().then(isAuthenticated => {
	if (!isAuthenticated) return;
	init();
});

async function init() {
	// Set welcome message
	const userWelcome = document.getElementById('userWelcome');
	const currentUser = getActiveUser();
	if (userWelcome) {
		userWelcome.textContent = `Welcome, ${currentUser}! Ready to create Bible audio.`;
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

function setupEventListeners() {
	// Mode selection buttons
	document.getElementById('entireBookOption').querySelector('button').addEventListener('click', () => {
		selectMode('book');
	});
	
	document.getElementById('chaptersOption').querySelector('button').addEventListener('click', () => {
		selectMode('chapters');
	});
	
	document.getElementById('versesOption').querySelector('button').addEventListener('click', () => {
		selectMode('verses');
	});
	
	// Quick action buttons
	document.getElementById('allChaptersBtn').addEventListener('click', () => {
		const book = document.getElementById('book').value;
		const maxChapters = bibleBooks[book];
		if (maxChapters) {
			document.getElementById('chapters').value = `1-${maxChapters}`;
		}
	});
	
	document.getElementById('allVersesBtn').addEventListener('click', () => {
		document.getElementById('verses').value = '1-999';
	});
	
	document.getElementById('wholeChapterBtn').addEventListener('click', () => {
		document.getElementById('verses').value = '1-999';
	});
	
	// Action buttons
	document.getElementById('previewBtn').addEventListener('click', previewText);
	document.getElementById('createAudioBtn').addEventListener('click', createAudio);
	document.getElementById('refreshBtn').addEventListener('click', refreshOutputs);
}

function selectMode(mode) {
	currentMode = mode;
	
	// Reset all visual states
	document.querySelectorAll('[id$="Option"]').forEach(option => {
		option.classList.remove('border-indigo-500');
		option.classList.add('border-slate-600');
		option.querySelector('button').textContent = 'Select';
		option.querySelector('button').classList.remove('bg-green-600');
		option.querySelector('button').classList.add('bg-indigo-600');
	});
	
	// Hide all input sections
	document.getElementById('chaptersInput').classList.add('hidden');
	document.getElementById('versesInput').classList.add('hidden');
	
	// Update selected option
	const selectedOption = document.getElementById(mode === 'book' ? 'entireBookOption' : 
		mode === 'chapters' ? 'chaptersOption' : 'versesOption');
	selectedOption.classList.add('border-indigo-500');
	selectedOption.classList.remove('border-slate-600');
	selectedOption.querySelector('button').textContent = 'Selected';
	selectedOption.querySelector('button').classList.add('bg-green-600');
	selectedOption.querySelector('button').classList.remove('bg-indigo-600');
	
	// Show relevant input section
	if (mode === 'chapters') {
		document.getElementById('chaptersInput').classList.remove('hidden');
	} else if (mode === 'verses') {
		document.getElementById('versesInput').classList.remove('hidden');
	}
	
	updateStatus(`Selected: ${mode === 'book' ? 'Entire Book' : mode === 'chapters' ? 'Specific Chapters' : 'Specific Verses'}`);
}

function updateStatus(message) {
	document.getElementById('status').textContent = message;
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
	
	if (currentMode === 'chapters') {
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
	} else if (currentMode === 'verses') {
		const chapter = parseInt(document.getElementById('chapter').value);
		const verses = document.getElementById('verses').value.trim();
		
		if (isNaN(chapter) || chapter < 1 || chapter > maxChapters) {
			updateStatus(`Invalid chapter: ${chapter}. Valid range: 1-${maxChapters}`);
			return false;
		}
		
		if (!verses) {
			updateStatus('Please enter verse numbers');
			return false;
		}
	}
	
	return true;
}

function buildRequestData() {
	const book = document.getElementById('book').value;
	const excludeNumbers = document.getElementById('excludeNumbers').checked;
	const excludeFootnotes = document.getElementById('excludeFootnotes').checked;
	
	const baseData = {
		translation: 'web',
		book: book,
		excludeNumbers: excludeNumbers,
		excludeFootnotes: excludeFootnotes
	};
	
	if (currentMode === 'book') {
		return { ...baseData, type: 'book' };
	} else if (currentMode === 'chapters') {
		return {
			...baseData,
			type: 'chapters',
			chapters: document.getElementById('chapters').value.trim()
		};
	} else if (currentMode === 'verses') {
		return {
			...baseData,
			type: 'verses',
			chapter: parseInt(document.getElementById('chapter').value),
			verseRanges: document.getElementById('verses').value.trim()
		};
	}
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
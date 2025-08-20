import { fetchMeta, getActiveUser, setActiveUser, updateAuthLink, requireAuth, authenticatedFetch, handleUnauthorizedError } from './common.js';

// Global error handler
window.addEventListener('error', (e) => {
	console.error('[Bible] JavaScript error:', e.error);
});

// Wait for DOM to be ready, then load Bible books
document.addEventListener('DOMContentLoaded', () => {
	console.log('[Bible] DOM loaded, loading Bible books immediately...');
	loadBibleBooks();
});

// Check authentication for protected features
console.log('[Bible] Checking authentication...');
requireAuth().then(isAuthenticated => {
	console.log('[Bible] Authentication result:', isAuthenticated);
	if (!isAuthenticated) return; // Will redirect to login
	
	// Initialize the page
	init();
});

// DOM elements
let voiceModel, translation, book, chapter, verses, excludeNumbers, excludeFootnotes, sentencesPerChunkBible;
let bibleFetchBtn, bibleTtsBtn, bibleProgress, userWelcome, outputsList, refreshOutputsBtn, queueStatus;

async function init() {
	console.log('[Bible] Initializing Bible page...');
	
	// Initialize DOM elements
	voiceModel = document.getElementById('voiceModel');
	translation = document.getElementById('translation');
	book = document.getElementById('book');
	chapter = document.getElementById('chapter');
	verses = document.getElementById('verses');
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
	
	// Bible books are already loaded (public endpoint)
	
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

async function loadBibleBooks() {
	console.log('[Bible] loadBibleBooks function called');
	
	// Check if DOM elements are available
	if (!document.getElementById('book')) {
		console.error('[Bible] Book element not found in DOM!');
		return;
	}
	
	try {
		console.log('[Bible] Loading Bible books...');
		
		const res = await fetch('/api/bible/books');
		if (!res.ok) {
			throw new Error(`HTTP ${res.status}: ${res.statusText}`);
		}
		
		const data = await res.json();
		const books = data.books || [];
		console.log('[Bible] Received books:', books.length);
		
		if (!book) {
			console.error('[Bible] Book element not found!');
			return;
		}
		
		// Clear existing options
		book.innerHTML = '';
		
		// Group books by testament
		const oldTestament = books.filter(b => b.testament === 'old');
		const newTestament = books.filter(b => b.testament === 'new');
		
		// Add Old Testament optgroup
		if (oldTestament.length > 0) {
			const oldGroup = document.createElement('optgroup');
			oldGroup.label = 'Old Testament';
			
			for (const bookInfo of oldTestament) {
				const opt = document.createElement('option');
				opt.value = bookInfo.name;
				opt.textContent = `${bookInfo.name} (${bookInfo.chapters} chapters)`;
				opt.dataset.chapters = bookInfo.chapters;
				oldGroup.appendChild(opt);
			}
			
			book.appendChild(oldGroup);
		}
		
		// Add New Testament optgroup
		if (newTestament.length > 0) {
			const newGroup = document.createElement('optgroup');
			newGroup.label = 'New Testament';
			
			for (const bookInfo of newTestament) {
				const opt = document.createElement('option');
				opt.value = bookInfo.name;
				opt.textContent = `${bookInfo.name} (${bookInfo.chapters} chapters)`;
				opt.dataset.chapters = bookInfo.chapters;
				newGroup.appendChild(opt);
			}
			
			book.appendChild(newGroup);
		}
		
		// Set default to John
		book.value = 'John';
		
		// Update chapter max value
		updateChapterMax();
		
		console.log('[Bible] Books loaded successfully');
		
	} catch (error) {
		console.error('Failed to load Bible books:', error);
		if (book) {
			book.innerHTML = '<option value="">Failed to load books</option>';
		}
	}
}

// Update chapter input max value based on selected book
function updateChapterMax() {
	if (!book || !chapter || !verses) return;
	
	const selectedOption = book.options[book.selectedIndex];
	if (selectedOption && selectedOption.dataset.chapters) {
		const maxChapters = parseInt(selectedOption.dataset.chapters);
		chapter.max = maxChapters;
		chapter.placeholder = `1-${maxChapters}`;
		verses.placeholder = `e.g. 1-10, 15, 20-25 (max: ${maxChapters})`;
	}
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
	
	try {
		const res = await authenticatedFetch('/api/bible/validate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				book: selectedBook,
				chapter: chapterNum,
				verses: verseRanges
			})
		});
		
		if (!res) return false; // Redirect happened
		
		const data = await res.json();
		
		if (!data.valid) {
			alert(`Validation Error: ${data.error}`);
			return false;
		}
		
		return true;
		
	} catch (error) {
		if (handleUnauthorizedError(error)) return false; // Redirect happened
		
		console.error('Validation error:', error);
		alert('Failed to validate Bible reference');
		return false;
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

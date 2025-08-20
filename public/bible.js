import { fetchMeta, getActiveUser, setActiveUser, updateAuthLink, requireAuth, authenticatedFetch, handleUnauthorizedError } from './common.js';

// Check authentication first
requireAuth().then(isAuthenticated => {
	if (!isAuthenticated) return; // Will redirect to login
	
	// Initialize the page
	init();
});

// DOM elements - will be initialized in init()
let voiceModel, translation, book, bookSearch, bookSelectBtn, chapter, verses, excludeNumbers, excludeFootnotes, sentencesPerChunkBible;
let bibleFetchBtn, bibleTtsBtn, bibleProgress, userWelcome, outputsList, refreshOutputsBtn, queueStatus;
let bookModal, bookSearchInput, bookGrid, closeBookModal;

// Store all books data
let allBooks = [];

async function init() {
	console.log('[Bible] Initializing Bible page...');
	
	// Initialize DOM elements
	voiceModel = document.getElementById('voiceModel');
	translation = document.getElementById('translation');
	book = document.getElementById('book');
	bookSearch = document.getElementById('bookSearch');
	bookSelectBtn = document.getElementById('bookSelectBtn');
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
	bookModal = document.getElementById('bookModal');
	bookSearchInput = document.getElementById('bookSearchInput');
	bookGrid = document.getElementById('bookGrid');
	closeBookModal = document.getElementById('closeBookModal');
	
	console.log('[Bible] DOM elements initialized:', {
		book: !!book,
		bookSearch: !!bookSearch,
		bookModal: !!bookModal,
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
	
	// Load Bible books (public endpoint)
	console.log('[Bible] About to load Bible books...');
	await loadBibleBooks();
	
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
	try {
		console.log('[Bible] Starting to load Bible books...');
		
		const res = await fetch('/api/bible/books');
		if (!res.ok) {
			throw new Error(`HTTP ${res.status}: ${res.statusText}`);
		}
		
		const data = await res.json();
		allBooks = data.books || [];
		console.log('[Bible] Received books:', allBooks.length);
		
		if (!bookGrid) {
			console.error('[Bible] Book grid element is null!');
			return;
		}
		
		// Populate the book grid
		populateBookGrid(allBooks);
		
		// Set default book to John
		selectBook('John');
		
	} catch (error) {
		console.error('Failed to load Bible books:', error);
		if (bookSearch) {
			bookSearch.placeholder = 'Failed to load books';
		}
	}
}

function populateBookGrid(books) {
	if (!bookGrid) return;
	
	bookGrid.innerHTML = '';
	
	// Group books by testament
	const oldTestament = books.filter(b => b.testament === 'old');
	const newTestament = books.filter(b => b.testament === 'new');
	
	// Add Old Testament section
	if (oldTestament.length > 0) {
		const oldHeader = document.createElement('div');
		oldHeader.className = 'col-span-full text-sm font-medium text-indigo-300 mt-4 mb-2';
		oldHeader.textContent = 'Old Testament';
		bookGrid.appendChild(oldHeader);
		
		oldTestament.forEach(bookInfo => {
			const bookBtn = createBookButton(bookInfo);
			bookGrid.appendChild(bookBtn);
		});
	}
	
	// Add New Testament section
	if (newTestament.length > 0) {
		const newHeader = document.createElement('div');
		newHeader.className = 'col-span-full text-sm font-medium text-indigo-300 mt-4 mb-2';
		newHeader.textContent = 'New Testament';
		bookGrid.appendChild(newHeader);
		
		newTestament.forEach(bookInfo => {
			const bookBtn = createBookButton(bookInfo);
			bookGrid.appendChild(bookBtn);
		});
	}
}

function createBookButton(bookInfo) {
	const btn = document.createElement('button');
	btn.className = 'text-left p-3 bg-[#0b1020] border border-slate-600 rounded hover:bg-slate-700 hover:border-slate-500 transition-colors';
	btn.innerHTML = `
		<div class="font-medium text-slate-200">${bookInfo.name}</div>
		<div class="text-xs text-slate-400">${bookInfo.chapters} chapters</div>
	`;
	btn.onclick = () => {
		selectBook(bookInfo.name);
		closeBookModalFunc();
	};
	return btn;
}

function selectBook(bookName) {
	if (!book || !bookSearch) return;
	
	book.value = bookName;
	bookSearch.value = bookName;
	
	// Clear the modal search input
	if (bookSearchInput) {
		bookSearchInput.value = '';
	}
	
	// Find the book info to update chapter max
	const bookInfo = allBooks.find(b => b.name === bookName);
	if (bookInfo && chapter) {
		chapter.max = bookInfo.chapters;
		chapter.placeholder = `1-${bookInfo.chapters}`;
		if (verses) {
			verses.placeholder = `e.g. 1-10, 15, 20-25 (max: ${bookInfo.chapters})`;
		}
	}
}

function openBookModal() {
	if (!bookModal) return;
	bookModal.classList.remove('hidden');
	
	// Sync search terms between main field and modal
	if (bookSearchInput && bookSearch) {
		bookSearchInput.value = bookSearch.value;
		bookSearchInput.focus();
		// Filter books based on current search term
		filterBooks(bookSearch.value);
	}
}

function closeBookModalFunc() {
	if (!bookModal) return;
	bookModal.classList.add('hidden');
}

function filterBooks(searchTerm) {
	if (!bookGrid) return;
	
	const filteredBooks = allBooks.filter(book => 
		book.name.toLowerCase().includes(searchTerm.toLowerCase())
	);
	
	populateBookGrid(filteredBooks);
}

// Update chapter input max value based on selected book
function updateChapterMax() {
	if (!book || !chapter || !verses) return;
	
	const bookInfo = allBooks.find(b => b.name === book.value);
	if (bookInfo) {
		chapter.max = bookInfo.chapters;
		chapter.placeholder = `1-${bookInfo.chapters}`;
		verses.placeholder = `e.g. 1-10, 15, 20-25 (max: ${bookInfo.chapters})`;
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
	// Book selection modal
	bookSelectBtn?.addEventListener('click', openBookModal);
	closeBookModal?.addEventListener('click', closeBookModalFunc);
	
	// Close modal when clicking outside
	bookModal?.addEventListener('click', (e) => {
		if (e.target === bookModal) {
			closeBookModalFunc();
		}
	});
	
	// Book search functionality - both in modal and main field
	bookSearchInput?.addEventListener('input', (e) => {
		filterBooks(e.target.value);
	});
	
	// Main book search field - typing opens modal and filters
	bookSearch?.addEventListener('input', (e) => {
		const searchTerm = e.target.value;
		
		// If modal is not open, open it
		if (bookModal && bookModal.classList.contains('hidden')) {
			openBookModal();
		}
		
		// Filter books in modal
		filterBooks(searchTerm);
	});
	
	// Focus on main book search field opens modal
	bookSearch?.addEventListener('focus', () => {
		if (bookModal && bookModal.classList.contains('hidden')) {
			openBookModal();
		}
	});
	
	// Chapter input change
	chapter?.addEventListener('change', updateChapterMax);

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

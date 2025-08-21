import { getActiveUser, updateAuthLink, requireAuth, authenticatedFetch, handleUnauthorizedError } from './common.js';

// Bible audio creation functionality
let currentMode = 'book';
let currentUser = '';

// Initialize when page loads
requireAuth().then(isAuthenticated => {
	if (isAuthenticated) {
		init();
	} else {
		window.location.href = '/login.html';
	}
});

function init() {
	// Set up event listeners
	setupEventListeners();
	
	// Load available models
	loadModels();
	
	// Load outputs
	refreshOutputs();
	
	// Set initial state
	selectMode('book');
}

function setupEventListeners() {
	// Radio button listeners for mode selection
	const radioButtons = document.querySelectorAll('input[name="transcribeMode"]');
	radioButtons.forEach(radio => {
		radio.addEventListener('change', (e) => {
			selectMode(e.target.value);
		});
	});
	
	// All chapters button - Note: We'll add the event listener when the chapters mode is activated
	// This ensures the chaptersRange element is visible and accessible
	
	// Preview button
	const previewBtn = document.getElementById('previewBtn');
	if (previewBtn) {
		previewBtn.addEventListener('click', previewText);
	}
	
	// Create audio button
	const createAudioBtn = document.getElementById('createAudioBtn');
	if (createAudioBtn) {
		createAudioBtn.addEventListener('click', createAudio);
	}
	
	// Refresh button
	const refreshBtn = document.getElementById('refreshBtn');
	if (refreshBtn) {
		refreshBtn.addEventListener('click', refreshOutputs);
	}
}

function selectMode(mode) {
	currentMode = mode;
	
	// Update radio button states
	const radioButtons = document.querySelectorAll('input[name="transcribeMode"]');
	radioButtons.forEach(radio => {
		radio.checked = (radio.value === mode);
	});
	
	// Reset all visual states
	const bookOption = document.getElementById('bookOption');
	const chaptersOption = document.getElementById('chaptersOption');
	
	[bookOption, chaptersOption].forEach(option => {
		if (option) {
			option.classList.remove('border-indigo-500', 'bg-indigo-900/20');
			option.classList.add('border-slate-600');
			
			const radioIndicator = option.querySelector('.w-3.h-3');
			if (radioIndicator) {
				radioIndicator.classList.remove('bg-indigo-500');
				radioIndicator.classList.add('bg-transparent');
			}
			
			const radioCircle = option.querySelector('.w-8.h-8');
			if (radioCircle) {
				radioCircle.classList.remove('border-indigo-500');
				radioCircle.classList.add('border-slate-400');
			}
		}
	});
	
	// Update selected option
	let selectedOption = null;
	if (mode === 'book') {
		selectedOption = bookOption;
	} else if (mode === 'chapters') {
		selectedOption = chaptersOption;
	}
	
	if (selectedOption) {
		selectedOption.classList.add('border-indigo-500', 'bg-indigo-900/20');
		selectedOption.classList.remove('border-slate-600');
		
		const selectedRadioIndicator = selectedOption.querySelector('.w-3.h-3');
		if (selectedRadioIndicator) {
			selectedRadioIndicator.classList.add('bg-indigo-500');
			selectedRadioIndicator.classList.remove('bg-transparent');
		}
		
		const selectedRadioCircle = selectedOption.querySelector('.w-8.h-8');
		if (selectedRadioCircle) {
			selectedRadioCircle.classList.add('border-indigo-500');
			selectedRadioCircle.classList.remove('border-slate-400');
		}
	}
	
	// Hide all input sections
	const chaptersInput = document.getElementById('chaptersInput');
	if (chaptersInput) chaptersInput.classList.add('hidden');
	
	// Show relevant input section
	if (mode === 'chapters') {
		if (chaptersInput) {
			chaptersInput.classList.remove('hidden');
			// Set up the "All Chapters" button event listener now that the input is visible
			setupAllChaptersButton();
		}
	}
	
	updateStatus(`Selected: ${mode === 'book' ? 'Entire Book' : 'Multiple Chapters'}`);
}

function setupAllChaptersButton() {
	const allChaptersBtn = document.getElementById('allChaptersBtn');
	if (!allChaptersBtn) {
		console.error('All chapters button not found');
		return;
	}
	
	// Remove any existing event listeners to prevent duplicates
	const newBtn = allChaptersBtn.cloneNode(true);
	allChaptersBtn.parentNode.replaceChild(newBtn, allChaptersBtn);
	
	// Add the event listener
	newBtn.addEventListener('click', () => {
		const bookSelect = document.getElementById('book');
		if (!bookSelect) {
			console.error('Book select element not found');
			updateStatus('Error: Book selection not available');
			return;
		}
		
		const selectedBook = bookSelect.value;
		if (!selectedBook) {
			updateStatus('Please select a book first');
			return;
		}
		
		const maxChapters = getMaxChapters(selectedBook);
		
		// Add debugging and use multiple attempts to access the element
		console.log('Setting chapter range for book:', selectedBook, 'maxChapters:', maxChapters);
		
		const setChapterRange = () => {
			const chaptersRangeInput = document.getElementById('chaptersRange');
			console.log('Looking for chaptersRange element:', chaptersRangeInput);
			
			if (chaptersRangeInput) {
				console.log('Found chaptersRange element, setting value');
				chaptersRangeInput.value = `1-${maxChapters}`;
				updateStatus(`Set chapter range to 1-${maxChapters} for ${selectedBook}`);
				return true;
			} else {
				console.error('Chapters range input not found, element is null');
				return false;
			}
		};
		
		// Try immediately first
		if (!setChapterRange()) {
			// If that fails, try after DOM update
			requestAnimationFrame(() => {
				if (!setChapterRange()) {
					// If that fails, try with a small delay
					setTimeout(() => {
						if (!setChapterRange()) {
							updateStatus('Error: Chapter range input not available');
						}
					}, 50);
				}
			});
		}
	});
}

async function loadModels() {
	try {
		const response = await authenticatedFetch('/api/models');
		const data = await response.json();
		
		console.log('API response for models:', data);
		
		const modelSelect = document.getElementById('voiceModel');
		if (modelSelect) {
			modelSelect.innerHTML = '<option value="">Select voice model</option>';
			
			// Handle different response formats
			let models = [];
			if (Array.isArray(data)) {
				models = data;
			} else if (data.models && Array.isArray(data.models)) {
				models = data.models;
			} else if (data.voiceModels && Array.isArray(data.voiceModels)) {
				models = data.voiceModels;
			} else {
				console.error('Expected array of models, got:', typeof data, data);
				updateStatus('No voice models available');
				return;
			}
			
			console.log('Processing models:', models);
			
			models.forEach(model => {
				const option = document.createElement('option');
				option.value = model.id || model.value || model;
				option.textContent = model.name || model.label || model.id || model;
				modelSelect.appendChild(option);
			});
			
			console.log('Loaded', models.length, 'voice models');
		}
	} catch (error) {
		console.error('Failed to load models:', error);
		updateStatus('Failed to load voice models');
	}
}

function getMaxChapters(book) {
	const chapterCounts = {
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
	return chapterCounts[book] || 1;
}

function validateSelection() {
	const book = document.getElementById('book').value;
	const voiceModel = document.getElementById('voiceModel').value;
	
	if (!book) {
		updateStatus('Please select a book');
		return false;
	}
	
	if (!voiceModel) {
		updateStatus('Please select a voice model');
		return false;
	}
	
	if (currentMode === 'chapters') {
		const chaptersRangeElement = document.getElementById('chaptersRange');
		if (!chaptersRangeElement) {
			console.error('Chapters range element not found');
			updateStatus('Error: Chapter range input not available');
			return false;
		}
		const chaptersRange = chaptersRangeElement.value;
		if (!chaptersRange.trim()) {
			updateStatus('Please enter chapter range');
			return false;
		}
	}
	
	return true;
}

function convertToRanges(input) {
	// Simple range conversion - can be enhanced later
	return input.trim();
}

async function createAudio() {
	if (!validateSelection()) {
		return;
	}
	
	const book = document.getElementById('book').value;
	const voiceModel = document.getElementById('voiceModel').value;
	
	let requestBody = {
		book: book,
		voiceModel: voiceModel
	};
	
	if (currentMode === 'chapters') {
		const chaptersRangeElement = document.getElementById('chaptersRange');
		if (chaptersRangeElement) {
			requestBody.chapters = convertToRanges(chaptersRangeElement.value);
		} else {
			console.error('Chapters range element not found in createAudio');
			updateStatus('Error: Chapter range input not available');
			return;
		}
	}
	
	try {
		updateStatus('Creating audio...');
		
		const response = await authenticatedFetch('/api/jobs/bible', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(requestBody)
		});
		
		if (response.ok) {
			const result = await response.json();
			updateStatus(`Audio creation started! Job ID: ${result.jobId}`);
		} else {
			const error = await response.text();
			updateStatus(`Error: ${error}`);
		}
	} catch (error) {
		console.error('Failed to create audio:', error);
		updateStatus('Failed to create audio. Please try again.');
	}
}

function updateStatus(message) {
	const statusElement = document.getElementById('status');
	if (statusElement) {
		statusElement.textContent = message;
	}
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
		const chaptersRangeElement = document.getElementById('chaptersRange');
		if (chaptersRangeElement) {
			return {
				...baseData,
				type: 'chapters',
				chapters: chaptersRangeElement.value.trim()
			};
		}
	}
	
	return baseData;
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

async function refreshOutputs() {
	try {
		const res = await authenticatedFetch('/api/outputs');
		if (!res) return;
		
		const data = await res.json();
		const outputsList = document.getElementById('outputsList');
		if (!outputsList) return;
		
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
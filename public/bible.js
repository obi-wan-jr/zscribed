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
	
	// All chapters button
	const allChaptersBtn = document.getElementById('allChaptersBtn');
	if (allChaptersBtn) {
		allChaptersBtn.addEventListener('click', () => {
			const bookSelect = document.getElementById('book');
			if (!bookSelect) {
				console.error('Book select element not found');
				return;
			}
			
			const selectedBook = bookSelect.value;
			const maxChapters = getMaxChapters(selectedBook);
			const chaptersRangeInput = document.getElementById('chaptersRange');
			if (chaptersRangeInput) {
				chaptersRangeInput.value = `1-${maxChapters}`;
			} else {
				console.error('Chapters range input not found');
			}
		});
	}
	
	// Create audio button
	const createAudioBtn = document.getElementById('createAudioBtn');
	if (createAudioBtn) {
		createAudioBtn.addEventListener('click', createAudio);
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
		}
	}
	
	updateStatus(`Selected: ${mode === 'book' ? 'Entire Book' : 'Multiple Chapters'}`);
}

async function loadModels() {
	try {
		const response = await authenticatedFetch('/api/models');
		const models = await response.json();
		
		const modelSelect = document.getElementById('voiceModel');
		if (modelSelect) {
			modelSelect.innerHTML = '<option value="">Select voice model</option>';
			models.forEach(model => {
				const option = document.createElement('option');
				option.value = model.id;
				option.textContent = model.name;
				modelSelect.appendChild(option);
			});
		}
	} catch (error) {
		console.error('Failed to load models:', error);
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
// Bible transcription functionality
let currentMode = 'book';

// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);

async function init() {
	// Set up event listeners
	setupEventListeners();
	
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
	
	// All chapters button
	const allChaptersBtn = document.getElementById('allChaptersBtn');
	if (allChaptersBtn) {
		allChaptersBtn.addEventListener('click', () => {
			const book = document.getElementById('book').value;
			const maxChapters = getMaxChapters(book);
			document.getElementById('chaptersRange').value = `1-${maxChapters}`;
		});
	}
	
	// Preview button
	const previewBtn = document.getElementById('previewBtn');
	if (previewBtn) {
		previewBtn.addEventListener('click', previewText);
	}
	
	// Preview section controls
	const collapsePreviewBtn = document.getElementById('collapsePreviewBtn');
	const closePreviewBtn = document.getElementById('closePreviewBtn');
	const previewSection = document.getElementById('previewSection');
	
	if (collapsePreviewBtn) {
		collapsePreviewBtn.addEventListener('click', () => {
			const previewText = document.getElementById('previewText');
			if (previewText.style.maxHeight === '0px' || previewText.style.maxHeight === '') {
				previewText.style.maxHeight = '160px';
				collapsePreviewBtn.textContent = 'Collapse';
			} else {
				previewText.style.maxHeight = '0px';
				collapsePreviewBtn.textContent = 'Expand';
			}
		});
	}
	
	if (closePreviewBtn) {
		closePreviewBtn.addEventListener('click', () => {
			previewSection.classList.add('hidden');
		});
	}
	
	// Create transcription button
	const createTranscriptionBtn = document.getElementById('createTranscriptionBtn');
	if (createTranscriptionBtn) {
		createTranscriptionBtn.addEventListener('click', createTranscription);
	}
	
	// Refresh outputs button
	const refreshBtn = document.getElementById('refreshBtn');
	if (refreshBtn) {
		refreshBtn.addEventListener('click', refreshOutputs);
	}
	
	// TTS and video generation options
	const generateAudioCheckbox = document.getElementById('generateAudio');
	const generateVideoCheckbox = document.getElementById('generateVideo');
	
	if (generateAudioCheckbox) {
		generateAudioCheckbox.addEventListener('change', toggleAudioOptions);
	}
	
	if (generateVideoCheckbox) {
		generateVideoCheckbox.addEventListener('change', toggleVideoOptions);
	}
	
	// Load voice models
	loadVoiceModels();
}

function selectMode(mode) {
	currentMode = mode;
	
	// Update radio button states
	document.querySelectorAll('input[name="transcribeMode"]').forEach(radio => {
		radio.checked = radio.value === mode;
	});
	
	// Update visual states
	document.getElementById('bookOption').classList.toggle('border-indigo-500', mode === 'book');
	document.getElementById('bookOption').classList.toggle('bg-indigo-900/20', mode === 'book');
	document.getElementById('chaptersOption').classList.toggle('border-indigo-500', mode === 'chapters');
	document.getElementById('chaptersOption').classList.toggle('bg-indigo-900/20', mode === 'chapters');
	
	// Show/hide chapters input
	const chaptersInput = document.getElementById('chaptersInput');
	if (mode === 'chapters') {
		chaptersInput.classList.remove('hidden');
	} else {
		chaptersInput.classList.add('hidden');
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

async function previewText() {
	const payload = getFormPayload();
	
	if (!payload) {
		showStatus('Please fill in all required fields', 'error');
		return;
	}
	
	try {
		showStatus('Loading preview...', 'info');
		
		const response = await fetch('/api/bible/fetch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});
		
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch Bible text');
		}
		
		const data = await response.json();
		
		// Show preview
		document.getElementById('previewText').textContent = data.text;
		document.getElementById('previewSection').classList.remove('hidden');
		showStatus('Preview loaded successfully', 'success');
		
	} catch (error) {
		console.error('Preview error:', error);
		showStatus(`Preview failed: ${error.message}`, 'error');
	}
}

async function createTranscription() {
	const payload = getFormPayload();
	
	if (!payload) {
		showStatus('Please fill in all required fields', 'error');
		return;
	}
	
	try {
		showStatus('Creating transcription...', 'info');
		showProgress();
		
		const response = await fetch('/api/jobs/bible', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});
		
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to create transcription');
		}
		
		const result = await response.json();
		
		if (result.success) {
			showStatus(`Transcription created successfully: ${result.filename}`, 'success');
			hideProgress();
			refreshOutputs();
		} else {
			throw new Error(result.error || 'Transcription failed');
		}
		
	} catch (error) {
		console.error('Transcription error:', error);
		showStatus(`Transcription failed: ${error.message}`, 'error');
		hideProgress();
	}
}

function getFormPayload() {
	const book = document.getElementById('book').value;
	const translation = document.getElementById('translation').value;
	const excludeNumbers = document.getElementById('excludeNumbers').checked;
	const excludeFootnotes = document.getElementById('excludeFootnotes').checked;
	
	// TTS and video options
	const generateAudio = document.getElementById('generateAudio').checked;
	const generateVideo = document.getElementById('generateVideo').checked;
	const voiceModelId = generateAudio ? document.getElementById('voiceModel').value : null;
	const videoResolution = generateVideo ? document.getElementById('videoResolution').value : '1080p';
	
	if (!book) {
		showStatus('Please select a Bible book', 'error');
		return null;
	}
	
	// Validation
	if (generateAudio && !voiceModelId) {
		showStatus('Please select a voice model for audio generation', 'error');
		return null;
	}
	
	if (generateVideo && !generateAudio) {
		showStatus('Video generation requires audio generation to be enabled', 'error');
		return null;
	}
	
	let payload = {
		book,
		translation,
		excludeNumbers,
		excludeFootnotes,
		type: currentMode,
		generateAudio,
		voiceModelId,
		generateVideo,
		videoSettings: generateVideo ? {
			resolution: videoResolution,
			backgroundType: 'color',
			outputFormat: 'mp4'
		} : {}
	};
	
	if (currentMode === 'chapters') {
		const chapters = document.getElementById('chaptersRange').value.trim();
		if (!chapters) {
			showStatus('Please enter chapter ranges', 'error');
			return null;
		}
		payload.chapters = chapters;
	} else if (currentMode === 'book') {
		// No additional fields needed for entire book
	} else {
		// Single chapter mode
		const chapter = 1; // Default to chapter 1 for now
		payload.chapter = chapter;
	}
	
	return payload;
}

function showProgress() {
	document.getElementById('progressContainer').classList.remove('hidden');
	document.getElementById('progressStatus').textContent = 'Processing...';
	document.getElementById('progressBar').style.width = '50%';
}

function hideProgress() {
	document.getElementById('progressContainer').classList.add('hidden');
	document.getElementById('progressBar').style.width = '0%';
}

function showStatus(message, type = 'info') {
	const statusEl = document.getElementById('status');
	statusEl.textContent = message;
	statusEl.className = `text-sm ${type === 'error' ? 'text-red-400' : type === 'success' ? 'text-green-400' : 'text-slate-300'}`;
	
	// Auto-hide success messages after 5 seconds
	if (type === 'success') {
		setTimeout(() => {
			if (statusEl.textContent === message) {
				statusEl.textContent = '';
			}
		}, 5000);
	}
}

async function refreshOutputs() {
	try {
		const response = await fetch('/api/outputs');
		if (!response.ok) {
			throw new Error('Failed to fetch outputs');
		}
		
		const data = await response.json();
		displayOutputs(data.files);
		
	} catch (error) {
		console.error('Error refreshing outputs:', error);
		showStatus('Failed to refresh outputs', 'error');
	}
}

function displayOutputs(files) {
	const outputsList = document.getElementById('outputsList');
	
	if (files.length === 0) {
		outputsList.innerHTML = '<p class="text-slate-400 text-sm">No transcription files found</p>';
		return;
	}
	
	outputsList.innerHTML = files.map(file => `
		<div class="flex items-center justify-between p-3 border border-slate-600 rounded bg-[#0b1020]">
			<div class="flex-1">
				<div class="font-medium text-white">${file.name}</div>
				<div class="text-sm text-slate-400">Transcription file</div>
			</div>
			<div class="flex items-center space-x-2">
				<a href="${file.url}" download class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded">Download</a>
				<button onclick="deleteOutput('${file.name}')" class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded">Delete</button>
			</div>
		</div>
	`).join('');
}

async function deleteOutput(filename) {
	if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
		return;
	}
	
	try {
		const response = await fetch('/api/outputs/delete', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: filename })
		});
		
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to delete file');
		}
		
		showStatus(`File "${filename}" deleted successfully`, 'success');
		refreshOutputs();
		
	} catch (error) {
		console.error('Delete error:', error);
		showStatus(`Failed to delete file: ${error.message}`, 'error');
	}
}

// TTS and Video Generation Functions
function toggleAudioOptions() {
	const generateAudio = document.getElementById('generateAudio').checked;
	const audioOptions = document.getElementById('audioOptions');
	
	if (generateAudio) {
		audioOptions.classList.remove('hidden');
	} else {
		audioOptions.classList.add('hidden');
		// Uncheck video if audio is disabled
		document.getElementById('generateVideo').checked = false;
		toggleVideoOptions();
	}
}

function toggleVideoOptions() {
	const generateVideo = document.getElementById('generateVideo').checked;
	const videoOptions = document.getElementById('videoOptions');
	
	if (generateVideo) {
		videoOptions.classList.remove('hidden');
	} else {
		videoOptions.classList.add('hidden');
	}
}

async function loadVoiceModels() {
	try {
		// For now, use hardcoded models - in production this would come from config
		const models = [
			{ id: '2939fcf1e9224fe9ac0839f1e2b26c50', name: 'Default Voice' },
			{ id: 'custom-voice-1', name: 'Custom Voice 1' },
			{ id: 'custom-voice-2', name: 'Custom Voice 2' }
		];

		const select = document.getElementById('voiceModel');
		if (select) {
			select.innerHTML = '<option value="">Select voice model...</option>';
			
			models.forEach(model => {
				const option = document.createElement('option');
				option.value = model.id;
				option.textContent = model.name;
				select.appendChild(option);
			});
		}
	} catch (error) {
		console.error('Failed to load voice models:', error);
	}
}
import { getActiveUser, updateAuthLink, requireAuth, authenticatedFetch, handleUnauthorizedError, fetchUserJobs, displayActiveJobs } from './common.js';

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
	
	// Load jobs
	refreshJobs();
	
	// Set initial state
	selectMode('book');
	
	// Auto-refresh jobs every 10 seconds
	setInterval(refreshJobs, 10000);
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
	
	// Create audio button
	const createAudioBtn = document.getElementById('createAudioBtn');
	if (createAudioBtn) {
		createAudioBtn.addEventListener('click', createAudio);
	}
	
	// Create video button
	const createVideoBtn = document.getElementById('createVideoBtn');
	if (createVideoBtn) {
		createVideoBtn.addEventListener('click', createVideo);
	}
	
	// Video creation options
	const createVideoCheckbox = document.getElementById('createVideo');
	if (createVideoCheckbox) {
		createVideoCheckbox.addEventListener('change', toggleVideoOptions);
	}
	
	// Background type selector
	const backgroundType = document.getElementById('backgroundType');
	if (backgroundType) {
		backgroundType.addEventListener('change', toggleBackgroundUpload);
	}
	
	// Refresh button
	const refreshBtn = document.getElementById('refreshBtn');
	if (refreshBtn) {
		refreshBtn.addEventListener('click', refreshOutputs);
	}
	
	// Refresh jobs button
	const refreshJobsBtn = document.getElementById('refreshJobsBtn');
	if (refreshJobsBtn) {
		refreshJobsBtn.addEventListener('click', refreshJobs);
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
		
		const setChapterRange = () => {
			const chaptersRangeInput = document.getElementById('chaptersRange');
			
			if (chaptersRangeInput) {
				chaptersRangeInput.value = `1-${maxChapters}`;
				updateStatus(`Set chapter range to 1-${maxChapters} for ${selectedBook}`);
				return true;
			} else {
				console.error('Chapters range input not found');
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
		if (!response) return; // Redirect happened
		
		const data = await response.json();
		
		const modelSelect = document.getElementById('voiceModel');
		if (modelSelect) {
			modelSelect.innerHTML = '<option value="">Select voice model</option>';
			
			for (const m of data.voiceModels || []) {
				const option = document.createElement('option');
				option.value = m.id;
				option.textContent = m.name || m.id;
				modelSelect.appendChild(option);
			}
		}
	} catch (error) {
		if (handleUnauthorizedError(error)) return; // Redirect happened
		
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
	
	const voiceModel = document.getElementById('voiceModel').value;
	
	// Use the same data structure as preview, but add voice model
	let requestBody = {
		...buildRequestData(),
		voiceModelId: voiceModel
	};
	
	try {
		// Disable the create button during processing
		const createAudioBtn = document.getElementById('createAudioBtn');
		if (createAudioBtn) {
			createAudioBtn.disabled = true;
			createAudioBtn.textContent = 'Creating...';
		}
		
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
			updateStatus(`Audio creation started! Job ID: ${result.id}`);
			startProgressTracking(result.id);
		} else {
			const error = await response.text();
			updateStatus(`Error: ${error}`);
		}
	} catch (error) {
		console.error('Failed to create audio:', error);
		updateStatus('Failed to create audio. Please try again.');
	} finally {
		// Re-enable the create button
		const createAudioBtn = document.getElementById('createAudioBtn');
		if (createAudioBtn) {
			createAudioBtn.disabled = false;
			createAudioBtn.textContent = 'Create Audio';
		}
	}
}

function updateStatus(message) {
	const statusElement = document.getElementById('status');
	if (statusElement) {
		statusElement.textContent = message;
	}
}

function showProgress() {
	const progressContainer = document.getElementById('progressContainer');
	if (progressContainer) {
		progressContainer.classList.remove('hidden');
	}
}

function hideProgress() {
	const progressContainer = document.getElementById('progressContainer');
	if (progressContainer) {
		progressContainer.classList.add('hidden');
	}
}

function updateProgressStatus(status) {
	const progressStatus = document.getElementById('progressStatus');
	if (progressStatus) {
		progressStatus.textContent = status;
	}
}

function updateProgressBar(percentage) {
	const progressBar = document.getElementById('progressBar');
	if (progressBar) {
		progressBar.style.width = `${percentage}%`;
	}
}

function addProgressLog(message) {
	const progressLog = document.getElementById('progressLog');
	if (progressLog) {
		const timestamp = new Date().toLocaleTimeString();
		const logEntry = document.createElement('div');
		logEntry.className = 'flex justify-between';
		logEntry.innerHTML = `
			<span>${message}</span>
			<span class="text-slate-500">${timestamp}</span>
		`;
		progressLog.appendChild(logEntry);
		
		// Auto-scroll to bottom
		progressLog.scrollTop = progressLog.scrollHeight;
		
		// Keep only last 20 entries
		while (progressLog.children.length > 20) {
			progressLog.removeChild(progressLog.firstChild);
		}
	}
}

function startProgressTracking(jobId) {
	showProgress();
	updateProgressStatus('Starting audio creation...');
	updateProgressBar(0);
	addProgressLog(`Job ${jobId} started`);
	
	// Fallback progress indicator (in case server doesn't provide detailed progress)
	let fallbackProgress = 0;
	const fallbackInterval = setInterval(() => {
		fallbackProgress += Math.random() * 5; // Random progress increment
		if (fallbackProgress < 90) { // Don't go to 100% until we get completion
			updateProgressBar(fallbackProgress);
			updateProgressStatus('Processing audio...');
		}
	}, 2000);
	
	// Start polling for progress updates
	const eventSource = new EventSource(`/api/progress/${jobId}`);
	
	eventSource.onmessage = (event) => {
		try {
			const data = JSON.parse(event.data);
			
			if (data.status === 'progress') {
				const percentage = Math.round((data.chunk / data.total) * 100);
				updateProgressStatus(`Processing chunk ${data.chunk}/${data.total}...`);
				updateProgressBar(percentage);
				addProgressLog(`Processing chunk ${data.chunk} of ${data.total}`);
			} else if (data.status === 'completed') {
				clearInterval(fallbackInterval);
				updateProgressStatus('Completed!');
				updateProgressBar(100);
				addProgressLog(`✅ Audio creation completed successfully`);
				addProgressLog(`📁 File: ${data.output}`);
				eventSource.close();
				
				// Refresh outputs immediately and hide progress after a delay
				refreshOutputs(); // Refresh the outputs list immediately
				setTimeout(() => {
					hideProgress();
					updateStatus(`✅ Audio creation completed!`);
				}, 3000);
			} else if (data.status === 'error') {
				clearInterval(fallbackInterval);
				updateProgressStatus('Error occurred');
				updateProgressBar(0);
				addProgressLog(`❌ Error: ${data.error}`);
				eventSource.close();
				
				// Hide progress after a delay
				setTimeout(() => {
					hideProgress();
					updateStatus(`❌ Error: ${data.error}`);
				}, 5000);
			}
		} catch (error) {
			console.error('Error parsing progress data:', error);
			addProgressLog(`⚠️ Error parsing progress update`);
		}
	};
	
	eventSource.onerror = (error) => {
		console.error('Progress tracking error:', error);
		clearInterval(fallbackInterval);
		addProgressLog(`⚠️ Progress tracking connection lost`);
		eventSource.close();
		
		// Fallback: hide progress after a delay
		setTimeout(() => {
			hideProgress();
		}, 10000);
	};
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
		
		// Show preview section with full text
		const previewSection = document.getElementById('previewSection');
		const previewText = document.getElementById('previewText');
		if (previewSection && previewText) {
			previewSection.classList.remove('hidden');
			previewText.textContent = result.text;
			updateStatus(`Bible text loaded (${result.text.length} characters)`);
		}
		
	} catch (error) {
		if (handleUnauthorizedError(error)) return;
		updateStatus(`Error: ${error.message}`);
	}
}

async function refreshOutputs() {
	try {
		const res = await authenticatedFetch('/api/outputs');
		if (!res) return; // Redirect happened
		
		const data = await res.json();
		const outputsList = document.getElementById('outputsList');
		if (!outputsList) return;
		
		outputsList.innerHTML = '';
		for (const f of data.files || []) {
			const div = document.createElement('div');
			div.className = 'p-4 bg-[#0a0f1a] rounded border border-slate-600 space-y-3';
			
			// File info header
			const headerDiv = document.createElement('div');
			headerDiv.className = 'flex items-center justify-between';
			headerDiv.innerHTML = `
				<div class="flex items-center space-x-3">
					<div class="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
						<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
						</svg>
					</div>
					<div>
						<div class="text-indigo-300 font-medium">${f.name.replace(/\.[^/.]+$/, '')}</div>
						<div class="text-xs text-slate-400">Click play to listen</div>
					</div>
				</div>
				<div class="flex gap-2">
					<button class="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 rounded" onclick="deleteFile('${f.name}')">Delete</button>
					<button class="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded" onclick="renameFile('${f.name}')">Rename</button>
					<button class="px-2 py-1 text-xs bg-green-600 hover:bg-green-500 rounded" onclick="downloadFile('${f.url}', '${f.name}')">Download</button>
				</div>
			`;
			
			// Audio player
			const audioDiv = document.createElement('div');
			audioDiv.className = 'w-full';
			audioDiv.innerHTML = `
				<audio controls class="w-full" style="height: 40px;">
					<source src="${f.url}" type="audio/mpeg">
					Your browser does not support the audio element.
				</audio>
			`;
			
			div.appendChild(headerDiv);
			div.appendChild(audioDiv);
			outputsList.appendChild(div);
		}
	} catch (e) {
		if (handleUnauthorizedError(e)) return; // Redirect happened
		console.error('Failed to load outputs:', e);
	}
}

async function refreshJobs() {
	try {
		const jobsData = await fetchUserJobs();
		if (jobsData) {
			displayActiveJobs(jobsData);
		}
	} catch (e) {
		if (handleUnauthorizedError(e)) return; // Redirect happened
		console.error('Failed to load jobs:', e);
	}
}

// Global functions for file operations
window.renameFile = async (oldName) => {
	// Extract the original extension
	const originalExtension = oldName.split('.').pop();
	const nameWithoutExtension = oldName.replace(/\.[^/.]+$/, '');
	
	const newName = prompt(`New name (extension will remain .${originalExtension}):`, nameWithoutExtension);
	if (!newName || newName === nameWithoutExtension) return;
	
	// Ensure the extension is preserved
	const finalName = newName.endsWith(`.${originalExtension}`) ? newName : `${newName}.${originalExtension}`;
	
	try {
		const res = await authenticatedFetch('/api/outputs/rename', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ oldName, newName: finalName })
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

window.downloadFile = async (url, filename) => {
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	
	// Ask user if they want to delete the file after download
	const shouldDelete = confirm(`File "${filename.replace(/\.[^/.]+$/, '')}" has been downloaded. Would you like to delete it from the server?`);
	if (shouldDelete) {
		try {
			const res = await authenticatedFetch('/api/outputs/delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: filename })
			});
			if (res) refreshOutputs();
		} catch (e) {
			if (handleUnauthorizedError(e)) return;
			alert('Failed to delete file');
		}
	}
};

// Video creation functions
function toggleVideoOptions() {
	const createVideoCheckbox = document.getElementById('createVideo');
	const videoOptions = document.getElementById('videoOptions');
	const createVideoBtn = document.getElementById('createVideoBtn');
	
	if (createVideoCheckbox.checked) {
		videoOptions.classList.remove('hidden');
		createVideoBtn.classList.remove('hidden');
	} else {
		videoOptions.classList.add('hidden');
		createVideoBtn.classList.add('hidden');
	}
}

function toggleBackgroundUpload() {
	const backgroundType = document.getElementById('backgroundType');
	const imageUploadSection = document.getElementById('imageUploadSection');
	const videoUploadSection = document.getElementById('videoUploadSection');
	
	if (backgroundType.value === 'image') {
		imageUploadSection.classList.remove('hidden');
		videoUploadSection.classList.add('hidden');
	} else {
		imageUploadSection.classList.add('hidden');
		videoUploadSection.classList.remove('hidden');
	}
}

async function createVideo() {
	if (!validateSelection()) return;
	
	const createVideoCheckbox = document.getElementById('createVideo');
	if (!createVideoCheckbox.checked) {
		alert('Please enable video creation first');
		return;
	}
	
	const backgroundType = document.getElementById('backgroundType').value;
	const videoResolution = document.getElementById('videoResolution').value;
	
	// Check if background file is uploaded
	let backgroundFile = null;
	if (backgroundType === 'image') {
		const imageInput = document.getElementById('backgroundImage');
		backgroundFile = imageInput.files[0];
		if (!backgroundFile) {
			alert('Please upload a background image');
			return;
		}
	} else {
		const videoInput = document.getElementById('backgroundVideo');
		backgroundFile = videoInput.files[0];
		if (!backgroundFile) {
			alert('Please upload a background video');
			return;
		}
	}
	
	updateStatus('Creating video...');
	showProgress();
	updateProgressStatus('Uploading background file...');
	
	try {
		// First upload the background file
		const fileData = await readFileAsBase64(backgroundFile);
		const uploadRes = await authenticatedFetch('/api/upload/background', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				file: fileData,
				filename: backgroundFile.name,
				fileType: backgroundFile.type
			})
		});
		
		if (!uploadRes) return;
		
		const uploadResult = await uploadRes.json();
		if (uploadResult.error) throw new Error(uploadResult.error);
		
		updateProgressStatus('Background file uploaded, creating video...');
		
		// Now create the video
		const audioData = buildRequestData();
		const audioRes = await authenticatedFetch('/api/jobs/bible', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				...audioData,
				voiceModelId: document.getElementById('voiceModel').value,
				createVideo: true,
				videoSettings: {
					backgroundType,
					videoResolution,
					backgroundFile: backgroundFile.name
				}
			})
		});
		
		if (!audioRes) return;
		
		const result = await audioRes.json();
		if (result.error) throw new Error(result.error);
		
		updateStatus(`Video creation started! Job ID: ${result.id}`);
		startProgressTracking(result.id);
		
	} catch (error) {
		if (handleUnauthorizedError(error)) return;
		updateStatus(`Error: ${error.message}`);
		hideProgress();
	}
}

function readFileAsBase64(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const base64 = reader.result.split(',')[1]; // Remove data URL prefix
			resolve(base64);
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}
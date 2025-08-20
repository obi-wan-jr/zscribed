import { fetchMeta, getActiveUser, setActiveUser, updateAuthLink, requireAuth, authenticatedFetch, handleUnauthorizedError } from './common.js';

// Check authentication first
requireAuth().then(isAuthenticated => {
	if (!isAuthenticated) return; // Will redirect to login
	
	// Initialize the page
	init();
});

const voiceModel = document.getElementById('voiceModel');
const ttsBtn = document.getElementById('ttsBtn');
const textInput = document.getElementById('textInput');
const ttsProgress = document.getElementById('ttsProgress');
const sentencesPerChunkTts = document.getElementById('sentencesPerChunkTts');
const userWelcome = document.getElementById('userWelcome');
const outputsList = document.getElementById('outputsList');
const refreshOutputsBtn = document.getElementById('refreshOutputsBtn');
const queueStatus = document.getElementById('queueStatus');

// Translation elements
const fromLanguage = document.getElementById('fromLanguage');
const toLanguage = document.getElementById('toLanguage');
const translateBtn = document.getElementById('translateBtn');
const translationStatus = document.getElementById('translationStatus');

async function init() {
	// Update the login/logout link
	await updateAuthLink();
	
	// Set welcome message
	const currentUser = getActiveUser();
	userWelcome.textContent = `Welcome, ${currentUser}! Ready to create audio from text.`;
	
	// Load voice models
	await loadVoiceModels();
	
	// Load available languages
	await loadLanguages();
	
	// Load outputs
	refreshOutputs();
	
	// Start polling queue status
	setInterval(pollQueueStatus, 2000);
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

async function loadLanguages() {
	try {
		const res = await authenticatedFetch('/api/translation/languages');
		if (!res) return; // Redirect happened
		
		const data = await res.json();
		
		// Populate from language dropdown
		fromLanguage.innerHTML = '<option value="auto">Auto-detect</option>';
		for (const lang of data.languages || []) {
			const opt = document.createElement('option');
			opt.value = lang.code;
			opt.textContent = lang.name;
			fromLanguage.appendChild(opt);
		}
		
		// Populate to language dropdown
		toLanguage.innerHTML = '';
		for (const lang of data.languages || []) {
			const opt = document.createElement('option');
			opt.value = lang.code;
			opt.textContent = lang.name;
			toLanguage.appendChild(opt);
		}
		
		// Set default to English
		toLanguage.value = 'en';
		
	} catch (error) {
		if (handleUnauthorizedError(error)) return; // Redirect happened
		
		console.error('Failed to load languages:', error);
		translationStatus.textContent = 'Failed to load languages';
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
			ttsProgress.textContent = `Processing chunk ${data.chunk}/${data.total}...`;
		} else if (data.status === 'completed') {
			ttsProgress.innerHTML = `✅ Complete! <a href="${data.output}" class="text-indigo-300 hover:underline">Download</a>`;
			ttsBtn.disabled = false;
			ttsBtn.textContent = 'Convert';
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
			
			ttsProgress.innerHTML = `
				<div class="text-red-400">❌ Error: ${data.error}</div>
				${troubleshootingHtml}
			`;
			ttsBtn.disabled = false;
			ttsBtn.textContent = 'Convert';
		}
	};
	return ev;
}

ttsBtn?.addEventListener('click', async () => {
	const user = getActiveUser();
	const text = textInput.value;
	const voiceModelId = voiceModel.value;
	const format = 'mp3'; // Default format
	const sentencesPerChunk = Number(sentencesPerChunkTts.value || 3);
	
	if (!text.trim()) {
		ttsProgress.textContent = 'Please enter some text to convert';
		return;
	}
	
	if (!voiceModelId) {
		ttsProgress.textContent = 'Please select a voice model';
		return;
	}
	
	ttsBtn.disabled = true;
	ttsBtn.textContent = 'Converting...';
	ttsProgress.textContent = 'Starting conversion...';
	
	try {
		const res = await authenticatedFetch('/api/jobs/tts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ user, text, voiceModelId, format, sentencesPerChunk })
		});
		
		if (!res) return; // Redirect happened
		
		if (!res.ok) {
			const errorData = await res.json();
			throw new Error(errorData.error || 'Failed to start conversion');
		}
		
		const { id } = await res.json();
		listenToProgress(id);
	} catch (error) {
		if (handleUnauthorizedError(error)) return; // Redirect happened
		
		ttsProgress.innerHTML = `
			<div class="text-red-400">❌ Error: ${error.message}</div>
			<div class="mt-3 p-3 bg-yellow-900/20 border border-yellow-700 rounded">
				<strong class="text-yellow-400">Troubleshooting Steps:</strong>
				<ul class="mt-2 list-disc list-inside text-sm">
					<li>Check your Fish.Audio API key configuration</li>
					<li>Ensure your voice model is valid</li>
					<li>Try again in a few moments</li>
				</ul>
			</div>
		`;
		ttsBtn.disabled = false;
		ttsBtn.textContent = 'Convert';
	}
});

// Translation button functionality
translateBtn?.addEventListener('click', async () => {
	const text = textInput.value.trim();
	const fromLang = fromLanguage.value;
	const toLang = toLanguage.value;
	
	if (!text) {
		translationStatus.textContent = 'Please enter text to translate';
		return;
	}
	
	if (fromLang === toLang && fromLang !== 'auto') {
		translationStatus.textContent = 'Source and target languages are the same';
		return;
	}
	
	translateBtn.disabled = true;
	translateBtn.textContent = 'Translating...';
	translationStatus.textContent = 'Translating text...';
	
	try {
		const res = await authenticatedFetch('/api/translation/translate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				text,
				fromLanguage: fromLang,
				toLanguage: toLang
			})
		});
		
		if (!res) return; // Redirect happened
		
		const data = await res.json();
		
		if (data.error) {
			throw new Error(data.error);
		}
		
		// Update the text input with translated text
		textInput.value = data.translatedText;
		
		// Show success message
		const fromLangName = fromLang === 'auto' ? 'Auto-detected' : fromLanguage.options[fromLanguage.selectedIndex].text;
		const toLangName = toLanguage.options[toLanguage.selectedIndex].text;
		
		translationStatus.innerHTML = `
			✅ Translated from ${fromLangName} to ${toLangName}
			<br><small class="text-slate-400">Original: ${data.originalText.substring(0, 100)}${data.originalText.length > 100 ? '...' : ''}</small>
		`;
		
	} catch (error) {
		if (handleUnauthorizedError(error)) return; // Redirect happened
		
		console.error('Translation failed:', error);
		translationStatus.innerHTML = `
			❌ Translation failed: ${error.message}
			<br><small class="text-slate-400">Please try again or check your internet connection</small>
		`;
	} finally {
		translateBtn.disabled = false;
		translateBtn.textContent = 'Translate Text';
	}
});

refreshOutputsBtn?.addEventListener('click', refreshOutputs);

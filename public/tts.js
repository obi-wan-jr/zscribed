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

async function init() {
	// Update the login/logout link
	await updateAuthLink();
	
	// Set welcome message
	const currentUser = getActiveUser();
	userWelcome.textContent = `Welcome, ${currentUser}! Ready to create audio from text.`;
	
	// Load voice models
	await loadVoiceModels();
	
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

async function refreshOutputs() {
	try {
		const res = await authenticatedFetch('/api/outputs');
		if (!res) return; // Redirect happened
		
		const data = await res.json();
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
			ttsProgress.innerHTML = `
				<div class="space-y-3">
					<div class="text-green-400">✅ Audio creation completed!</div>
					<div class="bg-[#0a0f1a] p-3 rounded border border-slate-600">
						<div class="text-sm text-slate-300 mb-2">Preview your audio:</div>
						<audio controls class="w-full" style="height: 40px;">
							<source src="${data.output}" type="audio/mpeg">
							Your browser does not support the audio element.
						</audio>
						<div class="mt-2 flex justify-end">
							<button onclick="refreshOutputs()" class="text-xs text-slate-400 hover:text-slate-300 underline">
								🔄 View all files
							</button>
						</div>
					</div>
				</div>
			`;
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

refreshOutputsBtn?.addEventListener('click', refreshOutputs);

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

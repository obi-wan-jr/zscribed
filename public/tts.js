import { fetchMeta, getActiveUser, setActiveUser, updateNavigation, requireAuth, authenticatedFetch, handleUnauthorizedError, cancelCurrentJob } from './common.js';

// Check authentication first
requireAuth().then(isAuthenticated => {
	if (!isAuthenticated) return; // Server will handle redirect
	
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
	// Update the navigation
	await updateNavigation();
	
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
		console.log('Loading voice models...');
		const res = await authenticatedFetch('/api/models?t=' + Date.now());
		if (!res) return; // Redirect happened
		
		const data = await res.json();
		console.log('Voice models data:', data);
		
		voiceModel.innerHTML = '';
		let defaultModelId = null;
		
		for (const m of data.voiceModels || []) {
			const opt = document.createElement('option');
			opt.value = m.id; 
			opt.textContent = m.name || m.id; 
			if (m.isDefault) {
				defaultModelId = m.id;
				console.log('Found default model:', m.name, 'with ID:', m.id);
			}
			voiceModel.appendChild(opt);
		}
		
		// Select the default model if one exists
		if (defaultModelId) {
			voiceModel.value = defaultModelId;
			console.log('Set default model in dropdown:', defaultModelId);
		} else {
			console.log('No default model found');
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
		
		// Sort files by modification time, newest first
		const sortedFiles = (data.files || []).sort((a, b) => {
			const timeA = new Date(a.mtime || a.modified || 0).getTime();
			const timeB = new Date(b.mtime || b.modified || 0).getTime();
			return timeB - timeA; // Newest first
		});
		
		for (const f of sortedFiles) {
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
	let eventSource = null;
	let pollInterval = null;
	let completed = false;
	
	// Function to handle job completion
	function handleCompletion() {
		if (completed) return;
		completed = true;
		
		ttsProgress.innerHTML = `
			<div class="text-green-400">✅ Audio creation completed!</div>
		`;
		ttsBtn.disabled = false;
		ttsBtn.textContent = 'Convert to Audio';
		cancelTtsBtn.classList.add('hidden');
		
		// Clean up
		if (eventSource) {
			eventSource.close();
		}
		if (pollInterval) {
			clearInterval(pollInterval);
		}
		
		// Refresh outputs list to show new file
		refreshOutputs();
	}
	
	// Function to handle job error
	function handleError(error, troubleshooting = []) {
		if (completed) return;
		completed = true;
		
		let troubleshootingHtml = '';
		if (troubleshooting && troubleshooting.length > 0) {
			troubleshootingHtml = `
				<div class="mt-3 p-3 bg-yellow-900/20 border border-yellow-700 rounded">
					<strong class="text-yellow-400">Troubleshooting Steps:</strong>
					<ul class="mt-2 list-disc list-inside text-sm">
						${troubleshooting.map(step => `<li>${step}</li>`).join('')}
					</ul>
				</div>
			`;
		}
		
		ttsProgress.innerHTML = `
			<div class="text-red-400">❌ Error: ${error}</div>
			${troubleshootingHtml}
		`;
		ttsBtn.disabled = false;
		ttsBtn.textContent = 'Convert to Audio';
		cancelTtsBtn.classList.add('hidden');
		
		// Clean up
		if (eventSource) {
			eventSource.close();
		}
		if (pollInterval) {
			clearInterval(pollInterval);
		}
	}
	
	// Try EventSource first
	try {
		eventSource = new EventSource(`/api/progress/${jobId}`);
		eventSource.onmessage = (e) => {
			const data = JSON.parse(e.data);
			if (data.status === 'progress') {
				if (data.step === 'tts' && data.chunk && data.total) {
					ttsProgress.textContent = `Processing chunk ${data.chunk}/${data.total}...`;
				} else if (data.step === 'video' && data.message) {
					ttsProgress.textContent = data.message;
				} else if (data.message) {
					ttsProgress.textContent = data.message;
				} else {
					ttsProgress.textContent = 'Processing...';
				}
			} else if (data.status === 'completed') {
				handleCompletion();
			} else if (data.status === 'error') {
				handleError(data.error, data.troubleshooting);
			}
		};
		eventSource.onerror = () => {
			console.log('EventSource failed, falling back to polling');
		};
	} catch (error) {
		console.log('EventSource not supported, using polling');
	}
	
	// Fallback polling mechanism
	let pollCount = 0;
	const maxPolls = 300; // 5 minutes at 1-second intervals
	
	pollInterval = setInterval(async () => {
		pollCount++;
		
		try {
			const res = await authenticatedFetch(`/api/queue/status?t=${Date.now()}`);
			if (!res) return; // Redirect happened
			
			if (res.ok) {
				const data = await res.json();
				
				// Check if job is still in queue
				const jobInQueue = data.jobQueue?.some(job => job.id === jobId);
				const jobActive = data.activeJobs?.some(job => job.id === jobId);
				
				if (!jobInQueue && !jobActive) {
					// Job is no longer in queue, check if it completed successfully
					const outputsRes = await authenticatedFetch(`/api/outputs?t=${Date.now()}`);
					if (outputsRes && outputsRes.ok) {
						const outputs = await outputsRes.json();
						// If we have outputs, assume job completed successfully
						if (outputs.files && outputs.files.length > 0) {
							handleCompletion();
							return;
						}
					}
					
					// Job completed but no outputs found, assume error
					handleError('Job completed but no output files found');
					return;
				}
				
				// Update progress if available
				if (data.activeJobs) {
					const activeJob = data.activeJobs.find(job => job.id === jobId);
					if (activeJob && activeJob.progress) {
						if (activeJob.progress.step === 'tts' && activeJob.progress.chunk && activeJob.progress.total) {
							ttsProgress.textContent = `Processing chunk ${activeJob.progress.chunk}/${activeJob.progress.total}...`;
						} else if (activeJob.progress.step === 'video' && activeJob.progress.message) {
							ttsProgress.textContent = activeJob.progress.message;
						} else if (activeJob.progress.message) {
							ttsProgress.textContent = activeJob.progress.message;
						} else {
							ttsProgress.textContent = 'Processing...';
						}
					}
				}
			}
		} catch (error) {
			console.log('Polling error:', error);
		}
		
		// Stop polling after max attempts
		if (pollCount >= maxPolls) {
			handleError('Job timed out - please check the outputs manually');
		}
	}, 1000);
	
	return { eventSource, pollInterval };
}

	// Cancel button functionality
	const cancelTtsBtn = document.getElementById('cancelTtsBtn');
	cancelTtsBtn?.addEventListener('click', async () => {
		if (!confirm('Are you sure you want to cancel the current job?')) {
			return;
		}
		
		const success = await cancelCurrentJob();
		if (success) {
			ttsProgress.innerHTML = `
				<div class="text-yellow-400">⚠️ Job cancelled</div>
			`;
			ttsBtn.disabled = false;
			ttsBtn.textContent = 'Convert to Audio';
			cancelTtsBtn.classList.add('hidden');
		} else {
			alert('Failed to cancel job. Please try again.');
		}
	});

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
	cancelTtsBtn.classList.remove('hidden');
	
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
		const progressHandler = listenToProgress(id);
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
		ttsBtn.textContent = 'Convert to Audio';
		cancelTtsBtn.classList.add('hidden');
	}
});

refreshOutputsBtn?.addEventListener('click', refreshOutputs);



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

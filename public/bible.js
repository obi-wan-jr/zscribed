import { fetchMeta, getActiveUser, setActiveUser, updateAuthLink, requireAuth } from './common.js';

// Check authentication first
requireAuth().then(isAuthenticated => {
	if (!isAuthenticated) return; // Will redirect to login
	
	// Initialize the page
	init();
});

const voiceModel = document.getElementById('voiceModel');
const translation = document.getElementById('translation');
const book = document.getElementById('book');
const chapter = document.getElementById('chapter');
const verses = document.getElementById('verses');
const excludeNumbers = document.getElementById('excludeNumbers');
const excludeFootnotes = document.getElementById('excludeFootnotes');
const sentencesPerChunkBible = document.getElementById('sentencesPerChunkBible');
const bibleFetchBtn = document.getElementById('bibleFetchBtn');
const bibleTtsBtn = document.getElementById('bibleTtsBtn');
const bibleProgress = document.getElementById('bibleProgress');
const userWelcome = document.getElementById('userWelcome');
const outputsList = document.getElementById('outputsList');
const refreshOutputsBtn = document.getElementById('refreshOutputsBtn');
const queueStatus = document.getElementById('queueStatus');

async function init() {
	// Update the login/logout link
	await updateAuthLink();
	
	// Set welcome message
	const currentUser = getActiveUser();
	userWelcome.textContent = `Welcome, ${currentUser}! Ready to create Bible audio.`;
	
	// Load voice models
	await loadVoiceModels();
	
	// Load outputs
	refreshOutputs();
	
	// Start polling queue status
	setInterval(pollQueueStatus, 2000);
}

async function loadVoiceModels() {
	try {
		const res = await fetch('/api/models');
		const data = await res.json();
		voiceModel.innerHTML = '';
		for (const m of data.voiceModels || []) {
			const opt = document.createElement('option');
			opt.value = m.id; 
			opt.textContent = m.name || m.id; 
			voiceModel.appendChild(opt);
		}
	} catch (error) {
		console.error('Failed to load voice models:', error);
		voiceModel.innerHTML = '<option value="">No voice models available</option>';
	}
}

async function refreshOutputs() {
	try {
		const res = await fetch('/api/outputs');
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
				await fetch('/api/outputs/rename', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oldName: f.name, newName }) });
				refreshOutputs();
			};
			const delBtn = document.createElement('button');
			delBtn.textContent = 'Delete';
			delBtn.className = 'px-2 py-1 text-xs rounded bg-red-700 hover:bg-red-600';
			delBtn.onclick = async () => {
				if (!confirm('Delete ' + f.name + '?')) return;
				await fetch('/api/outputs/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: f.name }) });
				refreshOutputs();
			};
			row.append(a, renameBtn, delBtn);
			outputsList.appendChild(row);
		}
	} catch (e) {
		outputsList.textContent = 'Failed to load outputs';
	}
}

async function pollQueueStatus() {
	try {
		const res = await fetch('/api/queue/status');
		const data = await res.json();
		queueStatus.textContent = `Queue: ${data.pending} pending${data.processing ? ' (processing)' : ''}`;
	} catch {}
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

bibleFetchBtn?.addEventListener('click', async () => {
	bibleProgress.textContent = 'Fetching...';
	try {
		const res = await fetch('/api/bible/fetch', {
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
		const data = await res.json();
		if (data.error) throw new Error(data.error);
		bibleProgress.textContent = data.text || '';
	} catch (e) {
		bibleProgress.textContent = 'Error: ' + e.message;
	}
});

bibleTtsBtn?.addEventListener('click', async () => {
	const user = getActiveUser();
	const voiceModelId = voiceModel.value;
	const format = 'mp3';
	const sentencesPerChunk = Number(sentencesPerChunkBible.value || 3);
	
	if (!book.value || !chapter.value || !verses.value) {
		bibleProgress.textContent = 'Please fill in all Bible reference fields';
		return;
	}
	
	if (!voiceModelId) {
		bibleProgress.textContent = 'Please select a voice model';
		return;
	}
	
	bibleTtsBtn.disabled = true;
	bibleTtsBtn.textContent = 'Creating Audio...';
	bibleProgress.textContent = 'Starting Bible audio creation...';
	
	try {
		const res = await fetch('/api/jobs/bible', {
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
		
		if (!res.ok) {
			const errorData = await res.json();
			throw new Error(errorData.error || 'Failed to start Bible audio creation');
		}
		
		const { id } = await res.json();
		listenToProgress(id);
	} catch (error) {
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

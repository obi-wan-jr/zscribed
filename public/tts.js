import { fetchMeta, getActiveUser, setActiveUser, updateAuthLink, requireAuth } from './common.js';

// Check authentication first
requireAuth().then(isAuthenticated => {
	if (!isAuthenticated) return; // Will redirect to login
	
	// Initialize the page
	init();
});

const userSelect = document.getElementById('userSelect');
const voiceModel = document.getElementById('voiceModel');
const convertBtn = document.getElementById('convertBtn');
const ttsInput = document.getElementById('ttsInput');
const ttsProgress = document.getElementById('ttsProgress');
const audioFormat = document.getElementById('audioFormat');
const sentencesPerChunkTts = document.getElementById('sentencesPerChunkTts');

async function init() {
	// Update the login/logout link
	await updateAuthLink();
	
	const meta = await fetchMeta();
	userSelect.innerHTML = '';
	for (const u of meta.allowedUsers || []) {
		const opt = document.createElement('option');
		opt.value = u; opt.textContent = u; userSelect.appendChild(opt);
	}
	userSelect.value = getActiveUser();
	userSelect.addEventListener('change', () => setActiveUser(userSelect.value));

	voiceModel.innerHTML = '';
	for (const m of meta.voiceModels || []) {
		const opt = document.createElement('option');
		opt.value = m.id; opt.textContent = m.name || m.id; voiceModel.appendChild(opt);
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
			convertBtn.disabled = false;
			convertBtn.textContent = 'Convert';
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
			convertBtn.disabled = false;
			convertBtn.textContent = 'Convert';
		}
	};
	return ev;
}

convertBtn?.addEventListener('click', async () => {
	const user = userSelect.value || 'Inggo';
	const text = ttsInput.value;
	const voiceModelId = voiceModel.value;
	const format = audioFormat.value;
	const sentencesPerChunk = Number(sentencesPerChunkTts.value || 3);
	
	if (!text.trim()) {
		ttsProgress.textContent = 'Please enter some text to convert';
		return;
	}
	
	convertBtn.disabled = true;
	convertBtn.textContent = 'Converting...';
	ttsProgress.textContent = 'Starting conversion...';
	
	try {
		const res = await fetch('/api/jobs/tts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ user, text, voiceModelId, format, sentencesPerChunk })
		});
		
		if (!res.ok) {
			const errorData = await res.json();
			throw new Error(errorData.error || 'Failed to start conversion');
		}
		
		const { id } = await res.json();
		listenToProgress(id);
	} catch (error) {
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
		convertBtn.disabled = false;
		convertBtn.textContent = 'Convert';
	}
});

import { fetchMeta, getActiveUser, setActiveUser, updateAuthLink, requireAuth } from './common.js';

// Check authentication first
requireAuth().then(isAuthenticated => {
	if (!isAuthenticated) return; // Will redirect to login
	
	// Initialize the page
	init();
});

const userSelect = document.getElementById('userSelect');
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
			bibleProgress.textContent = `Processing chunk ${data.chunk}/${data.total}...`;
		} else if (data.status === 'completed') {
			bibleProgress.innerHTML = `✅ Complete! <a href="${data.output}" class="text-indigo-300 hover:underline">Download</a>`;
			bibleTtsBtn.disabled = false;
			bibleTtsBtn.textContent = 'Create Audio';
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
	const user = userSelect.value || 'Inggo';
	const voiceModelId = voiceModel.value;
	const format = 'mp3';
	const sentencesPerChunk = Number(sentencesPerChunkBible.value || 3);
	
	if (!book.value || !chapter.value || !verses.value) {
		bibleProgress.textContent = 'Please fill in all Bible reference fields';
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

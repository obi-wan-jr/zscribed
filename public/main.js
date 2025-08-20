const userSelect = document.getElementById('userSelect');
const voiceModelSelect = document.getElementById('voiceModel');
const prefsStatus = document.getElementById('prefsStatus');

async function loadMeta() {
	try {
		const res = await fetch('/api/config/meta');
		const meta = await res.json();
		if (Array.isArray(meta.allowedUsers) && userSelect) {
			userSelect.innerHTML = '';
			for (const u of meta.allowedUsers) {
				const opt = document.createElement('option');
				opt.textContent = u;
				opt.value = u;
				userSelect.appendChild(opt);
			}
		}
		if (Array.isArray(meta.voiceModels) && voiceModelSelect) {
			voiceModelSelect.innerHTML = '';
			for (const m of meta.voiceModels) {
				const opt = document.createElement('option');
				opt.value = m.id;
				opt.textContent = m.name || m.id;
				voiceModelSelect.appendChild(opt);
			}
		}
	} catch (e) {
		console.warn('Failed to load meta', e);
	}
}

async function loadPreferencesIntoUI() {
	try {
		const res = await fetch('/api/memory/preferences');
		const prefs = await res.json();
		const user = userSelect?.value;
		const p = (prefs.users && prefs.users[user]) || {};
		if (p.voiceModelId && voiceModelSelect) voiceModelSelect.value = p.voiceModelId;
		if (p.audioFormat && document.getElementById('audioFormat')) document.getElementById('audioFormat').value = p.audioFormat;
		if (p.sentencesPerChunkTts && document.getElementById('sentencesPerChunkTts')) document.getElementById('sentencesPerChunkTts').value = p.sentencesPerChunkTts;
		if (p.sentencesPerChunkBible && document.getElementById('sentencesPerChunkBible')) document.getElementById('sentencesPerChunkBible').value = p.sentencesPerChunkBible;
		if (p.translation && document.getElementById('translation')) document.getElementById('translation').value = p.translation;
	} catch {}
}

async function savePreferencesFromUI() {
	const user = userSelect?.value;
	const body = { users: {} };
	body.users[user] = {
		voiceModelId: voiceModelSelect?.value,
		audioFormat: document.getElementById('audioFormat')?.value,
		sentencesPerChunkTts: Number(document.getElementById('sentencesPerChunkTts')?.value || 3),
		sentencesPerChunkBible: Number(document.getElementById('sentencesPerChunkBible')?.value || 3),
		translation: document.getElementById('translation')?.value
	};
	const res = await fetch('/api/memory/preferences', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	if (res.ok) {
		prefsStatus.textContent = 'Saved';
		setTimeout(() => (prefsStatus.textContent = ''), 1500);
	}
}

const savePrefsBtn = document.getElementById('savePrefsBtn');
savePrefsBtn?.addEventListener('click', savePreferencesFromUI);
userSelect?.addEventListener('change', loadPreferencesIntoUI);

loadMeta().then(loadPreferencesIntoUI);

const convertBtn = document.getElementById('convertBtn');
const ttsProgress = document.getElementById('ttsProgress');
const sentencesPerChunkTts = document.getElementById('sentencesPerChunkTts');

convertBtn?.addEventListener('click', async () => {
	const user = userSelect?.value || 'Inggo';
	const text = document.getElementById('ttsInput').value;
	const voiceModelId = voiceModelSelect?.value || 'default';
	const format = document.getElementById('audioFormat')?.value || 'mp3';
	const sentencesPerChunk = Number(sentencesPerChunkTts?.value || 3);
	const res = await fetch('/api/jobs/tts', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ user, text, voiceModelId, format, sentencesPerChunk })
	});
	const { id } = await res.json();
	listenToProgress(id, ttsProgress);
	await refreshOutputs();
});

function listenToProgress(jobId, el) {
	const ev = new EventSource(`/api/progress/${jobId}`);
	ev.onmessage = (e) => {
		const data = JSON.parse(e.data);
		el.textContent = JSON.stringify(data);
		if (data.status === 'completed' || data.status === 'error') {
			ev.close();
			refreshOutputs();
		}
	};
}

// Bible fetch
const bibleFetchBtn = document.getElementById('bibleFetchBtn');
const bibleTtsBtn = document.getElementById('bibleTtsBtn');
const translation = document.getElementById('translation');
const book = document.getElementById('book');
const chapter = document.getElementById('chapter');
const verses = document.getElementById('verses');
const excludeNumbers = document.getElementById('excludeNumbers');
const excludeFootnotes = document.getElementById('excludeFootnotes');
const sentencesPerChunkBible = document.getElementById('sentencesPerChunkBible');
const bibleProgress = document.getElementById('bibleProgress');

bibleFetchBtn?.addEventListener('click', async () => {
	bibleProgress.textContent = 'Fetching...';
	try {
		const res = await fetch('/api/bible/fetch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
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
	const user = userSelect?.value || 'Inggo';
	const voiceModelId = voiceModelSelect?.value || 'default';
	const format = document.getElementById('audioFormat')?.value || 'mp3';
	const sentencesPerChunk = Number(sentencesPerChunkBible?.value || 3);
	const res = await fetch('/api/jobs/bible', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			user,
			translation: translation.value,
			book: book.value,
			chapter: Number(chapter.value || 1),
			verseRanges: verses.value,
			excludeNumbers: excludeNumbers.checked,
			excludeFootnotes: excludeFootnotes.checked,
			voiceModelId,
			format,
			sentencesPerChunk
		})
	});
	const { id } = await res.json();
	listenToProgress(id, bibleProgress);
});

// Outputs list
const outputsList = document.getElementById('outputsList');
const refreshOutputsBtn = document.getElementById('refreshOutputsBtn');
const queueStatus = document.getElementById('queueStatus');

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
				await fetch('/api/outputs/rename', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ oldName: f.name, newName })
				});
				refreshOutputs();
			};
			const delBtn = document.createElement('button');
			delBtn.textContent = 'Delete';
			delBtn.className = 'px-2 py-1 text-xs rounded bg-red-700 hover:bg-red-600';
			delBtn.onclick = async () => {
				if (!confirm('Delete ' + f.name + '?')) return;
				await fetch('/api/outputs/delete', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name: f.name })
				});
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

setInterval(pollQueueStatus, 2000);
refreshOutputs();
refreshOutputsBtn?.addEventListener('click', refreshOutputs);

// Voice model management
const modelsList = document.getElementById('modelsList');
const addModelBtn = document.getElementById('addModelBtn');

async function refreshModels() {
	try {
		const res = await fetch('/api/models');
		const data = await res.json();
		modelsList.innerHTML = '';
		for (const m of data.voiceModels || []) {
			const row = document.createElement('div');
			row.className = 'flex items-center gap-3';
			const span = document.createElement('span');
			span.textContent = `${m.name || m.id} (${m.id})`;
			const del = document.createElement('button');
			del.textContent = 'Remove';
			del.className = 'px-2 py-1 text-xs rounded bg-red-700 hover:bg-red-600';
			del.onclick = async () => {
				await fetch('/api/models/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id }) });
				await loadMeta();
				await refreshModels();
			};
			row.append(span, del);
			modelsList.appendChild(row);
		}
	} catch (e) {
		modelsList.textContent = 'Failed to load models';
	}
}

addModelBtn?.addEventListener('click', async () => {
	const id = document.getElementById('newModelId').value.trim();
	const name = document.getElementById('newModelName').value.trim();
	if (!id) return;
	await fetch('/api/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name }) });
	document.getElementById('newModelId').value = '';
	document.getElementById('newModelName').value = '';
	await loadMeta();
	await refreshModels();
});

refreshModels();

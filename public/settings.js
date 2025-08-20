import { fetchMeta, getActiveUser, setActiveUser, addLogoutButton } from './common.js';

const userSelect = document.getElementById('userSelect');
const voiceModel = document.getElementById('voiceModel');
const audioFormat = document.getElementById('audioFormat');
const sentencesPerChunkTts = document.getElementById('sentencesPerChunkTts');
const sentencesPerChunkBible = document.getElementById('sentencesPerChunkBible');
const translation = document.getElementById('translation');
const savePrefsBtn = document.getElementById('savePrefsBtn');
const prefsStatus = document.getElementById('prefsStatus');

const newModelId = document.getElementById('newModelId');
const newModelName = document.getElementById('newModelName');
const addModelBtn = document.getElementById('addModelBtn');
const modelsList = document.getElementById('modelsList');

init();

async function init() {
	const meta = await fetchMeta();
	userSelect.innerHTML = '';
	for (const u of meta.allowedUsers || []) { const opt = document.createElement('option'); opt.value = u; opt.textContent = u; userSelect.appendChild(opt); }
	userSelect.value = getActiveUser();
	userSelect.addEventListener('change', () => setActiveUser(userSelect.value));

	voiceModel.innerHTML = '';
	for (const m of meta.voiceModels || []) { const opt = document.createElement('option'); opt.value = m.id; opt.textContent = m.name || m.id; voiceModel.appendChild(opt); }

	await loadPreferencesIntoUI();
	await refreshModels();
	
	addLogoutButton();
}

async function loadPreferencesIntoUI() {
	try {
		const res = await fetch('/api/memory/preferences');
		const prefs = await res.json();
		const user = userSelect.value;
		const p = (prefs.users && prefs.users[user]) || {};
		if (p.voiceModelId) voiceModel.value = p.voiceModelId;
		if (p.audioFormat) audioFormat.value = p.audioFormat;
		if (p.sentencesPerChunkTts) sentencesPerChunkTts.value = p.sentencesPerChunkTts;
		if (p.sentencesPerChunkBible) sentencesPerChunkBible.value = p.sentencesPerChunkBible;
		if (p.translation) translation.value = p.translation;
	} catch {}
}

savePrefsBtn?.addEventListener('click', async () => {
	const user = userSelect.value;
	const body = { users: {} };
	body.users[user] = {
		voiceModelId: voiceModel.value,
		audioFormat: audioFormat.value,
		sentencesPerChunkTts: Number(sentencesPerChunkTts.value || 3),
		sentencesPerChunkBible: Number(sentencesPerChunkBible.value || 3),
		translation: translation.value
	};
	await fetch('/api/memory/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
	prefsStatus.textContent = 'Saved';
	setTimeout(() => (prefsStatus.textContent = ''), 1500);
});

async function refreshModels() {
	const res = await fetch('/api/models');
	const data = await res.json();
	modelsList.innerHTML = '';
	for (const m of data.voiceModels || []) {
		const row = document.createElement('div'); row.className = 'flex items-center gap-3';
		const span = document.createElement('span'); span.textContent = `${m.name || m.id} (${m.id})`;
		const del = document.createElement('button'); del.textContent = 'Remove'; del.className = 'px-2 py-1 text-xs rounded bg-red-700 hover:bg-red-600';
		del.onclick = async () => { await fetch('/api/models/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id }) }); await init(); };
		row.append(span, del); modelsList.appendChild(row);
	}
}

addModelBtn?.addEventListener('click', async () => {
	const id = newModelId.value.trim();
	const name = newModelName.value.trim();
	if (!id) return;
	await fetch('/api/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name }) });
	newModelId.value = ''; newModelName.value = '';
	await init();
});

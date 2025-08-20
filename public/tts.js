import { fetchMeta, getActiveUser, setActiveUser, listenToProgress } from './common.js';

const userSelect = document.getElementById('userSelect');
const voiceModel = document.getElementById('voiceModel');
const convertBtn = document.getElementById('convertBtn');
const ttsInput = document.getElementById('ttsInput');
const ttsProgress = document.getElementById('ttsProgress');
const audioFormat = document.getElementById('audioFormat');
const sentencesPerChunkTts = document.getElementById('sentencesPerChunkTts');

init();

async function init() {
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

convertBtn?.addEventListener('click', async () => {
	const user = userSelect.value || 'Inggo';
	const text = ttsInput.value;
	const voiceModelId = voiceModel.value;
	const format = audioFormat.value;
	const sentencesPerChunk = Number(sentencesPerChunkTts.value || 3);
	const res = await fetch('/api/jobs/tts', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ user, text, voiceModelId, format, sentencesPerChunk })
	});
	const { id } = await res.json();
	listenToProgress(id, (data) => {
		ttsProgress.textContent = JSON.stringify(data);
	});
});

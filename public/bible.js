import { fetchMeta, getActiveUser, setActiveUser, listenToProgress, updateAuthLink, requireAuth } from './common.js';

// Check authentication first
requireAuth().then(isAuthenticated => {
	if (!isAuthenticated) return; // Will redirect to login
	
	// Initialize the page
	init();
});

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
	
	addLogoutButton();
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
	const { id } = await res.json();
	listenToProgress(id, (data) => {
		bibleProgress.textContent = JSON.stringify(data);
	});
});

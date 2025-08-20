import { fetchMeta, getActiveUser, setActiveUser, updateAuthLink, requireAuth } from './common.js';

// Check authentication first
requireAuth().then(isAuthenticated => {
	if (!isAuthenticated) return; // Will redirect to login
	
	// Initialize the page
	init();
});

async function init() {
	// Update the login/logout link
	await updateAuthLink();
	
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

	refreshOutputs();
	refreshOutputsBtn?.addEventListener('click', refreshOutputs);
	setInterval(pollQueueStatus, 2000);
}

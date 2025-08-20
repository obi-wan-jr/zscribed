import { fetchMeta, getActiveUser, setActiveUser, updateAuthLink, requireAuth } from './common.js';

// Check authentication first
requireAuth().then(isAuthenticated => {
	if (!isAuthenticated) return; // Will redirect to login
	
	// Initialize the page
	init();
});

const userSelect = document.getElementById('userSelect');
const autoRefresh = document.getElementById('autoRefresh');
const showNotifications = document.getElementById('showNotifications');
const savePrefsBtn = document.getElementById('savePrefsBtn');
const addModelBtn = document.getElementById('addModelBtn');
const modelsList = document.getElementById('modelsList');

async function init() {
	// Update the login/logout link
	await updateAuthLink();
	
	// Load user preferences
	userSelect.innerHTML = '';
	userSelect.appendChild(new Option('Select user...', ''));
	userSelect.appendChild(new Option('Inggo', 'Inggo'));
	userSelect.appendChild(new Option('Gelo', 'Gelo'));
	userSelect.appendChild(new Option('JM', 'JM'));
	userSelect.value = getActiveUser();
	userSelect.addEventListener('change', () => setActiveUser(userSelect.value));

	// Load preferences
	await loadPreferencesIntoUI();
	
	// Load voice models
	await refreshModels();
	
	// Add TTS test section
	addTTSTestSection();
}

async function loadPreferencesIntoUI() {
	try {
		const res = await fetch('/api/memory/preferences');
		const prefs = await res.json();
		const user = userSelect.value;
		const p = (prefs.users && prefs.users[user]) || {};
		autoRefresh.checked = p.autoRefresh || false;
		showNotifications.checked = p.showNotifications || false;
	} catch (error) {
		console.error('Failed to load preferences:', error);
	}
}

async function refreshModels() {
	try {
		const res = await fetch('/api/models');
		const data = await res.json();
		modelsList.innerHTML = '';
		for (const model of data.voiceModels || []) {
			const row = document.createElement('div');
			row.className = 'flex items-center justify-between p-2 bg-[#0b1020] rounded';
			row.innerHTML = `
				<span class="text-sm">${model.name || model.id} (${model.id})</span>
				<button onclick="deleteModel('${model.id}')" class="px-2 py-1 text-xs rounded bg-red-700 hover:bg-red-600">Delete</button>
			`;
			modelsList.appendChild(row);
		}
	} catch (error) {
		modelsList.innerHTML = '<div class="text-red-400">Failed to load models</div>';
	}
}

function addTTSTestSection() {
	const main = document.querySelector('main');
	
	// Check if TTS test section already exists
	if (document.getElementById('ttsTestSection')) return;
	
	const ttsTestSection = document.createElement('section');
	ttsTestSection.id = 'ttsTestSection';
	ttsTestSection.className = 'bg-[#121733] border border-slate-700 rounded-lg p-4';
	ttsTestSection.innerHTML = `
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-lg font-medium text-indigo-200">TTS Connection Test</h2>
			<button id="testTTSBtn" class="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-500">Test Connection</button>
		</div>
		<div id="ttsTestResult" class="text-sm text-slate-300"></div>
	`;
	main.appendChild(ttsTestSection);
	
	// Add test functionality
	const testBtn = document.getElementById('testTTSBtn');
	const resultDiv = document.getElementById('ttsTestResult');
	
	testBtn.addEventListener('click', async () => {
		testBtn.disabled = true;
		testBtn.textContent = 'Testing...';
		resultDiv.textContent = 'Testing TTS connection...';
		
		try {
			const response = await fetch('/api/tts/test');
			const result = await response.json();
			
			if (result.success) {
				resultDiv.innerHTML = `
					<div class="text-green-400">✅ Connection successful!</div>
					<div class="mt-2">
						<strong>Provider:</strong> ${result.provider}<br>
						${result.voiceCount ? `<strong>Available voices:</strong> ${result.voiceCount}<br>` : ''}
						${result.message ? `<strong>Message:</strong> ${result.message}` : ''}
					</div>
				`;
			} else {
				let troubleshootingHtml = '';
				if (result.troubleshooting && result.troubleshooting.length > 0) {
					troubleshootingHtml = `
						<div class="mt-3 p-3 bg-yellow-900/20 border border-yellow-700 rounded">
							<strong class="text-yellow-400">Troubleshooting Steps:</strong>
							<ul class="mt-2 list-disc list-inside text-sm">
								${result.troubleshooting.map(step => `<li>${step}</li>`).join('')}
							</ul>
						</div>
					`;
				}
				
				resultDiv.innerHTML = `
					<div class="text-red-400">❌ Connection failed</div>
					<div class="mt-2">
						<strong>Provider:</strong> ${result.provider}<br>
						<strong>Error:</strong> ${result.error}
					</div>
					${troubleshootingHtml}
				`;
			}
		} catch (error) {
			resultDiv.innerHTML = `
				<div class="text-red-400">❌ Test failed</div>
				<div class="mt-2">Error: ${error.message}</div>
				<div class="mt-3 p-3 bg-yellow-900/20 border border-yellow-700 rounded">
					<strong class="text-yellow-400">Troubleshooting Steps:</strong>
					<ul class="mt-2 list-disc list-inside text-sm">
						<li>Check your internet connection</li>
						<li>Verify your API key is correct</li>
						<li>Ensure your Fish.Audio account is active</li>
						<li>Check Fish.Audio service status</li>
					</ul>
				</div>
			`;
		} finally {
			testBtn.disabled = false;
			testBtn.textContent = 'Test Connection';
		}
	});
}

// Event listeners
savePrefsBtn?.addEventListener('click', async () => {
	const user = userSelect.value;
	const body = { users: {} };
	body.users[user] = {
		autoRefresh: autoRefresh.checked,
		showNotifications: showNotifications.checked
	};
	
	try {
		await fetch('/api/memory/preferences', { 
			method: 'POST', 
			headers: { 'Content-Type': 'application/json' }, 
			body: JSON.stringify(body) 
		});
		
		// Show success message
		const originalText = savePrefsBtn.textContent;
		savePrefsBtn.textContent = 'Saved!';
		setTimeout(() => {
			savePrefsBtn.textContent = originalText;
		}, 1500);
	} catch (error) {
		console.error('Failed to save preferences:', error);
	}
});

addModelBtn?.addEventListener('click', async () => {
	const id = prompt('Enter model ID:');
	const name = prompt('Enter model name (optional):');
	
	if (!id) return;
	
	try {
		await fetch('/api/models', { 
			method: 'POST', 
			headers: { 'Content-Type': 'application/json' }, 
			body: JSON.stringify({ id, name }) 
		});
		await refreshModels();
	} catch (error) {
		console.error('Failed to add model:', error);
	}
});

// Global function for delete buttons
window.deleteModel = async function(modelId) {
	if (!confirm('Delete this voice model?')) return;
	
	try {
		await fetch('/api/models/delete', { 
			method: 'POST', 
			headers: { 'Content-Type': 'application/json' }, 
			body: JSON.stringify({ id: modelId }) 
		});
		await refreshModels();
	} catch (error) {
		console.error('Failed to delete model:', error);
	}
};

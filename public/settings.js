import { fetchMeta, getActiveUser, setActiveUser, updateAuthLink, requireAuth, authenticatedFetch, handleUnauthorizedError } from './common.js';

// Check authentication first
requireAuth().then(isAuthenticated => {
	if (!isAuthenticated) return; // Will redirect to login
	
	// Initialize the page
	init();
});

const showNotifications = document.getElementById('showNotifications');
const savePrefsBtn = document.getElementById('savePrefsBtn');
const addModelBtn = document.getElementById('addModelBtn');
const modelsList = document.getElementById('modelsList');
const userWelcome = document.getElementById('userWelcome');
const defaultModelSelect = document.getElementById('defaultModelSelect');
const setDefaultBtn = document.getElementById('setDefaultBtn');
const defaultModelStatus = document.getElementById('defaultModelStatus');
const modelStatus = document.getElementById('modelStatus');

async function init() {
	// Update the login/logout link
	await updateAuthLink();
	
	// Set welcome message
	const currentUser = getActiveUser();
	userWelcome.textContent = `Welcome, ${currentUser}! Manage your preferences here.`;
	
	// Load preferences
	await loadPreferencesIntoUI();
	
	// Load voice models
	await refreshModels();
	
	// Add TTS test section
	addTTSTestSection();
	
	// Set up default model selection
	setupDefaultModelSelection();
}

async function loadPreferencesIntoUI() {
	try {
		const res = await authenticatedFetch('/api/memory/preferences');
		if (!res) return; // Redirect happened
		
		const prefs = await res.json();
		const user = getActiveUser();
		const p = (prefs.users && prefs.users[user]) || {};
		showNotifications.checked = p.showNotifications || false;
	} catch (error) {
		if (handleUnauthorizedError(error)) return; // Redirect happened
		console.error('Failed to load preferences:', error);
	}
}

async function refreshModels() {
	try {
		const res = await authenticatedFetch('/api/models');
		if (!res) return; // Redirect happened
		
		const data = await res.json();
		const models = data.voiceModels || [];
		
		// Update models list
		modelsList.innerHTML = '';
		for (const model of models) {
			const row = document.createElement('div');
			row.className = 'flex items-center justify-between p-3 bg-[#0b1020] border border-slate-600 rounded-lg';
			
			const defaultBadge = model.isDefault ? '<span class="px-2 py-1 text-xs rounded bg-green-700 text-white mr-2">Default</span>' : '';
			const setDefaultBtn = model.isDefault ? '' : `<button onclick="setDefaultModel('${model.id}')" class="px-2 py-1 text-xs rounded bg-blue-700 hover:bg-blue-600 mr-2 transition-colors">Set Default</button>`;
			
			row.innerHTML = `
				<div class="flex items-center">
					${defaultBadge}
					<span class="text-sm font-medium">${model.name || model.id}</span>
					<span class="text-xs text-slate-400 ml-2">(${model.id})</span>
				</div>
				<div class="flex items-center">
					${setDefaultBtn}
					<button onclick="deleteModel('${model.id}')" class="px-2 py-1 text-xs rounded bg-red-700 hover:bg-red-600 transition-colors">Delete</button>
				</div>
			`;
			modelsList.appendChild(row);
		}
		
		// Update default model dropdown
		updateDefaultModelDropdown(models);
		
		// Show status
		if (models.length === 0) {
			modelStatus.innerHTML = '<div class="text-yellow-400">No voice models configured. Add a model to get started.</div>';
		} else {
			modelStatus.innerHTML = `<div class="text-green-400">${models.length} voice model${models.length > 1 ? 's' : ''} available</div>`;
		}
		
	} catch (error) {
		if (handleUnauthorizedError(error)) return; // Redirect happened
		modelsList.innerHTML = '<div class="text-red-400">Failed to load models</div>';
		modelStatus.innerHTML = '<div class="text-red-400">Error loading voice models</div>';
		console.error('Failed to load models:', error);
	}
}

function updateDefaultModelDropdown(models) {
	console.log('Updating default model dropdown with models:', models);
	
	defaultModelSelect.innerHTML = '<option value="">Select default model...</option>';
	
	for (const model of models) {
		const option = document.createElement('option');
		option.value = model.id;
		option.textContent = `${model.name || model.id}${model.isDefault ? ' (Current Default)' : ''}`;
		if (model.isDefault) {
			option.selected = true;
		}
		defaultModelSelect.appendChild(option);
	}
	
	// Update button state
	const hasSelection = defaultModelSelect.value && defaultModelSelect.value !== '';
	console.log('Dropdown value:', defaultModelSelect.value, 'Has selection:', hasSelection);
	setDefaultBtn.disabled = !hasSelection;
	
	// Force enable button if there's a selection (in case of UI issues)
	if (hasSelection) {
		setDefaultBtn.disabled = false;
	}
	
	// Update status
	const defaultModel = models.find(m => m.isDefault);
	if (defaultModel) {
		defaultModelStatus.innerHTML = `<div class="text-green-400">Current default: ${defaultModel.name || defaultModel.id}</div>`;
	} else {
		defaultModelStatus.innerHTML = '<div class="text-yellow-400">No default model set</div>';
	}
}

function setupDefaultModelSelection() {
	console.log('Setting up default model selection');
	
	defaultModelSelect.addEventListener('change', () => {
		console.log('Dropdown changed to:', defaultModelSelect.value);
		const hasSelection = defaultModelSelect.value && defaultModelSelect.value !== '';
		setDefaultBtn.disabled = !hasSelection;
	});
	
	setDefaultBtn.addEventListener('click', async () => {
		console.log('Set default button clicked!');
		const selectedModelId = defaultModelSelect.value;
		console.log('Set default button clicked with model ID:', selectedModelId);
		
		if (!selectedModelId) {
			console.log('No model selected, returning');
			alert('Please select a model first');
			return;
		}
		
		try {
			setDefaultBtn.disabled = true;
			setDefaultBtn.textContent = 'Setting...';
			
			console.log('Sending request to set default model:', selectedModelId);
			const res = await authenticatedFetch('/api/models/set-default', { 
				method: 'POST', 
				headers: { 'Content-Type': 'application/json' }, 
				body: JSON.stringify({ id: selectedModelId }) 
			});
			if (!res) return; // Redirect happened
			
			console.log('Response received:', res.status);
			
			// Refresh the models to update the interface
			await refreshModels();
			
			// Show success message
			modelStatus.innerHTML = '<div class="text-green-400">Default model updated successfully!</div>';
			setTimeout(() => {
				modelStatus.innerHTML = '';
			}, 3000);
			
		} catch (error) {
			if (handleUnauthorizedError(error)) return; // Redirect happened
			modelStatus.innerHTML = '<div class="text-red-400">Failed to set default model</div>';
			console.error('Failed to set default model:', error);
		} finally {
			setDefaultBtn.disabled = false;
			setDefaultBtn.textContent = 'Set as Default';
		}
	});
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
			const response = await authenticatedFetch('/api/tts/test');
			if (!response) return; // Redirect happened
			
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
			if (handleUnauthorizedError(error)) return; // Redirect happened
			
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
	const user = getActiveUser();
	const body = { users: {} };
	body.users[user] = {
		showNotifications: showNotifications.checked
	};
	
	try {
		const res = await authenticatedFetch('/api/memory/preferences', { 
			method: 'POST', 
			headers: { 'Content-Type': 'application/json' }, 
			body: JSON.stringify(body) 
		});
		if (!res) return; // Redirect happened
		
		// Show success message
		const originalText = savePrefsBtn.textContent;
		savePrefsBtn.textContent = 'Saved!';
		setTimeout(() => {
			savePrefsBtn.textContent = originalText;
		}, 1500);
	} catch (error) {
		if (handleUnauthorizedError(error)) return; // Redirect happened
		console.error('Failed to save preferences:', error);
	}
});

addModelBtn?.addEventListener('click', async () => {
	const id = prompt('Enter model ID:');
	const name = prompt('Enter model name (optional):');
	
	if (!id) return;
	
	try {
		const res = await authenticatedFetch('/api/models', { 
			method: 'POST', 
			headers: { 'Content-Type': 'application/json' }, 
			body: JSON.stringify({ id, name }) 
		});
		if (!res) return; // Redirect happened
		
		if (res.ok) {
			await refreshModels();
			modelStatus.innerHTML = '<div class="text-green-400">Voice model added successfully!</div>';
			setTimeout(() => {
				modelStatus.innerHTML = '';
			}, 3000);
		} else {
			const errorData = await res.json();
			modelStatus.innerHTML = `<div class="text-red-400">Failed to add model: ${errorData.error}</div>`;
		}
	} catch (error) {
		if (handleUnauthorizedError(error)) return; // Redirect happened
		modelStatus.innerHTML = '<div class="text-red-400">Failed to add model</div>';
		console.error('Failed to add model:', error);
	}
});

// Global function for delete buttons
window.deleteModel = async function(modelId) {
	if (!confirm('Delete this voice model?')) return;
	
	try {
		const res = await authenticatedFetch('/api/models/delete', { 
			method: 'POST', 
			headers: { 'Content-Type': 'application/json' }, 
			body: JSON.stringify({ id: modelId }) 
		});
		if (!res) return; // Redirect happened
		
		if (res.ok) {
			await refreshModels();
			modelStatus.innerHTML = '<div class="text-green-400">Voice model deleted successfully!</div>';
			setTimeout(() => {
				modelStatus.innerHTML = '';
			}, 3000);
		} else {
			const errorData = await res.json();
			modelStatus.innerHTML = `<div class="text-red-400">Failed to delete model: ${errorData.error}</div>`;
		}
	} catch (error) {
		if (handleUnauthorizedError(error)) return; // Redirect happened
		modelStatus.innerHTML = '<div class="text-red-400">Failed to delete model</div>';
		console.error('Failed to delete model:', error);
	}
};

// Global function for setting default model
window.setDefaultModel = async function(modelId) {
	if (!confirm('Set this as the default voice model?')) return;
	
	try {
		const res = await authenticatedFetch('/api/models/set-default', { 
			method: 'POST', 
			headers: { 'Content-Type': 'application/json' }, 
			body: JSON.stringify({ id: modelId }) 
		});
		if (!res) return; // Redirect happened
		
		if (res.ok) {
			await refreshModels();
			modelStatus.innerHTML = '<div class="text-green-400">Default model updated successfully!</div>';
			setTimeout(() => {
				modelStatus.innerHTML = '';
			}, 3000);
		} else {
			const errorData = await res.json();
			modelStatus.innerHTML = `<div class="text-red-400">Failed to set default model: ${errorData.error}</div>`;
		}
	} catch (error) {
		if (handleUnauthorizedError(error)) return; // Redirect happened
		modelStatus.innerHTML = '<div class="text-red-400">Failed to set default model</div>';
		console.error('Failed to set default model:', error);
	}
};

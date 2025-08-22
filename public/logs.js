// Real-time logs functionality
let eventSource = null;
let logs = [];
let maxEntries = 1000;
let autoScroll = true;
let showDebug = false;
let currentFilter = 'all';

// DOM elements
const logsContainer = document.getElementById('logsContainer');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const logCount = document.getElementById('logCount');
const lastUpdate = document.getElementById('lastUpdate');
const clearLogsBtn = document.getElementById('clearLogs');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
	initializeControls();
	connectToLogs();
});

function initializeControls() {
	// Auto-scroll toggle
	document.getElementById('autoScroll').addEventListener('change', (e) => {
		autoScroll = e.target.checked;
		if (autoScroll) {
			scrollToBottom();
		}
	});

	// Debug toggle
	document.getElementById('showDebug').addEventListener('change', (e) => {
		showDebug = e.target.checked;
		renderLogs();
	});

	// Filter dropdown
	document.getElementById('logFilter').addEventListener('change', (e) => {
		currentFilter = e.target.value;
		renderLogs();
	});

	// Max entries input
	document.getElementById('maxEntries').addEventListener('change', (e) => {
		maxEntries = parseInt(e.target.value) || 1000;
		trimLogs();
		renderLogs();
	});

	// Clear logs button
	clearLogsBtn.addEventListener('click', () => {
		logs = [];
		renderLogs();
		updateLogCount();
	});
}

function connectToLogs() {
	updateConnectionStatus('connecting', 'Connecting to server...');
	
	// Close existing connection
	if (eventSource) {
		eventSource.close();
	}

	// Create new connection
	eventSource = new EventSource('/api/logs/stream');
	
	eventSource.onopen = () => {
		updateConnectionStatus('connected', 'Connected - receiving logs');
	};
	
	eventSource.onmessage = (event) => {
		try {
			const logEntry = JSON.parse(event.data);
			addLogEntry(logEntry);
		} catch (error) {
			console.error('Error parsing log entry:', error);
		}
	};
	
	eventSource.onerror = (error) => {
		console.error('Log stream error:', error);
		updateConnectionStatus('error', 'Connection lost - retrying...');
		
		// Reconnect after 5 seconds
		setTimeout(() => {
			if (eventSource.readyState === EventSource.CLOSED) {
				connectToLogs();
			}
		}, 5000);
	};
}

function updateConnectionStatus(status, message) {
	statusText.textContent = message;
	
	// Update indicator color
	statusIndicator.className = 'w-3 h-3 rounded-full';
	switch (status) {
		case 'connected':
			statusIndicator.classList.add('bg-green-500');
			break;
		case 'connecting':
			statusIndicator.classList.add('bg-yellow-500', 'animate-pulse');
			break;
		case 'error':
			statusIndicator.classList.add('bg-red-500', 'animate-pulse');
			break;
	}
}

function addLogEntry(entry) {
	// Add timestamp if not present
	if (!entry.timestamp) {
		entry.timestamp = new Date().toISOString();
	}
	
	// Add to logs array
	logs.unshift(entry);
	
	// Trim if too many entries
	trimLogs();
	
	// Render logs
	renderLogs();
	
	// Update counters
	updateLogCount();
	updateLastUpdate();
	
	// Auto-scroll if enabled
	if (autoScroll) {
		scrollToBottom();
	}
}

function trimLogs() {
	if (logs.length > maxEntries) {
		logs = logs.slice(0, maxEntries);
	}
}

function renderLogs() {
	const filteredLogs = logs.filter(log => {
		// Apply debug filter
		if (!showDebug && log.level === 'debug') {
			return false;
		}
		
		// Apply category filter
		switch (currentFilter) {
			case 'audio':
				return log.category === 'audio' || log.message.includes('audio') || log.message.includes('TTS');
			case 'job':
				return log.category === 'job' || log.message.includes('job') || log.message.includes('Job');
			case 'error':
				return log.level === 'error';
			case 'system':
				return log.category === 'system' || log.message.includes('Server') || log.message.includes('PM2');
			default:
				return true;
		}
	});
	
	// Clear container
	logsContainer.innerHTML = '';
	
	if (filteredLogs.length === 0) {
		logsContainer.innerHTML = `
			<div class="text-slate-500 text-center py-8">
				No logs match the current filter
			</div>
		`;
		return;
	}
	
	// Render each log entry
	filteredLogs.forEach(log => {
		const logElement = createLogElement(log);
		logsContainer.appendChild(logElement);
	});
}

function createLogElement(log) {
	const timestamp = new Date(log.timestamp).toLocaleTimeString();
	const level = log.level || 'info';
	const category = log.category || 'general';
	
	const logElement = document.createElement('div');
	logElement.className = `log-entry p-3 border-l-4 bg-[#0f141f] hover:bg-[#1a1f2e] transition-colors ${level}`;
	
	logElement.innerHTML = `
		<div class="flex items-start justify-between">
			<div class="flex-1">
				<div class="flex items-center space-x-2 mb-1">
					<span class="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300">${level.toUpperCase()}</span>
					<span class="text-xs px-2 py-1 rounded bg-indigo-900 text-indigo-300">${category}</span>
					<span class="text-xs text-slate-500">${timestamp}</span>
				</div>
				<div class="text-slate-300">${escapeHtml(log.message)}</div>
				${log.details ? `<div class="text-xs text-slate-500 mt-1">${escapeHtml(log.details)}</div>` : ''}
			</div>
		</div>
	`;
	
	return logElement;
}

function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

function updateLogCount() {
	const totalCount = logs.length;
	const filteredCount = logs.filter(log => {
		if (!showDebug && log.level === 'debug') return false;
		switch (currentFilter) {
			case 'audio': return log.category === 'audio' || log.message.includes('audio') || log.message.includes('TTS');
			case 'job': return log.category === 'job' || log.message.includes('job') || log.message.includes('Job');
			case 'error': return log.level === 'error';
			case 'system': return log.category === 'system' || log.message.includes('Server') || log.message.includes('PM2');
			default: return true;
		}
	}).length;
	
	logCount.textContent = `${filteredCount} of ${totalCount} entries`;
}

function updateLastUpdate() {
	lastUpdate.textContent = new Date().toLocaleTimeString();
}

function scrollToBottom() {
	logsContainer.scrollTop = logsContainer.scrollHeight;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
	if (eventSource) {
		eventSource.close();
	}
});

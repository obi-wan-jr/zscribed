import { fetchMeta, getActiveUser, setActiveUser, updateAuthLink, requireAuth, authenticatedFetch, handleUnauthorizedError } from './common.js';

// Check authentication first
requireAuth().then(isAuthenticated => {
	if (!isAuthenticated) return; // Will redirect to login
	
	// Initialize the page
	init();
});

const refreshBtn = document.getElementById('refreshBtn');
const cleanupBtn = document.getElementById('cleanupBtn');
const filesList = document.getElementById('filesList');
const fileCount = document.getElementById('fileCount');
const lastRefresh = document.getElementById('lastRefresh');

let currentAudio = null; // Track currently playing audio

async function init() {
	// Update the login/logout link
	await updateAuthLink();
	
	// Load files
	await refreshFiles();
	
	// Set up event listeners
	refreshBtn.addEventListener('click', refreshFiles);
	cleanupBtn.addEventListener('click', cleanupChunks);
	
	// Auto-refresh every 30 seconds if user has that preference
	setInterval(async () => {
		const prefs = await getPreferences();
		if (prefs.autoRefresh) {
			await refreshFiles();
		}
	}, 30000);
}

async function getPreferences() {
	try {
		const res = await authenticatedFetch('/api/memory/preferences');
		if (!res) return { autoRefresh: false };
		
		const prefs = await res.json();
		const user = getActiveUser();
		return (prefs.users && prefs.users[user]) || { autoRefresh: false };
	} catch (error) {
		return { autoRefresh: false };
	}
}

async function refreshFiles() {
	try {
		refreshBtn.disabled = true;
		refreshBtn.textContent = 'Refreshing...';
		
		const res = await authenticatedFetch('/api/outputs');
		if (!res) return; // Redirect happened
		
		const data = await res.json();
		displayFiles(data.files || []);
		
		// Update metadata
		fileCount.textContent = `${data.files?.length || 0} files`;
		lastRefresh.textContent = new Date().toLocaleTimeString();
		
	} catch (error) {
		if (handleUnauthorizedError(error)) return; // Redirect happened
		console.error('Failed to refresh files:', error);
		filesList.innerHTML = '<div class="text-red-400 text-center py-8">Failed to load files</div>';
	} finally {
		refreshBtn.disabled = false;
		refreshBtn.textContent = 'Refresh';
	}
}

function displayFiles(files) {
	if (files.length === 0) {
		filesList.innerHTML = '<div class="text-slate-500 text-center py-8">No audio files found</div>';
		return;
	}
	
	// Sort files by creation time (newest first)
	files.sort((a, b) => {
		// Extract timestamp from filename if possible
		const aTime = extractTimestamp(a.name);
		const bTime = extractTimestamp(b.name);
		return bTime - aTime;
	});
	
	filesList.innerHTML = '';
	
	files.forEach(file => {
		const fileElement = createFileElement(file);
		filesList.appendChild(fileElement);
	});
}

function extractTimestamp(filename) {
	// Try to extract timestamp from filename patterns like:
	// user-bible-book-voiceId-HH-MM-SS-YYYY-MM-DD.mp3
	const match = filename.match(/(\d{2})-(\d{2})-(\d{2})-(\d{4})-(\d{2})-(\d{2})/);
	if (match) {
		const [, hour, minute, second, year, month, day] = match;
		return new Date(year, month - 1, day, hour, minute, second).getTime();
	}
	
	// Fallback to file modification time or current time
	return Date.now();
}

function createFileElement(file) {
	const div = document.createElement('div');
	div.className = 'flex items-center justify-between p-3 bg-[#0f141f] hover:bg-[#1a1f2e] rounded-lg transition-colors';
	
	const fileName = file.name;
	const fileSize = formatFileSize(file.size || 0);
	const fileType = getFileType(fileName);
	
	div.innerHTML = `
		<div class="flex items-center space-x-3 flex-1">
			<div class="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
				<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
				</svg>
			</div>
			<div class="flex-1 min-w-0">
				<div class="text-sm font-medium text-indigo-200 truncate cursor-pointer hover:text-indigo-300" onclick="playAudio('${file.url}', '${fileName}')">
					${fileName}
				</div>
				<div class="text-xs text-slate-400">
					${fileType} • ${fileSize}
				</div>
			</div>
		</div>
		<div class="flex items-center space-x-2">
			<button onclick="downloadFile('${file.url}', '${fileName}')" class="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 rounded transition-colors">
				Download
			</button>
			<button onclick="deleteFile('${fileName}')" class="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 rounded transition-colors">
				Delete
			</button>
		</div>
	`;
	
	return div;
}

function formatFileSize(bytes) {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileType(filename) {
	const ext = filename.split('.').pop().toLowerCase();
	switch (ext) {
		case 'mp3': return 'MP3 Audio';
		case 'wav': return 'WAV Audio';
		case 'm4a': return 'M4A Audio';
		default: return 'Audio File';
	}
}

async function cleanupChunks() {
	try {
		cleanupBtn.disabled = true;
		cleanupBtn.textContent = 'Cleaning...';
		
		const res = await authenticatedFetch('/api/cleanup/chunks', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			}
		});
		
		if (!res) return; // Redirect happened
		
		const result = await res.json();
		
		if (result.success) {
			// Refresh the file list after cleanup
			await refreshFiles();
			showNotification(`Cleanup completed: ${result.deletedCount} files removed`, 'success');
		} else {
			showNotification('Cleanup failed', 'error');
		}
		
	} catch (error) {
		if (handleUnauthorizedError(error)) return; // Redirect happened
		console.error('Cleanup failed:', error);
		showNotification('Cleanup failed', 'error');
	} finally {
		cleanupBtn.disabled = false;
		cleanupBtn.textContent = 'Cleanup Chunks';
	}
}

async function deleteFile(filename) {
	if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
		return;
	}
	
	try {
		const res = await authenticatedFetch('/api/outputs/delete', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ name: filename })
		});
		
		if (!res) return; // Redirect happened
		
		const result = await res.json();
		
		if (result.ok) {
			// Refresh the file list
			await refreshFiles();
			showNotification('File deleted successfully', 'success');
		} else {
			showNotification('Failed to delete file', 'error');
		}
		
	} catch (error) {
		if (handleUnauthorizedError(error)) return; // Redirect happened
		console.error('Delete failed:', error);
		showNotification('Failed to delete file', 'error');
	}
}

function downloadFile(url, filename) {
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	showNotification('Download started', 'success');
}

function playAudio(url, filename) {
	// Stop current audio if playing
	if (currentAudio) {
		currentAudio.pause();
		currentAudio = null;
	}
	
	// Create new audio element
	currentAudio = new Audio(url);
	currentAudio.addEventListener('ended', () => {
		currentAudio = null;
	});
	
	currentAudio.play().then(() => {
		showNotification(`Playing: ${filename}`, 'success');
	}).catch(error => {
		console.error('Failed to play audio:', error);
		showNotification('Failed to play audio', 'error');
		currentAudio = null;
	});
}

function showNotification(message, type = 'info') {
	// Check if user has notifications enabled
	getPreferences().then(prefs => {
		if (!prefs.showNotifications) return;
		
		// Create notification element
		const notification = document.createElement('div');
		notification.className = `fixed top-4 right-4 px-4 py-2 rounded-lg text-white text-sm z-50 transition-all duration-300 ${
			type === 'success' ? 'bg-green-600' :
			type === 'error' ? 'bg-red-600' :
			'bg-blue-600'
		}`;
		notification.textContent = message;
		
		document.body.appendChild(notification);
		
		// Remove after 3 seconds
		setTimeout(() => {
			notification.remove();
		}, 3000);
	});
}

// Make functions globally available for onclick handlers
window.playAudio = playAudio;
window.downloadFile = downloadFile;
window.deleteFile = deleteFile;

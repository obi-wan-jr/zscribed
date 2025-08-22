export async function fetchMeta() {
	const res = await fetch('/api/config/meta');
	return res.json();
}

export function getActiveUser() {
	return localStorage.getItem('activeUser') || 'Inggo';
}

export function setActiveUser(user) {
	localStorage.setItem('activeUser', user);
}

export function listenToProgress(jobId, onMessage) {
	let reconnectAttempts = 0;
	const maxReconnectAttempts = 3;
	const reconnectDelay = 2000; // 2 seconds
	
	function createEventSource() {
		const ev = new EventSource(`/api/progress/${jobId}`);
		
		ev.onmessage = (e) => {
			const data = JSON.parse(e.data);
			onMessage?.(data, ev);
			if (data.status === 'completed' || data.status === 'error') {
				ev.close();
			}
		};
		
		ev.onerror = (error) => {
			console.warn(`Progress connection lost for job ${jobId}, attempt ${reconnectAttempts + 1}/${maxReconnectAttempts}`);
			ev.close();
			
			// Notify about connection loss
			onMessage?.({ 
				status: 'connection_lost', 
				message: `⚠️ Progress tracking connection lost (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})` 
			}, ev);
			
			// Attempt to reconnect
			if (reconnectAttempts < maxReconnectAttempts) {
				reconnectAttempts++;
				setTimeout(() => {
					console.log(`Attempting to reconnect progress tracking for job ${jobId}...`);
					createEventSource();
				}, reconnectDelay);
			} else {
				console.error(`Failed to reconnect progress tracking for job ${jobId} after ${maxReconnectAttempts} attempts`);
				onMessage?.({ 
					status: 'connection_failed', 
					message: '❌ Progress tracking connection failed. Job may still be running - check the Active Jobs section.' 
				}, ev);
			}
		};
		
		return ev;
	}
	
	return createEventSource();
}

export async function logout() {
	try {
		await fetch('/api/auth/logout', { method: 'POST' });
	} catch (e) {
		console.warn('Logout request failed:', e);
	}
	window.location.href = '/login.html';
}

export function addLogoutButton() {
	const nav = document.querySelector('nav div:last-child');
	if (nav) {
		const logoutBtn = document.createElement('a');
		logoutBtn.href = '#';
		logoutBtn.textContent = 'Logout';
		logoutBtn.className = 'hover:text-white text-red-400';
		logoutBtn.onclick = (e) => {
			e.preventDefault();
			logout();
		};
		nav.appendChild(logoutBtn);
	}
}

// Check if user is authenticated
export async function checkAuth() {
	try {
		const res = await fetch('/api/health');
		if (res.ok) {
			// Check if we have a session by trying to access a protected endpoint
			const protectedRes = await fetch('/api/models');
			return protectedRes.ok;
		}
		return false;
	} catch (e) {
		return false;
	}
}

// Update login/logout link based on auth status
export async function updateAuthLink() {
	const link = document.getElementById('loginLogoutLink');
	if (!link) return;
	
	const isAuthenticated = await checkAuth();
	
	if (isAuthenticated) {
		link.textContent = 'Logout';
		link.href = '#';
		link.onclick = (e) => {
			e.preventDefault();
			logout();
		};
	} else {
		link.textContent = 'Login';
		link.href = '/login.html';
		link.onclick = null;
	}
}

// Check auth and redirect if needed
export async function requireAuth() {
	const isAuthenticated = await checkAuth();
	if (!isAuthenticated) {
		window.location.href = '/login.html';
		return false;
	}
	return true;
}

// Handle unauthorized errors and force relogin
export function handleUnauthorizedError(error) {
	if (error.message && error.message.includes('Unauthorized')) {
		console.log('Unauthorized error detected, redirecting to login...');
		// Clear any stored auth data
		localStorage.removeItem('activeUser');
		// Redirect to login
		window.location.href = '/login.html';
		return true; // Indicates we handled the unauthorized error
	}
	return false; // Not an unauthorized error
}

// Enhanced fetch wrapper that handles unauthorized errors
export async function authenticatedFetch(url, options = {}) {
	try {
		const response = await fetch(url, options);
		
		// Check for unauthorized response
		if (response.status === 401) {
			console.log('401 Unauthorized response, redirecting to login...');
			// Clear any stored auth data
			localStorage.removeItem('activeUser');
			// Redirect to login
			window.location.href = '/login.html';
			return null; // Return null to indicate redirect happened
		}
		
		return response;
	} catch (error) {
		// Handle network errors that might be auth-related
		if (handleUnauthorizedError(error)) {
			return null; // Return null to indicate redirect happened
		}
		throw error; // Re-throw other errors
	}
}

// Job management functions
export async function fetchUserJobs() {
	try {
		const res = await authenticatedFetch('/api/jobs/my');
		if (!res) return null; // Redirect happened
		
		const data = await res.json();
		return data;
	} catch (error) {
		console.error('Failed to fetch user jobs:', error);
		return { active: [], pending: [] };
	}
}

export async function cancelJob(jobId) {
	try {
		const res = await authenticatedFetch('/api/jobs/cancel', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ jobId })
		});
		
		if (!res) return false; // Redirect happened
		
		const result = await res.json();
		return result.success;
	} catch (error) {
		console.error('Failed to cancel job:', error);
		return false;
	}
}

export function formatJobDuration(seconds) {
	if (seconds < 60) {
		return `${seconds}s`;
	} else if (seconds < 3600) {
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}m ${remainingSeconds}s`;
	} else {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		return `${hours}h ${minutes}m`;
	}
}

export function getJobTypeDisplayName(type) {
	switch (type) {
		case 'tts': return 'Text-to-Speech';
		case 'bible-tts': return 'Bible Audio';
		case 'bible-video': return 'Bible Video';
		default: return type;
	}
}

export function displayActiveJobs(jobsData, containerId = 'activeJobsList', statusId = 'jobsStatus') {
	const container = document.getElementById(containerId);
	const statusElement = document.getElementById(statusId);
	
	if (!container) return;
	
	container.innerHTML = '';
	
	const { active, pending } = jobsData;
	
	// Display active jobs
	if (active.length > 0) {
		active.forEach(job => {
			const jobDiv = document.createElement('div');
			jobDiv.className = 'p-4 bg-[#0a0f1a] rounded border border-slate-600 space-y-3';
			
			jobDiv.innerHTML = `
				<div class="flex items-center justify-between">
					<div class="flex items-center space-x-3">
						<div class="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
							<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
							</svg>
						</div>
						<div>
							<div class="text-orange-300 font-medium">${getJobTypeDisplayName(job.type)}</div>
							<div class="text-xs text-slate-400">Running for ${formatJobDuration(job.duration)}</div>
						</div>
					</div>
					<button class="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 rounded" onclick="cancelJobById('${job.id}')">
						Cancel
					</button>
				</div>
			`;
			
			container.appendChild(jobDiv);
		});
	}
	
	// Display pending jobs
	if (pending.length > 0) {
		pending.forEach(job => {
			const jobDiv = document.createElement('div');
			jobDiv.className = 'p-4 bg-[#0a0f1a] rounded border border-slate-600 space-y-3';
			
			jobDiv.innerHTML = `
				<div class="flex items-center justify-between">
					<div class="flex items-center space-x-3">
						<div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
							<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
							</svg>
						</div>
						<div>
							<div class="text-blue-300 font-medium">${getJobTypeDisplayName(job.type)}</div>
							<div class="text-xs text-slate-400">Queue position: ${job.queuePosition}</div>
						</div>
					</div>
					<button class="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 rounded" onclick="cancelJobById('${job.id}')">
						Cancel
					</button>
				</div>
			`;
			
			container.appendChild(jobDiv);
		});
	}
	
	// Update status
	if (statusElement) {
		const totalJobs = active.length + pending.length;
		if (totalJobs === 0) {
			statusElement.textContent = 'No active or pending jobs';
		} else {
			statusElement.textContent = `${active.length} active, ${pending.length} pending jobs`;
		}
	}
}

// Global function for canceling jobs (needed for onclick handlers)
window.cancelJobById = async (jobId) => {
	if (!confirm(`Are you sure you want to cancel this job?`)) {
		return;
	}
	
	const success = await cancelJob(jobId);
	if (success) {
		// Refresh the jobs display
		const refreshBtn = document.getElementById('refreshJobsBtn');
		if (refreshBtn) {
			refreshBtn.click();
		}
	} else {
		alert('Failed to cancel job. Please try again.');
	}
};

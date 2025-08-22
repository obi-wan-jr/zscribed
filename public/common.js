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



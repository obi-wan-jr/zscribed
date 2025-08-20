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
	const ev = new EventSource(`/api/progress/${jobId}`);
	ev.onmessage = (e) => {
		const data = JSON.parse(e.data);
		onMessage?.(data, ev);
		if (data.status === 'completed' || data.status === 'error') {
			ev.close();
		}
	};
	return ev;
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

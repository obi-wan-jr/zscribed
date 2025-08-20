import { fetchMeta } from './common.js';

const loginForm = document.getElementById('loginForm');
const userName = document.getElementById('userName');
const loginError = document.getElementById('loginError');

init();

async function init() {
	// No longer need to fetch allowedUsers - they're not exposed via API
	// This prevents username enumeration
}

function showError(message) {
	loginError.textContent = message;
	loginError.classList.remove('hidden');
}

function hideError() {
	loginError.classList.add('hidden');
}

loginForm?.addEventListener('submit', async (e) => {
	e.preventDefault();
	hideError();
	
	const inputName = userName.value;
	if (!inputName.trim()) {
		showError('Please enter your name');
		return;
	}
	
	try {
		const res = await fetch('/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ user: inputName.trim() })
		});
		
		if (!res.ok) {
			const data = await res.json();
			if (res.status === 429) {
				throw new Error('Too many login attempts. Please try again in 15 minutes.');
			}
			throw new Error(data.error || 'Login failed');
		}
		
		// Redirect to home page
		window.location.href = '/';
	} catch (e) {
		showError(e.message);
	}
});

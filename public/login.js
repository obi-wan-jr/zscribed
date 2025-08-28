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
	
	console.log('Submitting login form with user:', inputName.trim());
	
	try {
		const res = await fetch('/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ user: inputName.trim() })
		});
		
		console.log('Login response status:', res.status);
		console.log('Login response ok:', res.ok);
		
		if (!res.ok) {
			const data = await res.json();
			console.log('Login error data:', data);
			if (res.status === 429) {
				throw new Error('Too many login attempts. Please try again in 15 minutes.');
			}
			throw new Error(data.error || 'Login failed');
		}
		
		const data = await res.json();
		console.log('Login success data:', data);
		
		// Check if we got cookies
		console.log('Cookies after login:', document.cookie);
		
		// Redirect to home page
		console.log('Redirecting to home page...');
		window.location.href = '/';
	} catch (e) {
		console.error('Login error:', e);
		showError(e.message);
	}
});

import { fetchMeta } from './common.js';

const loginForm = document.getElementById('loginForm');
const userSelect = document.getElementById('userSelect');
const loginError = document.getElementById('loginError');

init();

async function init() {
	try {
		const meta = await fetchMeta();
		userSelect.innerHTML = '<option value="">Choose a user...</option>';
		for (const user of meta.allowedUsers || []) {
			const opt = document.createElement('option');
			opt.value = user;
			opt.textContent = user;
			userSelect.appendChild(opt);
		}
	} catch (e) {
		showError('Failed to load users');
	}
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
	
	const user = userSelect.value;
	if (!user) {
		showError('Please select a user');
		return;
	}
	
	try {
		const res = await fetch('/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ user })
		});
		
		if (!res.ok) {
			const data = await res.json();
			throw new Error(data.error || 'Login failed');
		}
		
		// Redirect to home page
		window.location.href = '/';
	} catch (e) {
		showError(e.message);
	}
});

import { fetchMeta } from './common.js';

const loginForm = document.getElementById('loginForm');
const userName = document.getElementById('userName');
const loginError = document.getElementById('loginError');

let allowedUsers = [];

init();

async function init() {
	try {
		const meta = await fetchMeta();
		allowedUsers = meta.allowedUsers || [];
	} catch (e) {
		showError('Failed to load user list');
	}
}

function showError(message) {
	loginError.textContent = message;
	loginError.classList.remove('hidden');
}

function hideError() {
	loginError.classList.add('hidden');
}

function isValidUser(name) {
	if (!name || !allowedUsers.length) return false;
	const normalizedName = name.trim().toLowerCase();
	return allowedUsers.some(user => user.toLowerCase() === normalizedName);
}

function getNormalizedUserName(name) {
	const normalizedName = name.trim().toLowerCase();
	const user = allowedUsers.find(user => user.toLowerCase() === normalizedName);
	return user || name.trim(); // Return original case from config, or trimmed input
}

loginForm?.addEventListener('submit', async (e) => {
	e.preventDefault();
	hideError();
	
	const inputName = userName.value;
	if (!inputName.trim()) {
		showError('Please enter your name');
		return;
	}
	
	if (!isValidUser(inputName)) {
		showError('Invalid user name. Please try again.');
		return;
	}
	
	const normalizedUser = getNormalizedUserName(inputName);
	
	try {
		const res = await fetch('/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ user: normalizedUser })
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

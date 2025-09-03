// Common utilities for Bible transcription app

export function showNotification(message, type = 'info') {
	// Simple notification system
	const notification = document.createElement('div');
	notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
		type === 'error' ? 'bg-red-600 text-white' :
		type === 'success' ? 'bg-green-600 text-white' :
		'bg-blue-600 text-white'
	}`;
	notification.textContent = message;
	
	document.body.appendChild(notification);
	
	// Auto-remove after 5 seconds
	setTimeout(() => {
		if (notification.parentNode) {
			notification.parentNode.removeChild(notification);
		}
	}, 5000);
}

export function formatFileSize(bytes) {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatTimestamp(timestamp) {
	const date = new Date(timestamp);
	return date.toLocaleString();
}

export function debounce(func, wait) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

export function throttle(func, limit) {
	let inThrottle;
	return function() {
		const args = arguments;
		const context = this;
		if (!inThrottle) {
			func.apply(context, args);
			inThrottle = true;
			setTimeout(() => inThrottle = false, limit);
		}
	};
}

export function validateEmail(email) {
	const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return re.test(email);
}

export function sanitizeHtml(html) {
	const div = document.createElement('div');
	div.textContent = html;
	return div.innerHTML;
}

export function copyToClipboard(text) {
	if (navigator.clipboard && window.isSecureContext) {
		return navigator.clipboard.writeText(text);
	} else {
		// Fallback for older browsers
		const textArea = document.createElement('textarea');
		textArea.value = text;
		textArea.style.position = 'fixed';
		textArea.style.left = '-999999px';
		textArea.style.top = '-999999px';
		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();
		try {
			document.execCommand('copy');
			textArea.remove();
			return Promise.resolve();
		} catch (err) {
			textArea.remove();
			return Promise.reject(err);
		}
	}
}

export function downloadFile(url, filename) {
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}

export function confirmAction(message) {
	return new Promise((resolve) => {
		const result = window.confirm(message);
		resolve(result);
	});
}

export function showLoading(element, text = 'Loading...') {
	if (element) {
		element.disabled = true;
		const originalText = element.textContent;
		element.textContent = text;
		return () => {
			element.disabled = false;
			element.textContent = originalText;
		};
	}
	return () => {};
}

export function hideElement(element) {
	if (element) {
		element.classList.add('hidden');
	}
}

export function showElement(element) {
	if (element) {
		element.classList.remove('hidden');
	}
}

export function toggleElement(element) {
	if (element) {
		element.classList.toggle('hidden');
	}
}

export function setElementText(element, text) {
	if (element) {
		element.textContent = text;
	}
}

export function setElementHTML(element, html) {
	if (element) {
		element.innerHTML = html;
	}
}

export function addClass(element, className) {
	if (element) {
		element.classList.add(className);
	}
}

export function removeClass(element, className) {
	if (element) {
		element.classList.remove(className);
	}
}

export function toggleClass(element, className) {
	if (element) {
		element.classList.toggle(className);
	}
}

export function hasClass(element, className) {
	return element && element.classList.contains(className);
}

export function getElement(selector) {
	return document.querySelector(selector);
}

export function getElements(selector) {
	return document.querySelectorAll(selector);
}

export function createElement(tag, className = '', textContent = '') {
	const element = document.createElement(tag);
	if (className) element.className = className;
	if (textContent) element.textContent = textContent;
	return element;
}

export function appendChild(parent, child) {
	if (parent && child) {
		parent.appendChild(child);
	}
}

export function removeChild(parent, child) {
	if (parent && child) {
		parent.removeChild(child);
	}
}

export function clearElement(element) {
	if (element) {
		element.innerHTML = '';
	}
}

export function scrollToElement(element, behavior = 'smooth') {
	if (element) {
		element.scrollIntoView({ behavior });
	}
}

export function scrollToTop(behavior = 'smooth') {
	window.scrollTo({ top: 0, behavior });
}

export function scrollToBottom(element, behavior = 'smooth') {
	if (element) {
		element.scrollTop = element.scrollHeight;
	}
}

export function isElementVisible(element) {
	if (!element) return false;
	const rect = element.getBoundingClientRect();
	return rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth;
}

export function isElementInViewport(element) {
	if (!element) return false;
	const rect = element.getBoundingClientRect();
	return (
		rect.top >= 0 &&
		rect.left >= 0 &&
		rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
		rect.right <= (window.innerWidth || document.documentElement.clientWidth)
	);
}



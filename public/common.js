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

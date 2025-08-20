import fs from 'fs';
import path from 'path';

const MEMORY_FILE = 'memory.json';

export function loadPreferences(rootDir) {
	const p = path.join(rootDir, 'storage', MEMORY_FILE);
	try {
		if (!fs.existsSync(p)) return { users: {} };
		const raw = fs.readFileSync(p, 'utf-8');
		const data = JSON.parse(raw);
		return data && typeof data === 'object' ? data : { users: {} };
	} catch {
		return { users: {} };
	}
}

export function savePreferences(rootDir, prefs) {
	const p = path.join(rootDir, 'storage', MEMORY_FILE);
	fs.mkdirSync(path.dirname(p), { recursive: true });
	const safe = prefs && typeof prefs === 'object' ? prefs : { users: {} };
	fs.writeFileSync(p, JSON.stringify(safe, null, 2));
	return safe;
}

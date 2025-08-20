import fs from 'fs';
import path from 'path';

export function loadConfig(rootDir) {
	const configPath = path.join(rootDir, 'config', 'config.json');
	const examplePath = path.join(rootDir, 'config', 'config.example.json');
	let raw;
	if (fs.existsSync(configPath)) {
		raw = fs.readFileSync(configPath, 'utf-8');
	} else if (fs.existsSync(examplePath)) {
		raw = fs.readFileSync(examplePath, 'utf-8');
	} else {
		return {};
	}
	try {
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

export function saveConfig(rootDir, nextConfig) {
	const configPath = path.join(rootDir, 'config', 'config.json');
	const current = loadConfig(rootDir);
	const merged = { ...current, ...nextConfig };
	fs.mkdirSync(path.dirname(configPath), { recursive: true });
	fs.writeFileSync(configPath, JSON.stringify(merged, null, 2));
	return merged;
}

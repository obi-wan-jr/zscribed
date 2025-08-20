import fs from 'fs';
import path from 'path';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export class UserLogger {
	constructor(baseDir) {
		this.baseDir = baseDir;
	}

	ensureDir(dir) {
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	}

	log(user, event) {
		const now = Date.now();
		const userDir = path.join(this.baseDir, user);
		this.ensureDir(userDir);
		const file = path.join(userDir, `${new Date(now).toISOString().slice(0, 10)}.log.jsonl`);
		fs.appendFileSync(file, JSON.stringify({ ts: now, ...event }) + '\n');
	}

	prune() {
		if (!fs.existsSync(this.baseDir)) return;
		for (const user of fs.readdirSync(this.baseDir)) {
			const userDir = path.join(this.baseDir, user);
			for (const file of fs.readdirSync(userDir)) {
				const full = path.join(userDir, file);
				const stat = fs.statSync(full);
				if (Date.now() - stat.mtimeMs > THIRTY_DAYS_MS) {
					fs.unlinkSync(full);
				}
			}
		}
	}
}

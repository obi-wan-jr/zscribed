export function parseVerseRanges(input) {
	if (!input || typeof input !== 'string') return [];
	const parts = input.split(',').map(s => s.trim()).filter(Boolean);
	const verses = new Set();
	for (const part of parts) {
		if (/^\d+$/.test(part)) {
			verses.add(Number(part));
			continue;
		}
		const m = part.match(/^(\d+)-(\d+)$/);
		if (m) {
			const start = Number(m[1]);
			const end = Number(m[2]);
			if (start <= end) {
				for (let v = start; v <= end; v++) verses.add(v);
			}
		}
	}
	return Array.from(verses).sort((a, b) => a - b);
}

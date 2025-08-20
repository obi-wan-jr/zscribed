export function splitIntoSentences(text) {
	if (!text) return [];
	// Basic split on periods/question marks/exclamations
	const parts = String(text)
		.split(/(?<=[\.\!\?])\s+/)
		.map(s => s.trim())
		.filter(Boolean);
	return parts;
}

export function groupSentences(sentences, sentencesPerChunk = 3) {
	const chunks = [];
	let current = [];
	for (const s of sentences) {
		current.push(s);
		if (current.length >= Math.max(1, sentencesPerChunk)) {
			chunks.push(current.join(' '));
			current = [];
		}
	}
	if (current.length) chunks.push(current.join(' '));
	return chunks;
}

export async function fetchBibleText({ translation, book, chapter, verses }) {
	// Dummy data: generate synthetic verses
	const chosen = verses && verses.length ? verses : Array.from({ length: 10 }, (_, i) => i + 1);
	const lines = chosen.map(v => `${v} This is a dummy verse ${v} from ${book} ${chapter} (${translation}).`);
	return lines.join(' ');
}

export function cleanupBibleText(raw, { excludeNumbers = true, excludeFootnotes = true } = {}) {
	let text = raw || '';
	if (excludeNumbers) {
		text = text.replace(/\b\d+\s+/g, '');
	}
	if (excludeFootnotes) {
		// Placeholder: remove [a], [b], (a), (footnote) etc.
		text = text.replace(/\[[^\]]*\]|\([^\)]*\)/g, '');
	}
	return text.replace(/\s+/g, ' ').trim();
}

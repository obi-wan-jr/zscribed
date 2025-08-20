import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanupBibleText } from '../server/bible/dummyProvider.js';

test('cleanup removes verse numbers', () => {
	const raw = '1 In the beginning 2 God created';
	const out = cleanupBibleText(raw, { excludeNumbers: true, excludeFootnotes: false });
	assert.equal(out, 'In the beginning God created');
});

test('cleanup removes bracketed/parenthetical footnotes', () => {
	const raw = 'In the [a] beginning (note) God created';
	const out = cleanupBibleText(raw, { excludeNumbers: false, excludeFootnotes: true });
	assert.equal(out, 'In the beginning God created');
});

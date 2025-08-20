import test from 'node:test';
import assert from 'node:assert/strict';
import { splitIntoSentences, groupSentences } from '../server/text/segment.js';

test('splitIntoSentences splits on punctuation', () => {
	const s = 'Hello world. How are you? Great!';
	const parts = splitIntoSentences(s);
	assert.deepEqual(parts, ['Hello world.', 'How are you?', 'Great!']);
});

test('groupSentences groups by size', () => {
	const parts = ['A.', 'B.', 'C.', 'D.'];
	assert.deepEqual(groupSentences(parts, 2), ['A. B.', 'C. D.']);
	assert.deepEqual(groupSentences(parts, 3), ['A. B. C.', 'D.']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVerseRanges } from '../server/bible/verseRange.js';

test('parseVerseRanges handles single numbers', () => {
	assert.deepEqual(parseVerseRanges('3'), [3]);
});

test('parseVerseRanges handles ranges', () => {
	assert.deepEqual(parseVerseRanges('3-5'), [3,4,5]);
});

test('parseVerseRanges handles multiple parts', () => {
	assert.deepEqual(parseVerseRanges('3-5,7,9-11'), [3,4,5,7,9,10,11]);
});

test('parseVerseRanges dedupes and sorts', () => {
	assert.deepEqual(parseVerseRanges('5,3-5,4'), [3,4,5]);
});

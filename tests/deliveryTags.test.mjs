import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TAG_CATEGORIES,
  RETEST_TAGS,
  TAGS_TESTED_ON,
  allTags,
  isKnownTag,
} from '../src/deliveryTags.js';

test('categories hold exactly the listed names', () => {
  const lengths = TAG_CATEGORIES.map((c) => c.tags.length);
  assert.deepEqual(lengths, [10, 5, 9, 4, 13, 4, 3, 8]);
});

test('allTags length equals the sum of the category lengths', () => {
  const sum = TAG_CATEGORIES.reduce((n, c) => n + c.tags.length, 0);
  assert.equal(allTags().length, sum);
  assert.equal(allTags().length, 56);
});

test('no duplicate names across categories', () => {
  const names = allTags().map((t) => t.toLowerCase());
  assert.equal(new Set(names).size, names.length);
});

test('isKnownTag is case-insensitive and trims', () => {
  assert.ok(isKnownTag('Slowly'));
  assert.ok(isKnownTag('  under one\'s breath  '));
  assert.equal(isKnownTag('nope'), false);
  assert.equal(isKnownTag(''), false);
});

test('RETEST_TAGS are not in allTags', () => {
  const names = allTags();
  for (const t of RETEST_TAGS) assert.equal(names.includes(t), false);
});

test('TAGS_TESTED_ON is the model the owner tested on', () => {
  assert.equal(TAGS_TESTED_ON, 'heygen/heygen-voice-1-turbo:free');
});

test('inputs are never mutated', () => {
  const snapshot = JSON.stringify(TAG_CATEGORIES);
  allTags();
  isKnownTag('slowly');
  assert.equal(JSON.stringify(TAG_CATEGORIES), snapshot);
});
test('TAGS_TESTED_ON equals the HeyGen model id', () => {
  assert.equal(TAGS_TESTED_ON, 'heygen/heygen-voice-1-turbo:free');
});

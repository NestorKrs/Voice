import test from 'node:test';
import assert from 'node:assert/strict';
import { isPhoneView } from '../src/phoneView.js';

test('isPhoneView is true when the media query matches', () => {
  assert.equal(isPhoneView(() => ({ matches: true })), true);
});

test('isPhoneView is false when the media query does not match', () => {
  assert.equal(isPhoneView(() => ({ matches: false })), false);
});

test('isPhoneView is false when matchMedia is missing', () => {
  assert.equal(isPhoneView(undefined), false);
  assert.equal(isPhoneView(), false);
});

test('isPhoneView is false when matchMedia throws', () => {
  assert.equal(isPhoneView(() => { throw new Error('matchMedia failed'); }), false);
});

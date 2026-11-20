import test from 'node:test';
import assert from 'node:assert/strict';
import { textFileRejection } from '../src/fileTypes.js';

test('textFileRejection accepts .txt and .md, case-insensitive', () => {
  assert.equal(textFileRejection('a.txt'), null);
  assert.equal(textFileRejection('A.MD'), null);
  assert.equal(textFileRejection('notes.Md'), null);
});

test('textFileRejection rejects other extensions and no extension', () => {
  for (const name of ['a.docx', 'a.pdf', 'a.doc', 'a', 'a.txt.bak']) {
    const reason = textFileRejection(name);
    assert.ok(reason, 'rejected ' + name);
    assert.equal(reason, 'Cannot load ' + name + ': Voice reads only .txt and .md files.');
  }
});

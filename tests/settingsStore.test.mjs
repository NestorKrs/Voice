import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, loadText, saveText, hasKey, saveKey, clearKey } from '../src/settingsStore.js';

function makeStorage() {
  const data = {};
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; },
  };
}

test('defaults', () => {
  const s = makeStorage();
  assert.deepEqual(loadSettings(s), DEFAULT_SETTINGS);
});

test('round trip', () => {
  const s = makeStorage();
  saveSettings(s, { voice: 'v', chunkSize: 500, lookahead: 3 });
  assert.deepEqual(loadSettings(s), { voice: 'v', provider: 'fish', voices: { fish: 'v' }, chunkSize: 500, lookahead: 3, dailyLimit: 50, fontWeight: 400, leading: 1.6, highlightMode: 'words', spellCheck: true, downloadFormat: 'mp3' });
});

test('broken JSON', () => {
  const s = makeStorage();
  s.setItem('voice.settings', '{bad');
  assert.deepEqual(loadSettings(s), DEFAULT_SETTINGS);
});

test('each invalid field falls back alone', () => {
  const s = makeStorage();
  saveSettings(s, { voice: 5, chunkSize: 2000, lookahead: 2 });
  assert.equal(loadSettings(s).voice, '');
  const s2 = makeStorage();
  saveSettings(s2, { voice: 'v', chunkSize: 100, lookahead: 2 });
  assert.equal(loadSettings(s2).chunkSize, 2000);
  const s3 = makeStorage();
  saveSettings(s3, { voice: 'v', chunkSize: 2000, lookahead: 9 });
  assert.equal(loadSettings(s3).lookahead, 2);
});

test('out of range numbers', () => {
  const s = makeStorage();
  saveSettings(s, { voice: 'v', chunkSize: 100, lookahead: -1 });
  const l = loadSettings(s);
  assert.equal(l.chunkSize, 2000);
  assert.equal(l.lookahead, 2);
});


test('dailyLimit default is 50', () => {
  const s = makeStorage();
  assert.equal(loadSettings(s).dailyLimit, 50);
  assert.equal(DEFAULT_SETTINGS.dailyLimit, 50);
});

test('dailyLimit 1000 round trips', () => {
  const s = makeStorage();
  saveSettings(s, { voice: 'v', chunkSize: 2000, lookahead: 2, dailyLimit: 1000 });
  assert.equal(loadSettings(s).dailyLimit, 1000);
});

test('dailyLimit invalid falls back to 50', () => {
  for (const v of [75, '1000', null]) {
    const s = makeStorage();
    saveSettings(s, { voice: 'v', chunkSize: 2000, lookahead: 2, dailyLimit: v });
    assert.equal(loadSettings(s).dailyLimit, 50, String(v));
  }
  const s2 = makeStorage();
  saveSettings(s2, { voice: 'v', chunkSize: 2000, lookahead: 2 });
  assert.equal(loadSettings(s2).dailyLimit, 50);
});

test('invalid dailyLimit does not reset other settings', () => {
  const s = makeStorage();
  saveSettings(s, { voice: 'v', chunkSize: 500, lookahead: 3, dailyLimit: 75 });
  const l = loadSettings(s);
  assert.equal(l.voice, 'v');
  assert.equal(l.chunkSize, 500);
  assert.equal(l.lookahead, 3);
  assert.equal(l.dailyLimit, 50);
});

test('text round trip', () => {
  const s = makeStorage();
  saveText(s, 'hello');
  assert.equal(loadText(s), 'hello');
  assert.equal(loadText(makeStorage()), '');
});

test('key save and trim', () => {
  const s = makeStorage();
  saveKey(s, '  abc  ');
  assert.equal(hasKey(s), true);
  assert.equal(s.getItem('voice.apiKey'), 'abc');
});

test('hasKey is boolean', () => {
  const s = makeStorage();
  assert.equal(typeof hasKey(s), 'boolean');
});

test('empty key removes entry', () => {
  const s = makeStorage();
  saveKey(s, 'abc');
  saveKey(s, '   ');
  assert.equal(hasKey(s), false);
  assert.equal(s.getItem('voice.apiKey'), null);
});

test('clearKey', () => {
  const s = makeStorage();
  saveKey(s, 'abc');
  clearKey(s);
  assert.equal(hasKey(s), false);
});

test('storage that throws', () => {
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  assert.deepEqual(loadSettings(bad), DEFAULT_SETTINGS);
  assert.equal(saveSettings(bad, DEFAULT_SETTINGS), false);
  assert.equal(loadText(bad), '');
  assert.equal(saveText(bad, 't'), false);
  assert.equal(hasKey(bad), false);
});

test('secrecy of key in settings', () => {
  const s = makeStorage();
  saveKey(s, 'sk-test-SECRET-123');
  const l = loadSettings(s);
  assert.ok(!JSON.stringify(l).includes('sk-test-SECRET-123'));
});

test('fontWeight accepts 100, 450 and 800', () => {
  for (const v of [100, 450, 800]) {
    const s = makeStorage();
    saveSettings(s, { voice: 'v', fontWeight: v });
    assert.equal(loadSettings(s).fontWeight, v, String(v));
  }
});

test('fontWeight invalid falls back to the default', () => {
  for (const v of [99, 801, 450.5, 'bold', undefined]) {
    const s = makeStorage();
    saveSettings(s, { voice: 'v', fontWeight: v });
    assert.equal(loadSettings(s).fontWeight, 400, String(v));
  }
});

test('invalid fontWeight does not reset other settings', () => {
  const s = makeStorage();
  saveSettings(s, { voice: 'v', chunkSize: 500, lookahead: 3, fontWeight: 99 });
  const l = loadSettings(s);
  assert.equal(l.voice, 'v');
  assert.equal(l.chunkSize, 500);
  assert.equal(l.lookahead, 3);
  assert.equal(l.fontWeight, 400);
});
test('leading default is 1.6', () => {
  const s = makeStorage();
  assert.equal(loadSettings(s).leading, 1.6);
  assert.equal(DEFAULT_SETTINGS.leading, 1.6);
});
test('leading accepts 1, 1.6 and 2.5', () => {
  for (const v of [1, 1.6, 2.5]) {
    const s = makeStorage();
    saveSettings(s, { voice: 'v', leading: v });
    assert.equal(loadSettings(s).leading, v, String(v));
  }
});
test('leading invalid falls back to the default', () => {
  for (const v of [0.9, 2.6, '1.6', undefined]) {
    const s = makeStorage();
    saveSettings(s, { voice: 'v', leading: v });
    assert.equal(loadSettings(s).leading, 1.6, String(v));
  }
});
test('invalid leading does not reset other settings', () => {
  const s = makeStorage();
  saveSettings(s, { voice: 'v', chunkSize: 500, lookahead: 3, leading: 9 });
  const l = loadSettings(s);
  assert.equal(l.voice, 'v');
  assert.equal(l.chunkSize, 500);
  assert.equal(l.lookahead, 3);
  assert.equal(l.leading, 1.6);
});
test('highlightMode default is words', () => {
  const s = makeStorage();
  assert.equal(loadSettings(s).highlightMode, 'words');
  assert.equal(DEFAULT_SETTINGS.highlightMode, 'words');
});

test('highlightMode round trips', () => {
  const s = makeStorage();
  saveSettings(s, { voice: 'v', highlightMode: 'sentences' });
  assert.equal(loadSettings(s).highlightMode, 'sentences');
});

test('highlightMode invalid falls back to words', () => {
  for (const v of ['blocks', 'Words', null, 1]) {
    const s = makeStorage();
    saveSettings(s, { voice: 'v', highlightMode: v });
    assert.equal(loadSettings(s).highlightMode, 'words', String(v));
  }
});

test('invalid highlightMode does not reset other settings', () => {
  const s = makeStorage();
  saveSettings(s, { voice: 'v', chunkSize: 500, lookahead: 3, highlightMode: 'blocks' });
  const l = loadSettings(s);
  assert.equal(l.voice, 'v');
  assert.equal(l.chunkSize, 500);
  assert.equal(l.lookahead, 3);
  assert.equal(l.highlightMode, 'words');
});

test('highlightMode none round trips', () => {
  const s = makeStorage();
  saveSettings(s, { voice: 'v', highlightMode: 'none' });
  assert.equal(loadSettings(s).highlightMode, 'none');
});

test('spellCheck default is true', () => {
  const s = makeStorage();
  assert.equal(loadSettings(s).spellCheck, true);
  assert.equal(DEFAULT_SETTINGS.spellCheck, true);
});

test('spellCheck false round trips', () => {
  const s = makeStorage();
  saveSettings(s, { voice: 'v', spellCheck: false });
  assert.equal(loadSettings(s).spellCheck, false);
});

test('spellCheck invalid falls back to true', () => {
  for (const v of ['off', 0, null, {}]) {
    const s = makeStorage();
    saveSettings(s, { voice: 'v', spellCheck: v });
    assert.equal(loadSettings(s).spellCheck, true, String(v));
  }
});

test('downloadFormat default is mp3', () => {
  const s = makeStorage();
  assert.equal(loadSettings(s).downloadFormat, 'mp3');
  assert.equal(DEFAULT_SETTINGS.downloadFormat, 'mp3');
});

test('downloadFormat wav round trips', () => {
  const s = makeStorage();
  saveSettings(s, { voice: 'v', downloadFormat: 'wav' });
  assert.equal(loadSettings(s).downloadFormat, 'wav');
});

test('downloadFormat invalid falls back to mp3', () => {
  for (const v of ['ogg', 'MP3', null, 1]) {
    const s = makeStorage();
    saveSettings(s, { voice: 'v', downloadFormat: v });
    assert.equal(loadSettings(s).downloadFormat, 'mp3', String(v));
  }
});

test('invalid downloadFormat does not reset other settings', () => {
  const s = makeStorage();
  saveSettings(s, { voice: 'v', chunkSize: 500, lookahead: 3, downloadFormat: 'ogg' });
  const l = loadSettings(s);
  assert.equal(l.voice, 'v');
  assert.equal(l.chunkSize, 500);
  assert.equal(l.lookahead, 3);
  assert.equal(l.downloadFormat, 'mp3');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerEngine } from '../src/playerEngine.js';

const tick = () => new Promise((r) => setTimeout(r, 10));

function fakeAudio() {
  return {
    paused: true,
    currentTime: 0,
    duration: 1,
    src: '',
    volume: 1,
    playbackRate: 1,
    addEventListener() {},
    removeEventListener() {},
    play() { this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; },
  };
}

function setup() {
  const audios = [];
  const revoked = [];
  let source = 1;
  const engine = createPlayerEngine({
    getBytes: async (index) => new Uint8Array([source, index]),
    createAudio: () => { const a = fakeAudio(); audios.push(a); return a; },
    makeUrl: (bytes) => 'url:' + bytes[0] + ':' + bytes[1],
    revokeUrl: (u) => revoked.push(u),
  });
  return { engine, audios, revoked, setSource: (n) => { source = n; } };
}

test('reset: Play after reset loads fresh audio instead of resuming the old audio', async () => {
  const t = setup();
  t.engine.setTotal(3);
  t.engine.play();
  await tick();
  assert.equal(t.audios[0].src, 'url:1:0');
  t.setSource(2);
  t.engine.reset();
  assert.equal(t.audios[0].paused, true);
  t.engine.play();
  await tick();
  assert.equal(t.audios[0].src, 'url:2:0');
  assert.equal(t.audios[0].paused, false);
});

test('reset: the preloaded next chunk is dropped and old URLs are revoked', async () => {
  const t = setup();
  t.engine.setTotal(3);
  t.engine.play();
  await tick();
  assert.equal(t.audios[1].src, 'url:1:1');
  t.engine.reset();
  assert.deepEqual([...t.revoked].sort(), ['url:1:0', 'url:1:1']);
  t.setSource(2);
  t.engine.play();
  await tick();
  assert.equal(t.audios[1].src, 'url:2:1');
});

test('reset: state is stopped, and reset after destroy does not throw', async () => {
  const t = setup();
  t.engine.setTotal(2);
  t.engine.play();
  await tick();
  t.engine.reset();
  assert.equal(t.engine.getState().status, 'stopped');
  t.engine.destroy();
  t.engine.reset();
});

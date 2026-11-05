import test from 'node:test';
import assert from 'node:assert/strict';
import { MODEL, ENDPOINT, classifyError, requestSpeech } from '../src/speechClient.js';

const instantSleep = () => Promise.resolve();

function makeResponse(status, body, headers = {}) {
  const h = new Headers(headers);
  return new Response(body, { status, headers: h });
}

test('1 success raw bytes, json not called', async () => {
  let jsonCalled = false;
  const res = new Response(new Uint8Array([1, 2, 3]), { status: 200 });
  res.json = () => { jsonCalled = true; throw new Error('no'); };
  const fetchImpl = async () => res;
  const r = await requestSpeech({ apiKey: 'k', input: 'hi', fetchImpl, sleep: instantSleep });
  assert.equal(r.ok, true);
  assert.equal(r.attempts, 1);
  assert.equal(r.bytes.byteLength, 3);
  assert.equal(jsonCalled, false);
});

test('2 request shape', async () => {
  let captured;
  const fetchImpl = async (url, opts) => {
    captured = { url, opts };
    return new Response(new Uint8Array([1]), { status: 200 });
  };
  await requestSpeech({ apiKey: 'k', input: 'hi', voice: '', fetchImpl, sleep: instantSleep });
  assert.equal(captured.url, ENDPOINT);
  assert.equal(captured.opts.method, 'POST');
  assert.equal(captured.opts.headers.Authorization, 'Bearer k');
  assert.equal(captured.opts.headers['Content-Type'], 'application/json');
  const b = JSON.parse(captured.opts.body);
  assert.equal(b.model, 'fish-audio/s2.1-pro-free:free');
  assert.equal(b.response_format, 'mp3');
  assert.equal(b.input, 'hi');
  assert.equal('voice' in b, false);

  const fetchImpl2 = async (url, opts) => { captured = { url, opts }; return new Response(new Uint8Array([1]), { status: 200 }); };
  await requestSpeech({ apiKey: 'k', input: 'hi', voice: '  v1  ', fetchImpl: fetchImpl2, sleep: instantSleep });
  const b2 = JSON.parse(captured.opts.body);
  assert.equal(b2.voice, 'v1');
});

test('3 400/401/402/403/404 classified, no retry', async () => {
  for (const st of [400, 401, 402, 403, 404]) {
    let calls = 0;
    const fetchImpl = async () => { calls++; return makeResponse(st, JSON.stringify({ error: { message: 'msg' } })); };
    const r = await requestSpeech({ apiKey: 'k', input: 'hi', fetchImpl, sleep: instantSleep });
    assert.equal(r.ok, false);
    assert.equal(r.attempts, 1);
    assert.equal(calls, 1);
  }
  // classify kinds
  assert.equal(classifyError(400, 'm', null).kind, 'bad_request');
  assert.equal(classifyError(401, 'm', null).kind, 'auth');
  assert.equal(classifyError(402, 'm', null).kind, 'credits');
  assert.equal(classifyError(403, 'm', null).kind, 'blocked');
  assert.equal(classifyError(404, 'm', null).kind, 'not_found');
});

test('4 429 daily cap', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return makeResponse(429, JSON.stringify({ error: { message: 'free-models-per-day exceeded' } }), { 'X-RateLimit-Reset': '12345' }); };
  const r = await requestSpeech({ apiKey: 'k', input: 'hi', fetchImpl, sleep: instantSleep });
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'daily_cap');
  assert.equal(r.attempts, 1);
  assert.equal(calls, 1);
  assert.equal(r.error.resetAt, 12345);
});

test('5 429 other retried', async () => {
  // success on second
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    if (calls === 1) return makeResponse(429, JSON.stringify({ error: { message: 'rate' } }));
    return new Response(new Uint8Array([9]), { status: 200 });
  };
  const r = await requestSpeech({ apiKey: 'k', input: 'hi', fetchImpl, sleep: instantSleep });
  assert.equal(r.ok, true);
  assert.equal(r.attempts, 2);

  // fail again
  let calls2 = 0;
  const fetchImpl2 = async () => { calls2++; return makeResponse(429, JSON.stringify({ error: { message: 'rate' } })); };
  const r2 = await requestSpeech({ apiKey: 'k', input: 'hi', fetchImpl: fetchImpl2, sleep: instantSleep });
  assert.equal(r2.ok, false);
  assert.equal(r2.attempts, 2);
  assert.equal(calls2, 2);
});

test('6 502 retried', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    if (calls === 1) return makeResponse(502, JSON.stringify({ error: { message: 'bad gateway' } }));
    return new Response(new Uint8Array([9]), { status: 200 });
  };
  const r = await requestSpeech({ apiKey: 'k', input: 'hi', fetchImpl, sleep: instantSleep });
  assert.equal(r.ok, true);
  assert.equal(r.attempts, 2);
});

test('7 network and abort', async () => {
  const fetchImpl = async () => { throw new Error('boom'); };
  const r = await requestSpeech({ apiKey: 'k', input: 'hi', fetchImpl, sleep: instantSleep });
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'network');
  assert.equal(r.attempts, 1);

  const ab = new Error('aborted');
  ab.name = 'AbortError';
  const fetchImpl2 = async () => { throw ab; };
  const r2 = await requestSpeech({ apiKey: 'k', input: 'hi', fetchImpl: fetchImpl2, sleep: instantSleep });
  assert.equal(r2.error.kind, 'aborted');
});

test('8 empty key and empty input', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return new Response(new Uint8Array([1]), { status: 200 }); };
  const r1 = await requestSpeech({ apiKey: '   ', input: 'hi', fetchImpl, sleep: instantSleep });
  assert.equal(r1.ok, false);
  assert.equal(r1.error.kind, 'no_key');
  assert.equal(r1.attempts, 0);
  const r2 = await requestSpeech({ apiKey: 'k', input: '   ', fetchImpl, sleep: instantSleep });
  assert.equal(r2.ok, false);
  assert.equal(r2.error.kind, 'bad_input');
  assert.equal(r2.attempts, 0);
  assert.equal(calls, 0);
});

test('9 empty body 200', async () => {
  const fetchImpl = async () => new Response(new Uint8Array([]), { status: 200 });
  const r = await requestSpeech({ apiKey: 'k', input: 'hi', fetchImpl, sleep: instantSleep });
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'empty_audio');
});

test('10 secrecy', async () => {
  const KEY = 'sk-test-SECRET-123';
  const INPUT = 'SENTINEL-INPUT-TEXT';
  // 401
  const f1 = async () => makeResponse(401, JSON.stringify({ error: { message: 'no' } }));
  const r1 = await requestSpeech({ apiKey: KEY, input: INPUT, fetchImpl: f1, sleep: instantSleep });
  assert.ok(!JSON.stringify(r1).includes(KEY));
  assert.ok(!JSON.stringify(r1).includes(INPUT));
  // 429 cap
  const f2 = async () => makeResponse(429, JSON.stringify({ error: { message: 'free-models-per-day' } }), { 'X-RateLimit-Reset': '9' });
  const r2 = await requestSpeech({ apiKey: KEY, input: INPUT, fetchImpl: f2, sleep: instantSleep });
  assert.ok(!JSON.stringify(r2).includes(KEY));
  assert.ok(!JSON.stringify(r2).includes(INPUT));
  // network
  const f3 = async () => { throw new Error('boom'); };
  const r3 = await requestSpeech({ apiKey: KEY, input: INPUT, fetchImpl: f3, sleep: instantSleep });
  assert.ok(!JSON.stringify(r3).includes(KEY));
  assert.ok(!JSON.stringify(r3).includes(INPUT));
});

test('11 non-JSON error body', async () => {
  const fetchImpl = async () => new Response('not json', { status: 400, headers: { 'Content-Type': 'text/plain' } });
  const r = await requestSpeech({ apiKey: 'k', input: 'hi', fetchImpl, sleep: instantSleep });
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'bad_request');
  const fetchImpl2 = async () => new Response('', { status: 500 });
  const r2 = await requestSpeech({ apiKey: 'k', input: 'hi', fetchImpl: fetchImpl2, sleep: instantSleep });
  assert.equal(r2.error.kind, 'upstream');
});
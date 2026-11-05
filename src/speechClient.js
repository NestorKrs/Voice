export const MODEL = 'fish-audio/s2.1-pro-free:free';
export const ENDPOINT = 'https://openrouter.ai/api/v1/audio/speech';

export function classifyError(status, bodyMessage, resetHeader) {
  const msg = (bodyMessage || '').slice(0, 300);
  const resetAt = Number.isFinite(Number(resetHeader)) ? Number(resetHeader) : null;
  let kind;
  let retryable = false;
  let message = msg;
  if (status === 400) kind = 'bad_request';
  else if (status === 401) kind = 'auth';
  else if (status === 402) kind = 'credits';
  else if (status === 403) kind = 'blocked';
  else if (status === 404) kind = 'not_found';
  else if (status === 429) {
    if (msg.includes('free-models-per-day')) {
      kind = 'daily_cap';
      retryable = false;
    } else {
      kind = 'rate_limit';
      retryable = true;
    }
  } else if (status >= 500 && status <= 599) {
    kind = 'upstream';
    retryable = true;
  } else {
    kind = 'unknown';
    retryable = false;
  }
  if (!message) {
    const defaults = {
      bad_request: 'Bad request.',
      auth: 'Unauthorized.',
      credits: 'Insufficient credits.',
      blocked: 'Forbidden.',
      not_found: 'Not found.',
      daily_cap: 'Daily free-model cap reached.',
      rate_limit: 'Rate limited.',
      upstream: 'Upstream error.',
      unknown: 'Unknown error.',
    };
    message = defaults[kind] || 'Unknown error.';
  }
  return { kind, status, message, resetAt: kind === 'daily_cap' ? resetAt : (kind === 'rate_limit' ? resetAt : resetAt), retryable };
}

export async function requestSpeech({ apiKey, input, voice, fetchImpl, signal, sleep, retryDelayMs } = {}) {
  const f = fetchImpl || globalThis.fetch;
  const sl = sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const delay = retryDelayMs == null ? 1500 : retryDelayMs;

  const key = (apiKey || '').trim();
  if (!key) {
    return { ok: false, error: { kind: 'no_key', message: 'No API key set.' }, attempts: 0 };
  }
  const trimmedInput = (input || '').trim();
  if (!trimmedInput) {
    return { ok: false, error: { kind: 'bad_input', message: 'Empty input.' }, attempts: 0 };
  }

  const body = { model: MODEL, input: trimmedInput, response_format: 'mp3' };
  if (typeof voice === 'string' && voice.trim() !== '') {
    body.voice = voice.trim();
  }

  const doFetch = async () => {
    const start = Date.now();
    const res = await f(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
    const latencyMs = Date.now() - start;
    if (res.status === 200) {
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      if (bytes.byteLength === 0) {
        return { kind: 'empty', latencyMs };
      }
      return { kind: 'success', bytes, latencyMs };
    }
    let msg = '';
    let parsed = false;
    try {
      const j = await res.json();
      if (j && j.error && j.error.message) msg = String(j.error.message);
      else if (j && j.message) msg = String(j.message);
      parsed = true;
    } catch (e) {
      try {
        msg = await res.text();
      } catch (e2) {
        msg = '';
      }
    }
    const resetHeader = res.headers ? res.headers.get('X-RateLimit-Reset') : null;
    const err = classifyError(res.status, msg, resetHeader);
    return { kind: 'error', error: err, latencyMs };
  };

  let attempts = 0;
  let lastLatency = 0;
  const runOnce = async () => {
    attempts += 1;
    return await doFetch();
  };

  let result;
  try {
    result = await runOnce();
  } catch (e) {
    if (e && e.name === 'AbortError') {
      return { ok: false, error: { kind: 'aborted', message: 'Aborted.' }, attempts, latencyMs: 0 };
    }
    return { ok: false, error: { kind: 'network', message: 'Network error.' }, attempts, latencyMs: 0 };
  }

  if (result.kind === 'success') {
    return { ok: true, bytes: result.bytes, latencyMs: result.latencyMs, attempts };
  }
  if (result.kind === 'empty') {
    return { ok: false, error: { kind: 'empty_audio', message: 'Empty audio response.' }, attempts, latencyMs: result.latencyMs };
  }

  // error result
  let err = result.error;
  lastLatency = result.latencyMs;
  if (err.retryable) {
    await sl(delay);
    let result2;
    try {
      result2 = await runOnce();
    } catch (e) {
      if (e && e.name === 'AbortError') {
        return { ok: false, error: { kind: 'aborted', message: 'Aborted.' }, attempts, latencyMs: lastLatency };
      }
      return { ok: false, error: { kind: 'network', message: 'Network error.' }, attempts, latencyMs: lastLatency };
    }
    if (result2.kind === 'success') {
      return { ok: true, bytes: result2.bytes, latencyMs: result2.latencyMs, attempts };
    }
    if (result2.kind === 'empty') {
      return { ok: false, error: { kind: 'empty_audio', message: 'Empty audio response.' }, attempts, latencyMs: result2.latencyMs };
    }
    err = result2.error;
    lastLatency = result2.latencyMs;
  }

  return { ok: false, error: { kind: err.kind, status: err.status, message: err.message, resetAt: err.resetAt }, attempts, latencyMs: lastLatency };
}
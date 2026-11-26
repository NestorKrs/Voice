// Load cached chunk audio and join it to mono for a later clip editor. No logging, no network, no cache access.

import { concatMono } from './clipEditorAudio.js';

export async function loadEditorAudio({ indexes, getBytes, decode, toMonoFn }) {
  const parts = [];
  const included = [];
  const skipped = [];

  for (const index of indexes) {
    const bytes = await getBytes(index);
    if (bytes === null || bytes === undefined || bytes.byteLength === 0) {
      skipped.push(index);
      continue;
    }

    let decoded;
    try {
      decoded = await decode(bytes);
    } catch (e) {
      throw new Error('Chunk ' + (index + 1) + ': ' + (e && e.message ? e.message : 'could not decode'));
    }

    parts.push({ samples: toMonoFn(decoded.channels), sampleRate: decoded.sampleRate });
    included.push(index);
  }

  if (parts.length === 0) return { audio: null, skipped };

  const joined = concatMono(parts);
  return {
    audio: {
      samples: joined.samples,
      sampleRate: joined.sampleRate,
      offsets: joined.offsets,
      indexes: included,
    },
    skipped,
  };
}

// Load cached chunk audio and join it to mono for a later clip editor. No logging, no network, no cache access.

import { concatMono } from './clipEditorAudio.js';

export const MAX_EDIT_SECONDS = 900;

export async function loadEditorAudio({ indexes, getBytes, decode, toMonoFn, maxSeconds = MAX_EDIT_SECONDS }) {
  const parts = [];
  const included = [];
  const skipped = [];
  let totalSamples = 0;

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

    const mono = toMonoFn(decoded.channels);
    totalSamples += mono.length;
    const totalSeconds = totalSamples / decoded.sampleRate;
    if (totalSeconds > maxSeconds) {
      const minutes = Math.ceil(totalSeconds / 60);
      const limitMinutes = Math.round(maxSeconds / 60);
      throw new Error(
        'Too long to edit in one piece: about ' + minutes + ' min decoded (limit ' + limitMinutes + ' min). Choose a single chunk in the list above.',
      );
    }
    parts.push({ samples: mono, sampleRate: decoded.sampleRate });
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

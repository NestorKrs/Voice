// Finds the real pauses in a chunk's decoded audio.
// The speech endpoint returns raw audio with no timestamps, and the Text panel
// highlight assumes one steady speaking rate, so it rushes ahead of the voice.
// This module only reports where the audio is silent; the caller decides what
// to do with it. Pure: no DOM, no network, no imports.

export const SILENCE_FRAME_SECONDS = 0.01;
export const DEFAULT_MIN_SILENCE = 0.18;

// RMS of each 10 ms frame. A frame that is short (the last one) is skipped
// rather than padded, so every frame covers a full SILENCE_FRAME_SECONDS.
function frameRms(samples, sampleRate) {
  const frameLength = Math.max(1, Math.round(sampleRate * SILENCE_FRAME_SECONDS));
  const frames = [];
  for (let start = 0; start + frameLength <= samples.length; start += frameLength) {
    let sum = 0;
    for (let i = start; i < start + frameLength; i += 1) sum += samples[i] * samples[i];
    frames.push(Math.sqrt(sum / frameLength));
  }
  return frames;
}

// The threshold is relative to the audio's own loudest frames, so the same
// gaps are found in quiet and loud speech. The 90th percentile is loud enough
// to sit above ordinary speech but below a normal sentence.
export function defaultThreshold(frameValues) {
  if (!frameValues.length) return 0;
  const sorted = [...frameValues].sort((a, b) => a - b);
  return 0.1 * sorted[Math.floor(0.9 * (sorted.length - 1))];
}

// Returns { silences, leadIn, tail, duration } in seconds. `silences` holds
// every run of frames below the threshold lasting at least minSilence. Silence
// at the very start and end is not a pause inside the audio, so it is reported
// as leadIn and tail instead.
export function findSilences(samples, sampleRate, options = {}) {
  const list = samples instanceof Float32Array ? samples : new Float32Array(samples || []);
  const rate = Number(sampleRate) > 0 ? sampleRate : 0;
  const duration = rate > 0 ? list.length / rate : 0;
  const minSilence = options.minSilence != null ? options.minSilence : DEFAULT_MIN_SILENCE;
  const frames = frameRms(list, rate);
  if (!frames.length) return { silences: [], leadIn: 0, tail: 0, duration };

  const threshold = options.threshold != null ? options.threshold : defaultThreshold(frames);
  const quiet = frames.map((value) => value < threshold);
  const minFrames = Math.max(1, Math.ceil(minSilence / SILENCE_FRAME_SECONDS));

  const runs = [];
  let start = -1;
  for (let i = 0; i < quiet.length; i += 1) {
    if (quiet[i] && start < 0) start = i;
    if ((!quiet[i] || i === quiet.length - 1) && start >= 0) {
      const end = quiet[i] ? i + 1 : i;
      runs.push({ start, end });
      start = -1;
    }
  }

  const toSeconds = (index) => index * SILENCE_FRAME_SECONDS;
  const leadIn = runs.length && runs[0].start === 0 ? toSeconds(runs[0].end) : 0;
  const tail = runs.length && runs[runs.length - 1].end === frames.length
    ? toSeconds(frames.length - runs[runs.length - 1].start)
    : 0;

  const silences = runs
    .filter((run) => run.end - run.start >= minFrames)
    .filter((run) => !(run.start === 0 && leadIn > 0) && !(run.end === frames.length && tail > 0))
    .map((run) => ({ start: toSeconds(run.start), end: toSeconds(run.end) }));

  return { silences, leadIn, tail, duration };
}

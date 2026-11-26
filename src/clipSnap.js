export const REACTION_COMP_MS = 180;
export const SNAP_RADIUS_MS = 80;
export const SNAP_FRAME_MS = 5;
export const FADE_MS = 5;

export function compensateKeyPress(position, rate, compMs = REACTION_COMP_MS) {
  return Math.max(0, position - Math.round(compMs * rate / 1000));
}

export function snapToQuiet(samples, rate, sample, radiusMs = SNAP_RADIUS_MS, frameMs = SNAP_FRAME_MS) {
  const length = samples.length;
  if (length === 0) return sample;

  const frame = Math.max(1, Math.round(frameMs * rate / 1000));
  const radius = Math.round(radiusMs * rate / 1000);
  const step = Math.max(1, Math.floor(frame / 2));
  const half = Math.floor(frame / 2);
  const first = sample - radius;
  const last = sample + radius;

  const squaredPrefix = new Float64Array(length + 1);
  for (let i = 0; i < length; i += 1) {
    const value = samples[i];
    squaredPrefix[i + 1] = squaredPrefix[i] + value * value;
  }

  let best = sample;
  let bestRms = Infinity;
  let bestDistance = Infinity;

  for (let candidate = first; candidate <= last; candidate += step) {
    const centre = Math.max(0, Math.min(length, candidate));
    const rawStart = centre - half;
    let start = Math.max(0, rawStart);
    let end = Math.min(length, rawStart + frame);
    if (end <= start) {
      start = Math.max(0, length - frame);
      end = length;
    }
    const rms = Math.sqrt((squaredPrefix[end] - squaredPrefix[start]) / (end - start));
    const distance = Math.abs(centre - sample);

    if (
      rms < bestRms ||
      (rms === bestRms && (distance < bestDistance ||
        (distance === bestDistance && centre < best)))
    ) {
      bestRms = rms;
      bestDistance = distance;
      best = centre;
    }
  }

  return Math.max(0, Math.min(length, Math.round(best)));
}

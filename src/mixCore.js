// Mix a mono voice track with optional music into a stereo pair. Pure ESM.
import { duckEnvelope, gainAtSample } from './mixDuck.js';

const LIMIT_CEILING = 0.99;

function musicSampleAt(channel, m) {
  return m >= 0 && m < channel.length ? channel[m] : 0;
}

export function mixDown({ voice, music, rate, options }) {
  const opts = options || {};
  const voiceGain = opts.voiceGain === undefined ? 1 : opts.voiceGain;
  const musicGain = opts.musicGain === undefined ? 1 : opts.musicGain;
  const musicStartSamples = opts.musicStartSamples === undefined ? 0 : opts.musicStartSamples;
  const loop = Boolean(opts.loop);
  const fadeInSamples = opts.fadeInSamples === undefined ? 0 : opts.fadeInSamples;
  const fadeOutSamples = opts.fadeOutSamples === undefined ? 0 : opts.fadeOutSamples;
  const duck = Boolean(opts.duck);
  const duckOptions = opts.duckOptions || {};
  const limit = opts.limit === undefined ? true : opts.limit;

  const n = voice.length;
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  if (n === 0) return { channels: [left, right], peak: 0, scaled: false };

  const musicChannels = music && music.channels ? music.channels : null;
  const musicLength = musicChannels && musicChannels.length > 0 ? musicChannels[0].length : 0;
  const hasMusic = musicLength > 0;
  const musicLeft = hasMusic ? musicChannels[0] : null;
  const musicRight = hasMusic && musicChannels.length > 1 ? musicChannels[1] : musicLeft;

  const audibleStart = Math.max(0, musicStartSamples);
  const env = duck && hasMusic ? duckEnvelope(voice, rate, duckOptions) : null;

  let peak = 0;
  for (let i = 0; i < n; i += 1) {
    const voiceSample = voice[i] * voiceGain;
    let musicLeftSample = 0;
    let musicRightSample = 0;
    if (hasMusic) {
      let m = i - musicStartSamples;
      if (m < 0) {
        m = -1;
      } else if (m >= musicLength) {
        m = loop ? m % musicLength : -1;
      }
      if (m >= 0) {
        const fadeInGain = fadeInSamples > 0
          ? Math.max(0, Math.min(1, (i - audibleStart + 1) / fadeInSamples))
          : 1;
        const fadeOutGain = fadeOutSamples > 0 ? Math.min(1, (n - i) / fadeOutSamples) : 1;
        const duckGain = env ? gainAtSample(env, i) : 1;
        const scale = musicGain * fadeInGain * fadeOutGain * duckGain;
        musicLeftSample = musicSampleAt(musicLeft, m) * scale;
        musicRightSample = musicSampleAt(musicRight, m) * scale;
      }
    }
    const l = voiceSample + musicLeftSample;
    const r = voiceSample + musicRightSample;
    left[i] = l;
    right[i] = r;
    const absL = Math.abs(l);
    const absR = Math.abs(r);
    if (absL > peak) peak = absL;
    if (absR > peak) peak = absR;
  }

  let scaled = false;
  if (limit && peak > LIMIT_CEILING) {
    const factor = LIMIT_CEILING / peak;
    for (let i = 0; i < n; i += 1) {
      left[i] *= factor;
      right[i] *= factor;
    }
    scaled = true;
  }

  return { channels: [left, right], peak, scaled };
}
// Music file guard and loader for the mixer. Returns the reason to show, or ''
// when the file may be read. The name is logged, never the file content.
export const MAX_MUSIC_BYTES = 31457280;
export const MAX_MUSIC_SECONDS = 300;
export const MUSIC_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg'];

function musicSecondsText(seconds) {
  const total = Math.ceil(seconds);
  const m = Math.floor(total / 60);
  const ss = total % 60;
  return m + ':' + String(ss).padStart(2, '0');
}

export function musicFileRejection(name, size) {
  const n = (name == null ? '' : String(name)).toLowerCase();
  if (!MUSIC_EXTENSIONS.some((ext) => n.endsWith(ext))) {
    return 'Cannot load ' + (name == null ? '' : String(name))
      + ': the mixer accepts .mp3, .wav, .m4a and .ogg audio files.';
  }
  if (size > MAX_MUSIC_BYTES) {
    const mb = (size / 1048576).toFixed(1);
    return 'Cannot load ' + (name == null ? '' : String(name))
      + ': it is ' + mb + ' MB and the limit is 30 MB.';
  }
  if (!size) {
    return 'Cannot load ' + (name == null ? '' : String(name)) + ': the file is empty.';
  }
  return '';
}

export async function loadMusicFile({ name, size, readBytes, decode, rate }) {
  const reason = musicFileRejection(name, size);
  if (reason) throw new Error(reason);

  const bytes = await readBytes();

  let decoded;
  try {
    decoded = await decode(bytes);
  } catch (e) {
    throw new Error('Could not decode ' + (name == null ? '' : String(name))
      + ': ' + (e && e.message ? e.message : 'unknown error'));
  }

  const channels = decoded && decoded.channels ? decoded.channels : null;
  if (!channels || channels.length === 0 || channels[0].length === 0) {
    throw new Error('Cannot load ' + (name == null ? '' : String(name)) + ': it contains no audio.');
  }

  if (decoded.sampleRate !== rate) {
    throw new Error('Cannot load ' + (name == null ? '' : String(name))
      + ': it was decoded at ' + decoded.sampleRate + ' Hz but the voice is ' + rate + ' Hz.');
  }

  const seconds = channels[0].length / rate;
  if (seconds > MAX_MUSIC_SECONDS) {
    throw new Error('Cannot load ' + (name == null ? '' : String(name))
      + ': it is ' + musicSecondsText(seconds) + ' long and the limit is 5:00.');
  }

  return { name, channels: channels.slice(0, 2), sampleRate: rate, seconds };
}
export const DEFAULT_SETTINGS = { voice: '', provider: 'fish', voices: {}, chunkSize: 2000, lookahead: 2, dailyLimit: 50, fontWeight: 400 };

function validate(settings) {
  const out = { ...DEFAULT_SETTINGS, voices: {} };
  if (settings && typeof settings === 'object') {
    if (typeof settings.provider === 'string' && settings.provider.trim() !== '' && settings.provider.length <= 80) out.provider = settings.provider.trim();
    if (settings.voices && typeof settings.voices === 'object' && !Array.isArray(settings.voices)) {
      for (const [k, v] of Object.entries(settings.voices)) {
        if (typeof v === 'string') out.voices[k] = v;
      }
    }
    if (typeof settings.voice === 'string') out.voices[out.provider] = settings.voice;
    if (Number.isInteger(settings.chunkSize) && settings.chunkSize >= 200 && settings.chunkSize <= 5000) out.chunkSize = settings.chunkSize;
    if (Number.isInteger(settings.lookahead) && settings.lookahead >= 0 && settings.lookahead <= 5) out.lookahead = settings.lookahead;
    if (settings.dailyLimit === 50 || settings.dailyLimit === 1000) out.dailyLimit = settings.dailyLimit;
    if (Number.isInteger(settings.fontWeight) && settings.fontWeight >= 100 && settings.fontWeight <= 800) out.fontWeight = settings.fontWeight;
  }
  out.voice = out.voices[out.provider] || '';
  return out;
}

export function loadSettings(storage) {
  try {
    const raw = storage.getItem('voice.settings');
    if (!raw) return validate(null);
    const obj = JSON.parse(raw);
    return validate(obj);
  } catch {
    return validate(null);
  }
}

export function saveSettings(storage, settings) {
  try {
    const v = validate(settings);
    storage.setItem('voice.settings', JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}

export function loadText(storage) {
  try {
    const v = storage.getItem('voice.text');
    return typeof v === 'string' ? v : (v == null ? '' : String(v));
  } catch {
    return '';
  }
}

export function saveText(storage, text) {
  try {
    storage.setItem('voice.text', text);
    return true;
  } catch {
    return false;
  }
}

export function hasKey(storage) {
  try {
    const v = storage.getItem('voice.apiKey');
    return typeof v === 'string' && v.trim() !== '';
  } catch {
    return false;
  }
}

export function saveKey(storage, key) {
  try {
    const t = (key == null ? '' : String(key)).trim();
    if (t === '') {
      storage.removeItem('voice.apiKey');
    } else {
      storage.setItem('voice.apiKey', t);
    }
    return true;
  } catch {
    return false;
  }
}

export function clearKey(storage) {
  try {
    storage.removeItem('voice.apiKey');
  } catch {}
}

// only the speechClient wiring may import this function
export function readKey(storage) {
  try {
    const v = storage.getItem('voice.apiKey');
    return typeof v === 'string' ? v : '';
  } catch {
    return '';
  }
}
export const DEFAULT_SETTINGS = { voice: '', chunkSize: 2000, lookahead: 2, dailyLimit: 50 };

function validate(settings) {
  const out = { ...DEFAULT_SETTINGS };
  if (settings && typeof settings === 'object') {
    if (typeof settings.voice === 'string') out.voice = settings.voice;
    if (Number.isInteger(settings.chunkSize) && settings.chunkSize >= 200 && settings.chunkSize <= 5000) out.chunkSize = settings.chunkSize;
    if (Number.isInteger(settings.lookahead) && settings.lookahead >= 0 && settings.lookahead <= 5) out.lookahead = settings.lookahead;
    if (settings.dailyLimit === 50 || settings.dailyLimit === 1000) out.dailyLimit = settings.dailyLimit;
  }
  return out;
}

export function loadSettings(storage) {
  try {
    const raw = storage.getItem('voice.settings');
    if (!raw) return { ...DEFAULT_SETTINGS };
    const obj = JSON.parse(raw);
    return validate(obj);
  } catch {
    return { ...DEFAULT_SETTINGS };
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
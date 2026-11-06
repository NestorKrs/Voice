export const CUSTOM_KEY = 'voice.customProviders';
export const FORMATS = ['mp3', 'pcm'];

export const BUILTIN_PROVIDERS = [
  { id: 'fish', label: 'Fish Audio', name: 'S2.1 Pro Free', model: 'fish-audio/s2.1-pro-free:free', format: 'mp3', voiceHint: 'Voice ID, for example b347db033a6549378b48d00acb0d06cd. Empty uses the default voice.', builtin: true },
  { id: 'heygen', label: 'HeyGen', name: 'Voice Turbo Free', model: 'heygen/heygen-voice-1-turbo:free', format: 'pcm', voiceHint: 'Voice name, for example nadine (10 default voices).', builtin: true },
];

export function isFreeModel(model) {
  return typeof model === 'string' && /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*:free$/i.test(model);
}

export function providerIdFor(model) {
  return 'custom-' + String(model).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function normalizeProvider(p) {
  if (!p || typeof p !== 'object') return null;
  const model = typeof p.model === 'string' ? p.model.trim() : '';
  if (!isFreeModel(model)) return null;
  if (!FORMATS.includes(p.format)) return null;
  const label = typeof p.label === 'string' && p.label.trim() ? p.label.trim().slice(0, 40) : model.split('/')[0];
  const name = typeof p.name === 'string' ? p.name.trim().slice(0, 40) : '';
  const voiceHint = typeof p.voiceHint === 'string' ? p.voiceHint.trim().slice(0, 200) : '';
  return { id: providerIdFor(model), label, name, model, format: p.format, voiceHint, builtin: false };
}

function dedupe(list) {
  const seen = new Set(BUILTIN_PROVIDERS.map((p) => p.model));
  const out = [];
  for (const p of list) {
    if (seen.has(p.model)) continue;
    seen.add(p.model);
    out.push(p);
  }
  return out;
}

export function allProviders(custom) {
  const list = Array.isArray(custom) ? custom.map(normalizeProvider).filter(Boolean) : [];
  return [...BUILTIN_PROVIDERS, ...dedupe(list)];
}

export function loadCustomProviders(storage) {
  try {
    const raw = storage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return dedupe(parsed.map(normalizeProvider).filter(Boolean));
  } catch {
    return [];
  }
}

export function saveCustomProviders(storage, list) {
  try {
    const clean = dedupe((Array.isArray(list) ? list : []).map(normalizeProvider).filter(Boolean));
    storage.setItem(CUSTOM_KEY, JSON.stringify(clean));
    return true;
  } catch {
    return false;
  }
}

export function getProvider(list, id) {
  return list.find((p) => p.id === id) || list[0];
}

export function providerLabel(p) {
  return p.name ? p.label + ' \u00b7 ' + p.name : p.label;
}

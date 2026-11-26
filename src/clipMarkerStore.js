export const STORE_KEY = 'voice.clipMarkers.v1';
export const MAX_ENTRIES = 50;

const MAX_NAME_LENGTH = 60;

export function audioKeyFrom(keys) {
  const source = keys.join('|') + '-' + keys.length;
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(i), 0x01000193);
  }
  return 'a' + (hash >>> 0).toString(16).padStart(8, '0');
}

function emptyState() {
  return { v: 1, items: [] };
}

function readState(storage) {
  let raw;
  try {
    raw = storage.getItem(STORE_KEY);
  } catch {
    return emptyState();
  }
  if (typeof raw !== 'string' || raw === '') return emptyState();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyState();
  }
  if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.items)) return emptyState();
  return {
    v: 1,
    items: parsed.items.filter((item) => item && typeof item === 'object'),
  };
}

function writeState(storage, state) {
  try {
    storage.setItem(STORE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function cleanNames(names) {
  if (!Array.isArray(names)) return [];
  return names
    .filter((name) => typeof name === 'string')
    .map((name) => name.slice(0, MAX_NAME_LENGTH));
}

function validMarkers(markers, total) {
  if (!Array.isArray(markers)) return false;
  let previous = 0;
  for (const marker of markers) {
    if (!Number.isInteger(marker)) return false;
    if (marker < 1 || marker > total - 1 || marker <= previous) return false;
    previous = marker;
  }
  return true;
}

export function createMarkerStore(storage) {
  function load(audioKey, total) {
    const item = readState(storage).items.find((entry) => entry.k === audioKey);
    if (!item || item.total !== total || !validMarkers(item.markers, total)) return null;
    return { markers: item.markers.slice(), names: cleanNames(item.names) };
  }

  function remove(audioKey) {
    const state = readState(storage);
    state.items = state.items.filter((entry) => entry.k !== audioKey);
    return writeState(storage, state);
  }

  function clear() {
    return writeState(storage, emptyState());
  }

  function save(audioKey, total, rate, markers, names) {
    if (!Array.isArray(markers) || markers.length === 0) return remove(audioKey);
    const state = readState(storage);
    state.items = state.items.filter((entry) => entry.k !== audioKey);
    state.items.push({
      k: audioKey,
      total,
      rate,
      markers: markers.slice(),
      names: cleanNames(names),
    });
    if (state.items.length > MAX_ENTRIES) {
      state.items = state.items.slice(state.items.length - MAX_ENTRIES);
    }
    return writeState(storage, state);
  }

  return { load, save, remove, clear };
}

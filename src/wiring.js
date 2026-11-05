import { readKey } from './settingsStore.js';
import { requestSpeech } from './speechClient.js';
import { createAudioCache, createIdbStore, makeCacheKey } from './audioCache.js';
import { createRequestCounter } from './requestCounter.js';
import { MODEL } from './speechClient.js';

// only file that imports readKey
export function makeSpeak({ readKey, requestSpeech, storage }) {
  return async function speak({ input, voice, signal }) {
    return requestSpeech({ apiKey: readKey(storage), input, voice, signal });
  };
}

export function createServices({ storage, idb = globalThis.indexedDB }) {
  const cache = createAudioCache(createIdbStore());
  const speak = makeSpeak({ readKey, requestSpeech, storage });
  const counter = createRequestCounter(storage);
  const makeKey = ({ text, voice }) => makeCacheKey({ model: MODEL, voice, text });
  return { cache, speak, counter, makeKey };
}
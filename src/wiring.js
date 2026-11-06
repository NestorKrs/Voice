import { readKey } from './settingsStore.js';
import { requestSpeech } from './speechClient.js';
import { createAudioCache, createIdbStore, makeCacheKey } from './audioCache.js';
import { createRequestCounter } from './requestCounter.js';
import { MODEL } from './speechClient.js';

// only file that imports readKey
export function makeSpeak({ readKey, requestSpeech, storage }) {
  return async function speak({ input, voice, provider, signal }) {
    const key = readKey(storage);
    const args = { apiKey: key, input, voice, signal };
    if (provider) args.provider = provider;
    return requestSpeech(args);
  };
}

export function keyArgs({ text, voice, provider }) {
  return { model: provider && provider.model ? provider.model : MODEL, voice, text };
}

export function createServices({ storage }) {
  const cache = createAudioCache(createIdbStore());
  const speak = makeSpeak({ readKey, requestSpeech, storage });
  const counter = createRequestCounter(storage);
  const makeKey = (a) => makeCacheKey(keyArgs(a));
  return { cache, speak, counter, makeKey };
}
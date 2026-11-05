import { chunkText } from './textPipeline.js';

export function computeStats({ text, chunkSize, usedToday, dailyLimit = 50 }) {
  const characters = (text || '').length;
  const pages = characters === 0 ? 0 : Math.ceil(characters / 2000);
  const chunks = chunkText(text || '', chunkSize).length;
  const requestsNeeded = chunks;
  const remainingToday = Math.max(0, dailyLimit - (usedToday || 0));
  const fitsToday = requestsNeeded <= remainingToday;
  let daysNeeded = 0;
  if (characters > 0) {
    if (fitsToday) daysNeeded = 1;
    else daysNeeded = 1 + Math.ceil((requestsNeeded - remainingToday) / dailyLimit);
  }
  return { characters, pages, chunks, requestsNeeded, remainingToday, fitsToday, daysNeeded };
}
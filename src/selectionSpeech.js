import { cleanText } from './textPipeline.js';

export function selectionReadState(rawSelection, maxChars) {
  const text = cleanText(rawSelection == null ? '' : String(rawSelection));
  if (text === '') {
    return { ok: false, text, reason: 'Nothing selected' };
  }
  if (text.length > maxChars) {
    return { ok: false, text, reason: `Selection is ${text.length} characters, the limit is ${maxChars} (chunk size)` };
  }
  return { ok: true, text, reason: null };
}
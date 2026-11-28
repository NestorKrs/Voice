import { TAG_RE, BREAK_RE, hasSpeakableText } from './directives.js';

export function cleanText(text) {
  if (typeof text !== 'string' || text === '') return '';
  let t = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
// oxlint-disable-next-line no-control-regex -- strips control characters on purpose
  t = t.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
  t = t.replace(/[ \t]+/g, ' ');
  t = t.split('\n').map((line) => line.trim()).join('\n');
  t = t.replace(/\n{3,}/g, '\n\n');
  t = t.trim();
  return t;
}

const PLACEHOLDER_START = '\uE000';
const PLACEHOLDER_END = '\uE001';

// A fresh global RegExp from a shared one, so lastIndex never leaks between calls.
function globalRe(re) {
  return new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
}

// Swap every break tag and [tag] for a whitespace-free placeholder, keeping the
// originals so they can be restored byte for byte after the text is chunked.
function protectDirectives(text) {
  const originals = [];
  const hold = (match) => {
    originals.push(match);
    return PLACEHOLDER_START + (originals.length - 1) + PLACEHOLDER_END;
  };
  let out = text.replace(globalRe(BREAK_RE), hold);
  out = out.replace(globalRe(TAG_RE), hold);
  return { text: out, originals };
}

function restoreDirectives(text, originals) {
  if (originals.length === 0) return text;
  return text.replace(/\uE000(\d+)\uE001/g, (match, digits) => originals[Number(digits)]);
}

// A chunk with nothing speakable (only tags, breaks, punctuation or whitespace)
// joins its neighbour with a single space instead of standing on its own.
function mergeNonSpeakable(chunks) {
  const out = [];
  let pending = null;
  for (const chunk of chunks) {
    if (hasSpeakableText(chunk)) {
      if (pending !== null) {
        out.push(pending + ' ' + chunk);
        pending = null;
      } else {
        out.push(chunk);
      }
    } else if (out.length > 0) {
      out[out.length - 1] += ' ' + chunk;
    } else {
      pending = pending === null ? chunk : pending + ' ' + chunk;
    }
  }
  if (pending !== null) out.push(pending);
  return out;
}

function splitLongWord(word, maxChars) {
  const out = [];
  for (let i = 0; i < word.length; i += maxChars) {
    out.push(word.slice(i, i + maxChars));
  }
  return out;
}

function splitSentence(sentence, maxChars) {
  const words = sentence.split(/\s+/).filter(Boolean);
  const out = [];
  let current = '';
  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        out.push(current);
        current = '';
      }
      out.push(...splitLongWord(word, maxChars));
    } else if (current === '') {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ' ' + word;
    } else {
      out.push(current);
      current = word;
    }
  }
  if (current) out.push(current);
  return out.map((c) => c.trim()).filter(Boolean);
}

function splitParagraph(paragraph, maxChars) {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
  const sentences = [...segmenter.segment(paragraph)].map((s) => s.segment);
  const out = [];
  let current = '';
  for (const sent of sentences) {
    if (sent.length > maxChars) {
      if (current) {
        out.push(current);
        current = '';
      }
      out.push(...splitSentence(sent, maxChars));
    } else if (current === '') {
      current = sent;
    } else if (current.length + sent.length <= maxChars) {
      current += sent;
    } else {
      out.push(current);
      current = sent;
    }
  }
  if (current) out.push(current);
  return out.map((c) => c.trim()).filter(Boolean);
}

export function chunkText(text, maxChars = 2000) {
  const cleaned = cleanText(text);
  if (!cleaned) return [];
  const { text: protectedText, originals } = protectDirectives(cleaned);
  const paragraphs = protectedText.split(/\n\n+/);
  const chunks = [];
  let current = '';
  for (const para of paragraphs) {
    if (para.trim() === '') continue;
    if (para.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      chunks.push(...splitParagraph(para, maxChars));
    } else if (current === '') {
      current = para;
    } else if (current.length + 2 + para.length <= maxChars) {
      current += '\n\n' + para;
    } else {
      chunks.push(current);
      current = para;
    }
  }
  if (current) chunks.push(current);
  const restored = chunks.map((c) => restoreDirectives(c, originals)).map((c) => c.trim()).filter(Boolean);
  return mergeNonSpeakable(restored);
}
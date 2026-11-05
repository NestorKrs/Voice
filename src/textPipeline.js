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
  const paragraphs = cleaned.split(/\n\n+/);
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
  return chunks.map((c) => c.trim()).filter(Boolean);
}
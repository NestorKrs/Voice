// Delivery tag catalogue for the Text panel. Pure data plus two lookups.

export const TAG_CATEGORIES = [
  { id: 'pace', label: 'Pace', tags: ['slowly', 'very slowly', 'deliberately', 'measured', 'rapidly', 'carefully', 'rhythmically', 'evenly', 'unhurried', 'with pauses'] },
  { id: 'conversational', label: 'Conversational delivery', tags: ['conversationally', 'naturally', 'narrator', 'remembering', 'thinking aloud'] },
  { id: 'soft', label: 'Softness and restraint', tags: ['softly', 'quietly', 'gently', 'calmly', 'subtly', 'understated', 'restrained', 'delicately', 'lightly'] },
  { id: 'reflection', label: 'Reflection and curiosity', tags: ['thoughtfully', 'reflectively', 'curiously', 'inquisitively'] },
  { id: 'emotion', label: 'Emotion', tags: ['sincerely', 'warmly', 'tenderly', 'hopefully', 'optimistically', 'pessimistically', 'sadly', 'melancholically', 'nostalgically', 'regretfully', 'anxiously', 'uneasily', 'reluctantly'] },
  { id: 'humour', label: 'Frustration and humour', tags: ['frustrated', 'irritated', 'amused', 'dryly'] },
  { id: 'cinematic', label: 'Cinematic colour', tags: ['cinematically', 'richly', 'cheerfully'] },
  { id: 'whisper', label: 'Whisper and low-volume', tags: ['whispering', "under one's breath", 'barely audible', 'soft-spoken', 'hushed', 'muted', 'subdued', 'low-voiced'] },
];

export const RETEST_TAGS = ['emphatically', 'energetically'];

// The owner tested the tag list on this model.
export const TAGS_TESTED_ON = 'heygen/heygen-voice-1-turbo:free';

export function allTags() {
  return TAG_CATEGORIES.flatMap((c) => c.tags);
}

export function isKnownTag(name) {
  const needle = (typeof name === 'string' ? name : '').trim().toLowerCase();
  if (needle === '') return false;
  return TAG_CATEGORIES.some((c) => c.tags.some((t) => t.toLowerCase() === needle));
}
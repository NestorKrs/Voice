// Pure cut-list CSV builder for a later clip editor. No DOM, no file writes.

import { formatTime, samplesToMs } from './clipCuts.js';

const HEADER = 'name,start_ms,end_ms,duration_ms,start_time,end_time';

export function csvEscape(value) {
  let text = String(value);
  if (/^[=+\-@\t]/.test(text)) text = "'" + text;
  if (/[",\r\n]/.test(text)) text = '"' + text.replace(/"/g, '""') + '"';
  return text;
}

export function buildCutListCsv(clips, rate) {
  const lines = [HEADER];
  for (const clip of clips) {
    lines.push([
      csvEscape(clip.name),
      samplesToMs(clip.start, rate).toFixed(3),
      samplesToMs(clip.end, rate).toFixed(3),
      samplesToMs(clip.end - clip.start, rate).toFixed(3),
      formatTime(clip.start, rate),
      formatTime(clip.end, rate),
    ].join(','));
  }
  return lines.map((line) => line + '\r\n').join('');
}

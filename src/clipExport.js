// Pure clip export helpers for a later clip editor. No DOM, no file writes.

import { sliceAll, fadeSamples, uniqueNames } from './clipSlices.js';
import { buildCutListCsv } from './clipCsv.js';

function effectiveNames(names, count) {
  const padded = Array.from({ length: count }, (_, i) => names[i] ?? '');
  return uniqueNames(padded);
}

export function clipFileNames(names, count, ext) {
  return effectiveNames(names, count).map((name) => name + '.' + ext);
}

export async function buildClipFiles({
  samples, rate, segments, names, format, fadeMs, encode, fadeIn, fadeOut, fadeClips,
}) {
  let fade;
  if (fadeIn === undefined && fadeOut === undefined) {
    fade = fadeMs ? fadeSamples(fadeMs, rate) : 0;
  } else {
    const n = fadeMs ? fadeSamples(fadeMs, rate) : 0;
    const selected = fadeClips == null ? null : new Set(fadeClips);
    fade = (index) => (selected && !selected.has(index)
      ? 0
      : { inN: fadeIn ? n : 0, outN: fadeOut ? n : 0 });
  }
  const clips = sliceAll(samples, segments, fade);
  const fileNames = clipFileNames(names, segments.length, format);
  const files = [];
  const skipped = [];

  for (let i = 0; i < clips.length; i += 1) {
    if (clips[i].length === 0) {
      skipped.push(i + 1);
      continue;
    }
    let bytes;
    try {
      bytes = await encode(clips[i], rate, format);
    } catch (e) {
      throw new Error('Clip ' + (i + 1) + ': ' + (e && e.message ? e.message : 'could not encode'));
    }
    files.push({ name: fileNames[i], bytes, start: segments[i].start, end: segments[i].end });
  }

  return { files, skipped };
}

export function buildCutListFile({ names, segments, rate }) {
  const bases = effectiveNames(names, segments.length);
  const clips = segments.map((segment, i) => ({
    name: bases[i],
    start: segment.start,
    end: segment.end,
  }));
  return {
    name: 'cut-list.csv',
    bytes: new TextEncoder().encode(buildCutListCsv(clips, rate)),
  };
}

export async function buildZipEntries(args) {
  const { files, skipped } = await buildClipFiles(args);
  const cutList = buildCutListFile(args);
  return {
    entries: [...files.map((file) => ({ name: file.name, bytes: file.bytes })), cutList],
    skipped,
  };
}

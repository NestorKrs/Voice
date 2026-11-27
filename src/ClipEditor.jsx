import { useEffect, useMemo, useRef, useState } from 'react';
import { buildPeaks, peaksForRange } from './waveformPeaks.js';
import { createCuts, addMarker, moveMarker, undo, redo, segments, formatTime } from './clipCuts.js';
import { realignNames, firstSentence } from './clipNames.js';
import { defaultClipName } from './clipSlices.js';
import { buildClipFiles, buildZipEntries, buildCutListFile, clipFileNames } from './clipExport.js';
import { compensateKeyPress, snapToQuiet, SNAP_RADIUS_MS, FADE_MS } from './clipSnap.js';
import { createMarkerStore } from './clipMarkerStore.js';
import { createClipPlayer } from './clipPlayer.js';
import { fullView, zoomAt, wheelFactor, panByPixels, sampleAtX, xAtSample, ensureVisible, MIN_SPAN, isFullView } from './clipView.js';
import { createClipTextMapper } from './clipText.js';
import { findSilences } from './silenceMap.js';
import { alignTimeMap } from './alignMap.js';
import { sentenceRanges, charWeights } from './highlight.js';

export default function ClipEditor({ audio, loading, error, scopeValue, scopeOptions, onScopeChange, chunkTexts = [], audioKey = null, clipExportDeps }) {
  const rootRef = useRef(null);
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const observerRef = useRef(null);
  const viewRef = useRef(null);
  const dragRef = useRef(null);
  const markerDragRef = useRef(null);
  const scrubRef = useRef(null);
  const namesRef = useRef([]);
  const clipRangeRef = useRef(null);
  const playerRef = useRef(null);
  const loopOnRef = useRef(false);
  const anchorRef = useRef(null);
  const markerCountRef = useRef(0);
  const cutsRef = useRef(null);
  const storeRef = useRef(null);
  const restoringRef = useRef(false);
  const [width, setWidth] = useState(0);
  const [view, setView] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [nearPlayhead, setNearPlayhead] = useState(false);
  const [playPos, setPlayPos] = useState(0);
  const [playStatus, setPlayStatus] = useState('idle');
  const [playbackError, setPlaybackError] = useState('');
  const [loopOn, setLoopOn] = useState(false);
  loopOnRef.current = loopOn;
  const [cuts, setCuts] = useState(null);
  const [names, setNames] = useState([]);
  const [playingClip, setPlayingClip] = useState(null);
  const [sliceMode, setSliceMode] = useState(false);
  const [hoverSample, setHoverSample] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  const [shiftDown, setShiftDown] = useState(false);
  const [storeMessage, setStoreMessage] = useState('');
  const [restoreNote, setRestoreNote] = useState('');
  const [fadeIn, setFadeIn] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [fadeScope, setFadeScope] = useState('all');
  const [selectedClips, setSelectedClips] = useState([]);
  const [exportMsg, setExportMsg] = useState('');

  const total = audio ? audio.samples.length : 0;
  const rate = audio ? audio.sampleRate : 0;
  const displayRate = rate || 1;
  const peaks = useMemo(() => (audio ? buildPeaks(audio.samples) : null), [audio]);
  const message = loading ? 'Decoding audio...' : playbackError || storeMessage || exportMsg || error || (total === 0 ? 'No ready chunks to edit yet.' : '');
  const current = view || fullView(total);
  const headX = total > 0 && width > 0 ? xAtSample(current, playPos, width) : -1;
  const headVisible = headX >= 0 && headX <= width;
  const minSpan = Math.min(total, Math.max(MIN_SPAN, Math.round(rate * 0.4)));
  const cutsRefCurrent = cuts && cuts.total === total && cuts.rate === rate ? cuts : null;
  cutsRef.current = cutsRefCurrent;
  const clipSegments = cutsRefCurrent ? segments(cutsRefCurrent) : [];
  const loopState = playerRef.current ? playerRef.current.getState() : null;
  const nowIndex = audio ? audio.offsets.reduce((last, offset, i) => (offset <= playPos ? i : last), -1) : -1;
  const nowChunk = nowIndex >= 0 ? audio.indexes[nowIndex] : -1;
  const nowText = nowChunk >= 0 && chunkTexts[nowChunk]
    ? chunkTexts[nowChunk].slice(0, 200) + (chunkTexts[nowChunk].length > 200 ? '…' : '')
    : '';

  const textMapper = useMemo(() => {
    try {
      return audio && chunkTexts && chunkTexts.length
        ? createClipTextMapper({ audio, chunkTexts, deps: { findSilences, alignTimeMap, charWeights, sentenceRanges } })
        : null;
    } catch (e) {
      return null;
    }
  }, [audio, chunkTexts]);
  const clipTexts = useMemo(() => {
    if (!textMapper || !cuts || cuts.markers.length === 0) return null;
    return segments(cuts).map((s) => textMapper.textForRange(s.start, s.end));
  }, [textMapper, cuts]);
  const clipTextList = useMemo(
    () => (clipTexts ? clipTexts.map((c) => c.text) : []),
    [clipTexts],
  );
  const rowFileNames = clipExportDeps
    ? clipFileNames(namesRef.current, clipSegments.length, clipExportDeps.format, clipTextList)
    : [];
  const clipList = clipTexts ? segments(cuts) : null;
  const nowClipIndex = clipList
    ? clipList.reduce((last, segment, i) => (segment.start <= playPos ? i : last), clipList.length - 1)
    : -1;
  const nowClip = nowClipIndex >= 0 && clipList ? clipList[nowClipIndex] : null;
  const nowClipChunkPos = nowClip && audio
    ? audio.offsets.reduce((last, offset, i) => (offset <= nowClip.start ? i : last), -1)
    : -1;
  const nowClipChunkNo = nowClipChunkPos >= 0 && audio ? audio.indexes[nowClipChunkPos] + 1 : 0;
  const nowClipText = nowClip && clipTexts ? clipTexts[nowClipIndex] : null;

  const snapIf = (sample, shiftHeld) => (shiftHeld ? snapToQuiet(audio.samples, rate, sample) : sample);

  const applyCuts = (nextCuts) => {
    const oldMarkers = cutsRef.current ? cutsRef.current.markers : [];
    const newMarkers = nextCuts ? nextCuts.markers : [];
    const nextNames = realignNames(namesRef.current, oldMarkers, newMarkers);
    namesRef.current = nextNames;
    setNames(nextNames);
    setCuts(nextCuts);
  };

  useEffect(() => {
    try {
      storeRef.current = createMarkerStore(window.localStorage);
    } catch {
      storeRef.current = null;
    }
  }, []);

  useEffect(() => {
    const next = audio ? fullView(audio.samples.length) : null;
    viewRef.current = next;
    setView(next);
    setSliceMode(false);
    setHoverSample(null);
    setStoreMessage('');
    setRestoreNote('');
    setNames([]);
    namesRef.current = [];
    setPlayingClip(null);
    clipRangeRef.current = null;
    setSelectedClips([]);
    anchorRef.current = null;
    let fresh = audio ? createCuts(audio.samples.length, audio.sampleRate) : null;
    if (audio && audioKey && storeRef.current) {
      const stored = storeRef.current.load(audioKey, audio.samples.length);
      if (stored && stored.markers.length > 0) {
        restoringRef.current = true;
        for (const marker of stored.markers) fresh = addMarker(fresh, marker);
        setRestoreNote('Restored ' + stored.markers.length + ' cuts for this audio.');
      }
    }
    if (fresh) setCuts({ ...fresh, past: [], future: [] });
    else setCuts(null);
  }, [audio, audioKey]);

  useEffect(() => {
    if (!cuts || !audioKey || !audio) return undefined;
    if (restoringRef.current) {
      restoringRef.current = false;
      return undefined;
    }
    const timer = setTimeout(() => {
      const store = storeRef.current;
      if (!store) {
        setStoreMessage('Cannot save cut markers: browser storage is not available.');
        return;
      }
      const ok = store.save(audioKey, total, rate, cuts.markers, []);
      if (ok) setStoreMessage('');
      else setStoreMessage('Cannot save cut markers: browser storage is full or blocked.');
    }, 400);
    return () => clearTimeout(timer);
  }, [cuts, audioKey, audio]);

  useEffect(() => {
    const count = cuts && cuts.markers ? cuts.markers.length : 0;
    if (count === markerCountRef.current) return;
    markerCountRef.current = count;
    setSelectedClips([]);
    anchorRef.current = null;
  }, [cuts]);

  useEffect(() => {
    if (fadeScope === 'selected' && selectedClips.length === 0) setFadeScope('all');
  }, [selectedClips, fadeScope]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const state = player.getState();
    if (!state.looping || state.rangeStart === null) return;
    const active = clipRangeRef.current;
    if (!active) return;
    const list = cutsRef.current ? segments(cutsRef.current) : [];
    const clip = list.find((item) => item.index === active.index);
    if (!clip) {
      player.pause();
      clipRangeRef.current = null;
      setPlayingClip(null);
      setPlayStatus('paused');
      return;
    }
    clipRangeRef.current = { index: clip.index, start: clip.start, end: clip.end };
    if (state.status === 'paused') player.seek(clip.start);
    else player.play(clip.start, clip.end, { loop: true });
  }, [cuts]);

  useEffect(() => {
    setPlayPos(0);
    setPlayStatus('idle');
    setPlaybackError('');
    if (!audio) {
      if (playerRef.current) {
        playerRef.current.close();
        playerRef.current = null;
      }
      return;
    }
    try {
      if (!playerRef.current) {
        playerRef.current = createClipPlayer({
          createContext: () => new (window.AudioContext || window.webkitAudioContext)(),
        });
      }
      playerRef.current.setOnEnd(() => {
        clipRangeRef.current = null;
        setPlayingClip(null);
        setPlayStatus('idle');
        setPlayPos(audio.samples.length);
      });
      playerRef.current.load(audio.samples, audio.sampleRate);
    } catch (e) {
      if (playerRef.current) {
        playerRef.current.close();
        playerRef.current = null;
      }
      setPlaybackError('Audio playback is not available: ' + (e && e.message ? e.message : String(e)));
    }
  }, [audio]);

  useEffect(() => () => {
    if (playerRef.current) playerRef.current.close();
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    observerRef.current = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observerRef.current.observe(wrap);
    return () => {
      observerRef.current.disconnect();
      observerRef.current = null;
    };
  }, [message]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks || width <= 0) return;
    const css = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const deviceWidth = Math.max(1, Math.round(css.width * dpr));
    const deviceHeight = Math.max(1, Math.round(css.height * dpr));
    canvas.width = deviceWidth;
    canvas.height = deviceHeight;

    const ctx = canvas.getContext('2d');
    const styles = getComputedStyle(rootRef.current);
    const accent = styles.getPropertyValue('--accent').trim();
    const line = styles.getPropertyValue('--line').trim();
    const panel = styles.getPropertyValue('--panel').trim();
    const centre = deviceHeight / 2;
    const v = view || fullView(total);

    ctx.fillStyle = panel;
    ctx.fillRect(0, 0, deviceWidth, deviceHeight);
    ctx.strokeStyle = line;
    ctx.beginPath();
    ctx.moveTo(0, centre);
    ctx.lineTo(deviceWidth, centre);
    ctx.stroke();

    const { min, max } = peaksForRange(peaks, audio.samples, v.start, v.start + v.span, deviceWidth);
    ctx.strokeStyle = accent;
    ctx.beginPath();
    for (let x = 0; x < deviceWidth; x += 1) {
      ctx.moveTo(x + 0.5, centre - max[x] * centre);
      ctx.lineTo(x + 0.5, centre - min[x] * centre);
    }
    ctx.stroke();

    ctx.strokeStyle = line;
    ctx.beginPath();
    for (let i = 1; i < audio.offsets.length; i += 1) {
      const x = xAtSample(v, audio.offsets[i], deviceWidth);
      if (x < 0 || x > deviceWidth) continue;
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, deviceHeight);
    }
    ctx.stroke();

    if (total > 0) {
      const x = xAtSample(v, playPos, deviceWidth);
      if (x >= 0 && x <= deviceWidth) {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, deviceHeight);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }

    ctx.font = '11px monospace';
    if (cuts && cuts.total === total && cuts.markers.length > 0) {
      ctx.fillStyle = '#ff6f6f';
      ctx.strokeStyle = '#ff6f6f';
      ctx.lineWidth = 2;
      cuts.markers.forEach((marker, i) => {
        if (dragPreview && i === dragPreview.index) return;
        const x = xAtSample(v, marker, deviceWidth);
        if (x < 0 || x > deviceWidth) return;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, deviceHeight);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - 5, 0);
        ctx.lineTo(x + 5, 0);
        ctx.lineTo(x, 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillText(String(i + 1), x + 4, 20);
      });
      ctx.lineWidth = 1;
    }

    if (dragPreview) {
      const x = xAtSample(v, dragPreview.sample, deviceWidth);
      if (x >= 0 && x <= deviceWidth) {
        ctx.strokeStyle = '#ff6f6f';
        ctx.fillStyle = '#ff6f6f';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, deviceHeight);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x - 5, 0);
        ctx.lineTo(x + 5, 0);
        ctx.lineTo(x, 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillText(formatTime(dragPreview.sample, rate), x + 4, 34);
      }
    }

    if (sliceMode && hoverSample !== null) {
      const shown = snapIf(hoverSample, shiftDown);
      const x = xAtSample(v, shown, deviceWidth);
      if (x >= 0 && x <= deviceWidth) {
        ctx.strokeStyle = '#ff6f6f';
        ctx.fillStyle = '#ff6f6f';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, deviceHeight);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillText(formatTime(shown, rate), x + 4, 34);
      }
    }
  }, [audio, peaks, total, width, message, view, playPos, cuts, hoverSample, sliceMode, dragPreview, shiftDown]);

  useEffect(() => {
    if (playStatus !== 'playing') return undefined;
    let raf = 0;
    let last = 0;
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 50) return;
      last = now;
      const player = playerRef.current;
      if (!player) return;
      const position = player.getState().position;
      setPlayPos((prev) => (prev === position ? prev : position));
      const base = viewRef.current || fullView(total);
      const next = ensureVisible(base, total, position);
      if (next !== base) {
        viewRef.current = next;
        setView(next);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playStatus, total]);

  const togglePlay = () => {
    const player = playerRef.current;
    if (!player) return;
    clipRangeRef.current = null;
    setPlayingClip(null);
    if (playStatus === 'playing') {
      player.pause();
      setPlayStatus('paused');
    } else if (player.play()) {
      setPlayStatus('playing');
    }
  };

  const playClip = (segment) => {
    const player = playerRef.current;
    if (!player) return;
    const active = clipRangeRef.current;
    if (active && active.index === segment.index && playStatus === 'playing') {
      player.pause();
      setPlayStatus('paused');
      return;
    }
    if (active && active.index === segment.index && playStatus === 'paused') {
      if (player.play()) setPlayStatus('playing');
      return;
    }
    if (!player.play(segment.start, segment.end, { loop: loopOnRef.current })) return;
    clipRangeRef.current = { index: segment.index, start: segment.start, end: segment.end };
    setPlayingClip(segment.index);
    setPlayStatus('playing');
    setPlayPos(segment.start);
  };

  const onRowClick = (event, index) => {
    if (event.target.closest('button, input')) return;
    if (event.shiftKey && anchorRef.current !== null) {
      const from = Math.min(anchorRef.current, index);
      const to = Math.max(anchorRef.current, index);
      const range = [];
      for (let i = from; i <= to; i += 1) range.push(i);
      setSelectedClips(range);
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      setSelectedClips((prev) => (prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index].sort((a, b) => a - b)));
      anchorRef.current = index;
      return;
    }
    setSelectedClips([index]);
    anchorRef.current = index;
  };

  const goToStart = () => {
    if (!playerRef.current) return;
    playerRef.current.seek(0);
    setPlayPos(0);
    const base = viewRef.current || fullView(total);
    const next = ensureVisible(base, total, 0);
    if (next !== base) {
      viewRef.current = next;
      setView(next);
    }
  };

  useEffect(() => {
    const isTyping = (target) => target && (
      target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable
    );
    const onKey = (event) => {
      if (event.key === 'Shift') {
        setShiftDown(event.type === 'keydown');
        return;
      }
      if (isTyping(event.target) || event.repeat) return;
      if (event.code === 'Space') {
        event.preventDefault();
        if (event.type === 'keydown') togglePlay();
        return;
      }
      if (event.code === 'Home') {
        event.preventDefault();
        if (event.type === 'keydown') goToStart();
        return;
      }
      if (event.code === 'Escape') {
        if (event.type === 'keydown') setSelectedClips([]);
        return;
      }
      if (event.type !== 'keydown' || !cutsRef.current) return;
      if (event.code === 'KeyM') {
        event.preventDefault();
        const at = playStatus === 'playing' ? compensateKeyPress(playPos, rate) : playPos;
        applyCuts(addMarker(cutsRef.current, snapIf(at, event.shiftKey)));
      } else if (event.code === 'KeyZ' && event.ctrlKey) {
        event.preventDefault();
        applyCuts(event.shiftKey ? redo(cutsRef.current) : undo(cutsRef.current));
      } else if (event.code === 'KeyY' && event.ctrlKey) {
        event.preventDefault();
        applyCuts(redo(cutsRef.current));
      }
    };
    const onBlur = () => setShiftDown(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKey);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', onBlur);
    };
  }, [playStatus, playPos, rate]);

  const applySpan = (targetSpan, anchorSample) => {
    const base = viewRef.current || fullView(total);
    const span = Math.min(total, Math.max(minSpan, Math.round(targetSpan)));
    const next = zoomAt(base, total, base.span / span, anchorSample);
    viewRef.current = next;
    setView(next);
  };

  const zoomBy = (factor) => {
    const base = viewRef.current || fullView(total);
    applySpan(base.span / factor, base.start + base.span / 2);
  };

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || total === 0) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      const box = wrap.getBoundingClientRect();
      const widthPx = box.width;
      if (widthPx <= 0) return;
      const base = viewRef.current || fullView(total);
      const anchorSample = sampleAtX(base, event.clientX - box.left, widthPx);
      applySpan(base.span / wheelFactor(event.deltaY), anchorSample);
    };
    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => wrap.removeEventListener('wheel', onWheel, { passive: false });
  }, [total, rate, message]);

  const seekTo = (sample) => {
    const player = playerRef.current;
    if (!player) return;
    player.seek(sample);
    setPlayPos(sample);
  };

  const beginScrub = (event, sample) => {
    const player = playerRef.current;
    if (!player || total === 0) return;
    const wasPlaying = player.getState().status === 'playing';
    if (wasPlaying) player.pause();
    scrubRef.current = { wasPlaying, id: event.pointerId };
    setNearPlayhead(false);
    if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
    seekTo(sample);
  };

  const endScrub = (event) => {
    const scrub = scrubRef.current;
    if (!scrub || scrub.id !== event.pointerId) return;
    scrubRef.current = null;
    if (event.currentTarget.hasPointerCapture && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (scrub.wasPlaying && playerRef.current) playerRef.current.play();
  };

  const rulerSeek = (event) => {
    const wrap = wrapRef.current;
    const box = wrap ? wrap.getBoundingClientRect() : null;
    if (!box || box.width <= 0) return;
    const base = viewRef.current || fullView(total);
    seekTo(sampleAtX(base, event.clientX - box.left, box.width));
  };

  const onRulerDown = (event) => {
    event.stopPropagation();
    if (event.button !== 0 || total === 0) return;
    const wrap = wrapRef.current;
    const box = wrap ? wrap.getBoundingClientRect() : null;
    if (!box || box.width <= 0) return;
    const base = viewRef.current || fullView(total);
    beginScrub(event, sampleAtX(base, event.clientX - box.left, box.width));
  };

  const onRulerMove = (event) => {
    if (!scrubRef.current || scrubRef.current.id !== event.pointerId) return;
    event.stopPropagation();
    rulerSeek(event);
  };

  const onRulerUp = (event) => {
    event.stopPropagation();
    endScrub(event);
  };

  const onPointerDown = (event) => {
    if (event.button !== 0 || total === 0) return;
    const wrap = wrapRef.current;
    const box = wrap ? wrap.getBoundingClientRect() : null;
    const base = viewRef.current || fullView(total);
    if (box && box.width > 0 && cutsRef.current) {
      const px = event.clientX - box.left;
      const index = cutsRef.current.markers.findIndex((marker) => {
        const x = xAtSample(base, marker, box.width);
        return x >= 0 && x <= box.width && Math.abs(x - px) <= 8;
      });
      if (index !== -1) {
        const sample = cutsRef.current.markers[index];
        markerDragRef.current = { index, sample, id: event.pointerId };
        setDragPreview({ index, sample });
        setHoverSample(null);
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
    }
    if (box && box.width > 0) {
      const px = event.clientX - box.left;
      const headX = xAtSample(base, playPos, box.width);
      if (headX >= 0 && headX <= box.width && Math.abs(headX - px) <= 6) {
        beginScrub(event, sampleAtX(base, px, box.width));
        return;
      }
    }
    dragRef.current = { x: event.clientX, startX: event.clientX, moved: 0, id: event.pointerId };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    const scrub = scrubRef.current;
    if (scrub && scrub.id === event.pointerId) {
      rulerSeek(event);
      return;
    }
    const markerDrag = markerDragRef.current;
    if (markerDrag && markerDrag.id === event.pointerId) {
      const wrap = wrapRef.current;
      const box = wrap ? wrap.getBoundingClientRect() : null;
      if (box && box.width > 0) {
        const base = viewRef.current || fullView(total);
        markerDrag.sample = sampleAtX(base, event.clientX - box.left, box.width);
        setDragPreview({ index: markerDrag.index, sample: snapIf(markerDrag.sample, event.shiftKey) });
      }
      return;
    }
    if (sliceMode && audio) {
      const wrap = wrapRef.current;
      const box = wrap ? wrap.getBoundingClientRect() : null;
      if (box && box.width > 0) {
        const base = viewRef.current || fullView(total);
        setHoverSample(sampleAtX(base, event.clientX - box.left, box.width));
      }
    }
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) {
      const wrap = wrapRef.current;
      const box = wrap ? wrap.getBoundingClientRect() : null;
      if (box && box.width > 0 && !sliceMode) {
        const base = viewRef.current || fullView(total);
        const px = event.clientX - box.left;
        const headX = xAtSample(base, playPos, box.width);
        const nearMarker = cutsRef.current ? cutsRef.current.markers.some((marker) => {
          const x = xAtSample(base, marker, box.width);
          return x >= 0 && x <= box.width && Math.abs(x - px) <= 8;
        }) : false;
        setNearPlayhead(!nearMarker && headX >= 0 && headX <= box.width && Math.abs(headX - px) <= 6);
      } else {
        setNearPlayhead(false);
      }
      return;
    }
    const dx = event.clientX - drag.x;
    drag.moved += Math.abs(dx);
    drag.x = event.clientX;
    const wrap = wrapRef.current;
    const widthPx = wrap ? wrap.getBoundingClientRect().width : 0;
    if (widthPx <= 0) return;
    const base = viewRef.current || fullView(total);
    const next = panByPixels(base, total, -dx, widthPx);
    viewRef.current = next;
    setView(next);
  };

  const endDrag = (event) => {
    if (scrubRef.current && scrubRef.current.id === event.pointerId) {
      endScrub(event);
      return;
    }
    const markerDrag = markerDragRef.current;
    if (markerDrag && markerDrag.id === event.pointerId) {
      markerDragRef.current = null;
      setDragPreview(null);
      if (event.type === 'pointerup' && cutsRef.current) {
        applyCuts(moveMarker(cutsRef.current, markerDrag.index, snapIf(markerDrag.sample, event.shiftKey)));
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    setDragging(false);
    if (drag.moved < 4 && event.type === 'pointerup' && audio) {
      const wrap = wrapRef.current;
      const box = wrap ? wrap.getBoundingClientRect() : null;
      if (box && box.width > 0) {
        const base = viewRef.current || fullView(total);
        const sample = sampleAtX(base, event.clientX - box.left, box.width);
        if (sliceMode) {
          if (cutsRef.current) applyCuts(addMarker(cutsRef.current, snapIf(sample, event.shiftKey)));
        } else if (playerRef.current) {
          playerRef.current.seek(sample);
          clipRangeRef.current = null;
          setPlayingClip(null);
          setPlayPos(sample);
        }
      }
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const showAll = () => {
    const next = fullView(total);
    viewRef.current = next;
    setView(next);
  };

  const exportDisabledReason = !audio ? 'No audio loaded'
    : (!cuts ? 'Add at least one cut first' : (!clipExportDeps ? 'Export is not available' : ''));

  const exportArgs = () => ({
    samples: audio.samples,
    rate: audio.sampleRate,
    segments: cutsRef.current ? segments(cutsRef.current) : [],
    names: namesRef.current,
    texts: clipTextList,
    format: clipExportDeps.format,
    fadeIn,
    fadeOut,
    fadeMs: FADE_MS,
    fadeClips: fadeScope === 'selected' ? selectedClips : null,
    encode: clipExportDeps.encode,
  });

  const exportFailed = (ok) => {
    if (ok === false) setExportMsg('Clip export failed. See the notice and status bar for the reason.');
  };

  const downloadClip = (index) => {
    setExportMsg('');
    const all = exportArgs();
    const name = clipFileNames(namesRef.current, all.segments.length, clipExportDeps.format, clipTextList)[index];
    const mime = clipExportDeps.format === 'wav' ? 'audio/wav' : 'audio/mpeg';
    const fadeClips = fadeScope === 'selected' ? (selectedClips.includes(index) ? [0] : []) : null;
    clipExportDeps.save(name, mime, async () => {
      const { files } = await buildClipFiles({
        ...all,
        segments: [all.segments[index]],
        names: [all.names[index]],
        texts: [clipTextList[index]],
        fadeClips,
      });
      return files.length > 0 ? files[0].bytes : new Uint8Array(0);
    }).then(exportFailed);
  };

  const exportZip = () => {
    setExportMsg('');
    clipExportDeps.save('voice-clips.zip', 'application/zip', async () => {
      const { entries, skipped } = await buildZipEntries(exportArgs());
      if (skipped.length) setExportMsg('Skipped empty clips: ' + skipped.join(', '));
      return clipExportDeps.zip(entries);
    }).then(exportFailed);
  };

  const exportCsv = () => {
    setExportMsg('');
    clipExportDeps.save('cut-list.csv', 'text/csv', async () => buildCutListFile(exportArgs()).bytes)
      .then(exportFailed);
  };

  return (
    <div className="clip-editor" ref={rootRef}>
      <div className="clip-editor-head">
        <span className="panel-title">Clip editor</span>
        <select aria-label="Audio to edit" value={scopeValue} onChange={(event) => onScopeChange(event.target.value)}>
          {scopeOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      {total > 0 && (
        <span className="clip-info">Length {formatTime(total, rate)} - {rate} Hz - {audio.offsets.length} chunk(s)</span>
      )}
      {message ? (
        <div className="clip-msg">{message}</div>
      ) : (
        <>
          <div className="clip-tools">
            <button type="button" className="icon-btn" aria-label="Zoom out" title={isFullView(current, total) ? 'Already showing the whole audio' : 'Zoom out'} disabled={isFullView(current, total)} onClick={() => zoomBy(1 / 1.5)}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/></svg></button>
            <button type="button" className="icon-btn" aria-label="Zoom in" title={current.span <= minSpan ? 'Zoomed in to the maximum (' + formatTime(minSpan, rate) + ' visible)' : 'Zoom in'} disabled={current.span <= minSpan} onClick={() => zoomBy(1.5)}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5v14"/></svg></button>
            <button
              type="button"
              className={'icon-btn' + (sliceMode ? ' active' : '')}
              aria-label="Blade tool"
              aria-pressed={sliceMode}
              title={!audio ? 'No audio loaded' : (sliceMode ? 'Blade tool: click the waveform to cut there (on)' : 'Blade tool: click the waveform to cut there (off)')}
              disabled={!audio}
              onClick={() => { setSliceMode((on) => !on); setHoverSample(null); }}
            ><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 6v12M16 6v12M3 12h18"/></svg></button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Undo"
              title={!audio ? 'No audio loaded' : (!cuts || cuts.past.length === 0 ? 'Nothing to undo' : 'Undo (Ctrl+Z)')}
              disabled={!audio || !cuts || cuts.past.length === 0}
              onClick={() => applyCuts(undo(cutsRef.current))}
            ><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/></svg></button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Redo"
              title={!audio ? 'No audio loaded' : (!cuts || cuts.future.length === 0 ? 'Nothing to redo' : 'Redo (Ctrl+Shift+Z)')}
              disabled={!audio || !cuts || cuts.future.length === 0}
              onClick={() => applyCuts(redo(cutsRef.current))}
            ><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h3"/></svg></button>
            {audio ? <span className="clip-visible">{clipSegments.length} clips</span> : null}
          </div>
          <div
            className={`clip-wave${dragging ? ' dragging' : ''}${sliceMode ? ' slice' : ''}${dragPreview ? ' marker-drag' : ''}${nearPlayhead ? ' near-playhead' : ''}`}
            ref={wrapRef}
            title="Wheel: zoom. Drag: scroll. Double-click: show all."
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerLeave={() => { setHoverSample(null); setNearPlayhead(false); }}
            onDoubleClick={showAll}
          >
            <div
              className="clip-ruler"
              onPointerDown={onRulerDown}
              onPointerMove={onRulerMove}
              onPointerUp={onRulerUp}
              onPointerCancel={onRulerUp}
            >
              {headVisible ? <div className="clip-playhead-handle" style={{ left: headX + 'px' }} /> : null}
            </div>
            <canvas ref={canvasRef} />
          </div>
          <div className="clip-transport">
            <button
              type="button"
              className="icon-btn"
              aria-label="Go to start (Home)"
              title={!audio ? 'No audio loaded' : 'Go to start (Home)'}
              disabled={!audio}
              onClick={goToStart}
            ><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 5v14M20 5L9 12l11 7z"/></svg></button>
            <button
              type="button"
              className={'play-primary' + (playStatus === 'playing' ? ' play-active' : '')}
              aria-label={playStatus === 'playing' ? 'Pause' : 'Play'}
              title={!audio ? 'No audio loaded' : (playStatus === 'playing' ? 'Pause' : 'Play')}
              disabled={!audio}
              onClick={togglePlay}
            >
              {playStatus === 'playing'
                ? <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
                : <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
            </button>
            <button
              type="button"
              className={'icon-btn' + (loopOn ? ' active' : '')}
              aria-label="Loop clips"
              aria-pressed={loopOn}
              title={!audio ? 'No audio loaded' : (loopOn ? "Loop clips: ON. A clip's play button repeats between its two cuts." : "Loop clips: OFF. A clip's play button plays it once.")}
              disabled={!audio}
              onClick={() => { setLoopOn(!loopOn); if (playerRef.current) playerRef.current.setLoop(!loopOn); }}
            ><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg></button>
            <span className="clip-time">{formatTime(playPos, displayRate)} / {formatTime(total, displayRate)}</span>
          </div>
        </>
      )}
      <div className="clip-list">
        {audio && clipSegments.length > 0
          ? clipSegments.map((segment) => {
              const isPlaying = playingClip === segment.index && playStatus === 'playing';
              const isLooping = Boolean(loopState && loopState.looping && loopState.rangeStart === segment.start && loopState.rangeEnd === segment.end);
              const buttonLabel = (isPlaying ? 'Pause clip ' : 'Play clip ') + (segment.index + 1);
              const chunk = audio ? audio.offsets.reduce((last, offset, i) => (offset <= segment.start ? i : last), -1) : -1;
              const chunkId = chunk >= 0 ? audio.indexes[chunk] : -1;
              const previewText = chunkId >= 0 && chunkTexts[chunkId] ? firstSentence(chunkTexts[chunkId]) : '';
              const clipText = clipTexts ? clipTexts[segment.index] : null;
              const rowText = clipText && clipText.text ? (clipText.estimated ? '~ ' : '') + clipText.text : '';
              const rowTitle = clipText && clipText.text
                ? clipText.text + (clipText.estimated ? ' (estimated: no clear pause found at the cut)' : '')
                : '';
              return (
                <div className={'clip-row' + (isLooping ? ' looping' : '') + (selectedClips.includes(segment.index) ? ' selected' : '')} key={segment.index} onClick={(event) => onRowClick(event, segment.index)}>
                  <button
                    type="button"
                    className={'icon-btn' + (isPlaying ? ' play-active' : '')}
                    aria-label={buttonLabel}
                    title={buttonLabel}
                    onClick={() => playClip(segment)}
                  >
                    {isPlaying
                      ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5v14M15 5v14"/></svg>
                      : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 5l11 7-11 7z"/></svg>}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={'Download clip ' + (segment.index + 1)}
                    title={exportDisabledReason || ('Download clip ' + (segment.index + 1) + ' as ' + rowFileNames[segment.index])}
                    disabled={Boolean(exportDisabledReason)}
                    onClick={(e) => { e.stopPropagation(); downloadClip(segment.index); }}
                  ><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 7v8M8.5 11.5L12 15l3.5-3.5" /></svg></button>
                  <input
                    maxLength={60}
                    aria-label="Clip name"
                    placeholder={rowText || previewText || defaultClipName(segment.index)}
                    title={rowTitle || undefined}
                    value={names[segment.index] || ''}
                    onChange={(event) => {
                      const next = [...namesRef.current];
                      next[segment.index] = event.target.value;
                      namesRef.current = next;
                      setNames(next);
                    }}
                  />
                  <span>{formatTime(segment.start, rate)} - {formatTime(segment.end, rate)}</span>
                  <span>{((segment.end - segment.start) / rate).toFixed(3)} s</span>
                </div>
              );
            })
          : audio ? <div>No cuts yet: use M or the blade tool.</div> : null}
      </div>
      <div className="clip-export">
        <div className="clip-fade">
          <div className="check-row">
            <label className="switch">
              <input type={'checkbox'} checked={fadeIn} disabled={Boolean(exportDisabledReason)} title={exportDisabledReason || 'Fade in at the start of the clip (' + FADE_MS + ' ms)'} aria-label="Fade in" onChange={(event) => setFadeIn(event.target.checked)} />
              <span className="slider" />
            </label>
            <span>Fade in</span>
          </div>
          <div className="check-row">
            <label className="switch">
              <input type={'checkbox'} checked={fadeOut} disabled={Boolean(exportDisabledReason)} title={exportDisabledReason || 'Fade out at the end of the clip (' + FADE_MS + ' ms)'} aria-label="Fade out" onChange={(event) => setFadeOut(event.target.checked)} />
              <span className="slider" />
            </label>
            <span>Fade out</span>
          </div>
          <div className="segmented-text-picker" role="group" aria-label="Apply fades to">
            <button type="button" className={'segmented-text-button' + (fadeScope === 'all' ? ' active' : '')} aria-pressed={fadeScope === 'all'} disabled={Boolean(exportDisabledReason)} title={exportDisabledReason || 'Fade all clips'} onClick={() => setFadeScope('all')}>All clips</button>
            <button type="button" className={'segmented-text-button' + (fadeScope === 'selected' ? ' active' : '')} aria-pressed={fadeScope === 'selected'} disabled={Boolean(exportDisabledReason) || selectedClips.length === 0} title={exportDisabledReason || (selectedClips.length === 0 ? 'Select clips in the list first: click a row, Ctrl+click to add, Shift+click for a range' : 'Fade only the selected clips')} onClick={() => setFadeScope('selected')}>Selected clips</button>
          </div>
          {fadeScope === 'selected' && selectedClips.length === 0 ? <span className="clip-fade-note">No clips selected: no fades will be applied.</span> : null}
        </div>
        <button type="button" disabled={Boolean(exportDisabledReason)} title={exportDisabledReason || 'Download all clips and the cut list as a ZIP'} onClick={exportZip}>Download all clips (ZIP)</button>
        <button type="button" disabled={Boolean(exportDisabledReason)} title={exportDisabledReason || 'Download the cut list as a CSV file'} onClick={exportCsv}>Download cut list (CSV)</button>
      </div>
      <div className="clip-hints">
        <div className="clip-hint">M: cut at the playhead. Blade: cut where you click. Ctrl+Z: undo. Hold Shift while cutting to snap to the quietest spot within {SNAP_RADIUS_MS} ms. Loop: play a clip's button with the loop toggle on to repeat it between its two cuts.</div>
        {restoreNote ? <div className="clip-hint clip-restore">{restoreNote}</div> : null}
      </div>
      <div className="clip-now">
        {clipTexts && nowClip ? (
          <>
            <div>{'Clip ' + (nowClipIndex + 1) + ' of ' + clipList.length + ' - chunk ' + nowClipChunkNo}</div>
            {nowClipText && nowClipText.text ? (
              <div title={nowClipText.text + (nowClipText.estimated ? ' (estimated: no clear pause found at the cut)' : '')}>
                {(nowClipText.estimated ? '~ ' : '') + nowClipText.text}
              </div>
            ) : null}
          </>
        ) : audio && nowIndex >= 0 ? (
          <>
            <div>{'Chunk ' + (audio.indexes[nowIndex] + 1) + ' of ' + audio.offsets.length}</div>
            {nowText ? <div>{nowText}</div> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useMemo } from 'react';
import { APP_VERSION } from './version.js';
import { loadSettings, saveSettings, loadText, saveText, hasKey, saveKey, clearKey } from './settingsStore.js';
import { computeStats } from './textStats.js';
import { chunkText } from './textPipeline.js';
import { findMatches, nextIndex } from './textFind.js';
import { scrollTextareaToIndex } from './textScroll.js';
import { highlightRange, charWeights, charAtFraction } from './highlight.js';
import { createScheduler } from './scheduler.js';
import { createServices } from './wiring.js';
import { createPlayerEngine } from './playerEngine.js';
import { newlyReady, readyFlags, playheadToSend } from './followPlayback.js';
import { RATES, activeRowIndex } from './playerCore.js';
import { allProviders, loadCustomProviders, getProvider, providerLabel } from './providers.js';
import { PCM_DEFAULT_RATE, PCM_DEFAULT_CHANNELS } from './audioFormat.js';
import { chunkFileName, audioKind, convertChunk } from './chunkDownload.js';
import { createMp3Encoder, encodeMp3, pcmToInt16Channels } from './mp3Encoder.js';
import { createZip, zipChunks } from './zipStore.js';
import { stripId3, wavHeader, wavParts, joinMode, sameAs } from './joinAudio.js';
import { DEFAULT_ORDER, movePanel, stepPanel, loadOrder, saveOrder, resetOrder } from './panelLayout.js';
import { DEFAULT_WIDTHS, clampWidths, usableWidth, resizeFromHandle, columnsTemplate, loadWidths, saveWidths, resetWidths } from './panelWidths.js';

const storage = typeof localStorage !== 'undefined' ? localStorage : null;
const services = storage ? createServices({ storage }) : null;

const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');

// Local state keeps the chunk list from re-rendering on every slider move.
function FontWeightControl({ initial, onCommit }) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    document.body.style.setProperty('--font-weight', String(value));
  }, [value]);
  const commit = () => onCommit(value);
  return (
    <div className="row">
      <input className="weight-slider" type="range" min="100" max="800" step="100" value={value} aria-label="Font weight"
        onChange={(e) => setValue(Number(e.target.value))}
        onPointerUp={commit} onKeyUp={commit} />
    </div>
  );
}

// The TTS pauses between sentences, so the linear estimate reaches the next
// sentence before the voice does. Pull the sentence highlight back by this.
const SENTENCE_DELAY = 0.15;

// The weighted lookup slows the word highlight across pauses, so lead it by
// this many seconds to keep it on the voice.
const WORD_LEAD_SECONDS = 0.12;

// Read-only view of the chunk being read. It polls the player engine with
// requestAnimationFrame because the engine emits position updates only about
// 4 times a second, which made the word highlight lag the voice.
function TextReadView({ chunk, mode, engineRef, textZoom, onZoom, onSelectText }) {
  const [hlRange, setHlRange] = useState(null);
  const hlRef = useRef(null);
  const selectingRef = useRef(false);
  const weights = useMemo(() => charWeights(chunk || ''), [chunk]);
  useEffect(() => {
    setHlRange(null);
    if (!chunk || mode === 'none') return undefined;
    let raf;
    let last = 0;
    const tick = (t) => {
      if (t - last >= 50 && !selectingRef.current) {
        last = t;
        const engine = engineRef.current;
        const s = engine ? engine.getState() : null;
        const duration = s ? s.duration : 0;
        const rawPosition = s ? s.position : 0;
        const position = mode === 'sentences' ? Math.max(0, rawPosition - SENTENCE_DELAY) : rawPosition + (mode === 'words' ? WORD_LEAD_SECONDS : 0);
        const fraction = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;
        const char = charAtFraction(weights, fraction);
        setHlRange((prev) => {
          const next = highlightRange(chunk, mode, char);
          return prev && prev.start === next.start && prev.end === next.end ? prev : next;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [chunk, mode, engineRef]);
  useEffect(() => {
    if (hlRef.current) hlRef.current.scrollIntoView({ block: 'nearest' });
  }, [hlRange]);
  useEffect(() => {
    const onUp = () => {
      if (!selectingRef.current) return;
      selectingRef.current = false;
      const sel = window.getSelection();
      onSelectText(sel ? sel.toString().length : 0);
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [onSelectText]);
  const r = hlRange || { start: 0, end: 0 };
  return (
    <div
      className="text-read"
      style={{ fontSize: `${textZoom}%` }}
      tabIndex={0}
      onMouseDown={() => { selectingRef.current = true; }}
      onWheel={(e) => { if (e.ctrlKey) { e.preventDefault(); onZoom((z) => Math.min(200, Math.max(60, z + (e.deltaY < 0 ? 10 : -10)))); } }}
      onKeyDown={(e) => { if (e.ctrlKey && (e.key === '+' || e.key === '=')) { e.preventDefault(); onZoom((z) => Math.min(200, z + 10)); } if (e.ctrlKey && (e.key === '-')) { e.preventDefault(); onZoom((z) => Math.max(60, z - 10)); } if (e.ctrlKey && (e.key === '0')) { e.preventDefault(); onZoom(100); } }}
    >
      {mode === 'none' ? chunk : (
        <>
          {chunk.slice(0, r.start)}
          {hlRange ? <span ref={hlRef} className="text-hl">{chunk.slice(r.start, r.end)}</span> : null}
          {chunk.slice(r.end)}
        </>
      )}
    </div>
  );
}

export default function App() {
  const [text, setText] = useState(() => (storage ? loadText(storage) : ''));
  const [settings, setSettings] = useState(() => (storage ? loadSettings(storage) : { voice: '', chunkSize: 2000, lookahead: 2, dailyLimit: 50, highlightMode: 'words' }));
  const [keySet, setKeySet] = useState(() => (storage ? hasKey(storage) : false));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [voiceInput, setVoiceInput] = useState(settings.voice);
  const [chunkInput, setChunkInput] = useState(settings.chunkSize);
  const [lookInput, setLookInput] = useState(settings.lookahead);
  const [dailyInput, setDailyInput] = useState(settings.dailyLimit);
  const [highlightInput, setHighlightInput] = useState(settings.highlightMode);
  const [spellCheckInput, setSpellCheckInput] = useState(settings.spellCheck);
  const [downloadFormatInput, setDownloadFormatInput] = useState(settings.downloadFormat);
  const [textZoom, setTextZoom] = useState(100);
  const [textDropActive, setTextDropActive] = useState(false);
  const [selectedChars, setSelectedChars] = useState(0);
  const [findQuery, setFindQuery] = useState('');
  const [findIndex, setFindIndex] = useState(-1);
  const [chunkNotes, setChunkNotes] = useState({});
  const [zipRunning, setZipRunning] = useState(false);
  const [joinedRunning, setJoinedRunning] = useState(false);

  useEffect(() => {
    const preventBrowserZoom = (e) => { if (e.ctrlKey) e.preventDefault(); };
    const preventKeyZoom = (e) => { if (e.ctrlKey && e.altKey === false && ['+', '=', '-', '_'].includes(e.key)) e.preventDefault(); };
    window.addEventListener('wheel', preventBrowserZoom, { passive: false });
    window.addEventListener('keydown', preventKeyZoom, { passive: false });
    return () => {
      window.removeEventListener('wheel', preventBrowserZoom);
      window.removeEventListener('keydown', preventKeyZoom);
    };
  }, []);
  // The drawer mounts lazily, so the stored weight has to be applied here too.
  useEffect(() => {
    document.body.style.setProperty('--font-weight', String(settings.fontWeight));
  }, [settings.fontWeight]);
  const [schedState, setSchedState] = useState({ state: 'idle', resetAt: null, playhead: 0, chunks: [] });
  const [usedToday, setUsedToday] = useState(() => (services ? services.counter.count() : 0));
  const [jobError, setJobError] = useState('');
  const [notice, setNotice] = useState('');
  const [cacheSize, setCacheSize] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [events, setEvents] = useState([]);
  const [showEvents, setShowEvents] = useState(false);
  const [order, setOrder] = useState(() => (storage ? loadOrder(storage) : [...DEFAULT_ORDER]));
  const fileInputRef = useRef(null);
  const textRef = useRef(null);
  const findInputRef = useRef(null);
  const findLoggedRef = useRef(false);
  const [customProviders] = useState(() => (storage ? loadCustomProviders(storage) : []));
  const [dragId, setDragId] = useState(null);
  const [drop, setDrop] = useState(null);
  const [widths, setWidths] = useState(() => (storage ? loadWidths(storage) : { ...DEFAULT_WIDTHS }));
  const [boxWidth, setBoxWidth] = useState(0);
  const [resizing, setResizing] = useState(false);
  const columnsRef = useRef(null);
  const resizeRef = useRef(null);
  const [playerState, setPlayerState] = useState({ total: 0, index: 0, status: 'stopped', rate: 1, volume: 1, buffering: false, position: 0, duration: 0 });
  const audioRef = useRef(null);
  const playerEngineRef = useRef(null);
  const playerDataRef = useRef({ text, settings, chunks: [] });
  const schedulerRef = useRef(null);
  const readySeenRef = useRef([]);
  const lastPlayheadRef = useRef(null);
  const timer = useRef(null);

  const logEvent = (msg) => {
    const line = `${new Date().toLocaleTimeString()} ${msg}`;
    setEvents((prev) => [line, ...prev].slice(0, 20));
  };

  useEffect(() => {
    const onError = (e) => logEvent(e && e.message ? e.message : 'error');
    const onRej = (e) => logEvent(e && e.reason && e.reason.message ? e.reason.message : String(e && e.reason));
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRej);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRej);
    };
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (storage) saveText(storage, text);
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [text]);

  useEffect(() => {
    if (drawerOpen && services) {
      services.cache.totalBytes().then((n) => setCacheSize(n)).catch((e) => { const m = e && e.message ? e.message : 'error'; setJobError(m); logEvent(m); });
    }
  }, [drawerOpen]);

  useEffect(() => {
    const el = columnsRef.current;
    if (!el) return undefined;
    const measure = () => setBoxWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const stats = computeStats({ text, chunkSize: settings.chunkSize, usedToday, dailyLimit: settings.dailyLimit });
  const providers = allProviders(customProviders);
  const provider = getProvider(providers, settings.provider);
  const switchLocked = schedState.state === 'generating';

  const canStart = text.trim() !== '' && keySet && usedToday < settings.dailyLimit;
  const startReason = !text.trim()
    ? 'Paste some text first.'
    : !keySet
    ? 'Set an API key in Settings.'
    : usedToday >= settings.dailyLimit
    ? 'Daily limit reached.'
    : '';

  const handleProviderChange = (id) => {
    if (id === provider.id) return;
    const next = getProvider(providers, id);
    logEvent('Provider switched to ' + providerLabel(next));
    try {
      if (!storage) return;
      if (!saveSettings(storage, { ...settings, provider: next.id, voice: undefined })) {
        logEvent('Could not save the provider');
        setNotice('Could not save the provider in this browser.');
        return;
      }
      const loaded = loadSettings(storage);
      setSettings(loaded);
      setVoiceInput(loaded.voice);
      if (schedulerRef.current) {
        try { schedulerRef.current.cancel(); } catch {}
        schedulerRef.current = null;
        readySeenRef.current = [];
        lastPlayheadRef.current = null;
      }
      setSchedState({ state: 'idle', resetAt: null, playhead: 0, chunks: [] });
      if (playerEngineRef.current) playerEngineRef.current.stop();
      setJobError('');
      setNotice('Provider: ' + providerLabel(next) + '. Press Start Reading to continue.');
    } catch (e) {
      const m = e && e.message ? e.message : 'error';
      setJobError(m);
      logEvent(m);
    }
  };

  const handleStart = async () => {
    logEvent('Start Reading pressed');
    setNotice('');
    if (!services) return;
    if (schedulerRef.current) {
            try { schedulerRef.current.cancel(); } catch {}
    }
  const chunks = chunkText(text, settings.chunkSize);
    logEvent(`Split into ${chunks.length} chunks`);
    const sched = createScheduler({
      chunks,
      voice: settings.voice,
      lookahead: settings.lookahead,
      cache: services.cache,
      speak: (a) => services.speak({ ...a, provider }),
      counter: services.counter,
      makeKey: (a) => services.makeKey({ ...a, provider }),
      onChange: (p) => {
        const fresh = newlyReady(readySeenRef.current, p.chunks);
        readySeenRef.current = readyFlags(p.chunks);
        fresh.forEach((i) => { if (playerEngineRef.current) playerEngineRef.current.notifyReady(i); });
        setSchedState((prev) => {
          // detect newly ready
          const prevStatuses = prev.chunks.map((c) => c.status);
          p.chunks.forEach((c, i) => {
            if (c.status === 'ready' && prevStatuses[i] !== 'ready') {
              const key = services.makeKey({ text: chunkText(text, settings.chunkSize)[i], voice: settings.voice, provider });
              key.then((k) => {
                services.cache.has(k).then((stored) => {
                  logEvent(`Chunk ${i + 1} ready, key ${k.slice(0, 8)}, stored: ${stored ? 'yes' : 'NO'}`);
                  if (!stored) setJobError(`Chunk ${i + 1} is marked ready but the audio is not in the cache.`);
                }).catch((e) => {
                  logEvent(`Chunk ${i + 1} cache check failed: ${e && e.message ? e.message : 'error'}`);
                });
              });
            }
          });
          return p;
        });
        setUsedToday(services.counter.count());
        if (p.state === 'waiting_reset') logEvent(`waiting for daily reset ${new Date(p.resetAt).toLocaleString()}`);
        if (p.state === 'error') {
          const m = p.chunks.map((c) => c.error && c.error.message).find(Boolean) || 'error';
          logEvent(`error ${m}`);
        }
        if (p.state === 'done') logEvent('done');
      },
    });
    schedulerRef.current = sched;
    readySeenRef.current = [];
    lastPlayheadRef.current = playerState.index;
    if (playerState.index > 0) sched.setPlayhead(playerState.index);
    setJobError('');
    try {
      await sched.start();
    } catch (e) {
      const m = e && e.message ? e.message : 'error';
      setJobError(m);
      logEvent(m);
    }
  };

  const handleResume = () => {
    logEvent('Resume pressed');
    try {
      if (schedulerRef.current) {
        schedulerRef.current.setPlayhead(playerState.index);
        lastPlayheadRef.current = playerState.index;
        schedulerRef.current.resume();
      }
    } catch (e) {
      const m = e && e.message ? e.message : 'error';
      setJobError(m);
      logEvent(m);
    }
  };
  const handlePause = () => {
    logEvent('Pause pressed');
    try {
      if (schedulerRef.current) {
        schedulerRef.current.pause();
        logEvent('Job state after pause: ' + schedulerRef.current.getState().state);
      }
    } catch (e) {
      const m = e && e.message ? e.message : 'error';
      setJobError(m);
      logEvent(m);
    }
  };
  const handleCancel = () => {
    logEvent('Cancel pressed');
    try {
      if (schedulerRef.current) schedulerRef.current.cancel();
    } catch (e) {
      const m = e && e.message ? e.message : 'error';
      setJobError(m);
      logEvent(m);
    }
  };
  const handleRetry = (i) => {
    logEvent(`Retry chunk ${i + 1} pressed`);
    try {
      if (schedulerRef.current) schedulerRef.current.retryChunk(i);
    } catch (e) {
      const m = e && e.message ? e.message : 'error';
      setJobError(m);
      logEvent(m);
    }
  };

  const jumpToChunk = (index) => {
    logEvent(`Jump to chunk ${index + 1} pressed`);
    if (playerEngineRef.current) playerEngineRef.current.jump(index);
  };

  const handleSaveKey = () => {
    logEvent('Save key pressed');
    try {
      if (!storage) return;
      saveKey(storage, keyInput);
      setKeySet(hasKey(storage));
      setKeyInput('');
      setNotice('Key saved.');
    } catch (e) {
      const m = e && e.message ? e.message : 'error';
      setJobError(m);
      logEvent(m);
    }
  };
  const handleClearKey = () => {
    logEvent('Clear key pressed');
    try {
      if (!storage) return;
      clearKey(storage);
      setKeySet(false);
      setNotice('Key cleared.');
    } catch (e) {
      const m = e && e.message ? e.message : 'error';
      setJobError(m);
      logEvent(m);
    }
  };
  const handleSaveSettings = () => {
    logEvent('Save settings pressed');
    try {
      if (!storage) return;
      const next = { ...settings, voice: voiceInput, chunkSize: Number(chunkInput), lookahead: Number(lookInput), dailyLimit: Number(dailyInput) };
      saveSettings(storage, next);
      const loaded = loadSettings(storage);
      setSettings(loaded);
      setUsedToday(services ? services.counter.count() : 0);
      if (schedState.state === 'generating') {
        setNotice('Settings saved. They apply on the next Start Reading.');
      } else {
        if (schedulerRef.current) {
          try { schedulerRef.current.cancel(); } catch {}
          schedulerRef.current = null;
          readySeenRef.current = [];
          lastPlayheadRef.current = null;
        }
        setSchedState({ state: 'idle', resetAt: null, playhead: 0, chunks: [] });
        setJobError('');
        setNotice('Settings saved. Press Start Reading to use them.');
      }
    } catch (e) {
      const m = e && e.message ? e.message : 'error';
      setJobError(m);
      logEvent(m);
    }
  };
  const handleClearCache = async () => {
    logEvent('Clear audio cache pressed');
    if (!services) return;
    try {
      await services.cache.clear();
      const n = await services.cache.totalBytes();
      setCacheSize(n);
      setNotice('Cache cleared.');
    } catch (e) {
      const m = e && e.message ? e.message : 'error';
      setJobError(m);
      logEvent(m);
    }
  };

  const handleClearText = () => {
    logEvent('Clear pressed');
    try {
      setText('');
      if (storage) saveText(storage, '');
    } catch (e) {
      const m = e && e.message ? e.message : 'error';
      setJobError(m);
      logEvent(m);
    }
  };

  const handleDropFile = (e) => {
    const file = e && e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    e.preventDefault();
    setTextDropActive(false);
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result || ''));
      if (schedulerRef.current) {
        try { schedulerRef.current.cancel(); } catch {}
        schedulerRef.current = null;
        readySeenRef.current = [];
        lastPlayheadRef.current = null;
      }
      setSchedState({ state: 'idle', resetAt: null, playhead: 0, chunks: [] });
      setJobError('');
      if (playerEngineRef.current) playerEngineRef.current.reset();
      if (services) {
        services.cache.clear()
          .then(() => services.cache.totalBytes())
          .then((n) => setCacheSize(n))
          .catch((err) => {
            const m = err && err.message ? err.message : 'error';
            setJobError(m);
            logEvent(m);
          });
      }
      setNotice('File loaded. Cache cleared. Press Start Reading to analyze it.');
    };
    reader.readAsText(file);
  };

  const handleLoadFile = (e) => {
    const file = e && e.target && e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setText(String(reader.result || '')); };
    reader.readAsText(file);
    e.target.value = '';
  };

  const chunks = chunkText(text, settings.chunkSize);
  const matches = useMemo(() => findMatches(text, findQuery), [text, findQuery]);

  const handleFindChange = (e) => {
    const q = e.target.value;
    setFindQuery(q);
    setFindIndex(-1);
    findLoggedRef.current = false;
    const list = findMatches(text, q);
    if (list.length === 0) return;
    const ta = textRef.current;
    const cursor = ta ? ta.selectionStart : 0;
    const atOrAfter = list.findIndex((m) => m >= cursor);
    const idx = atOrAfter === -1 ? 0 : atOrAfter;
    setFindIndex(idx);
    if (ta) {
      ta.setSelectionRange(list[idx], list[idx] + q.length);
      scrollTextareaToIndex(ta, list[idx]);
    }
  };

  const jumpToMatch = (idx) => {
    if (idx < 0 || idx >= matches.length) return;
    setFindIndex(idx);
    let scrolled = null;
    const ta = textRef.current;
    if (ta && findQuery) {
      ta.focus();
      ta.setSelectionRange(matches[idx], matches[idx] + findQuery.length);
      scrolled = scrollTextareaToIndex(ta, matches[idx]);
    }
    if (!findLoggedRef.current) {
      findLoggedRef.current = true;
      logEvent(`Find: ${matches.length} matches`);
      if (scrolled) logEvent(`Find scroll: y=${scrolled.y} scrollHeight=${scrolled.scrollHeight} clientHeight=${scrolled.clientHeight}`);
    }
  };

  const handleFindNext = () => { jumpToMatch(nextIndex(findIndex, matches.length, 1)); };
  const handleFindPrev = () => { jumpToMatch(nextIndex(findIndex, matches.length, -1)); };
  const handleFindClear = () => { setFindQuery(''); setFindIndex(-1); findLoggedRef.current = false; };
  const handleFindKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) handleFindPrev(); else handleFindNext();
    } else if (e.key === 'Escape') {
      handleFindClear();
    }
  };
  playerDataRef.current = { text, settings, chunks, provider };

  useEffect(() => {
    if (!services) return undefined;
    const engine = createPlayerEngine({
      getBytes: async (index) => {
        const data = playerDataRef.current;
        const chunk = data.chunks[index];
        if (chunk == null) return null;
        const key = await services.makeKey({ text: chunk, voice: data.settings.voice, provider: data.provider });
        return services.cache.get(key);
      },
      onChange: (next) => setPlayerState(next),
      onEvent: (message) => logEvent(message),
    });
    playerEngineRef.current = engine;
    return () => {
      engine.destroy();
      playerEngineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (playerEngineRef.current) playerEngineRef.current.setTotal(chunks.length);
  }, [chunks.length]);
  useEffect(() => {
    if (playerEngineRef.current) playerEngineRef.current.reset();
  }, [provider.id, settings.voice, settings.chunkSize]);
  useEffect(() => {
    const sched = schedulerRef.current;
    if (!sched) return;
    const idx = playheadToSend(playerState.index, lastPlayheadRef.current, schedState.state);
    if (idx === null) return;
    lastPlayheadRef.current = idx;
    try {
      sched.setPlayhead(idx);
      logEvent('Reading position ' + (idx + 1) + ': generation follows');
    } catch (e) {
      const m = e && e.message ? e.message : 'error';
      setJobError(m);
      logEvent(m);
    }
  }, [playerState.index, schedState.state]);

  const isDefaultOrder = order.join() === DEFAULT_ORDER.join();
  const usablePx = usableWidth(boxWidth);
  const shown = boxWidth ? clampWidths(widths, usablePx) : widths;
  const isDefaultWidths = widths.left === DEFAULT_WIDTHS.left && widths.right === DEFAULT_WIDTHS.right;

  const commitWidths = (next) => {
    setWidths(next);
    if (storage && !saveWidths(storage, next)) {
      logEvent('Could not save the panel widths');
      setNotice('Could not save the panel widths in this browser.');
    }
  };

  const onHandlePointerDown = (index) => (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeRef.current = { index, startX: e.clientX, start: shown, usable: usablePx, last: shown, moved: false };
    setResizing(true);
  };

  const onHandlePointerMove = (e) => {
    const r = resizeRef.current;
    if (!r) return;
    const next = resizeFromHandle(r.start, r.index, e.clientX - r.startX, r.usable);
    r.last = next;
    r.moved = true;
    setWidths(next);
  };

  const onHandlePointerUp = (e) => {
    const r = resizeRef.current;
    if (!r) return;
    resizeRef.current = null;
    setResizing(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    if (r.moved) {
      commitWidths(r.last);
      logEvent('Resized panels');
    }
  };

  const onHandleKeyDown = (index) => (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const step = e.shiftKey ? 64 : 16;
    commitWidths(resizeFromHandle(shown, index, e.key === 'ArrowLeft' ? -step : step, usablePx));
  };


  const applyOrder = (next, message) => {
    setOrder(next);
    if (storage && !saveOrder(storage, next)) {
      logEvent('Could not save the panel order');
      setNotice('Could not save the panel order in this browser.');
    }
    logEvent(message);
  };

  const onGripDragStart = (id) => (e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    const grip = e.currentTarget;
    if (grip) e.dataTransfer.setDragImage(grip, 12, 12);
    setTimeout(() => setDragId(id), 0);
    logEvent('Drag panel ' + id);
  };

  const onGripDragEnd = () => {
    setDragId(null);
    setDrop(null);
  };

  const onPanelDragOver = (id) => (e) => {
    if (!dragId || dragId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const side = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
    setDrop((d) => (d && d.id === id && d.side === side ? d : { id, side }));
  };

  const onPanelDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDrop(null);
  };

  const onPanelDrop = (id) => (e) => {
    if (!dragId) return;
    e.preventDefault();
    const side = drop && drop.id === id ? drop.side : 'before';
    const next = movePanel(order, dragId, id, side);
    setDragId(null);
    setDrop(null);
    if (next.join() === order.join()) return;
    applyOrder(next, 'Moved panel ' + dragId + ' ' + side + ' ' + id);
  };

  const onGripKeyDown = (id) => (e) => {
    if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    const next = stepPanel(order, id, e.key === 'ArrowLeft' ? -1 : 1);
    if (next.join() === order.join()) return;
    applyOrder(next, 'Moved panel ' + id + ' with the keyboard');
  };

  const handleResetLayout = () => {
    logEvent('Reset layout pressed');
    try {
      if (storage) resetOrder(storage);
      setOrder([...DEFAULT_ORDER]);
      if (storage) resetWidths(storage);
      setWidths({ ...DEFAULT_WIDTHS });
      setNotice('Panel layout reset.');
    } catch (e) {
      const m = e && e.message ? e.message : 'error';
      setJobError(m);
      logEvent(m);
    }
  };

  const handleFontWeightCommit = (value) => {
    if (!storage || value === settings.fontWeight) return;
    if (!saveSettings(storage, { ...settings, fontWeight: value })) {
      logEvent('Could not save the font weight');
      return;
    }
    setSettings(loadSettings(storage));
    logEvent('Font weight ' + value);
  };

  const handleHighlightModeChange = (value) => {
    if (value !== 'words' && value !== 'sentences' && value !== 'none') return;
    if (!storage || value === settings.highlightMode) return;
    if (!saveSettings(storage, { ...settings, highlightMode: value })) {
      logEvent('Could not save the highlight mode');
      return;
    }
    setSettings(loadSettings(storage));
    setHighlightInput(value);
    logEvent('Highlight ' + value);
  };

  const handleSpellCheckChange = (value) => {
    if (typeof value !== 'boolean') return;
    if (!storage || value === settings.spellCheck) return;
    if (!saveSettings(storage, { ...settings, spellCheck: value })) {
      logEvent('Could not save the spell check setting');
      return;
    }
    setSettings(loadSettings(storage));
    setSpellCheckInput(value);
    logEvent('Spell check ' + (value ? 'on' : 'off'));
  };

  const handleDownloadFormatChange = (value) => {
    if (value !== 'mp3' && value !== 'wav') return;
    if (!storage || value === settings.downloadFormat) return;
    if (!saveSettings(storage, { ...settings, downloadFormat: value })) {
      logEvent('Could not save the download format');
      return;
    }
    setSettings(loadSettings(storage));
    setDownloadFormatInput(value);
    logEvent('Download format ' + value);
  };

  const decodeChunk = async (b) => {
    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctx) throw new Error('This browser cannot decode MP3 audio.');
    const ctx = new Ctx();
    try {
      const decoded = await ctx.decodeAudioData(b.slice().buffer);
      const channels = [];
      for (let c = 0; c < decoded.numberOfChannels; c += 1) channels.push(decoded.getChannelData(c));
      return { channels, sampleRate: decoded.sampleRate };
    } finally {
      if (typeof ctx.close === 'function') ctx.close().catch(() => {});
    }
  };

  const convertDeps = { decode: decodeChunk, encodeMp3 };

  const handleDownloadChunk = async (index) => {
    const n = index + 1;
    const fail = (msg) => {
      logEvent(msg);
      setNotice(msg);
      setChunkNotes((prev) => ({ ...prev, [index]: msg }));
    };
    if (!services) return;
    try {
      const key = await services.makeKey({ text: chunks[index], voice: settings.voice, provider });
      const bytes = await services.cache.get(key);
      if (!bytes) {
        fail(`Chunk ${n} is not ready yet: no audio in the cache.`);
        return;
      }
      const format = settings.downloadFormat === 'wav' ? 'wav' : 'mp3';
      if (format === 'mp3' && audioKind(bytes) !== 'mp3') logEvent('Encoding MP3...');
      const { bytes: out } = await convertChunk(bytes, format, convertDeps);
      const name = chunkFileName(index, chunks.length, format);
      if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
        let handle = null;
        try {
          handle = await window.showSaveFilePicker({
            suggestedName: name,
            types: [{ description: format.toUpperCase() + ' audio', accept: { [format === 'mp3' ? 'audio/mpeg' : 'audio/wav']: ['.' + format] } }],
          });
        } catch (e) {
          if (e && e.name === 'AbortError') {
            logEvent('Download cancelled');
            return;
          }
          throw e;
        }
        const writable = await handle.createWritable();
        await writable.write(out);
        await writable.close();
      } else {
        const blob = new Blob([out], { type: format === 'mp3' ? 'audio/mpeg' : 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        logEvent('Save dialog not available here; used the browser download instead');
      }
      setChunkNotes((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      logEvent(`Chunk ${n} downloaded as ${format} (${Math.round(out.byteLength / 1024)} KB)`);
    } catch (e) {
      const m = e && e.message ? e.message : 'error';
      fail(m);
    }
  };

  const handleDownloadZip = async () => {
    if (zipRunning) return;
    setZipRunning(true);
    try {
      const format = settings.downloadFormat === 'wav' ? 'wav' : 'mp3';
      const name = `voice-chunks-${format}.zip`;
      let writable = null;
      if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: name,
            types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
          });
          writable = await handle.createWritable();
        } catch (e) {
          if (e && e.name === 'AbortError') {
            logEvent('Download cancelled');
            return;
          }
          throw e;
        }
      } else {
        logEvent('Save dialog not available here; used the browser download instead');
      }
      const ready = [];
      const skipped = [];
      for (let i = 0; i < chunks.length; i += 1) {
        if (schedState.chunks[i] && schedState.chunks[i].status === 'ready') ready.push(i);
        else skipped.push(i + 1);
      }
      const files = [];
      let processed = 0;
      for (const i of ready) {
        try {
          const key = await services.makeKey({ text: chunks[i], voice: settings.voice, provider });
          const bytes = await services.cache.get(key);
          if (!bytes) { skipped.push(i + 1); continue; }
          const { bytes: out, ext } = await convertChunk(bytes, format, convertDeps);
          files.push({ name: chunkFileName(i, chunks.length, ext), bytes: out });
        } catch (e) {
          const m = e && e.message ? e.message : 'error';
          logEvent(`Chunk ${i + 1} conversion failed: ${m}`);
        }
        processed += 1;
        if (processed % 10 === 0) logEvent(`ZIP: preparing ${processed} of ${chunks.length}`);
      }
      if (skipped.length) logEvent(`Skipped chunks ${skipped.join(', ')} (no audio)`);
      let totalBytes = 0;
      if (writable) {
        for await (const piece of zipChunks(files)) {
          await writable.write(piece);
          totalBytes += piece.length;
        }
        await writable.close();
      } else {
        const zip = createZip(files);
        totalBytes = zip.length;
        const blob = new Blob([zip], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      logEvent(`ZIP saved: ${files.length} chunks, ${Math.round(totalBytes / 1024 / 1024)} MB`);
    } catch (e) {
      const m = e && e.message ? e.message : 'error';
      logEvent(m);
    } finally {
      setZipRunning(false);
    }
  };

  const handleDownloadJoined = async () => {
    if (zipRunning || joinedRunning) return;
    setJoinedRunning(true);
    let writable = null;
    let parts = null;
    try {
      const format = settings.downloadFormat === 'wav' ? 'wav' : 'mp3';
      const name = `voice-joined.${format}`;
      if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: name,
            types: [{ description: format.toUpperCase() + ' audio', accept: { [format === 'mp3' ? 'audio/mpeg' : 'audio/wav']: ['.' + format] } }],
          });
          writable = await handle.createWritable();
        } catch (e) {
          if (e && e.name === 'AbortError') { logEvent('Download cancelled'); return; }
          throw e;
        }
      } else {
        parts = [];
        logEvent('Save dialog not available here; the whole file is built in memory');
      }
      const bytes0 = await services.cache.get(await services.makeKey({ text: chunks[0], voice: settings.voice, provider }));
      if (!bytes0) throw new Error('Chunk 1 has no audio in the cache.');
      const kind0 = audioKind(bytes0);
      let sampleRate0 = null;
      let channels0 = null;
      if (kind0 === 'wav') { const p = wavParts(bytes0); sampleRate0 = p.sampleRate; channels0 = p.channels; }
      else if (kind0 === 'pcm') { sampleRate0 = PCM_DEFAULT_RATE; channels0 = PCM_DEFAULT_CHANNELS; }
      const first = { kind: kind0, sampleRate: sampleRate0, channels: channels0 };
      const mode = joinMode(kind0, format);
      let perChunk = bytes0.length;
      if (mode === 'wav-stream') perChunk = wavParts(bytes0).data.length;
      else if (mode === 'mp3-encode') {
        const dataBytes = kind0 === 'wav' ? wavParts(bytes0).data.length : bytes0.length;
        perChunk = (dataBytes / (sampleRate0 * channels0 * 2)) * 16 * 1024;
      }
      logEvent(`Joined file: about ${Math.max(0, Math.round((perChunk * chunks.length) / 1024 / 1024))} MB`);
      let encoder = null;
      if (mode === 'mp3-encode') encoder = await createMp3Encoder(channels0, sampleRate0);
      let totalBytes = 0;
      if (writable && mode === 'wav-stream') await writable.write(new Uint8Array(44));
      for (let i = 0; i < chunks.length; i += 1) {
        let bytes = bytes0;
        if (i > 0) {
          const key = await services.makeKey({ text: chunks[i], voice: settings.voice, provider });
          bytes = await services.cache.get(key);
          if (!bytes) throw new Error(`Chunk ${i + 1} has no audio in the cache.`);
          const kind = audioKind(bytes);
          let sampleRate = null;
          let channels = null;
          if (kind === 'wav') { const p = wavParts(bytes); sampleRate = p.sampleRate; channels = p.channels; }
          else if (kind === 'pcm') { sampleRate = PCM_DEFAULT_RATE; channels = PCM_DEFAULT_CHANNELS; }
          sameAs(first, { kind, sampleRate, channels }, i + 1);
        }
        try {
          if (mode === 'mp3-concat') {
            const out = i === 0 ? bytes : stripId3(bytes);
            if (writable) await writable.write(out); else parts.push(out);
            totalBytes += out.length;
          } else if (mode === 'wav-stream') {
            const wav = (await convertChunk(bytes, 'wav', convertDeps)).bytes;
            const p = wavParts(wav);
            if (writable) await writable.write(p.data); else parts.push(p.data);
            totalBytes += p.data.length;
          } else {
            const wav = (await convertChunk(bytes, 'wav', convertDeps)).bytes;
            const p = wavParts(wav);
            const enc = encoder.encode(pcmToInt16Channels(p.data, p.channels));
            if (writable) await writable.write(enc); else parts.push(enc);
            totalBytes += enc.length;
          }
        } catch (e) {
          const m = e && e.message ? e.message : 'error';
          throw new Error(`Chunk ${i + 1}: ${m}`);
        }
        if ((i + 1) % 5 === 0) logEvent(`Joined: ${i + 1} of ${chunks.length}`);
      }
      if (mode === 'mp3-encode') {
        const tail = encoder.flush();
        if (writable) await writable.write(tail); else parts.push(tail);
        totalBytes += tail.length;
      }
      if (mode === 'wav-stream') {
        const header = wavHeader(totalBytes, first.channels, first.sampleRate);
        if (writable) {
          await writable.write({ type: 'seek', position: 0 });
          await writable.write(header);
        } else {
          parts.unshift(header);
        }
      }
      if (writable) {
        await writable.close();
      } else {
        const blob = new Blob(parts, { type: format === 'mp3' ? 'audio/mpeg' : 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      logEvent(`Joined file saved: ${Math.max(0, Math.round(totalBytes / 1024 / 1024))} MB`);
    } catch (e) {
      const m = e && e.message ? e.message : 'error';
      if (writable) { try { await writable.abort(); } catch { } }
      logEvent(m);
    } finally {
      setJoinedRunning(false);
    }
  };

  const panelClass = (id, extra) =>
    'panel ' + extra + (dragId === id ? ' dragging' : '') + (drop && drop.id === id ? ' drop-' + drop.side : '');

  const stateWord = {
    idle: 'Idle',
    generating: 'Generating',
    waiting_reset: 'Waiting for daily reset',
    paused: 'Paused',
    error: 'Error',
    done: 'Done',
    cancelled: 'Cancelled',
  }[schedState.state] || 'Idle';
  const jobLive = schedState.chunks.length > 0;
  const readyCount = schedState.chunks.filter((c) => c.status === 'ready').length;
  const notReadyChunks = [];
  for (let i = 0; i < chunks.length; i += 1) {
    if (!(schedState.chunks[i] && schedState.chunks[i].status === 'ready')) notReadyChunks.push(i + 1);
  }
  const allChunksReady = notReadyChunks.length === 0;
  const notReadyTitle = 'Chunks ' + notReadyChunks.slice(0, 5).join(', ') + (notReadyChunks.length > 5 ? ' and ' + (notReadyChunks.length - 5) + ' more' : '') + ' are not ready yet.';
  const canPause = jobLive && (schedState.state === 'generating' || schedState.state === 'idle');
  const canResume = ['paused', 'cancelled', 'waiting_reset', 'error'].includes(schedState.state);
  const canCancel = jobLive && ['generating', 'idle', 'paused'].includes(schedState.state);
  const pauseReason = canPause ? 'Stop making new audio. The request in progress finishes. Audio already made keeps playing.' : (!jobLive ? 'No job yet. Press Start Reading.' : 'Nothing to pause (' + stateWord + ').');
  const resumeReason = canResume ? 'Continue making audio from the chunk that is playing now.' : 'Nothing to resume (' + stateWord + ').';
  const cancelReason = canCancel ? 'Stop the job. Audio already made is kept.' : (!jobLive ? 'No job yet.' : 'Nothing to cancel (' + stateWord + ').');

  const reading = playerState.total > 0 && (playerState.status === 'playing' || playerState.status === 'paused');
  const readChunk = reading && chunks[playerState.index] ? chunks[playerState.index] : '';

  return (
    <div className="app" onClick={(e) => { if (drawerOpen && !e.target.closest('.drawer') && !e.target.closest('.settings-btn')) { handleSaveSettings(); setDrawerOpen(false); } }}>
      <header className="topbar">
        <span className="title">Voice</span>
        <span className="version">v{APP_VERSION}</span>
        <select className="provider-select" value={provider.id} onChange={(e) => handleProviderChange(e.target.value)} disabled={switchLocked} title={switchLocked ? 'Wait for the current request to finish, or press Cancel.' : 'Choose the voice provider (free models only).'} aria-label="Voice provider">
          {providers.map((p) => (<option key={p.id} value={p.id}>{providerLabel(p)}</option>))}
        </select>
        {switchLocked ? <span className="provider-reason">Wait for the request or press Cancel.</span> : null}
        <span className="requests" title={services ? new Date(services.counter.resetAt()).toLocaleString() : ''}>
          Requests today: {usedToday} / {settings.dailyLimit} (estimate)
        </span>
        <button className="settings-btn" onClick={() => setDrawerOpen((o) => !o)} title="Settings"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.49.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.62 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.3-.06.62-.06.94s.02.64.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.69.24l2.39-.96c.5.39 1.05.71 1.63.94l.36 2.54c.05.23.25.4.49.4h4c.24 0 .44-.17.49-.4l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96c.26.1.55 0 .69-.24l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg></button>
      </header>
      <div className={'columns' + (resizing ? ' resizing' : '')} ref={columnsRef} style={{ gridTemplateColumns: columnsTemplate(shown) }}>
        <section className={panelClass('text', 'text-panel')} style={{ gridColumn: order.indexOf('text') * 2 + 1, gridRow: 1 }} onDragOver={onPanelDragOver('text')} onDragLeave={onPanelDragLeave} onDrop={onPanelDrop('text')}>
          <div className="panel-head">
            <span className="grip" role="button" tabIndex={0} draggable="true" title="Drag to move this panel. Keyboard: Alt+Left or Alt+Right." aria-label="Move the Text panel" onDragStart={onGripDragStart('text')} onDragEnd={onGripDragEnd} onKeyDown={onGripKeyDown('text')} />
            <span className="panel-title">Text</span>
          </div>
          <div className="find-row">
            <input
              ref={findInputRef}
              className="find-input"
              type="text"
              placeholder="Find in text"
              value={findQuery}
              disabled={reading}
              title={reading ? 'Find works when reading is stopped' : undefined}
              aria-label="Find in text"
              onChange={handleFindChange}
              onKeyDown={handleFindKeyDown}
            />
            <span className="find-count">{findIndex + 1} / {matches.length}</span>
            <button type="button" className="find-btn" onClick={handleFindPrev} disabled={reading || matches.length === 0} title={reading ? 'Find works when reading is stopped' : (matches.length === 0 ? (findQuery ? 'No matches' : 'Type something to find') : undefined)} aria-label="Previous match">↑</button>
            <button type="button" className="find-btn" onClick={handleFindNext} disabled={reading || matches.length === 0} title={reading ? 'Find works when reading is stopped' : (matches.length === 0 ? (findQuery ? 'No matches' : 'Type something to find') : undefined)} aria-label="Next match">↓</button>
            {findQuery ? <button type="button" className="find-clear" onClick={handleFindClear} disabled={reading} title="Clear find query" aria-label="Clear find query">×</button> : null}
            {reading ? <span className="find-reason">Find works when reading is stopped</span> : null}
          </div>
          <textarea ref={textRef} value={text} spellCheck={settings.spellCheck} onChange={(e) => { setText(e.target.value); setSelectedChars(0); }} onSelect={(e) => { const s = e.target.selectionStart; const t = e.target.selectionEnd; setSelectedChars(t > s ? t - s : 0); }} style={{ fontSize: `${textZoom}%`, display: reading ? 'none' : undefined }} onWheel={(e) => { if (e.ctrlKey) { e.preventDefault(); setTextZoom((z) => Math.min(200, Math.max(60, z + (e.deltaY < 0 ? 10 : -10)))); } }} onKeyDown={(e) => { if (e.ctrlKey && (e.key === '+' || e.key === '=')) { e.preventDefault(); setTextZoom((z) => Math.min(200, z + 10)); } if (e.ctrlKey && (e.key === '-')) { e.preventDefault(); setTextZoom((z) => Math.max(60, z - 10)); } if (e.ctrlKey && (e.key === '0')) { e.preventDefault(); setTextZoom(100); } }} onDragOver={(e) => { e.preventDefault(); setTextDropActive(true); }} onDragEnter={(e) => { e.preventDefault(); setTextDropActive(true); }} onDragLeave={() => setTextDropActive(false)} onDrop={handleDropFile} className={textDropActive ? 'drop-active' : ''} />
          {reading ? (
            <TextReadView chunk={readChunk} mode={settings.highlightMode} engineRef={playerEngineRef} textZoom={textZoom} onZoom={setTextZoom} onSelectText={setSelectedChars} />
          ) : null}
          <div className="stats" style={{ justifyContent: 'flex-end' }}>
            <span>{plural(stats.characters, 'character')}</span>
            <span>{plural(stats.pages, 'page')} (about)</span>
            <span>{plural(stats.chunks, 'chunk')}</span>
            <span>{plural(stats.requestsNeeded, 'request')} needed</span>
            <span>{stats.fitsToday ? 'Fits today' : `Needs ${stats.daysNeeded} days`}</span>
          </div>
          <div className="row">
            <button onClick={handleStart} disabled={!canStart} style={{ minWidth: '300px' }}>Start Reading</button>
            <span style={{ flex: 1 }} />
            <button className="icon-btn" title="Load file (.txt .md .doc)" onClick={() => fileInputRef.current && fileInputRef.current.click()}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg></button>
            <button className="icon-btn" title="Clear text" onClick={handleClearText}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
          <input ref={fileInputRef} type="file" accept=".txt,.md,.doc,text/plain" style={{display:"none"}} onChange={handleLoadFile} />
          </div>
          {startReason ? <div className="reason">{startReason}</div> : null}
        </section>
        <section className={panelClass('reader', 'reader-panel')} style={{ gridColumn: order.indexOf('reader') * 2 + 1, gridRow: 1 }} onDragOver={onPanelDragOver('reader')} onDragLeave={onPanelDragLeave} onDrop={onPanelDrop('reader')}>
          <div className="panel-head">
            <span className="grip" role="button" tabIndex={0} draggable="true" title="Drag to move this panel. Keyboard: Alt+Left or Alt+Right." aria-label="Move the Reader panel" onDragStart={onGripDragStart('reader')} onDragEnd={onGripDragEnd} onKeyDown={onGripKeyDown('reader')} />
            <span className="panel-title">Reader</span>
            <span className="now" style={{color:"var(--accent)"}}>{settings.voice || provider.label}</span>
          </div>
          <div className="chunk-list">
            {chunks.map((c, i) => {
              const st = schedState.chunks[i] ? schedState.chunks[i].status : 'queued';
              const err = schedState.chunks[i] ? schedState.chunks[i].error : null;
              return (
                <div key={i} className={`chunk-row ${st} ${i === activeRowIndex(playerState) ? "playing" : ""}`} aria-current={i === activeRowIndex(playerState) ? "true" : undefined} onClick={() => jumpToChunk(i)} style={{ cursor: 'pointer' }} title="Jump to this chunk">
                  <div className="chunk-head">
                    <span className={`badge ${st}`}>{st}</span>
                    <span className="chunk-num">#{i + 1}</span>
                    <span className="chunk-actions">
                      {st === 'failed' ? <button onClick={(e) => { e.stopPropagation(); handleRetry(i); }}>Retry</button> : null}
                      <button className="icon-btn chunk-download" disabled={st !== 'ready'} title={st === 'ready' ? 'Download this chunk' : `Chunk ${i + 1} is not ready yet: no audio in the cache.`} onClick={(e) => { e.stopPropagation(); handleDownloadChunk(i); }} aria-label={`Download chunk ${i + 1}`}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8.5 12.5L12 16l3.5-3.5" /></svg>
                      </button>
                    </span>
                  </div>
                  <div className="chunk-preview">{c.slice(0, 400)}</div>
                  {chunkNotes[i] ? <div className="err">{chunkNotes[i]}</div> : null}
                  {err ? <div className="err">{err.message}</div> : null}
                </div>
              );
            })}
          </div>
          <div className="reader-actions">
            <button onClick={handleDownloadZip} disabled={zipRunning || joinedRunning || readyCount === 0} title={zipRunning || joinedRunning ? 'A download is being prepared.' : readyCount === 0 ? 'No chunk has audio in the cache yet.' : 'Download the ready chunks as one ZIP.'}>Download all chunks</button>
            <button onClick={handleDownloadJoined} disabled={zipRunning || joinedRunning || !allChunksReady} title={zipRunning || joinedRunning ? 'A download is being prepared.' : allChunksReady ? 'Download the whole text as one joined audio file.' : notReadyTitle}>Download all joined</button>
          </div>
        </section>
        <section className={panelClass('job', 'job-panel')} style={{ gridColumn: order.indexOf('job') * 2 + 1, gridRow: 1 }} onDragOver={onPanelDragOver('job')} onDragLeave={onPanelDragLeave} onDrop={onPanelDrop('job')}>
          <div className="panel-head">
            <span className="grip" role="button" tabIndex={0} draggable="true" title="Drag to move this panel. Keyboard: Alt+Left or Alt+Right." aria-label="Move the Job panel" onDragStart={onGripDragStart('job')} onDragEnd={onGripDragEnd} onKeyDown={onGripKeyDown('job')} />
            <span className="panel-title">Job</span>
          </div>
          <div className="state">{stateWord}{schedState.state === 'idle' && schedState.chunks.some((c) => c.status === 'ready') ? ' - window filled' : ''}</div>
          <div>Chunks ready {readyCount} / {chunks.length}</div>
          <div className="progress"><div className="bar" style={{ width: chunks.length ? `${(readyCount / chunks.length) * 100}%` : '0%' }} /></div>
          <div>Requests today: {usedToday}</div>
          {schedState.state === 'waiting_reset' ? <div>Reset: {new Date(schedState.resetAt).toLocaleString()}<br />Audio already made is kept.</div> : null}
          {jobError ? <div className="notice">{jobError}</div> : null}
          <div className="row">
            <button className={'job-toggle' + (schedState.state === 'paused' ? ' is-paused' : '')} onClick={canResume ? handleResume : handlePause} disabled={!canPause && !canResume} title={canResume ? resumeReason : pauseReason}>{canResume ? 'Resume' : 'Pause'}</button>
            <button onClick={handleCancel} disabled={!canCancel} title={cancelReason}>Cancel</button>
          </div>
          {selectedChars > 0 ? <div style={{ marginTop: 'auto' }}>Selected: {plural(selectedChars, 'character')}</div> : null}
        </section>
        <div className="col-handle" role="separator" aria-orientation="vertical" tabIndex={0} aria-label="Resize the left and middle panels" title="Drag to resize. Keyboard: Left or Right arrow, Shift for bigger steps." style={{ gridColumn: 2, gridRow: 1 }} onPointerDown={onHandlePointerDown(0)} onPointerMove={onHandlePointerMove} onPointerUp={onHandlePointerUp} onPointerCancel={onHandlePointerUp} onKeyDown={onHandleKeyDown(0)} />
        <div className="col-handle" role="separator" aria-orientation="vertical" tabIndex={0} aria-label="Resize the middle and right panels" title="Drag to resize. Keyboard: Left or Right arrow, Shift for bigger steps." style={{ gridColumn: 4, gridRow: 1 }} onPointerDown={onHandlePointerDown(1)} onPointerMove={onHandlePointerMove} onPointerUp={onHandlePointerUp} onPointerCancel={onHandlePointerUp} onKeyDown={onHandleKeyDown(1)} />
      </div>
      <footer className="playerbar">
        <button onClick={() => playerEngineRef.current && playerEngineRef.current.prev()} disabled={!playerState.total || playerState.index === 0}><svg viewBox='0 0 24 24' width='20' height='20' fill='currentColor'><path d='M6 6h2v12H6zM9.5 12l8.5 6V6z'/></svg></button>
        {playerState.status === 'playing'
          ? <button className="play-primary play-active" onClick={() => playerEngineRef.current && playerEngineRef.current.pause()}><svg viewBox='0 0 24 24' width='20' height='20' fill='currentColor'><path d='M6 5h4v14H6zM14 5h4v14h-4z'/></svg></button>
          : <button className="play-primary" onClick={() => { if (audioRef.current) { audioRef.current.pause(); if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); } } if (playerEngineRef.current) playerEngineRef.current.play(); }} disabled={!playerState.total}><svg viewBox='0 0 24 24' width='20' height='20' fill='currentColor'><path d='M8 5v14l11-7z'/></svg></button>}
        <button onClick={() => playerEngineRef.current && playerEngineRef.current.stop()} disabled={!playerState.total}><svg viewBox='0 0 24 24' width='20' height='20' fill='currentColor'><path d='M6 6h12v12H6z'/></svg></button>
        <button onClick={() => playerEngineRef.current && playerEngineRef.current.next()} disabled={!playerState.total || playerState.index >= playerState.total - 1}><svg viewBox='0 0 24 24' width='20' height='20' fill='currentColor'><path d='M6 6l8.5 6L6 18zM16 6h2v12h-2z'/></svg></button>
        <input className="seek" type="range" min="0" max={playerState.duration || 0} step="any" value={Math.min(playerState.position, playerState.duration || 0)} onChange={(e) => playerEngineRef.current && playerEngineRef.current.seek(Number(e.target.value))} disabled={!playerState.duration} aria-label="Seek" />
        <input type="range" min="0" max="1" step="0.01" value={playerState.volume} onChange={(e) => playerEngineRef.current && playerEngineRef.current.setVolume(Number(e.target.value))} aria-label="Volume" />
<span className="now rate-label">{Math.round(playerState.volume * 100)}%</span>
        <input type="range" min="0" max={RATES.length - 1} step="1" value={Math.max(0, RATES.indexOf(playerState.rate))} onChange={(e) => { const next = RATES[Number(e.target.value)]; if (next !== playerState.rate) logEvent(`Speed ${next}x`); if (playerEngineRef.current) playerEngineRef.current.setRate(next); }} disabled={!playerState.total} aria-label="Playback speed" />
<span className="now rate-label">{playerState.rate}x</span>

        <span style={{flex:1,textAlign:'center'}}>{notice}</span>
      </footer>
        <aside className={drawerOpen ? 'drawer open' : 'drawer'}>
          <div className="drawer-header">
            <h3>Settings</h3>
            <button className="close-btn" onClick={() => setDrawerOpen(false)} aria-label="Close settings" title="Close settings">×</button>
          </div>
          <section className="settings-card">
            <div className="card-label">Connection</div>
            <div className="settings-row">
              <div className="row-text"><span className="row-label">API key</span></div>
              <input className="api-key-input" type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="settings-row buttons-row">
              <div className="row">
                <button className="btn-primary" onClick={handleSaveKey}>Save key</button>
                <button className="btn-danger" onClick={handleClearKey}>Clear key</button>
              </div>
            </div>
          </section>
          <section className="settings-card">
            <div className="card-label">Voice</div>
            <div className="settings-row">
              <div className="row-text"><span className="row-label">Voice ({provider.label})</span></div>
              {Array.isArray(provider.voices) && provider.voices.length ? (
                <select value={voiceInput} onChange={(e) => setVoiceInput(e.target.value)} aria-label="Voice">
                  {provider.voices.map((v) => (<option key={v} value={v}>{v}</option>))}
                </select>
              ) : null}
            </div>
          </section>
          <section className="settings-card">
            <div className="card-label">Reading</div>
            <div className="settings-row">
              <div className="row-text"><span className="row-label">Chunk size</span></div>
              <input type="number" value={chunkInput} onChange={(e) => setChunkInput(e.target.value)} />
            </div>
            <div className="settings-row">
              <div className="row-text"><span className="row-label">Lookahead</span></div>
              <input type="number" value={lookInput} onChange={(e) => setLookInput(e.target.value)} />
            </div>
            <div className="settings-row">
              <div className="row-text"><span className="row-label">Daily limit</span></div>
              <select value={dailyInput} onChange={(e) => setDailyInput(Number(e.target.value))}>
                <option value={50}>50</option>
                <option value={1000}>1000</option>
              </select>
            </div>
            <div className="footnote">1000 needs $10 of lifetime credit purchases on OpenRouter. The app cannot check this.</div>
          </section>
          <section className="settings-card">
            <div className="card-label">Display</div>
            <div className="settings-row">
              <div className="row-text"><span className="row-label">Font weight</span></div>
              <div className="row-control"><FontWeightControl initial={settings.fontWeight} onCommit={handleFontWeightCommit} /></div>
            </div>
            <div className="settings-row">
              <div className="row-text"><span className="row-label">Highlight on reading</span></div>
              <select value={highlightInput} onChange={(e) => handleHighlightModeChange(e.target.value)} aria-label="Highlight mode">
                <option value="words">Words</option>
                <option value="sentences">Sentences</option>
                <option value="none">None</option>
              </select>
            </div>
            <div className="settings-row">
              <div className="row-text"><span className="row-label">Spell check</span></div>
              <div className="check-row spell-control">
                <label className="switch">
                  <input type="checkbox" checked={spellCheckInput} onChange={(e) => handleSpellCheckChange(e.target.checked)} aria-label="Spell check" />
                  <span className="slider" />
                </label>
              </div>
            </div>
          </section>
          <section className="settings-card">
            <div className="card-label">Downloads</div>
            <div className="settings-row">
              <div className="row-text"><span className="row-label">Download format</span></div>
              <select value={downloadFormatInput} onChange={(e) => handleDownloadFormatChange(e.target.value)} aria-label="Download format">
                <option value="mp3">MP3</option>
                <option value="wav">WAV</option>
              </select>
            </div>
          </section>
          <section className="settings-card">
            <div className="card-label">Storage ({(cacheSize / 1024 / 1024).toFixed(2)} MB) & layout</div>
            <div className="settings-row">
              <div className="row-text"><span className="row-label">Audio cache</span></div>
              <button className="btn-danger storage-btn" onClick={handleClearCache}>Clear audio cache</button>
            </div>
            <div className="settings-row">
              <div className="row-text"><span className="row-label">Panel layout</span></div>
              <button className="btn-secondary storage-btn" onClick={handleResetLayout} disabled={isDefaultOrder && isDefaultWidths} title={isDefaultOrder && isDefaultWidths ? 'The panels are already in the default order and size.' : 'Put the panels back in the default order and size.'}>Reset layout</button>
            </div>
          </section>
          <div className="settings-footer">
            <button className="btn-primary footer-save" onClick={() => { handleSaveSettings(); setDrawerOpen(false); }}>Save settings</button>
          </div>
        </aside>
      <div className="statusbar" onClick={() => setShowEvents((v) => !v)}>
        {events[0] || 'ready'}
      </div>
      {showEvents ? (
        <div className="eventlist">
          {events.map((e, i) => (<div key={i}>{e}</div>))}
        </div>
      ) : null}
    </div>
  );
}

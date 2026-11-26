import { useState, useEffect, useRef, useMemo } from 'react';
import { APP_VERSION } from './version.js';
import { loadSettings, saveSettings, loadText, saveText, hasKey, saveKey, clearKey } from './settingsStore.js';
import { computeStats } from './textStats.js';
import { chunkText } from './textPipeline.js';
import { selectionReadState } from './selectionSpeech.js';
import { findMatches, nextIndex } from './textFind.js';
import { scrollTextareaToIndex } from './textScroll.js';
import { highlightRange, charWeights, charAtFraction } from './highlight.js';
import { findSilences } from './silenceMap.js';
import { alignTimeMap } from './alignMap.js';
import { createScheduler } from './scheduler.js';
import { createServices } from './wiring.js';
import { createPlayerEngine } from './playerEngine.js';
import { newlyReady, readyFlags, playheadToSend } from './followPlayback.js';
import { RATES, activeRowIndex } from './playerCore.js';
import { allProviders, loadCustomProviders, getProvider, providerLabel } from './providers.js';
import { PCM_DEFAULT_RATE, PCM_DEFAULT_CHANNELS, audioMime } from './audioFormat.js';
import { chunkFileName, audioKind, convertChunk } from './chunkDownload.js';
import { createMp3Encoder, encodeMp3, pcmToInt16Channels } from './mp3Encoder.js';
import { createZip, zipChunks } from './zipStore.js';
import { stripId3, wavHeader, wavParts, joinMode, sameAs } from './joinAudio.js';
import { DEFAULT_ORDER, movePanel, stepPanel, loadOrder, saveOrder } from './panelLayout.js';
import { DEFAULT_WIDTHS, clampWidths, usableWidth, resizeFromHandle, columnsTemplate, loadWidths, saveWidths } from './panelWidths.js';
import { textFileRejection } from './fileTypes.js';
import ClipEditor from './ClipEditor.jsx';
import { audioKeyFrom } from './clipMarkerStore.js';
import { loadEditorAudio } from './clipEditorLoad.js';
import { toMono } from './waveformPeaks.js';

const storage = typeof localStorage !== 'undefined' ? localStorage : null;
const services = storage ? createServices({ storage }) : null;

const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');

// Top-right corner of the textarea selection: the end of the first selected
// line (the newline when the selection wraps, otherwise the selection end).
function selectionTopRight(ta) {
  const s = ta.selectionStart;
  const t = ta.selectionEnd;
  const start = Math.min(s, t);
  const end = Math.max(s, t);
  if (start === end) return null;
  const text = ta.value;
  const nl = text.indexOf('\n', start);
  const idx = nl !== -1 && nl < end ? nl : end;
  const css = getComputedStyle(ta);
  const div = document.createElement('div');
  const props = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'textTransform', 'wordSpacing', 'textIndent', 'tabSize', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'boxSizing'];
  for (const p of props) div.style[p] = css[p];
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.top = '-99999px';
  div.style.left = '-99999px';
  div.style.width = ta.clientWidth + 'px';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';
  div.style.overflowWrap = 'break-word';
  div.textContent = text.slice(0, idx);
  const span = document.createElement('span');
  span.textContent = '.';
  div.appendChild(span);
  document.body.appendChild(div);
  let x = 0;
  let y = 0;
  try {
    x = span.offsetLeft;
    y = span.offsetTop;
  } finally {
    div.remove();
  }
  const rect = ta.getBoundingClientRect();
  return {
    x: rect.left + (parseFloat(css.borderLeftWidth) || 0) + (parseFloat(css.paddingLeft) || 0) + x,
    y: rect.top + (parseFloat(css.borderTopWidth) || 0) + (parseFloat(css.paddingTop) || 0) + y,
  };
}

// Local state keeps the chunk list from re-rendering on every slider move.
function FontWeightControl({ initial, onCommit }) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    document.body.style.setProperty('--font-weight', String(value));
  }, [value]);
  const commit = () => onCommit(value);
  return (
    <input className="weight-slider" type="range" min="100" max="800" step="100" value={value} aria-label="Font weight"
      onChange={(e) => setValue(Number(e.target.value))}
      onPointerUp={commit} onKeyUp={commit} />
  );
}

// Local state keeps the chunk list from re-rendering on every slider move.
function LeadingControl({ initial, onCommit }) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    document.body.style.setProperty('--leading', String(value));
  }, [value]);
  const commit = () => onCommit(value);
  return (
    <input className="leading-slider" type="range" min="1" max="2.5" step="0.1" value={value} aria-label="Font leading"
      onChange={(e) => setValue(Number(e.target.value))}
      onPointerUp={commit} onKeyUp={commit} />
  );
}

// Plain text toggle for settings - the style the daily limit buttons use
function TextToggle({ children, onClick, selected, disabled, title, ariaLabel }) {
  return (
    <button
      className={`segmented-text-button ${selected ? 'active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={selected}
    >
      {children}
    </button>
  );
}

// The TTS pauses between sentences, so the linear estimate reaches the next
// sentence before the voice does. Pull the sentence highlight back by this.
const SENTENCE_DELAY = 0.15;

// The weighted lookup slows the word highlight across pauses, so lead it by
// this many seconds to keep it on the voice.
const WORD_LEAD_SECONDS = 0.12;

// A chunk with a silence map already follows the real voice, so its highlight
// gets no sentence delay and no word lead. Kept as a constant so it can be tuned.
const MAP_WORD_LEAD = 0;
const MAP_MAX_TRIES = 2;

// Decoded audio arrives as one Float32Array per channel; findSilences wants mono.
function mixToMono(channels) {
  if (!Array.isArray(channels) || channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0].slice();
  const length = channels[0].length;
  const out = new Float32Array(length);
  for (let c = 0; c < channels.length; c += 1) {
    const channel = channels[c];
    for (let i = 0; i < length; i += 1) out[i] += channel[i] / channels.length;
  }
  return out;
}

// Read-only view of the chunk being read. It polls the player engine with
// requestAnimationFrame because the engine emits position updates only about
// 4 times a second, which made the word highlight lag the voice.
function TextReadView({ chunk, mode, engineRef, chunkIndex, mapRef, textZoom, onZoom, onSelectText, onSelectIcon }) {
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
        const entry = mapRef.current && chunkIndex != null ? mapRef.current.get(chunkIndex) : null;
        const mapped = !!(entry && entry.state === 'ok' && typeof entry.timeToIndex === 'function');
        const position = mode === 'sentences' ? Math.max(0, rawPosition - SENTENCE_DELAY) : rawPosition + (mode === 'words' ? WORD_LEAD_SECONDS : 0);
        const fraction = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;
        const char = charAtFraction(weights, fraction);
        const mappedTime = (s.duration > 0 && entry && entry.mapDuration > 0)
          ? rawPosition * (entry.mapDuration / s.duration)
          : rawPosition;
        const offset = mapped ? entry.timeToIndex(mappedTime + MAP_WORD_LEAD) : char;
        setHlRange((prev) => {
          const next = highlightRange(chunk, mode, offset);
          return prev && prev.start === next.start && prev.end === next.end ? prev : next;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [chunk, mode, engineRef, chunkIndex, mapRef]);
  useEffect(() => {
    if (hlRef.current) hlRef.current.scrollIntoView({ block: 'nearest' });
  }, [hlRange]);
  useEffect(() => {
    const onUp = (ev) => {
      if (!selectingRef.current) return;
      selectingRef.current = false;
      const x = ev.clientX;
      const y = ev.clientY;
      setTimeout(() => {
        const sel = window.getSelection().toString();
        if (!sel) { onSelectIcon(null); return; }
        let p = null;
        try {
          const rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
          if (rect) p = { x: rect.right, y: rect.top };
        } catch {}
        if (!p) p = { x, y };
        onSelectIcon({ x: p.x, y: p.y, text: sel });
      }, 0);
      const selNow = window.getSelection();
      onSelectText(selNow ? selNow.toString().length : 0);
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [onSelectText, onSelectIcon]);
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
  const [selIcon, setSelIcon] = useState(null);
  const [selBusy, setSelBusy] = useState(false);
  const [textFullscreen, setTextFullscreen] = useState(false);
  const selAudioRef = useRef(null);
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

  useEffect(() => {
    const handleTextFullscreen = (event) => {
      if (event.ctrlKey && event.shiftKey && (event.code === 'Space' || event.key === ' ')) {
        event.preventDefault();
        setTextFullscreen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleTextFullscreen, true);
    return () => window.removeEventListener('keydown', handleTextFullscreen, true);
  }, []);
  // The drawer mounts lazily, so the stored weight has to be applied here too.
  useEffect(() => {
    document.body.style.setProperty('--font-weight', String(settings.fontWeight));
  }, [settings.fontWeight]);
  // The drawer mounts lazily, so the stored leading has to be applied here too.
  useEffect(() => {
    document.body.style.setProperty('--leading', String(settings.leading));
  }, [settings.leading]);
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
  const textPanelRef = useRef(null);
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
  const mapRef = useRef(new Map());
  const timer = useRef(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorError, setEditorError] = useState('');
  const [editorAudio, setEditorAudio] = useState(null);
  const [editorScope, setEditorScope] = useState('all');
  const [editorAudioKey, setEditorAudioKey] = useState(null);
  const editorLoadId = useRef(0);
  const statusIsError = jobError !== '' || schedState.state === 'error' || Object.keys(chunkNotes).length > 0;

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
    logEvent('Text fullscreen ' + (textFullscreen ? 'on' : 'off'));
  }, [textFullscreen]);

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
      mapRef.current.clear();
      setSelIcon(null);
      stopSelectionAudio();
      setJobError('');
      setNotice('Provider: ' + providerLabel(next) + '. Press Start Reading to continue.');
    } catch (e) {
      const m = e && e.message ? e.message : 'error';
      setJobError(m);
      logEvent(m);
    }
  };

  const handleStart = async () => {
    stopSelectionAudio();
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
      onLog: (msg) => logEvent(msg),
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
    stopSelectionAudio();
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
      mapRef.current.delete(i);
    } catch (e) {
      const m = e && e.message ? e.message : 'error';
      setJobError(m);
      logEvent(m);
    }
  };

  const jumpToChunk = (index) => {
    stopSelectionAudio();
    logEvent(`Jump to chunk ${index + 1} pressed`);
    if (playerEngineRef.current) playerEngineRef.current.jump(index);
    const entry = mapRef.current.get(index);
    if (entry && entry.state === 'fallback' && (entry.tries || 0) < MAP_MAX_TRIES) {
      mapRef.current.delete(index);
    }
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
    logEvent('Clear catch pressed');
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
      mapRef.current.clear();
      setSelIcon(null);
      stopSelectionAudio();
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
    const rejection = textFileRejection(file.name);
    if (rejection) { setNotice(rejection); logEvent(rejection); return; }
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
      mapRef.current.clear();
      setSelIcon(null);
      stopSelectionAudio();
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
    const rejection = textFileRejection(file.name);
    if (rejection) { setNotice(rejection); logEvent(rejection); return; }
    const reader = new FileReader();
    reader.onload = () => { setText(String(reader.result || '')); setSelIcon(null); stopSelectionAudio(); };
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
    mapRef.current.clear();
    setSelIcon(null);
    stopSelectionAudio();
  }, [provider.id, settings.voice, settings.chunkSize]);
  useEffect(() => {
    const panel = textPanelRef.current;
    if (!panel) return undefined;
    const onScroll = () => setSelIcon(null);
    panel.addEventListener('scroll', onScroll, true);
    return () => panel.removeEventListener('scroll', onScroll, true);
  }, []);
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
  useEffect(() => {
    if (settings.highlightMode === 'none') return;
    const isReading = playerState.total > 0 && (playerState.status === 'playing' || playerState.status === 'paused');
    if (!isReading) return;
    buildChunkMap(playerState.index);
  }, [settings.highlightMode, playerState.total, playerState.index, playerState.status]);

  const usablePx = usableWidth(boxWidth);
  const shown = boxWidth ? clampWidths(widths, usablePx) : widths;

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

  const handleFontWeightCommit = (value) => {
    if (!storage || value === settings.fontWeight) return;
    if (!saveSettings(storage, { ...settings, fontWeight: value })) {
      logEvent('Could not save the font weight');
      return;
    }
    setSettings(loadSettings(storage));
    logEvent('Font weight ' + value);
  };

  const handleLeadingCommit = (value) => {
    if (!storage || value === settings.leading) return;
    if (!saveSettings(storage, { ...settings, leading: value })) {
      logEvent('Could not save the font leading');
      return;
    }
    setSettings(loadSettings(storage));
    logEvent('Font leading ' + value);
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

  const stopSelectionAudio = () => {
    const a = selAudioRef.current;
    if (a) { try { a.pause(); } catch {} try { a.src = ''; } catch {} }
    selAudioRef.current = null;
    setSelBusy(false);
  };
  const handleReadSelection = async () => {
    if (selBusy) return;
    setSelIcon(null);
    if (selAudioRef.current) { stopSelectionAudio(); return; }
    if (!selIcon) return;
    const startedAt = Date.now();
    const st = selectionReadState(selIcon.text, settings.chunkSize);
    if (!st.ok) { setNotice(st.reason); logEvent(st.reason); return; }
    setSelBusy(true);
    try {
      if (playerEngineRef.current) try { playerEngineRef.current.pause(); } catch {}
      const key = services.makeKey({ text: st.text, voice: settings.voice, provider });
      let bytes = null;
      let hit = false;
      try { hit = await services.cache.has(key); } catch { hit = false; }
      if (hit) {
        bytes = await services.cache.get(key);
      } else {
        const r = await services.speak({ input: st.text, voice: settings.voice, provider });
        if (r && r.attempts) try { services.counter.add(r.attempts); } catch {}
        if (!r || !r.ok) { setNotice(r && r.error ? r.error.message : 'Speak failed'); return; }
        bytes = r.bytes;
        try { await services.cache.put(key, bytes); } catch {}
      }
      const url = URL.createObjectURL(new Blob([bytes], { type: audioMime(bytes) }));
      const audio = new Audio(url);
      selAudioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); selAudioRef.current = null; setSelBusy(false); };
      audio.onerror = () => { URL.revokeObjectURL(url); selAudioRef.current = null; setSelBusy(false); setNotice('Audio error'); };
      await audio.play();
      logEvent('Read selection: ' + st.text.length + ' chars, ' + (hit ? 'cache hit' : 'cache miss') + ', ' + (Date.now() - startedAt) + ' ms');
    } catch (e) {
      setNotice(e && e.message ? e.message : String(e));
    } finally {
      setUsedToday(services.counter.count());
      setSelBusy(false);
    }
  };
  const buildChunkMap = async (index) => {
    const existing = mapRef.current.get(index);
    if (existing && (existing.state !== 'fallback' || (existing.tries || 1) >= MAP_MAX_TRIES)) {
      if (existing.state === 'fallback' && (existing.tries || 1) >= MAP_MAX_TRIES && !existing.gaveUp) {
        mapRef.current.set(index, { ...existing, gaveUp: true });
        logEvent('Highlight map chunk ' + (index + 1) + ': giving up after ' + MAP_MAX_TRIES + ' tries');
      }
      return;
    }
    const tries = existing ? (existing.tries || 1) + 1 : 1;
    mapRef.current.set(index, { state: 'building', tries });
    const data = playerDataRef.current;
    const chunk = data.chunks[index];
    if (chunk == null) { mapRef.current.delete(index); return; }
    try {
      if (!services) throw new Error('No services yet.');
      const key = await services.makeKey({ text: chunk, voice: data.settings.voice, provider: data.provider });
      const bytes = await services.cache.get(key);
      if (!bytes) { mapRef.current.delete(index); logEvent('Highlight map chunk ' + (index + 1) + ': no cached audio yet (estimated)'); return; }
      const { channels, sampleRate } = await decodeChunk(bytes);
      const silence = findSilences(mixToMono(channels), sampleRate);
      const weights = charWeights(chunk);
      const result = alignTimeMap(chunk, silence, { weightAt: (i) => weights[i] });
      if (result.ok) {
        mapRef.current.set(index, { state: 'ok', timeToIndex: result.timeToIndex, mapDuration: silence.duration });
        logEvent('Highlight map chunk ' + (index + 1) + ': aligned ' + result.anchors + ' of ' + result.breaks + ' breaks, ' + result.silences + ' pauses');
      } else {
        mapRef.current.set(index, { state: 'fallback', tries });
        logEvent('Highlight map chunk ' + (index + 1) + ': estimated (' + result.reason + '), try ' + tries);
      }
    } catch (e) {
      const reason = (e && e.message ? e.message : 'unknown error').slice(0, 80);
      mapRef.current.set(index, { state: 'fallback', tries });
      logEvent('Highlight map chunk ' + (index + 1) + ': estimated (' + reason + '), try ' + tries);
    }
  };

  const closeClipEditor = () => {
    editorLoadId.current += 1;
    setEditorOpen(false);
    setEditorAudio(null);
    setEditorError('');
    setEditorLoading(false);
    setEditorAudioKey(null);
    logEvent('Clip editor closed');
  };

  useEffect(() => {
    if (editorOpen) closeClipEditor();
  }, [provider.id, settings.voice, settings.chunkSize, text]);

  const loadEditor = async (scope) => {
    const id = ++editorLoadId.current;
    setEditorLoading(true);
    setEditorError('');
    const indexes = scope === 'all' ? chunks.map((_, i) => i) : [Number(scope.slice(6))];
    const keysUsed = [];
    const getBytes = async (index) => {
      const key = await services.makeKey({ text: chunks[index], voice: settings.voice, provider });
      const bytes = await services.cache.get(key);
      if (bytes !== null) keysUsed.push(key);
      return bytes;
    };
    try {
      const r = await loadEditorAudio({ indexes, getBytes, decode: decodeChunk, toMonoFn: toMono });
      if (id !== editorLoadId.current) return;
      setEditorAudioKey(r.audio ? audioKeyFrom(keysUsed) : null);
      setEditorAudio(r.audio);
      logEvent('Clip editor: ' + (r.audio ? r.audio.indexes.length : 0) + ' chunk(s) loaded, ' + r.skipped.length + ' without audio');
    } catch (e) {
      if (id !== editorLoadId.current) return;
      setEditorAudio(null);
      setEditorAudioKey(null);
      setEditorError(e.message);
      logEvent('Clip editor failed: ' + e.message);
    } finally {
      if (id === editorLoadId.current) setEditorLoading(false);
    }
  };

  const openClipEditor = () => {
    if (playerEngineRef.current) try { playerEngineRef.current.pause(); } catch {}
    setEditorScope('all');
    setEditorOpen(true);
    logEvent('Clip editor opened');
    loadEditor('all');
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
  const scopeOptions = [{ value: 'all', label: 'Whole text (joined)' }, ...chunks.map((_, i) => ({ value: 'chunk-' + i, label: 'Chunk ' + (i + 1) }))];
  const canPause = jobLive && (schedState.state === 'generating' || schedState.state === 'idle');
  const canResume = ['paused', 'cancelled', 'waiting_reset', 'error'].includes(schedState.state);
  const canCancel = jobLive && ['generating', 'idle', 'paused'].includes(schedState.state);
  const pauseReason = canPause ? 'Stop making new audio. The request in progress finishes. Audio already made keeps playing.' : (!jobLive ? 'No job yet. Press Start Reading.' : 'Nothing to pause (' + stateWord + ').');
  const resumeReason = canResume ? 'Continue making audio from the chunk that is playing now.' : 'Nothing to resume (' + stateWord + ').';
  const cancelReason = canCancel ? 'Stop the job. Audio already made is kept.' : (!jobLive ? 'No job yet.' : 'Nothing to cancel (' + stateWord + ').');
  const noteState = ['paused', 'waiting_reset', 'cancelled', 'error'].includes(schedState.state);
  const firstChunkError = (schedState.chunks.map((c) => c && c.error && c.error.message).find(Boolean)) || '';

  const reading = playerState.total > 0 && (playerState.status === 'playing' || playerState.status === 'paused');
  const readChunk = reading && chunks[playerState.index] ? chunks[playerState.index] : '';

  return (
    <div className={`app ${textFullscreen ? "text-fullscreen-mode" : ""}`} onClick={(e) => { if (drawerOpen && !e.target.closest('.drawer') && !e.target.closest('.settings-btn')) { handleSaveSettings(); setDrawerOpen(false); } }} onMouseDown={(e) => { if (selIcon && !e.target.closest('.sel-speaker')) setSelIcon(null); }} onKeyDown={(e) => { if (e.key === 'Escape') setSelIcon(null); }}>
      <header className="topbar">
        <span className="title">Voice</span>
        <span className="version">v{APP_VERSION}</span>
        <select className="provider-select" value={provider.id} onChange={(e) => handleProviderChange(e.target.value)} disabled={switchLocked} title={switchLocked ? 'Wait for the current request to finish, or press Cancel.' : 'Choose the voice provider (free models only).'} aria-label="Voice provider">
          {providers.map((p) => (<option key={p.id} value={p.id}>{providerLabel(p)}</option>))}
        </select>
        {switchLocked ? <span className="provider-reason">Wait for the request or press Cancel.</span> : null}
        <span className="req-pill" title={services ? new Date(services.counter.resetAt()).toLocaleString() : ''}>
          Requests today: {usedToday} / {settings.dailyLimit}
        </span>
        <button className="settings-btn" onClick={() => setDrawerOpen((o) => !o)} title="Settings"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.49.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.62 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.3-.06.62-.06.94s.02.64.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.69.24l2.39-.96c.5.39 1.05.71 1.63.94l.36 2.54c.05.23.25.4.49.4h4c.24 0 .44-.17.49-.4l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96c.26.1.55 0 .69-.24l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg></button>
      </header>
      {selIcon ? (() => {
        const st = selectionReadState(selIcon.text, settings.chunkSize);
        const playing = !!selAudioRef.current;
        const title = !st.ok ? st.reason : (selBusy ? 'Generating...' : (playing ? 'Stop' : 'Read selection'));
        const left = Math.max(0, Math.min(selIcon.x + 8, window.innerWidth - 40));
        const top = Math.max(0, Math.min(selIcon.y - 40, window.innerHeight - 40));
        return (
          <button type="button" className="sel-speaker" style={{ left: left, top: top }} title={title} disabled={!st.ok} onMouseDown={(e) => e.preventDefault()} onClick={handleReadSelection}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/></svg>
          </button>
        );
      })() : null}
      <div className={'columns' + (resizing ? ' resizing' : '')} ref={columnsRef} style={{ gridTemplateColumns: columnsTemplate(shown) }}>
        <section className={panelClass('text', 'text-panel')} ref={textPanelRef} style={{ gridColumn: order.indexOf('text') * 2 + 1, gridRow: 1 }} onDragOver={onPanelDragOver('text')} onDragLeave={onPanelDragLeave} onDrop={onPanelDrop('text')}>
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
          <textarea ref={textRef} value={text} spellCheck={settings.spellCheck} onChange={(e) => { setText(e.target.value); setSelectedChars(0); }} onSelect={(e) => { const s = e.target.selectionStart; const t = e.target.selectionEnd; setSelectedChars(t > s ? t - s : 0); }} onMouseUp={(e) => { const ex = e.clientX; const ey = e.clientY; setTimeout(() => { const ta = e.target; const s = ta.selectionStart; const t = ta.selectionEnd; const sel = t > s ? ta.value.slice(s, t) : ''; if (!sel) { setSelIcon(null); return; } const p = selectionTopRight(ta) || { x: ex, y: ey }; setSelIcon({ x: p.x, y: p.y, text: sel }); }, 0); }} style={{ fontSize: `${textZoom}%`, display: reading ? 'none' : undefined }} onWheel={(e) => { if (e.ctrlKey) { e.preventDefault(); setTextZoom((z) => Math.min(200, Math.max(60, z + (e.deltaY < 0 ? 10 : -10)))); } }} onKeyDown={(e) => { if (e.ctrlKey && (e.key === '+' || e.key === '=')) { e.preventDefault(); setTextZoom((z) => Math.min(200, z + 10)); } if (e.ctrlKey && (e.key === '-')) { e.preventDefault(); setTextZoom((z) => Math.max(60, z - 10)); } if (e.ctrlKey && (e.key === '0')) { e.preventDefault(); setTextZoom(100); } }} onDragOver={(e) => { e.preventDefault(); setTextDropActive(true); }} onDragEnter={(e) => { e.preventDefault(); setTextDropActive(true); }} onDragLeave={() => setTextDropActive(false)} onDrop={handleDropFile} className={textDropActive ? 'drop-active' : ''} />
          {reading ? (
            <TextReadView chunk={readChunk} mode={settings.highlightMode} engineRef={playerEngineRef} chunkIndex={reading ? playerState.index : 0} mapRef={mapRef} textZoom={textZoom} onZoom={setTextZoom} onSelectText={setSelectedChars} onSelectIcon={setSelIcon} />
          ) : null}
          <div className="stats" style={{ justifyContent: 'flex-end' }}>
            <span>{plural(stats.characters, 'character')}</span>
            <span>{plural(stats.pages, 'page')} (about)</span>
            <span>{plural(stats.chunks, 'chunk')}</span>
            <span>{plural(stats.requestsNeeded, 'request')} needed</span>
            <span>{stats.fitsToday ? 'Fits today' : `Needs ${stats.daysNeeded} days`}</span>
          </div>
          <div className="row">
            <button onClick={handleStart} disabled={!canStart} className="start-btn" style={{ minWidth: '300px' }}>
              <svg className="start-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              <span className="start-label">Start Reading</span>
            </button>
            <span style={{ flex: 1 }} />
            <button className="icon-btn" title="Load file (.txt .md)" onClick={() => fileInputRef.current && fileInputRef.current.click()}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg></button>
            <button className="icon-btn" title="Clear text" onClick={handleClearText}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
            <button className="icon-btn" title="Fullscreen text (Ctrl+Shift+Space)" aria-label="Toggle text fullscreen" onClick={() => setTextFullscreen((v) => !v)}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
          <input ref={fileInputRef} type="file" accept=".txt,.md,text/plain" style={{display:"none"}} onChange={handleLoadFile} />
          </div>
          {startReason ? <div className="reason">{startReason}</div> : null}
          {textFullscreen ? (
            <button className="icon-btn fullscreen-exit" title="Exit fullscreen (Ctrl+Shift+Space)" aria-label="Exit text fullscreen" onClick={(e) => { e.stopPropagation(); setTextFullscreen(false); }}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/></svg></button>
          ) : null}
        </section>
        <section className={panelClass('reader', 'reader-panel') + (editorOpen ? ' editor-open' : '')} style={{ gridColumn: order.indexOf('reader') * 2 + 1, gridRow: 1 }} onDragOver={onPanelDragOver('reader')} onDragLeave={onPanelDragLeave} onDrop={onPanelDrop('reader')}>
          <div className="panel-head">
            <span className="grip" role="button" tabIndex={0} draggable="true" title="Drag to move this panel. Keyboard: Alt+Left or Alt+Right." aria-label="Move the Reader panel" onDragStart={onGripDragStart('reader')} onDragEnd={onGripDragEnd} onKeyDown={onGripKeyDown('reader')} />
            <span className="panel-title">Reader</span>
            <span className="now" style={{color:"var(--accent)"}}>{settings.voice || provider.label}</span>
            {editorOpen ? (<button className="close-btn reader-close-editor" onClick={closeClipEditor} aria-label="Close editor" title="Close editor">×</button>) : null}
          </div>
          <div className="chunk-list">
            {chunks.map((c, i) => {
              const st = schedState.chunks[i] ? schedState.chunks[i].status : 'queued';
              const err = schedState.chunks[i] ? schedState.chunks[i].error : null;
              return (
                <div key={i} className={`chunk-row ${st} ${i === activeRowIndex(playerState) ? "playing" : ""}`} aria-current={i === activeRowIndex(playerState) ? "true" : undefined} onClick={() => jumpToChunk(i)} style={{ cursor: 'pointer' }} title="Jump to this chunk">
                  <div className="chunk-bar"><div className={`chunk-bar-fill ${st === 'generating' ? 'generating' : ''}`} style={{ width: (st === 'queued' ? 0 : (st === 'generating' ? 0 : (st === 'playing' && i === activeRowIndex(playerState) ? Math.min(100, Math.max(0, playerState.duration ? playerState.position / playerState.duration * 100 : 0)) : 100))) + '%', opacity: (st === 'ready' || st === 'played') ? 0.4 : 1, background: st === 'failed' ? 'var(--danger)' : undefined }} /></div>
                  <div className="chunk-head">
                    <span className={`badge ${st}`}>{st}</span>
                    <span className="chunk-num">#{i + 1}</span>
                    <span className="chunk-actions">
                      {st === 'failed' ? <button onClick={(e) => { e.stopPropagation(); handleRetry(i); }}>Retry</button> : null}
                      {i === activeRowIndex(playerState) && (reading || schedState.state === 'generating' || schedState.state === 'paused') ? (
                        <>
                          <button className="icon-btn chunk-download" disabled={!canPause && !canResume} title={canResume ? resumeReason : pauseReason} onClick={(e) => { e.stopPropagation(); if (canResume) handleResume(); else handlePause(); }} aria-label="Pause or resume reading">
                            {canResume ? <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 7l8 5-8 5z" /></svg> : <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 7h3v10H8zM13 7h3v10h-3z" /></svg>}
                          </button>
                          <button className="icon-btn chunk-download" disabled={!canCancel} title={cancelReason} onClick={(e) => { e.stopPropagation(); handleCancel(); }} aria-label="Cancel reading">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 7l10 10M17 7L7 17" /></svg>
                          </button>
                        </>
                      ) : null}
                      <button className="icon-btn chunk-download" disabled={st !== 'ready'} title={st === 'ready' ? 'Download this chunk' : `Chunk ${i + 1} is not ready yet: no audio in the cache.`} onClick={(e) => { e.stopPropagation(); handleDownloadChunk(i); }} aria-label={`Download chunk ${i + 1}`}>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 7v8M8.5 11.5L12 15l3.5-3.5" /></svg>
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
          {editorOpen ? (<ClipEditor audio={editorAudio} loading={editorLoading} error={editorError} scopeValue={editorScope} scopeOptions={scopeOptions} onScopeChange={(v) => { setEditorScope(v); loadEditor(v); }} chunkTexts={chunks} audioKey={editorAudioKey} />) : null}
          {(jobError || noteState) ? (
            <div className={'job-note' + (jobError || schedState.state === 'error' ? ' job-note-error' : '')}>
              {jobError ? <span>{jobError}</span> : <span>{schedState.state === 'cancelled' ? 'CANCELLED' : 'PAUSED (chunk #' + (schedState.chunks.findIndex((c) => c && c.status !== 'ready') + 1 || playerState.index + 1) + ')'}{schedState.state === 'waiting_reset' ? ' - ' + new Date(schedState.resetAt).toLocaleString() : ''}{schedState.state === 'error' && firstChunkError ? ' - ' + firstChunkError : ''}</span>}
              {canResume ? <div className="reader-actions"><button disabled={!canResume} title={resumeReason} onClick={handleResume}>Resume</button></div> : null}
            </div>
          ) : null}
          <div className="reader-card">
            <div className="card-label">Download</div>
            <div className="reader-actions">
              <button onClick={handleDownloadZip} disabled={zipRunning || joinedRunning || readyCount === 0} title={zipRunning || joinedRunning ? 'A download is being prepared.' : readyCount === 0 ? 'No chunk has audio in the cache yet.' : 'Download the ready chunks as one ZIP.'}>All chunks</button>
              <button onClick={handleDownloadJoined} disabled={zipRunning || joinedRunning || !allChunksReady} title={zipRunning || joinedRunning ? 'A download is being prepared.' : allChunksReady ? 'Download the whole text as one joined audio file.' : notReadyTitle}>All joined</button>
              <button onClick={openClipEditor} disabled={zipRunning || joinedRunning || !allChunksReady || window.matchMedia('(max-width: 768px)').matches} title={window.matchMedia('(max-width: 768px)').matches ? 'The clip editor works on desktop only (window wider than 768px).' : zipRunning || joinedRunning ? 'A download is being prepared.' : allChunksReady ? 'Open the clip editor to cut the audio into separate clips' : notReadyTitle}>Edit clips</button>
            </div>
          </div>
        </section>
                <div className="col-handle" role="separator" aria-orientation="vertical" tabIndex={0} aria-label="Resize the two panels" title="Drag to resize. Keyboard: Left or Right arrow, Shift for bigger steps." style={{ gridColumn: 2, gridRow: 1 }} onPointerDown={onHandlePointerDown(0)} onPointerMove={onHandlePointerMove} onPointerUp={onHandlePointerUp} onPointerCancel={onHandlePointerUp} onKeyDown={onHandleKeyDown(0)} />
      </div>
      <footer className="playerbar">
        <button onClick={() => { stopSelectionAudio(); playerEngineRef.current?.prev(); }} disabled={editorOpen || !playerState.total || playerState.index === 0} title={editorOpen ? 'The clip editor is open: use the play button under the waveform.' : ''}><svg viewBox='0 0 24 24' width='20' height='20' fill='currentColor'><path d='M6 6h2v12H6zM9.5 12l8.5 6V6z'/></svg></button>
        {playerState.status === 'playing'
          ? <button className="play-primary play-active" onClick={() => playerEngineRef.current && playerEngineRef.current.pause()} disabled={editorOpen} title={editorOpen ? 'The clip editor is open: use the play button under the waveform.' : ''}><svg viewBox='0 0 24 24' width='20' height='20' fill='currentColor'><path d='M6 5h4v14H6zM14 5h4v14h-4z'/></svg></button>
          : <button className="play-primary" onClick={() => { stopSelectionAudio(); if (audioRef.current) { audioRef.current.pause(); if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); } } if (playerEngineRef.current) playerEngineRef.current.play(); }} disabled={editorOpen || !playerState.total} title={editorOpen ? 'The clip editor is open: use the play button under the waveform.' : ''}><svg viewBox='0 0 24 24' width='20' height='20' fill='currentColor'><path d='M8 5v14l11-7z'/></svg></button>}
        <button onClick={() => playerEngineRef.current && playerEngineRef.current.stop()} disabled={editorOpen || !playerState.total} title={editorOpen ? 'The clip editor is open: use the play button under the waveform.' : ''}><svg viewBox='0 0 24 24' width='20' height='20' fill='currentColor'><path d='M6 6h12v12H6z'/></svg></button>
        <button onClick={() => { stopSelectionAudio(); playerEngineRef.current?.next(); }} disabled={editorOpen || !playerState.total || playerState.index >= playerState.total - 1} title={editorOpen ? 'The clip editor is open: use the play button under the waveform.' : ''}><svg viewBox='0 0 24 24' width='20' height='20' fill='currentColor'><path d='M6 6l8.5 6L6 18zM16 6h2v12h-2z'/></svg></button>
        <input className="seek" type="range" min="0" max={playerState.duration || 0} step="any" value={Math.min(playerState.position, playerState.duration || 0)} onChange={(e) => playerEngineRef.current && playerEngineRef.current.seek(Number(e.target.value))} disabled={editorOpen || !playerState.duration} aria-label="Seek" title={editorOpen ? 'The clip editor is open: use the play button under the waveform.' : ''} />
        <input type="range" min="0" max="1" step="0.01" value={playerState.volume} onChange={(e) => playerEngineRef.current && playerEngineRef.current.setVolume(Number(e.target.value))} aria-label="Volume" />
<span className="now rate-label">{Math.round(playerState.volume * 100)}%</span>
        <input type="range" min="0" max={RATES.length - 1} step="1" value={Math.max(0, RATES.indexOf(playerState.rate))} onChange={(e) => { const next = RATES[Number(e.target.value)]; if (next !== playerState.rate) logEvent(`Speed ${next}x`); if (playerEngineRef.current) playerEngineRef.current.setRate(next); }} disabled={!playerState.total} aria-label="Playback speed" />
<span className="now rate-label">{playerState.rate}x</span>

        <span style={{flex:1,textAlign:'center'}}>{notice}</span>
      </footer>
        <aside className={drawerOpen ? 'drawer open' : 'drawer'}>
          <div className="drawer-header">
            <h3>Settings</h3>
            <span className="req-pill mobile-only" title={services ? new Date(services.counter.resetAt()).toLocaleString() : ''}>
              Requests today: {usedToday} / {settings.dailyLimit}
            </span>
            <button className="close-btn" onClick={() => setDrawerOpen(false)} aria-label="Close settings" title="Close settings">×</button>
          </div>
          <section className="settings-card">
            <div className="settings-row">
              <div className="row-text"><span className="row-label">API key</span></div>
              <input className="api-key-input" type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="settings-row buttons-row">
              <div className="row">
                <button className="btn-primary" onClick={handleSaveKey}>Save</button>
                <button className="btn-danger" onClick={handleClearKey}>Clear</button>
              </div>
            </div>
          </section>
          <section className="settings-card">
            <div className="settings-row">
              <div className="row-text"><span className="row-label">Provider</span></div>
              <div className="segmented-text-picker wide">
                <TextToggle
                  onClick={() => handleProviderChange('fish')}
                  selected={provider.id === 'fish'}
                  disabled={switchLocked}
                  title={switchLocked ? 'Wait for the current request to finish, or press Cancel.' : 'Fish Audio'}
                  ariaLabel="Fish Audio"
                >
                  Fish Audio
                </TextToggle>
                <TextToggle
                  onClick={() => handleProviderChange('heygen')}
                  selected={provider.id === 'heygen'}
                  disabled={switchLocked}
                  title={switchLocked ? 'Wait for the current request to finish, or press Cancel.' : 'HeyGen'}
                  ariaLabel="HeyGen"
                >
                  HeyGen
                </TextToggle>
              </div>
            </div>
            {switchLocked ? <span className="provider-reason">Wait for the request or press Cancel.</span> : null}
            <div className="settings-row">
              <div className="row-text"><span className="row-label">Voice ({provider.label})</span></div>
              {Array.isArray(provider.voices) && provider.voices.length ? (
                <select value={voiceInput} onChange={(e) => setVoiceInput(e.target.value)} aria-label="Voice" className="short-input">
                  {provider.voices.map((v) => (<option key={v} value={v}>{v}</option>))}
                </select>
              ) : (
                <input type="text" value={voiceInput} onChange={(e) => setVoiceInput(e.target.value)} aria-label="Voice" className="short-input" placeholder="Default voice" />
              )}
            </div>
          </section>
          <section className="settings-card">
            <div className="settings-row duo">
              <div className="row-text"><span className="row-label">Chunk size</span></div>
              <input type="number" value={chunkInput} onChange={(e) => setChunkInput(e.target.value)} className="tiny-input" aria-label="Chunk size" />
              <div className="row-text"><span className="row-label">Lookahead</span></div>
              <input type="number" value={lookInput} onChange={(e) => setLookInput(e.target.value)} className="tiny-input" aria-label="Lookahead" />
            </div>
            <div className="settings-row">
              <div className="row-text"><span className="row-label">Daily limit</span></div>
              <div className="segmented-text-picker">
                <TextToggle
                  onClick={() => setDailyInput(50)}
                  selected={dailyInput === 50}
                  title="50 requests per day"
                  ariaLabel="50 requests per day"
                >
                  50
                </TextToggle>
                <TextToggle
                  onClick={() => setDailyInput(1000)}
                  selected={dailyInput === 1000}
                  title="1000 requests per day (needs $10 lifetime credit)"
                  ariaLabel="1000 requests per day"
                >
                  1000
                </TextToggle>
              </div>
            </div>
            <div className="footnote">1000 needs $10 of lifetime credit purchases on OpenRouter. The app cannot check this.</div>
          </section>
          <section className="settings-card">
            <div className="settings-row">
              <div className="row-text"><span className="row-label">Font weight</span></div>
              <FontWeightControl initial={settings.fontWeight} onCommit={handleFontWeightCommit} />
            </div>
            <div className="settings-row">
              <div className="row-text"><span className="row-label">Font leading</span></div>
              <LeadingControl initial={settings.leading} onCommit={handleLeadingCommit} />
            </div>
            <div className="settings-row">
              <div className="row-text"><span className="row-label">Highlight</span></div>
              <div className="segmented-text-picker wide-lg">
                <TextToggle
                  onClick={() => handleHighlightModeChange('none')}
                  selected={highlightInput === 'none'}
                  title="No highlight"
                  ariaLabel="No highlight"
                >
                  None
                </TextToggle>
                <TextToggle
                  onClick={() => handleHighlightModeChange('words')}
                  selected={highlightInput === 'words'}
                  title="Highlight words"
                  ariaLabel="Highlight words"
                >
                  Words
                </TextToggle>
                <TextToggle
                  onClick={() => handleHighlightModeChange('sentences')}
                  selected={highlightInput === 'sentences'}
                  title="Highlight sentences"
                  ariaLabel="Highlight sentences"
                >
                  Sentences
                </TextToggle>
              </div>
            </div>
            <div className="settings-row mobile-hide">
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
            <div className="settings-row">
              <div className="row-text"><span className="row-label">Download format</span></div>
              <div className="segmented-text-picker wide">
                <TextToggle
                  onClick={() => handleDownloadFormatChange('wav')}
                  selected={downloadFormatInput === 'wav'}
                  title="WAV format"
                  ariaLabel="WAV format"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                  <span>WAV</span>
                </TextToggle>
                <TextToggle
                  onClick={() => handleDownloadFormatChange('mp3')}
                  selected={downloadFormatInput === 'mp3'}
                  title="MP3 format"
                  ariaLabel="MP3 format"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                  <span>MP3</span>
                </TextToggle>
              </div>
            </div>
          </section>
          <section className="settings-card">
            <div className="settings-row">
              <div className="row-text"><span className="row-label">Cache ({(cacheSize / 1024 / 1024).toFixed(2)} MB)</span></div>
              <button className="btn-danger storage-btn short-btn" onClick={handleClearCache}>Clear</button>
            </div>
          </section>
          <div className="settings-footer">
            <button className="btn-primary footer-save" onClick={() => { handleSaveSettings(); setDrawerOpen(false); }}>Save settings</button>
          </div>
        </aside>
      <div className={statusIsError ? 'statusbar err' : 'statusbar'} onClick={() => setShowEvents((v) => !v)}>
        {events[0] || 'ready'}
        {selectedChars > 0 ? <span className="status-selected">Selected: {selectedChars} chars</span> : null}
      </div>
      {showEvents ? (
        <div className="eventlist">
          {events.map((e, i) => (<div key={i}>{e}</div>))}
        </div>
      ) : null}
    </div>
  );
}

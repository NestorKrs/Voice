import { useState, useEffect, useRef } from 'react';
import { APP_VERSION } from './version.js';
import { loadSettings, saveSettings, loadText, saveText, hasKey, saveKey, clearKey } from './settingsStore.js';
import { computeStats } from './textStats.js';
import { chunkText } from './textPipeline.js';
import { createScheduler } from './scheduler.js';
import { createServices } from './wiring.js';
import { createPlayerEngine } from './playerEngine.js';
import { allProviders, loadCustomProviders, getProvider, providerLabel } from './providers.js';
import { audioMime } from './audioFormat.js';
import { DEFAULT_ORDER, movePanel, stepPanel, loadOrder, saveOrder, resetOrder } from './panelLayout.js';
import { DEFAULT_WIDTHS, clampWidths, usableWidth, resizeFromHandle, columnsTemplate, loadWidths, saveWidths, resetWidths } from './panelWidths.js';

const storage = typeof localStorage !== 'undefined' ? localStorage : null;
const services = storage ? createServices({ storage }) : null;

const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');

export default function App() {
  const [text, setText] = useState(() => (storage ? loadText(storage) : ''));
  const [settings, setSettings] = useState(() => (storage ? loadSettings(storage) : { voice: '', chunkSize: 2000, lookahead: 2, dailyLimit: 50 }));
  const [keySet, setKeySet] = useState(() => (storage ? hasKey(storage) : false));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [voiceInput, setVoiceInput] = useState(settings.voice);
  const [chunkInput, setChunkInput] = useState(settings.chunkSize);
  const [lookInput, setLookInput] = useState(settings.lookahead);
  const [dailyInput, setDailyInput] = useState(settings.dailyLimit);
  const [fontInput, setFontInput] = useState('400');
  const [textZoom, setTextZoom] = useState(100);
  const [playingChunk, setPlayingChunk] = useState(null);
  useEffect(() => {
    const preventBrowserZoom = (e) => { if (e.ctrlKey) e.preventDefault(); };
    window.addEventListener('wheel', preventBrowserZoom, { passive: false });
    window.addEventListener('keydown', preventBrowserZoom, { passive: false });
    return () => {
      window.removeEventListener('wheel', preventBrowserZoom);
      window.removeEventListener('keydown', preventBrowserZoom);
    };
  }, []);
  const [schedState, setSchedState] = useState({ state: 'idle', resetAt: null, playhead: 0, chunks: [] });
  const [usedToday, setUsedToday] = useState(() => (services ? services.counter.count() : 0));
  const [jobError, setJobError] = useState('');
  const [notice, setNotice] = useState('');
  const [cacheSize, setCacheSize] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [events, setEvents] = useState([]);
  const [showEvents, setShowEvents] = useState(false);
  const [order, setOrder] = useState(() => (storage ? loadOrder(storage) : [...DEFAULT_ORDER]));
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

  const handleStart = async () => {
    logEvent('Start Reading pressed');
    if (!services) return;
    if (schedulerRef.current) {
            try { schedulerRef.current.cancel(); } catch {}
    }
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
      if (schedulerRef.current) schedulerRef.current.resume();
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

  const playChunk = async (index) => {
    logEvent(`Play chunk ${index + 1} pressed`);
    if (!services || !schedulerRef.current) return;
    if (playerEngineRef.current && playerState.status === 'playing') playerEngineRef.current.pause();
    if (audioRef.current) { audioRef.current.pause(); }
    setPlayingChunk(index);
    try {
      const chunkList = chunkText(text, settings.chunkSize);
      const key = await services.makeKey({ text: chunkList[index], voice: settings.voice, provider });
      logEvent(`Chunk ${index + 1} requested`);
      const bytes = await services.cache.get(key);
      if (!bytes) {
        logEvent(`Play chunk ${index + 1}: key ${key.slice(0, 8)}, no audio in cache for this chunk`);
        setNotice('Play chunk ' + (index + 1) + ': no audio in cache for this chunk');
        return;
      }
      logEvent(`Play chunk ${index + 1}: key ${key.slice(0, 8)}, ${bytes.byteLength} bytes from cache`);
      const blob = new Blob([bytes], { type: audioMime(bytes) });
      logEvent(`Play chunk ${index + 1}: blob ${blob.size} bytes, type ${blob.type}`);
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioUrl) URL.revokeObjectURL(audioUrl);
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      setAudioUrl(url);
      audio.onloadedmetadata = () => logEvent(`duration ${audio.duration} s`);
      audio.oncanplay = () => logEvent('canplay');
      audio.onplaying = () => logEvent('playing');
      audio.onended = () => { URL.revokeObjectURL(url); setAudioUrl(null); setPlayingChunk(null); logEvent('ended'); };
      audio.onerror = () => {
        const code = audio.error ? audio.error.code : 0;
        const msg = audio.error ? audio.error.message : 'error';
        logEvent(`error ${code} ${msg}`);
        setNotice(`Playback failed (code ${code})`);
      };
      logEvent(`audio volume ${audio.volume}, muted ${audio.muted}`);
      try {
        await audio.play();
        logEvent('play() resolved');
      } catch (e) {
        const m = e && e.name ? `${e.name}: ${e.message}` : 'error';
        logEvent(`play() rejected: ${m}`);
        setNotice('Click Play again to start audio.');
      }
      setTimeout(() => {
        logEvent(`1 s later: paused=${audio.paused}, currentTime=${audio.currentTime.toFixed(2)}, readyState=${audio.readyState}`);
      }, 1000);
    } catch (e) {
      const m = e && e.message ? e.message : 'error';
      setJobError(m);
      logEvent(m);
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

  const chunks = chunkText(text, settings.chunkSize);
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
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    const panel = e.currentTarget.closest('.panel');
    if (panel) e.dataTransfer.setDragImage(panel, 16, 16);
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

  const panelClass = (id, extra) =>
    'panel ' + extra + (dragId === id ? ' dragging' : '') + (drop && drop.id === id ? ' drop-' + drop.side : '');

  const stateWord = {
    idle: 'Idle',
    generating: 'Generating',
    waiting_reset: 'Waiting for daily reset',
    error: 'Error',
    done: 'Done',
    cancelled: 'Cancelled',
  }[schedState.state] || 'Idle';

  return (
    <div className="app">
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
        <button className="settings-btn" onClick={() => setDrawerOpen((o) => !o)}>Settings</button>
      </header>
      <div className={'columns' + (resizing ? ' resizing' : '')} ref={columnsRef} style={{ gridTemplateColumns: columnsTemplate(shown) }}>
        <section className={panelClass('text', 'text-panel')} style={{ gridColumn: order.indexOf('text') * 2 + 1, gridRow: 1 }} onDragOver={onPanelDragOver('text')} onDragLeave={onPanelDragLeave} onDrop={onPanelDrop('text')}>
          <div className="panel-head">
            <span className="grip" role="button" tabIndex={0} draggable="true" title="Drag to move this panel. Keyboard: Alt+Left or Alt+Right." aria-label="Move the Text panel" onDragStart={onGripDragStart('text')} onDragEnd={onGripDragEnd} onKeyDown={onGripKeyDown('text')} />
            <span className="panel-title">Text</span>
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} style={{ fontSize: `${textZoom}%` }} onWheel={(e) => { if (e.ctrlKey) { e.preventDefault(); setTextZoom((z) => Math.min(200, Math.max(60, z + (e.deltaY < 0 ? 10 : -10)))); } }} onKeyDown={(e) => { if (e.ctrlKey && (e.key === '+' || e.key === '=')) { e.preventDefault(); setTextZoom((z) => Math.min(200, z + 10)); } if (e.ctrlKey && e.key === '-') { e.preventDefault(); setTextZoom((z) => Math.max(60, z - 10)); } if (e.ctrlKey && e.key === '0') { e.preventDefault(); setTextZoom(100); } }} />
          <div className="stats">
            <span>{plural(stats.characters, 'character')}</span>
            <span>{plural(stats.pages, 'page')} (about)</span>
            <span>{plural(stats.chunks, 'chunk')}</span>
            <span>{plural(stats.requestsNeeded, 'request')} needed</span>
            <span>{stats.fitsToday ? 'Fits today' : `Needs ${stats.daysNeeded} days`}</span>
          </div>
          <div className="row">
            <button onClick={handleClearText}>Clear</button>
            <button onClick={handleStart} disabled={!canStart}>Start Reading</button>
            <button disabled title="File loading comes later.">Load file</button>
          </div>
          {startReason ? <div className="reason">{startReason}</div> : null}
          <div className="privacy">Your text is sent to OpenRouter and Fish Audio to make the speech.</div>
          {notice ? <div className="notice">{notice}</div> : null}
        </section>
        <section className={panelClass('reader', 'reader-panel')} style={{ gridColumn: order.indexOf('reader') * 2 + 1, gridRow: 1 }} onDragOver={onPanelDragOver('reader')} onDragLeave={onPanelDragLeave} onDrop={onPanelDrop('reader')}>
          <div className="panel-head">
            <span className="grip" role="button" tabIndex={0} draggable="true" title="Drag to move this panel. Keyboard: Alt+Left or Alt+Right." aria-label="Move the Reader panel" onDragStart={onGripDragStart('reader')} onDragEnd={onGripDragEnd} onKeyDown={onGripKeyDown('reader')} />
            <span className="panel-title">Reader</span>
          </div>
          <div className="chunk-list">
            {chunks.map((c, i) => {
              const st = schedState.chunks[i] ? schedState.chunks[i].status : 'queued';
              const err = schedState.chunks[i] ? schedState.chunks[i].error : null;
              return (
                <div key={i} className={`chunk-row ${st}`}>
                  <div className="chunk-head">
                    <span className={`badge ${st}`}>{st}</span>
                    <span className="chunk-num">#{i + 1}</span>
                    <span className="chunk-actions">
                      {st === 'failed' ? <button onClick={() => handleRetry(i)}>Retry</button> : null}
                      {playingChunk === i ? <button onClick={() => { if (audioRef.current) audioRef.current.pause(); setPlayingChunk(null); }}>Pause</button> : <button disabled={st !== 'ready'} onClick={() => playChunk(i)}>Play</button>}
                    </span>
                  </div>
                  <div className="chunk-preview">{c.slice(0, 400)}</div>
                  {err ? <div className="err">{err.message}</div> : null}
                </div>
              );
            })}
          </div>
        </section>
        <section className={panelClass('job', 'job-panel')} style={{ gridColumn: order.indexOf('job') * 2 + 1, gridRow: 1 }} onDragOver={onPanelDragOver('job')} onDragLeave={onPanelDragLeave} onDrop={onPanelDrop('job')}>
          <div className="panel-head">
            <span className="grip" role="button" tabIndex={0} draggable="true" title="Drag to move this panel. Keyboard: Alt+Left or Alt+Right." aria-label="Move the Job panel" onDragStart={onGripDragStart('job')} onDragEnd={onGripDragEnd} onKeyDown={onGripKeyDown('job')} />
            <span className="panel-title">Job</span>
          </div>
          <div className="state">{stateWord}{schedState.state === 'idle' && schedState.chunks.some((c) => c.status === 'ready') ? ' - window filled' : ''}</div>
          <div>Chunks ready {schedState.chunks.filter((c) => c.status === 'ready').length} / {chunks.length}</div>
          <div className="progress"><div className="bar" style={{ width: chunks.length ? `${(schedState.chunks.filter((c) => c.status === 'ready').length / chunks.length) * 100}%` : '0%' }} /></div>
          <div>Requests today: {usedToday}</div>
          {schedState.state === 'waiting_reset' ? <div>Reset: {new Date(schedState.resetAt).toLocaleString()}<br />Audio already made is kept.</div> : null}
          {jobError ? <div className="notice">{jobError}</div> : null}
          <div className="row">
            <button onClick={handleResume} disabled={!(schedState.state === 'waiting_reset' || schedState.state === 'error')}>Resume</button>
            <button onClick={handleCancel} disabled={schedState.state !== 'generating'}>Cancel</button>
          </div>
        </section>
        <div className="col-handle" role="separator" aria-orientation="vertical" tabIndex={0} aria-label="Resize the left and middle panels" title="Drag to resize. Keyboard: Left or Right arrow, Shift for bigger steps." style={{ gridColumn: 2, gridRow: 1 }} onPointerDown={onHandlePointerDown(0)} onPointerMove={onHandlePointerMove} onPointerUp={onHandlePointerUp} onPointerCancel={onHandlePointerUp} onKeyDown={onHandleKeyDown(0)} />
        <div className="col-handle" role="separator" aria-orientation="vertical" tabIndex={0} aria-label="Resize the middle and right panels" title="Drag to resize. Keyboard: Left or Right arrow, Shift for bigger steps." style={{ gridColumn: 4, gridRow: 1 }} onPointerDown={onHandlePointerDown(1)} onPointerMove={onHandlePointerMove} onPointerUp={onHandlePointerUp} onPointerCancel={onHandlePointerUp} onKeyDown={onHandleKeyDown(1)} />
      </div>
      <footer className="playerbar">
        <button onClick={() => playerEngineRef.current && playerEngineRef.current.prev()} disabled={!playerState.total || playerState.index === 0}><svg viewBox='0 0 24 24' width='20' height='20' fill='currentColor'><path d='M6 6h2v12H6zM9.5 12l8.5 6V6z'/></svg></button>
        {playerState.status === 'playing'
          ? <button className="play-primary play-active" onClick={() => playerEngineRef.current && playerEngineRef.current.pause()}><svg viewBox='0 0 24 24' width='20' height='20' fill='currentColor'><path d='M6 5h4v14H6zM14 5h4v14h-4z'/></svg></button>
          : <button className="play-primary" onClick={() => { if (audioRef.current) { audioRef.current.pause(); if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); } } playerEngineRef.current && playerEngineRef.current.play(); }} disabled={!playerState.total}><svg viewBox='0 0 24 24' width='20' height='20' fill='currentColor'><path d='M8 5v14l11-7z'/></svg></button>}
        <button onClick={() => playerEngineRef.current && playerEngineRef.current.stop()} disabled={!playerState.total}><svg viewBox='0 0 24 24' width='20' height='20' fill='currentColor'><path d='M6 6h12v12H6z'/></svg></button>
        <button onClick={() => playerEngineRef.current && playerEngineRef.current.next()} disabled={!playerState.total || playerState.index >= playerState.total - 1}><svg viewBox='0 0 24 24' width='20' height='20' fill='currentColor'><path d='M6 6l8.5 6L6 18zM16 6h2v12h-2z'/></svg></button>
        <input className="seek" type="range" min="0" max={playerState.duration || 0} step="0.1" value={Math.min(playerState.position, playerState.duration || 0)} onChange={(e) => playerEngineRef.current && playerEngineRef.current.seek(Number(e.target.value))} disabled={!playerState.duration} aria-label="Seek" />
        <select value={playerState.rate} onChange={(e) => playerEngineRef.current && playerEngineRef.current.setRate(Number(e.target.value))} disabled={!playerState.total} aria-label="Playback speed">
          <option value="0.75">0.75x</option>
          <option value="1">1x</option>
          <option value="1.25">1.25x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2x</option>
        </select>
        <input type="range" min="0" max="1" step="0.01" value={playerState.volume} onChange={(e) => playerEngineRef.current && playerEngineRef.current.setVolume(Number(e.target.value))} aria-label="Volume" />
        <span className="now">{playerState.buffering ? `Buffering chunk ${playerState.index + 1}` : `Chunk ${playerState.total ? playerState.index + 1 : 0} / ${playerState.total}`}</span>
      </footer>
      {drawerOpen ? (
        <aside className="drawer">
          <h3>Settings</h3>
          <button onClick={() => setDrawerOpen(false)}>Close</button>
          <label>API key</label>
          <input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="••••••••" />
          <div className="row">
            <button onClick={handleSaveKey}>Save key</button>
            <button onClick={handleClearKey}>Clear key</button>
          </div>
          <div>{keySet ? 'Key set' : 'No key'}</div>
          <label>Voice ({provider.label})</label>
          <input type="text" value={voiceInput} onChange={(e) => setVoiceInput(e.target.value)} />
          <small>{provider.voiceHint}</small>
          <small>Model: {provider.model} - audio: {provider.format}</small>
          <label>Chunk size</label>
          <input type="number" value={chunkInput} onChange={(e) => setChunkInput(e.target.value)} />
          <label>Lookahead</label>
          <input type="number" value={lookInput} onChange={(e) => setLookInput(e.target.value)} />
          <label>Daily limit</label>
          <select value={dailyInput} onChange={(e) => setDailyInput(Number(e.target.value))}>
            <option value={50}>50</option>
            <option value={1000}>1000</option>
          </select>
          <small>1000 needs $10 of lifetime credit purchases on OpenRouter. The app cannot check this.</small>
          <label>Font weight</label>
          <select value={fontInput} onChange={(e) => { setFontInput(e.target.value); document.body.style.fontWeight = e.target.value; }}>
            <option value="100">Thin</option>
            <option value="400">Regular</option>
            <option value="700">Bold</option>
            <option value="800">Extra Bold</option>
          </select>
          <button onClick={handleResetLayout} disabled={isDefaultOrder && isDefaultWidths} title={isDefaultOrder && isDefaultWidths ? 'The panels are already in the default order and size.' : 'Put the panels back in the default order and size.'}>Reset layout</button>
          <button onClick={handleSaveSettings}>Save settings</button>
          <div>Audio cache: {(cacheSize / 1024 / 1024).toFixed(2)} MB</div>
          <button onClick={handleClearCache}>Clear audio cache</button>
        </aside>
      ) : null}
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

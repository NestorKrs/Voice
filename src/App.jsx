import { useState, useEffect, useRef } from 'react';
import { APP_VERSION } from './version.js';
import { loadSettings, saveSettings, loadText, saveText, hasKey, saveKey, clearKey } from './settingsStore.js';
import { computeStats } from './textStats.js';
import { chunkText } from './textPipeline.js';
import { createScheduler } from './scheduler.js';
import { createServices } from './wiring.js';

const storage = typeof localStorage !== 'undefined' ? localStorage : null;
const services = storage ? createServices({ storage }) : null;

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
  const [schedState, setSchedState] = useState({ state: 'idle', resetAt: null, playhead: 0, chunks: [] });
  const [usedToday, setUsedToday] = useState(() => (services ? services.counter.count() : 0));
  const [jobError, setJobError] = useState('');
  const [notice, setNotice] = useState('');
  const [cacheSize, setCacheSize] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [events, setEvents] = useState([]);
  const [showEvents, setShowEvents] = useState(false);
  const audioRef = useRef(null);
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

  const stats = computeStats({ text, chunkSize: settings.chunkSize, usedToday, dailyLimit: settings.dailyLimit });

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
    const chunks = chunkText(text, settings.chunkSize);
    logEvent(`Split into ${chunks.length} chunks`);
    const sched = createScheduler({
      chunks,
      voice: settings.voice,
      lookahead: settings.lookahead,
      cache: services.cache,
      speak: services.speak,
      counter: services.counter,
      makeKey: services.makeKey,
      onChange: (p) => {
        setSchedState((prev) => {
          // detect newly ready
          const prevStatuses = prev.chunks.map((c) => c.status);
          p.chunks.forEach((c, i) => {
            if (c.status === 'ready' && prevStatuses[i] !== 'ready') {
              const key = services.makeKey({ text: chunkText(text, settings.chunkSize)[i], voice: settings.voice });
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
    } catch {
      const m = e && e.message ? e.message : 'error';
      setJobError(m);
      logEvent(m);
    }
  };

  const handleResume = () => {
    logEvent('Resume pressed');
    try {
      if (schedulerRef.current) schedulerRef.current.resume();
    } catch {
      const m = e && e.message ? e.message : 'error';
      setJobError(m);
      logEvent(m);
    }
  };
  const handleCancel = () => {
    logEvent('Cancel pressed');
    try {
      if (schedulerRef.current) schedulerRef.current.cancel();
    } catch {
      const m = e && e.message ? e.message : 'error';
      setJobError(m);
      logEvent(m);
    }
  };
  const handleRetry = (i) => {
    logEvent(`Retry chunk ${i + 1} pressed`);
    try {
      if (schedulerRef.current) schedulerRef.current.retryChunk(i);
    } catch {
      const m = e && e.message ? e.message : 'error';
      setJobError(m);
      logEvent(m);
    }
  };

  const playChunk = async (index) => {
    logEvent(`Play chunk ${index + 1} pressed`);
    if (!services || !schedulerRef.current) return;
    try {
      const chunkList = chunkText(text, settings.chunkSize);
      const key = await services.makeKey({ text: chunkList[index], voice: settings.voice });
      logEvent(`Chunk ${index + 1} requested`);
      const bytes = await services.cache.get(key);
      if (!bytes) {
        logEvent(`Play chunk ${index + 1}: key ${key.slice(0, 8)}, no audio in cache for this chunk`);
        setNotice('Play chunk ' + (index + 1) + ': no audio in cache for this chunk');
        return;
      }
      logEvent(`Play chunk ${index + 1}: key ${key.slice(0, 8)}, ${bytes.byteLength} bytes from cache`);
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
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
      audio.onended = () => { URL.revokeObjectURL(url); setAudioUrl(null); logEvent('ended'); };
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
      } catch {
        const m = e && e.name ? `${e.name}: ${e.message}` : 'error';
        logEvent(`play() rejected: ${m}`);
        setNotice('Click Play again to start audio.');
      }
      setTimeout(() => {
        logEvent(`1 s later: paused=${audio.paused}, currentTime=${audio.currentTime.toFixed(2)}, readyState=${audio.readyState}`);
      }, 1000);
    } catch {
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
    } catch {
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
    } catch {
      const m = e && e.message ? e.message : 'error';
      setJobError(m);
      logEvent(m);
    }
  };
  const handleSaveSettings = () => {
    logEvent('Save settings pressed');
    try {
      if (!storage) return;
      const next = { voice: voiceInput, chunkSize: Number(chunkInput), lookahead: Number(lookInput), dailyLimit: Number(dailyInput) };
      saveSettings(storage, next);
      const loaded = loadSettings(storage);
      setSettings(loaded);
      setUsedToday(services ? services.counter.count() : 0);
      setNotice('Settings saved.');
    } catch {
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
    } catch {
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
    } catch {
      const m = e && e.message ? e.message : 'error';
      setJobError(m);
      logEvent(m);
    }
  };

  const chunks = chunkText(text, settings.chunkSize);
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
        <span className="requests" title={services ? new Date(services.counter.resetAt()).toLocaleString() : ''}>
          Requests today: {usedToday} / {settings.dailyLimit} (estimate)
        </span>
        <button className="settings-btn" onClick={() => setDrawerOpen((o) => !o)}>Settings</button>
      </header>
      <div className="columns">
        <section className="panel text-panel">
          <textarea value={text} onChange={(e) => setText(e.target.value)} />
          <div className="stats">
            <span>{stats.characters} characters</span>
            <span>{stats.pages} pages (about)</span>
            <span>{stats.chunks} chunks</span>
            <span>{stats.requestsNeeded} requests needed</span>
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
        <section className="panel reader-panel">
          <div className="chunk-list">
            {chunks.map((c, i) => {
              const st = schedState.chunks[i] ? schedState.chunks[i].status : 'queued';
              const err = schedState.chunks[i] ? schedState.chunks[i].error : null;
              return (
                <div key={i} className={`chunk-row ${st}`}>
                  <span className="badge">{st}</span>
                  <span className="chunk-num">#{i + 1}</span>
                  <span className="chunk-preview">{c.slice(0, 160)}</span>
                  <button disabled={st !== 'ready'} onClick={() => playChunk(i)}>Play</button>
                  {err ? <span className="err">{err.message}</span> : null}
                  {st === 'failed' ? <button onClick={() => handleRetry(i)}>Retry</button> : null}
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel job-panel">
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
      </div>
      {drawerOpen ? (
        <aside className="drawer">
          <h3>Settings</h3>
          <button onClick={() => setDrawerOpen(false)}>Close</button>
          <label>API key</label>
          <input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} />
          <div className="row">
            <button onClick={handleSaveKey}>Save key</button>
            <button onClick={handleClearKey}>Clear key</button>
          </div>
          <div>{keySet ? 'Key set' : 'No key'}</div>
          <label>Voice ID</label>
          <input type="text" value={voiceInput} onChange={(e) => setVoiceInput(e.target.value)} />
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
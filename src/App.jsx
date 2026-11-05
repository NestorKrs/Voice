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
  const [settings, setSettings] = useState(() => (storage ? loadSettings(storage) : { voice: '', chunkSize: 2000, lookahead: 2 }));
  const [keySet, setKeySet] = useState(() => (storage ? hasKey(storage) : false));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [voiceInput, setVoiceInput] = useState(settings.voice);
  const [chunkInput, setChunkInput] = useState(settings.chunkSize);
  const [lookInput, setLookInput] = useState(settings.lookahead);
  const [schedState, setSchedState] = useState({ state: 'idle', resetAt: null, playhead: 0, chunks: [] });
  const [usedToday, setUsedToday] = useState(() => (services ? services.counter.count() : 0));
  const [jobError, setJobError] = useState('');
  const [notice, setNotice] = useState('');
  const [cacheSize, setCacheSize] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const audioRef = useRef(null);
  const schedulerRef = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (storage) {
        saveText(storage, text);
      }
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [text]);

  useEffect(() => {
    if (drawerOpen && services) {
      services.cache.totalBytes().then((n) => setCacheSize(n)).catch(() => setCacheSize(0));
    }
  }, [drawerOpen]);

  const stats = computeStats({ text, chunkSize: settings.chunkSize, usedToday });

  const canStart = text.trim() !== '' && keySet && usedToday < 50;
  const startReason = !text.trim()
    ? 'Paste some text first.'
    : !keySet
    ? 'Set an API key in Settings.'
    : usedToday >= 50
    ? 'Daily limit reached.'
    : '';

  const handleStart = async () => {
    if (!services) return;
    if (schedulerRef.current) {
      try { schedulerRef.current.cancel(); } catch (e) {}
    }
    const chunks = chunkText(text, settings.chunkSize);
    const sched = createScheduler({
      chunks,
      voice: settings.voice,
      lookahead: settings.lookahead,
      cache: services.cache,
      speak: services.speak,
      counter: services.counter,
      makeKey: services.makeKey,
      onChange: (p) => {
        setSchedState(p);
        setUsedToday(services.counter.count());
      },
    });
    schedulerRef.current = sched;
    setJobError('');
    try {
      await sched.start();
    } catch (e) {
      setJobError(`Audio cache unavailable: ${e && e.message ? e.message : 'error'}`);
    }
  };

  const handleResume = () => {
    if (schedulerRef.current) schedulerRef.current.resume();
  };
  const handleCancel = () => {
    if (schedulerRef.current) schedulerRef.current.cancel();
  };
  const handleRetry = (i) => {
    if (schedulerRef.current) schedulerRef.current.retryChunk(i);
  };

  const playChunk = async (index) => {
    if (!services || !schedulerRef.current) return;
    const st = schedulerRef.current.getState();
    const key = await services.makeKey({ text: chunkText(text, settings.chunkSize)[index], voice: settings.voice });
    const bytes = await services.cache.get(key);
    if (!bytes) return;
    const blob = new Blob([bytes], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    setAudioUrl(url);
    audio.onended = () => { URL.revokeObjectURL(url); setAudioUrl(null); };
    try {
      await audio.play();
    } catch (e) {
      setNotice('Click Play again to start audio.');
    }
  };

  const handleSaveKey = () => {
    if (!storage) return;
    saveKey(storage, keyInput);
    setKeySet(hasKey(storage));
    setKeyInput('');
    setNotice('Key saved.');
  };
  const handleClearKey = () => {
    if (!storage) return;
    clearKey(storage);
    setKeySet(false);
    setNotice('Key cleared.');
  };
  const handleSaveSettings = () => {
    if (!storage) return;
    const next = { voice: voiceInput, chunkSize: Number(chunkInput), lookahead: Number(lookInput) };
    saveSettings(storage, next);
    const loaded = loadSettings(storage);
    setSettings(loaded);
    setUsedToday(services ? services.counter.count() : 0);
    setNotice('Settings saved.');
  };
  const handleClearCache = async () => {
    if (!services) return;
    try {
      await services.cache.clear();
      const n = await services.cache.totalBytes();
      setCacheSize(n);
      setNotice('Cache cleared.');
    } catch (e) {
      setNotice(`Cache error: ${e && e.message ? e.message : 'error'}`);
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
          Requests today: {usedToday} / 50 (estimate)
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
            <button onClick={() => { setText(''); if (storage) saveText(storage, ''); }}>Clear</button>
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
          <button onClick={handleSaveSettings}>Save settings</button>
          <div>Audio cache: {(cacheSize / 1024 / 1024).toFixed(2)} MB</div>
          <button onClick={handleClearCache}>Clear audio cache</button>
        </aside>
      ) : null}
    </div>
  );
}
import { useState, useEffect, useRef } from 'react';
import { APP_VERSION } from './version.js';
import { loadSettings, saveSettings, loadText, saveText, hasKey, saveKey, clearKey } from './settingsStore.js';
import { computeStats } from './textStats.js';
import { createRequestCounter } from './requestCounter.js';

const storage = typeof localStorage !== 'undefined' ? localStorage : null;
const counter = storage ? createRequestCounter(storage) : null;

export default function App() {
  const [text, setText] = useState(() => (storage ? loadText(storage) : ''));
  const [settings, setSettings] = useState(() => (storage ? loadSettings(storage) : { voice: '', chunkSize: 2000, lookahead: 2 }));
  const [keySet, setKeySet] = useState(() => (storage ? hasKey(storage) : false));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [voiceInput, setVoiceInput] = useState(settings.voice);
  const [chunkInput, setChunkInput] = useState(settings.chunkSize);
  const [lookInput, setLookInput] = useState(settings.lookahead);
  const [stats, setStats] = useState(() => computeStats({ text: storage ? loadText(storage) : '', chunkSize: settings.chunkSize, usedToday: storage ? counter.count() : 0 }));
  const [notice, setNotice] = useState('');

  const timer = useRef(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (storage) {
        saveText(storage, text);
        setStats(computeStats({ text, chunkSize: settings.chunkSize, usedToday: counter ? counter.count() : 0 }));
      }
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [text, settings.chunkSize]);

  const usedToday = storage && counter ? counter.count() : 0;

  const startReason = !text.trim()
    ? 'Paste some text first.'
    : !keySet
    ? 'Set an API key in Settings.'
    : usedToday >= 50
    ? 'Daily limit reached.'
    : 'Reading is not built yet.';

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
    setStats(computeStats({ text, chunkSize: loaded.chunkSize, usedToday }));
    setNotice('Settings saved.');
  };

  return (
    <div className="app">
      <header className="topbar">
        <span className="title">Voice</span>
        <span className="version">v{APP_VERSION}</span>
        <span className="requests" title={storage && counter ? new Date(counter.resetAt()).toLocaleString() : ''}>
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
            <button disabled>Start Reading</button>
            <button disabled title="File loading comes later.">Load file</button>
          </div>
          <div className="reason">{startReason}</div>
          <div className="privacy">Your text is sent to OpenRouter and Fish Audio to make the speech.</div>
          {notice ? <div className="notice">{notice}</div> : null}
        </section>
        <section className="panel job-panel">
          <div className="state">Idle</div>
          <div className="state-text">Nothing started.</div>
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
        </aside>
      ) : null}
    </div>
  );
}
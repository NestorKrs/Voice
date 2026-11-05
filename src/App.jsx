import { APP_VERSION } from './version.js';

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <span className="title">Voice</span>
        <span className="version">v{APP_VERSION}</span>
      </header>
      <main className="placeholder">Setup only. No features yet.</main>
    </div>
  );
}
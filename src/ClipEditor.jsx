import { useEffect, useMemo, useRef, useState } from 'react';
import { buildPeaks, peaksForRange } from './waveformPeaks.js';
import { formatTime } from './clipCuts.js';
import { createClipPlayer } from './clipPlayer.js';
import { fullView, zoomAt, wheelFactor, panByPixels, sampleAtX, xAtSample, ensureVisible, MIN_SPAN, isFullView } from './clipView.js';

export default function ClipEditor({ audio, loading, error, scopeValue, scopeOptions, onScopeChange, chunkTexts = [] }) {
  const rootRef = useRef(null);
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const observerRef = useRef(null);
  const viewRef = useRef(null);
  const dragRef = useRef(null);
  const playerRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [view, setView] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [playPos, setPlayPos] = useState(0);
  const [playStatus, setPlayStatus] = useState('idle');
  const [playbackError, setPlaybackError] = useState('');

  const total = audio ? audio.samples.length : 0;
  const rate = audio ? audio.sampleRate : 0;
  const displayRate = rate || 1;
  const peaks = useMemo(() => (audio ? buildPeaks(audio.samples) : null), [audio]);
  const message = loading ? 'Decoding audio...' : playbackError || error || (total === 0 ? 'No ready chunks to edit yet.' : '');
  const current = view || fullView(total);
  const minSpan = Math.min(total, Math.max(MIN_SPAN, Math.round(rate * 0.4)));
  const nowIndex = audio ? audio.offsets.reduce((last, offset, i) => (offset <= playPos ? i : last), -1) : -1;
  const nowChunk = nowIndex >= 0 ? audio.indexes[nowIndex] : -1;
  const nowText = nowChunk >= 0 && chunkTexts[nowChunk]
    ? chunkTexts[nowChunk].slice(0, 200) + (chunkTexts[nowChunk].length > 200 ? '…' : '')
    : '';

  useEffect(() => {
    const next = audio ? fullView(audio.samples.length) : null;
    viewRef.current = next;
    setView(next);
  }, [audio]);

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
  }, [audio, peaks, total, width, message, view, playPos]);

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
    if (playStatus === 'playing') {
      player.pause();
      setPlayStatus('paused');
    } else if (player.play()) {
      setPlayStatus('playing');
    }
  };

  useEffect(() => {
    const isTyping = (target) => target && (
      target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable
    );
    const onKey = (event) => {
      if (event.code !== 'Space' || isTyping(event.target)) return;
      event.preventDefault();
      if (event.type !== 'keydown' || event.repeat) return;
      togglePlay();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keyup', onKey);
    };
  }, [playStatus]);

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

  const onPointerDown = (event) => {
    if (event.button !== 0 || total === 0) return;
    dragRef.current = { x: event.clientX, startX: event.clientX, moved: 0, id: event.pointerId };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
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
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    setDragging(false);
    if (drag.moved < 4 && event.type === 'pointerup' && playerRef.current && audio) {
      const wrap = wrapRef.current;
      const box = wrap ? wrap.getBoundingClientRect() : null;
      if (box && box.width > 0) {
        const base = viewRef.current || fullView(total);
        const sample = sampleAtX(base, event.clientX - box.left, box.width);
        playerRef.current.seek(sample);
        setPlayPos(sample);
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
          <div
            className={`clip-wave${dragging ? ' dragging' : ''}`}
            ref={wrapRef}
            title="Wheel: zoom. Drag: scroll. Double-click: show all."
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={showAll}
          >
            <canvas ref={canvasRef} />
          </div>
          <div className="clip-times">
            <span>{formatTime(current.start, rate)}</span>
            <div className="clip-tools">
              <button type="button" className="icon-btn" aria-label="Zoom out" title={isFullView(current, total) ? 'Already showing the whole audio' : 'Zoom out'} disabled={isFullView(current, total)} onClick={() => zoomBy(1 / 1.5)}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/></svg></button>
              <button type="button" className="icon-btn" aria-label="Zoom in" title={current.span <= minSpan ? 'Zoomed in to the maximum (' + formatTime(minSpan, rate) + ' visible)' : 'Zoom in'} disabled={current.span <= minSpan} onClick={() => zoomBy(1.5)}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5v14"/></svg></button>
              <span className="clip-visible">Visible {formatTime(current.span, rate)}</span>
            </div>
            <span>{formatTime(total - (current.start + current.span), rate)}</span>
          </div>
        </>
      )}
      <div className="clip-transport">
        <button
          type="button"
          className="icon-btn"
          aria-label={playStatus === 'playing' ? 'Pause' : 'Play'}
          title={!audio ? 'No audio loaded' : (playStatus === 'playing' ? 'Pause' : 'Play')}
          disabled={!audio}
          onClick={togglePlay}
        >
          {playStatus === 'playing'
            ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5v14M15 5v14"/></svg>
            : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 5l11 7-11 7z"/></svg>}
        </button>
        <span className="clip-time">{formatTime(playPos, displayRate)} / {formatTime(total, displayRate)}</span>
      </div>
      <div className="clip-now">
        {audio && nowIndex >= 0 ? (
          <>
            <div>{'Chunk ' + (audio.indexes[nowIndex] + 1) + ' of ' + audio.offsets.length}</div>
            {nowText ? <div>{nowText}</div> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

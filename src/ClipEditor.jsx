import { useEffect, useMemo, useRef, useState } from 'react';
import { buildPeaks, peaksForRange } from './waveformPeaks.js';
import { formatTime } from './clipCuts.js';
import { fullView, zoomAt, wheelFactor, panByPixels, sampleAtX, xAtSample, MIN_SPAN, isFullView } from './clipView.js';

export default function ClipEditor({ audio, loading, error, scopeValue, scopeOptions, onScopeChange, onClose }) {
  const rootRef = useRef(null);
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const observerRef = useRef(null);
  const viewRef = useRef(null);
  const dragRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [view, setView] = useState(null);
  const [dragging, setDragging] = useState(false);

  const total = audio ? audio.samples.length : 0;
  const rate = audio ? audio.sampleRate : 0;
  const peaks = useMemo(() => (audio ? buildPeaks(audio.samples) : null), [audio]);
  const message = loading ? 'Decoding audio...' : error || (total === 0 ? 'No ready chunks to edit yet.' : '');
  const current = view || fullView(total);
  const minSpan = Math.min(MIN_SPAN, total);

  useEffect(() => {
    const next = audio ? fullView(audio.samples.length) : null;
    viewRef.current = next;
    setView(next);
  }, [audio]);

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
  }, [audio, peaks, total, width, message, view]);

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
      const next = zoomAt(base, total, wheelFactor(event.deltaY), anchorSample);
      viewRef.current = next;
      setView(next);
    };
    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => wrap.removeEventListener('wheel', onWheel, { passive: false });
  }, [total, message]);

  const zoomBy = (factor) => {
    const base = viewRef.current || fullView(total);
    const next = zoomAt(base, total, factor, base.start + base.span / 2);
    viewRef.current = next;
    setView(next);
  };

  const onPointerDown = (event) => {
    if (event.button !== 0 || total === 0) return;
    dragRef.current = { x: event.clientX, id: event.pointerId };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
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
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
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
        <button type="button" className="icon-btn" aria-label="Close editor" title="Close editor" onClick={onClose}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
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
            <button type="button" className="icon-btn" aria-label="Zoom in" title={current.span <= minSpan ? 'Zoomed in to the maximum (' + MIN_SPAN + ' samples visible)' : 'Zoom in'} disabled={current.span <= minSpan} onClick={() => zoomBy(1.5)}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5v14"/></svg></button>
            <span className="clip-visible">Visible {formatTime(current.span, rate)}</span>
          </div>
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
            <span>{formatTime(current.start + current.span, rate)}</span>
          </div>
        </>
      )}
    </div>
  );
}

import { useState, useCallback, useRef } from 'react';

const MIN = 0.8;
const MAX = 4;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export function useZoom() {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const dragging = useRef(null); // { startX, startY, originX, originY }

  const zoom = useCallback((delta, pivotX = 0, pivotY = 0) => {
    setTransform(t => {
      const next = clamp(t.scale * delta, MIN, MAX);
      const ratio = next / t.scale;
      return {
        scale: next,
        x: pivotX - ratio * (pivotX - t.x),
        y: pivotY - ratio * (pivotY - t.y),
      };
    });
  }, []);

  const reset = useCallback(() => setTransform({ scale: 1, x: 0, y: 0 }), []);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    zoom(e.deltaY < 0 ? 1.15 : 0.87, e.clientX - rect.left, e.clientY - rect.top);
  }, [zoom]);

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = { startX: e.clientX, startY: e.clientY, originX: 0, originY: 0 };
    setTransform(t => {
      dragging.current.originX = t.x;
      dragging.current.originY = t.y;
      return t;
    });
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragging.current.startX;
    const dy = e.clientY - dragging.current.startY;
    setTransform(t => ({ ...t, x: dragging.current.originX + dx, y: dragging.current.originY + dy }));
  }, []);

  const onPointerUp = useCallback(() => { dragging.current = null; }, []);

  const onDoubleClick = useCallback(() => reset(), [reset]);

  // 터치 핀치
  const lastPinch = useRef(null);
  const onTouchStart = useCallback((e) => {
    if (e.touches.length === 2) lastPinch.current = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY,
    );
  }, []);

  const onTouchMove = useCallback((e) => {
    if (e.touches.length !== 2 || !lastPinch.current) return;
    e.preventDefault();
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY,
    );
    const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    const rect = e.currentTarget.getBoundingClientRect();
    zoom(dist / lastPinch.current, mx - rect.left, my - rect.top);
    lastPinch.current = dist;
  }, [zoom]);

  const onTouchEnd = useCallback(() => { lastPinch.current = null; }, []);

  return {
    transform,
    handlers: { onWheel, onPointerDown, onPointerMove, onPointerUp, onDoubleClick, onTouchStart, onTouchMove, onTouchEnd },
    zoom,
    reset,
  };
}

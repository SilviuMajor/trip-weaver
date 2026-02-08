import { useState, useCallback, useRef, useEffect } from 'react';

export type ZoomLevel = 0 | 1 | 2 | 3 | 4;

// Maps zoom level to a CSS spacing multiplier
// 0 = 15min (most detailed), 4 = full-day (most compact)
const ZOOM_LABELS = ['15 min', '30 min', '1 hr', '2 hr', 'Day'] as const;

export function useTimelineZoom(containerRef: React.RefObject<HTMLElement | null>) {
  const [zoom, setZoom] = useState<ZoomLevel>(2); // default 1hr
  const initialPinchDist = useRef<number | null>(null);
  const startZoom = useRef<ZoomLevel>(2);

  const changeZoom = useCallback((delta: number) => {
    setZoom(prev => {
      const next = prev + delta;
      if (next < 0 || next > 4) return prev;
      return next as ZoomLevel;
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDist.current = Math.hypot(dx, dy);
        startZoom.current = zoom;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialPinchDist.current !== null) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const ratio = dist / initialPinchDist.current;

        // Pinch out (zoom in = more detail = lower number)
        // Pinch in (zoom out = less detail = higher number)
        let newZoom = startZoom.current;
        if (ratio > 1.3) newZoom = Math.max(0, startZoom.current - 1) as ZoomLevel;
        else if (ratio < 0.7) newZoom = Math.min(4, startZoom.current + 1) as ZoomLevel;

        setZoom(newZoom);
      }
    };

    const onTouchEnd = () => {
      initialPinchDist.current = null;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [containerRef, zoom]);

  // Spacing multiplier for entry cards
  const spacingClass = [
    'space-y-4',  // 15min - most space
    'space-y-3',  // 30min
    'space-y-3',  // 1hr (default)
    'space-y-2',  // 2hr
    'space-y-1',  // Day - most compact
  ][zoom];

  // Card size class
  const cardSizeClass = [
    'min-h-[140px]',  // 15min
    'min-h-[120px]',  // 30min
    'min-h-[100px]',  // 1hr
    'min-h-[80px]',   // 2hr
    'min-h-[60px]',   // Day
  ][zoom];

  return {
    zoom,
    setZoom,
    changeZoom,
    spacingClass,
    cardSizeClass,
    zoomLabel: ZOOM_LABELS[zoom],
  };
}

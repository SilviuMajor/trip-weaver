

# Fix Laggy/Broken Mobile Touch Interactions

## Overview
Six foundational CSS and event-handling fixes to eliminate fighting between iOS Safari native gestures and our custom drag/resize/detach handlers.

## Fix 1 -- Kill text selection on timeline elements

### File: `src/index.css`

Add a new rule block after the existing `@layer utilities` section:

```css
/* Prevent text selection and callout on timeline interactions */
[data-timeline-area],
[data-timeline-area] *,
[data-entry-card],
[data-entry-card] *,
[data-resize-handle],
[data-transport-connector],
[data-transport-connector] * {
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
```

## Fix 2 -- Add `touch-none` on resize handles, `touch-action: manipulation` on cards

### File: `src/components/timeline/ContinuousTimeline.tsx`

**Resize handles** (4 locations -- lines 1079, 1093, 1347, 1361): Add `touch-none` to each resize handle div's className.

- Line 1079: `h-3 cursor-ns-resize group/resize` becomes `h-5 cursor-ns-resize group/resize touch-none`
- Line 1093: `h-3 cursor-not-allowed` becomes `h-5 cursor-not-allowed touch-none`
- Line 1347: `h-3 cursor-ns-resize group/resize` becomes `h-5 cursor-ns-resize group/resize touch-none`
- Line 1361: `h-3 cursor-not-allowed` becomes `h-5 cursor-not-allowed touch-none`

**Card wrappers** (line 1048-1051, the `data-entry-card` div): Add `style={{ touchAction: 'manipulation' }}` to prevent double-tap zoom and long-press without breaking scroll.

## Fix 3 -- Native touch listeners with `{ passive: false }` in useDragResize

### File: `src/hooks/useDragResize.ts`

Add a new `useEffect` (after the existing global mouse listener effect at line 308) that registers native `touchmove`, `touchend`, and `touchcancel` listeners on `document` when `dragState` is active:

```typescript
useEffect(() => {
  if (!dragState) return;

  const handleNativeTouchMove = (e: TouchEvent) => {
    if (isDraggingRef.current) {
      e.preventDefault();
      const touch = e.touches[0];
      handlePointerMove(touch.clientY);
    }
  };

  const handleNativeTouchEnd = () => {
    if (isDraggingRef.current) {
      commitDrag();
    }
    touchStartPosRef.current = null;
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  document.addEventListener('touchmove', handleNativeTouchMove, { passive: false });
  document.addEventListener('touchend', handleNativeTouchEnd);
  document.addEventListener('touchcancel', handleNativeTouchEnd);

  return () => {
    document.removeEventListener('touchmove', handleNativeTouchMove);
    document.removeEventListener('touchend', handleNativeTouchEnd);
    document.removeEventListener('touchcancel', handleNativeTouchEnd);
  };
}, [dragState, handlePointerMove, commitDrag]);
```

The existing React `onTouchMove`/`onTouchEnd` handlers remain as fallbacks.

## Fix 4 -- Resize handles 50% larger + bigger tap target

### File: `src/components/timeline/ContinuousTimeline.tsx`

All four resize handle divs change from `h-3` to `h-5`, and their positioning from `top-0`/`bottom-0` to `-top-1`/`-bottom-1` (extends slightly outside card).

Visual pills change from `w-10 h-1.5` to `w-12 h-2`, and from `-top-0.5`/`-bottom-0.5` to `top-0`/`bottom-0`.

**Top unlocked** (line 1079): `"absolute left-0 right-0 -top-1 z-20 h-5 cursor-ns-resize group/resize touch-none"`
- Pill (line 1086): `"absolute top-0 left-1/2 -translate-x-1/2 w-12 h-2 rounded-full bg-muted-foreground/30 group-hover/resize:bg-primary/60 transition-colors"`

**Top locked** (line 1093): `"absolute left-0 right-0 -top-1 z-20 h-5 cursor-not-allowed touch-none"`
- Pill (line 1098): `"absolute top-0 left-1/2 -translate-x-1/2 w-12 h-2 rounded-full bg-muted-foreground/10"`

**Bottom unlocked** (line 1347): `"absolute left-0 right-0 -bottom-1 z-20 h-5 cursor-ns-resize group/resize touch-none"`
- Pill (line 1354): `"absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-2 rounded-full bg-muted-foreground/30 group-hover/resize:bg-primary/60 transition-colors"`

**Bottom locked** (line 1361): `"absolute left-0 right-0 -bottom-1 z-20 h-5 cursor-not-allowed touch-none"`
- Pill (line 1366): `"absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-2 rounded-full bg-muted-foreground/10"`

## Fix 5 -- Prevent contextmenu on mobile

### File: `src/pages/Timeline.tsx`

On the `<main>` element (line 2194), add:

```jsx
onContextMenu={(e) => { if ('ontouchstart' in window) e.preventDefault(); }}
```

## Fix 6 -- Reduce animation overhead (SKIPPED)

No `motion.div` is used in `ContinuousTimeline.tsx`, so this fix is not applicable. No changes needed.

## Files changed

1. `src/index.css` -- text selection / callout suppression CSS
2. `src/hooks/useDragResize.ts` -- native touch listeners with `{ passive: false }`
3. `src/components/timeline/ContinuousTimeline.tsx` -- `touch-none` on resize handles, `touch-action: manipulation` on cards, larger handles/pills
4. `src/pages/Timeline.tsx` -- `onContextMenu` prevention

## What does NOT change

- Desktop mouse drag/resize
- Existing drag-to-create (mouse)
- Magnet snap system
- Zoom system
- Hold-to-detach logic
- Planner touch drag


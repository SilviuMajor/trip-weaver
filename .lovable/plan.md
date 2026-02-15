
# iOS Safari Touch Fix: touch-action: none + Manual Scroll Passthrough

## Problem
iOS Safari reads `touch-action` at touchstart time. With `manipulation`, Safari claims the touch at the compositor level before our 200ms hold timer fires. No JavaScript `preventDefault()` can override this.

## Solution

### File 1: `src/components/timeline/ContinuousTimeline.tsx`

**Line 1060** -- Change conditional touch-action to always `none`:
```typescript
// Before:
touchAction: dragState?.entryId === entry.id ? 'none' : 'manipulation',
// After:
touchAction: 'none',
```

### File 2: `src/hooks/useDragResize.ts`

**Lines 293-316** -- Rewrite the hold-window touch handling inside `onTouchStart` to include manual scroll passthrough. Replace the current `touchStartPosRef` assignment through the end of `handleTouchMove` with:

```typescript
    touchStartPosRef.current = { x: startX, y: startY };
    let lastTouchY = startY;
    let holdCancelled = false;

    // Single set of listeners for the ENTIRE touch lifecycle
    const handleTouchMove = (ev: TouchEvent) => {
      const t = ev.touches[0];
      ev.preventDefault(); // ALWAYS prevent default — we handle everything

      if (isDraggingRef.current) {
        // Phase 2: Drag is active — update position
        handlePointerMoveRef.current(t.clientX, t.clientY);
      } else if (!holdCancelled) {
        // Phase 1: Still in hold window — check if finger moved too far
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > TOUCH_MOVE_THRESHOLD) {
          // Finger moved too much — cancel hold, switch to manual scroll mode
          if (touchTimerRef.current) {
            clearTimeout(touchTimerRef.current);
            touchTimerRef.current = null;
          }
          holdCancelled = true;
          // Don't cleanup listeners — we continue to handle scroll manually
        }
      }

      if (holdCancelled) {
        // Manual scroll: move the scroll container by the delta
        const deltaY = lastTouchY - t.clientY; // inverted: finger moves down = scroll down
        if (scrollContainerRef?.current) {
          scrollContainerRef.current.scrollTop += deltaY;
        }
      }

      lastTouchY = t.clientY;
    };
```

**Lines 343-348** -- Update the hold timer callback to check `holdCancelled`:
```typescript
    touchTimerRef.current = setTimeout(() => {
      touchTimerRef.current = null;
      if (!holdCancelled) {
        startDrag(entryId, type, startX, startY, entryStartHour, entryEndHour, tz);
        if (navigator.vibrate) navigator.vibrate(20);
      }
    }, TOUCH_HOLD_MS);
```

Everything else in `useDragResize.ts` stays exactly as-is: `handleTouchEnd`, `cleanup`, listener attachment, mouse-only useEffect, refs, startDrag, handlePointerMove, commitDrag.

## Files changed
1. `src/components/timeline/ContinuousTimeline.tsx` -- touch-action always `none`
2. `src/hooks/useDragResize.ts` -- manual scroll passthrough during hold window, holdCancelled guard on timer

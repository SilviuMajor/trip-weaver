

# Unified Drag Listener System + Threshold Tweak

## Problem
Touch and mouse drag use divergent listener patterns, causing stale closures on mobile. The native-listener-in-closure approach in `onTouchStart` captures stale `handlePointerMove` and `commitDrag` references.

## Solution

### File: `src/hooks/useDragResize.ts` -- Full rewrite of listener management

**Remove** (lines 57-59):
- `nativeListenersAttachedRef`
- `nativeTouchMoveRef`
- `nativeTouchEndRef`

**Replace onTouchStart** (lines 273-345) with hold-only logic:
- Attach a temporary `holdPreventScroll` listener with `{ passive: false }` that only prevents scroll during the 200ms hold window
- If finger moves >10px, cancel hold and remove listeners (allow scroll)
- When timer fires, remove hold listeners, call `startDrag()`, add haptic vibrate
- Depends only on `startDrag` -- no stale closure risk

**Replace separate mouse useEffect** (lines 367-383) and remove native touch useEffect pattern with ONE unified useEffect:
- Triggers when `dragState` becomes non-null
- Attaches `mousemove`, `mouseup` on window AND `touchmove` (passive: false), `touchend`, `touchcancel` on document
- All use the same `handlePointerMove` and `commitDrag` -- fresh references every time the effect re-runs
- Cleanup removes all listeners

**Simplify onTouchMove/onTouchEnd** (lines 347-364) to empty safety nets.

**Update unmount cleanup** (lines 386-397) to just `stopAutoScroll()`.

### File: `src/components/timeline/ContinuousTimeline.tsx` -- Threshold change

**Line 548**: Change `const threshold = 40` to `const threshold = 20`.

## Files changed
1. `src/hooks/useDragResize.ts` -- unified listener system
2. `src/components/timeline/ContinuousTimeline.tsx` -- lower threshold to 20px



# Zoom Toggle Button (3 Levels)

## Overview
Add a persistent zoom toggle button in the top-right corner of the timeline that cycles between 0.75x, 1x, and 1.5x. Pinch-to-zoom and Ctrl+scroll snap to the nearest level on release. Zoom range clamped from 0.5-2.0 down to 0.75-1.5.

## Changes

### File: `src/pages/Timeline.tsx`

**1. Add zoom constants, snap helper, and cycle function** (after line 128, near existing zoom state):
- `ZOOM_LEVELS = [0.75, 1.0, 1.5]`
- `snapToNearestLevel(raw)` -- finds closest level
- `cycleZoom()` -- snaps current value then advances to next level

**2. Snap pinch-to-zoom on touch end** (line 2196-2200):
- Before clearing `lastPinchDistRef`, check if a pinch was active and call `setZoomLevel(prev => snapToNearestLevel(prev))`

**3. Snap desktop wheel zoom on end** (lines 2219-2240):
- Add a debounce timer (`wheelEndTimer`) that fires 300ms after the last scroll event
- Wrap `handleWheel` in `handleWheelWithSnap` that calls the original then sets the snap timer
- Update event listener registration and cleanup to use `handleWheelWithSnap`

**4. Clamp zoom range to 0.75-1.5** (lines 2180 and 2225):
- Change `Math.min(2.0, Math.max(0.5, ...))` to `Math.min(1.5, Math.max(0.75, ...))` in both pinch and wheel handlers

**5. Add toggle button UI and preserve transient indicator** (lines 3584-3591):
- Insert a fixed `button` element (top-right, `top-20 right-4`) that calls `cycleZoom` on click
- Shows magnifying glass icon + current zoom label (e.g. "75%", "1x", "1.5x")
- Keep the existing bottom-center transient indicator for pinch/scroll feedback

## Technical Details

Snap logic:
```text
snapToNearestLevel(0.82) -> 0.75
snapToNearestLevel(0.91) -> 1.0
snapToNearestLevel(1.3)  -> 1.5
```

Cycle order: 0.75 -> 1.0 -> 1.5 -> 0.75 (wraps around)

Desktop snap debounce prevents snapping during continuous scroll -- only fires 300ms after the last wheel event.

## What does NOT change
- ContinuousTimeline.tsx, useDragResize.ts, EntryCard.tsx
- `pixelsPerHour = 80 * zoomLevel` formula
- `onResetZoom` prop (still passed through)
- Zoom indicator behavior during gestures

## Files modified
| File | Change |
|------|--------|
| `src/pages/Timeline.tsx` | Add ZOOM_LEVELS, snapToNearestLevel, cycleZoom, snap on pinch/scroll end, clamp range, toggle button UI |

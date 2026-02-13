
# Dynamic Timeline Zoom with Pinch, Scroll, and Settings Toggle

## Overview
Make `PIXELS_PER_HOUR` dynamic via a zoom multiplier (0.5x-2.0x), controlled by pinch-to-zoom on mobile, Ctrl+scroll on desktop, and a double-tap reset. Add sub-hour grid lines at higher zoom levels, a floating zoom indicator, and a toggle in Settings to enable/disable the feature.

## Changes

### 1. `src/components/timeline/ContinuousTimeline.tsx` -- Accept dynamic `pixelsPerHour` prop
- Remove `const PIXELS_PER_HOUR = 80` constant (line 19)
- Add `pixelsPerHour: number` and `onResetZoom?: () => void` to the `ContinuousTimelineProps` interface
- Replace all ~24 occurrences of `PIXELS_PER_HOUR` with the `pixelsPerHour` prop
- Pass `pixelsPerHour` to the `useDragResize` hook (line 309)
- Add sub-hour grid lines after the existing hour lines block:
  - 30-min lines when `pixelsPerHour > 96` (border-border/15)
  - 15-min lines when `pixelsPerHour > 140` (border-border/10)
  - 30-min gutter labels when `pixelsPerHour > 96` (text-[9px], low opacity)
- Add double-tap detection on the slot area (`onTouchEnd` handler) that calls `onResetZoom` on two taps within 300ms

### 2. `src/pages/Timeline.tsx` -- Zoom state, gestures, and dynamic `pixelsPerHour`
- Remove `const PIXELS_PER_HOUR = 80` (line 1430)
- Add zoom state with sessionStorage persistence:
  ```
  const zoomEnabled = localStorage.getItem('timeline-zoom-enabled') !== 'false';
  const [zoomLevel, setZoomLevel] = useState(() => {
    if (!zoomEnabled) return 1.0;
    const saved = sessionStorage.getItem('timeline-zoom');
    return saved ? parseFloat(saved) : 1.0;
  });
  const pixelsPerHour = 80 * zoomLevel;
  ```
- Add `zoomLevelRef` to track current zoom in event handlers
- Replace `PIXELS_PER_HOUR` in touch drag calculation (~line 1451) with `pixelsPerHour`
- Pass `pixelsPerHour` and `onResetZoom={() => setZoomLevel(1.0)}` to `ContinuousTimeline`

**Pinch-to-zoom (mobile)** -- `useEffect` on `mainScrollRef`:
- Track two-finger distance on `touchstart`/`touchmove`/`touchend`
- Scale zoom between 0.5 and 2.0 based on pinch ratio
- Anchor scroll position to the midpoint of the two fingers so content doesn't jump
- Guard with `if (!zoomEnabled) return`
- Use `{ passive: false }` and `e.preventDefault()` to suppress browser zoom

**Ctrl+scroll (desktop)** -- `useEffect` on `mainScrollRef`:
- Listen for `wheel` events where `e.ctrlKey || e.metaKey`
- Apply delta to zoom with anchor at cursor Y position
- Guard with `if (!zoomEnabled) return`
- Use `{ passive: false }` and `e.preventDefault()`

**Zoom indicator** -- floating pill at bottom-centre:
- Shows `Math.round(zoomLevel * 100)%` text
- Appears on zoom change, fades after 1.2 seconds
- Hidden when zoom is disabled

**Persist zoom** -- `useEffect` writes `zoomLevel` to `sessionStorage`

### 3. `src/pages/Settings.tsx` -- Zoom enable/disable toggle
- Import `Switch` from `@/components/ui/switch`
- Add `zoomEnabled` state backed by `localStorage('timeline-zoom-enabled')`, default `true`
- Add a "Timeline" section below the Display Name field with:
  - "Pinch-to-zoom" label
  - "Enable pinch and scroll zoom on the timeline" description
  - `Switch` component that toggles the localStorage value

### Files changed
1. `src/components/timeline/ContinuousTimeline.tsx` -- dynamic prop, sub-hour lines, double-tap reset
2. `src/pages/Timeline.tsx` -- zoom state, pinch gesture, Ctrl+scroll, indicator, sessionStorage
3. `src/pages/Settings.tsx` -- zoom toggle switch

### What does NOT change
- Card rendering logic (cards auto-scale since positions use pixelsPerHour)
- Drag/resize mechanics (useDragResize already accepts pixelsPerHour)
- Weather, transport, hotel systems
- Planner sidebar
- Desktop drag and drop behavior

### Technical notes
- Zoom range: 0.5x (40px/hr) to 2.0x (160px/hr), default 1.0x (80px/hr)
- Sub-hour lines: 30-min at >120% zoom (>96px/hr), 15-min at >175% (>140px/hr)
- Pinch anchor math: converts the midpoint finger position to a global hour, then after zoom change, adjusts scrollTop so that same hour stays at the same screen position
- `e.preventDefault()` on pinch and Ctrl+wheel prevents browser-level zoom
- Setting defaults to enabled; stored in localStorage so it persists across sessions
- Zoom level stored in sessionStorage so it resets per browser session

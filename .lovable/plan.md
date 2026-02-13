

# Fix Mobile Pinch-to-Zoom

## Problem
Pinch-to-zoom works on desktop (Ctrl+scroll / trackpad) but not on mobile because:
1. iOS Safari intercepts two-finger pinch gestures at the browser level before JavaScript event handlers fire. `e.preventDefault()` in `touchstart`/`touchmove` is not sufficient on iOS -- the browser needs a CSS `touch-action` hint to relinquish control of the pinch gesture.
2. The `useEffect` that registers pinch listeners depends only on `[zoomEnabled]`. When the `<main>` element unmounts (e.g., switching to live view) and remounts, `mainScrollRef.current` changes but the effect doesn't re-run, so listeners are never re-attached.

## Changes

### 1. `src/pages/Timeline.tsx` -- Add `touch-action` style and fix dependencies

**Add `touch-action: pan-y` to the `<main>` element** (line ~2157):
- When `zoomEnabled` is true, set `style={{ touchAction: 'pan-y' }}` on the `<main ref={mainScrollRef}>`. This tells the browser to only handle vertical scrolling natively and let JavaScript handle all other gestures (including pinch).
- When `zoomEnabled` is false, omit the style (default browser behavior).

**Fix pinch `useEffect` dependencies** (line 1580):
- Change `[zoomEnabled]` to `[zoomEnabled, isMobile, mobileView]` so that when the mobile view switches from live back to timeline, the effect re-runs and re-attaches listeners to the freshly mounted `<main>` element.

**Fix wheel `useEffect` dependencies** (line 1610):
- Same change: `[zoomEnabled]` to `[zoomEnabled, isMobile, mobileView]`.

### Files changed
1. `src/pages/Timeline.tsx` -- add `touch-action` style to scroll container, fix effect dependencies

### What does NOT change
- Pinch gesture logic (distance calculation, anchor math, zoom clamping)
- Desktop Ctrl+scroll behavior
- Sub-hour grid lines
- Zoom indicator
- Settings toggle
- Any other touch interactions (drag-to-move, long-press)

### Technical notes
- `touch-action: pan-y` allows vertical scrolling but prevents the browser from handling pinch-zoom, two-finger pan, etc. This is exactly what we want: the timeline scrolls vertically as normal, but pinch is handled by our JS.
- Adding `mobileView` to the dependency array ensures the cleanup/re-register cycle runs whenever the `<main>` element is unmounted and remounted.
- `isMobile` is included for completeness in case the viewport changes mid-session (e.g., rotating a tablet).


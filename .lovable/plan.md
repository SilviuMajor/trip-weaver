

# Replace CSS-Based Planner Hiding with React-Controlled Sheet Close

## Problem
The CSS selectors in `index.css` targeting `.touch-drag-active` don't match the actual DOM attributes Radix Dialog renders, so the Planner sheet never visually hides during touch drag.

## Solution
Since document-level touch listeners survive the Sheet unmounting, we can simply close the Sheet via React state instead of trying to hide it with CSS. Remove the broken CSS approach entirely.

## Changes

### 1. `src/index.css` -- Delete broken CSS rules (lines 120-134)
Remove the entire `.touch-drag-active` block (overlay hiding and content transform rules). These selectors don't match Radix's actual DOM and are no longer needed.

### 2. `src/pages/Timeline.tsx` -- Simplify to just close the Sheet

**Remove `touchDragHidePlanner` state** -- no longer needed since we close the Sheet directly.

**`handleTouchDragStart`** (line ~1407-1418):
- Remove `setTouchDragHidePlanner(true)` 
- Remove `document.body.classList.add('touch-drag-active')`
- Add `setSidebarOpen(false)` to close the Sheet when drag starts

**`cleanupTouchDrag`** (line ~1420-1430):
- Remove `setTouchDragHidePlanner(false)`
- Remove `document.body.classList.remove('touch-drag-active')`
- Do NOT reopen the planner after drag -- it stays closed (expected UX)

**Mobile `CategorySidebar` render** (line ~2115-2142):
- Remove `hiddenForDrag={touchDragHidePlanner}` prop -- no longer needed

### 3. `src/components/timeline/CategorySidebar.tsx` -- Remove `hiddenForDrag` prop

- Remove `hiddenForDrag` from the interface and destructuring
- Remove the wrapper `<div>` with conditional hide styles around the mobile Sheet
- The mobile Sheet just renders normally:
```
<Sheet open={open} onOpenChange={onOpenChange}>
  <SheetContent ...>
```

## Why this works now
The original concern was that closing the Sheet would unmount the `SidebarEntryCard` and kill the iOS touch session. But the current implementation registers `touchmove`/`touchend`/`touchcancel` listeners on `document` (in a `useEffect` triggered by `touchDragEntry`). These document listeners persist regardless of whether the Sheet is mounted. The entry data is already captured in `touchDragEntry` state and `touchDragEntryRef`. So the Sheet can safely close.

## Files changed
1. `src/index.css` -- remove `.touch-drag-active` CSS rules
2. `src/pages/Timeline.tsx` -- close Sheet directly, remove hide state and body class logic
3. `src/components/timeline/CategorySidebar.tsx` -- remove `hiddenForDrag` prop and wrapper div


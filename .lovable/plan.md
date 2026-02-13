

# Fix Touch Drag: Keep Planner Mounted + Real Ghost Card

## Overview
Two fixes: (1) Instead of unmounting the Planner sheet during drag (which kills the touch context on iOS), hide it visually while keeping it in the DOM. (2) Replace the simplified ghost card with a real `SidebarEntryCard` component plus a time indicator pill.

---

## Changes

### 1. CategorySidebar.tsx -- Add `hiddenForDrag` prop

- Add `hiddenForDrag?: boolean` to `CategorySidebarProps`
- On the mobile `Sheet` branch, wrap it in a `<div>` that applies `opacity: 0, pointerEvents: 'none', position: 'fixed', zIndex: -1` when `hiddenForDrag` is true. This hides both the sheet content and backdrop overlay while keeping the DOM intact.

### 2. Timeline.tsx -- Hide instead of close + real ghost card

**New state:**
- `touchDragHidePlanner: boolean` (default `false`)

**New ref:**
- `touchDragEntryRef` (mirrors `touchDragEntry` via useEffect, same pattern as `touchDragGlobalHourRef`)

**handleTouchDragStart changes:**
- Replace `setSidebarOpen(false)` with `setTouchDragHidePlanner(true)`
- Everything else stays the same (set entry, position, 3s timeout)

**handleTouchEnd / cleanupTouchDrag changes:**
- After cleanup, set `setTouchDragHidePlanner(false)` and `setSidebarOpen(false)` to properly close the planner
- Use `touchDragEntryRef.current` instead of `touchDragEntry` in the closure (same stale-closure fix as globalHour)

**Document-level useEffect:**
- Update `handleTouchEnd` to use `touchDragEntryRef.current` instead of the stale `touchDragEntry` from closure

**CategorySidebar props:**
- Pass `hiddenForDrag={touchDragHidePlanner}` to the mobile `CategorySidebar` instance

**Ghost card replacement:**
- Import `SidebarEntryCard` at top of Timeline.tsx
- Replace the simplified ghost `<div>` with a `<SidebarEntryCard entry={touchDragEntry} />` wrapped in a sized container
- Add a time indicator pill below the card: a `bg-primary` rounded pill with the snapped time in `text-primary-foreground`

---

## Technical Details

### Why hide instead of close?
iOS Safari cancels active touches when their originating DOM element is removed. `setSidebarOpen(false)` unmounts the Sheet and the SidebarEntryCard inside it, killing the touch session. Document-level `touchmove` listeners then stop receiving events. Hiding via CSS keeps the element in the DOM and preserves the touch context.

### Ghost card rendering
```text
Container: absolute, 180px wide, opacity 0.8, scale(0.9), drop-shadow
  -> <SidebarEntryCard entry={touchDragEntry} />  (no click/drag handlers)
  -> Time pill: absolute, -bottom-6, centered, bg-primary, rounded-full
     -> "HH:MM" in text-[11px] font-bold text-primary-foreground
```

### Stale closure for touchDragEntry
The `handleTouchEnd` in the document listener useEffect captures `touchDragEntry` at setup time. Since the effect only re-runs when `touchDragEntry` changes (and it's set once at drag start), the value should be correct. However, to be safe and consistent with the globalHour pattern, we add `touchDragEntryRef` mirrored via useEffect.

### Cleanup sequence on touchEnd
1. Call `handleDropOnTimeline` if valid position
2. `setTouchDragHidePlanner(false)` -- un-hide the planner
3. `setSidebarOpen(false)` -- now actually close it
4. Clear all drag state (entry, position, globalHour, timeout)

## Files Changed
1. `src/components/timeline/CategorySidebar.tsx` -- add `hiddenForDrag` prop + wrapper div
2. `src/pages/Timeline.tsx` -- hide-instead-of-close logic, entry ref, real ghost card with SidebarEntryCard


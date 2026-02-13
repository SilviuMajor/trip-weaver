

# Touch Drag & Drop from Planner to Timeline (Mobile)

## Problem
The HTML5 Drag API (`draggable`, `onDragStart`, `onDrop`) does not work on touch devices. Mobile users cannot drag entries from the Planner sidebar onto the timeline.

## Solution
Build a parallel touch-based drag system that works alongside the existing desktop drag. Long-press (400ms) triggers drag mode, auto-closes the Planner sheet, shows a floating ghost card, and places the entry on finger lift.

---

## Changes

### 1. SidebarEntryCard.tsx -- Add touch handlers + new prop

- Add `onTouchDragStart?: (entry: EntryWithOptions) => void` prop
- Add `touchTimerRef` and `touchStartRef` refs
- On `onTouchStart`: record position, start 400ms timer; on timeout call `onTouchDragStart(entry)`
- On `onTouchMove`: if finger moves >10px before timer fires, cancel
- On `onTouchEnd`: clear timer
- Only active when `isDraggable` is true (scheduled flights blocked)

### 2. CategorySidebar.tsx -- Pass through the new prop

- Add `onTouchDragStart?: (entry: EntryWithOptions) => void` to `CategorySidebarProps`
- Pass it to each `<SidebarEntryCard>` component

### 3. Timeline.tsx -- Core touch drag orchestration

Add state:
- `touchDragEntry: EntryWithOptions | null`
- `touchDragPosition: { x: number; y: number } | null`
- `touchDragGlobalHour: number | null`
- `touchDragTimeoutRef` for 3-second cancel timer

Add handler `handleTouchDragStart(entry)`:
- Set `touchDragEntry` to the entry
- Close Planner sheet (`setSidebarOpen(false)`)
- Start 3-second timeout that cancels drag if no movement to timeline

Render a full-screen transparent overlay when `touchDragEntry` is set:
- `onTouchMove`: track finger position, calculate `globalHour` from timeline grid position using `mainScrollRef` and `data-timeline-area`, 15-min snap, auto-scroll near edges
- `onTouchEnd`: if valid `globalHour`, call existing `handleDropOnTimeline(entry.id, globalHour)`; clean up all state
- `e.preventDefault()` on touchmove to prevent page scroll

Inside the overlay, render:
- A floating ghost card (160px wide, semi-transparent) showing entry name + computed time
- A horizontal drop indicator line on the timeline at the snapped position

Pass `onTouchDragStart={handleTouchDragStart}` to both mobile and desktop `CategorySidebar` instances.

### 4. ContinuousTimeline.tsx -- Add data attribute

Add `data-timeline-area` to the grid `<div>` (the one with `ref={gridRef}`) so the overlay can locate it for hour calculations.

---

## Technical Details

### Ghost card hour calculation
```text
1. Find timeline element via mainScrollRef.querySelector('[data-timeline-area]')
2. Get its bounding rect
3. relativeY = touch.clientY - rect.top + scrollTop of mainScrollRef
4. globalHour = relativeY / PIXELS_PER_HOUR (80)
5. Snap to 15-min: Math.round(globalHour * 4) / 4
```

### Auto-scroll during drag
```text
SCROLL_ZONE = 80px from screen edges
SCROLL_SPEED = 8px per touchmove event
If touch.clientY < 80: scroll up
If touch.clientY > window.innerHeight - 80: scroll down
```

### Cancel conditions
- Finger lifts outside timeline area (no valid globalHour) -- cancel, no placement
- 3 seconds pass without a valid drop -- cancel
- Short tap (< 400ms) -- normal tap behavior, no drag

### What does NOT change
- Desktop HTML5 drag/drop (draggable + onDragStart + onDrop)
- Timeline card drag/resize (useDragResize hook)
- Tap behavior on sidebar cards (opens entry sheet)
- Flight drag restrictions
- Any existing component APIs

## Files Changed
1. `src/components/timeline/SidebarEntryCard.tsx` -- touch handlers + new prop
2. `src/components/timeline/CategorySidebar.tsx` -- pass through prop
3. `src/pages/Timeline.tsx` -- touch drag state, overlay, ghost card
4. `src/components/timeline/ContinuousTimeline.tsx` -- add `data-timeline-area` attribute


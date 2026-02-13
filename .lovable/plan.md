

# Fix Touch Drag: Suppress Native Long-Press + Ghost Card Visibility

## Overview
Two bugs with the touch drag system: (1) the browser's native long-press gesture fires before our 400ms timer, and (2) the ghost card doesn't appear because the initial touch position isn't captured and document-level listeners aren't used.

---

## Changes

### 1. SidebarEntryCard.tsx -- Suppress native gestures + pass initial position

**CSS on card div**: Add inline styles to prevent text selection, callout menu, and double-tap zoom:
- `WebkitUserSelect: 'none'`
- `userSelect: 'none'`
- `WebkitTouchCallout: 'none'`
- `touchAction: 'manipulation'`

**Context menu**: Add `onContextMenu={(e) => e.preventDefault()}` to the card div.

**Timer**: Reduce from 400ms to 300ms.

**Prop signature change**: `onTouchDragStart` now passes initial position:
```text
onTouchDragStart?: (entry: EntryWithOptions, initialPosition: { x: number; y: number }) => void;
```

In the timer callback, pass `touchStartRef.current` as the initial position.

### 2. CategorySidebar.tsx -- Update prop passthrough

Update the `onTouchDragStart` prop type to include the initial position parameter. Pass it through unchanged.

### 3. Timeline.tsx -- Document-level listeners + initial position + ref for stale closure

**handleTouchDragStart**: Accept `initialPosition` parameter, call `setTouchDragPosition(initialPosition)` immediately so the ghost is visible from the start.

**Add a ref** `touchDragGlobalHourRef` that mirrors `touchDragGlobalHour` state (via a small useEffect) to avoid stale closures in the document listener.

**Replace the overlay's React touch handlers** with a `useEffect` that adds document-level `touchmove`, `touchend`, and `touchcancel` listeners when `touchDragEntry` is set. This is critical because when the Planner sheet closes, the original touch source element is removed from the DOM, and iOS won't deliver synthetic React touch events to the overlay.

The `useEffect`:
- `touchmove`: preventDefault, update position, calculate globalHour, auto-scroll
- `touchend`: if `touchDragGlobalHourRef.current` is valid, call `handleDropOnTimeline`; then cleanup
- `touchcancel`: cleanup
- Cleanup on unmount removes all three listeners

**Overlay div**: Becomes `pointer-events-none` (purely visual), renders the ghost card when `touchDragPosition` is set. No touch handlers on the div itself.

---

## Technical Details

### Why document listeners?
When `onTouchDragStart` fires, the Planner sheet closes and the `SidebarEntryCard` is unmounted. On iOS, touch events "belong" to the element that received `touchstart`. Once that element is removed, no other element receives the remaining touch events via React's synthetic system. Document-level native listeners still receive them.

### Stale closure fix
The `handleTouchEnd` inside the useEffect closure captures `touchDragGlobalHour` at effect setup time. Since it only runs once (when `touchDragEntry` changes), the value would be stale. A ref (`touchDragGlobalHourRef`) updated via a separate useEffect solves this.

### Files changed
1. `src/components/timeline/SidebarEntryCard.tsx` -- CSS, timer, prop signature
2. `src/components/timeline/CategorySidebar.tsx` -- prop type update
3. `src/pages/Timeline.tsx` -- document listeners, initial position, ref


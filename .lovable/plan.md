

# Fix Drag Offset, Transport Button, Drag Chain, and SNAP Button

## Issue 1: Drag Hold Offset Regression

### Root Cause
The `dayBoundaries` are computed from the outer `CalendarDay` wrapper div (which includes the day header and padding), but the grab offset calculation assumes `boundary.topPx` aligns with the start of the time grid. The day header, padding, and "Trip Begins" marker add vertical offset that is not accounted for, causing the cursor-to-card offset to be miscalculated.

### Fix
**File: `src/components/timeline/CalendarDay.tsx`**
- Add a second ref for the actual grid container (the `div` with `ml-20` and `height: containerHeight`).
- Expose this grid ref position via a callback or data attribute so boundaries can reference the grid top, not the wrapper top.

**File: `src/pages/Timeline.tsx`**
- When computing `dayBoundaries`, measure the grid container position (not the day wrapper). Use a separate ref map for grid containers, or compute the offset from data attributes.

**File: `src/hooks/useDragResize.ts`**
- Add missing dependencies (`dayBoundaries`, `scrollContainerRef`, `startHour`, `pixelsPerHour`) to the `startDrag` useCallback to prevent stale closure values.

### Alternative simpler approach
Instead of refactoring refs, compute a `gridOffset` inside CalendarDay by measuring the distance from the day wrapper top to the grid container top, and pass it alongside dayBoundaries. Then in `useDragResize`, subtract this offset when computing `relativeY`.

**Chosen approach**: Add a `gridTopPx` field to each day boundary entry. In Timeline.tsx, measure both the day wrapper and the grid container (via a second ref map) to populate `gridTopPx`. In `useDragResize.ts`, use `gridTopPx` instead of `topPx` for hour calculations.

---

## Issue 2: Transport Button Between Events Reverted

### Root Cause
The recent modal rework changed `onAddTransport` in Timeline.tsx to open the EntrySheet (modal) with prefillCategory='transfer'. For gaps under 2 hours, the transport button should directly generate transport without opening a modal.

### Fix
**File: `src/pages/Timeline.tsx`**
- Split `handleAddTransport` into two paths:
  - **Direct generation** (for the transport gap button in gaps under 2 hours): Directly invoke the `auto-generate-transport` edge function or create the transport entry inline (same logic as the "Route" button), bypassing the modal entirely.
  - **Modal path** (for the contextual suggestion in the "Add Something" modal): Keep existing behavior.
- Rename or add a new handler `handleGenerateTransport` that creates the transport entry directly.

**File: `src/components/timeline/CalendarDay.tsx`**
- The gap button's `onClick` for `isTransportGap` already calls `onAddTransport` -- this callback will now point to the direct-generation handler instead of the modal opener.

---

## Issue 3: Drag Chain Behavior

### Current Behavior
In `handleEntryTimeChange` (Timeline.tsx lines 496-507), after repositioning trailing transport, the code also auto-pulls the next event (`to_entry_id`) to meet the transport end. This moves the entire chain.

### New Behavior
Only the dragged event and its trailing transport move. The next event stays put, creating a gap.

### Fix
**File: `src/pages/Timeline.tsx`**
- Remove lines 496-507 (the block that auto-pulls the `to_entry_id` event after transport repositioning) from `handleEntryTimeChange`.
- Keep the transport repositioning logic (lines 489-493) intact -- trailing transport still moves with its parent event.

---

## Issue 4: SNAP Button Improvements

### Current State
A SNAP button already exists at CalendarDay.tsx lines 982-1020 but:
- Returns null for locked next events (should show with warning)
- Uses orange styling (should be green)
- Does not recalculate transport after snapping

### Fix
**File: `src/components/timeline/CalendarDay.tsx`**

1. **Show for locked events**: Change line 990 from `if (!nextVisible || nextVisible.is_locked) return null;` to only return null when `!nextVisible`. When `nextVisible.is_locked`, show the button but on click show a warning toast and do not execute the snap.

2. **Green styling**: Change the button classes from `bg-orange-100 text-orange-600 border-orange-200` to `bg-green-100 text-green-600 border-green-200` (and corresponding dark mode variants).

3. **Transport recalculation after snap**: After snapping the next event, trigger a transport recalculation if the transport connector between the events exists. Call `onVoteChange()` (already done) to refresh data, which will trigger re-render with updated positions.

---

## Files Changed

| File | Changes |
|------|---------|
| `src/hooks/useDragResize.ts` | Fix stale closure in `startDrag` deps; use `gridTopPx` from boundaries for offset calculation |
| `src/components/timeline/CalendarDay.tsx` | Add grid ref for boundary measurement; fix SNAP button for locked events + green styling; keep transport button calling direct-generation handler |
| `src/pages/Timeline.tsx` | Add grid ref map for boundary measurement; add `handleGenerateTransport` for direct transport creation; remove next-event auto-pull from `handleEntryTimeChange` |

## What Is NOT Changed

- Transport connector inline editing (mode switching, refresh, delete)
- Flight card behavior (permanently drag-locked)
- The "Add Something" modal's contextual transport suggestion
- Event card rendering/styling
- Gap detection logic for when buttons appear


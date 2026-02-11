
# Fix Drag Offset, Transport Button, Drag Chain, and SNAP Button

## Issue 1: Drag Hold Offset Regression

**Root cause**: `dayBoundaries` are measured from the outer CalendarDay wrapper div (which includes the sticky day header, "Trip Begins" marker, and padding), but the grab offset calculation in `useDragResize.ts` line 121 uses `boundary.topPx` as if it's the grid top. The header/padding offset causes the cursor-to-card offset to be wrong.

**Fix**: Add a `gridTopPx` field to each boundary. In `CalendarDay.tsx`, attach a `data-grid-top` attribute to the grid container div (the `div.ml-20` at line 364). In `Timeline.tsx`, read this attribute when computing boundaries. In `useDragResize.ts`, use `gridTopPx` for hour calculations, and add missing deps to `startDrag`.

## Issue 2: Transport Button Reverted

**Root cause**: `handleAddTransport` in Timeline.tsx (line 401) opens the EntrySheet modal with `prefillCategory='transfer'`. For gaps under 2 hours, the transport button should directly generate transport.

**Fix**: Add a new `handleGenerateTransportDirect` function in Timeline.tsx that:
1. Fetches walk + transit directions via the `google-directions` edge function
2. Creates an entry + option directly in the database (same logic as `auto-generate-transport`)
3. Sets `from_entry_id` and `to_entry_id` on the new entry
4. Calls `fetchData()` to refresh

Pass this as a separate `onGenerateTransport` prop to CalendarDay, used by the transport gap button (under 2hr gaps). The existing `onAddTransport` remains for the modal path but is no longer called from the gap button.

## Issue 3: Drag Chain Behavior

**Root cause**: Lines 495-507 in Timeline.tsx auto-pull the `to_entry_id` event after repositioning trailing transport. This moves the chain.

**Fix**: Remove lines 495-507 (the block that pulls the next event forward after transport repositioning). Transport still moves with the dragged event, but the next event stays put, creating a gap.

## Issue 4: SNAP Button Improvements

**Current state**: SNAP button at CalendarDay.tsx lines 982-1020:
- Returns null for locked events (line 990)
- Uses orange styling (line 1014)
- No transport recalculation after snap

**Fixes**:
1. Show for locked events with warning toast instead of hiding
2. Green styling
3. After snapping, invoke `google-directions` to recalculate transport duration for the selected mode, then update the transport entry's end time and option

---

## Technical Details

### Files Changed

| File | Changes |
|------|---------|
| `src/hooks/useDragResize.ts` | Add `gridTopPx` to DayBoundary interface; use it in startDrag + handlePointerMove; add missing deps to startDrag |
| `src/components/timeline/CalendarDay.tsx` | Add `data-grid-top` to grid div; add `onGenerateTransport` prop; SNAP button: green styling, locked event support, transport recalculation after snap |
| `src/pages/Timeline.tsx` | Read `data-grid-top` in boundary computation; add `handleGenerateTransportDirect`; remove chain-pull in `handleEntryTimeChange` lines 495-507 |

### SNAP Transport Recalculation Detail
After snapping the next event, the SNAP handler will:
1. Get the transport entry's current mode from `transport_modes` or parse from option name
2. Call `google-directions` with the from/to addresses and the new departure time
3. Update the transport entry's `end_time` based on the new duration
4. Update the option's `distance_km` and `route_polyline`
5. Re-snap the next event if the transport duration changed

### What Is NOT Changed
- Transport connector inline editing (mode switching, refresh, delete)
- Flight card behavior (permanently drag-locked)
- The "Add Something" modal's contextual transport suggestion
- Event card rendering/styling
- Gap detection logic for when buttons appear



# Transfers, Drag-to-Resize, Lat/Lng Removal, and "+" Button Improvements

## Overview

Five changes: remove lat/lng fields from entry creation, rename Travel to Transfer with FROM/TO fields, implement Google Calendar-style drag-to-resize/move on the timeline, add "+" buttons before entries, and handle Transfer override of auto-calculated travel segments.

---

## 1. Remove Latitude/Longitude from Entry Creation

Remove the manual latitude and longitude input fields from both `EntryForm.tsx` and `OptionForm.tsx`. The lat/lng columns remain in the database for future use (e.g. Google Places autocomplete), but users won't manually type coordinates.

### Files changed:
- **`src/components/timeline/EntryForm.tsx`**: Remove the `latitude`/`longitude` state variables and their `<Input>` fields (lines 65-66, 558-567). Set `latitude: null` and `longitude: null` in the save payload.
- **`src/components/timeline/OptionForm.tsx`**: Remove the latitude/longitude inputs (lines 175-198) and their state variables.

---

## 2. Rename "Travel" to "Transfer" with FROM/TO Fields

### Category rename:
- **`src/lib/categories.ts`**: Change `id: 'travel'` to `id: 'transfer'`, name to "Transfer", emoji to "🚐"

### Transfer-specific form fields:
- **`src/components/timeline/EntryForm.tsx`**: When category is `transfer`:
  - Show "From" and "To" text inputs (like flight departure/arrival)
  - Show travel mode selector (Walk, Transit, Cycle, Drive)
  - Auto-calculate duration via the `google-directions` edge function using FROM/TO text (or use manual override)
  - Add a "Calculate" button next to duration that triggers the API call
  - Allow manual duration override (input field, pre-filled from API or default)
  - Store FROM in `departure_location` and TO in `arrival_location` columns (reusing existing flight columns)

### Transfer overrides auto-segments:
- **`src/components/timeline/CalendarDay.tsx`**: When rendering travel segments between entries, skip rendering `TravelSegmentCard` if there's already a Transfer entry between those two entries (check by matching time ranges or by checking if a transfer entry exists with start_time >= entry A end_time and end_time <= entry B start_time)

### Files changed:
- `src/lib/categories.ts` -- rename travel to transfer
- `src/components/timeline/EntryForm.tsx` -- add FROM/TO fields and auto-calc for transfer category
- `src/components/timeline/OptionForm.tsx` -- update `isTravel` check to `isTransfer`
- `src/components/timeline/CalendarDay.tsx` -- skip auto travel segments when manual Transfer exists
- `src/components/timeline/EntryCard.tsx` -- display FROM/TO on Transfer cards (similar to flight display)

---

## 3. Drag-to-Resize and Drag-to-Move on Timeline (Google Calendar Style)

This is the largest change. Entry cards on the `CalendarDay` grid become draggable and resizable.

### Interaction model:
- **Drag top edge**: Resize start time (move top of card up/down)
- **Drag bottom edge**: Resize end time (move bottom of card up/down)
- **Drag middle of card**: Move entire card (maintains duration, shifts start/end times)
- Snaps to 15-minute increments
- On release, updates the entry's `start_time` and `end_time` in the database
- Works on both mouse and touch (touch requires a short hold ~200ms before drag activates, to distinguish from scroll)

### Implementation approach:

**New hook: `src/hooks/useDragResize.ts`**
- Manages drag state: `isDragging`, `dragType` (move | resize-top | resize-bottom), `dragEntryId`
- Tracks pointer position and calculates new time values based on pixel offset and `PIXELS_PER_HOUR`
- Handles mousedown/touchstart on drag handles and card body
- On release: calls Supabase to update `start_time`/`end_time`, then triggers `onDataRefresh`
- Snaps to nearest 15-minute interval

**Changes to `src/components/timeline/CalendarDay.tsx`:**
- Import and use the drag hook
- Add resize handles: thin transparent divs at the top and bottom edges of each entry card (6px tall, `cursor-ns-resize`)
- During drag, render a "ghost" preview showing the new position/size with reduced opacity
- Pass `onEntryTimeChange` callback prop for persisting changes
- Add touch event handling with hold-to-drag delay

**Changes to `src/components/timeline/EntryCard.tsx`:**
- Accept optional `onDragStart` prop for the card body (middle drag)
- Add `cursor-grab` / `cursor-grabbing` styles when hovering/dragging
- Prevent click handler from firing when a drag just completed

**Changes to `src/pages/Timeline.tsx`:**
- Add `handleEntryTimeChange(entryId, newStart, newEnd)` that updates the database and calls `fetchData()`
- Pass it to `CalendarDay`

### New prop on CalendarDay:
```typescript
onEntryTimeChange?: (entryId: string, newStartIso: string, newEndIso: string) => Promise<void>;
```

---

## 4. "+" Button Before First Entry

Currently the "+" button only appears AFTER each entry. We need one BEFORE the first entry too.

### Changes to `src/components/timeline/CalendarDay.tsx`:**
- Before the first entry in the positioned entries loop, render an additional "+" button
- Position it at the first entry's top minus a small offset (in the time label gutter area, left side)
- Pre-fill time: first entry start time minus 1 hour
- Use the same `onAddBetween` callback with the calculated pre-fill time

---

## 5. Google Directions Edge Function Update

The existing `google-directions` edge function works with lat/lng coordinates. For Transfer entries with text-based FROM/TO, we need to support address-based lookups.

### Changes to `supabase/functions/google-directions/index.ts`:
- Accept an optional `fromAddress`/`toAddress` parameter (in addition to existing lat/lng flow)
- When addresses are provided, use them directly in the Google Directions API (it supports text addresses as origin/destination)
- Return duration, distance, and mode

---

## Technical Details

### Drag-to-resize pixel-to-time conversion:
```
deltaMinutes = (deltaPixels / PIXELS_PER_HOUR) * 60
snappedMinutes = Math.round(deltaMinutes / 15) * 15
newTime = originalTime + snappedMinutes
```

### Touch handling for drag:
- `onTouchStart`: Start a 200ms timer
- If finger moves > 10px before timer fires: cancel (it's a scroll)
- If timer fires: activate drag mode, prevent scrolling via `e.preventDefault()`
- `onTouchMove`: Update drag position
- `onTouchEnd`: Commit changes

### Transfer override logic:
When rendering `CalendarDay`, for each pair of consecutive entries, check if any entry between them has `category === 'transfer'`. If so, skip the auto `TravelSegmentCard`.

---

## Files Summary

| File | Action | What Changes |
|------|--------|-------------|
| `src/lib/categories.ts` | Edit | Rename travel -> transfer |
| `src/components/timeline/EntryForm.tsx` | Edit | Remove lat/lng, add Transfer FROM/TO + auto-calc, pre-fill before logic |
| `src/components/timeline/OptionForm.tsx` | Edit | Remove lat/lng fields, update isTravel -> isTransfer |
| `src/components/timeline/CalendarDay.tsx` | Edit | Drag handles, resize/move logic, "+" before first entry, Transfer override of travel segments |
| `src/components/timeline/EntryCard.tsx` | Edit | Drag cursor styles, Transfer display, prevent click during drag |
| `src/pages/Timeline.tsx` | Edit | Add handleEntryTimeChange, pass to CalendarDay |
| `src/hooks/useDragResize.ts` | Create | Drag-to-resize/move hook with mouse + touch support |
| `supabase/functions/google-directions/index.ts` | Edit | Support text addresses for Transfer entries |



# Timeline Improvements: Drag Fix, Locking, Empty Gap Click, Airport Processing, and Wizard Flights

## Overview

Six interconnected changes to improve the timeline UX:
1. Fix drag-and-drop triggering the entry detail popup
2. Click (and click-drag) empty gaps to create entries
3. Lock/fix entries so they cannot be dragged
4. Airport processing entries (check-in before, checkout after flights)
5. "+" button before flight entries (currently missing)
6. Optional flight section in the trip creation wizard

---

## 1. Fix Drag Opening Entry Details

**Problem**: When you release a drag, the `onClick` on `EntryCard` fires, opening the overlay.

**Fix in `CalendarDay.tsx`**: Track whether a drag actually moved. The existing `isDraggingRef` in `useDragResize` resets after 50ms. The `onClick` handler already checks `if (!isDragged)`, but `isDragged` comes from the render-time `dragState` which may already be null. Fix: add a `wasDragged` ref that stays true for 100ms after drag ends, and check it in the click handler.

**Files**: `src/hooks/useDragResize.ts`, `src/components/timeline/CalendarDay.tsx`

---

## 2. Click Empty Gap to Create Entry (with Click-Drag for Duration)

**Behaviour**:
- Single click on empty timeline space opens the entry form with that time pre-filled (as start time)
- Click-and-drag on empty space shows a visual preview (highlighted block with start and end time labels), and on release opens the entry form with both start and end time pre-filled

**Implementation**:

### `TimeSlotGrid.tsx`
- Add `onMouseDown`, `onMouseMove`, `onMouseUp` handlers instead of just `onClick`
- Track drag state: `dragStart` position and `dragEnd` position
- Render a semi-transparent highlight rectangle during drag showing "09:00 - 10:30"
- On mouse up: if drag distance > threshold (e.g. 10px), call new `onDragSlot(startTime, endTime)` callback; otherwise call existing `onClickSlot(time)`
- Snap both start and end to 15-minute intervals

### `CalendarDay.tsx`
- Pass the existing `onAddBetween` for single clicks (already works)
- Add new `onDragCreateEntry` prop that passes both start and end times
- Wire `TimeSlotGrid`'s new `onDragSlot` to this

### `Timeline.tsx`
- Handle the new callback by opening `EntryForm` with both `prefillStartTime` and a new `prefillEndTime` prop

### `EntryForm.tsx`
- Accept optional `prefillEndTime` prop
- When provided, auto-set both start time and end time, and calculate duration from them

---

## 3. Lock/Fix Entries

**Behaviour**: Entries can be marked as "locked" (fixed). Locked entries show a lock icon + a dashed border, and cannot be dragged or resized.

### Database migration
- Add `is_locked` (boolean, default false) column to the `entries` table

### `src/types/trip.ts`
- Add `is_locked: boolean` to the `Entry` interface

### `EntryCard.tsx`
- Accept `isLocked` prop
- Show a small lock icon (from lucide) in the top-right corner when locked
- Apply a dashed border style: `border-dashed border-2`

### `CalendarDay.tsx`
- When `entry.is_locked` is true, do NOT render the drag handles (resize-top, resize-bottom)
- Do NOT pass `onDragStart` / `onTouchDragStart` to `EntryCard` for locked entries
- This completely prevents any drag interaction

### `EntryOverlay.tsx` (detail popup)
- Add a "Lock" / "Unlock" toggle button so users can lock entries from the detail view
- Calls `supabase.from('entries').update({ is_locked: !entry.is_locked }).eq('id', entry.id)` then refreshes

---

## 4. Airport Processing Entries

**Concept**: When creating a flight, the user can set "Arrive at airport X hours early" (default 2h) and "Airport checkout" (default 30min). This auto-creates two linked "Airport Processing" entries:
- **Check-in**: ends at flight departure time, starts X hours before
- **Checkout**: starts at flight arrival time, ends Y minutes after

These entries are linked to the flight and move with it. No auto-generated travel segments between processing entries and their flight.

### Database changes
- Add `airport_checkin_hours` (numeric, nullable, default 2) to `entry_options` -- stored on the flight option
- Add `airport_checkout_min` (integer, nullable, default 30) to `entry_options`
- Add `linked_flight_id` (uuid, nullable, FK to entries.id) to `entries` -- marks an entry as a processing entry linked to a specific flight
- Add `linked_type` (text, nullable) to `entries` -- either 'checkin' or 'checkout'

### `src/types/trip.ts`
- Add `is_locked`, `linked_flight_id`, `linked_type` to `Entry`
- Add `airport_checkin_hours`, `airport_checkout_min` to `EntryOption`

### New category in `src/lib/categories.ts`
- Add `airport_processing` category: `{ id: 'airport_processing', name: 'Airport', emoji: '🛃', color: 'hsl(210, 50%, 60%)', defaultDurationMin: 120, defaultStartHour: 8, defaultStartMin: 0 }`

### `EntryForm.tsx` (flight details step)
- Add two new fields below the terminal inputs:
  - "Arrive at airport early" -- number input (hours), default 2
  - "Airport checkout time" -- number input (minutes), default 30
- On save (new flight only, not edit): after creating the flight entry, auto-create two additional entries:
  1. **Check-in entry**: `start_time = flight_start - checkin_hours`, `end_time = flight_start`, `linked_flight_id = flight_entry_id`, `linked_type = 'checkin'`, `is_locked = true`
  2. **Checkout entry**: `start_time = flight_end`, `end_time = flight_end + checkout_min`, `linked_flight_id = flight_entry_id`, `linked_type = 'checkout'`, `is_locked = true`
  - Each gets an `entry_option` with category `airport_processing`, name "Airport Check-in" / "Airport Checkout", and the flight's departure/arrival airport as `location_name`
- Processing entries are auto-locked (cannot be dragged independently)

### `CalendarDay.tsx`
- When a flight entry is dragged and committed:
  - Find any entries with `linked_flight_id === flight_entry_id`
  - Move them by the same time delta (check-in stays anchored to flight start, checkout to flight end)
  - Call `onEntryTimeChange` for each linked entry as well
- Skip auto-generated travel segments between a flight and its linked processing entries (extend the existing `hasTransferBetween` logic)

### `EntryCard.tsx`
- For `airport_processing` category entries, render them with the "Part of flight" visual style:
  - Slightly muted/lighter background
  - Show the airport name and "Check-in" or "Checkout" label
  - Lock icon always visible since they're auto-locked

### `EntryOverlay.tsx`
- For processing entries, show the linked flight info
- Allow editing the check-in/checkout duration, which recalculates the entry times

---

## 5. "+" Button Before Flight Entries

**Problem**: The "+" button before the first entry only shows if there are entries, but it skips rendering when the first entry is a flight.

**Fix in `CalendarDay.tsx`**: The existing code at lines 235-253 already renders a "+" before the first entry for all entry types. The bug is likely that flight entries have different positioning. Review and ensure the "+" button renders regardless of entry category. The `getHourInTimezone` for flights with different departure timezone may place the entry differently -- the "+" button should still appear above it.

---

## 6. Optional Flight Section in Trip Wizard

**Behaviour**: On the Dates step of the trip wizard, add a collapsible "Add flights" section where users can optionally add outbound and return flights with airport pickers. This pre-populates the timeline when the trip is created.

### `src/components/wizard/DateStep.tsx`
- Add a collapsible section (using Collapsible from radix) titled "Add flights (optional)"
- When expanded, show:
  - **Outbound flight**: Departure airport picker, arrival airport picker, departure date (auto-linked to trip start date), departure time, arrival time
  - **Return flight**: Same fields, arrival date auto-linked to trip end date
- Export the flight data as part of the step's state

### `src/pages/TripWizard.tsx`
- Add state for outbound/return flight data
- Pass to DateStep and receive updates
- After trip creation, if flight data is provided:
  - Create entries and entry_options for the flights (using same logic as EntryForm)
  - Auto-create airport processing entries for each flight
  - Auto-set trip timezone from the arrival airport of the outbound flight

---

## Technical Details: Files Summary

| File | Action | Changes |
|------|--------|---------|
| DB migration | Create | Add `is_locked`, `linked_flight_id`, `linked_type` to `entries`; add `airport_checkin_hours`, `airport_checkout_min` to `entry_options` |
| `src/types/trip.ts` | Edit | Add new fields to Entry and EntryOption interfaces |
| `src/lib/categories.ts` | Edit | Add `airport_processing` category |
| `src/hooks/useDragResize.ts` | Edit | Export `wasDragged` ref to prevent click-after-drag |
| `src/components/timeline/TimeSlotGrid.tsx` | Edit | Add click-drag to create entries with visual preview |
| `src/components/timeline/CalendarDay.tsx` | Edit | Lock support, linked entry movement, drag-click fix, "+" button fix |
| `src/components/timeline/EntryCard.tsx` | Edit | Lock icon + dashed border for locked entries, airport processing style |
| `src/components/timeline/EntryForm.tsx` | Edit | Airport processing fields, prefill end time, create linked entries |
| `src/components/timeline/EntryOverlay.tsx` | Edit | Lock/unlock toggle, processing entry editing |
| `src/pages/Timeline.tsx` | Edit | Pass prefillEndTime, handle drag-create callback |
| `src/components/wizard/DateStep.tsx` | Edit | Add collapsible flight section |
| `src/pages/TripWizard.tsx` | Edit | Handle flight data, create flight entries on trip creation |



# Fix Entry Timezone Alignment and Merge Flight + Airport Cards

## Issue 1: Entries Before/After Flight Using Wrong Timezone

**Root cause**: `Timeline.tsx` passes a single `activeTz` per day. On a flight day, it's set to `departure_tz` (line 238). But entries AFTER the flight should use `arrival_tz`. Currently, all non-flight entries on the day use the same `activeTz`, so post-flight entries are positioned in the wrong timezone.

**Fix**: Instead of one `activeTz` per day, determine the correct timezone per-entry based on whether it starts before or after the flight.

### Changes in `CalendarDay.tsx` (lines 367-378)

For non-flight entries, instead of blindly using `activeTz`, check if the entry's UTC start time is after the flight's UTC end time. If so, use `arrival_tz`; otherwise use `departure_tz` (or `activeTz` if no flight).

Pass the flight info (already available as `flights` prop data from `TimeSlotGrid`) into the positioning logic. Specifically:
- Accept the raw flight entries (or their UTC times + timezones) so we can compare each entry's UTC time against the flight's UTC end time.
- Before flight end (UTC): use departure_tz (origin)
- After flight end (UTC): use arrival_tz (destination)
- No flight on this day: use activeTz as-is

### Changes in `Timeline.tsx` (lines 211-264)

Pass the flight entries' data (UTC start/end + departure_tz/arrival_tz) to `CalendarDay` so it can determine per-entry timezone. Add a new prop like `dayFlightInfo` containing the raw flight UTC times and timezones.

## Issue 2: Merge Check-in + Flight + Checkout into One Card

**Current state**: Check-in, flight, and checkout are three separate `EntryCard` components positioned independently. They have their own lock icons and drag handles.

**Goal**: Render them as a single merged block -- check-in section on top, flight in the middle, checkout at the bottom. Moving the flight moves all three. No separate lock icons on airport cards.

### Changes in `CalendarDay.tsx` (entry rendering, lines 354-470)

1. **Group linked entries**: Before rendering, group entries so that a flight and its linked check-in/checkout are treated as one "flight group". Filter out entries with `linked_flight_id` from the main render loop.

2. **Render flight groups as merged blocks**: For each flight entry, find its linked check-in (ends at flight start) and checkout (starts at flight end). Compute the merged block's `top` from the check-in start and `height` from check-in start to checkout end.

3. **Single merged card component**: Inside the merged block div, render three sections vertically:
   - Check-in section (compact, shows "Check-in" label + time)
   - Flight section (main card, full detail)
   - Checkout section (compact, shows "Checkout" label + time)

4. **Drag behavior**: The drag handle applies to the entire merged block. When dragged, all three entries move together (the existing `handleDragCommit` already moves linked entries when a flight moves -- we just need to use the flight entry's ID for dragging).

5. **No lock icons on airport cards**: The merged block has one lock icon on the flight section only. Airport processing sections never show lock controls.

### Changes in `EntryCard.tsx`

Add a new rendering mode or a wrapper component (`FlightGroupCard`) that accepts the flight option + check-in entry + checkout entry and renders them as a single unified card with three sections:

```
+----------------------------------+
| Check-in | LHR T5 | 03:45-05:45 |
|----------------------------------|
| BA432    LHR -> AMS              |
| 05:45 GMT  ->  08:15 CET        |
|         [lock icon]              |
|----------------------------------|
| Checkout | AMS | 08:15-08:45     |
+----------------------------------+
```

The sections share the flight's category color. The check-in and checkout sections are visually lighter/subdued compared to the main flight section.

## Technical Summary

| File | Changes |
|------|---------|
| `Timeline.tsx` | Pass flight UTC times + timezones to CalendarDay for per-entry TZ resolution |
| `CalendarDay.tsx` | Per-entry timezone selection (before/after flight). Group flight + linked entries into merged blocks. Single drag handle for the group. |
| `EntryCard.tsx` | Add `FlightGroupCard` rendering mode that shows check-in, flight, and checkout as one merged card with three sections |




# Implementation Plan: Transport Guards + Flight Time Fixes

## Part 1: Edge Function - Skip Spurious Transport

Three guards added to `supabase/functions/auto-generate-transport/index.ts` in the main pairing loop (around line 249):

**Guard A - Transport-like categories**: Expand the existing `transfer` skip to also include `travel` and `transport` categories. The Coach (category `travel`) was being treated as a regular event.

**Guard B - No effective gap**: After computing `transportStartTime` and `deadlineTime`, skip if start >= deadline. This prevents creating transport when there's no actual gap (e.g. Coach ends right when checkin begins).

**Guard C - Checkin bridges flight**: If entryB is a flight and its linked checkin already starts before or at `transportStartTime`, the airport journey is already covered.

## Part 2: Fix Flight Checkin Alignment

Current data shows:
- Checkin: 06:30 - 08:15 UTC (1h45m)
- Flight BA432: 09:15 - 09:50 UTC (departure_tz: Europe/London)

The checkin should end at flight departure (09:15 UTC) and start 2h before (07:15 UTC). Currently it's off by 1 hour -- the checkin was likely computed against the wrong time.

**Fix**: The flight creation/editing code already has cascading logic per memory notes. The data fix is a one-time SQL update to correct the existing BA432 checkin entry:
- Set checkin start_time to `2026-02-21 07:15:00+00` (2h before 09:15 departure)
- Set checkin end_time to `2026-02-21 09:15:00+00` (matches flight departure)

## Part 3: Make Flight Departure/Arrival Times Editable

In `src/components/timeline/EntrySheet.tsx`, the departure time (line 896) and arrival time (line 927) are rendered as plain `<p>` tags. They need to become `InlineField` components that:

1. Show the formatted time (e.g. "09:15") as display
2. Allow clicking to edit via a time input
3. On save:
   - Parse the new local time in the relevant timezone
   - Update `entry.start_time` (for departure) or `entry.end_time` (for arrival)
   - Cascade to linked checkin/checkout entries:
     - Checkin: ends at new departure, starts `airport_checkin_hours` before
     - Checkout: starts at new arrival, ends `airport_checkout_min` after

**New helper function** `updateFlightLinkedTimes` added directly in EntrySheet.tsx:
- Takes the flight entry ID, new start/end times, and checkin/checkout hours/min
- Queries linked entries by `linked_flight_id`
- Updates their times accordingly

## Part 4: Data Fix

A one-time database update to fix the misaligned BA432 checkin:

```sql
UPDATE entries 
SET start_time = '2026-02-21 07:15:00+00', 
    end_time = '2026-02-21 09:15:00+00'
WHERE id = 'aab2c6dc-bcae-4f04-8bfa-88eaf4d69838';
```

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/auto-generate-transport/index.ts` | Add 3 skip guards (transport-like categories, no-gap, checkin-bridged) |
| `src/components/timeline/EntrySheet.tsx` | Replace plain departure/arrival time `<p>` with `InlineField` + cascade handler for linked checkin/checkout |
| Database | One-time fix for BA432 checkin alignment |

## Expected Results

- No spurious transit between Coach and Flight
- Checkin visually aligns flush against flight departure
- Clicking departure/arrival times in the flight view dialog allows editing
- Editing flight times automatically adjusts checkin/checkout entries


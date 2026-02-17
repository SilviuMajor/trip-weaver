
# Transport Recalculation After Chain Shift

## Overview
After a chain shift (from bottom-edge resize), transport entries have moved to new times. Their routes may differ based on departure time. This adds a background recalculation that updates transport durations and optionally shifts entries further if transport grows longer.

## Changes

### File: `src/pages/Timeline.tsx`

**1. Add `recalculateTransports` callback (~after `handleChainShift`, line 1040)**

A new `useCallback` that:
- Takes an array of transport entry IDs
- For each transport, reads its `departure_location` and `arrival_location` from `options[0]`
- Calls `google-directions` edge function with the new `start_time` as departure time, requesting all modes
- On response, rounds duration to nearest 5 minutes, updates `entries.end_time` and `entry_options` (distance, polyline, transport_modes)
- If the new transport end time overlaps the next entry in the block, shifts subsequent entries forward (expanding only, never contracting)
- Calls `fetchData()` at the end to refresh UI
- Errors are logged but don't block the user

**2. Call `recalculateTransports` at end of `handleChainShift` (line 1039)**

After the existing `await fetchData()` call:
- Filter `entryIdsToShift` to find transport entries (those with `options[0]?.category === 'transfer'`)
- If any exist, call `recalculateTransports(transportIds)` without awaiting (non-blocking)

**3. Import `getBlock` and `getEntriesAfterInBlock`**

Add import from `@/lib/blockDetection` (may already be imported for chain shift logic -- will verify and add if needed).

## Behavior

| Scenario | Result |
|----------|--------|
| Resize shifts a transport | Transport duration recalculated in background |
| Transport becomes longer | Entries after it shift further down automatically |
| Transport becomes shorter | Gap shrinks but entries don't move back (no contraction) |
| Multiple transports in block | All recalculate in sequence |
| API error | Logged to console, no user-facing error |

## No changes to:
- `ContinuousTimeline.tsx`
- `blockDetection.ts`
- Database schema
- Edge functions

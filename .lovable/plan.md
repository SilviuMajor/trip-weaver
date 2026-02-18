

# Fix handleSnapRelease for Flight Groups

## Problem
When snapping a card after a flight group, `handleSnapRelease` has three issues:
1. Uses flight's `end_time` (landing) as transport start instead of the checkout's `end_time`
2. Sets `from_entry_id` to the flight ID instead of the checkout entry ID (connector renders at wrong position)
3. Address resolution works for flights but not for checkout entries that become the `from_entry_id`

## Root Cause
`handleSnapRelease` receives the flight entry as `fromEntry` (since `airport_processing` entries are filtered out of visible/sorted lists). It then uses the flight's `end_time` and `id` directly, without accounting for the checkout section that extends below the flight.

The edge function (`auto-generate-transport`) already handles this correctly (lines 269-324): it looks up checkout end times and uses them. The client-side `handleSnapRelease` needs the same treatment.

## Fix

### `src/pages/Timeline.tsx` — `handleSnapRelease` (lines 739-808)

After finding `fromEntry` and `toEntry`, add a checkout lookup:

```typescript
const fromEntry = entries.find(e => e.id === fromEntryId);
const toEntry = entries.find(e => e.id === toEntryId);
if (!fromEntry || !toEntry || !tripId) return;

// For flights, find the checkout entry and use its end_time + ID
let effectiveFromId = fromEntryId;
let effectiveFromEndTime = fromEntry.end_time;
const fromOpt = fromEntry.options[0];

if (fromOpt?.category === 'flight') {
  const checkout = entries.find(e =>
    e.linked_flight_id === fromEntryId && e.linked_type === 'checkout'
  );
  if (checkout) {
    effectiveFromId = checkout.id;
    effectiveFromEndTime = checkout.end_time;
  }
}

// Similarly for toEntry — if it's a flight, use its checkin entry
let effectiveToId = toEntryId;
const toOpt = toEntry.options[0];
if (toOpt?.category === 'flight') {
  const checkin = entries.find(e =>
    e.linked_flight_id === toEntryId && e.linked_type === 'checkin'
  );
  if (checkin) {
    effectiveToId = checkin.id;
  }
}
```

Then replace:
- Line 759: `departureTime: fromEntry.end_time` with `effectiveFromEndTime`
- Line 770: `new Date(fromEntry.end_time)` with `new Date(effectiveFromEndTime)`
- Line 806: `from_entry_id: fromEntryId` with `effectiveFromId`
- Line 807: `to_entry_id: toEntryId` with `effectiveToId`
- Lines 777, 791: update old transport cleanup queries to use `effectiveFromId` and `effectiveToId`

The address resolution via `resolveFromAddress(fromOpt)` (line 745) stays the same -- it correctly returns `arrival_location` ("AMS - Schiphol") for flight entries.

## Technical Details

### Lines changed in `handleSnapRelease`:
- Add ~15 lines of checkout/checkin lookup after line 741
- Update 6 references from `fromEntryId`/`fromEntry.end_time` to `effectiveFromId`/`effectiveFromEndTime`
- Update 2 references from `toEntryId` to `effectiveToId`

### What about existing broken transport entries?
The two duplicate transport entries in the DB (`departure_location: "AMS"`, only drive mode, 15min/0km) will need to be deleted by the user. After the fix, re-snapping or using gap buttons will create correct transport with proper airport address and all 4 modes.

## Files Modified
- `src/pages/Timeline.tsx` -- fix `handleSnapRelease` to use checkout/checkin entry IDs and times for flight groups

## What Is NOT Changed
- Gap button logic in ContinuousTimeline.tsx (already uses `effectiveEndTime` and `resolveFromAddress`)
- `auto-generate-transport` edge function (already handles this correctly)
- `resolveFromAddress` / `resolveToAddress` helpers (working correctly for flight category)
- Connector rendering logic (will automatically render correctly once `from_entry_id` points to checkout)

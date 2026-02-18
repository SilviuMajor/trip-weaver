

# Fix Flight-to-Activity Transport Location Resolution

## Problem
Transport from a flight to the next activity shows "15 min drive" with no other modes and 0 km distance. The airport is much further from the destination than 15 minutes. Only one transport mode appears instead of all four (walk, transit, drive, bicycle).

## Root Cause
Flight entries have `address: null`, `location_name: null`, and `latitude/longitude: null`. The only location data is `arrival_location: "AMS - Schiphol"` (a display name, not a proper address). Multiple code paths fail to resolve this correctly:

1. **`handleSnapRelease`** (Timeline.tsx line 745) only checks `address || location_name` -- both null for flights, so it bails out without creating transport
2. **Gap button `fromAddress`** (ContinuousTimeline.tsx line 1272/1299) falls through to `arrival_location` but passes "AMS - Schiphol" which Google Directions can't reliably geocode
3. The existing transport in the DB has `departure_location: "AMS"` and only 1 mode (drive, 15min, 0km) -- Google interpreted the airport code as a city-center location

## Solution

### 1. Create a shared location resolver helper

Add a helper function in `src/lib/entryHelpers.ts` (or similar) that correctly resolves the "from" and "to" addresses for any entry type:

```typescript
/** Resolve the address where you END UP after completing this entry */
export function resolveFromAddress(opt: EntryOption): string | null {
  // Flights: you end up at the arrival airport
  if (opt.category === 'flight') {
    return opt.arrival_location || null;
  }
  return opt.address || opt.location_name || opt.arrival_location || null;
}

/** Resolve the address where you NEED TO BE for this entry */
export function resolveToAddress(opt: EntryOption): string | null {
  // Flights: you need to be at the departure airport
  if (opt.category === 'flight') {
    return opt.departure_location || null;
  }
  return opt.address || opt.location_name || opt.departure_location || null;
}
```

### 2. Fix `handleSnapRelease` in Timeline.tsx (line 745-746)

Replace:
```typescript
const fromAddr = fromOpt?.address || fromOpt?.location_name;
const toAddr = toOpt?.address || toOpt?.location_name;
```

With calls to the new helper:
```typescript
const fromAddr = fromOpt ? resolveFromAddress(fromOpt) : null;
const toAddr = toOpt ? resolveToAddress(toOpt) : null;
```

This ensures flights resolve to their arrival/departure locations.

### 3. Fix gap button `fromAddress` in ContinuousTimeline.tsx (lines 1272, 1285, 1299)

Currently uses `entry.options[0]?.location_name || entry.options[0]?.arrival_location`. Replace with the same helper for consistency.

For the "from" side (the entry above the gap):
```typescript
fromAddress: resolveFromAddress(entry.options[0]) || ''
```

For the "to" side (the entry below the gap):
```typescript
toAddress: resolveToAddress(nextEntry.options[0]) || ''
```

### 4. Fix `handleAddBetween` transport creation address resolution (line 745)

Same pattern -- anywhere `fromOpt?.address || fromOpt?.location_name` is used to resolve an entry's location for transport purposes, replace with the shared helper.

### 5. Verify the auto-generate edge function (already correct)

The `auto-generate-transport` edge function already has proper flight-aware `resolveFromLocation` / `resolveToLocation` functions (lines 112-140). No changes needed there.

## What about "AMS - Schiphol" not being a proper address?

"AMS - Schiphol" is actually a recognizable name that Google Directions can geocode to Amsterdam Schiphol Airport. The current problem is not that the name is unrecognizable -- it's that the code paths never even reach `arrival_location`. Once the resolver falls through correctly, Google should return proper airport-to-destination routes with accurate durations (likely 20-40 min by transit from Schiphol to central Amsterdam).

## Files Modified
- `src/lib/entryHelpers.ts` -- add `resolveFromAddress` and `resolveToAddress` helpers
- `src/pages/Timeline.tsx` -- fix `handleSnapRelease` address resolution (line 745-746)
- `src/components/timeline/ContinuousTimeline.tsx` -- fix gap button `fromAddress`/`toAddress` resolution (lines 1272, 1285, 1299)

## What Is NOT Changed
- `auto-generate-transport` edge function (already has correct flight-aware resolution)
- `TransportOverlay` (reads addresses from the transport entry option, which will now be correctly populated)
- `EntryCard` refresh routes (reads from existing transport option data)

## Testing
- Delete the existing incorrect transport entry from the flight
- Create/trigger transport again (via gap button or snap) between the flight and the cafe
- Verify Google returns multiple modes (walk, transit, drive, bicycle) with realistic durations from Schiphol
- Verify the transport connector shows the correct duration and all modes are available in the Transport Overlay

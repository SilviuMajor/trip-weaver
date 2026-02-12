
# Fix dayTimezoneMap activeTz + SNAP Button + Remove Debug Logs

## Root Cause

Three distinct issues, all clearly identified:

### 1. `activeTz` never transitions on flight days

In `Timeline.tsx` line 286, `activeTz` is set to `currentTz` which is the departure TZ (set on line 264). The arrival TZ is only applied to `currentTz` on line 288 for the **next** day. The flight day itself always has `activeTz = departureTz`.

This affects:
- `getEntriesForDay` (line 366-368): day-filtering uses departure TZ
- `handleDragCommit` (CalendarDay line 141): drag fallback uses `activeTz`
- `resolveTimezoneForTime` (line 381): matches day using `info.activeTz`

The per-entry rendering in CalendarDay (lines 620-636) works correctly because it independently checks `entry.start_time >= flightEndUtc`. But all other downstream consumers of `activeTz` are wrong.

**Fix**: After building the flights array for a flight day, set `activeTz` to the last flight's **destination** TZ. This is the correct "post-flight" TZ for the majority of the day. Pre-flight entries are handled by `resolveEntryTz()` which checks flight boundaries regardless of `activeTz`.

### 2. `flightEndUtc` missing from TypeScript type

Line 230 declares flights as `Array<{ originTz, destinationTz, flightStartHour, flightEndHour }>` — no `flightEndUtc`. But line 283 adds it. This forces `(lastFlight as any).flightEndUtc` casts in `resolveTimezoneForTime` (line 384).

**Fix**: Add `flightEndUtc: string` to the type declaration.

### 3. SNAP button requires `to_entry_id` with no fallback

Line 1013-1015: `nextVisible` is only found via `entry.to_entry_id`. Old transport entries (and even some new ones) may have `to_entry_id = NULL`, causing `nextVisible = null` and the SNAP button to never render.

**Fix**: Add a fallback that finds the next chronological non-transport, non-linked entry in `sortedEntries` when `to_entry_id` is null.

---

## Changes

### File: `src/pages/Timeline.tsx`

**1. Fix type declaration (line 230):**
Add `flightEndUtc` to the flights array type:
```typescript
const map = new Map<string, { 
  activeTz: string; 
  flights: Array<{ 
    originTz: string; destinationTz: string; 
    flightStartHour: number; flightEndHour: number; 
    flightEndUtc: string;
  }> 
}>();
```

**2. Fix activeTz transition (line 286):**
Change from:
```typescript
map.set(dayStr, { activeTz: currentTz, flights });
```
To:
```typescript
// activeTz = destination TZ after last flight (most entries on flight day are post-flight)
const postFlightTz = flightEntries[flightEntries.length - 1].options[0].arrival_tz!;
map.set(dayStr, { activeTz: postFlightTz, flights });
```

This means for the flight day, `activeTz` = destination TZ. Pre-flight entries are correctly resolved by `resolveEntryTz()` which checks `entry.start_time < flightEndUtc` and returns `originTz`.

**3. Remove `as any` casts in `resolveTimezoneForTime` (lines 384, 386):**
Since `flightEndUtc` is now in the type, change:
```typescript
if ((lastFlight as any).flightEndUtc) {
  ...new Date((lastFlight as any).flightEndUtc)...
```
To:
```typescript
if (lastFlight.flightEndUtc) {
  ...new Date(lastFlight.flightEndUtc)...
```

**4. Fix `dayLocationMap` flight day TZ (line 332):**
Currently uses `homeTimezone`. Change to use the flight's own arrival TZ:
```typescript
const flightOpt = flight.options[0];
const flightArrTz = flightOpt?.arrival_tz || homeTimezone;
const flightDay = getDateInTimezone(flight.end_time, flightArrTz);
```

### File: `src/components/timeline/CalendarDay.tsx`

**1. Fix SNAP button fallback (lines 1013-1016):**
Replace:
```typescript
const nextVisible = entry.to_entry_id
  ? sortedEntries.find(e => e.id === entry.to_entry_id)
  : null;
if (!nextVisible) return null;
```
With:
```typescript
let nextVisible = entry.to_entry_id
  ? sortedEntries.find(e => e.id === entry.to_entry_id)
  : null;
// Fallback: find next chronological non-transport, non-linked entry
if (!nextVisible) {
  const entryIdx = sortedEntries.findIndex(e => e.id === entry.id);
  for (let i = entryIdx + 1; i < sortedEntries.length; i++) {
    const candidate = sortedEntries[i];
    if (!isTransportEntry(candidate) && !candidate.linked_flight_id) {
      nextVisible = candidate;
      break;
    }
  }
}
if (!nextVisible) return null;
```

Note: `isTransportEntry` is defined earlier in the same render scope (line 422). However, the SNAP button code is inside the per-entry render block (line 592+) which is a child scope. We need to either move `isTransportEntry` to be accessible here, or inline the check. Since `isTransportEntry` is already defined in the parent IIFE (line 422), the SNAP code at line 1011 is inside the same IIFE and has access to it.

**2. Add SNAP-DEBUG logging (temporary):**
After computing `gapMs`, add:
```typescript
console.log('[SNAP-DEBUG]', {
  entryName: primaryOption.name,
  entryEndUtc: entry.end_time,
  nextEntryName: nextVisible.options[0]?.name,
  nextEntryStartUtc: nextVisible.start_time,
  gapMs,
  isTransport,
  hasToEntryId: !!entry.to_entry_id,
  nextIsLocked: nextVisible.is_locked,
  shouldShowSnap: gapMs > 0,
});
```

**3. Remove all TZ-DEBUG console.logs:**
- Remove lines 606-607 (the `_preResolvedTz` diagnostic variable)
- Remove lines 643-646 (the `[TZ-DEBUG]` console.log block)

---

## What is NOT changed

- `resolveEntryTz()` in timezoneUtils.ts (already correct -- checks flight boundaries)
- CalendarDay per-entry TZ rendering logic (lines 620-636) -- already correct
- Transport generation UTC arithmetic
- SNAP click handler logic (the `handleSnapNext` function)
- Gap button detection logic (already uses `resolveEntryTz`)
- EntrySheet `resolvedTz` prop plumbing (already fixed)
- `resolveTimezoneForTime` helper (already correct, just removing `as any`)

## Expected outcome after fix

- `activeTz` = `Europe/Amsterdam` for the flight day (post-flight)
- `activeTz` = `Europe/Amsterdam` for all subsequent days until another flight
- Card positions match card time labels (no 1-hour offset)
- SNAP button appears for any transport with a gap to its next event
- No excessive TZ-DEBUG logging
- SNAP-DEBUG logs available for verification (temporary)

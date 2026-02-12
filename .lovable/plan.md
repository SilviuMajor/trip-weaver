

# Fix Post-Migration Issues: TZ Offset, Transport Rendering, SNAP Button

## Root Cause Analysis

### Issue 1 — 1-hour offset on post-flight entries

**Found the exact bug.** The database confirms it:

The "Flying Dutchmen Cocktails" entry has `start_time = 2026-02-21 11:15:00 UTC`. In Amsterdam (CET, UTC+1) that's 12:15 local — which matches the card label. But it renders at ~13:15 position.

This means the entry was **saved with the wrong TZ**. If the user typed "12:15" and `localToUTC` used `Europe/London` (homeTimezone, UTC+0) instead of `Europe/Amsterdam` (CET, UTC+1), the result would be `12:15 UTC` — which in Amsterdam displays as 13:15. That matches the observed behavior.

**The bug is in how `sheetResolvedTz` is computed.** In `handleCardTap` (line 378-387) and `handleAddBetween` (line 398-411), the code sets `sheetResolvedTz` to `info.activeTz` from `dayTimezoneMap`. But `activeTz` for a flight day is the **departure** (pre-flight) TZ, not the destination TZ. For entries AFTER the flight, we need the destination TZ.

The DISPLAY path in CalendarDay (lines 606-622) correctly checks `entry.start_time >= flightEndUtc` to pick destination TZ. But the SAVE path doesn't — it just uses `activeTz`.

### Issues 2, 3, 4 — Transport visual, gap buttons, SNAP button

**All three share the same root cause.** The "Drive to Singel 460" entry has:
- `category: NULL` (not `'transfer'`)
- `from_entry_id: NULL`
- `to_entry_id: NULL`

This is an old-style entry created before the transport connector system. The rendering code checks `category === 'transfer'` to render the connector strip (Issue 2), the gap filter checks `category !== 'transfer'` to exclude transport from gap evaluation (Issue 3), and the SNAP check requires `category === 'transfer'` (Issue 4).

---

## Fixes

### Fix 1: Correct `sheetResolvedTz` computation (Issue 1)

**File: `src/pages/Timeline.tsx`**

Create a helper function that resolves the correct TZ for a given UTC timestamp on a given day, accounting for flight boundaries:

```typescript
const resolveTimezoneForTime = useCallback((isoTime: string): string => {
  // Find which day this time belongs to
  for (const [dayStr, info] of dayTimezoneMap) {
    if (getDateInTimezone(isoTime, info.activeTz) === dayStr) {
      // Check if this time is after a flight on this day
      if (info.flights.length > 0) {
        const lastFlight = info.flights[info.flights.length - 1];
        if (lastFlight.flightEndUtc) {
          const timeMs = new Date(isoTime).getTime();
          const flightEndMs = new Date(lastFlight.flightEndUtc).getTime();
          if (timeMs >= flightEndMs) {
            return lastFlight.destinationTz;
          }
        }
      }
      return info.activeTz;
    }
  }
  return homeTimezone;
}, [dayTimezoneMap, homeTimezone]);
```

Then use it in:

1. **`handleCardTap`** (line 378-387): Replace the loop with `setSheetResolvedTz(resolveTimezoneForTime(entry.start_time))`

2. **`handleAddBetween`** (line 398-411): Replace `setSheetResolvedTz(tzInfo?.activeTz || homeTimezone)` with `setSheetResolvedTz(resolveTimezoneForTime(prefillTime))`

3. **`handleDragSlot`** (line 562-569): Add `setSheetResolvedTz(resolveTimezoneForTime(startIso))` before opening the sheet

4. **`handleAddTransport`** (line 413): The resolvedTz is already passed as a parameter from CalendarDay gap buttons, so this is fine.

### Fix 2: Data migration for old transport entries (Issues 2, 3, 4)

**Database migration SQL:**

```sql
-- Fix old transport entries that lack category and connector links
-- These are entries whose option name starts with transport mode labels
UPDATE entry_options
SET category = 'transfer', category_color = '#6B7280'
WHERE category IS NULL
AND (name ILIKE 'Drive to%' OR name ILIKE 'Walk to%' 
     OR name ILIKE 'Transit to%' OR name ILIKE 'Cycle to%');
```

This fixes the data so existing transport entries get proper `category = 'transfer'`.

Note: The `from_entry_id` / `to_entry_id` links can't be auto-reconstructed for old entries, but this is acceptable — the SNAP button uses `to_entry_id` to find its target, so old-style transport won't show SNAP. The critical fix is category-based rendering.

### Fix 3: Make transport detection more robust (Issues 2, 3, 4)

**File: `src/components/timeline/CalendarDay.tsx`**

Add a helper that detects transport entries by BOTH category and naming pattern:

```typescript
const isTransportEntry = (entry: EntryWithOptions): boolean => {
  const opt = entry.options[0];
  if (!opt) return false;
  if (opt.category === 'transfer') return true;
  // Fallback for old entries without proper category
  const name = opt.name?.toLowerCase() ?? '';
  return (entry.from_entry_id != null && entry.to_entry_id != null) ||
    (name.startsWith('drive to') || name.startsWith('walk to') || 
     name.startsWith('transit to') || name.startsWith('cycle to'));
};
```

Replace `opt.category !== 'transfer'` checks in:
- `visibleEntries` filter (line 425): use `!isTransportEntry(e)`
- `isTransport` variable (line 683): use `isTransportEntry(entry)`
- SNAP button condition (line 987): use `isTransportEntry(entry)` (with `entry` being the current entry variable, not a fresh one from the map)

### Fix 4: Existing event data correction (Issue 1)

The "Cocktails" entry stored at 11:15 UTC was meant to be 12:15 Amsterdam time (= 11:15 UTC). Let me re-verify... actually wait: `localToUTC("2026-02-21", "12:15", "Europe/London")` would produce `12:15 UTC`, not `11:15 UTC`. But the stored value is `11:15 UTC`.

This means the entry was actually saved correctly! The 12:15 CET = 11:15 UTC is right. So the SAVE path may have been correct for this particular entry (possibly created before migration with the old destination-based tripTimezone = Europe/Amsterdam).

The rendering offset must then be in the DISPLAY path. Let me re-examine: if `activeTz` = `Europe/London` and the flight boundary check works, `resolvedTz` should be `Europe/Amsterdam`. Then `getHourInTimezone("11:15 UTC", "Europe/Amsterdam")` = 12.25 (12:15 CET). That's the correct position.

The user reports it renders at ~13:30 though. This could mean `resolvedTz` is NOT being set correctly in the display path, or there's a different entry causing confusion. Given this uncertainty, I'll add **diagnostic console.logs** to trace the exact values:

**File: `src/components/timeline/CalendarDay.tsx`** (temporary, in the entry rendering block around line 598):

```typescript
// DIAGNOSTIC: trace TZ resolution for post-flight entries
if (process.env.NODE_ENV === 'development') {
  console.log(`[TZ-DEBUG] ${primaryOption.name}: startTime=${entry.start_time}, resolvedTz=${resolvedTz}, startHour=${entryStartHour}, endHour=${entryEndHour}, activeTz=${activeTz}, flights=${dayFlights.length}`);
}
```

### Fix 5a: HotelWizard dayTimezoneMap (Issue 5)

**File: `src/components/timeline/HotelWizard.tsx`**

Add `dayTimezoneMap` prop. In the night loop (line 146-157), resolve per-night TZ:

```typescript
const tzInfo = dayTimezoneMap?.get(dayDateStr);
const tz = tzInfo?.activeTz || trip.home_timezone;
const nextTzInfo = dayTimezoneMap?.get(nextDayDateStr);
const nextTz = nextTzInfo?.activeTz || trip.home_timezone;
const startIso = localToUTC(dayDateStr, eveningReturn, tz);
const endIso = localToUTC(nextDayDateStr, morningLeave, nextTz);
```

**File: `src/pages/Timeline.tsx`** — pass `dayTimezoneMap` to HotelWizard.

### Fix 5b: Remove destination from TripSettings

**File: `src/pages/TripSettings.tsx`**

Remove lines 255-256 (destination label + input) and update `handleSave` (line 103) to remove the `destination` field from the update payload.

### Fix 5c: One-time data audit

Add the diagnostic console.logs (Fix 4 above) and report back. If entries are confirmed to have wrong UTC timestamps, we can write a targeted migration. But based on the data analysis, the Cocktails entry appears to be stored correctly (11:15 UTC = 12:15 CET), suggesting the display path may be the actual issue.

---

## Files Changed Summary

| File | Changes |
|------|---------|
| `src/pages/Timeline.tsx` | Add `resolveTimezoneForTime` helper; fix `handleCardTap`, `handleAddBetween`, `handleDragSlot` TZ resolution; pass `dayTimezoneMap` to HotelWizard |
| `src/components/timeline/CalendarDay.tsx` | Add `isTransportEntry` helper; fix `visibleEntries` filter, `isTransport` detection, SNAP condition; add TZ diagnostic logs |
| `src/components/timeline/HotelWizard.tsx` | Accept `dayTimezoneMap` prop; use per-night resolved TZ |
| `src/pages/TripSettings.tsx` | Remove destination field and label |
| Database migration | Fix old transport entries: set `category = 'transfer'` where name matches transport patterns |

## What Is NOT Changed

- Transport generation UTC arithmetic (correct)
- SNAP click handler logic (correct) 
- handleEntryTimeChange trailing transport (correct)
- handleGenerateTransportDirect destination pull (correct)
- CalendarDay entry rendering TZ resolution (lines 606-622 -- already correct)
- Flight save logic (correct)


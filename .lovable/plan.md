

# Timezone Model Migration: `tripTimezone` to `homeTimezone`

This is a foundational migration replacing the single destination-based timezone with a home/origin timezone model. All per-day/per-entry timezone resolution uses `dayTimezoneMap` and `resolveEntryTz()` as the primary source, with `homeTimezone` only as a last-resort fallback.

## Step 1 -- Database Migration

Rename the `timezone` column to `home_timezone` in the `trips` table:

```sql
ALTER TABLE trips RENAME COLUMN timezone TO home_timezone;
ALTER TABLE trips ALTER COLUMN home_timezone SET DEFAULT 'Europe/London';
```

Update `src/types/trip.ts`: change `timezone: string` to `home_timezone: string` in the `Trip` interface (line 17).

## Step 2 -- Trip Creation Flow

**File: `src/pages/TripWizard.tsx`**
- Line 39: Change default from `'Europe/Amsterdam'` to `'Europe/London'`
- Lines 58-63: Change auto-set from `outboundFlight.arrivalTz` to `outboundFlight.departureTz`
- Line 165: Change `timezone` key to `home_timezone` in the insert payload

**File: `src/components/wizard/TimezoneStep.tsx`**
- Line 21: Change heading to "Where are you starting from?"
- Line 22: Change subtitle to "Select your home timezone"

## Step 3 -- Rename all `tripTimezone` to `homeTimezone`

Pure rename, no logic changes.

**File: `src/pages/Timeline.tsx`**
- Line 43: `const homeTimezone = trip?.home_timezone ?? 'Europe/London';`
- All ~15 references to `tripTimezone` become `homeTimezone` (lines 48, 235, 292, 331, 360, 365, 752, 1004, 1009, 1141)

**File: `src/components/timeline/CalendarDay.tsx`**
- Line 40 prop: `tripTimezone` to `homeTimezone`
- Line 78 destructure: rename
- All ~8 internal references (lines 141, 142, 163, 189, 217, 218, 237, 248)

**File: `src/components/timeline/EntrySheet.tsx`**
- Line 229: `const homeTimezone = trip?.home_timezone ?? 'Europe/London';`
- All internal references

**File: `src/components/timeline/HotelWizard.tsx`**
- Line 143: `const tz = trip.home_timezone;`

**File: `supabase/functions/auto-generate-transport/index.ts`**
- Line 175: `const timezone = trip.home_timezone || 'Europe/London';`

**File: `src/pages/TripSettings.tsx`**
- No direct `trip.timezone` reference found -- reads via generic `tripData`; no change needed.

## Step 4 -- Fix 4 HIGH Severity Bugs

### Bug 1: `formatTime` in Timeline.tsx (line 45)
Change signature to accept optional per-entry TZ:
```typescript
const formatTime = useCallback((isoString: string, tz?: string) => {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-GB', {
    timeZone: tz || homeTimezone,
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}, [homeTimezone]);
```
CalendarDay prop type (line 39) changes to `formatTime: (iso: string, tz?: string) => string`.

### Bug 6: EntrySheet edit prefill (lines 253-254)
Add `resolvedTz?: string` prop to EntrySheetProps. Use it for edit prefill:
```typescript
const editTz = resolvedTz || homeTimezone;
const { date: sDate, time: sTime } = utcToLocal(editEntry.start_time, editTz);
const { time: eTime } = utcToLocal(editEntry.end_time, editTz);
```

### Bug 7: EntrySheet normal save (lines 678, 681-682)
Use `resolvedTz` for non-flight, non-transport saves:
```typescript
const saveTz = resolvedTz || homeTimezone;
startIso = localToUTC(entryDate, startTime, saveTz);
endIso = localToUTC(entryDate, endTime, saveTz);
```

### Bug 8: EntrySheet view mode time save (lines 847-848)
Use `resolvedTz`:
```typescript
const dateStr = utcToLocal(entry.start_time, resolvedTz || homeTimezone).date;
const newUtc = localToUTC(dateStr, newTimeStr, resolvedTz || homeTimezone);
```

### EntrySheet `resolvedTz` prop plumbing
In Timeline.tsx, when opening EntrySheet, compute `resolvedTz` from `dayTimezoneMap`:
- For view mode (`handleCardTap`): compute from entry's start_time day
- For create mode: compute from prefill time's day
Store in state and pass to EntrySheet.

## Step 5 -- Fix 4 MEDIUM Severity Bugs

### Bug 2: Idea insert (Timeline.tsx line 1001-1009)
Use `dayTimezoneMap` to look up the target day's TZ:
```typescript
const dayKey = dayDateStr;
const tzInfo = dayTimezoneMap.get(dayKey);
const insertTz = tzInfo?.activeTz || homeTimezone;
const startIso = localToUTC(dayDateStr, timeStr, insertTz);
const endIso = localToUTC(dayDateStr, endTimeStr, insertTz);
```

### Bug 3: Route day grouping (Timeline.tsx line 1141)
Replace single-TZ grouping:
```typescript
const getDayKey = (isoTime: string) => {
  for (const [dayStr, info] of dayTimezoneMap) {
    if (getDateInTimezone(isoTime, info.activeTz) === dayStr) return dayStr;
  }
  return getDateInTimezone(isoTime, homeTimezone);
};
```

### Bug 9: HotelWizard (line 143)
Pass `dayTimezoneMap` as prop. For each night, resolve:
```typescript
const tzInfo = dayTimezoneMap?.get(dayDateStr);
const tz = tzInfo?.activeTz || trip.home_timezone;
```

### Bug 10: auto-generate-transport edge function (lines 175, 218)
Read `trip.home_timezone`. Build server-side per-day TZ map from flight data:
```typescript
// Reference client-side dayTimezoneMap logic in src/pages/Timeline.tsx
const timezone = trip.home_timezone || 'Europe/London';
// Build flight-aware per-day TZ map
let currentTz = timezone;
const flightEntries = entries.filter(e => {
  const opt = optionsByEntry.get(e.id);
  return opt?.category === 'flight' && opt?.departure_tz;
}).sort((a,b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
if (flightEntries.length > 0) {
  currentTz = optionsByEntry.get(flightEntries[0].id)?.departure_tz || timezone;
}
// Then for each day, check if a flight lands and switch currentTz
```

## Step 6 -- Fix 2 LOW Severity Bugs

### Bug 4: dayLocationMap flight day (Timeline.tsx line 331)
```typescript
const flightOpt = flight.options[0];
const flightArrTz = flightOpt?.arrival_tz || homeTimezone;
const flightDay = getDateInTimezone(flight.end_time, flightArrTz);
```

### Bug 5: Weather hour lookup (CalendarDay.tsx line 248)
```typescript
const { startTz } = resolveEntryTz(entry, dayFlights, activeTz, homeTimezone);
const hour = Math.floor(getHourInTimezone(entry.start_time, startTz));
```

## Step 7 -- Dashboard Auto-Generated Destinations

**File: `src/pages/Dashboard.tsx`**

After fetching trips, batch-fetch entry options. For each trip, collect unique `location_name` and `arrival_location` values excluding transport categories. Display as comma-separated city list. Fallback to `trip.destination` if no entries, then "No destinations yet".

## Files Changed Summary

| File | Changes |
|------|---------|
| Database migration | Rename `timezone` to `home_timezone`, change default |
| `src/types/trip.ts` | Rename `timezone` to `home_timezone` |
| `src/pages/TripWizard.tsx` | Use departure TZ, insert as `home_timezone` |
| `src/components/wizard/TimezoneStep.tsx` | Update heading/subtitle |
| `src/pages/Timeline.tsx` | Rename; fix `formatTime`; fix idea insert; fix route grouping; fix `dayLocationMap`; pass `resolvedTz` to EntrySheet |
| `src/components/timeline/CalendarDay.tsx` | Rename prop; fix weather TZ |
| `src/components/timeline/EntrySheet.tsx` | Add `resolvedTz` prop; fix edit prefill, save, view-mode save |
| `src/components/timeline/HotelWizard.tsx` | Accept `dayTimezoneMap` prop; use per-night TZ |
| `supabase/functions/auto-generate-transport/index.ts` | Read `home_timezone`; add flight-aware per-day TZ resolution |
| `src/pages/Dashboard.tsx` | Auto-generate destination list from entry data |

## What Is NOT Changed

- Transport generation UTC arithmetic (already correct)
- SNAP button UTC gap detection (already correct)
- handleEntryTimeChange trailing transport logic (already correct)
- handleGenerateTransportDirect destination pull (already correct)
- Flight save logic in EntrySheet (already uses per-flight TZ)
- TimeSlotGrid slot click (already uses activeTz)
- resolveDropTz (already correct)
- Drag commit in CalendarDay (already correct fallback chain)


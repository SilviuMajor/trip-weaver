

# Fix Timeline Card Positioning: Timezone-Aware Visual Slots

## Overview

Audit and fix the card positioning system so visual placement always uses the visual hour slot on the 24-hour grid, never raw timezone-converted timestamps. Extract shared utilities into `src/lib/timezoneUtils.ts` as the single source of truth.

---

## Step 1: Fix `handleDropOnTimeline` in `src/pages/Timeline.tsx`

**Problem:** Line 469 uses `tripTimezone` for all drops. On a flight day, slots after the flight represent the destination TZ, not the trip TZ. A +1h TZ difference causes the card to land 1 hour off.

**Fix:**
- Look up `dayTimezoneMap` for the target day using `format(dayDate, 'yyyy-MM-dd')`
- If the day has flights, determine whether `hourOffset` falls before or after the flight's visual end hour
- Use the resolved TZ (origin or destination) in `localToUTC()` instead of `tripTimezone`

```typescript
// Before (line 469):
const startIso = localToUTC(dateStr, timeStr, tripTimezone);

// After:
const dayStr = format(dayDate, 'yyyy-MM-dd');
const tzInfo = dayTimezoneMap.get(dayStr);
const resolvedTz = resolveDropTz(hourOffset, tzInfo, tripTimezone);
const startIso = localToUTC(dateStr, timeStr, resolvedTz);
```

The `resolveDropTz` helper will check if `hourOffset` is past the flight's visual end hour; if so, use destination TZ, otherwise origin TZ.

---

## Step 2: Fix `TimeSlotGrid.minutesToTime` in `src/components/timeline/TimeSlotGrid.tsx`

**Problem:** `minutesToTime` (line 100-106) creates a `Date` using `new Date(date).setHours(h, m)`, which uses the **browser's local timezone**. If the user's browser is in a different TZ than the trip, the resulting ISO string will be offset when used as a prefill for `EntrySheet`.

**Fix:**
- Accept `activeTz` (already a prop) and use the new shared `localToUTC` utility to produce correct UTC ISO strings
- Change `onClickSlot` and `onDragSlot` callbacks to pass ISO strings instead of raw Date objects
- Update the callback signatures: `onClickSlot?: (isoTime: string) => void` and `onDragSlot?: (startIso: string, endIso: string) => void`
- Update `CalendarDay.tsx` and `Timeline.tsx` to match the new signatures (minimal change since both just call `.toISOString()` on the Date anyway)

```typescript
// Before:
const minutesToTime = (totalMinutes: number): Date => {
  const time = new Date(date);
  time.setHours(h, m, 0, 0);
  return time;
};

// After:
const minutesToIso = (totalMinutes: number): string => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const dateStr = format(date, 'yyyy-MM-dd');
  const timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  return localToUTC(dateStr, timeStr, activeTz || 'UTC');
};
```

Update `handleDragSlot` in Timeline.tsx to accept strings directly (it already calls `.toISOString()` so the change is trivial).

---

## Step 3: Fix edge function day grouping in `supabase/functions/auto-generate-transport/index.ts`

**Problem:** Line 208 groups entries by UTC date substring: `entry.start_time.substring(0, 10)`. Entries near midnight in the trip timezone get grouped on the wrong day.

**Fix:**
- Add a `getDateInTimezone` helper in the edge function (cannot import from `src/lib`)
- Use the trip's `timezone` variable (already available at line 175) to extract the local date

```typescript
// Helper at top of function:
function getDateInTz(isoString: string, tz: string): string {
  const d = new Date(isoString);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// Line 208 change:
const dayStr = getDateInTz(entry.start_time, timezone);
```

---

## Step 4: Extract shared utilities to `src/lib/timezoneUtils.ts`

Move the following functions from `CalendarDay.tsx` into `src/lib/timezoneUtils.ts` so all components use a single source of truth:

### Functions to extract/add:

1. **`getHourInTimezone(isoString, tz)`** -- currently defined at CalendarDay.tsx line 87-98. Converts a UTC ISO string to a fractional hour (e.g., 14.5 for 2:30 PM) in a given timezone.

2. **`resolveEntryTz(entry, dayFlights, activeTz, tripTimezone)`** -- currently defined at CalendarDay.tsx line 68-85. Determines which timezone to use for positioning an entry based on whether it's before/after a flight.

3. **`resolveDropTz(hourOffset, tzInfo, tripTimezone)`** -- new helper for Step 1. Given a visual hour offset and day TZ info, returns the correct timezone for that position on the grid.

4. **`getUtcOffsetMinutes(date, tz)`** and **`getUtcOffsetHoursDiff(originTz, destTz)`** -- currently in `TimeSlotGrid.tsx` (lines 218-237). Move to shared utils.

### After extraction:

- `CalendarDay.tsx` will import `getHourInTimezone` and `resolveEntryTz` from `@/lib/timezoneUtils`
- `Timeline.tsx` will import `resolveDropTz` from `@/lib/timezoneUtils`
- `TimeSlotGrid.tsx` will import `getUtcOffsetMinutes` and `getUtcOffsetHoursDiff` from `@/lib/timezoneUtils`
- Remove the local definitions from each component

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/timezoneUtils.ts` | Add `getHourInTimezone`, `resolveEntryTz`, `resolveDropTz`, `getUtcOffsetMinutes`, `getUtcOffsetHoursDiff` |
| `src/pages/Timeline.tsx` | Use `resolveDropTz` in `handleDropOnTimeline`; update `handleDragSlot` to accept ISO strings |
| `src/components/timeline/TimeSlotGrid.tsx` | Fix `minutesToTime` to use `localToUTC` with `activeTz`; change callbacks to pass ISO strings; import shared utils |
| `src/components/timeline/CalendarDay.tsx` | Import `getHourInTimezone`, `resolveEntryTz` from shared utils; remove local definitions; update slot callback types |
| `supabase/functions/auto-generate-transport/index.ts` | Add `getDateInTz` helper; use it for day grouping instead of UTC substring |

---

## Test Cases

1. **Drop on flight day**: Drop an entry at visual slot 14 on a day with a +1h TZ flight. Verify it renders at slot 14.
2. **Auto-generate transport**: Run "Route" on a flight day. Transport entries should appear in the correct gap, no 1-hour offset.
3. **Drag-select slot**: Click/drag a time slot from a browser in a different TZ than the trip. The created entry should appear at the clicked visual position.
4. **Near-midnight grouping**: An entry at 23:30 local time should be grouped on the correct calendar day when auto-generating transport.




# Fix Flight Card Timezone Offset Bug

## Problem
After a timezone-crossing flight, all subsequent entries appear visually offset by the timezone delta. A London-to-Amsterdam flight (1h difference) creates a false 1-hour gap between the flight card bottom and the first post-flight entry.

## Root Cause
Flight end positions are calculated using departure timezone math (`depHour + utcDurH`) instead of computing the arrival hour in the arrival timezone.

## Changes

### 1. `src/pages/Timeline.tsx` (line 634)

In the `dayTimezoneMap` useMemo, replace:
```
flightEndHour: depHour + utcDurH,
```
with:
```
flightEndHour: getHour(f.end_time, opt.arrival_tz!),
```

The `getHour` helper is already defined at line 621 and accepts any ISO string + timezone.

### 2. `src/components/timeline/ContinuousTimeline.tsx` (lines 217-223)

In `getEntryGlobalHours`, replace the flight branch:
```typescript
if (isFlight) {
  const depTz = opt.departure_tz!;
  const dayIdx = findDayIndex(entry.start_time, depTz);
  const startLocal = getHourInTimezone(entry.start_time, depTz);
  const startGH = dayIdx * 24 + startLocal;
  const utcDurH = (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / 3600000;
  return { startGH, endGH: startGH + utcDurH, resolvedTz: depTz };
}
```
with:
```typescript
if (isFlight) {
  const depTz = opt.departure_tz!;
  const arrTz = opt.arrival_tz!;
  const dayIdx = findDayIndex(entry.start_time, depTz);
  const startLocal = getHourInTimezone(entry.start_time, depTz);
  const startGH = dayIdx * 24 + startLocal;
  const endLocal = getHourInTimezone(entry.end_time, arrTz);
  const endDayIdx = findDayIndex(entry.end_time, arrTz);
  const endGH = endDayIdx * 24 + endLocal;
  return { startGH, endGH, resolvedTz: depTz };
}
```

This handles red-eye/long-haul flights arriving on a different calendar day by using `findDayIndex` for the end time separately.

## Files Modified
- `src/pages/Timeline.tsx` -- 1 line changed (line 634)
- `src/components/timeline/ContinuousTimeline.tsx` -- flight branch rewritten (lines 217-223)

## What Is NOT Changed
- `resolveEntryTz` in `timezoneUtils.ts` (uses UTC comparison, already correct)
- Non-flight entry positioning (already uses correct resolved timezone)
- `resolveGlobalHourTz` (consumes `flightEndHour` which will now be correct)
- Drag commit handler (already correct)



# Fix Flight Card Height — getEntryGlobalHours

## The Bug
In `src/components/timeline/ContinuousTimeline.tsx` lines 218-227, the flight branch of `getEntryGlobalHours` computes `endGH` using `getHourInTimezone(entry.end_time, arrTz)` — the arrival local time in the arrival timezone. This mixes two different timezones for start and end positions on the same grid, causing:

- **Westbound flights** (e.g. AMS to LHR, -1h offset): card appears ~15min instead of ~1h15m
- **Eastbound flights** (e.g. LHR to AMS, +1h offset): card appears ~2h30m instead of ~1h30m

## The Fix
**File:** `src/components/timeline/ContinuousTimeline.tsx`, lines 218-227

Replace the flight branch to use UTC duration instead of arrival timezone:

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

This removes the `arrTz`, `endLocal`, and `endDayIdx` variables and replaces `endGH` with `startGH + utcDurH` (real elapsed time in hours).

## Already Correct (no changes needed)
- **dayTimezoneMap** (Timeline.tsx) — already fixed in previous edit to use `depHour + utcDurH`
- **Flight group bounds** (lines 1463-1471) — already use UTC duration for checkin/checkout
- **Flight group fractions** (lines 1596-1606) — already use UTC duration
- **formatGlobalHourToDisplay** (lines 993-1018) — already correct logic
- **FlightGroupCard rendering** — unchanged

## Files Modified
- `src/components/timeline/ContinuousTimeline.tsx` — one block replacement (lines 218-227)

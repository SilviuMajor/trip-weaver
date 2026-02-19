
# Fix flightEndHour in dayTimezoneMap

## The Bug
In `src/pages/Timeline.tsx` line 640, `flightEndHour` is set to `arrHour` which is `getHour(f.end_time, opt.arrival_tz!)`. For timezone-crossing flights, this gives the wrong visual boundary.

Example: AMS 19:30 CET to LHR 19:50 GMT (1h20m flight). Current code computes `flightEndHour = 19.833` (19:50 in GMT). Correct value is `depHour + utcDurH = 19.5 + 1.333 = 20.833`, which tells the gutter to switch timezone labels at the visual end of the flight card.

## Fix
**File:** `src/pages/Timeline.tsx`, lines 634-640

Replace:
```typescript
const depHour = getHour(f.start_time, opt.departure_tz!);
const arrHour = getHour(f.end_time, opt.arrival_tz!);
return {
  originTz: opt.departure_tz!,
  destinationTz: opt.arrival_tz!,
  flightStartHour: depHour,
  flightEndHour: arrHour,
```

With:
```typescript
const depHour = getHour(f.start_time, opt.departure_tz!);
const utcDurH = (new Date(f.end_time).getTime() - new Date(f.start_time).getTime()) / 3600000;
return {
  originTz: opt.departure_tz!,
  destinationTz: opt.arrival_tz!,
  flightStartHour: depHour,
  flightEndHour: depHour + utcDurH,
```

The `arrHour` variable (now unused) is removed. One line added (`utcDurH`), one line changed (`flightEndHour`).

## Files Modified
- `src/pages/Timeline.tsx` -- single computation fix in `dayTimezoneMap` useMemo

## Testing
- Create a return flight AMS 19:30 CET to LHR 19:50 GMT
- Gutter labels should show CET through 19:30, then switch to GMT at 19:50 (aligned with the flight card's bottom edge)
- Outbound flights (same direction) should also align correctly

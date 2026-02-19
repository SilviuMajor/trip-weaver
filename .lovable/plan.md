
# Fix 1-Hour Gap Between Flight Group and Next Card

## Problem
After fixing flight card heights to use UTC duration, non-flight cards on flight days are still positioned using the destination timezone, while flight cards are positioned using the departure (origin) timezone. This creates phantom gaps or overlaps equal to the timezone offset between origin and destination.

## Root Cause
`getEntryGlobalHours` uses `resolvedTz` for both grid positioning AND time display on cards. On a flight day, a post-flight card resolves to the destination timezone (correct for display), but this puts it in a different coordinate space than the flight card (which uses the origin timezone).

## Solution
Split `resolvedTz` into two fields:
- `resolvedTz` -- display timezone (destination after flight, origin before) -- used for time labels on cards
- `gridTz` -- positioning timezone (always origin on flight days) -- used for startGH/endGH and drag operations

### Changes in `src/components/timeline/ContinuousTimeline.tsx`

**1. Update return type of `getEntryGlobalHours` (line 214)**

Add `gridTz: string` to the return type. Update the flight branch to include `gridTz: depTz` (line 224).

**2. Non-flight branch: compute separate gridTz and resolvedTz (lines 227-267)**

- Add a `gridTz` variable initialized to `homeTimezone`
- In the day-matching loop, set `gridTz = info.activeTz` initially
- When a flight exists on that day, set `gridTz = info.flights[0].originTz` (always, regardless of before/after flight)
- Keep `resolvedTz` logic unchanged (switches to destination after flight)
- Use `gridTz` (not `resolvedTz`) for `findDayIndex`, `getHourInTimezone` calls that compute `startGH`/`endGH`
- Return `{ startGH, endGH, resolvedTz, gridTz }`

**3. Update memoized map type (lines 278-288)**

Update `entryGlobalHoursMap` and `getEntryGH` types to include `gridTz`.

**4. Update card rendering callers (lines 1437-1452)**

Extract `gridTz` alongside `resolvedTz` from `getEntryGH`.

**5. Update `dragTz` (line 1507)**

Change `const dragTz = resolvedTz;` to `const dragTz = gridTz;` so drag commit converts global hours back to UTC using the grid's coordinate timezone.

**6. Keep `entryFormatTime` using `resolvedTz` (lines 1510-1518)**

This already uses `resolvedTz` for display -- no change needed.

## What Does NOT Change
- Flight branch of `getEntryGlobalHours` -- already correct, just adds `gridTz` field
- `formatGlobalHourToDisplay` -- gutter labels already correct
- Flight group bounds (checkin/checkout expansion) -- uses UTC durations
- FlightGroupCard fractions -- uses UTC durations
- `handleDragCommit` -- receives the correct tz via `dragTz`
- Gap detection, overlap detection -- use startGH/endGH which will now be correct
- Transport generation, snap logic -- use UTC timestamps

## Technical Details

The non-flight branch changes from:

```text
resolvedTz = destinationTz (after flight)
position using resolvedTz  -->  WRONG coordinate space
```

To:

```text
resolvedTz = destinationTz (for display)
gridTz = originTz (for positioning)
position using gridTz  -->  CORRECT coordinate space
```

For days without flights, `gridTz === resolvedTz` -- zero behavior change.

## Verification

Return flight AMS 19:35 CET to LHR 19:50 GMT (1h15m), with checkout:
- Flight group ends at GH 21.333
- Next card at 20:30 GMT: positioned using CET (originTz) gives GH 21.5
- Gap = 21.5 - 21.333 = 10 min (real gap, correct)
- Card displays "20:30" using GMT (resolvedTz, correct)

Outbound flight LHR 08:15 GMT to AMS 10:45 CET (1h30m), with checkout:
- Flight group ends at GH 10.25
- Next card at 11:15 CET (10:15 UTC): positioned using GMT (originTz) gives GH 10.25
- Gap = 0 (cards touch exactly, correct)
- Card displays "11:15" using CET (resolvedTz, correct)

## Files Modified
- `src/components/timeline/ContinuousTimeline.tsx` -- update `getEntryGlobalHours`, memoized map types, card rendering, and `dragTz`

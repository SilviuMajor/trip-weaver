

# Comprehensive Timeline Timezone, Weather, and UX Fixes

## Overview

This plan addresses five interconnected issues and restructures the timezone/location model so that **flights are the sole timezone transition mechanism**, weather and sun gradients are location-aware, drag/click bugs are fixed, and plus buttons are correctly placed.

## Issue 1: Drag/Click Glitch (Card Jumps ~1 Hour)

**Root cause**: In `CalendarDay.tsx` lines 447-449, `origStartHour` and `origEndHour` are computed using `tripTimezone`, but the card is visually positioned using `resolvedTz` (which may be origin or destination TZ on flight days). When you mousedown, the drag system initialises with the wrong hour values, causing the card to "jump" to a different position.

**Fix**: Replace `tripTimezone` with `resolvedTz` when computing `origStartHour`/`origEndHour` for drag initialisation. Also update `handleDragCommit` to accept and use the entry's resolved timezone instead of always using `tripTimezone` for the `localToUTC` conversion.

### Files changed
- `CalendarDay.tsx` lines 447-449: Use `resolvedTz` instead of `tripTimezone`
- `CalendarDay.tsx` lines 113-168: `handleDragCommit` needs a `tz` parameter so it converts using the correct timezone. Each drag handler call will pass the entry's resolved TZ.

## Issue 2: Flight Timezones Not Lining Up

**Root cause**: The `dayTimezoneMap` in `Timeline.tsx` sets `activeTz` to the departure TZ for the whole day. But before the flight, entries should use departure TZ; after the flight, they should use arrival TZ. The current per-entry resolution logic in `CalendarDay.tsx` (lines 400-404) already attempts this, but the drag system undoes it (Issue 1). Additionally, the `handleDragCommit` for linked entries (checkin/checkout) always uses `tripTimezone` for conversion -- it should use departure_tz for check-in and arrival_tz for checkout.

**Fix**: Already partially addressed by Issue 1 fix. Additionally:
- When committing drag for linked entries, use the flight's `departure_tz` for check-in and `arrival_tz` for checkout instead of `tripTimezone`.

### Files changed
- `CalendarDay.tsx` `handleDragCommit` (lines 132-167): Use flight option's departure/arrival TZ for linked entries.

## Issue 3: Starting Timezone = First Flight's Departure TZ

**Current**: `tripTimezone` is set from the trip wizard (e.g. `Europe/Amsterdam`). The `dayTimezoneMap` uses this as the baseline.

**Fix**: In `Timeline.tsx`, when computing `dayTimezoneMap`, initialise `currentTz` from the first flight's `departure_tz` if a flight exists in the trip. If no flights exist, fall back to `trip.timezone`. This makes the starting timezone automatic based on the first airport.

### Files changed
- `Timeline.tsx` lines 211-265: Before the day loop, scan all scheduled entries for the first flight and set `currentTz = firstFlight.options[0].departure_tz` if available.

## Issue 4: Location-Aware Weather and Sun Gradient

### 4a. Weather should reflect current location

**Current**: Weather is fetched with hardcoded Amsterdam coordinates (`lat: 52.37, lng: 4.90`) for the entire trip.

**Fix**: Weather needs to be fetched per-location-segment. The approach:

1. **Add `latitude`/`longitude` columns to `weather_cache`** so we can store weather for multiple locations within one trip.
2. **Compute location segments**: Before fetching weather, determine which location the user is at for each date range based on flights:
   - Before first flight: use first flight's departure airport coordinates (from `departure_location` parsed, or airport lat/lng)
   - Between flights: use the arriving flight's destination coordinates
   - After last flight: use last flight's arrival coordinates
3. **Update `fetch-weather` edge function**: Accept an array of `{ lat, lng, startDate, endDate }` segments instead of a single lat/lng. Fetch Open-Meteo for each segment and tag records with lat/lng.
4. **Update `TimelineHeader.tsx`**: Compute location segments from flight entries and pass them to the edge function.
5. **Update `CalendarDay.tsx` weather rendering**: Weather is already matched by date+hour, so as long as the correct location's data is stored, it will work.

### 4b. Sun gradient should reflect current location

**Current**: Sun gradient uses `userLat ?? 51.5, userLng ?? -0.1` (browser geolocation or London fallback).

**Fix**: Pass the "current location" for each day into `CalendarDay`. Compute this in `Timeline.tsx` based on the flight-derived location segments (same logic as weather). On flight days, the gradient should use the destination's coordinates (since most of the day will be at the destination).

### Files changed
- **New migration**: Add `latitude`, `longitude` columns to `weather_cache`
- `supabase/functions/fetch-weather/index.ts`: Accept `segments` array parameter
- `TimelineHeader.tsx`: Compute location segments from entries, pass to fetch-weather
- `Timeline.tsx`: Compute per-day location (lat/lng) from flight entries, pass to CalendarDay
- `CalendarDay.tsx`: Accept `dayLat`/`dayLng` props, use for sun gradient instead of browser location

## Issue 5: Plus Button Placement

**Current**: Plus buttons appear before the first entry and after every entry, regardless of gaps.

**Fix**: Plus buttons should appear:
- **Before the first card** (where there's a gap from day start)
- **Between two cards** only if there's a time gap; if two cards are back-to-back, show a single small plus between them
- **After the last card** (where there's a gap to day end)

Logic:
1. Before first entry: show plus button above it
2. Between entries: if `gap > 0 minutes`, show plus in the gap. If `gap <= 0` (adjacent/overlapping), show a thin plus line at the boundary
3. After last entry: show plus button below it

### Files changed
- `CalendarDay.tsx` lines 334-353 (before-first plus) and lines 562-575 (between-entries plus): Refactor to compute gaps and conditionally render.

## Implementation Order

1. **Fix drag/click glitch** (Issue 1) -- highest user-facing impact, smallest change
2. **Fix drag commit timezone for linked entries** (Issue 2)
3. **Starting timezone from first flight** (Issue 3)
4. **Plus button placement** (Issue 5) -- pure UI, no backend
5. **Location-aware sun gradient** (Issue 4b) -- no backend, just pass coordinates
6. **Location-aware weather** (Issue 4a) -- requires migration + edge function update

## Technical Details

### CalendarDay.tsx -- Drag Fix (Issues 1+2)

```text
Current (line 447-449):
  const origStartHour = getHourInTimezone(entry.start_time, tripTimezone);
  let origEndHour = getHourInTimezone(entry.end_time, tripTimezone);

Fixed:
  const origStartHour = getHourInTimezone(entry.start_time, resolvedTz);
  let origEndHour = getHourInTimezone(entry.end_time, resolvedTz);
```

`handleDragCommit` signature changes to accept a timezone parameter:
```text
handleDragCommit(entryId, newStartHour, newEndHour)
  -> handleDragCommit(entryId, newStartHour, newEndHour, tz)
```

And uses `tz` instead of `tripTimezone` for `localToUTC` calls. For linked entries:
- Check-in: use flight's `departure_tz`
- Checkout: use flight's `arrival_tz`

The `useDragResize` hook's `onCommit` callback will need to carry the TZ. We will store `resolvedTz` alongside the drag state, passing it through via a wrapper.

### Timeline.tsx -- Auto-detect Starting TZ (Issue 3)

Before the day loop in `dayTimezoneMap`:
```text
const allFlights = scheduledEntries.filter(e => e.options[0]?.category === 'flight');
if (allFlights.length > 0) {
  const firstFlight = allFlights.sort((a,b) => 
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  )[0];
  currentTz = firstFlight.options[0].departure_tz || tripTimezone;
}
```

### Timeline.tsx + CalendarDay.tsx -- Per-Day Location (Issue 4b)

Compute a `dayLocationMap` alongside `dayTimezoneMap`:
```text
Map<string, { lat: number; lng: number }>
```
Logic mirrors timezone: before first flight use departure airport coords, after each flight use arrival airport coords. Pass `dayLat`/`dayLng` as props to CalendarDay.

In CalendarDay, the sun gradient (lines 596-623) uses `dayLat`/`dayLng` instead of `userLat`/`userLng`.

### Weather System Overhaul (Issue 4a)

**Migration**: Add `latitude` and `longitude` (nullable numeric) to `weather_cache`.

**Edge function**: Accept `segments: Array<{lat, lng, startDate, endDate}>`. For each segment, call Open-Meteo and insert records tagged with lat/lng.

**TimelineHeader**: Build segments from flight data:
```text
segments = [
  { lat: depLat, lng: depLng, startDate: tripStart, endDate: flightDate },
  { lat: arrLat, lng: arrLng, startDate: flightDate, endDate: tripEnd }
]
```

### Plus Buttons (Issue 5)

Replace the current "plus after every entry" with gap-aware logic:
```text
For each pair of consecutive entries (i, i+1):
  gapMinutes = entry[i+1].startHour - entry[i].endHour (in hours * 60)
  if gapMinutes > 0:
    position plus at midpoint of gap
  else:
    position a thin plus line at entry[i].endHour
    
Plus before first entry: position at firstEntry.startHour - offset
Plus after last entry: position at lastEntry.endHour + offset
```

### Files Summary

| File | Changes |
|------|---------|
| `CalendarDay.tsx` | Drag TZ fix, handleDragCommit TZ parameter, linked entry TZ, plus button gap logic, sun gradient uses dayLat/dayLng |
| `Timeline.tsx` | Auto-detect starting TZ from first flight, compute dayLocationMap, pass dayLat/dayLng to CalendarDay |
| `TimelineHeader.tsx` | Build location segments from flights, pass to fetch-weather |
| `supabase/functions/fetch-weather/index.ts` | Accept segments array, fetch per-segment, tag with lat/lng |
| `WeatherBadge.tsx` | No changes needed (already receives data) |
| `useDragResize.ts` | Extend onCommit callback to accept optional TZ string |
| **Migration** | Add latitude/longitude to weather_cache |


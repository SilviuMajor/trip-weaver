

# Entry-Aware Weather — Follow the User's Location

## Overview
Replace the current one-location-per-day weather system with an entry-aware approach that tracks where the user actually is throughout the day based on their scheduled entries.

## Current Behavior
- `dayLocationMap` computes one `{lat, lng}` per day based on flights only
- `handleGlobalRefresh` groups consecutive days with the same location into segments
- Edge function fetches all 24 hours per segment from Open-Meteo
- No hour-level granularity -- a flight day gets one city's weather for the entire day

## Changes

### File 1: `supabase/functions/fetch-weather/index.ts`

**Add hour filtering to the Segment interface and record insertion loop.**

- Add optional `startHour` and `endHour` fields to the `Segment` interface
- In the record-building loop, skip hours outside the bounds on boundary dates:
  - If `startHour` is set and the record is on `startDate` with hour less than `startHour`, skip
  - If `endHour` is set and the record is on `endDate` with hour greater than `endHour`, skip
- Segments without hour bounds work exactly as before (backward compatible)

### File 2: `src/pages/Timeline.tsx` -- `handleGlobalRefresh` (lines 1054-1079)

**Replace the segment-building logic with entry-aware waypoints.**

The new approach:

1. **Collect waypoints** from ALL scheduled entries with coordinates:
   - Regular entries: waypoint at `start_time` with the entry's lat/lng
   - Flight entries: waypoint at `end_time` (landing) with arrival coords; also waypoint at checkin `start_time` with departure coords
   - Skip transport/checkin/checkout entries (they inherit from their linked flight)

2. **For each hour of the trip**, find the nearest waypoint by absolute time distance and assign its location. This naturally handles:
   - Flight days: location switches at landing
   - Day trips: entries in a different city get that city's weather
   - Gaps: hours with no entries inherit the nearest entry's location

3. **Round locations to ~10km grid** (`Math.round(lat * 10) / 10`) so nearby locations group together (weather is city-level)

4. **Group consecutive hours** with the same rounded location into segments with `startHour`/`endHour` bounds

5. **Clean up**: remove hour bounds from segments that cover full days (startHour=0, endHour=23)

6. **Update dependency array** to include `scheduledEntries` instead of `dayLocationMap`

### What Does NOT Change
- `dayLocationMap` -- still used by sun gradient (per-day resolution is fine for sunrise/sunset)
- Weather rendering in `ContinuousTimeline.tsx` -- `weatherData.find()` still works because each date+hour has exactly one record
- `WeatherBadge` component -- no changes
- Weather cache deletion -- edge function already deletes all trip weather before inserting

## Technical Details

### Edge function changes (fetch-weather/index.ts)

```typescript
interface Segment {
  lat: number;
  lng: number;
  startDate: string;
  endDate: string;
  startHour?: number;
  endHour?: number;
}
```

Record filtering added inside the existing loop:
```typescript
if (seg.startHour != null && dateStr === seg.startDate && hour < seg.startHour) continue;
if (seg.endHour != null && dateStr === seg.endDate && hour > seg.endHour) continue;
```

### handleGlobalRefresh changes (Timeline.tsx)

Replace lines 1054-1079 (the segment-building section between `refreshDays` and the `await Promise.all`) with the waypoint-based approach described above. The `refreshDays` computation stays. The `await Promise.all` call stays. Only the segment construction changes.

The dependency array changes from `[tripId, trip, dayLocationMap]` to `[tripId, trip, scheduledEntries, days, homeTimezone]` since we now read entries directly.

### Example: Flight day (AMS 19:35 CET to LHR 19:50 GMT)

- Waypoints: hotel checkin at 06:00 (lat 52.4), museum at 10:00 (lat 52.4), flight lands 19:50 UTC (lat 51.5)
- Hours 0-19: nearest waypoint is Amsterdam entries -> Amsterdam weather
- Hours 20-23: nearest waypoint is London landing -> London weather
- Result: weather follows the user across the flight boundary

## Files Modified
- `supabase/functions/fetch-weather/index.ts` -- add hour filtering to Segment interface and record loop
- `src/pages/Timeline.tsx` -- replace segment-building in `handleGlobalRefresh` with entry-aware waypoints

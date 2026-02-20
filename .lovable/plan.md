

# Fix Weather -- Missing Airport Coords + Auto-Refresh After Card Movement

## Overview
Two bugs fixed: (1) flights from TripWizard lack airport lat/lng on options, breaking weather location tracking, and (2) weather never recalculates after dragging cards on the timeline.

## Changes

### 1. `src/pages/TripWizard.tsx` -- Store airport coordinates on flight entries

**a) Add IATA lookup at top of `createFlightEntry`** (line 83-84):
- Extract `depIata`/`arrIata` from departure/arrival location strings
- Look up `depAirport`/`arrAirport` from AIRPORTS array

**b) Add `latitude`/`longitude` to flight option insert** (lines 99-112):
- Add `latitude: arrAirport?.lat ?? null, longitude: arrAirport?.lng ?? null` (arrival coords, matching EntrySheet convention)

**c) Add coords to checkin option** (lines 128-136):
- Add `departure_location`, `latitude: depAirport?.lat`, `longitude: depAirport?.lng`
- Change `location_name` from truncated IATA to full location string

**d) Add coords to checkout option** (lines 151-158):
- Add `arrival_location`, `latitude: arrAirport?.lat`, `longitude: arrAirport?.lng`
- Change `location_name` from truncated IATA to full location string

### 2. `src/pages/Timeline.tsx` -- IATA fallback in `dayLocationMap`

**a) Add import** (line 7 area):
- `import AIRPORTS from '@/lib/airports';`

**b) Replace `dayLocationMap` useMemo** (lines 657-723):
- Add `airportCoords` helper that extracts IATA from "LHR - Heathrow" strings and looks up coords in AIRPORTS array
- Before first flight: try checkin entry coords, then IATA lookup on `departure_location`, then option lat/lng
- After each flight: try checkout entry coords, then IATA lookup on `arrival_location`, then option lat/lng

### 3. `src/pages/Timeline.tsx` -- IATA fallback in weather segment builder

**Replace waypoint loop in `handleGlobalRefresh`** (lines 1076-1106):
- Add same `airportCoords` helper
- For flights: get arrival coords from option lat/lng OR IATA lookup; get departure coords from checkin entry OR IATA lookup
- Skip the early `continue` for entries without coords -- only skip non-flight entries without coords
- Departure waypoint uses `entry.start_time` (not checkin start) for consistency

### 4. `src/pages/Timeline.tsx` -- Auto-refresh weather after card movement

**a) Add `weatherRefreshTimer` ref** (near line 205, with other refs):
- `const weatherRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);`

**b) Add `refreshWeather` function** (after `handleGlobalRefresh` closing at line 1175):
- Lightweight weather-only refresh (no transport regeneration)
- Duplicates the weather segment building logic from `handleGlobalRefresh` (with IATA fallback)
- Calls `fetch-weather` edge function then `fetchDataRef.current?.()`
- Wrapped in `useCallback` with deps on `[tripId, trip, scheduledEntries]`

**c) Add debounced trigger at end of `handleEntryTimeChange`** (before line 1452's closing `};`):
- Clear any existing timer, set new 2-second timeout calling `refreshWeather()`
- Prevents excessive API calls during rapid drag sequences

## Technical Details

The `airportCoords` helper used in both `dayLocationMap` and `handleGlobalRefresh`:
```text
airportCoords("LHR - Heathrow") -> { lat: 51.47, lng: -0.46 }
airportCoords(null) -> null
```

Priority chain for flight location resolution:
```text
Departure: checkin entry coords -> IATA lookup -> option coords
Arrival: checkout entry coords -> IATA lookup -> option coords (flight option stores arrival)
```

Weather auto-refresh debounce:
```text
Card move -> clear timer -> set 2s timer -> refreshWeather()
Another card move within 2s -> clear timer -> set new 2s timer
Only the last move triggers the actual API call
```

## What does NOT change
- `handleGlobalRefresh` structure (still does transport + weather on manual refresh)
- `fetch-weather` edge function
- `EntrySheet.tsx` (already stores coords correctly)
- ContinuousTimeline.tsx, HotelWizard.tsx, any wizard UI
- Database schema

## Files modified
| File | Change |
|------|--------|
| `src/pages/TripWizard.tsx` | Add airport lat/lng to flight option, checkin, and checkout entries |
| `src/pages/Timeline.tsx` | Import AIRPORTS, IATA fallback in dayLocationMap + weather segments, refreshWeather function, debounced auto-refresh after card movement |




# Fix Flight Transport -- Airport Coordinates + Auto-Generate

## Summary
Three fixes: (1) add lat/lng to all ~410 airports, (2) propagate coordinates when selecting/parsing airports so flight entry_options and checkin/checkout entries store real coordinates, (3) auto-generate transport after flight creation, and (4) update address resolution to prefer coordinates for flights.

---

## Files Modified

### 1. `src/lib/airports.ts`
- Add `lat` and `lng` fields to the `Airport` interface
- Add real terminal-area coordinates to all ~410 airports in the AIRPORTS array
- This is the largest change by line count but purely data

### 2. `src/components/timeline/EntrySheet.tsx`

**2a. Add coordinate state variables** (after line 131):
```typescript
const [departureLat, setDepartureLat] = useState<number | null>(null);
const [departureLng, setDepartureLng] = useState<number | null>(null);
const [arrivalLat, setArrivalLat] = useState<number | null>(null);
const [arrivalLng, setArrivalLng] = useState<number | null>(null);
```

**2b. Update airport change handlers** (currently ~line 506-514 area, the `handleDepartureAirportChange` / `handleArrivalAirportChange` which are called by `AirportPicker`):
- Add `setDepartureLat(airport.lat)` / `setDepartureLng(airport.lng)` in departure handler
- Add `setArrivalLat(airport.lat)` / `setArrivalLng(airport.lng)` in arrival handler

**2c. Update `applyParsedFlight`** (line 441): When matching airports by IATA code, also set lat/lng from the matched airport object.

**2d. Update flight option payload** (line 676-688): Set `latitude: isFlight ? arrivalLat : latitude` and `longitude: isFlight ? arrivalLng : longitude` on the option insert. Same for the edit update path (line 659-673).

**2e. Update checkin entry creation** (line 726-734): Add `latitude: departureLat`, `longitude: departureLng`, and use full `departureLocation` for `location_name`.

**2f. Update checkout entry creation** (line 745-753): Add `latitude: arrivalLat`, `longitude: arrivalLng`, use full `arrivalLocation` (not `.split(' - ')[0]`) for `location_name`.

**2g. Reset new state in `reset()`** (line 303): Add resets for the 4 coordinate states.

**2h. Update return flight handler** (line 804): When setting up return flight, swap the lat/lng too. Store them in ReturnFlightData or look up from AIRPORTS by IATA.

### 3. `src/lib/entryHelpers.ts`

**3a. Update `resolveFromAddress` and `resolveToAddress`**: For flights with coordinates, return coordinate string format `"lat,lng"` instead of text address. This ensures google-directions gets precise waypoints:

```typescript
export function resolveFromAddress(opt: { 
  category?: string | null; latitude?: number | null; longitude?: number | null;
  address?: string | null; location_name?: string | null; arrival_location?: string | null 
}): string | null {
  if (opt.category === 'flight') {
    if (opt.latitude != null && opt.longitude != null) return `${opt.latitude},${opt.longitude}`;
    return opt.arrival_location || null;
  }
  if (opt.latitude != null && opt.longitude != null) return `${opt.latitude},${opt.longitude}`;
  return opt.address || opt.location_name || opt.arrival_location || null;
}
```

Same pattern for `resolveToAddress`. This automatically fixes all transport generation paths (`handleSnapRelease`, gap buttons, etc.) since they all call these helpers.

### 4. `src/pages/Timeline.tsx`

**4a. Auto-generate transport after flight save** (in the `onSaved` callback, ~line 2839): After `fetchData()` returns fresh entries and the sheet entry refresh logic, add flight transport auto-generation:

- Check if `sheetEntry` was a flight (via `prefillCategory === 'flight'` or checking the fresh entry's category)
- Find checkout/checkin entries for the flight
- Find adjacent non-transport, non-airport-processing entries before/after the flight group
- Check no existing transport already bridges the gap
- Call `handleSnapRelease` for each gap (reuses existing transport creation logic)
- This runs after `fetchData()` so checkin/checkout entries exist in `freshEntries`

---

## What Is NOT Changed
- `AirportPicker` component -- just passes Airport objects, no UI changes
- `FlightGroupCard` rendering -- visual layout unchanged
- `google-directions` edge function -- already handles coordinate strings
- `auto-generate-transport` edge function -- already prefers lat/lng
- `useDragResize` / `ContinuousTimeline` drag mechanics

## Testing
- Create a flight LHR to AMS -- verify entry_option has latitude/longitude of Schiphol
- Verify checkout entry has `location_name: "AMS - Schiphol"` with coordinates
- Add an activity after the flight -- transport should auto-generate from Schiphol coordinates
- Parse a flight from PDF -- verify coordinates are set from matched airport
- Click gap button between flight and activity -- should use coordinates (check Network tab for coordinate strings in google-directions call)
- Verify transport durations are accurate (coordinates vs text geocoding)


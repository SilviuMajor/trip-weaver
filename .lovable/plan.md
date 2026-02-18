

# Fix ReturnFlightData Missing Coordinates

## Summary
The `ReturnFlightData` interface lacks coordinate fields. While `handleReturnFlightConfirm` currently works around this by re-parsing IATA codes from the location strings and looking up airports, this is fragile (depends on string format) and redundant. Storing the coordinates directly in the return flight data is cleaner and more reliable.

## Changes

### File: `src/components/timeline/EntrySheet.tsx`

**1. Add coordinate fields to `ReturnFlightData` interface** (lines 32-39):
```typescript
interface ReturnFlightData {
  departureLocation: string;
  arrivalLocation: string;
  departureTz: string;
  arrivalTz: string;
  departureTerminal: string;
  arrivalTerminal: string;
  departureLat: number | null;
  departureLng: number | null;
  arrivalLat: number | null;
  arrivalLng: number | null;
}
```

**2. Store swapped coordinates when building return flight data** (lines 808-812):
```typescript
setReturnFlightData({
  departureLocation: arrivalLocation, arrivalLocation: departureLocation,
  departureTz: arrivalTz, arrivalTz: departureTz,
  departureTerminal: '', arrivalTerminal: '',
  departureLat: arrivalLat, departureLng: arrivalLng,
  arrivalLat: departureLat, arrivalLng: departureLng,
});
```

**3. Simplify `handleReturnFlightConfirm`** (lines 832-840) -- replace the IATA lookup with direct state sets:
```typescript
setDepartureLat(returnFlightData.departureLat);
setDepartureLng(returnFlightData.departureLng);
setArrivalLat(returnFlightData.arrivalLat);
setArrivalLng(returnFlightData.arrivalLng);
```
Remove the `depIata`, `arrIata`, `depApt`, `arrApt` lookup lines (832-840) since they become unnecessary.

## Files Modified
- `src/components/timeline/EntrySheet.tsx` -- 3 small edits

## Testing
- Create outbound LHR to AMS, accept return prompt, save return flight
- Verify return flight entry_option has Heathrow coordinates (lat: 51.4700, lng: -0.4543)
- Transport from return flight should use coordinates (check Network tab for coordinate strings in directions call)

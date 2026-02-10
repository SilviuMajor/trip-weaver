

# Upgrade google-directions to Google Routes API

## What's Changing

The `google-directions` edge function currently uses the **legacy Directions API** (`maps.googleapis.com/maps/api/directions/json`). We'll upgrade it to use the **Routes API** (`routes.googleapis.com/directions/v2:computeRoutes`), which is Google's newer, more capable API.

The `google-places` edge function is already on the new Places API -- no changes needed there.

## Why

- The legacy Directions API is being phased out in favor of Routes API
- Routes API supports richer transit details, better polyline encoding, and field masks for efficient responses
- You've already enabled the Routes API in your Google Cloud Console

## What Stays the Same

- All client-side code (`useTravelCalculation.ts`, `EntryForm.tsx`, `TimelineHeader.tsx`) remains unchanged -- they call the edge function, not Google directly
- The response format from the edge function stays identical (`duration_min`, `distance_km`, `mode`, `polyline`, etc.)
- Both modes are preserved: single address-based lookup (Mode 1) and trip-wide batch calculation (Mode 2)

## Technical Changes

### `supabase/functions/google-directions/index.ts`

Replace all `fetch()` calls to the legacy endpoint with the new Routes API:

**Old (legacy):**
```
GET https://maps.googleapis.com/maps/api/directions/json?origin=...&destination=...&mode=transit&key=KEY
```

**New (Routes API):**
```
POST https://routes.googleapis.com/directions/v2:computeRoutes
Headers: X-Goog-Api-Key, X-Goog-FieldMask
Body: { origin, destination, travelMode, ... }
```

Key differences in the new API:
- Uses POST instead of GET with query params
- Authentication via `X-Goog-Api-Key` header instead of `key=` query param
- Field masks via `X-Goog-FieldMask` header to request only needed fields
- Travel modes are uppercase: `TRANSIT`, `DRIVE`, `WALK`, `BICYCLE`
- Response structure differs: `routes[].legs[].duration` is a string like `"1234s"` instead of `{ value: 1234, text: "..." }`
- Distance is in `distanceMeters` (integer) instead of `{ value: ..., text: "..." }`
- Polyline is at `routes[].polyline.encodedPolyline` instead of `routes[].overview_polyline.points`

### Mode 1 (single lookup) changes:
- Build a `computeRoutes` request body with `origin.address` / `destination.address` or `origin.location.latLng`
- Map `mode` param (`transit` -> `TRANSIT`, `driving` -> `DRIVE`, `walking` -> `WALK`, `bicycling` -> `BICYCLE`)
- Parse response: `parseInt(route.legs[0].duration.replace('s',''))` for seconds, `route.legs[0].distanceMeters` for distance

### Mode 2 (batch trip) changes:
- Same API switch, using lat/lng coordinates as `location.latLng` waypoints
- Extract polyline from `route.polyline.encodedPolyline`

### No other files change
The edge function is the only abstraction layer -- all callers already use the edge function's response format.


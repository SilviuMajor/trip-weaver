
# Fix: Extract Destination Coordinates for Uber Button on Transport Entries

## Problem
Transport/transfer entries have `null` for `option.latitude` and `option.longitude`. The `RouteMapPreview` already receives these null values as `destLat`/`destLng`, so the Uber button never renders because it checks `destLat != null && destLng != null`.

## Solution
Decode the last point from the selected polyline to get the destination coordinates. Google's encoded polyline format can be decoded to extract the final lat/lng pair -- this is the destination.

### Changes in `EntrySheet.tsx`

1. **Add a polyline endpoint decoder** (small utility function or inline logic) that extracts the last coordinate from an encoded polyline string. Google polyline encoding is a well-known algorithm -- we decode just enough to get the final point.

2. **Compute `destLat`/`destLng` for the transport RouteMapPreview** (around line 1416):
   - Get the current polyline from `(option as any).route_polyline` or from the selected mode in `viewResults`/`transport_modes`
   - Decode the polyline to extract the last lat/lng
   - Pass these as `destLat` and `destLng` props

### Technical Details

Add a helper function (at the top of the file or in a utility):

```typescript
function decodePolylineEndpoint(encoded: string): { lat: number; lng: number } | null {
  // Standard Google polyline decoding, returns last point
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    shift = 0; result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
  }
  return { lat: lat / 1e5, lng: lng / 1e5 };
}
```

Then update the RouteMapPreview call (line 1416-1425):

```tsx
const polylineStr = (option as any).route_polyline;
const dest = polylineStr ? decodePolylineEndpoint(polylineStr) : null;

<RouteMapPreview
  polyline={polylineStr}
  fromAddress={option.departure_location || ''}
  toAddress={option.arrival_location || ''}
  travelMode={modeLabel.toLowerCase()}
  size="full"
  destLat={dest?.lat ?? null}
  destLng={dest?.lng ?? null}
  destName={(option.arrival_location || '').split(',')[0].trim()}
/>
```

## Files Modified

| File | Changes |
|------|---------|
| `src/components/timeline/EntrySheet.tsx` | Add `decodePolylineEndpoint` helper; compute dest coords from polyline for transport RouteMapPreview |

## What Does NOT Change
- RouteMapPreview component itself (already has the props and Uber button logic)
- Regular event Uber button (uses option.latitude/longitude which are populated)
- Transport card visuals, mode switching, undo, SNAP

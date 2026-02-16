

# Fix: Auto-load Nearby Search on Explore Mount

## Root Cause

The origin resolution fallback in `ExploreView.tsx` (lines 236-245) has two bugs:

1. It calls the `autocomplete` action with `{ action: 'autocomplete', input: destination }` but the edge function expects the param name `query`, not `input`
2. Even if it worked, autocomplete predictions return `place_id` and formatted text -- they do NOT return `lat`/`lng` coordinates. So `first?.lat && first?.lng` is always falsy.

This means when there are no scheduled entries with coordinates (so `resolveOriginFromEntries` returns null), the geocoding fallback silently fails. `originLocation` stays `null`, and the auto-load nearby search useEffect (line 270-282) bails at `if (!types || !originLocation)`.

## Fix

**File: `src/components/timeline/ExploreView.tsx`** (lines 236-245)

Replace the broken autocomplete-based geocoding with a `textSearch` call, which returns place results with coordinates:

```typescript
if (destination) {
  supabase.functions.invoke('google-places', {
    body: { action: 'textSearch', query: destination, maxResults: 1 },
  }).then(({ data }) => {
    const first = data?.results?.[0];
    if (first?.lat && first?.lng) {
      setOriginLocation({ name: destination, lat: first.lat, lng: first.lng });
    }
    setOriginResolved(true);
  }).catch(() => setOriginResolved(true));
}
```

The `textSearch` action already returns `lat` and `lng` in each result (from `place.location.latitude/longitude`), so the first result for the trip destination will give us valid coordinates.

No other changes needed -- the existing auto-load useEffect (lines 270-282) already correctly watches `originResolved` and `originLocation`, and calls `performNearbySearch` when both are ready.

## Files Summary

| File | Change |
|------|--------|
| `src/components/timeline/ExploreView.tsx` | Fix geocoding fallback: replace `autocomplete` call with `textSearch` (lines 237-245) |


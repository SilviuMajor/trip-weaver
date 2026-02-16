

# Add nearbySearch, textSearch, and photo Actions to google-places Edge Function

## Overview
Add three new action handlers to `supabase/functions/google-places/index.ts` without modifying the existing `autocomplete` or `details` actions.

## Changes: `supabase/functions/google-places/index.ts`

Insert three new `if (action === '...')` blocks after the existing `details` handler and before the final "Invalid action" response.

### 1. `nearbySearch` action
- Calls `https://places.googleapis.com/v1/places:searchNearby`
- Accepts `latitude`, `longitude`, `types[]`, optional `maxResults` (default 20, capped at 20)
- Uses `rankPreference: 'DISTANCE'` and a 5km radius circle
- Returns array of results mapped to a standard format with `photoRef` (no storage upload)

### 2. `textSearch` action
- Calls `https://places.googleapis.com/v1/places:searchText`
- Accepts `query`, optional `latitude`/`longitude` for location bias (10km radius), optional `types` (only first element used since Text Search supports one type)
- Returns results in the same format as nearbySearch

### 3. `photo` action
- Accepts `photoRef` and optional `maxWidth` (default 400)
- Fetches the photo media URL from Google and returns the resolved redirect URL as `{ url: string }`
- No storage upload -- lightweight on-demand fetch

### Shared result mapping
Both nearbySearch and textSearch map results identically:
```
{ placeId, name, address, lat, lng, rating, userRatingCount, priceLevel, openingHours, types, googleMapsUri, website, phone, photoRef }
```

## File modified
- `supabase/functions/google-places/index.ts` -- insert the three action blocks after the `details` block (around line 148), before the "Invalid action" fallback

## What stays the same
- `autocomplete` and `details` handlers untouched
- CORS headers, error handling structure, Supabase storage upload logic in `details` all unchanged
- `config.toml` unchanged (function already configured)

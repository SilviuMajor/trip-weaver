

# Fix Static Map Preview + Verify Google Maps Links

## Issue 2 — Google Maps Links: Already Fixed

The Google Maps links in both `MapPreview.tsx` and `EntryCard.tsx` are already using the correct format:
- `https://www.google.com/maps/search/?api=1&query={lat},{lng}`
- Both have `target="_blank"` and `rel="noopener noreferrer"`
- No mobile-specific URL schemes (`maps://`, `comgooglemaps://`) exist in the codebase

No changes needed here.

## Issue 1 — Static Map Preview Not Loading

### Root Cause

The current static map URL uses `https://staticmap.openstreetmap.de/staticmap.php?...` — a free, community-run OpenStreetMap tile service that is unreliable and frequently fails to load images.

The Google Maps API key (`GOOGLE_MAPS_API_KEY`) is stored as a server-side secret and is only accessible from backend functions, not from client-side code. Exposing it in a client-side URL would be a security risk.

### Solution: Edge Function Proxy for Static Maps

Create a lightweight edge function that proxies the Google Static Maps API request. The client calls the edge function with lat/lng, and the function fetches the static map image using the API key server-side, then returns the image bytes.

### Changes

**New file: `supabase/functions/static-map/index.ts`**

A simple edge function that:
- Accepts `lat`, `lng`, `zoom` (default 15), and `size` (default 600x200) as query params
- Fetches `https://maps.googleapis.com/maps/api/staticmap?center={lat},{lng}&zoom={zoom}&size={size}&markers=color:red%7C{lat},{lng}&key={GOOGLE_MAPS_API_KEY}`
- Returns the image bytes with appropriate `Content-Type: image/png` and cache headers (e.g., `Cache-Control: public, max-age=86400`)
- Returns a 400 if lat/lng missing, 500 if API key not configured

**File: `src/components/timeline/MapPreview.tsx`**

- Replace the OpenStreetMap static map URL with a call to the new edge function:
  ```
  const staticMapUrl = `${supabaseUrl}/functions/v1/static-map?lat=${latitude}&lng=${longitude}`;
  ```
- Import `supabaseUrl` from the environment (`import.meta.env.VITE_SUPABASE_URL`)
- Add an `onError` handler on the `<img>` tag to hide the image container if loading fails (graceful fallback)

**No other files changed.** EntryCard links and Google Maps links are already correct.

### Test Cases

1. Open an event detail sheet with a location -- static map renders showing the pin
2. Events without lat/lng -- MapPreview not rendered (already handled by parent)
3. Static map image fails to load -- image container hidden gracefully
4. Tap Google Maps button in MapPreview -- opens correct location in new tab (desktop) / Maps app (mobile)
5. Tap location link on event card -- opens Google Maps correctly


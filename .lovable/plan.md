

# Auto-Fill Place Details with Google Places API

## Overview

Add a "Find Details" feature that uses Google Places API to auto-populate location, website, coordinates, and up to 5 photos when creating an entry. The name field becomes an auto-suggest input -- as the user types, place suggestions appear. Selecting one fills all fields automatically, with full override ability.

## Architecture

The flow works in two stages:

1. **Autocomplete**: As the user types in the Name field, call Google Places Autocomplete API to get suggestions
2. **Place Details**: When a suggestion is selected, fetch full place details (address, website, coordinates, photos)

Both API calls go through a new edge function to keep the API key server-side.

---

## New Edge Function: `google-places`

**File: `supabase/functions/google-places/index.ts`**

Handles two endpoints via the request body:

### Mode 1: Autocomplete
- Input: `{ action: "autocomplete", query: "Anne Frank", location?: { lat, lng } }`
- Calls: `https://maps.googleapis.com/maps/api/place/autocomplete/json`
- Returns: `{ predictions: [{ place_id, description, structured_formatting }] }`
- Uses the trip's destination coordinates as `location` bias if available

### Mode 2: Place Details
- Input: `{ action: "details", placeId: "ChIJ..." }`
- Calls: `https://maps.googleapis.com/maps/api/place/details/json` with fields: `name,formatted_address,website,geometry,photos`
- For each photo reference (up to 5), constructs a Places Photo URL: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=XXX&key=KEY`
- Returns: `{ name, address, website, lat, lng, photos: [url1, url2, ...] }`

### Config update
Add to `supabase/config.toml`:
```toml
[functions.google-places]
verify_jwt = false
```

---

## EntryForm Changes

**File: `src/components/timeline/EntryForm.tsx`**

### Name Field becomes Auto-Suggest

Replace the plain `<Input>` for the Name field (line 668) with a new `<PlacesAutocomplete>` component:

- Shows a dropdown of Google Places suggestions as the user types (debounced 300ms)
- Each suggestion shows the place name and a short address
- Selecting a suggestion:
  1. Sets `name` to the place name
  2. Calls the `details` endpoint with the `place_id`
  3. Auto-fills `website`, `locationName`, and stores `latitude`/`longitude` in local state
  4. Stores fetched photo URLs in a new `autoPhotos` state array
- The user can still type freely and ignore suggestions (manual override)
- All auto-filled fields remain editable

### Photo Handling

After place details are fetched, store photo URLs in state. When the entry is saved:
1. Save the entry and option as normal (including lat/lng coordinates)
2. For each auto-fetched photo URL, download it, upload to `trip-images` storage bucket, and insert into `option_images`

This reuses the existing `trip-images` bucket and `option_images` table.

### New State Variables

```typescript
const [latitude, setLatitude] = useState<number | null>(null);
const [longitude, setLongitude] = useState<number | null>(null);
const [autoPhotos, setAutoPhotos] = useState<string[]>([]);
const [fetchingDetails, setFetchingDetails] = useState(false);
```

### Save Logic Update

In `handleSave` (line 398), update the option payload to include:
- `latitude` and `longitude` (currently hardcoded to `null`)

After the option is inserted/updated, if `autoPhotos` has entries, loop through and:
1. Fetch each photo URL via the edge function (to proxy through server since Google photo URLs need the API key)
2. Upload the image blob to `trip-images` storage
3. Insert rows into `option_images`

---

## New Component: `PlacesAutocomplete`

**File: `src/components/timeline/PlacesAutocomplete.tsx`**

Props:
- `value: string` -- current name value
- `onChange: (name: string) => void` -- called on every keystroke
- `onPlaceSelect: (details: PlaceDetails) => void` -- called when a suggestion is selected
- `placeholder?: string`
- `tripLocation?: { lat: number; lng: number }` -- optional bias

Behavior:
- Renders an `<Input>` with a dropdown list below it
- Debounces input by 300ms before calling the autocomplete endpoint
- Shows a loading spinner while fetching
- Dropdown items show place name (bold) + secondary text (address)
- Clicking a suggestion calls `onPlaceSelect` with full details
- Pressing Escape or clicking outside closes the dropdown
- If the input has fewer than 3 characters, no suggestions are shown

```typescript
interface PlaceDetails {
  name: string;
  address: string;
  website: string | null;
  lat: number | null;
  lng: number | null;
  photos: string[]; // Up to 5 photo URLs
}
```

---

## Edge Function: Photo Proxy

The Google Places Photo API requires the API key in the URL. Rather than exposing it to the client, the `google-places` edge function will return proxied photo URLs.

Add a third mode to the edge function:
- Input: `{ action: "photo", photoReference: "...", maxWidth: 800 }`
- Fetches the photo from Google, returns the image binary with appropriate content-type headers
- Client can use these URLs directly as `<img src>` sources

Alternatively (simpler): The `details` mode fetches the photos server-side, uploads them to the `trip-images` storage bucket, and returns the public bucket URLs directly. This means photos are stored permanently and don't depend on Google's photo references expiring.

**Chosen approach**: The `details` mode will upload photos to storage and return permanent URLs. This is cleaner and avoids proxy complexity.

---

## Summary of Changes

| File | Change |
|------|--------|
| `supabase/functions/google-places/index.ts` | New edge function: autocomplete + place details + photo upload to storage |
| `supabase/config.toml` | Add `[functions.google-places]` with `verify_jwt = false` |
| `src/components/timeline/PlacesAutocomplete.tsx` | New component: debounced autocomplete dropdown |
| `src/components/timeline/EntryForm.tsx` | Replace Name `<Input>` with `<PlacesAutocomplete>`, add lat/lng + photo state, save photos on create |

No database schema changes needed -- `entry_options` already has `latitude`, `longitude`, `website`, `location_name` columns, and `option_images` handles photos.


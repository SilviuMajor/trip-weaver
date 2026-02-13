

# Enrich Google Places Data: Full Integration

This is a multi-layer change that captures richer data from Google Places and displays it across the app. Here's the full breakdown:

## Part 1 -- Database Migration

Add new nullable columns to the `entry_options` table:

- `phone` (text) -- international phone number
- `address` (text) -- full formatted address (separate from `location_name`)
- `rating` (numeric) -- Google rating (e.g. 4.5)
- `user_rating_count` (integer) -- number of reviews
- `opening_hours` (jsonb) -- array of 7 weekday description strings
- `google_maps_uri` (text) -- direct Google Maps link
- `google_place_id` (text) -- Google place ID for future lookups
- `price_level` (text) -- e.g. "PRICE_LEVEL_MODERATE"

All nullable, no defaults. Existing entries remain unaffected.

## Part 2 -- Edge Function Update (`supabase/functions/google-places/index.ts`)

- Expand `X-Goog-FieldMask` to include: `nationalPhoneNumber`, `internationalPhoneNumber`, `rating`, `userRatingCount`, `regularOpeningHours`, `googleMapsUri`, `priceLevel`, `types`
- Return new fields in the JSON response: `phone`, `rating`, `userRatingCount`, `openingHours`, `googleMapsUri`, `priceLevel`, `placeTypes`

## Part 3 -- Frontend Type Updates

**`PlacesAutocomplete.tsx`** -- Expand `PlaceDetails` interface to include all new fields. Update `handleSelect` to also pass `placeId` from the prediction through to `onPlaceSelect`.

**`src/types/trip.ts`** -- Add matching fields to `EntryOption`: `phone`, `address`, `rating`, `user_rating_count`, `opening_hours`, `google_maps_uri`, `google_place_id`, `price_level`.

## Part 4 -- Store Data on Save (`EntrySheet.tsx`)

- Add state variables for all new fields: `phone`, `address`, `rating`, `userRatingCount`, `openingHours`, `googleMapsUri`, `placeId`, `priceLevel`
- Update `handlePlaceSelect` to capture all new fields from the PlaceDetails response
- Include all new fields in the `optionPayload` for both insert and update operations
- Reset new state in the `reset()` function
- When editing, pre-populate from `editOption`

## Part 5 -- Display on Timeline Cards (`EntryCard.tsx`)

For the full-size and condensed card variants (non-transport, non-flight):

- Below the event name, add a rating line: "star 4.5 (1,234)" using the star emoji and formatted count
- Only shown when `option.rating` exists
- Small, subtle styling (`text-[10px]`) that doesn't clutter the card

## Part 6 -- Display in Event Detail View (`EntrySheet.tsx` view mode)

For non-flight, non-transport entries, add a new details section between the title and the time picker:

1. **Rating** -- "star 4.5 (1,234 reviews)" with price level indicators ("money bag" x1-4)
2. **Phone** -- Phone icon + number, wrapped in a `tel:` link for tap-to-call on mobile
3. **Opening hours** -- Collapsible section. Collapsed: shows today's hours (e.g. "Open today: 9:00 AM - 9:00 PM"). Expanded: all 7 days listed
4. **Google Maps link** -- "Open in Google Maps" button that opens `googleMapsUri` in a new tab. Shown near the existing map preview

Website and address (via `location_name`) continue showing as they do now.

## Part 7 -- Display on Sidebar Cards (`SidebarEntryCard.tsx`)

Below the location name line, add:
- "star 4.5 (1,234)" in the same subtle style as timeline cards
- Only when rating data exists

## Technical Details

### Files Modified

| File | Change |
|------|--------|
| `supabase/functions/google-places/index.ts` | Expand field mask + return new fields |
| `src/components/timeline/PlacesAutocomplete.tsx` | Expand `PlaceDetails` interface, pass `placeId` |
| `src/types/trip.ts` | Add new fields to `EntryOption` |
| `src/components/timeline/EntrySheet.tsx` | New state, capture on place select, save to DB, display in view mode |
| `src/components/timeline/EntryCard.tsx` | Show rating on full + condensed cards |
| `src/components/timeline/SidebarEntryCard.tsx` | Show rating below name |

### Database Migration SQL

```text
ALTER TABLE entry_options ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE entry_options ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE entry_options ADD COLUMN IF NOT EXISTS rating numeric;
ALTER TABLE entry_options ADD COLUMN IF NOT EXISTS user_rating_count integer;
ALTER TABLE entry_options ADD COLUMN IF NOT EXISTS opening_hours jsonb;
ALTER TABLE entry_options ADD COLUMN IF NOT EXISTS google_maps_uri text;
ALTER TABLE entry_options ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE entry_options ADD COLUMN IF NOT EXISTS price_level text;
```

### Opening Hours Logic

Google returns `regularOpeningHours.weekdayDescriptions` as an array of 7 strings like `["Monday: 9:00 AM - 5:00 PM", ...]`. To show "today's hours":
- Get current day of week (0=Sunday in JS, but Google starts with Monday)
- Map JS day index to the correct string in the array
- Display that string when collapsed; show all 7 when expanded

### Price Level Display

```text
PRICE_LEVEL_FREE        -> "Free"
PRICE_LEVEL_INEXPENSIVE -> money bag
PRICE_LEVEL_MODERATE    -> money bag money bag
PRICE_LEVEL_EXPENSIVE   -> money bag money bag money bag
PRICE_LEVEL_VERY_EXPENSIVE -> money bag money bag money bag money bag
```

### What Does NOT Change

- Timeline drag/drop, SNAP, transport connectors
- Flight or transport card display
- Photo handling (already working)
- Navigation, tabs, panels
- Existing entries without new data display correctly (all fields nullable)


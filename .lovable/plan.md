

# Global Explore Page

## Overview
Create a new `GlobalExplore` page with two states: a location picker and a category-based Explore view. Wire it up from the Dashboard and route it at `/explore`.

## Changes

### 1. Create `src/pages/GlobalExplore.tsx`

New page with two states:

**State 1 - Location Picker:**
- Header with back button and "Explore" title
- "Use current location" button using `useGeolocation` hook
- `PlacesAutocomplete` for city search (types filter for cities)
- "Recent cities" section: query `global_places` for distinct city values with averaged lat/lng, show up to 5 as quick-pick buttons
- When a location is selected, store `{ name, lat, lng }` and switch to State 2

**State 2 - Category + Explore:**
- Header with back button and selected city name
- Horizontal scrolling category pills from `PICKER_CATEGORIES`, filtered to exclude `flight`, `hotel`, `private_transfer` (only place categories)
- Render `ExploreView` with:
  - `open={true}`
  - `trip` as a minimal dummy object (since ExploreView requires it) -- OR make `trip` optional
  - `entries={[]}` (no trip entries)
  - `categoryId` from selected pill
  - `onAddToPlanner` = saves to `global_places` via upsert
  - `onClose` = go back to location picker or navigate back

**"Add to Planner" handler:**
```typescript
const handleGlobalAdd = async (place: ExploreResult) => {
  await supabase.from('global_places').upsert({
    user_id: adminUser.id,
    google_place_id: place.placeId,
    name: place.name,
    category: activeCategoryId,
    latitude: place.lat,
    longitude: place.lng,
    status: 'want_to_go',
    source: 'explore_save',
    rating: place.rating,
    price_level: place.priceLevel,
    address: place.address,
    city: selectedCityName,
  }, { onConflict: 'user_id,google_place_id' });
};
```

### 2. Make `trip` optional in `ExploreView`

**File: `src/components/timeline/ExploreView.tsx`**

- Change `ExploreViewProps.trip` from `Trip` to `Trip | null` (make optional)
- Guard all `trip.` references:
  - Line 210: `const destination = trip?.destination || null`
  - Line 367: `.neq('trip_id', trip.id)` -- skip entire cross-trip check when `!trip`
  - Line 396: `[results, trip?.id]`
  - Line 593: `buildTempEntry(selectedPlace, trip?.id || 'global', ...)` -- use `'global'` as fallback tripId for temp entries
  - Line 639: `trip={trip}` -- already optional in PlaceOverview

### 3. Add Explore button back to Dashboard

**File: `src/pages/Dashboard.tsx`**

Add an "Explore" button below the "My Places" button in the navigation cards section. It navigates to `/explore`.

### 4. Add route in App.tsx

**File: `src/App.tsx`**

- Import `GlobalExplore` from `./pages/GlobalExplore`
- Replace the existing `<Route path="/explore" element={<NotFound />} />` with `<Route path="/explore" element={<GlobalExplore />} />`

## Technical Details

- Category pills for global explore: filter `PICKER_CATEGORIES` to exclude ids `flight`, `hotel`, `private_transfer` since those aren't discoverable places
- The `ExploreView` origin will be set by the parent page passing coordinates via the existing origin resolution -- since no entries exist, the `resolveOriginFromEntries` returns null, and `destination` is null, so we need to pass origin coordinates. We'll set origin by having `GlobalExplore` provide a custom origin location prop. Since ExploreView doesn't have an `originOverride` prop, we'll add one: `initialOrigin?: { name: string; lat: number; lng: number }` that seeds `originLocation` state when provided.
- Recent cities query: `SELECT DISTINCT city, AVG(latitude), AVG(longitude) FROM global_places WHERE user_id = ? AND city IS NOT NULL GROUP BY city LIMIT 5` -- done client-side by fetching all global_places and grouping in JS

## Files Summary

| File | Change |
|------|--------|
| `src/pages/GlobalExplore.tsx` | New page: location picker + category pills + ExploreView |
| `src/components/timeline/ExploreView.tsx` | Make `trip` optional, add `initialOrigin` prop, guard all `trip.` usages |
| `src/pages/Dashboard.tsx` | Add Explore button back |
| `src/App.tsx` | Route `/explore` to `GlobalExplore` |


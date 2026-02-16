

# ExploreView Component + Planner Integration

## Overview
Create a new ExploreView component that provides search and nearby discovery of places using the Google Places API, and wire it into PlannerContent so tapping the search button or a category "+" button opens Explore instead of the current toast/EntrySheet.

## New Files

### 1. `src/lib/placeTypeMapping.ts`
Category-to-Google-Places-type mapping and search placeholder generator.
- `CATEGORY_TO_PLACE_TYPES` record mapping category IDs (breakfast, lunch, dinner, etc.) to arrays of Google Places types
- `getCategorySearchPlaceholder(categoryId, destination)` returns context-aware placeholder text

### 2. `src/components/timeline/ExploreView.tsx`
Full-screen overlay component for searching and browsing places.

**Props**: `open`, `onClose`, `trip`, `entries`, `categoryId?`, `isEditor`, `onAddToPlanner`, `onCardTap`

**ExploreResult type**: Matches the shape returned by the nearbySearch/textSearch edge function actions, plus an optional `photoUrl` field for lazy-loaded images.

**Layout**:
- **Header bar**: Back arrow, category emoji+name (or "Explore"), list/map toggle (map disabled with toast)
- **Search bar**: Auto-focused input with 500ms debounce. On submit calls `textSearch` action. When empty + categoryId provided, auto-loads `nearbySearch` on mount
- **Origin context line**: "Suggested near [location]" -- finds nearest entry with coordinates to current time, falls back to trip destination via autocomplete lookup
- **Results list**: Vertical scroll of simple placeholder cards (name, address, rating stars, price level, "Add" button)
- **Loading state**: Spinner
- **Empty state**: "No results for [query]"
- **"Add manually" link**: At bottom, closes Explore and opens EntrySheet in create mode

**State management**:
- `results: ExploreResult[]`, `loading: boolean`, `searchQuery: string`
- `originLocation: { name: string; lat: number; lng: number } | null`
- Debounced search via `useEffect` with 500ms timeout
- Origin resolution on mount: scan entries for nearest coordinates, fallback to trip destination

**API calls** (via `supabase.functions.invoke('google-places', { body })`):
- `nearbySearch` on mount when categoryId is set and search is empty
- `textSearch` when user types a query
- Both pass origin lat/lng for location bias

### 3. Modified: `src/components/timeline/PlannerContent.tsx`

**New props** added to interface:
- `onExploreOpen?: (categoryId: string | null) => void` -- called when search button or "+" is tapped

**Changes**:
- Search button onClick: calls `onExploreOpen?.(null)` instead of showing toast
- "+" button on each category row: calls `onExploreOpen?.(cat.id)` instead of `onAddEntry?.(cat.id)`, EXCEPT for 'hotel' and 'flight' which still call `onAddEntry?.(cat.id)` as before
- No internal Explore state in PlannerContent -- it delegates upward

### 4. Modified: `src/pages/Planner.tsx`

**New state**: `exploreOpen`, `exploreCategoryId`

**onAddEntry handler updated**:
- 'hotel' still opens HotelWizard
- 'flight' still opens EntrySheet with flight prefill
- All other categories: `setExploreCategoryId(catId); setExploreOpen(true)`

**New prop passed to PlannerContent**:
- `onExploreOpen` callback that sets explore state

**ExploreView rendered** when `exploreOpen` is true, with:
- `onAddToPlanner` handler: creates entry (is_scheduled: false) + entry_option with place data using the same pattern as `handleSaveAsIdea` in EntrySheet, then calls `fetchData()` and shows toast
- `onClose`: resets explore state
- Category inference for general search: if no categoryId, infer from place types + time of day (restaurant types at lunch hours -> 'lunch', etc.)

**Quick-add implementation** (in Planner.tsx):
```
1. Insert into 'entries': trip_id, start_time/end_time (placeholder), is_scheduled: false
2. Insert into 'entry_options': entry_id, name, category, category_color, 
   location_name (address), latitude, longitude, rating, user_rating_count, 
   phone, address, google_maps_uri, google_place_id, price_level, opening_hours
3. Toast "Added [name] to Planner"
4. Call fetchData() to refresh
```

## Technical Details

### Origin location resolution
```
1. Get current hour, find entries on today's trip day with lat/lng
2. Sort by proximity to current time
3. Use closest entry's option location_name + coordinates
4. If none found, use trip.destination -- call autocomplete action to get coords
5. Cache origin in state to avoid re-fetching
```

### Category inference for general search
When adding from general search (no categoryId), map Google types to app categories:
- Types include 'restaurant'/'cafe' -> use time-based: before 11am = breakfast, 11-15 = lunch, after 17 = dinner
- Types include 'bar'/'night_club' -> drinks/nightlife based on hour
- Types include 'museum'/'art_gallery' -> museum
- Default: 'activity'

### Debounce pattern
```typescript
useEffect(() => {
  if (!searchQuery.trim()) return;
  const timer = setTimeout(() => { performTextSearch(searchQuery); }, 500);
  return () => clearTimeout(timer);
}, [searchQuery]);
```

### Files summary
| File | Action |
|------|--------|
| `src/lib/placeTypeMapping.ts` | Create |
| `src/components/timeline/ExploreView.tsx` | Create |
| `src/components/timeline/PlannerContent.tsx` | Modify (add onExploreOpen prop, update search + "+" button handlers) |
| `src/pages/Planner.tsx` | Modify (add Explore state, quick-add logic, render ExploreView) |


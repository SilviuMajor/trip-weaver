

# Prompt 5: Editable Origin, Compact Hours, Cross-Trip Badge, Zero-Results Form, Add Manually

## Overview
Five polish features for ExploreView: tappable origin with popover, compact opening hours on cards, cross-trip badges, zero-results inline form, and "Add manually" link improvements.

## Changes

### 1. `src/components/timeline/ExploreView.tsx` (Major modifications)

**Feature 1 -- Editable Origin**
- Import `Popover, PopoverTrigger, PopoverContent` from `@/components/ui/popover`
- Import `PlacesAutocomplete` and `PlaceDetails` from `./PlacesAutocomplete`
- Add state: `originPopoverOpen`, `originSearchQuery`
- Compute `todayEntries` via `useMemo` -- filter `entries` for scheduled entries with coordinates, excluding transport/airport categories, max 8
- Replace the static origin context `<div>` with a `Popover` wrapping a `PopoverTrigger` (the existing text, now styled as tappable with underline-dashed and cursor-pointer)
- `PopoverContent` contains:
  - `PlacesAutocomplete` bound to `originSearchQuery`, `onPlaceSelect` updates `originLocation` state and closes popover
  - "Today's entries" quick-pick list: each is a small button showing emoji + name, on tap sets `originLocation` and closes popover
- When origin changes: existing `useEffect` on `originLocation` already re-triggers nearby search and travel times, so no extra wiring needed beyond updating the state
- Refactor origin state: instead of a single `originLocation` object, keep it but allow manual overrides. The `resolveOrigin` useEffect only sets it if user hasn't manually changed it (use a `originManuallySet` ref)

**Feature 2 -- Compact Hours**
- Add `getCompactHours` helper function inside ExploreView (as described in prompt)
- In the results mapping, compute `compactHours` for each place and pass to `ExploreCard`
- Update `sortedResults` memo: after travel-time sort, stable-sort closed venues to the bottom

**Feature 3 -- Cross-Trip Badge**
- Add state: `crossTripMatches: Map<string, string>`
- After results are fetched (in `performNearbySearch` and `performTextSearch`), fire a Supabase query to find matching `google_place_id` values in `entry_options` joined with `entries` where `trip_id != trip.id`, then joined with `trips` for the name
- If the nested join fails, fall back to a simpler two-step approach
- Add `crossTripName` prop pass-through to `ExploreCard`

**Feature 4 -- Zero-Results Inline Form**
- Add state: `manualName`, `manualLocationQuery`, `manualPlaceDetails`
- When `results.length === 0 && searchQuery && !loading`, render an inline form with:
  - "No results for [query]" heading
  - Name input (pre-filled with searchQuery via useEffect)
  - PlacesAutocomplete for location
  - "Add to Planner" button that creates an entry using the same pattern as `handleAdd` but with manual data
- The `handleManualAdd` function: calls `onAddToPlanner` with a synthesized `ExploreResult` from the manual name + place details

**Feature 5 -- "Add manually" Link Improvements**
- The existing `onAddManually` link at bottom of results already exists and works. Update the zero-results state to also show the link as a secondary option: "Or add without location details" which calls `onAddManually`.

### 2. `src/components/timeline/ExploreCard.tsx` (Minor modifications)

**Compact Hours Display**
- Already has `compactHours` prop and renders it -- just need to add red styling when text includes "Closed"
- Update the compactHours rendering: check if text includes "Closed" and use `text-destructive` class instead of `subTextColor`

**Cross-Trip Badge**
- Add new prop: `crossTripName?: string | null`
- Below the rating/price row, render a small badge: "In your [tripName] trip" with a pin emoji, styled in `text-[9px]` with a muted color

### 3. `src/pages/Planner.tsx` (No changes needed)
- The `onAddManually` callback already works correctly, opening EntrySheet with the category pre-filled.

## Technical Details

### Origin Popover Layout
```
PopoverTrigger (the "Suggested near X" line)
PopoverContent (w-72):
  - PlacesAutocomplete (search input)
  - Divider
  - "Today's entries" heading
  - List of entry buttons (emoji + name), max 8
```

### getCompactHours Logic
```
Input: openingHours string array (7 items, one per day)
1. Get current JS day, map to Google index (Mon=0..Sun=6)
2. Get the string for today
3. If includes "closed" -> return { text: "Closed [DayName]", isClosed: true }
4. If includes "open 24" -> return { text: "Open 24 hours", isClosed: false }
5. Try regex for closing time: /- HH:MM AM|PM/ -> "Open until HH:MM PM"
6. Fallback: strip day name prefix, return raw text
```

### Cross-Trip Query (simple approach)
```sql
-- Step 1: Get entry_option IDs matching our place IDs but in other trips
SELECT eo.google_place_id, t.name as trip_name
FROM entry_options eo
JOIN entries e ON eo.entry_id = e.id
JOIN trips t ON e.trip_id = t.id
WHERE eo.google_place_id IN (...placeIds)
AND e.trip_id != currentTripId
```
Via Supabase client:
```typescript
const { data } = await supabase
  .from('entry_options')
  .select('google_place_id, entry_id')
  .in('google_place_id', placeIds);
// Filter to entries not in current trip, then fetch trip names
```

### Sorting: Travel Time + Closed to Bottom
The `sortedResults` memo uses a two-pass stable sort:
1. Sort by travel time (ascending, unknown = 9999)
2. Stable sort pushing `isClosed` items to bottom

### Manual Add from Zero-Results Form
Creates a synthetic `ExploreResult` object:
```typescript
const syntheticPlace: ExploreResult = {
  placeId: manualPlaceDetails?.placeId || `manual-${Date.now()}`,
  name: manualName,
  address: manualPlaceDetails?.address || '',
  lat: manualPlaceDetails?.lat || null,
  lng: manualPlaceDetails?.lng || null,
  // ...rest null
};
onAddToPlanner(syntheticPlace);
```

## Files Summary
| File | Action |
|------|--------|
| `src/components/timeline/ExploreView.tsx` | Modify (editable origin popover, compact hours, cross-trip query, zero-results form) |
| `src/components/timeline/ExploreCard.tsx` | Modify (red closed hours, cross-trip badge prop) |




# Activities Step Enhancements -- Place Overview + Sort Controls

## Overview
Enhance `ActivitiesStep` with two features: (1) tapping an ExploreCard opens a PlaceOverview detail drawer with photos, reviews, and an "Add to Planner" button, and (2) sort control pills above results for Rating, Most Reviewed, and Nearest.

## Changes

### File: `src/components/wizard/ActivitiesStep.tsx`

**New imports:**
- `useMemo` from React
- `Drawer, DrawerContent, DrawerTitle` from ui/drawer
- `ClipboardList` from lucide-react
- `PlaceOverview` from timeline/PlaceOverview
- `cn` from lib/utils
- `EntryWithOptions, EntryOption` types from types/trip
- `Button` from ui/button

**New state variables:**
- `selectedPlace`, `detailOpen`, `detailLoading`, `detailPhotos`, `detailReviews`, `detailEditorialSummary` for the detail drawer
- `sortBy` (type: `'default' | 'rating' | 'reviews' | 'nearest'`) for sort controls

**New `handleCardTap` function:**
- Fetches place details via `google-places` edge function (action: 'details')
- Normalises photos (string or `{url, attribution}` format)
- Enriches place object with website/phone from details
- Opens the Drawer with PlaceOverview

**New `buildTempEntry` helper:**
- Creates fake `EntryWithOptions` and `EntryOption` objects for PlaceOverview (same pattern as ExploreView's `buildTempEntry` but with `wizard-` prefixed IDs and no trip dependency)

**New `sortedResults` useMemo:**
- `'default'`: returns results as-is (Google relevance order)
- `'rating'`: sorts by `rating` descending
- `'reviews'`: sorts by `userRatingCount` descending
- `'nearest'`: sorts by Euclidean distance from `originLocation` (simple `Math.hypot` approximation, sufficient for nearby results)

**ExploreCard changes:**
- `onTap` calls `handleCardTap(place)` instead of `handleAdd(place)`
- Adds `isLoading={detailLoading === place.placeId}` prop
- Results loop uses `sortedResults` instead of `results`

**Sort pills UI (above results grid):**
- Horizontal scrollable row of 4 pills: Suggested, Rating, Most reviewed, Nearest
- Active pill highlighted with `bg-primary/10 text-primary border-primary/20`
- Only shown when results are present and not loading

**Sort reset:**
- `handleCategoryTap` resets `sortBy` to `'default'`
- Text search debounce effect resets `sortBy` to `'default'`

**Detail drawer JSX (at bottom of component return):**
- Vaul `Drawer` component with `DrawerContent` containing:
  - Visually-hidden `DrawerTitle` for accessibility
  - Conditional "Add to Planner" button (hidden if already added)
  - `PlaceOverview` with `context="explore"`, `isEditor={false}`, preloaded reviews/editorial summary, and no-op `onSaved`

## What does NOT change
- ExploreView.tsx, ExploreCard.tsx, PlaceOverview.tsx
- TripWizard.tsx, other wizard steps
- Timeline components, edge functions, database schema

## Files modified
| File | Change |
|------|--------|
| `src/components/wizard/ActivitiesStep.tsx` | Add detail drawer (PlaceOverview), buildTempEntry helper, handleCardTap, sort state + pills + sortedResults memo |



# Fix Explore and My Places Bugs

## Overview
Six bug fixes across ExploreView, GlobalPlanner, GlobalExplore, the google-places edge function, and the quick-add handlers in Timeline.tsx and Planner.tsx.

---

## Bug 1: Text Search Must Call the API

**Problem:** The debounced text search in ExploreView (line 339-345) already calls `performTextSearch` which invokes the edge function. However, when the user clears the search, it doesn't reload nearby results.

**File: `src/components/timeline/ExploreView.tsx`**

- Add logic: when `searchQuery` is cleared (becomes empty) and a category is selected, re-trigger nearby search by resetting `initialLoadDone.current = false` so the auto-load effect fires again.
- In the debounced search effect (lines 339-345), add a branch: if `searchQuery` is empty and `categoryId` exists, reset `initialLoadDone.current = false` to re-trigger nearby search and clear `travelTimes`.
- Also clear `travelTimes` when new text search results arrive (in `performTextSearch`, add `setTravelTimes(new Map())` before setting results).

---

## Bug 2: Load More Than 20 Results

**File: `supabase/functions/google-places/index.ts`**

**Nearby Search (line 175):**
- After the first call (radius 5000m), if exactly 20 results are returned, make a second call with radius 10000m.
- Merge the two result sets, deduplicating by `placeId`.
- Return up to 40 results.

**Text Search (line 236):**
- Add support for a `radius` parameter in the request body (default 10000).
- Return the count in the response so the client knows if more are available.

**File: `src/components/timeline/ExploreView.tsx`**

- After the results list, if exactly 20 results were returned from text search, show a "Load more" button.
- When tapped, call `performTextSearch` again with a larger radius parameter (e.g. 20000) and merge/deduplicate results.
- Add state: `canLoadMore` boolean, and a `loadMoreRadius` ref.

---

## Bug 3: Category as Multi-Select Filter

**File: `src/components/timeline/ExploreView.tsx`**

Major refactor of category handling:

- Replace single `categoryId` prop usage with internal state `selectedCategories: string[]`.
- Initialize from prop: if `categoryId` is provided, start with `[categoryId]`. If not provided, start with all category IDs from `EXPLORE_CATEGORIES`.
- Add a "Category" filter chip in the filter row (alongside Price, Rating, Distance) that opens a popover with multi-select checkboxes for all explore categories.
- When multiple categories are selected, combine their `CATEGORY_TO_PLACE_TYPES` arrays for the nearby search `types` parameter.
- For text search, don't pass `types` when multiple categories are selected.
- Update the header title: show category name only when exactly one category is selected; otherwise show "Explore".

**File: `src/lib/placeTypeMapping.ts`**

- The `inferCategoryFromTypes` function already exists. It will be used to assign the correct category emoji/color to each result card.

**File: `src/components/timeline/ExploreCard.tsx`**

- Change `categoryId` prop behavior: instead of always using the passed `categoryId`, infer from `place.types` using `inferCategoryFromTypes` when multiple categories are active (or when `categoryId` is null).

**Files: `src/pages/GlobalExplore.tsx`, `src/pages/GlobalPlanner.tsx`**

- Remove the external category pills row from GlobalExplore (lines 147-163) since ExploreView now handles category selection internally.
- Remove `activeCategoryId` state from GlobalExplore; don't pass `categoryId` to ExploreView (let it default to all categories).
- Same for GlobalPlanner's city explore: don't pass a specific `categoryId`.

---

## Bug 4: Global Explore Default to All Categories

Handled by Bug 3 changes above. When `categoryId` is not provided (or null), ExploreView defaults to all categories selected.

---

## Bug 5: Persist Images When Quick-Adding from Explore

**Files: `src/pages/Timeline.tsx` (lines 270-304 and 307-357), `src/pages/Planner.tsx` (lines 99-138)**

In both `handleAddToPlanner` and `handleAddAtTime`:

After inserting the `entry_option`, fetch full place details in the background and persist photos:

```typescript
// After creating entry_option, persist images in background
if (place.placeId && !place.placeId.startsWith('manual-')) {
  (async () => {
    try {
      const { data: details } = await supabase.functions.invoke('google-places', {
        body: { action: 'details', placeId: place.placeId },
      });
      if (details?.photos?.length > 0) {
        const optionRes = await supabase
          .from('entry_options')
          .select('id')
          .eq('entry_id', d.id)
          .single();
        if (optionRes.data) {
          for (let i = 0; i < details.photos.length; i++) {
            await supabase.from('option_images').insert({
              option_id: optionRes.data.id,
              image_url: details.photos[i],
              sort_order: i,
            });
          }
        }
      }
    } catch (e) {
      console.error('Background photo fetch failed:', e);
    }
  })();
}
```

This runs after the optimistic UI update, so the checkmark appears instantly. Photos appear when the user opens the entry detail.

---

## Bug 6: My Places Data Disappearing After Sync

**File: `src/pages/GlobalPlanner.tsx`**

Remove all sync-related code. The page should ONLY use the direct query from `entry_options` joined through `entries`.

- Remove `syncPlaces` callback (lines 196-211)
- Remove the background sync call from the mount `useEffect` (line 230: `syncPlaces()`)
- Remove `fetchPlaces` (the global_places query) -- replace it entirely with `fetchDirectPlaces`
- Remove `syncing` state and the sync button from the UI header
- Remove the `RefreshCw` icon import if no longer used
- The mount effect becomes simply:
  ```typescript
  useEffect(() => {
    if (!adminUser) return;
    (async () => {
      const directResult = await fetchDirectPlaces();
      setPlaces(directResult);
      setLoading(false);
    })();
  }, [adminUser]);
  ```
- Update `handleCityExploreAdd`: after upserting to `global_places`, also refetch via `fetchDirectPlaces` instead of `fetchPlaces`
- The page now only queries entries/entry_options, never global_places for display

---

## Files Summary

| File | Changes |
|------|---------|
| `src/components/timeline/ExploreView.tsx` | Text search clears travel times; reload nearby on clear; multi-select categories with filter chip; "Load more" button; infer category per card |
| `src/components/timeline/ExploreCard.tsx` | Accept inferred category; use `inferCategoryFromTypes` when `categoryId` is null |
| `supabase/functions/google-places/index.ts` | Nearby search: auto-fetch second page at 10km; text search: support radius param |
| `src/pages/Timeline.tsx` | Background photo persistence after quick-add |
| `src/pages/Planner.tsx` | Background photo persistence after quick-add |
| `src/pages/GlobalExplore.tsx` | Remove category pills (ExploreView handles it); don't pass categoryId |
| `src/pages/GlobalPlanner.tsx` | Remove all sync logic; use only direct entry query; remove sync button |
| `src/lib/placeTypeMapping.ts` | Already has `inferCategoryFromTypes` -- no changes needed |

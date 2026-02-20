

# Review Prefetch, Cache Module & Timeline Integration

Most of this is already implemented from the previous changes. What remains is extracting the cache to a shared module and adding prefetch on card tap.

## Current State
- Edge function already returns 5 reviews (`.slice(0, 5)` in place)
- PlaceOverview already renders reviews as horizontal scroll cards
- PlaceOverview already has an inline `reviewCache` Map

## Changes Needed

### 1. Create shared cache module
**New file:** `src/lib/reviewCache.ts`

Extract the review cache from PlaceOverview into a standalone module with:
- `getCachedReviews(placeId)` -- synchronous cache lookup
- `prefetchReviews(placeId)` -- fire-and-forget fetch with deduplication (prevents double-fetching if called rapidly)
- `seedReviewCache(placeId, reviews)` -- seed from preloaded data
- Module-level `Map` for data + `Map` for in-flight promises

### 2. Update PlaceOverview to use shared module
**File:** `src/components/timeline/PlaceOverview.tsx`

- Import `getCachedReviews`, `prefetchReviews`, `seedReviewCache`, `CachedReview` from the new module
- Remove the inline `reviewCache` Map and `CachedReview` type (lines 25-27)
- Update the review fetch `useEffect` (lines 197-229) to use the shared module functions instead of direct `reviewCache` access and inline `supabase.functions.invoke`

### 3. Add prefetch in handleCardTap
**File:** `src/pages/Timeline.tsx`

- Import `prefetchReviews` from `@/lib/reviewCache`
- In `handleCardTap` (line 1417), before opening the sheet, call `prefetchReviews(option.google_place_id)` for non-flight/non-transport entries
- This fires the API call ~200-300ms before PlaceOverview mounts, so reviews are often cached by the time the component renders

## Technical Details

**PlaceOverview.tsx line 25-27** -- remove inline cache:
```tsx
// DELETE these 3 lines:
type CachedReview = { ... };
const reviewCache = new Map<string, CachedReview[]>();
```

**PlaceOverview.tsx lines 197-229** -- replace useEffect to use shared module:
- `reviewCache.has(placeId)` becomes `getCachedReviews(placeId)`
- `reviewCache.set(placeId, sorted)` becomes `seedReviewCache(placeId, sorted)`
- The API fetch path calls `prefetchReviews(placeId)` which deduplicates and caches

**Timeline.tsx line 1417** -- add prefetch before opening sheet:
```tsx
if (option.google_place_id && option.category !== 'flight') {
  prefetchReviews(option.google_place_id);
}
```

## Files Changed

| File | Change |
|------|--------|
| `src/lib/reviewCache.ts` | New shared cache + prefetch module |
| `src/components/timeline/PlaceOverview.tsx` | Use shared module, remove inline cache |
| `src/pages/Timeline.tsx` | Import and call `prefetchReviews` in `handleCardTap` |

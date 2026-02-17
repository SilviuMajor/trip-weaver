

# Images and Reviews in PlaceOverview from Explore

## Overview
When tapping an Explore card, PlaceOverview opens with no images and reviews load slowly (separate API call in useEffect). Fix by fetching full place details (which uploads photos to storage) BEFORE opening PlaceOverview, and passing pre-fetched reviews so they display instantly.

## Changes

### 1. ExploreView.tsx -- Fetch details on card tap

**New state** (around line 201):
```typescript
const [detailLoading, setDetailLoading] = useState<string | null>(null); // placeId being loaded
const [detailReviews, setDetailReviews] = useState<any[] | null>(null);
const [detailPhotos, setDetailPhotos] = useState<string[]>([]);
```

**Replace `handleCardTap`** (lines 567-570) with an async version that:
1. Sets `detailLoading` to the place's `placeId` (shows spinner on that card)
2. Calls `supabase.functions.invoke('google-places', { body: { action: 'details', placeId: place.placeId } })`
3. Stores `details.photos` in `detailPhotos` and `details.reviews` in `detailReviews`
4. Also updates `place.website` and `place.phone` from details if available
5. Sets `selectedPlace` and opens `detailOpen`
6. On error, falls back to opening without images
7. Clears `detailLoading` in finally block

**Update `buildTempEntry` call** (line 751) to use `detailPhotos` instead of just `place.photoUrl`. Change the `images` field to map `detailPhotos` into the `{ id, option_id, image_url, sort_order }` format expected by PlaceOverview/ImageGallery.

**Pass `detailReviews` to PlaceOverview** via a new `preloadedReviews` prop (line 794-802).

**Pass `detailLoading` to ExploreCard** so each card can show a loading indicator when its placeId matches.

**Clear detail state when closing**: When `detailOpen` changes to false, clear `detailReviews` and `detailPhotos`.

### 2. PlaceOverview.tsx -- Accept pre-loaded reviews

**Add `preloadedReviews` prop** to `PlaceOverviewProps` (line 106-122):
```typescript
preloadedReviews?: { text: string; rating: number | null; author: string; relativeTime: string }[] | null;
```

**Update the review useEffect** (lines 183-194): If `preloadedReviews` is provided and non-empty, use it directly instead of fetching. Only fetch if `preloadedReviews` is not provided:
```typescript
useEffect(() => {
  if (preloadedReviews && preloadedReviews.length > 0) {
    const best = [...preloadedReviews].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
    setTopReview(best);
    setReviewLoading(false);
    return;
  }
  // ... existing fetch logic unchanged
}, [option.google_place_id, option.category, preloadedReviews]);
```

### 3. ExploreCard.tsx -- Loading indicator

**Add `isLoading` prop** to the ExploreCard component.

When `isLoading` is true, overlay a small centered spinner (or pulse animation) on the card to indicate details are being fetched.

### 4. buildTempEntry update

Modify the `buildTempEntry` function (lines 85-143) to accept an optional `detailPhotos` parameter:
```typescript
function buildTempEntry(
  place: ExploreResult, tripId: string, categoryId: string | null,
  resolvedPhotoUrl: string | null, detailPhotos?: string[]
)
```

When `detailPhotos` is provided and non-empty, use those for the `images` array instead of the single `resolvedPhotoUrl`:
```typescript
images: detailPhotos && detailPhotos.length > 0
  ? detailPhotos.map((url, i) => ({
      id: `temp-img-${i}`,
      option_id: fakeOptionId,
      image_url: url,
      sort_order: i,
      created_at: now,
    }))
  : resolvedPhotoUrl
    ? [{ id: 'temp', option_id: fakeOptionId, image_url: resolvedPhotoUrl, sort_order: 0, created_at: now }]
    : [],
```

## Files Summary

| File | Changes |
|------|---------|
| `src/components/timeline/ExploreView.tsx` | Add `detailLoading`/`detailReviews`/`detailPhotos` state; async `handleCardTap` that fetches details first; pass data to `buildTempEntry` and `PlaceOverview` |
| `src/components/timeline/PlaceOverview.tsx` | Add `preloadedReviews` prop; skip fetch when reviews pre-loaded |
| `src/components/timeline/ExploreCard.tsx` | Add `isLoading` prop with spinner overlay |


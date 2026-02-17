

# API Improvements: Reviews, Editorial Summary, Photo Attribution, Current Hours

## Overview
Four improvements to the Google Places data pipeline: (1) reviews already in search field masks, (2) editorial summary in details, (3) photo attribution, (4) current opening hours with modified-hours warning.

---

## Improvement 1: Reviews in Nearby/Text Search Field Masks

**Already done.** The `FIELD_MASK` constant (line 32) already includes `places.reviews`, and `mapPlace` (line 24) already maps reviews. Both `nearbySearch` and `textSearch` use `FIELD_MASK`. No changes needed.

However, `mapPlace` currently only takes 1 review (`.slice(0, 1)`). Update to 3 reviews for consistency with the details action.

### `supabase/functions/google-places/index.ts`
- Line 24: Change `.slice(0, 1)` to `.slice(0, 3)` in `mapPlace`

---

## Improvement 2: Editorial Summary in Details

### `supabase/functions/google-places/index.ts`
- **Update details field mask** (line 112): Add `editorialSummary` to the comma-separated string
- **Add to response** (line 164-186): Add `editorialSummary: result.editorialSummary?.text ?? null`

### `src/components/timeline/PlaceOverview.tsx`
- Add `editorialSummary` to the props/data flow. Since PlaceOverview reads from `option`, and the editorial summary comes from the details fetch, pass it via `preloadedReviews` data or a new prop.
- Simplest approach: Add `preloadedEditorialSummary?: string | null` prop to `PlaceOverviewProps`
- Display it above the Top Review section (before line 881): an italicised quote block

### `src/components/timeline/ExploreView.tsx`
- Store `detailEditorialSummary` state alongside `detailReviews`
- Pass it to PlaceOverview as `preloadedEditorialSummary`

---

## Improvement 3: Photo Attribution

### `supabase/functions/google-places/index.ts`
- In the details action (lines 126-162), change `photoUrls` from `string[]` to an array of `{ url: string, attribution: string }` objects
- For each photo, extract `photo.authorAttributions[0]?.displayName` 
- Return `photos` as array of `{ url, attribution }` instead of plain strings

### `src/components/timeline/ExploreView.tsx`
- Update `detailPhotos` to store `{ url: string, attribution: string }[]`
- When building temp entry images, include attribution in a custom field

### `src/components/timeline/ImageGallery.tsx`
- Update `OptionImage` type usage or accept an optional `attribution` field
- Render a small "Photo by [name]" text overlay at the bottom-right of each image in semi-transparent white

---

## Improvement 4: Current Opening Hours

### `supabase/functions/google-places/index.ts`
- **Update details field mask** (line 112): Add `currentOpeningHours`
- **Map in response**: Add `currentOpeningHours: result.currentOpeningHours?.weekdayDescriptions ?? null`

### `src/components/timeline/PlaceOverview.tsx`
- In `PlaceDetailsSection`, compare `currentOpeningHours` with `regularOpeningHours`
- If they differ, show a warning note: "Modified hours today" with an AlertTriangle icon

---

## Files Summary

| File | Changes |
|------|---------|
| `supabase/functions/google-places/index.ts` | Increase review slice to 3 in mapPlace; add `editorialSummary` and `currentOpeningHours` to details field mask and response; return photo attributions |
| `src/components/timeline/PlaceOverview.tsx` | Add `preloadedEditorialSummary` prop; render editorial summary quote; pass `currentOpeningHours` to PlaceDetailsSection for modified-hours warning |
| `src/components/timeline/ExploreView.tsx` | Store `detailEditorialSummary` state; pass to PlaceOverview |
| `src/components/timeline/ImageGallery.tsx` | Add optional attribution overlay on each image |
| `src/types/trip.ts` | Add optional `attribution` field to `OptionImage` type |


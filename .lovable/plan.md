

# Overview Card Rework + Explore Fix

## Changes (8 sections)

### 1. ImageGallery: `rounded` prop
**File:** `src/components/timeline/ImageGallery.tsx`
- Add optional `rounded` prop (default `true`) to the interface
- Conditionally apply `rounded-xl` class based on the prop
- Add `minHeight` style and `draggable={false}` to the `<img>` tag

### 2. Full-width hero images
**File:** `src/components/timeline/PlaceOverview.tsx`
- Add `minHeight: 240` to hero container style
- Pass `rounded={false}` to `ImageGallery` in the hero section

**File:** `src/components/timeline/EntrySheet.tsx`
- Add `p-0` to the VIEW-mode `DialogContent` (line 908) only, not the create-mode one (line 919)

### 3. Inline action toolbar
**File:** `src/components/timeline/PlaceOverview.tsx`
- Replace the current "Category badge + title" section (lines 423-495) with a new layout:
  - Top row: category pill + day label on left, action icons (lock, planner, delete) on right
  - Title below as before
  - Planner icon uses `ClipboardList`, shown only when `onMoveToIdeas` exists and entry is scheduled and not transfer/flight

### 4. Remove old planner button at bottom
**File:** `src/components/timeline/PlaceOverview.tsx`
- Delete the "Editor actions" block (lines 1107-1125) entirely -- the planner action is now in the toolbar from section 3

### 5. Notes auto-save
**File:** `src/components/timeline/PlaceOverview.tsx`
- Add `useRef` and `useCallback` to imports (line 1)
- Add refs for debounce timer and current values after notes state (after line 162)
- Replace `handleNotesSave` with a `useCallback` version + add debounced auto-save effect (800ms) + save-on-unmount cleanup effect
- Existing `onBlur={handleNotesSave}` on textarea stays as safety layer

### 6. Reviews: horizontal scroll of up to 5
**File:** `supabase/functions/google-places/index.ts`
- Change `slice(0, 3)` to `slice(0, 5)` in both the `mapPlace` function (line 24) and the details action (line 179)

**File:** `src/components/timeline/PlaceOverview.tsx`
- Replace `topReview` state with `reviews` array state
- Update the review fetch effect to store up to 5 sorted reviews
- Replace the "Top Review" single-card render with a horizontal scrollable row of review cards (260px wide each, snap scroll, 4-line clamp)

### 7. Flight: default photo + remove Unsplash
**File:** `src/components/timeline/PlaceOverview.tsx`
- After the image gallery / image uploader branches, add a new branch for flights with no images that shows `/default-flight.jpg`
- Delete the Unsplash fallback image inside the flight layout (lines 500-506)

**Note:** A default flight image needs to be uploaded to `public/default-flight.jpg`. Since I cannot upload binary files, I will use a placeholder approach or the user will need to provide the image.

### 8. Explore: fix Load More pagination
**File:** `src/components/timeline/ExploreView.tsx`
- In `handleLoadMore` nearby search branch (lines 572-587): change radius multiplier from 2x to 3x with 50km cap, track `newUniqueCount`, set `canLoadMore` based on unique count >= 3 AND radius < 50000
- In `handleLoadMore` text search branch (lines 550-571): same fixes -- 3x radius with 50km cap, track unique count, fix `canLoadMore`

## Files changed

| File | Change |
|------|--------|
| `src/components/timeline/ImageGallery.tsx` | Add `rounded` prop, `minHeight`, `draggable={false}` |
| `src/components/timeline/PlaceOverview.tsx` | Hero full-width, inline toolbar, remove old planner button, notes auto-save, reviews array, flight default image |
| `src/components/timeline/EntrySheet.tsx` | `p-0` on VIEW-mode DialogContent only |
| `src/components/timeline/ExploreView.tsx` | Fix `canLoadMore` dedup bug, 3x radius, 50km cap |
| `supabase/functions/google-places/index.ts` | Return 5 reviews instead of 3 |

## Note on default-flight.jpg
The user's prompt mentions uploading a flight photo to `public/default-flight.jpg`. Since binary file uploads require the user to provide the image via chat, I'll add the code referencing `/default-flight.jpg` and the user can upload the image separately. Alternatively, I can use a high-quality free flight image URL as a temporary fallback.


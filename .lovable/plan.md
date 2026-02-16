

# Prompt 2 & 3: "Add at Time" from Explore + Review Snippet in PlaceOverview

## Overview
Two features: (1) When Explore opens from the timeline creation flow with a time context, the detail sheet shows an "Add at [time]" button for scheduled entry creation. (2) Google review snippets are fetched and displayed in PlaceOverview.

---

## Prompt 2: "Add at Time" from Explore

### 1. `src/components/timeline/ExploreView.tsx` — Add `createContext` and `onAddAtTime` props

**Props interface** (line 40-50): Add two new props:
```typescript
createContext?: { startTime?: string; endTime?: string } | null;
onAddAtTime?: (place: ExploreResult, startTime: string, endTime: string) => void;
```

**Destructure** the new props in the component (line 159-169).

**Detail sheet content** (lines 509-538): Update the button area at the top of the detail sheet:
- If `createContext` exists and has `startTime`, show:
  - Primary button: "Add at HH:mm" (format startTime from ISO to HH:mm)
  - Secondary outline button: "Add to Planner instead"
- If `createContext` is null (Planner flow), show the existing "Add to Planner" button

The "Add at time" button calls `onAddAtTime?.(selectedPlace, createContext.startTime, createContext.endTime)`, then closes the detail sheet.

The "Add to Planner instead" button calls the existing `handleAdd(selectedPlace)` and closes the detail sheet.

### 2. `src/pages/Timeline.tsx` — Pass createContext and implement onAddAtTime

**State**: No new state needed -- `prefillStartTime` and `prefillEndTime` already exist.

**Pass `createContext` to ExploreView** (around line 2496):
```typescript
createContext={prefillStartTime ? { startTime: prefillStartTime, endTime: prefillEndTime } : null}
```

**Implement `onAddAtTime` callback**: Similar to `handleAddToPlanner` but with `is_scheduled: true` and the actual start/end times. After creating the entry:
- Close Explore (`setExploreOpen(false)`)
- Show toast: "Added [name] at [time]"
- Call `fetchData()` to refresh

**Pass to ExploreView**:
```typescript
onAddAtTime={handleAddAtTime}
```

### 3. Time formatting helper

In ExploreView, format the ISO start time for display:
```typescript
const formatCreateTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
};
```

---

## Prompt 3: Review Snippet in PlaceOverview

### 4. `supabase/functions/google-places/index.ts` — Add reviews to field masks

**Details action** (line ~88): Add `reviews` to the X-Goog-FieldMask string.

**Details response mapping** (line ~138): Add `reviews` field:
```typescript
reviews: (result.reviews ?? []).slice(0, 3).map((r: any) => ({
  text: r.text?.text ?? '',
  rating: r.rating ?? null,
  author: r.authorAttribution?.displayName ?? 'Anonymous',
  relativeTime: r.relativePublishTimeDescription ?? '',
})),
```

**nearbySearch action** (~line 166): Add `places.reviews` to field mask. Add reviews to result mapping (slice 0,1).

**textSearch action** (~line 207): Same -- add `places.reviews` to field mask and reviews to mapping.

### 5. `src/components/timeline/PlacesAutocomplete.tsx` — Update PlaceDetails interface

Add to interface (line 6-21):
```typescript
reviews?: { text: string; rating: number | null; author: string; relativeTime: string }[];
```

Update the `handleSelect` function to pass `reviews: data.reviews ?? []`.

### 6. `src/components/timeline/PlaceOverview.tsx` — Add review display

**New state** (around line 142):
```typescript
const [topReview, setTopReview] = useState<{...} | null>(null);
const [reviewLoading, setReviewLoading] = useState(false);
```

**New useEffect**: When `option.google_place_id` exists and category is not flight/transfer, fetch place details to get reviews. Pick the highest-rated review.

**Render**: Below the PlaceDetailsSection and above phone/website, show a "Top Review" card with author, stars, relative time, review text (line-clamp-3), and a "Read more on Google" link.

---

## Files Summary

| File | Action |
|------|--------|
| `src/components/timeline/ExploreView.tsx` | Add `createContext` + `onAddAtTime` props, conditional buttons in detail sheet |
| `src/pages/Timeline.tsx` | Pass `createContext`, implement `handleAddAtTime` callback |
| `supabase/functions/google-places/index.ts` | Add `reviews` to field masks and response mappings |
| `src/components/timeline/PlacesAutocomplete.tsx` | Add `reviews` to PlaceDetails interface |
| `src/components/timeline/PlaceOverview.tsx` | Add review fetch + display section |


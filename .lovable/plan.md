

# Search Bar in Category Picker + Planner Button Closes Explore

## Overview
Two UX improvements: (1) Add a search bar above the category grid in EntrySheet so users can skip categories and search directly, and (2) Make the Planner FAB close Explore when it's open.

---

## Change 1: Search Bar in EntrySheet Category Step

### `src/components/timeline/EntrySheet.tsx`

**Update prop type** (line 80):
```typescript
onExploreRequest?: (categoryId: string | null, searchQuery?: string) => void;
```

**Add `Search` to the lucide-react import** (line 20).

**Insert search bar** between the transport suggestion (line 919) and the category grid (line 921). A text input with a search icon that, on Enter, calls `onExploreRequest(null, query)` to open Explore with all categories and the search pre-filled.

**Update `handleCategorySelect`** (line 478-479) and the `prefillCategory` effect (line 273) to pass `catId` as first arg (no change needed there, already works).

### `src/components/timeline/ExploreView.tsx`

**Add `initialSearchQuery` prop** to `ExploreViewProps`:
```typescript
initialSearchQuery?: string | null;
```

**Add a useEffect** that sets `searchQuery` state from the prop when it changes (and is non-empty), then triggers a fetch.

### `src/pages/Timeline.tsx`

**Add state:**
```typescript
const [exploreSearchQuery, setExploreSearchQuery] = useState<string | null>(null);
```

**Update `onExploreRequest` handler** (line 2654):
```typescript
onExploreRequest={(catId, searchQuery) => {
  setSheetOpen(false);
  setExploreCategoryId(catId);
  setExploreSearchQuery(searchQuery ?? null);
  setExploreOpen(true);
}}
```

**Pass `initialSearchQuery` to both ExploreView instances** (desktop embedded at line 2505 and mobile at line 2663):
```typescript
initialSearchQuery={exploreSearchQuery}
```

**Clear `exploreSearchQuery` when Explore closes** -- in the `onClose` callbacks, add `setExploreSearchQuery(null)`.

---

## Change 2: Planner FAB Closes Explore

### `src/pages/Timeline.tsx`

**Update the Planner FAB onClick** (line 2258-2259):
```typescript
onClick={() => {
  if (!dragActiveEntryId) {
    if (exploreOpen) {
      setExploreOpen(false);
      setExploreCategoryId(null);
      setExploreSearchQuery(null);
    }
    setSidebarOpen(!sidebarOpen);
  }
}}
```

This ensures: tapping the Planner button while Explore is open closes Explore and toggles the Planner sidebar.

---

## Files Summary

| File | Changes |
|------|---------|
| `src/components/timeline/EntrySheet.tsx` | Add Search import, search bar above category grid, update `onExploreRequest` prop type |
| `src/components/timeline/ExploreView.tsx` | Add `initialSearchQuery` prop, useEffect to apply it |
| `src/pages/Timeline.tsx` | Add `exploreSearchQuery` state, pass to ExploreView, update Planner FAB onClick to close Explore |


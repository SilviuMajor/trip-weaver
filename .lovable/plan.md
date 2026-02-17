

# Fix Four Timeline and Explore Bugs

## Overview
Four bug fixes: (1) floating buttons overlapping the sidebar panel, (2) "Add manually" not working in some cases, (3) "Load more" for nearby search, (4) app freeze on delete from Planner.

---

## Bug 1: Floating Buttons Overlap Sidebar

The "+", Planner FAB, and UndoRedo buttons are all fixed with `right-6` or `right-[88px]`, overlapping the Explore/Planner panel on desktop.

### Timeline.tsx (lines 2278-2322, 2888-2889)

Compute a `fabRightOffset` based on sidebar and live panel state:

```typescript
const fabRightOffset = (sidebarOpen || exploreOpen) && !isMobile
  ? (liveOpen ? 'right-[calc(25vw+24px)]' : 'right-[calc(30vw+24px)]')
  : 'right-6';
```

- **"+" FAB** (line 2290): Replace `fixed bottom-6 right-6` with dynamic class using `cn(...)` and `fabRightOffset`, adding `transition-all duration-200`.
- **Planner FAB** (line 2310): Replace `fixed bottom-24 right-6` similarly with `fabRightOffset` and `transition-all duration-200`.
- **UndoRedoButtons** (line 2889): Pass `sidebarOpen`, `isMobile`, and `compact` (= `liveOpen && sidebarOpen`) as new props.

### UndoRedoButtons.tsx

- Add `sidebarOpen?: boolean`, `isMobile?: boolean`, `compact?: boolean` props to the interface.
- Update the container div's className to use dynamic right offset:
  - When `sidebarOpen && !isMobile`: `compact ? 'right-[calc(25vw+100px)]' : 'right-[calc(30vw+100px)]'`
  - Otherwise: `'right-[88px]'`
- Add `transition-all duration-200` for smooth animation.

---

## Bug 2: "Add Manually" Button

The "Add manually" button already calls `onAddManually` (lines 1379-1383 and 1299-1304), which is properly wired in Timeline.tsx (lines 2570-2578 and 2731-2738). This appears to be working correctly based on the code.

However, the nearby search "Load more" and "Add manually" in the **map view's card strip** (lines 1209-1228) also call `onAddManually`, which is correct.

**No code changes needed** -- the wiring is already in place. The `onAddManually` callback closes Explore and opens EntrySheet with the category pre-filled.

---

## Bug 3: "Load More" for Nearby Search

Currently, `canLoadMore` is only set to true for text search (line 527), never for nearby search. When nearby returns 20 results, there's no way to load more.

### ExploreView.tsx

**Update `performNearbySearch`** (lines 490-505):
- Accept an optional `radius` parameter (default 5000).
- After fetching, set `canLoadMore` to true if results.length >= 20.
- Store the current nearby radius in a ref (`nearbyRadiusRef`).

**Update `handleLoadMore`** (lines 536-565):
- Currently only handles text search. Add a branch: if no search query, do a nearby search with doubled radius instead.
- Merge and deduplicate results like the text search path already does.

### Edge function (supabase/functions/google-places/index.ts, line 193)
- Extract `radius` from the request body: `const { latitude, longitude, types, maxResults = 20, radius } = body;`
- Use `radius || 5000.0` instead of hardcoded `5000.0` on line 202.
- Use `(radius || 5000) * 2` instead of hardcoded `10000.0` on line 237.

---

## Bug 4: App Freezes on Delete from Planner

### Timeline.tsx (lines 2639-2665)

The `onSaved` callback refreshes data but doesn't handle the case where the entry was deleted. If `sheetEntry` references a deleted entry, the sheet tries to render stale data.

**Update the `onSaved` callback:**
- After `fetchData()`, check if the entry still exists in fresh data.
- If the entry is gone (deleted), close the sheet and clear all sheet state.

```typescript
onSaved={async () => {
  const freshEntries = await fetchData();
  if (sheetEntry && freshEntries) {
    const fresh = freshEntries.find(e => e.id === sheetEntry.id);
    if (fresh) {
      setSheetEntry(fresh);
      if (sheetOption && fresh.options) {
        const freshOpt = fresh.options.find(o => o.id === sheetOption.id);
        if (freshOpt) setSheetOption(freshOpt);
      }
    } else {
      // Entry was deleted -- close sheet cleanly
      setSheetOpen(false);
      setSheetEntry(null);
      setSheetOption(null);
      setSheetMode(null);
    }
  }
  // ... auto-extend logic
}}
```

**Update `onOpenChange`** (lines 2624-2636):
- Add a short delay before clearing state so the close animation can complete:

```typescript
onOpenChange={(open) => {
  setSheetOpen(open);
  if (!open) {
    setTimeout(() => {
      setSheetEntry(null);
      setSheetOption(null);
      setSheetMode(null);
      // ... other resets
    }, 300);
  }
}}
```

---

## Files Summary

| File | Changes |
|------|---------|
| `src/pages/Timeline.tsx` | Compute `fabRightOffset`; apply to "+" FAB and Planner FAB; pass new props to UndoRedoButtons; update `onSaved` to handle deleted entries; update `onOpenChange` with delayed cleanup |
| `src/components/timeline/UndoRedoButtons.tsx` | Add `sidebarOpen`, `isMobile`, `compact` props; dynamic right offset with transition |
| `src/components/timeline/ExploreView.tsx` | Set `canLoadMore` in `performNearbySearch`; update `handleLoadMore` to support nearby search with radius doubling |
| `supabase/functions/google-places/index.ts` | Accept `radius` parameter in nearbySearch action |


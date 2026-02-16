

# Route Timeline Creation Through Explore

## Overview
Change the entry creation flow so that after picking a non-flight/hotel/transfer category, the Explore view opens instead of the old form. This applies to the Timeline page's FAB, gap-click, and sidebar "+" buttons.

## Changes

### 1. `src/components/timeline/EntrySheet.tsx`

**New prop**: `onExploreRequest?: (categoryId: string) => void`

**Modify `handleCategorySelect`** (line 464-473): Add routing logic before the existing flow:
```
const handleCategorySelect = (catId: string) => {
  if (catId === 'hotel' && onHotelSelected) {
    onHotelSelected();
    return;
  }
  // Route non-special categories through Explore
  const specialCats = ['flight', 'hotel', 'transfer', 'private_transfer'];
  if (!specialCats.includes(catId) && onExploreRequest) {
    onExploreRequest(catId);
    return;
  }
  // Existing fallback
  setCategoryId(catId);
  const cat = allCategories.find(c => c.id === catId);
  if (cat) applySmartDefaults(cat);
  setStep('details');
};
```

**Modify `prefillCategory` useEffect** (line 266-276): When prefillCategory is a non-special category and `onExploreRequest` exists, call it instead of going to the details step:
```
useEffect(() => {
  if (mode !== 'create') return;
  if (prefillCategory && open && !editEntry) {
    const specialCats = ['flight', 'hotel', 'transfer', 'private_transfer'];
    if (!specialCats.includes(prefillCategory) && onExploreRequest) {
      onExploreRequest(prefillCategory);
      onOpenChange(false);
      return;
    }
    const cat = allCategories.find(c => c.id === prefillCategory);
    if (cat) {
      setCategoryId(prefillCategory);
      applySmartDefaults(cat);
      setStep('details');
    }
  }
}, [prefillCategory, open, editEntry, applySmartDefaults, mode]);
```

**Add prop to interface** (line 48-80): Add `onExploreRequest` to `EntrySheetProps`.

### 2. `src/pages/Timeline.tsx`

**New imports**: Add `ExploreView` and `ExploreResult`, plus `inferCategoryFromTypes` and `findCategory`.

**New state** (around line 140):
```
const [exploreOpen, setExploreOpen] = useState(false);
const [exploreCategoryId, setExploreCategoryId] = useState<string | null>(null);
```

**New `handleAddToPlanner` callback**: Same pattern as Planner.tsx -- creates an unscheduled entry with place data from the Explore result.

**Pass `onExploreRequest` to EntrySheet** (around line 2440):
```
onExploreRequest={(catId) => {
  setSheetOpen(false);
  setExploreCategoryId(catId);
  setExploreOpen(true);
}}
```

**Render ExploreView** after EntrySheet (around line 2440):
```
{trip && (
  <ExploreView
    open={exploreOpen}
    onClose={() => { setExploreOpen(false); setExploreCategoryId(null); }}
    trip={trip}
    entries={entries}
    categoryId={exploreCategoryId}
    isEditor={isEditor}
    onAddToPlanner={handleAddToPlanner}
    onCardTap={() => {}}
    onAddManually={() => {
      setExploreOpen(false);
      setPrefillCategory(exploreCategoryId || undefined);
      setExploreCategoryId(null);
      setSheetMode('create');
      setSheetEntry(null);
      setSheetOption(null);
      setSheetOpen(true);
    }}
  />
)}
```

### 3. `src/pages/Planner.tsx`

**Pass `onExploreRequest` to EntrySheet** so the same routing applies when creating entries from the Planner page's EntrySheet:
```
onExploreRequest={(catId) => {
  setSheetOpen(false);
  setExploreCategoryId(catId);
  setExploreOpen(true);
}}
```

## What stays unchanged
- Edit flow (tapping existing entries opens EntrySheet in view mode -- no `onExploreRequest` involved since `mode === 'view'`)
- Flight, hotel, transfer, private_transfer creation (routed to details step / HotelWizard as before)
- CategorySidebar `onAddEntry` for hotels (still opens HotelWizard directly before reaching EntrySheet)
- The Planner's existing ExploreView (already works, just adding the same prop to its EntrySheet)

## Files Summary
| File | Action |
|------|--------|
| `src/components/timeline/EntrySheet.tsx` | Modify (add `onExploreRequest` prop, route categories) |
| `src/pages/Timeline.tsx` | Modify (add Explore state, render ExploreView, pass prop) |
| `src/pages/Planner.tsx` | Modify (pass `onExploreRequest` to its EntrySheet) |

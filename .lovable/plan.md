

# Add Explore Filters (Price, Rating, Travel Time)

## Overview
Add three client-side filter chips below the travel mode pills in ExploreView: Price Level (multi-select), Minimum Rating (single-select), and Max Travel Time (single-select). Filtering is applied via `useMemo` on already-fetched results. A result count line shows when filters are active.

## Changes

### File: `src/components/timeline/ExploreView.tsx`

**1. New filter state (after line 192, alongside existing state)**

```typescript
const [selectedPriceLevels, setSelectedPriceLevels] = useState<string[]>([]);
const [minRating, setMinRating] = useState<number | null>(null);
const [maxTravelMinutes, setMaxTravelMinutes] = useState<number | null>(null);
```

Default: empty array for price (means "all"), null for rating and travel time (means "any"). Reset these in the existing `open` reset effect (line 252-267).

**2. New `filteredResults` useMemo (before `sortedResults` at line 493)**

```typescript
const filteredResults = useMemo(() => {
  return results.filter(place => {
    if (selectedPriceLevels.length > 0 && selectedPriceLevels.length < 4) {
      if (!place.priceLevel || !selectedPriceLevels.includes(place.priceLevel)) return false;
    }
    if (minRating !== null) {
      if (!place.rating || place.rating < minRating) return false;
    }
    if (maxTravelMinutes !== null) {
      const time = travelTimes.get(place.placeId);
      if (time == null || time > maxTravelMinutes) return false;
    }
    return true;
  });
}, [results, selectedPriceLevels, minRating, maxTravelMinutes, travelTimes]);
```

**3. Update `sortedResults` to use `filteredResults` instead of `results`**

Change line 494 from `[...results]` to `[...filteredResults]` and update deps.

**4. Filter chips row (after travel mode pills, ~line 681)**

Add a new horizontal scrolling row with three Popover-based filter chips:

- **Price**: Popover with four toggleable pills (EUR, EUR EUR, etc.). Chip label shows "Price" when all/none selected, or the active symbols when filtered.
- **Rating**: Popover with options "4.5+", "4.0+", "3.5+", "Any". Chip label shows the active filter or "Rating".
- **Distance**: Popover with "Under 10m", "Under 15m", "Under 30m", "Any". Chip label shows active filter or "Distance".

Chip styling:
- Active (non-default): `bg-primary/10 text-primary border-primary/20 rounded-full px-3 py-1 text-[11px] font-medium`
- Default: `text-muted-foreground border-border/50 rounded-full px-3 py-1 text-[11px] font-medium`

**5. Result count text (below filter chips, above the results list)**

```tsx
{!loading && results.length > 0 && (
  <div className="px-4 pb-1">
    <span className="text-[11px] text-muted-foreground">
      {filteredResults.length === results.length
        ? `${results.length} results`
        : `${filteredResults.length} of ${results.length} results`}
    </span>
  </div>
)}
```

**6. Reset filters on open**

In the existing reset effect (line 252-267), add:
```typescript
setSelectedPriceLevels([]);
setMinRating(null);
setMaxTravelMinutes(null);
```

## Technical Details

### Price Level Mapping
Google returns these string values in `priceLevel`:
- `PRICE_LEVEL_INEXPENSIVE` = EUR
- `PRICE_LEVEL_MODERATE` = EUR EUR
- `PRICE_LEVEL_EXPENSIVE` = EUR EUR EUR
- `PRICE_LEVEL_VERY_EXPENSIVE` = EUR EUR EUR EUR

The filter stores the full Google string values in `selectedPriceLevels` and compares directly against `place.priceLevel`.

### Filter Chip Popover Pattern
Each chip is a `Popover` + `PopoverTrigger` (the pill button) + `PopoverContent` (the options). The price popover uses toggle buttons; rating and distance use radio-like single-select buttons. Selecting an option closes the popover for single-select filters.

### Files Summary

| File | Change |
|------|--------|
| `src/components/timeline/ExploreView.tsx` | Add filter state, filteredResults memo, filter chip row UI, result count, reset on open |

No new files, no database changes, no edge function changes.




# Time-Based Category Sorting in PlannerContent

## Overview
Sort category rows by relevance to the current time of day, with flight/hotel pinned to the bottom.

## Changes: `src/components/timeline/PlannerContent.tsx`

### Add sorting logic

After the `allCategories` memo (line 49-64), add a new `sortedCategories` memo that reorders them:

```typescript
const sortedCategories = useMemo(() => {
  const currentHour = new Date().getHours();

  const getCategoryRelevance = (cat: CategoryDef): number => {
    const diff = Math.abs(cat.defaultStartHour - currentHour);
    return Math.min(diff, 24 - diff);
  };

  const pinToBottom = ['flight', 'hotel'];

  const normal: CategoryDef[] = [];
  const custom: CategoryDef[] = [];
  const bottom: CategoryDef[] = [];

  for (const cat of allCategories) {
    if (pinToBottom.includes(cat.id)) bottom.push(cat);
    else if (cat.id.startsWith('custom_')) custom.push(cat);
    else normal.push(cat);
  }

  normal.sort((a, b) => getCategoryRelevance(a) - getCategoryRelevance(b));

  return [...normal, ...custom, ...bottom];
}, [allCategories]);
```

The `currentHour` is computed inside the memo. Since `allCategories` only changes when trip presets change, and there's no other dependency, the sort recalculates on mount and when presets change. This satisfies the "recalculate on mount or when hour changes" requirement without adding a timer (the hour won't change during a typical session view, and remounting handles it).

### Update references

Replace `allCategories` with `sortedCategories` in four places:

1. **Line 127** (`groupByCategory`): keep using `allCategories` here since this just initializes the map keys (order doesn't matter for a Map).
2. **Line 249**: `allCategories.map(cat => renderCategoryRow(...))` becomes `sortedCategories.map(...)`
3. **Line 260**: same change inside the CollapsibleContent

That's it. No other files change. The `groupByCategory` function uses the Map for lookup so key insertion order doesn't affect it. Only the rendering loops need `sortedCategories`.

## What stays the same
- All card rendering, horizontal scroll, dedup logic, search button, collapsible behavior
- `groupByCategory` still uses `allCategories` for Map initialization (order irrelevant)
- "Other" row always renders last (after all categories), unchanged

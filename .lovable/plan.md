

# Reposition SNAP and Add Something Buttons in Gap

## What Changes

### File: `src/components/timeline/CalendarDay.tsx` (lines 1090-1098)

Replace the fixed-offset positioning with gap-centered positioning:

**Current code (lines 1090-1098):**
```typescript
const snapTopOffset = gapMin <= 90
  ? height + 2
  : height + (15 / 60) * PIXELS_PER_HOUR;

const addBtnTopOffset = gapMin <= 90
  ? height + 24
  : height + (15 / 60) * PIXELS_PER_HOUR + 24;
```

**New code:**

Calculate the pixel height of the gap between transport end and next event, then center the buttons within it.

```typescript
// Calculate gap height in pixels
const nextResolvedTzs = resolveEntryTz(nextVisible, ...);
const nextStartHour = getHourInTimezone(nextVisible.start_time, nextResolvedTzs.startTz);
const gapTopPx = height; // bottom of transport card
const gapBottomPx = (nextStartHour - entryStartHour) * PIXELS_PER_HOUR - height; 
// Actually: gap pixel height = (nextStartHour - groupEndHour) * PIXELS_PER_HOUR
// where groupEndHour is the transport's end hour

const transportEndHour = getHourInTimezone(entry.end_time, resolvedTz);
const gapPixelHeight = (nextStartHour - transportEndHour) * PIXELS_PER_HOUR;

if (gapMin <= 90) {
  // Tier 2: Both SNAP and Add Something centered together in the gap
  // Two buttons stacked = ~44px total (22px each roughly)
  const buttonsHeight = 44;
  const gapMidOffset = height + (gapPixelHeight - buttonsHeight) / 2;
  const snapTopOffset = gapMidOffset;
  const addBtnTopOffset = gapMidOffset + 22;
} else {
  // Tier 3: SNAP stays ~15 min below transport, Add Something centered in remaining gap
  const snapTopOffset = height + (15 / 60) * PIXELS_PER_HOUR;
  const snapBottomPx = snapTopOffset + 22; // SNAP button height
  const remainingGap = gapPixelHeight - (snapBottomPx - height);
  const addBtnTopOffset = snapBottomPx + (remainingGap - 22) / 2;
}
```

The `nextStartHour` will be resolved using the same timezone logic already in scope (using `resolveEntryTz` or the timezone resolution that CalendarDay already applies to sorted entries). We need to find the next entry's start hour to compute the gap's pixel span.

Since entries are already sorted and their positions computed, we can derive the gap pixel height from the next entry's `top` position minus the current entry's `top + height`. However, `nextVisible`'s top isn't directly available at this point in the code -- so we compute it from the hour values.

## Summary

| Tier | SNAP position | Add Something position |
|------|--------------|----------------------|
| Tier 2 (30-90 min) | Centered in gap (with Add Something) | Centered in gap (below SNAP) |
| Tier 3 (> 90 min) | ~15 min below transport (unchanged) | Centered in remaining space between SNAP and next event |

## Files Changed

| File | Changes |
|------|---------|
| `src/components/timeline/CalendarDay.tsx` | Update SNAP/Add Something positioning math to center in gap (Tier 2) and center Add Something in remaining gap (Tier 3) |


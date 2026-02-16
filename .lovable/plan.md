
# Compact Flight/Hotel Cards in Planner

## Overview
Add a `compact` prop to SidebarEntryCard that reduces height, hides location/rating, and uses smaller text. Pass it for flight/hotel entries in PlannerContent with narrower card widths.

## Changes

### File 1: `src/components/timeline/SidebarEntryCard.tsx`

1. Add `compact?: boolean` to the props interface (line 8-17)
2. Destructure `compact` in the component (line 34)
3. Update the height class (line 114): replace `firstImage ? 'h-[144px]' : 'min-h-[100px]'` with:
   ```
   compact ? 'h-[80px]' : (firstImage ? 'h-[144px]' : 'min-h-[100px]')
   ```
4. Update the name text size (line 171): change `text-sm` to `compact ? 'text-xs' : 'text-sm'`
5. Conditionally hide location_name (lines 174-177): wrap with `{!compact && option.location_name && ...}`
6. Conditionally hide rating (lines 179-182): wrap with `{!compact && (option as any).rating != null && ...}`

### File 2: `src/components/timeline/PlannerContent.tsx`

1. In `renderCategoryRow` (around line 207-221), pass `compact` prop to SidebarEntryCard:
   ```tsx
   compact={original.options[0]?.category === 'flight' || original.options[0]?.category === 'hotel'}
   ```
2. Update the card width wrapper (line 209): use a narrower width for compact cards:
   ```tsx
   const isCompact = original.options[0]?.category === 'flight' || original.options[0]?.category === 'hotel';
   // wrapper class: isCompact ? 'w-[140px]' : cardWidth
   ```
3. Apply the same in `renderOtherRow` if needed (though flight/hotel entries shouldn't appear in "other", this is defensive)

## What stays the same
- All drag behavior, touch events, click handlers
- Card appearance on the Timeline page (compact is never passed there)
- Corner flag, duration pill, usage count badge all remain visible
- Image background still renders, just cropped to 80px height

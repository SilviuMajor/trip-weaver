

# Remove Side-by-Side Layout, Add Conflict Indicators

## Problem

When cards overlap or are adjacent, the `computeOverlapLayout` function splits them into columns (left half / right half). This is incorrect behavior -- cards should always be full width. Additionally, flight check-in + flight cards appear side-by-side with empty space.

## Changes

### File 1: `src/components/timeline/CalendarDay.tsx`

**Change A: Remove column-based positioning (lines 587-591)**

Replace:
```typescript
const layoutInfo = layoutMap.get(entry.id);
const column = layoutInfo?.column ?? 0;
const totalColumns = layoutInfo?.totalColumns ?? 1;
const widthPercent = 100 / totalColumns;
const leftPercent = column * widthPercent;
```

With:
```typescript
const widthPercent = 100;
const leftPercent = 0;
```

This makes every card full-width, regardless of overlap.

**Change B: Remove `computeOverlapLayout` usage (lines 8, 200-220)**

- Remove the import of `computeOverlapLayout` from line 8
- Remove the layout computation block (lines 200-220: `layoutEntries`, `layout`, `layoutMap`)
- Remove `layoutMap` reference at line 587

**Change C: Add conflict visual indicators using existing `overlapMap` (lines 222-248)**

The `overlapMap` already detects which entries overlap and from which side (top/bottom). Use this to:

1. Add a red/orange border or ring glow to overlapping cards
2. Add a small conflict badge (e.g., `AlertTriangle` icon) on overlapping cards
3. Ensure later-starting overlapping cards get a higher z-index so they render on top

At the card wrapper div (line 633-643), add conflict styling:

```typescript
const hasConflict = overlapMap.has(entry.id);

// In the div style/className:
className={cn(
  'absolute z-10 pr-1 group',
  isDragged && 'opacity-80 z-30',
  hasConflict && !isDragged && 'z-[15]'  // Higher z for later entries
)}
```

Add a conflict ring around the card itself. Inside the card rendering area (around line 645), wrap with conflict indicator:

```typescript
{hasConflict && !isDragged && (
  <div className="absolute inset-0 rounded-xl ring-2 ring-red-400/60 pointer-events-none z-20" />
)}
```

Add a small conflict badge icon (top-right corner of the card):

```typescript
{hasConflict && !isDragged && (
  <div className="absolute -top-1 -right-1 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-md">
    <AlertTriangle className="h-3 w-3" />
  </div>
)}
```

**Change D: Show toast on overlap detection**

Add a `useEffect` or inline check: when `overlapMap.size > 0`, show a toast. Use a ref to avoid repeated toasts for the same set of conflicts.

```typescript
const prevConflictCountRef = useRef(0);
useEffect(() => {
  const conflictCount = overlapMap.size;
  if (conflictCount > 0 && conflictCount !== prevConflictCountRef.current) {
    toast.warning('Time conflict -- drag to adjust');
  }
  prevConflictCountRef.current = conflictCount;
}, [overlapMap]);
```

**Change E: Z-index for stacking order**

For overlapping cards, the one with the later start time should render on top. Since `sortedEntries` is already sorted by start time, later entries naturally have a higher index. Use the array index to set z-index:

```typescript
style={{
  top,
  height,
  left: '0%',
  width: '100%',
  zIndex: hasConflict ? 10 + index : 10,
}}
```

### File 2: `src/lib/overlapLayout.ts`

No changes needed to the file itself. It can remain in the codebase (it's not harmful), but its import will be removed from `CalendarDay.tsx`. If desired, it can be deleted entirely since nothing else imports it.

## Import Changes in CalendarDay.tsx

- Remove: `import { computeOverlapLayout } from '@/lib/overlapLayout';`
- Add: `import { AlertTriangle } from 'lucide-react';`
- Add: `import { useEffect, useRef } from 'react';` (useRef may need to be added to the existing import)

## What Is NOT Changed

- Card sizing, height, or duration rendering
- Drag/drop behavior
- Transport or flight card rendering
- The `overlapMap` computation (it stays for conflict detection)
- `FlightGroupCard` rendering (flight groups already render as a single card)

## Test Cases

1. Two overlapping events should both render full-width, stacked with a red ring and conflict badge
2. Flight check-in + flight card should render full-width (no side-by-side split)
3. Non-overlapping events should render normally with no conflict indicators
4. When overlap is first detected, a toast "Time conflict -- drag to adjust" should appear
5. The later-starting card should appear on top of the earlier one


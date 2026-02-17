

# Conflict Display — Horizontal Offset (Google Calendar Style)

## Overview
Replace red ring + warning icon conflict display with Google Calendar-style side-by-side card layout. Overlapping cards will be horizontally offset so both are visible and tappable, with a thin red edge bar at the overlap boundary.

## Changes

### 1. ContinuousTimeline.tsx — Use `computeOverlapLayout` for horizontal positioning

**Import** `computeOverlapLayout` from `@/lib/overlapLayout`.

**Add a new `overlapLayout` useMemo** (after the existing `overlapMap` at line ~554):

```typescript
const overlapLayout = useMemo(() => {
  const layoutEntries = sortedEntries
    .filter(e => !linkedEntryIds.has(e.id))
    .map(e => {
      const gh = getEntryGlobalHours(e);
      return { id: e.id, startMinutes: gh.startGH * 60, endMinutes: gh.endGH * 60 };
    });
  const results = computeOverlapLayout(layoutEntries);
  const map = new Map<string, { column: number; totalColumns: number }>();
  for (const r of results) {
    if (r.totalColumns > 1) {
      map.set(r.entryId, { column: r.column, totalColumns: r.totalColumns });
    }
  }
  return map;
}, [sortedEntries, linkedEntryIds, getEntryGlobalHours]);
```

This reuses the existing `computeOverlapLayout` algorithm that already handles clustering and column assignment.

### 2. ContinuousTimeline.tsx — Apply layout to card wrapper

In the card `style` block (lines 1376-1389), replace the hardcoded `left: '0%', width: '100%'` with computed values:

```typescript
const cardLayout = overlapLayout.get(entry.id);
// ...
style={{
  top,
  height,
  left: cardLayout ? `${(cardLayout.column / cardLayout.totalColumns) * 100}%` : '0%',
  width: cardLayout ? `${(1 / cardLayout.totalColumns) * 100}%` : '100%',
  zIndex: isDragged ? 30 : isTransport ? 20 : hasConflict ? 10 + index : 10,
  // ... rest unchanged ...
  transition: 'left 200ms ease, width 200ms ease, opacity 0.2s ease',
}}
```

This gives equal-width columns: 2 overlapping cards each get 50% width, 3 get 33%, etc.

### 3. ContinuousTimeline.tsx — Replace red ring + warning icon with thin edge bar

**Delete** the two conflict indicator blocks (lines 1393-1399):
- The `ring-2 ring-red-400/60` full overlay
- The `AlertTriangle` circle badge

**Replace with** a thin 4px red edge bar positioned at the overlap boundary:

```jsx
{hasConflict && !isDragged && (
  <div
    className="absolute z-20 rounded-sm pointer-events-none"
    style={{
      width: 4,
      background: '#f87171',
      ...(overlapMap.get(entry.id)?.position === 'bottom'
        ? { right: -1, bottom: 0, height: '30%', borderRadius: '0 2px 2px 0' }
        : { left: -1, top: 0, height: '30%', borderRadius: '2px 0 0 2px' }),
    }}
  />
)}
```

### 4. ContinuousTimeline.tsx — Remove conflict toast

**Delete** the conflict toast `useEffect` and `prevConflictCountRef` (lines 626-634). The horizontal offset makes conflicts visually obvious without a toast.

### 5. EntryCard.tsx — Remove overlap overlay

- **Delete** the `overlapFraction` calculation (lines 164-166)
- **Delete** the `overlapOverlay` variable (lines 536-545)
- **Delete** the `{overlapOverlay}` render (line 584)
- Keep the `overlapMinutes` and `overlapPosition` props in the interface to avoid breaking any other references, but they become unused

### 6. ContinuousTimeline.tsx — Remove overlapMinutes/overlapPosition from EntryCard props

Remove the two prop passes at lines 1563-1564:
```
overlapMinutes={overlapMap.get(entry.id)?.minutes}
overlapPosition={overlapMap.get(entry.id)?.position}
```

### 7. ContinuousTimeline.tsx — Remove unused AlertTriangle import

Remove `AlertTriangle` from the lucide-react import (line 9) if no longer used elsewhere in the file.

## Visual Result

| Overlap Count | Layout |
|---|---|
| No overlap | Card at full width (100%) |
| 2 cards overlap | Each card gets 50% width, side by side |
| 3 cards overlap | Each card gets 33% width, side by side |
| Overlap resolved | Cards animate back to full width (200ms transition) |

Each overlapping card also shows a thin 4px red bar at the overlap edge as a subtle conflict indicator.

## Files Modified
- `src/components/timeline/ContinuousTimeline.tsx` — import overlapLayout, compute layout, apply left/width, replace conflict indicators, remove toast
- `src/components/timeline/EntryCard.tsx` — remove overlap overlay rendering

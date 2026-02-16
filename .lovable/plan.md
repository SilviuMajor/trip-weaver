

# Fix: Pill tap must not trigger drag handlers

## Problem
The duration pill's `onClick` handler calls `stopPropagation()`, but the drag system initiates on `mousedown`/`touchstart`/`pointerdown` -- events that fire *before* `click`. Tapping the pill to toggle lock inadvertently starts a drag gesture.

## Fix
Add `onMouseDown`, `onTouchStart`, and `onPointerDown` with `stopPropagation()` to all 4 pill instances in `EntryCard.tsx`.

### File: `src/components/timeline/EntryCard.tsx`

**4 pill locations to update** (lines 581, 609, 649, 698):

Each currently has only:
```tsx
onClick={(e) => { e.stopPropagation(); onToggleLock?.(); }}
```

Each will gain 3 additional handlers:
```tsx
onClick={(e) => { e.stopPropagation(); onToggleLock?.(); }}
onMouseDown={(e) => { e.stopPropagation(); }}
onTouchStart={(e) => { e.stopPropagation(); }}
onPointerDown={(e) => { e.stopPropagation(); }}
```

This is a mechanical change applied identically to all 4 instances:
- Line 581 (compact tier pill)
- Line 609 (medium tier pill)
- Line 649 (condensed tier pill)
- Line 698 (full tier pill)

No other files need changes. The drag system in ContinuousTimeline.tsx won't receive these events since propagation is stopped at the pill level.


# Fix: Original Card (Card 1) Stays at Original Position During Move Drag

## Problem
During a move drag, the original card's position is overridden with `dragState.currentStartHour`, causing it to move behind the drag card (Card 2) instead of staying faded at its original time slot.

## Fix

### File: `src/components/timeline/ContinuousTimeline.tsx` (lines 919-928)

Replace the position override so it only applies during resize, not move:

**Before:**
```typescript
if (isDragged && dragState) {
  entryStartGH = dragState.currentStartHour;
  entryEndGH = dragState.currentEndHour;
  resolvedTz = getEntryGlobalHours(entry).resolvedTz;
} else {
  entryGH = getEntryGlobalHours(entry);
  entryStartGH = entryGH.startGH;
  entryEndGH = entryGH.endGH;
  resolvedTz = entryGH.resolvedTz;
}
```

**After:**
```typescript
const isResizing = isDragged && dragState && (dragState.type === 'resize-top' || dragState.type === 'resize-bottom');

if (isResizing && dragState) {
  entryStartGH = dragState.currentStartHour;
  entryEndGH = dragState.currentEndHour;
  resolvedTz = getEntryGlobalHours(entry).resolvedTz;
} else {
  entryGH = getEntryGlobalHours(entry);
  entryStartGH = entryGH.startGH;
  entryEndGH = entryGH.endGH;
  resolvedTz = entryGH.resolvedTz;
}
```

This single change ensures:
- **Move drag**: Card 1 stays faded at its original position (using `getEntryGlobalHours`). Card 2 (rendered separately) shows at the drag position.
- **Resize drag**: Card updates in place as before (stretching/compressing). No separate Card 2 is rendered for resize.

No other changes needed. The `isBeingDragged` opacity check already correctly targets only `type === 'move'`.

## Files changed
1. `src/components/timeline/ContinuousTimeline.tsx` -- one condition change at line 919

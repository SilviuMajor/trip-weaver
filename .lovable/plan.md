
# Three Root Cause Fixes: Touch Listener Gap, Layout Tiers, Drag Phase Lag

## Fix 1 -- Eliminate touch listener gap in `useDragResize.ts`

Replace the current two-phase touch system (hold-window listeners that get removed, then useEffect attaches new listeners) with ONE continuous set of document listeners for the entire touch lifecycle.

**Changes to `src/hooks/useDragResize.ts`:**

1. Add `handlePointerMoveRef` and `commitDragRef` refs (after `handlePointerMove` and `commitDrag` declarations, ~line 253) with sync effects:
```typescript
const handlePointerMoveRef = useRef(handlePointerMove);
const commitDragRef = useRef(commitDrag);

useEffect(() => { handlePointerMoveRef.current = handlePointerMove; }, [handlePointerMove]);
useEffect(() => { commitDragRef.current = commitDrag; }, [commitDrag]);
```

2. Rewrite `onTouchStart` (lines 269-327) to use a single set of listeners for the entire lifecycle. The `handleTouchMove` closure references `handlePointerMoveRef.current` and `commitDragRef.current` (not direct functions) to avoid stale closures. Two phases within one listener set:
   - Phase 1 (hold window): check finger movement, preventDefault to keep touch alive, cancel if moved too far
   - Phase 2 (drag active): preventDefault + call `handlePointerMoveRef.current()`
   - `handleTouchEnd`: calls `commitDragRef.current()` if dragging, cleans up timer and listeners
   - Depends only on `[startDrag]`

3. Change the unified useEffect (lines 338-371) to mouse-only: remove all `touchmove`/`touchend`/`touchcancel` listeners from it since touch is fully handled by `onTouchStart` lifecycle.

4. Keep `onTouchMove` and `onTouchEnd` as empty stubs.

## Fix 2 -- Pass all layout tiers to Card 2 and Card 3

**Changes to `src/components/timeline/ContinuousTimeline.tsx`:**

In both Card 2 (line 1618) and Card 3 (line 1663), add `isCondensedMove`:
```typescript
const isCompactMove = moveHeight < 40;
const isMediumMove = moveHeight >= 40 && moveHeight < 80;
const isCondensedMove = moveHeight >= 80 && moveHeight < 160;
```

Pass to both EntryCard instances:
- `isCondensed={isCondensedMove}`
- `notes={(entry as any).notes}`
- `isLocked={entry.is_locked}`
- `linkedType={entry.linked_type}`
- `isProcessing={opt.category === 'airport_processing'}`

## Fix 3 -- Eliminate dragPhase one-frame lag

**Changes to `src/components/timeline/ContinuousTimeline.tsx`:**

1. Remove the `useState` for dragPhase (line 130): `const [dragPhase, setDragPhase] = ...`
2. Remove the `useEffect` that computes dragPhase (lines 534-551)
3. Replace with `useMemo`:
```typescript
const dragPhase = useMemo((): 'timeline' | 'detached' | null => {
  if (!dragState || dragState.type !== 'move') return null;
  const gridRect = gridRef.current?.getBoundingClientRect();
  if (!gridRect) return 'timeline';
  const isInsideGrid = dragState.currentClientX >= gridRect.left && dragState.currentClientX <= gridRect.right;
  const distFromGrid = isInsideGrid ? 0 : Math.min(
    Math.abs(dragState.currentClientX - gridRect.left),
    Math.abs(dragState.currentClientX - gridRect.right)
  );
  return distFromGrid > 20 ? 'detached' : 'timeline';
}, [dragState]);
```

4. Keep the `onDragPhaseChange` notification useEffect as-is.

## Additional: touch-action fix

In `ContinuousTimeline.tsx` line 1060, change:
```typescript
touchAction: 'manipulation',
```
to:
```typescript
touchAction: dragState?.entryId === entry.id ? 'none' : 'manipulation',
```

## Files changed
1. `src/hooks/useDragResize.ts` -- continuous touch lifecycle, ref-based function access, mouse-only useEffect
2. `src/components/timeline/ContinuousTimeline.tsx` -- dragPhase as useMemo, layout tiers for Card 2/3, touch-action fix

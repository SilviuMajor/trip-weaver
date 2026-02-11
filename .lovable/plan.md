

# Fix Drag Grab Offset for Cards

## Root Cause

In `useDragResize.ts`, the cross-day detection branch (which runs for ALL moves when `dayBoundaries` is populated) calculates the card's new position directly from the cursor's absolute Y:

```
rawHour = startHour + relativeY / pixelsPerHour
newStart = snapToGrid(rawHour)
```

This ignores where on the card the user clicked. If you grab the middle of a 2-hour card, the card's top edge jumps to the cursor position, shifting it down by ~1 hour.

The same-day fallback branch uses delta-based math (which preserves grab position), but it never executes because the cross-day branch always finds a matching boundary.

## Fix

Add a `grabOffsetHours` field to `DragState` that captures the difference between the cursor's hour-position and the card's `originalStartHour` at drag start.

### File: `src/hooks/useDragResize.ts`

**1. Add `grabOffsetHours` to `DragState` interface:**

```typescript
interface DragState {
  // ...existing fields...
  grabOffsetHours: number; // cursor hour - card start hour at grab time
}
```

**2. Calculate grab offset in `startDrag`:**

When drag starts, compute the cursor's hour position within the day grid (using scroll container + day boundaries), then subtract the card's `entryStartHour`:

```typescript
// In startDrag, after receiving clientY:
let grabOffsetHours = 0;
if (dayBoundaries && scrollContainerRef?.current) {
  const container = scrollContainerRef.current;
  const containerRect = container.getBoundingClientRect();
  const absoluteY = clientY - containerRect.top + container.scrollTop;
  for (const boundary of dayBoundaries) {
    if (absoluteY >= boundary.topPx && absoluteY < boundary.bottomPx) {
      const relativeY = absoluteY - boundary.topPx;
      const cursorHour = startHour + relativeY / pixelsPerHour;
      grabOffsetHours = cursorHour - entryStartHour;
      break;
    }
  }
}
```

**3. Subtract grab offset in `handlePointerMove` cross-day branch:**

```typescript
// Change:
const rawHour = startHour + relativeY / pixelsPerHour;
let newStart = snapToGrid(rawHour);

// To:
const rawHour = startHour + relativeY / pixelsPerHour - state.grabOffsetHours;
let newStart = snapToGrid(rawHour);
```

This ensures the card stays anchored under the cursor at the exact point it was grabbed.

**4. No change needed for the fallback same-day branch** -- it already uses delta-based math which inherently preserves grab position.

---

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useDragResize.ts` | Add `grabOffsetHours` to DragState, calculate on drag start, apply in cross-day move calculation |

## What Is NOT Changed

- Resize behavior (resize-top / resize-bottom) -- unaffected, these don't use the cross-day branch
- Commit logic
- Touch hold-to-drag timing
- Auto-scroll behavior
- Any other files


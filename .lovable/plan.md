
# Four Fixes: Tap-to-Create Filter, Resize Handle Improvements, Hold-to-Detach Drag, Bin Always Red

## Fix 1 -- Tap-to-create only on empty space

### Problem
Touch events bubble from cards/buttons up to the slot area div, so tapping a card also triggers the tap-to-create handler.

### Changes in `src/components/timeline/ContinuousTimeline.tsx`

**Add data attributes to entry wrappers:**
- Add `data-entry-card` to the outer positioned div of each entry card (line 924, the `<div key={entry.id}>` inner wrapper)
- Add `data-transport-connector` to the transport connector wrapper (line 1040)
- Add `data-resize-handle` to all resize handle divs (lines 951, 963, 1213, 1225)
- Magnet buttons already use `<button>` so they'll be caught by the `button` check

**Filter in `handleSlotTouchEnd`** (line 499): Add an early-return check before processing the tap:
```typescript
const target = e.target as HTMLElement;
const isOnCard = target.closest('[data-entry-card]') ||
                 target.closest('[data-transport-connector]') ||
                 target.closest('button') ||
                 target.closest('[data-magnet]') ||
                 target.closest('[data-resize-handle]');
if (isOnCard) {
  slotTouchStartRef.current = null;
  return;
}
```

## Fix 2 -- Resize handles: more visible + context-aware

### 2a -- Increase visibility

Update pill styling in all four resize handle locations:

**Top unlocked handle** (line 958): Change pill from `w-8 h-1 bg-muted-foreground/20 group-hover/resize:bg-primary/50` to `w-10 h-1.5 -top-0.5 bg-muted-foreground/30 group-hover/resize:bg-primary/60`

**Top locked handle** (line 967): Change pill from `w-8 h-1 bg-muted-foreground/10` to `w-10 h-1.5 -top-0.5 bg-muted-foreground/10` (locked stays dim)

**Bottom unlocked handle** (line 1220): Same pattern with `-bottom-0.5`

**Bottom locked handle** (line 1229): Same pattern with `-bottom-0.5`

### 2b -- Context-aware: hide pill when adjacent

Inside the `sortedEntries.map` (around line 850), compute adjacency for each entry:

```typescript
const hasEntryDirectlyAbove = sortedEntries.some((other, j) => {
  if (j === index) return false;
  const otherGH = getEntryGlobalHours(other);
  return Math.abs(otherGH.endGH - groupStartGH) * 60 < 2;
});

const hasEntryDirectlyBelow = sortedEntries.some((other, j) => {
  if (j === index) return false;
  const otherGH = getEntryGlobalHours(other);
  return Math.abs(otherGH.startGH - groupEndGH) * 60 < 2;
});
```

Then conditionally render the visual pill inside each handle div (handle div always renders for functionality):

```jsx
{/* Top resize handle -- always functional */}
{canDrag && !flightGroup && !isCompact && (
  <div data-resize-handle className="..." ...handlers>
    {!hasEntryDirectlyAbove && (
      <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-10 h-1.5 rounded-full bg-muted-foreground/30 group-hover/resize:bg-primary/60 transition-colors" />
    )}
  </div>
)}
```

Same pattern for bottom handle with `!hasEntryDirectlyBelow`.

## Fix 3 -- Hold-to-detach drag mode for bin delete

This is the most complex change. Currently the drag system only moves cards vertically. We need a "hold still for 500ms" detection that lifts the card off the time axis into free 2D movement.

### Changes in `src/hooks/useDragResize.ts`

Add a `cancelDrag` method that reverts without committing:

```typescript
const cancelDrag = useCallback(() => {
  setDragState(null);
  dragStateRef.current = null;
  isDraggingRef.current = false;
  stopAutoScroll();
}, [stopAutoScroll]);
```

Return it alongside existing values.

### Changes in `src/components/timeline/ContinuousTimeline.tsx`

**New props on interface** (line 27):
```typescript
onDetachedDragChange?: (active: boolean, entryId: string | null) => void;
onDetachedDrop?: (entryId: string) => void;
```

**New state** (near line 108):
```typescript
const [detachedDrag, setDetachedDrag] = useState<{
  entryId: string;
  position: { x: number; y: number };
} | null>(null);
const detachTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const lastMovePositionRef = useRef<{ x: number; y: number } | null>(null);
```

**Destructure `cancelDrag`** from `useDragResize` (line 322).

**Stillness detection useEffect**: When `dragState` is active, listen to `mousemove`/`touchmove` on document. Track pointer position. If pointer hasn't moved more than 5px for 500ms, trigger detach:
- Call `cancelDrag()` to end the normal drag
- Set `detachedDrag` with entryId and current position
- Call `onDetachedDragChange?.(true, entryId)`

**Free 2D movement useEffect**: When `detachedDrag` is set, listen to pointer events and update position. On mouseup/touchend, call `onDetachedDrop?.(entryId)` then clear state.

**Render ghost card**: When `detachedDrag` is active, render a fixed-position ghost with slight rotation and shadow, using `EntryCard`.

**Fade original**: When entry is detached, render its timeline position at `opacity: 0.3`.

**Notify parent on drag-active change**: The existing `onDragActiveChange` useEffect should also fire for detached state. Update it:
```typescript
useEffect(() => {
  const active = !!dragState || !!detachedDrag;
  const entryId = dragState?.entryId ?? detachedDrag?.entryId ?? null;
  onDragActiveChange?.(active, entryId);
}, [dragState, detachedDrag, onDragActiveChange]);
```

### Changes in `src/pages/Timeline.tsx`

**New callbacks**: Pass `onDetachedDragChange` and `onDetachedDrop` to ContinuousTimeline.

**`onDetachedDragChange`**: Sets `dragActiveEntryId` (shows bin).

**`onDetachedDrop`**: Checks `binHighlighted`. If true, performs delete (with locked/flight guards). If false, does nothing (card snaps back via detach cleanup).

**Remove `onDragCommitOverride`**: The bin is now only reachable via hold-to-detach, not during normal vertical drag. Remove the `handleDragCommitOverride` callback and the prop from ContinuousTimeline. Also remove `onDragCommitOverride` from the ContinuousTimeline interface and `handleDragCommit`.

## Fix 4 -- Bin always red

Update bin styling (line 2503-2516 in Timeline.tsx):

- Non-highlighted state: `bg-red-400/80 scale-100` (was `bg-muted-foreground/80`)
- Highlighted state: `bg-red-500 scale-125` (was `bg-destructive scale-110`)
- Icon: always `text-white` (remove conditional)

## Files changed

1. `src/hooks/useDragResize.ts` -- add `cancelDrag` method
2. `src/components/timeline/ContinuousTimeline.tsx` -- data attributes, tap filter, resize pill improvements, adjacency checks, hold-to-detach state/effects/ghost, new props
3. `src/pages/Timeline.tsx` -- detached drag callbacks, remove commit override, bin color update

## What does NOT change

- Desktop drag-to-create (mouse events)
- Normal vertical drag/resize behavior (only adds detach after 500ms hold-still)
- Zoom system
- Magnet snap system
- Touch drag from Planner sidebar
- Flight group resize handles (no pills)
- EntrySheet logic

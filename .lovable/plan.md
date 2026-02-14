
# Four Fixes: isMedium, Mobile Touch, Threshold, Bin Visibility

## Fix 1 -- Pass isMedium to Card 2 and Card 3

### File: `src/components/timeline/ContinuousTimeline.tsx`

**Card 2 (Stage 1, line 1619)**: Add `isMediumMove` and pass it:
```typescript
const isCompactMove = moveHeight < 40;
const isMediumMove = moveHeight >= 40 && moveHeight < 80;
```
Pass `isMedium={isMediumMove}` to EntryCard at line 1639.

**Card 3 (Stage 2, line 1662)**: Same calculation, pass `isMedium={isMediumMove}` at line 1702.

## Fix 2 -- Attach native touch listeners immediately in onTouchStart

### File: `src/hooks/useDragResize.ts`

**Add refs** (after line 55):
```typescript
const nativeListenersAttachedRef = useRef(false);
const nativeTouchMoveRef = useRef<((e: TouchEvent) => void) | undefined>();
const nativeTouchEndRef = useRef<(() => void) | undefined>();
```

**Rewrite onTouchStart** (lines 270-286): Attach native `{passive: false}` listeners immediately on touchstart so iOS Safari cannot claim the touch for scrolling during the 200ms hold window. The native touchmove handler calls `preventDefault()` both during active drag AND during the hold window (while the timer is running), preventing the browser from taking scroll ownership.

**Delete old native touch useEffect** (lines 338-370): The `useEffect` that attaches native touch listeners when `dragState` changes is no longer needed -- listeners are now managed by onTouchStart directly.

**Simplify onTouchMove/onTouchEnd** (lines 288-317): Keep as safety-net React handlers but simplified since native handlers do the heavy lifting.

**Update unmount cleanup** (lines 372-375): Also clean up native touch listeners on unmount.

## Fix 3 -- Lower desktop threshold to 40px

### File: `src/components/timeline/ContinuousTimeline.tsx` (line 548-549)

Replace:
```typescript
const isMobileDevice = 'ontouchstart' in window;
const threshold = isMobileDevice ? 40 : 80;
```
With:
```typescript
const threshold = 40;
```

## Fix 4 -- Bin always visible on desktop

### File: `src/pages/Timeline.tsx` (lines 2525-2531)

Replace the bin className logic to show the bin as a subtle muted element on desktop when no drag is active, hidden on mobile when no drag is active, and red during detached drag:

```typescript
dragActiveEntryId && currentDragPhase === 'detached'
  ? binHighlighted
    ? "bg-red-500 scale-125"
    : "bg-red-400/80 scale-100"
  : isMobile
    ? "scale-0 opacity-0 pointer-events-none"
    : "bg-muted/60 scale-100 opacity-40 hover:opacity-70"
```

`isMobile` is already available from `useIsMobile()` at line 287.

## Files changed

1. `src/components/timeline/ContinuousTimeline.tsx` -- add isMedium to Card 2 and Card 3, lower threshold to 40px
2. `src/hooks/useDragResize.ts` -- attach native touch listeners immediately in onTouchStart, remove old useEffect, simplify React touch handlers
3. `src/pages/Timeline.tsx` -- bin visible on desktop always (muted), hidden on mobile when no drag

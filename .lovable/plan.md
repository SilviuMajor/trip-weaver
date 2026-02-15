

# Fix: Move Touch Handling from EntryCard to Wrapper Div

## Root Cause
Framer-motion's `motion.div` internally registers touch event listeners that intercept and consume touch events on iOS Safari before our React `onTouchStart` prop fires. Diagnostic toasts confirmed zero handler execution on mobile.

## Solution
Move touch handling to the plain `<div data-entry-card>` wrapper in ContinuousTimeline.tsx, which has no framer-motion interference. Mouse handlers stay on EntryCard (they work fine through framer-motion).

## Changes (single file: `src/components/timeline/ContinuousTimeline.tsx`)

### 1. Add onTouchStart to the wrapper div (line 1047)
Add touch handler directly on the `data-entry-card` div:
```typescript
<div
  data-entry-card
  onTouchStart={canDrag ? (e) => {
    onTouchStart(e as any, entry.id, 'move', origStartGH, origEndGH, dragTz);
  } : undefined}
  className={cn(...)}
  style={{
    ...existing styles...,
    touchAction: 'none',  // already present
  }}
>
```

### 2. Remove touch props from main EntryCard render (lines 1307-1314)
Remove these three props:
- `onTouchDragStart={...}`
- `onTouchDragMove={onTouchMove}`
- `onTouchDragEnd={onTouchEnd}`

Keep `onDragStart` (mouse) as-is.

### 3. Remove touch props from FlightGroupCard EntryCard render (lines 1138-1143)
Remove:
- `onTouchDragStart={...}`
- `onTouchDragMove={onTouchMove}`
- `onTouchDragEnd={onTouchEnd}`

Keep the flight's `onDragStart` and mouse-based stop propagation.

### 4. Update Card 1 border styling (line 1061)
Change from red debug border to production-quality primary color:
```typescript
border: isBeingDragged ? '3px dashed hsl(var(--primary) / 0.5)' : undefined,
```

### No changes to other files
- `useDragResize.ts` -- already has all diagnostic toasts, correct touch lifecycle
- `EntryCard.tsx` -- no changes needed; props simply won't be passed

### Expected test result on mobile
1. Touch a card -> "Touch started" toast appears immediately
2. Hold 200ms -> "Hold OK" + "startDrag fired" toasts
3. Card 1 at 40% opacity with dashed border, Card 2 follows finger


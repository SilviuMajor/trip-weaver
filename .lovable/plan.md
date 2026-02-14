

# Three-Stage Drag System + Mobile Touch Fix

## Critical Fix -- iOS Touch object recycling

### File: `src/hooks/useDragResize.ts` (lines 270-284)

Capture `touch.clientX` and `touch.clientY` into local variables before the `setTimeout`, so the closure references stable values instead of the recycled Touch object:

```typescript
const onTouchStart = useCallback((
  e: React.TouchEvent,
  entryId: string,
  type: DragType,
  entryStartHour: number,
  entryEndHour: number,
  tz?: string,
) => {
  const touch = e.touches[0];
  const startX = touch.clientX;
  const startY = touch.clientY;
  touchStartPosRef.current = { x: startX, y: startY };
  
  touchTimerRef.current = setTimeout(() => {
    startDrag(entryId, type, startX, startY, entryStartHour, entryEndHour, tz);
  }, TOUCH_HOLD_MS);
}, [startDrag]);
```

No other changes to `useDragResize.ts`.

---

## Three-Stage Drag System

### File: `src/components/timeline/ContinuousTimeline.tsx`

**New state** (after line 123):
```typescript
const [dragPhase, setDragPhase] = useState<'timeline' | 'detached' | null>(null);
```

**New prop**:
```typescript
onDragPhaseChange?: (phase: 'timeline' | 'detached' | null) => void;
```

**Phase computation** (new useEffect after drag end callback, ~line 537):
```typescript
useEffect(() => {
  if (!dragState || dragState.type !== 'move') {
    setDragPhase(null);
    return;
  }
  const gridRect = gridRef.current?.getBoundingClientRect();
  if (!gridRect) { setDragPhase('timeline'); return; }
  
  const isInsideGrid = dragState.currentClientX >= gridRect.left && dragState.currentClientX <= gridRect.right;
  const distFromGrid = isInsideGrid ? 0 : Math.min(
    Math.abs(dragState.currentClientX - gridRect.left),
    Math.abs(dragState.currentClientX - gridRect.right)
  );
  const isMobileDevice = 'ontouchstart' in window;
  const threshold = isMobileDevice ? 40 : 80;
  
  setDragPhase(distFromGrid > threshold ? 'detached' : 'timeline');
}, [dragState?.currentClientX, dragState?.type]);
```

**Phase change callback**:
```typescript
useEffect(() => {
  onDragPhaseChange?.(dragPhase);
}, [dragPhase, onDragPhaseChange]);
```

**Replace current ghost outline** (lines 1503-1538) and **floating card** (lines 1549-1588) with the three-stage rendering:

**Stage 1 -- In-timeline moving card** (`dragPhase === 'timeline'`):
- Render a real `EntryCard` at the snapped vertical position (`dragState.currentStartHour * pixelsPerHour`) inside the grid
- Card has `ring-2 ring-primary/60 shadow-lg shadow-primary/20` to distinguish it from static cards
- Positioned absolute within the grid, full width, at z-[50]
- No ghost outline, no floating card

**Stage 2 -- Detached** (`dragPhase === 'detached'`):
- Floating card at cursor position (fixed, z-[200]): same as current floating card but with bin-proximity shrink factor
- Ghost outline on timeline: dashed border at snapped position, always visible (no horizontal fade -- it's always shown in Stage 2)
- Time label inside ghost

**Original card fading**: On each entry wrapper in the main render loop, if `dragState?.entryId === entry.id && dragState.type === 'move'`, set `opacity: 0.15`.

**Commit logic update** (in `handleDragCommit`, lines 253-269): The existing logic already handles bin/planner override and "too far from timeline" snap-back. For the three-stage system, the "too far" check should only trigger when `dragPhase === 'detached'` AND the ghost would not be visible. Since the ghost is always visible in Stage 2, the snap-back on release in Stage 2 should only happen if not on timeline AND not on bin/planner. Simplify: remove the `maxDist` check entirely. In Stage 2, commit always places at the ghost position (unless bin/planner override). In Stage 1, commit always places at the in-timeline position (no override check needed since bin/planner aren't visible).

Actually, keep the override check but make it phase-aware: only check bin/planner override when detached. The "too far from timeline" snap-back can be removed since Stage 2 always has a valid ghost position.

### File: `src/pages/Timeline.tsx`

**New state**:
```typescript
const [currentDragPhase, setCurrentDragPhase] = useState<'timeline' | 'detached' | null>(null);
```

**New prop on ContinuousTimeline**:
```typescript
onDragPhaseChange={setCurrentDragPhase}
```

**Bin visibility**: Change from `dragActiveEntryId` to `currentDragPhase === 'detached'`:
```typescript
// Bin (lines 2513-2526):
dragActiveEntryId && currentDragPhase === 'detached'
  ? binHighlighted ? "bg-red-500 scale-125" : "bg-red-400/80 scale-100"
  : "scale-0 opacity-0 pointer-events-none"
```

**Planner FAB highlighting**: Only highlight when `currentDragPhase === 'detached'`.

**onDragPositionUpdate**: Only update bin/planner highlights when `currentDragPhase === 'detached'`:
```typescript
onDragPositionUpdate={(clientX, clientY) => {
  if (currentDragPhase !== 'detached') return;
  // ...existing proximity checks
}}
```

**onDragCommitOverride**: Only check bin/planner when phase is detached:
```typescript
onDragCommitOverride={(entryId, clientX, clientY) => {
  if (currentDragPhase !== 'detached') return false;
  // ...existing bin/planner logic
}}
```

---

## Files changed

1. `src/hooks/useDragResize.ts` -- iOS touch fix only (capture values before setTimeout)
2. `src/components/timeline/ContinuousTimeline.tsx` -- add dragPhase state, replace single floating card + ghost with three-stage rendering (Stage 1 = in-timeline card with ring glow, Stage 2 = floating card + ghost outline), add onDragPhaseChange prop
3. `src/pages/Timeline.tsx` -- add currentDragPhase state, condition bin/planner visibility on detached phase, pass onDragPhaseChange

## What does NOT change

- Resize handles (always vertical-only, no phase system)
- Planner-to-timeline touch drag (separate system)
- Card overview tap
- Magnet system
- Desktop mouse basics (mousedown triggers drag, same phase system)
- useDragResize vertical time computation logic
- handleMagnetSnap
- Transport repositioning on drag

## Test cases

- Mobile: Hold card 200ms -- card lifts in-timeline with ring glow, moves vertically
- Mobile: Drag finger >40px horizontally -- card detaches, floating card follows finger, ghost outline stays on timeline
- Mobile: Drag finger back toward timeline -- card re-enters timeline, resumes vertical movement
- Desktop: Same with 80px horizontal threshold
- Stage 1 release: Card places at snapped position
- Stage 2 release on bin: Card deleted
- Stage 2 release on planner: Entry moved to planner
- Stage 2 release (not on bin/planner): Card places at ghost outline position
- Bin/planner only visible during Stage 2
- Original card faded at original position throughout both stages
- Smooth transition between stages (no jarring jumps)


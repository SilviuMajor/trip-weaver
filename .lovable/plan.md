
# Unified "Lift and Place" Drag System

## Overview
Replace the current two-mode drag system (vertical-only drag + hold-to-detach for 2D) with a single unified experience: hold 200ms, card lifts off and follows finger freely in 2D, with a dashed ghost outline on the timeline showing where it will land.

## Architecture

The changes span three files:
1. `src/hooks/useDragResize.ts` -- add X tracking to DragState, pass clientX/clientY through all handlers and commit
2. `src/components/timeline/ContinuousTimeline.tsx` -- remove detach system, render floating card + ghost outline, pass commit position to parent
3. `src/pages/Timeline.tsx` -- replace detached drop handling with commit override, simplify proximity detection

## Detailed Changes

### File 1: `src/hooks/useDragResize.ts`

**DragState interface** (lines 5-16): Add four new fields:
```
currentClientX: number;
currentClientY: number;
startClientX: number;
startClientY: number;
```

**onCommit signature** (line 23): Extend to include `clientX?: number, clientY?: number` parameters.

**startDrag** (lines 96-132): Change signature to accept `clientX: number` alongside `clientY`. Store `startClientX`, `startClientY`, `currentClientX`, `currentClientY` in initial state.

**handlePointerMove** (line 134): Change signature from `(clientY: number)` to `(clientX: number, clientY: number)`. Update `currentClientX` and `currentClientY` on the state alongside existing vertical logic. The vertical time computation (for ghost position) remains unchanged.

**commitDrag** (lines 226-236): Pass `state.currentClientX` and `state.currentClientY` to `onCommit` as the 7th and 8th arguments. Also always call onCommit (remove the `wasDraggedRef.current` guard for 'move' type -- the parent will decide if the position changed enough to commit).

Actually, keep `wasDraggedRef` but set it to true more aggressively for moves -- any pointer movement beyond 5px in any direction (not just Y).

**onMouseDown** (lines 246-257): Pass `e.clientX` to `startDrag`.

**onTouchStart** (lines 260-274): Pass `touch.clientX` to `startDrag`.

**onTouchMove** (line 292): Pass `touch.clientX` to `handlePointerMove`.

**Global mouse listener** (line 312): Pass `e.clientX` to `handlePointerMove`.

**Native touch listener** (line 334): Pass `touch.clientX` to `handlePointerMove`.

### File 2: `src/components/timeline/ContinuousTimeline.tsx`

**Remove detach system entirely:**
- Remove `detachedDrag` state, `detachTimerRef`, `lastMovePositionRef` (lines 121-126)
- Remove stillness detection useEffect (lines 510-558)
- Remove free 2D movement useEffect (lines 560-595)
- Remove detached ghost rendering (lines 1569-1603)
- Remove `onDetachedDragChange` and `onDetachedDrop` from props interface (lines 63-64) and destructuring (lines 103-104)
- Update the `onDragActiveChange` useEffect (lines 502-507) to only use `dragState` (no `detachedDrag`)

**Add new props:**
```typescript
onDragCommitOverride?: (entryId: string, clientX: number, clientY: number) => boolean;
onDragPositionUpdate?: (clientX: number, clientY: number) => void;
onDragEnd?: () => void;
```

**Modify the drag commit handler** passed to `useDragResize`: Wrap `onEntryTimeChange` to first check `onDragCommitOverride` with the release position. If override returns true (bin/planner handled it), skip timeline commit. Then check if release was too far from timeline horizontally (ghost invisible) -- if so, snap back (don't commit). Otherwise, proceed with normal time commit.

**Floating card rendering**: After the "Trip Ends" marker, when `dragState` is active and `dragState.type === 'move'`, render:
- A fixed-position floating card clone at `(dragState.currentClientX, dragState.currentClientY)` with slight rotation, scale 0.85, drop shadow. Card shrinks as it approaches the bin (compute distance to bin via checking a bin rect passed as prop or computed inline).
- The floating card uses `EntryCard` in compact mode with the dragged entry's data.

**Ghost outline rendering**: Inside the grid `div` (alongside entries), when `dragState` is active and type is 'move':
- A dashed border div at the ghost's vertical position (`dragState.currentStartHour * pixelsPerHour`) with the entry's duration height
- Opacity fades based on horizontal distance from timeline center: `opacity = max(0, 1 - dist / (screenWidth * 0.4))`
- Shows a time label (HH:MM -- HH:MM) inside the ghost

**Original card fading**: On each entry's wrapper div, if `dragState?.entryId === entry.id && dragState.type === 'move'`, set `opacity: 0.2`.

**Position update callback**: In a useEffect watching `dragState?.currentClientX` and `dragState?.currentClientY`, call `onDragPositionUpdate?.(x, y)` so the parent can update bin/planner highlighting.

**Drag end callback**: When dragState becomes null, call `onDragEnd?.()`.

**Resize stays vertical-only**: The floating card + ghost only render for `dragState.type === 'move'`. Resize types ('resize-top', 'resize-bottom') continue using the existing inline position update (no floating card, no ghost).

### File 3: `src/pages/Timeline.tsx`

**Remove old detach handling:**
- Remove `onDetachedDragChange` and `onDetachedDrop` props from `ContinuousTimeline` usage (lines 2230-2275)
- The proximity detection useEffect (lines 1588-1616) stays but is driven by `dragActiveEntryId` which is now set only from `onDragActiveChange`

**Add new callbacks:**

`handleDragCommitOverride`: Check bin and planner proximity at release position. Return true if handled (delete or send to planner). Contains the same logic currently in `onDetachedDrop`.

`handleDragPositionUpdate`: Update bin/planner highlighting based on current drag position. Replaces the separate proximity useEffect (which can be simplified or kept as-is since it listens to mouse/touch globally).

`handleDragEnd`: Reset `dragActiveEntryId`, `binHighlighted`, `plannerFabHighlighted`.

**Pass new props to ContinuousTimeline:**
```
onDragCommitOverride={handleDragCommitOverride}
onDragPositionUpdate={handleDragPositionUpdate}
onDragEnd={handleDragEnd}
```

**Bin visibility**: The bin now shows whenever `dragActiveEntryId` is set (which happens during any move drag, not just detached). This means the bin appears immediately on drag start (not after hold-to-detach).

**Planner FAB during drag**: Same -- shows drop-target styling whenever `dragActiveEntryId` is set.

**Bin shrink animation**: When delete is triggered via `handleDragCommitOverride`, briefly delay the actual delete by 300ms. During this time, render a shrinking element animating from the release position toward the bin center. Use a `deletingEntry` state with position + timestamp, and CSS transition for `transform: scale(0)` + `opacity: 0`.

## What does NOT change
- Touch drag from Planner to Timeline (separate system in CategorySidebar)
- Card overview tap (click handler)
- Resize handles (vertical-only, no lift-off, no floating card)
- Magnet system
- Flight cards still show toast on drag attempt ("Flight position is fixed")

## Files changed
1. `src/hooks/useDragResize.ts` -- X tracking in DragState, clientX/Y through all handlers
2. `src/components/timeline/ContinuousTimeline.tsx` -- remove detach system, add floating card + ghost + commit override
3. `src/pages/Timeline.tsx` -- replace detach handlers with commit override, drag position update, drag end callbacks

## Test cases
- Hold card 200ms on mobile: card lifts, follows finger in 2D
- Ghost outline: dashed rectangle on timeline at vertical position, updates as finger moves
- Ghost fade: drag far left, ghost fades out; bring back, ghost reappears
- Release on timeline (ghost visible): card moves to ghost position
- Release on bin: card shrinks into bin, entry deleted
- Release on planner button: entry moved to planner
- Release elsewhere (no ghost, no bin, no planner): card snaps back
- Bin + planner always visible during any move drag
- Flights: still can't be dragged (toast shown)
- Resize: still vertical-only, 5-min snaps, no floating card

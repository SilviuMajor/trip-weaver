

# Two-Tier Drag Update System for Mobile Performance

## Problem
Every `setDragState()` call re-renders the entire ContinuousTimeline component (1749 lines) on every touchmove -- up to 60+ times per second. Desktop CPUs handle this; mobile CPUs cannot.

## Solution
Split drag updates into two tiers:

- **Tier 1 (every frame, no React):** Update the floating card (Card 3) position by writing directly to the DOM via a ref and a RAF loop. Zero re-renders.
- **Tier 2 (only on snap/phase changes, React):** Call `setDragState()` only when the snapped hour position changes or the drag phase crosses the detach threshold. This updates the timeline card position (Card 2) and opacity (Card 1), which only need to update in 5-minute increments.

**Result:** React re-renders drop from ~60/s to ~5-10/s during drag, while the floating card still tracks at 60fps.

---

## Technical Changes

### File 1: `src/hooks/useDragResize.ts`

1. **Add two new refs** (after line 56):
   - `clientXRef = useRef(0)` and `clientYRef = useRef(0)`

2. **Initialize refs in `startDrag`** (line ~138):
   - Set `clientXRef.current = clientX` and `clientYRef.current = clientY`

3. **Throttle `setDragState` in `handlePointerMove` move branch** (lines 171-188):
   - Always update `clientXRef`/`clientYRef` on every move
   - Only call `setDragState` when snapped position changes OR when horizontal distance crosses the detach phase threshold
   - Include `currentClientX`/`currentClientY` in the state update when it does fire (for `dragPhase` computation)

4. **Update resize branches** (lines 196-210):
   - Add `clientXRef.current = clientX` and `clientYRef.current = clientY` after existing `setDragState` calls

5. **Export the new refs** in the return object (line 394-402):
   - Add `clientXRef` and `clientYRef`

### File 2: `src/components/timeline/ContinuousTimeline.tsx`

1. **Destructure new refs** (line 339):
   - Add `clientXRef` and `clientYRef` from `useDragResize`

2. **Add `floatingCardRef`** (near other refs, ~line 115):
   - `const floatingCardRef = useRef<HTMLDivElement>(null)`

3. **Add RAF loop effect** (after the drag phase effect, ~line 548):
   - Runs when `dragState?.entryId` and `dragState?.type` are set
   - Reads `clientXRef.current` / `clientYRef.current` every frame
   - Computes translate position and shrinkFactor (bin proximity)
   - Writes directly to `floatingCardRef.current.style.transform`
   - Cleans up with `cancelAnimationFrame` on unmount/change

4. **Update Card 3 rendering** (lines 1708-1717):
   - Add `ref={floatingCardRef}` to the floating card div
   - Set initial transform from `clientXRef.current`/`clientYRef.current`
   - Remove the inline shrinkFactor calculation from the render body (RAF loop handles it)

5. **Update `dragPhase` useMemo** (lines 534-543):
   - Read `clientXRef.current` instead of `dragState.currentClientX`
   - The `dragState` dependency still triggers recomputation when snap/phase changes happen

### What does NOT change
- Card 1 (opacity ghost) and Card 2 (timeline position) rendering
- Touch handler lifecycle in `useDragResize`
- Resize behavior (keeps existing `setState` -- less performance-critical)
- Time pills, ghost outline, bin/planner drop logic, auto-scroll
- `commitDrag` (still reads `dragStateRef` which has the latest snapped values; `currentClientX`/`currentClientY` are updated on phase-crossing re-renders)


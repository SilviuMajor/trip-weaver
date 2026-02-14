

# Fix Floating Card Appearance + Add Gutter Time Pills

## Fix 1 -- Make Stage 2 floating card identical to Stage 1 in-timeline card

### File: `src/components/timeline/ContinuousTimeline.tsx`

**Add `binRef` prop** (line 66, props interface):
```typescript
binRef?: React.RefObject<HTMLDivElement>;
```

**Destructure it** in the component (around line 107, alongside other props).

**Replace Stage 2 floating card** (lines 1595-1639) with a version that matches Stage 1 exactly:

- Remove `scale(0.92)`, `rotate(-1.5deg)`, `filter: drop-shadow(...)`, `opacity: 0.9`
- Compute `moveHeight` from `durationGH * pixelsPerHour` (same as Stage 1)
- Use `isCompactMove = moveHeight < 40` (same logic as Stage 1)
- Set `height: moveHeight` on the container
- Center vertically on cursor: `top: dragState.currentClientY - moveHeight / 2`
- Add same `ring-2 ring-primary/60 shadow-lg shadow-primary/20 rounded-2xl overflow-hidden` wrapper
- Use `transition-[left,top] duration-100 ease-out` (not `transition-all`)
- Add bin proximity shrink using the new `binRef` prop: only apply `transform: scale(shrinkFactor)` when within 150px of bin, graduating down to 0.3x

### File: `src/pages/Timeline.tsx`

Pass `binRef` to ContinuousTimeline (around line 2200):
```typescript
binRef={binRef}
```

## Fix 2 -- Time pills in gutter during drag and resize

### File: `src/components/timeline/ContinuousTimeline.tsx`

**A) Add time pills for move drag** (insert after weather column, before ghost outline, around line 1522):

Two white pills in the gutter at the start and end time positions of the dragged card. Positioned at `left: -72`, styled as `rounded-full bg-white dark:bg-zinc-800 border border-border shadow-sm px-2 py-0.5 text-[10px] font-bold`. z-[60] to sit above hour labels.

**B) Add time pill for resize** (same location):

One pill at the active edge being resized (top for resize-top, bottom for resize-bottom).

**C) Hide overlapping hour labels** (lines 657-671):

In the hour label rendering, compute whether each label overlaps with a time pill (within 20px). If so, fade it out with `opacity: 0` and `transition: opacity 0.15s`.

**D) Remove time label from ghost outline** (line 1546):

Remove the `<span>` inside the ghost outline div -- time info now lives in the gutter pills.

## Files changed

1. `src/components/timeline/ContinuousTimeline.tsx` -- fix floating card rendering, add time pills, hide overlapping hour labels, remove ghost text
2. `src/pages/Timeline.tsx` -- pass binRef prop

## What does NOT change

- Stage 1 in-timeline card (already correct)
- Original card fading (already correct)
- Phase computation logic
- Bin/planner drop logic
- Resize mechanics
- Magnet system

## Technical details

Hour label hiding logic computes pixel positions of time pills and checks `Math.abs(labelTop - pillTop) < 20`. This also applies to the 30-minute labels when zoomed in.

The floating card `transition-[left,top]` ensures only position animates, not size or ring appearance.

Bin shrink: `shrinkFactor = binDist < 150 ? Math.max(0.3, binDist / 150) : 1`. Only adds `transform: scale(...)` when shrinkFactor < 1, otherwise no transform.

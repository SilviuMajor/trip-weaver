

# Snap Detection During Drag

## What This Does
When dragging a card on the timeline, if it comes within 20 minutes of another card's edge, the ghost outline will "jump" to the adjacent position and turn green with a checkmark label, indicating the cards will snap together.

## Technical Changes

### File: `src/components/timeline/ContinuousTimeline.tsx`

**1. Add `snapTarget` computed value (~line 462, after `overlapMap`)**

A new `useMemo` that runs during move drags. It iterates `sortedEntries`, skipping the dragged card and transport entries (`category === 'transfer'`), checking if the dragged card's start/end edge is within 20 minutes (0.333 hours) of any other card's end/start edge. Returns the best match with `entryId`, `side` ('above'/'below'), and `snapStartHour`.

**2. Modify ghost outline rendering (lines 1744-1758)**

The existing detached ghost outline currently uses `dragState.currentStartHour` directly. Change it to:
- Compute `ghostStartGH` as `snapTarget.snapStartHour` when snap is active, otherwise `dragState.currentStartHour`
- When snapped: change border from `border-primary/50` to `border-green-400/70`, background from `bg-primary/5` to `bg-green-400/10`, and add a small green label inside the ghost

**3. Modify time pills during move drag (lines 1709-1729)**

Update the start/end global hours used for time pill positioning to use snapped position when `snapTarget` is non-null.

**4. Modify Stage 1 (timeline) moving card (lines 1760-1797)**

Update the `moveTop` calculation to use snapped position when `snapTarget` is non-null, so the in-timeline card also jumps to the snap position.

**5. Add green connector line**

When `snapTarget` is active, render a subtle green dashed vertical line between the snap target entry's edge and the ghost outline to visually indicate they will be linked.

### No changes to:
- Drag commit/release logic (unchanged per spec)
- `useDragResize` hook
- Any other files


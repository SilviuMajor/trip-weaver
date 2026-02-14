
# Three Features: Mobile Tap-to-Create, Resize Handle Pills, Drag-to-Delete Bin

## Overview
Three independent features that improve timeline interactivity, especially on mobile: (A) single-tap on empty space to create entries, (B) visible resize handle pills on cards, and (C) a trash bin that appears during drag for quick deletion.

## Feature A -- Mobile Tap-to-Create

### File: `src/components/timeline/ContinuousTimeline.tsx`

**Add refs** (near line 108):
- `tapCreateTimeoutRef` for the 320ms delay to distinguish single-tap from double-tap
- `slotTouchStartRef` to track touch start position for scroll-vs-tap detection

**Add `onTouchStart` to the grid div** (line 498-514, the `data-timeline-area` div):
- Record touch start position when `e.touches.length === 1`

**Replace `handleSlotTouchEnd`** (lines 485-494):
- Check if finger moved more than 15px (scroll) -- if so, ignore
- If double-tap (within 300ms of last tap), cancel any pending create timeout and call `onResetZoom`
- Otherwise, set a 320ms timeout. When it fires, compute the tapped global minute (snapped to 15min), then call `onDragSlot(minutesToIso(minutes), minutesToIso(minutes + 60))` to open EntrySheet with a 1-hour block

No changes to desktop drag-to-create (mouse events remain untouched).

## Feature B -- Resize Handle Visual Pills

### File: `src/components/timeline/ContinuousTimeline.tsx`

**Top resize handle** (lines 898-906, the `canDrag && !flightGroup` block):
- Change `h-2` to `h-3`, add `group/resize` class
- Insert a child div: `w-8 h-1 rounded-full bg-muted-foreground/20 group-hover/resize:bg-primary/50 transition-colors`, centered horizontally at top

**Top locked resize handle** (lines 907-913):
- Change `h-2` to `h-3`
- Insert similar pill but dimmer: `bg-muted-foreground/10`, no hover effect

**Bottom resize handle** (lines 1156-1164):
- Change `h-2` to `h-3`, add `group/resize` class
- Insert child pill at `bottom-0` instead of `top-0`

**Bottom locked resize handle** (lines 1165-1171):
- Same as above but dimmer styling

**Excluded from**: flight group resize handles (lines 957-980), transport connectors, compact cards (add `!isCompact` guard to the canDrag conditions for top/bottom handles)

## Feature C -- Drag-to-Delete Bin

### File: `src/components/timeline/ContinuousTimeline.tsx`

**New props** on `ContinuousTimelineProps` interface (line 27):
- `onDragActiveChange?: (active: boolean, entryId: string | null) => void`
- `onDragCommitOverride?: (entryId: string) => boolean`

**Expose drag-active state** -- add a `useEffect` that calls `onDragActiveChange` when `dragState` changes

**Modify `handleDragCommit`** (line 238) -- at the top, check `if (onDragCommitOverride?.(entryId)) return;` before doing any time change logic

### File: `src/pages/Timeline.tsx`

**New state** (near line 158):
- `dragActiveEntryId: string | null`
- `binHighlighted: boolean`
- `binRef: React.RefObject<HTMLDivElement>`

**Pass callbacks to ContinuousTimeline**:
- `onDragActiveChange` sets/clears `dragActiveEntryId`
- `onDragCommitOverride` returns true (intercepting the drop) when `binHighlighted` is true

**Bin proximity detection** -- `useEffect` that, when `dragActiveEntryId` is set, listens to `mousemove` and `touchmove` on `document`, computes distance from pointer to bin center, and sets `binHighlighted` when within 60px

**Delete logic** in `onDragCommitOverride`:
- If entry is locked: toast "Can't delete -- unlock first", return true
- If category is `flight` or `airport_processing`: toast "Can't delete flights by dragging", return true
- Otherwise: delete via `supabase.from('entries').delete().eq('id', entryId)`, refresh data, show toast

**Render the bin** (near bottom, after zoom indicator around line 2437):
- Fixed `bottom-6 left-6` circle, `h-14 w-14`, with `Trash2` icon
- `scale-0 opacity-0 pointer-events-none` when no drag active
- `bg-muted-foreground/80` when drag active but not highlighted
- `bg-red-500 scale-110` when highlighted (card is near bin)
- Import `Trash2` from lucide-react

## Files changed
1. `src/components/timeline/ContinuousTimeline.tsx` -- tap-to-create, resize pills, drag-active/commit-override props
2. `src/pages/Timeline.tsx` -- bin state, proximity detection, delete logic, bin rendering

## What does NOT change
- Desktop drag-to-create (mouse events)
- Existing drag/resize mechanics in useDragResize hook
- Zoom system, weather, transport, planner sidebar
- Flight group card resize handles (no pills added)
- EntrySheet logic

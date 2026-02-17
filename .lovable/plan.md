

# Group Drop + Transport Recalculation

## Overview
When a group drag (from Prompt 5) is released, all entries in the block move together by the same time delta. Transports within the group are recalculated in the background. Snap detection also works for group edges.

## Changes

### 1. `ContinuousTimeline.tsx` -- Add `onGroupDrop` prop and group commit logic

**Props interface (line ~72):**
- Add `onGroupDrop?: (entryIds: string[], deltaMs: number) => void;`

**Destructure the new prop (line ~117)**

**`handleDragCommit` (line ~260):**
- Add an early check: if `dragState.dragMode === 'group'` and `dragState.blockEntryIds.length > 0`:
  - Compute `deltaHours = newStartGH - dragState.originalStartHour`
  - Compute `deltaMs = deltaHours * 3600000`
  - Call `onGroupDrop?.(dragState.blockEntryIds, deltaMs)`
  - Return early (skip individual move logic)

**Snap detection (`snapTarget` useMemo, line ~524):**
- When `dragState.dragMode === 'group'`, compute group bounds instead of single-card bounds:
  - Find the first and last entries in `dragState.blockEntryIds` from `sortedEntries`
  - Calculate group start/end global hours plus the drag delta
  - Use group top edge for "snap above" and group bottom edge for "snap below" detection
  - This allows the entire block's edges to snap to nearby cards

**Snap release for groups (line ~282):**
- When `dragState.dragMode === 'group'` and `snapTargetRef.current` is active:
  - For `side === 'below'`: use the LAST entry in the block as the dragged entry for `onSnapRelease`
  - For `side === 'above'`: use the FIRST entry in the block as the dragged entry for `onSnapRelease`
  - Still call `onGroupDrop` for the positional shift of all entries
  - Then call `onSnapRelease` for transport creation at the snap edge

**Ghost/floating visuals (lines ~1811-1903):**
- When `dragState.dragMode === 'group'`:
  - Ghost outline covers entire block height (first entry start to last entry end, shifted by delta)
  - Floating card area covers the full block height

### 2. `Timeline.tsx` -- Implement `handleGroupDrop`

**New callback (after `handleChainShift`/`recalculateTransports`, around line 1115):**

```
handleGroupDrop(entryIds: string[], deltaMs: number)
```

- For each entry ID, find the current entry and compute new start/end by adding `deltaMs`
- Batch update all entries in the database
- Register undo/redo action storing old and new times for all entries
- Call `fetchData()` to refresh
- Fire-and-forget: filter transport entries from `entryIds` and call `recalculateTransports` for them

**Pass prop (in the ContinuousTimeline JSX):**
- Add `onGroupDrop={handleGroupDrop}`

### 3. `useDragResize.ts` -- Expose `dragMode` and `blockEntryIds`

Note: Prompt 5 adds `dragMode` and `blockEntryIds` to `DragState`. This prompt assumes those fields exist. If Prompt 5 has not been implemented yet, the `dragMode` field will default to `undefined`, and all group-related code paths will be skipped (safe fallback). The group drop logic only activates when `dragState.dragMode === 'group'`.

## Behavior Summary

| Scenario | Result |
|----------|--------|
| Group drag released (no snap) | All entries shift by deltaMs, transports recalculate |
| Group drag released near a card (snap) | Entries shift to snapped position + transport created at snap edge |
| Ctrl+Z after group drop | All entries return to original positions |
| Individual drag (dragMode !== 'group') | Existing behavior unchanged |

## Files Modified
- `src/components/timeline/ContinuousTimeline.tsx` -- new prop, group commit/snap logic, group ghost visuals
- `src/pages/Timeline.tsx` -- new `handleGroupDrop` callback
- No changes to `useDragResize.ts`, `blockDetection.ts`, or edge functions

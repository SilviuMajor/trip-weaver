

# Block Detection Utility + Chain Shift on Resize

## Overview
Create a shared utility to detect "blocks" (chains of adjacent entries connected by transport with no gaps), then use it during bottom-edge resize to shift all subsequent entries in the block by the same delta.

## Changes

### 1. New file: `src/lib/blockDetection.ts`

A standalone utility with three exports:
- **`getBlock(entryId, allEntries)`** -- finds the contiguous chain of scheduled entries around the given entry (2-minute gap tolerance). Returns `{ entries, transports, events }`.
- **`blockHasLockedEntry(block)`** -- checks if any entry in the block is locked.
- **`getEntriesAfterInBlock(entryId, block)`** -- returns all entries after the given one within the block.

### 2. `ContinuousTimeline.tsx` -- Add `onChainShift` prop and resize-bottom logic

- Add new prop: `onChainShift?: (resizedEntryId: string, entryIdsToShift: string[], deltaMs: number) => void`
- In `handleDragCommit`, in the resize path (line 328, the `else` branch), before calling `onEntryTimeChange`:
  - If `dragType === 'resize-bottom'`, call `getBlock(entryId, allEntries)` and `getEntriesAfterInBlock(entryId, block)`
  - If entries exist after, compute `deltaMs` (new end time minus original end time)
  - Check if any entry after in the block is locked -- if so, show toast "Can't resize -- [name] is locked" and return (block the resize entirely)
  - Otherwise call `onChainShift(entryId, afterEntryIds, deltaMs)` then proceed with the normal resize commit
- Top-edge resize (`resize-top`) is unaffected

### 3. `Timeline.tsx` -- Implement `handleChainShift`

- New callback that receives `(resizedEntryId, entryIdsToShift, deltaMs)`
- For each entry ID, compute new start/end by adding `deltaMs` to current times
- Batch update all entries in the database
- Register undo/redo action that stores old and new times
- Call `fetchData()` to refresh
- Pass `onChainShift={handleChainShift}` to `ContinuousTimeline`

## Behavior Summary

| Scenario | Result |
|----------|--------|
| Resize bottom of entry in a block | All subsequent entries in the block shift by the same delta |
| Resize top of any entry | No chain shift (only that entry changes) |
| Entry after in block is locked | Resize blocked with toast message |
| Entry not in a block (isolated) | Normal resize, no chain shift |
| Undo (Ctrl+Z) | Reverts chain shift for all affected entries |

## Technical Details

- The `getBlock` function uses a 2-minute gap tolerance (`GAP_TOLERANCE_MS = 120000`) to account for rounding in transport durations
- Only scheduled entries (`is_scheduled !== false`) are considered for block membership
- The lock check only looks at entries *after* the resized entry in the block, not the resized entry itself
- `deltaMs` can be negative (shrinking the entry pulls the chain up)

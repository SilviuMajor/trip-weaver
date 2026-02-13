
# Fix Magnet Snap Case A: Close Gaps by Moving Transport + Next Event

## Problem
When transport already exists between two cards, tapping magnet only moves the next event to the transport's end -- but the transport itself stays put, leaving a gap between the current card and the transport.

## Change

**File: `src/pages/Timeline.tsx`, lines 482-501**

Replace the current Case A block with logic that:
1. Preserves the transport's duration
2. Moves the transport to start at the current entry's end time
3. Moves the next event to start at the transport's new end time
4. Updates undo/redo to restore both the transport and the next event to their original positions

```text
Before:
  - Only updates nextEvent start/end to transport's existing end
  - Transport stays in place -> gap remains

After:
  - Save transport's original start/end for undo
  - Compute new transport start = entry.end_time
  - Compute new transport end = entry.end_time + original transport duration
  - Compute new next event start = new transport end
  - Compute new next event end = new transport end + next event duration
  - Update both entries in DB
  - Undo restores both to original positions
```

## What Does NOT Change
- Case B/C logic (no transport exists)
- Magnet icon rendering
- Any other timeline functionality

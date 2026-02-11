

# Fix SNAP: Auto-snap on Transport Generation & SNAP Button Visibility

## Issue A: Auto-snap destination on transport generation and mode switch

### Root Cause
The `handleGenerateTransportDirect` function (lines 430-523 in Timeline.tsx) creates the transport entry but never pulls the destination event forward to meet the transport's end time. The mode switch handler (`handleModeSwitchConfirm`, lines 598-636) already correctly snaps the destination (lines 622-633), so that part is working.

### Fix
**File: `src/pages/Timeline.tsx`** -- In `handleGenerateTransportDirect`, after inserting the transport entry and option (line 504), add logic to snap the destination event:

1. Fetch the destination entry (`toEntryId`) from the database
2. If it is not locked, update its `start_time` to `endTime` (transport's end) and `end_time` to preserve its original duration
3. This goes before the `pushAction` and `fetchData` calls

The undo action should also restore the destination event's original times.

## Issue B: SNAP button not appearing

### Root Cause
The SNAP button logic at line 988 finds the "next visible" entry by scanning `sortedEntries` forward from the transport's position and skipping linked flight entries. The problem is this generic search may pick up the wrong entry -- it should specifically find the entry that the transport's `to_entry_id` points to. Additionally, if the transport and its destination event are not adjacent in `sortedEntries` (e.g., another event was inserted between them), the gap calculation would be wrong.

### Fix
**File: `src/components/timeline/CalendarDay.tsx`** -- Replace the `nextVisible` lookup (lines 988-992) with:

```
const nextVisible = entry.to_entry_id
  ? sortedEntries.find(e => e.id === entry.to_entry_id)
  : null;
```

This directly uses the transport's `to_entry_id` foreign key to find the correct destination event, rather than scanning positionally. This ensures:
- The gap is calculated between the correct pair of entries
- The SNAP button appears regardless of what other entries exist between them in the sorted list
- Locked events still show the button (with warning toast on click) -- this logic is already correct at line 1001

## Files Changed

| File | Changes |
|------|---------|
| `src/pages/Timeline.tsx` | Add destination-event snap after transport creation in `handleGenerateTransportDirect`; include destination time restore in undo action |
| `src/components/timeline/CalendarDay.tsx` | Fix SNAP button: use `entry.to_entry_id` to find destination entry instead of positional scan |

## What Is NOT Changed
- `handleModeSwitchConfirm` -- already snaps correctly (lines 622-633)
- SNAP button click handler -- already works correctly with recalculation
- Drag behavior -- correctly leaves gaps (no auto-pull)
- Transport connector inline editing
- "Add Something" modal behavior


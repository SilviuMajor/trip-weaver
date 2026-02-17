

# Smart Drop (Push on Release)

## Overview
When releasing a dragged card on top of another card, intelligently push the overlapped card down to make room instead of leaving a conflict marker. Only pushes one level deep -- if the push itself would cause further overlaps, the existing conflict marker behavior handles it.

## Changes

### File: `src/pages/Timeline.tsx` -- Add overlap detection and push logic to `handleEntryTimeChange`

**Location: After the existing `await fetchData()` call at line 1541, before the auto-extend trip check at line 1544.**

Insert overlap detection and push logic:

1. Compute `newStartMs` and `newEndMs` from `newStartIso` and `newEndIso`
2. Find the first overlapped scheduled entry (excluding the dragged entry itself and transport/transfer entries)
3. If overlapped entry exists and is **not locked**:
   - Calculate pushed position: start at `newEndMs`, preserve the overlapped entry's duration
   - Check if the push would collide with a locked card
   - Check if the push would overlap any other card (no cascading)
   - If both checks pass:
     - Update the overlapped entry's times in the database
     - Show a success toast: "Pushed [name] to make room"
     - Register an undo action for the push (storing old start/end of the overlapped entry)
     - Call `handleSnapRelease(entryId, overlapped.id, 'below')` to create a transport between the dragged and pushed card
   - If checks fail: do nothing extra, existing conflict markers handle it
4. If overlapped entry is **locked**: show an info toast "Overlaps [name] -- Unlock it to rearrange"

**Important**: Use `scheduledEntries` (the memo that filters `is_scheduled !== false`) for overlap detection, not raw `entries`. Skip entries with `category === 'transfer'` to avoid triggering push on transport nodes.

**Undo considerations**: The main move is already registered as an undo action (lines 1488-1496). The push gets a separate undo action so Ctrl+Z first undoes the push, then a second Ctrl+Z undoes the move. This provides granular undo control.

## Behavior Summary

| Scenario | Result |
|----------|--------|
| Drop on unlocked card, push fits | Overlapped card pushed down, transport created |
| Drop on locked card | Toast "Overlaps [name] -- Unlock it to rearrange", conflict marker |
| Push would hit another card | No push, conflict marker from existing logic |
| Push would hit a locked card | No push, conflict marker from existing logic |
| Ctrl+Z after smart drop | First undo: reverts push. Second undo: reverts move |

## Technical Details

- Overlap check uses `scheduledEntries` which excludes unscheduled entries
- Transport/transfer entries are excluded from overlap targets (they have their own repositioning logic at lines 1508-1536)
- The push is one-level only: if pushing card B would overlap card C, we abort the push entirely
- `handleSnapRelease` is reused to create the transport, matching existing snap behavior
- The `fetchData()` call at line 1541 has already refreshed state, so the overlap check uses the latest `scheduledEntries` via closure. However, since React state updates are async, we use `newStartMs`/`newEndMs` from the function params (which are the committed values) rather than re-reading from state.

## Files Modified
- `src/pages/Timeline.tsx` -- overlap detection + push logic in `handleEntryTimeChange`
- No other files changed


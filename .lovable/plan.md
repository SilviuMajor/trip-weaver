

# Magnet Snap Feature

## Overview

Replace the existing SNAP pill (shown below transport cards in gaps) with a magnet icon on every non-transport, non-flight entry card. Tapping the magnet calculates transport to the next event and snaps it into place. Also add a post-drop toast prompt when events are placed near each other.

## Part 1: Remove old SNAP pill from ContinuousTimeline.tsx

**Lines 1043-1153**: The "Tiered SNAP system below transport cards" block. Remove the SNAP button and `handleSnapNext` function. Keep only the "+ Add something" button.

The block currently renders two buttons (SNAP + Add something) with positioning logic. After the change, only the "+ Add something" button remains, with simplified positioning (centered in the gap).

## Part 2: Magnet icon on EntryCard.tsx

**New props** added to `EntryCardProps`:
- `onMagnetSnap?: (entryId: string) => Promise<void>`
- `nextEntryLocked?: boolean`
- `hasNextEntry?: boolean`
- `magnetLoading?: boolean`

**Icon**: Use `Magnet` from `lucide-react` (confirmed available).

**Rendering**: Add an absolutely positioned magnet button at `bottom-1.5 right-1.5` on all card layouts. Only shown when:
- `hasNextEntry` is true
- category is not `transfer`, `flight`, or `airport_processing`

Styling:
- Green background when clickable (`bg-green-100 text-green-600`)
- Muted when next entry is locked (`bg-muted text-muted-foreground/40 cursor-not-allowed`)
- Loading spinner (`Loader2 animate-spin`) when `magnetLoading` is true
- `e.stopPropagation()` + `e.preventDefault()` on click and touch to prevent card drag interference

When tapped on a locked-next-entry, shows a toast: "Next event is locked / Unlock it before snapping".

## Part 3: Magnet logic in Timeline.tsx

New `handleMagnetSnap` function implementing three cases:

1. **Transport exists in gap**: Snap next event's start to transport's end (preserve duration)
2. **No transport, addresses available**: Call `google-directions` edge function with `mode: 'walk'`, create a transport entry + option, then snap the next event
3. **No transport, no addresses**: Snap next event directly to current entry's end

All cases:
- Check next event isn't locked
- Push undo action before modifying
- Call `fetchData()` after completion
- Show success/error toast

**Undo support**: Before snapping, capture old start/end times of the next event (and transport if created) for the undo stack.

**Passing down**: `Timeline.tsx` passes `handleMagnetSnap` to `ContinuousTimeline` via new `onMagnetSnap` prop. `ContinuousTimeline` passes it to each `EntryCard` along with computed `hasNextEntry`, `nextEntryLocked`, and `magnetLoading` (tracked via `magnetLoadingId` state in ContinuousTimeline).

## Part 4: Drag-near-event toast prompt

In `handleDropOnTimeline` (Timeline.tsx, after line 1086 `await fetchData()`), check proximity to neighboring events:

```text
After drop completes and fetchData returns:
- Find prev/next non-transport entries relative to the dropped entry
- If gap to prev or next is 0-20 minutes, show a toast:
  "Generate transport & snap?" with a "Yes" action button
  that calls handleMagnetSnap(droppedEntryId)
  Duration: 5000ms
```

Also applies to `handleEntryTimeChange` (drag-move commit) -- after the entry is repositioned, do the same proximity check.

## Files Modified

| File | Changes |
|------|---------|
| `src/components/timeline/ContinuousTimeline.tsx` | Remove SNAP pill + handleSnapNext; add `onMagnetSnap` prop; pass magnet props to EntryCard; add `magnetLoadingId` state |
| `src/components/timeline/EntryCard.tsx` | Add 4 new props; render magnet icon on all card layouts |
| `src/pages/Timeline.tsx` | Add `handleMagnetSnap` function; pass to ContinuousTimeline; add proximity toast in drop/drag handlers |

## What Does NOT Change

- "+ Add something" buttons in gaps
- Transport connector rendering
- Flight cards, hotel wizard, Planner sidebar
- Entry card drag/resize behavior
- Weather system

## Technical Details

```text
ContinuousTimeline state:
  magnetLoadingId: string | null

Per EntryCard, computed from sortedEntries:
  hasNextEntry = next non-transport entry exists after this one
  nextEntryLocked = that next entry's is_locked flag

handleMagnetSnap flow:
  1. Find entry by ID
  2. Find next non-transport/non-airport-processing entry (skip transport entries)
  3. Check locked status
  4. Look for existing transport between them
  5a. If transport: snap next to transport.end_time
  5b. If no transport + addresses: invoke google-directions, create transport entry+option, snap
  5c. If no transport + no addresses: snap next to entry.end_time
  6. Push undo, update DB, fetchData, toast
```



# Live Duration Pill Update During Resize

## Overview
The duration pill inside EntryCard (e.g. "1h 30m") stays frozen during resize because it's computed from DB props. This adds an override prop so the pill updates live as the user drags.

## Changes

### 1. `src/components/timeline/EntryCard.tsx`

**a) Add prop** (line 57-58, after `height?: number;`):
- Add `overrideDurationHours?: number | null;` to the interface

**b) Use override in duration computation** (line 147):
- Replace `const durationLabel = formatDuration(startTime, endTime);` with logic that checks `overrideDurationHours != null` first, computing hours/minutes from the override value, falling back to the existing `formatDuration` call

### 2. `src/components/timeline/ContinuousTimeline.tsx`

**Add override prop to main EntryCard render** (after line 1687, `endTime={entry.end_time}`):
- Pass `overrideDurationHours={isResizing && dragState ? dragState.currentEndHour - dragState.currentStartHour : null}`
- `isResizing` is already computed at line 1465 and `dragState` contains `currentStartHour`/`currentEndHour` which update live during drag
- Only the actively resized card gets the override; all other cards pass `null`

## Technical Details

The override computation:
```text
overrideDurationHours = dragState.currentEndHour - dragState.currentStartHour
```
This is converted to a label using the same h/m format as `formatDuration`.

Only the main timeline EntryCard (line ~1685) gets this prop. The planner/explore card instances (lines ~2079, ~2156, ~2178) are not resizable and are left unchanged.

## Files modified
| File | Change |
|------|--------|
| `src/components/timeline/EntryCard.tsx` | Add `overrideDurationHours` prop, use it in `durationLabel` |
| `src/components/timeline/ContinuousTimeline.tsx` | Pass `overrideDurationHours` from `dragState` during resize |

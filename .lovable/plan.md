

# Snap Zone During Drag + Auto-Place with Transport

## Overview
The existing codebase already has snap zone detection during drag (useMemo in ContinuousTimeline), green ghost rendering with "Snap" label, and auto-transport creation via `handleSnapRelease`. This plan adds the missing piece: **auto-creating transport when dropping cards from the Planner/Explore panels** onto the timeline near existing cards.

## What Already Exists (No Changes Needed)
- Snap detection during drag (ContinuousTimeline.tsx `snapTarget` useMemo, lines 632-696)
- Green ghost outline with "Snap" label (lines 1822-1858)
- Green connector line between snap target and ghost (lines 1826-1844)
- `handleSnapRelease` in Timeline.tsx (lines 707-805) that auto-creates transport entries
- Snap release is already called from `handleDragCommit` (lines 312-332)

## Changes Needed

### 1. Timeline.tsx -- Auto-create transport on panel drops (`handleDropOnTimeline`)

After the existing placement logic in `handleDropOnTimeline` (after `fetchData()` at line 1481), add auto-transport creation for nearby adjacent cards:

- After fetching fresh data, find the placed entry's neighbors among scheduled non-transport entries
- If the gap to the previous card is 0-30 minutes, call `handleSnapRelease(placedEntryId, prevEntry.id, 'below')`
- If the gap to the next card is 0-30 minutes, call `handleSnapRelease(nextEntry.id, placedEntryId, 'below')` (note: this reuses the existing handler which already creates transport, shifts the "to" entry, and supports undo)

This replaces the travel conflict analysis that currently runs (lines 1495-1528) with direct transport creation when cards are close enough. When cards are far apart (>30min gap), keep the existing conflict analysis.

### 2. Timeline.tsx -- Auto-create transport on Explore card drops (`handleDropExploreCard`)

Apply the same 0-30 minute proximity check after placing an explore card on the timeline, calling `handleSnapRelease` for nearby neighbors.

### 3. ContinuousTimeline.tsx -- Update snap label to show destination name

Currently the snap label says "Snap" (line 1856). Update to show "Snap after [name]" or "Snap before [name]" depending on the `snapTarget.side`:

```
const targetName = sortedEntries.find(e => e.id === snapTarget.entryId)?.options[0]?.name;
const shortName = targetName?.split(',')[0]?.trim() || 'event';
const label = snapTarget.side === 'below' ? `after ${shortName}` : `before ${shortName}`;
```

## Technical Details

**Why not move snap detection into useDragResize?** The current architecture computes snap targets in a `useMemo` in ContinuousTimeline, which has access to `sortedEntries` and `getEntryGlobalHours`. Moving this into the hook would require passing entry data as a parameter and duplicating entry-awareness in a lower-level hook. The current approach is cleaner -- the hook handles pixel-level drag mechanics, and the component handles entry-level logic.

**Transport creation reuse:** `handleSnapRelease` already handles the full flow: Google Directions API call, transport entry creation, shifting the "to" entry, undo/redo support, and toast notifications. Reusing it for panel drops avoids code duplication.

**Gap threshold:** 30 minutes chosen as the boundary -- close enough that transport is relevant, far enough that it does not trigger for intentional gaps (e.g., lunch break between morning and afternoon activities).

## Files Modified
- `src/pages/Timeline.tsx` -- add auto-transport logic to `handleDropOnTimeline` and `handleDropExploreCard`
- `src/components/timeline/ContinuousTimeline.tsx` -- update snap label text to include destination name




# Add Dashed Line and Dual Buttons to Transport Gap Section

## Problem
The "+ Add something" button below transport cards (lines 1546-1583) is missing the dashed centre line that appears in the main gap section, and does not use the dual-button logic for gaps exceeding 6 hours.

## Changes (single file: `src/components/timeline/ContinuousTimeline.tsx`)

### Replace the transport gap block (lines 1546-1583)

Replace the entire `isTransport && (() => { ... })()` block with updated logic that:

1. Keeps the same next-visible-entry lookup (unchanged).
2. Switches from millisecond-based gap detection to global-hour-based (`gapGH`, `gapMin`), with a 5-minute minimum threshold.
3. Computes `relGapTop` as `gapTopPx - (entryStartGH * pixelsPerHour)` to position elements relative to the transport card wrapper (since the wrapper div starts at `entryStartGH * pixelsPerHour`).
4. Adds a dashed centre line (`border-l-2 border-dashed border-primary/20`) spanning the full gap height.
5. Uses a three-way conditional for buttons:
   - **Large gaps (> 6 hours)**: Two "+ Add something" buttons, top at `relGapTop + pixelsPerHour - 12`, bottom at `relGapTop + gapPixelHeight - pixelsPerHour - 12`, with prefill times offset by 1 hour from neighboring events using `addMinutes`.
   - **Normal gaps**: Single centered button at `relGapTop + (gapPixelHeight - 22) / 2`.

### Variables in scope
- `entryStartGH` -- defined at line 1029, available throughout the entry rendering block.
- `height` -- the card's pixel height, defined at line 1063.
- `pixelsPerHour`, `sortedEntries`, `onAddBetween`, `getEntryGlobalHours`, `isTransportEntry`, `addMinutes` -- all available in the component scope.

### What does not change
- The main gap button section (visibleEntries loop with its own dashed lines and dual buttons)
- Transport connector rendering
- Gap detection logic in the main section
- Any other timeline rendering

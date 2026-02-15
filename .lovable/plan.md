
# Dual "Add Something" Buttons for Large Gaps

## Problem
Large gaps (e.g., hotel overnights) show a single centered button that sits in a huge empty space, hard to reach on mobile.

## Solution
When a gap exceeds 6 hours (360 minutes), render two buttons -- one near the top and one near the bottom of the gap. Gaps of 6 hours or less keep the existing single centered button. Transport gaps are unchanged.

## Technical Changes (single file: `src/components/timeline/ContinuousTimeline.tsx`)

### Replace gap button rendering (lines 956-978)

The current code uses a single `<button>` with conditional content (transport vs. add). Replace with a three-way conditional:

1. **Transport gaps** (`isTransportGap`, i.e. < 2 hours): Single centered transport button -- same as today.
2. **Large gaps** (`gapMin > 360`, i.e. > 6 hours): Two "Add something" buttons:
   - **Top button** at `gapTopPx + 1 * pixelsPerHour - 12` (1 hour below upper event end), prefill time = 1 hour after upper event ends (`addMinutes(entry.end_time, 60)`)
   - **Bottom button** at `gapBottomPx - 1 * pixelsPerHour - 12` (1 hour above lower event start), prefill time = 1 hour before lower event starts (`addMinutes(nextEntry.start_time, -60)`)
3. **Normal gaps** (everything else): Single centered button -- same as today.

`addMinutes` is already imported from `date-fns`. The dashed center line, gap detection logic, and all other rendering remain untouched.

### What does not change
- Transport gap button logic
- The dashed centre line
- Gap detection (5-min minimum, `hasTransferBetween` check)
- Transport connector "Add something" buttons (~line 1489)
- Any other timeline rendering

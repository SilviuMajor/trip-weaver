

# Three Fixes: Uber Layout, Event Uber Button, Contingency Display

## Fix 1 -- Uber Button Layout in RouteMapPreview.tsx

**Lines 102-123**: Move the Uber button out of the flex row with Apple Maps / Google Maps into its own full-width row below, styled with Uber brand colours.

- Apple Maps + Google Maps stay side by side in `flex gap-2`
- Uber button moves below as a separate `w-full` button with `bg-black text-white hover:bg-black/90`
- Label changes from "Uber" to "Book with Uber"

## Fix 2 -- Add Uber Button to Regular Event Overviews (EntrySheet.tsx)

**Line 20**: Add `Car` to the lucide-react import.

**After line 1613** (after the Google Maps link `</div>`): Insert a new Uber button block for non-transfer, non-flight entries when `option.latitude` and `option.longitude` exist.

- Full-width black button with "Book Uber to here" label
- Deep link uses event lat/lng as dropoff, `my_location` as pickup
- `onClick` uses `stopPropagation` to prevent sheet interactions

## Fix 3 -- Contingency Display Calculation (EntrySheet.tsx)

**Lines 1374-1377**: Replace the broken modulo-based contingency formula with correct logic:

```
const selectedModeData = viewResults.find(r => r.mode === viewSelectedMode)
  || ((option).transport_modes || []).find(m => m.mode === viewSelectedMode);
const rawDuration = selectedModeData?.duration_min ?? totalMin;
const blockDur = Math.ceil(rawDuration / 5) * 5;
const contingency = blockDur - rawDuration;
```

**Lines 1407-1409**: Change display from `+{contingency}m contingency` to `⏱ {rawDuration}m + {contingency}m buffer = {blockDur}m` (only shown when contingency > 0).

## Files Modified

| File | Changes |
|------|---------|
| `src/components/timeline/RouteMapPreview.tsx` | Move Uber button to separate full-width row with black styling |
| `src/components/timeline/EntrySheet.tsx` | Add `Car` import; add Uber button for regular events; fix contingency calculation and display |

## What Does NOT Change

- Transport card visuals on timeline
- Transport end_time calculation (already correct)
- Mode switching, undo, SNAP, drag chain
- Map preview component

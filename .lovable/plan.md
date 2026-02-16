

# Fix: Explore Suggestions Not Loading

## Root Cause

A race condition between three `useEffect` hooks in `ExploreView.tsx`:

When `open` becomes `true`, React runs effects in declaration order. Effect #1 (line 227, "Resolve origin") calls `setOriginResolved(true)`. Then Effect #2 (line 252, "Auto-focus/reset") calls `setOriginResolved(false)`. React batches these -- the final value is `false`. Effect #3 (line 270, "Auto-load nearby search") sees `originResolved === false` and never fires. Since no deps change after that, the nearby search is permanently blocked.

## Fix

**File: `src/components/timeline/ExploreView.tsx`**, line 260

Remove `setOriginResolved(false);` from the reset effect (line 260). The resolve-origin effect (line 227) already re-runs when `open` changes and correctly sets `originResolved` to `true`. Resetting it in a separate effect creates the race.

The `initialLoadDone.current = false` reset on line 259 is sufficient to allow the nearby search to re-fire on subsequent opens.

| File | Change |
|------|--------|
| `src/components/timeline/ExploreView.tsx` | Remove line 260: `setOriginResolved(false);` |


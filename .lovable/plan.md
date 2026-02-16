
# Add Travel Time + Mode Pills to ExploreView

## Overview
Add travel mode selection pills below the origin context line in ExploreView, fetch travel times from the google-directions edge function in batches of 5, pass formatted times to ExploreCard, sort results by proximity, and add a loading shimmer placeholder in ExploreCard.

## Changes

### 1. `src/components/timeline/ExploreView.tsx`

**New imports**: `TRAVEL_MODES` from `@/lib/categories`

**New state**:
- `travelMode: string` (default `'walk'`)
- `travelTimes: Map<string, number>` (placeId -> minutes)
- `fetchAbortRef: useRef<number>` for cancelling stale fetches

**Travel mode pills**: Rendered below the origin context line as a horizontal row of `rounded-full` pill buttons using `TRAVEL_MODES`. Selected pill gets `bg-primary/10 text-primary border-primary/20`; unselected gets `text-muted-foreground hover:bg-muted`. Short labels: "Walk", "Transit", "Drive", "Cycle".

**Batch travel time fetching**: A `fetchTravelTimes` function that:
- Takes results array, origin coords, mode
- Processes in batches of 5 with 200ms delay between batches
- Updates `travelTimes` state progressively after each batch
- Uses `fetchAbortRef` to cancel if mode changes mid-fetch

**Trigger fetch** via `useEffect` when `results`, `travelMode`, or `originLocation` change. Clears times immediately on mode change.

**Sort results**: `sortedResults` memo that sorts by travel time (closest first) when times are available; renders `sortedResults` instead of `results`.

**Pass travel time to ExploreCard**:
```
const minutes = travelTimes.get(place.placeId);
const modeEmoji = TRAVEL_MODES.find(m => m.id === travelMode)?.emoji ?? '';
const travelTimeStr = minutes != null ? `${modeEmoji} ${minutes}m` : undefined;
```
Also pass a new `travelTimeLoading` prop (true when origin exists and times map doesn't have this place yet and results are loaded).

### 2. `src/components/timeline/ExploreCard.tsx`

**New prop**: `travelTimeLoading?: boolean`

**Shimmer placeholder**: When `travelTimeLoading` is true and `travelTime` is null, render a `w-10 h-5 rounded-full animate-pulse` element in the top-right position using the same `durPillStyle` background but at lower opacity.

No other changes to ExploreCard -- photo loading, tap, add, styling all unchanged.

## Technical Details

### Abort pattern for rapid mode switching
```typescript
const fetchAbortRef = useRef(0);

useEffect(() => {
  if (!originLocation || results.length === 0) return;
  setTravelTimes(new Map());
  const generation = ++fetchAbortRef.current;
  
  fetchTravelTimes(results, originLocation, travelMode, generation);
}, [results, travelMode, originLocation]);
```
Inside `fetchTravelTimes`, check `fetchAbortRef.current !== generation` before each batch to abort stale fetches.

### Batch fetch implementation
```
for i in 0..results.length step 5:
  batch = results[i:i+5]
  await Promise.all(batch.map(fetchSingleDirection))
  update state with new Map(times)
  if not last batch: await sleep(200ms)
  if aborted: return
```

### Mode pill short labels
Map TRAVEL_MODES labels to shorter versions: "Walk", "Transit", "Drive", "Cycle" (Transit instead of "Public Transport").

## Files Summary
| File | Action |
|------|--------|
| `src/components/timeline/ExploreView.tsx` | Modify (add mode pills, travel time fetching, sorting) |
| `src/components/timeline/ExploreCard.tsx` | Modify (add shimmer loading placeholder) |

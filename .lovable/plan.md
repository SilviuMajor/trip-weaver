

# Auto-Generate Transport + Smart Schedule Adjustment

## What This Does

The Route button in the header will be transformed into an "Auto-Schedule Transport" feature that:

1. Analyzes all scheduled events for each day
2. Generates transport entries between consecutive events that don't already have transport
3. Detects short walks (below a configurable threshold) and auto-assigns "Walk" mode
4. When transport causes overlap, uses AI to analyze the full day context (locked events, overnight stays, etc.) and automatically applies the best resolution strategy
5. Respects locked events -- never moves them

## New Trip Setting: "Auto-walk threshold"

Add a `walk_threshold_min` column to the `trips` table (default: 10). In TripSettings, add a slider/input: "Auto-walk for distances under X minutes". When the google-directions API returns a walking duration below this threshold, the transport entry is auto-created as a "Walk" instead of prompting for mode selection.

---

## Architecture

The feature will be implemented as a new edge function `auto-generate-transport` that handles the heavy lifting server-side. This keeps the client simple (one button click) and allows sequential API calls without timeout issues.

```text
[User clicks Route button]
        |
        v
[Edge function: auto-generate-transport]
        |
        +-- 1. Fetch all scheduled entries for trip (sorted by start_time)
        +-- 2. Group entries by day
        +-- 3. For each day, find consecutive pairs without existing transport between them
        +-- 4. For each pair:
        |       +-- Skip if same entry (linked checkin/checkout/flight groups)
        |       +-- Fetch google-directions (all modes: walk, transit, drive, bicycle)
        |       +-- If walk duration <= walk_threshold_min: auto-select walk
        |       +-- Else: select transit (fastest non-walk)
        |       +-- Create entry + entry_option with category='transfer'
        |       +-- Set start_time = previous entry's end_time
        |       +-- Set end_time = start_time + ceil(duration/5)*5 minutes
        |
        +-- 5. Return list of created transport entries + overlap report
        |
        v
[Client receives response]
        |
        +-- 6. For each day with overlaps:
        |       +-- Build day context string (all entries with times, locked status)
        |       +-- Call AI (Gemini Flash) to get resolution strategy
        |       +-- AI returns one of:
        |           - "push_all": shift all unlocked events after the overlap forward
        |           - "compress_overnight": if overlap is with an overnight entry (hotel), compress it from the start
        |           - "skip": no resolution possible (all events locked)
        |       +-- Auto-apply the chosen strategy
        |
        +-- 7. Show summary toast: "Added X transport entries, adjusted Y events"
        +-- 8. Refresh data
```

---

## Detailed Changes

### 1. Database Migration

Add `walk_threshold_min` column to `trips`:

```sql
ALTER TABLE public.trips 
  ADD COLUMN walk_threshold_min integer NOT NULL DEFAULT 10;
```

### 2. New Edge Function: `auto-generate-transport`

**Input**: `{ tripId: string }`

**Logic**:

```
1. Fetch trip (get walk_threshold_min, timezone)
2. Fetch all scheduled entries with their options, sorted by start_time
3. Group by day (using trip timezone)
4. For each day:
   a. Get sorted entries for that day
   b. Skip linked entries (checkin/checkout) -- they're part of flight groups
   c. For each consecutive pair (entryA, entryB):
      - Check if transport already exists between them (entry with category='transfer' 
        whose start_time is between entryA.end_time and entryB.start_time)
      - Get coordinates/addresses from both entries
      - If no coords/address available, skip
      - Call google-directions with all 4 modes
      - Determine mode: if walk duration <= walk_threshold_min, use walk; else use fastest
      - Create entry record:
        start_time = entryA.end_time
        end_time = start_time + ceil(selected_duration/5)*5 minutes
        is_scheduled = true
        trip_id = tripId
      - Create entry_option record:
        name = "{Mode} to {destination_short}"
        category = 'transfer'
        category_color = '#f97316' (orange)
        departure_location = entryA location
        arrival_location = entryB location
        distance_km, route_polyline from API
5. Detect overlaps: for each created transport, check if its end_time > next entry's start_time
6. Return { created: [...], overlaps: [...] }
```

### 3. Client-Side Overlap Resolution (Timeline.tsx)

After the edge function returns, for each day with overlaps:

1. Build a structured description of the day's schedule
2. Call an AI model (Gemini 2.5 Flash via `ai-resolve-schedule` edge function) with this prompt:

```
You are a travel schedule optimizer. Given this day's schedule, 
determine the best way to resolve overlaps caused by transport entries.

Rules:
- Never move locked events
- If an overnight entry (hotel/accommodation) overlaps, compress it from the start
- If all events after the overlap are unlocked, push them forward
- Preserve event durations when pushing
- If an event would be pushed past midnight, compress it instead

Return a JSON array of time adjustments.
```

3. Apply the returned adjustments via batch entry updates

**However**, to keep this simpler and avoid AI latency/cost for v1, I recommend a deterministic algorithm instead:

**Deterministic push algorithm** (no AI needed):

```typescript
for each day with overlaps:
  sort all entries by start_time
  for i = 0 to entries.length - 2:
    currentEnd = entries[i].end_time
    nextStart = entries[i+1].start_time
    if currentEnd > nextStart AND !entries[i+1].is_locked:
      overlap = currentEnd - nextStart
      // Check if next entry looks like overnight (hotel, > 6 hours)
      if next entry duration > 6 hours:
        // Compress from start: move start_time forward, keep end_time
        entries[i+1].start_time = currentEnd
      else:
        // Push: shift start and end by overlap amount
        entries[i+1].start_time += overlap
        entries[i+1].end_time += overlap
    else if entries[i+1].is_locked:
      // Can't move locked entry -- skip, leave overlap marker
      continue
```

This cascades naturally: pushing entry B may cause it to overlap with entry C, which the next iteration handles.

### 4. Trip Settings UI (TripSettings.tsx)

Add a new section "Transport Settings" with:
- Label: "Auto-walk threshold"
- Description: "Distances shorter than this will automatically use walking mode"
- Input: number input with "minutes" suffix, bound to `walk_threshold_min`
- Default: 10

### 5. Update TimelineHeader.tsx

- Change the Route button handler from calling `google-directions` with `{ tripId }` to calling `auto-generate-transport`
- After receiving the response, run the deterministic push algorithm client-side
- Show a progress toast during generation
- Show summary toast on completion

### 6. Clean up old travel_segments usage

The current button writes to `travel_segments` table (a separate table for metadata only). The new system creates actual `entries` with `category='transfer'`, which is what the timeline renders. The old `travel_segments` approach can be deprecated -- the button will no longer write there.

---

## File Summary

| File | Changes |
|------|---------|
| `supabase/functions/auto-generate-transport/index.ts` | **New** -- edge function that generates transport entries between consecutive events |
| `src/pages/Timeline.tsx` | New `handleAutoGenerateTransport` function with deterministic push algorithm |
| `src/components/timeline/TimelineHeader.tsx` | Wire Route button to new handler, add loading state |
| `src/pages/TripSettings.tsx` | Add "Auto-walk threshold" setting |
| DB migration | Add `walk_threshold_min` column to `trips` table |

---

## Technical Details

### Edge function: auto-generate-transport

```typescript
// Key logic for determining if transport already exists
function hasTransportBetween(entries, entryA, entryB) {
  return entries.some(e => {
    const opt = options.find(o => o.entry_id === e.id);
    return opt?.category === 'transfer' 
      && new Date(e.start_time) >= new Date(entryA.end_time)
      && new Date(e.end_time) <= new Date(entryB.start_time);
  });
}

// Key logic for skipping flight group entries
function isFlightGroupEntry(entry) {
  return entry.linked_type === 'checkin' || entry.linked_type === 'checkout';
}
```

### Deterministic push algorithm (client-side)

```typescript
const handleAutoGenerate = async () => {
  setTravelLoading(true);
  try {
    // 1. Call edge function to create transport entries
    const { data, error } = await supabase.functions.invoke('auto-generate-transport', {
      body: { tripId },
    });
    if (error) throw error;

    // 2. Refresh data to get new entries
    await onDataRefresh();

    // 3. Run push algorithm on each day
    const updatedEntries = [...allScheduledEntries, ...data.created];
    // Group by day, sort, detect overlaps, push unlocked entries
    
    // 4. Batch update all shifted entries
    for (const change of changes) {
      await supabase.from('entries')
        .update({ start_time: change.newStart, end_time: change.newEnd })
        .eq('id', change.id);
    }

    toast({ title: `Added ${data.created.length} transport entries` });
    await onDataRefresh();
  } catch (err) {
    toast({ title: 'Failed', description: err.message, variant: 'destructive' });
  } finally {
    setTravelLoading(false);
  }
};
```

### Walk threshold in TripSettings

```tsx
<div className="space-y-2">
  <Label>Auto-walk threshold (minutes)</Label>
  <p className="text-xs text-muted-foreground">
    Distances under this walking time will automatically use walking mode
  </p>
  <Input
    type="number"
    min={1}
    max={60}
    value={walkThreshold}
    onChange={e => setWalkThreshold(Number(e.target.value))}
  />
</div>
```


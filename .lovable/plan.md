
# Transport Card Fixes: Map in Creation, Mode Switcher in View, Snap, No Votes for Transport/Flights

## Overview

Four changes:

1. **Fix map not showing in transport creation dialog** -- the map only renders when `transportContext` exists AND `selectedPolyline` is set. The polyline comes from the API response but may not always be present. We need to verify the polyline is being stored from the API and add a fallback display when no polyline exists.

2. **Add mode switcher + refresh to transport view overlay** -- when clicking an existing transport card, the view overlay should show all travel modes with updated times (similar to the refresh popover on the card), allowing the user to switch modes and auto-resize.

3. **SNAP button** -- when there's a gap between a transport card's end and the next event's start (and the next event is not locked), show a "SNAP" button below the transport card that moves the next event's start time to immediately follow the transport.

4. **Hide VoteButton for transport and flights** -- remove the thumbs-up vote from transport (`transfer`) and flight (`flight`) categories in both EntryCard and EntrySheet view mode.

---

## 1. Fix Map in Transport Creation

**Problem**: The route map preview in the creation dialog (line 1327 of EntrySheet.tsx) requires `selectedPolyline` to be truthy. The `selectedPolyline` is set from `fastest.polyline` in `fetchAllRoutes`, but the Google Directions edge function may not always return a polyline.

**Fix**: 
- Check the edge function response to confirm polylines are included
- If no polyline is available, still show a static "directions link" fallback (Google Maps link button) instead of the full RouteMapPreview
- Also ensure `selectedPolyline` updates correctly when switching modes via `handleSelectTransportMode`

**File**: `src/components/timeline/EntrySheet.tsx` (lines 1326-1335)

Replace the condition to also show a fallback when polyline is missing but from/to addresses exist:
```
{isTransfer && transportContext && (
  selectedPolyline ? (
    <RouteMapPreview ... />
  ) : transferFrom && transferTo && !transportLoading && transportResults.length > 0 ? (
    // Fallback: show Google Maps directions link
    <div className="flex gap-2">
      <Button variant="outline" size="sm" className="flex-1 text-xs" asChild>
        <a href={googleMapsUrl} target="_blank">View Route on Google Maps</a>
      </Button>
    </div>
  ) : null
)}
```

---

## 2. Mode Switcher in Transport View Overlay

**Problem**: When clicking an existing transport card, the EntrySheet view mode shows static transport info but no way to switch modes or refresh travel times.

**Fix**: Add a "Refresh routes" button inside the transport view section (after the duration/distance display, around line 997). When clicked, it fetches all modes from `google-directions` using the entry's `start_time`, then displays selectable mode options. Selecting a mode auto-updates the entry's `end_time`, `distance_km`, `route_polyline`, and `name`.

**File**: `src/components/timeline/EntrySheet.tsx` (view mode, transport section ~lines 936-1023)

New state variables in the component:
- `viewRefreshing` (boolean)
- `viewRefreshResults` (TransportResult[])
- `viewSelectedMode` (string | null)
- `viewApplying` (boolean)

Add a "Refresh routes" Button that:
1. Calls `google-directions` with `fromAddress`, `toAddress`, `modes: [walk, transit, drive, bicycle]`, `departureTime: entry.start_time`
2. Shows selectable mode buttons (same style as creation dialog)
3. On selection: updates entry `end_time` (rounded to 5m), option `distance_km`, `route_polyline`, `name`
4. Calls `onSaved()` to refresh

---

## 3. SNAP Button Below Transport Cards

**Problem**: When a transport card ends before the next event starts, users want a quick way to close the gap.

**Fix**: In `CalendarDay.tsx`, after rendering a transport entry card, detect if there's a gap to the next entry. If so, render a small "SNAP" pill button below the transport card. Clicking it moves the next entry's `start_time` (and shifts `end_time` by the same delta) to start immediately after the transport ends -- but only if the next entry is NOT locked.

**File**: `src/components/timeline/CalendarDay.tsx`

Logic (inside the entry rendering loop, after the card):
```
// After transport card render (around line 762):
if (isTransfer && nextEntry && !nextEntryLocked) {
  const gapMs = new Date(nextEntry.start_time).getTime() - new Date(entry.end_time).getTime();
  if (gapMs > 0) {
    // Show SNAP button positioned just below the transport card
    <button onClick={handleSnap}>SNAP</button>
  }
}
```

The `handleSnap` function:
1. Calculates the delta between transport end and next entry start
2. Shifts the next entry's `start_time` to `entry.end_time`
3. Shifts the next entry's `end_time` by the same negative delta
4. Updates via `supabase.from('entries').update(...)`
5. Calls `onVoteChange()` to refresh data

The SNAP button should be styled as a small orange pill positioned just below the transport card, centered.

**New prop needed**: `onSnapNext?: (entryId: string, newStartIso: string) => Promise<void>` on CalendarDay -- or handle it inline with supabase calls.

---

## 4. Hide VoteButton for Transport and Flights

**Files affected**:
- `src/components/timeline/EntryCard.tsx` (line 867-876): Add condition to skip VoteButton when `option.category === 'transfer' || option.category === 'flight'`
- `src/components/timeline/EntrySheet.tsx` (lines 1065-1077): Wrap VoteButton section with a check that `option.category !== 'transfer' && option.category !== 'flight'`

---

## File Summary

| File | Changes |
|------|---------|
| `src/components/timeline/EntrySheet.tsx` | Add map fallback in creation, add mode switcher/refresh in view overlay, hide VoteButton for transfer/flight |
| `src/components/timeline/CalendarDay.tsx` | Add SNAP button below transport cards when gap exists to next unlocked entry |
| `src/components/timeline/EntryCard.tsx` | Hide VoteButton for transfer and flight categories |

No database changes. No edge function changes.

---

## Technical Details

### SNAP handler in CalendarDay.tsx

```typescript
const handleSnapNext = async (currentEntry: EntryWithOptions, nextEntry: EntryWithOptions) => {
  const transportEndMs = new Date(currentEntry.end_time).getTime();
  const nextStartMs = new Date(nextEntry.start_time).getTime();
  const nextEndMs = new Date(nextEntry.end_time).getTime();
  const duration = nextEndMs - nextStartMs;
  const newStart = new Date(transportEndMs).toISOString();
  const newEnd = new Date(transportEndMs + duration).toISOString();
  
  await supabase.from('entries')
    .update({ start_time: newStart, end_time: newEnd })
    .eq('id', nextEntry.id);
  onVoteChange(); // refresh data
  toast.success('Snapped next event into place');
};
```

### SNAP button styling

```tsx
<button
  onClick={(e) => { e.stopPropagation(); handleSnapNext(entry, nextEntry); }}
  className="absolute z-20 left-1/2 -translate-x-1/2 rounded-full bg-orange-100 dark:bg-orange-900/30 px-3 py-0.5 text-[10px] font-bold text-orange-600 dark:text-orange-300 border border-orange-200 dark:border-orange-800/40 hover:bg-orange-200 dark:hover:bg-orange-800/40 transition-colors"
  style={{ top: cardBottom + 2 }}
>
  SNAP
</button>
```

### View mode refresh (EntrySheet.tsx)

```typescript
const handleViewRefresh = async () => {
  if (!entry || !option) return;
  setViewRefreshing(true);
  const { data } = await supabase.functions.invoke('google-directions', {
    body: {
      fromAddress: option.departure_location,
      toAddress: option.arrival_location,
      modes: ['walk', 'transit', 'drive', 'bicycle'],
      departureTime: entry.start_time,
    },
  });
  setViewRefreshResults(data?.results ?? []);
  // Auto-select current mode
  const currentMode = detectMode(option.name);
  setViewSelectedMode(currentMode);
  setViewRefreshing(false);
};

const handleViewApplyMode = async (result: TransportResult) => {
  setViewApplying(true);
  const blockDur = Math.ceil(result.duration_min / 5) * 5;
  const newEnd = new Date(new Date(entry.start_time).getTime() + blockDur * 60000).toISOString();
  const modeLabels = { walk: 'Walk', transit: 'Transit', drive: 'Drive', bicycle: 'Cycle' };
  const toShort = (option.arrival_location || '').split(',')[0].trim();
  const newName = `${modeLabels[result.mode] || result.mode} to ${toShort}`;
  
  await supabase.from('entries').update({ end_time: newEnd }).eq('id', entry.id);
  await supabase.from('entry_options').update({
    distance_km: result.distance_km,
    route_polyline: result.polyline ?? null,
    name: newName,
  }).eq('id', option.id);
  
  setViewApplying(false);
  setViewRefreshResults([]);
  onSaved();
};
```

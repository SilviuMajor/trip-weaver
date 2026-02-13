
# Trip Ends Marker Fix + Trim Empty Days

## Fix 1: Ensure Trip Ends marker updates after auto-extension

The `getDays()` function in Timeline.tsx is not memoized -- it's a plain function that reads `trip` state directly. Since `autoExtendTripIfNeeded` calls `fetchData()` which calls `setTrip()`, this should cause a re-render and `getDays()` will return the updated days array. The marker logic (`dayIndex === days.length - 1`) should then naturally move.

However, `getDays()` is called at line 1493 as `const days = getDays()` on every render, reading from the `trip` state. Since `autoExtendTripIfNeeded` already calls `await fetchData()` which sets the new trip, the days array should update. No code change needed for Fix 1 -- the existing flow should work. If there's an issue, it's likely a stale closure on `trip` inside the callback. We'll address this by ensuring the `autoExtendTripIfNeeded` calls use the freshest trip data by re-fetching inside the function rather than relying on the passed `trip` argument.

**Change**: Modify `autoExtendTripIfNeeded` to re-fetch the trip from the DB before comparing, ensuring no stale state issues.

## Fix 2: Trim button on Trip Begins / Trip Ends pills

### ContinuousTimeline.tsx changes

1. Add new props:
   - `onTrimDay?: (side: 'start' | 'end') => void`

2. Determine if first/last day is empty by checking if any scheduled entry's start_time falls on that calendar date (using `getDateInTimezone` with `homeTimezone`).

3. In the day pill rendering (lines 540-564), add a trim button after the Trip Begins/Trip Ends text when the day is empty:

```tsx
{dayIndex === 0 && dayIsEmpty && days.length > 1 && (
  <button
    onClick={(e) => { e.stopPropagation(); onTrimDay?.('start'); }}
    className="ml-1 text-[10px] text-muted-foreground/70 hover:text-destructive underline"
  >
    Trim
  </button>
)}
{dayIndex === days.length - 1 && dayIsEmpty && days.length > 1 && (
  <button
    onClick={(e) => { e.stopPropagation(); onTrimDay?.('end'); }}
    className="ml-1 text-[10px] text-muted-foreground/70 hover:text-destructive underline"
  >
    Trim
  </button>
)}
```

The `dayIsEmpty` check: for each first/last day, check if any entry in `scheduledEntries` has its start_time on that calendar date using `getDateInTimezone(entry.start_time, homeTimezone) === format(day, 'yyyy-MM-dd')`.

### Timeline.tsx changes

1. Add `handleTrimDay` handler:

```typescript
const handleTrimDay = async (side: 'start' | 'end') => {
  if (!trip || !tripId) return;
  const days = getDays();
  if (days.length <= 1) return;

  if (side === 'end') {
    // Find last day with entries
    let lastOccupied = -1;
    for (let i = days.length - 1; i >= 0; i--) {
      const dayStr = format(days[i], 'yyyy-MM-dd');
      if (scheduledEntries.some(e => getDateInTimezone(e.start_time, homeTimezone) === dayStr)) {
        lastOccupied = i;
        break;
      }
    }
    const trimTo = lastOccupied >= 0 ? lastOccupied : 0;
    const trimCount = days.length - 1 - trimTo;
    if (trimCount <= 0) return;

    if (trip.start_date) {
      await supabase.from('trips').update({ end_date: format(days[trimTo], 'yyyy-MM-dd') }).eq('id', tripId);
    } else {
      await supabase.from('trips').update({ duration_days: trimTo + 1 }).eq('id', tripId);
    }
    toast({ title: `Trimmed ${trimCount} empty day(s) from end` });
    await fetchData();
  } else {
    // Find first day with entries
    let firstOccupied = days.length;
    for (let i = 0; i < days.length; i++) {
      const dayStr = format(days[i], 'yyyy-MM-dd');
      if (scheduledEntries.some(e => getDateInTimezone(e.start_time, homeTimezone) === dayStr)) {
        firstOccupied = i;
        break;
      }
    }
    const trimCount = firstOccupied;
    if (trimCount <= 0 || firstOccupied >= days.length) return;

    if (trip.start_date) {
      await supabase.from('trips').update({ start_date: format(days[firstOccupied], 'yyyy-MM-dd') }).eq('id', tripId);
    } else {
      // Undated: shift entries back and reduce duration
      await supabase.from('trips').update({ duration_days: (trip.duration_days ?? 3) - trimCount }).eq('id', tripId);
    }
    toast({ title: `Trimmed ${trimCount} empty day(s) from start` });
    await fetchData();
  }
};
```

2. Pass `onTrimDay={handleTrimDay}` to `ContinuousTimeline`.

## Files Modified

| File | Change |
|------|--------|
| `src/pages/Timeline.tsx` | Add `handleTrimDay` handler; pass as prop; minor stale-state fix in `autoExtendTripIfNeeded` |
| `src/components/timeline/ContinuousTimeline.tsx` | Add `onTrimDay` prop; add empty-day detection; render trim buttons on first/last day pills |

## What Does NOT Change

- Day pill styling for non-first/non-last days
- EntrySheet, HotelWizard, transport system
- Auto-extend logic (kept as-is, just ensuring fresh data)
- Middle day handling -- no trim on middle days

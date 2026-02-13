

# Auto-Extend Trip + Trip End Marker

## Feature 8: Auto-extend trip when entries go past final day

### New utility function in `src/pages/Timeline.tsx`

Add a helper function `autoExtendTripIfNeeded` inside the Timeline component (or just before the component, importing supabase and toast):

```typescript
async function autoExtendTripIfNeeded(
  tripId: string,
  entryEndIso: string,
  trip: Trip,
  fetchData: () => Promise<void>
) {
  if (trip.start_date) {
    // Dated trip: check against end_date
    const entryDate = entryEndIso.slice(0, 10); // rough YYYY-MM-DD from ISO
    // More accurate: use format(parseISO(entryEndIso), 'yyyy-MM-dd') but entry times are UTC
    // Use getDateInTimezone to get correct local date
    const entryDateStr = format(new Date(entryEndIso), 'yyyy-MM-dd');
    if (!trip.end_date || entryDateStr > trip.end_date) {
      await supabase.from('trips').update({ end_date: entryDateStr }).eq('id', tripId);
      toast({ title: `Trip extended to ${format(parseISO(entryDateStr), 'EEE d MMM')}` });
      await fetchData();
    }
  } else {
    // Undated trip: check against duration_days
    // Entry dates are relative to REFERENCE_DATE (2099-01-01)
    const refDate = parseISO('2099-01-01');
    const entryDate = new Date(entryEndIso);
    const daysDiff = Math.ceil((entryDate.getTime() - refDate.getTime()) / 86400000) + 1;
    if (daysDiff > (trip.duration_days ?? 3)) {
      await supabase.from('trips').update({ duration_days: daysDiff }).eq('id', tripId);
      toast({ title: `Trip extended to Day ${daysDiff}` });
      await fetchData();
    }
  }
}
```

### Call sites

**a) `handleDropOnTimeline` (line ~1007):** After `await fetchData()` and before the travel calculation, call:
```typescript
if (trip) await autoExtendTripIfNeeded(tripId!, endIso, trip, fetchData);
```

**b) `handleEntryTimeChange` (line ~743):** After `await fetchData()`, call:
```typescript
if (trip && tripId) await autoExtendTripIfNeeded(tripId, newEndIso, trip, fetchData);
```

**c) EntrySheet save flow:** The EntrySheet calls back into Timeline to create/update entries. After the entry is saved (in whichever handler processes EntrySheet's onSave), add the same check. This likely happens in `handleDropOnTimeline` for new entries or `handleEntryTimeChange` for edits -- both already covered above. If EntrySheet creates entries directly (via its own supabase calls), we add the check after `fetchData` in the EntrySheet's save callback passed from Timeline.

**d) Hotel wizard:** After hotel blocks are created, the HotelWizard calls `onComplete` which triggers `fetchData`. Add auto-extend check in the `onComplete` handler for HotelWizard in Timeline.tsx. The checkout date is the latest date -- pass it to `autoExtendTripIfNeeded`.

### Implementation details

- The function needs access to the trip's home timezone to correctly determine what calendar date an entry falls on. Use `getDateInTimezone(entryEndIso, homeTimezone)` instead of naive date slicing for accuracy.
- For undated trips, compute the day number from the reference date.
- The function updates the trip in the DB, shows a toast, and calls fetchData to refresh the trip object (which regenerates the days array, adding new days to the timeline).

---

## Feature 9: Trip End marker in ContinuousTimeline

### Changes to `src/components/timeline/ContinuousTimeline.tsx`

In the midnight day markers section (lines 552-557), add a condition for the last day after the existing "Trip Begins" block:

```tsx
{dayIndex === 0 && (
  <>
    <span className="text-muted-foreground/50">.</span>
    <span className="text-muted-foreground/70">Trip Begins</span>
  </>
)}
{dayIndex === days.length - 1 && (
  <>
    <span className="text-muted-foreground/50">.</span>
    <span className="text-muted-foreground/70">Trip Ends</span>
  </>
)}
```

For a 1-day trip (days.length === 1), both conditions trigger on dayIndex === 0, showing both markers.

---

## Files Modified

| File | Change |
|------|--------|
| `src/pages/Timeline.tsx` | Add `autoExtendTripIfNeeded` helper; call it from `handleDropOnTimeline`, `handleEntryTimeChange`, and hotel wizard `onComplete` |
| `src/components/timeline/ContinuousTimeline.tsx` | Add "Trip Ends" marker on last day pill |

## What Does NOT Change

- EntrySheet form fields
- Hotel wizard internals
- Transport system
- Day pill styling (existing design preserved)
- ContinuousTimeline rendering (other than the end marker)


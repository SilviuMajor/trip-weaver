

# Optimistic Quick-Add for Explore Cards

## Overview
Make the quick-add flow feel instant by showing the checkmark and toast immediately, then performing the database insert in the background with rollback on failure.

## Current Behavior
- `handleAdd` in ExploreView calls `onAddToPlanner(place)` (which does the DB insert and waits) then adds to `addedPlaceIds`
- The toast only fires after the DB insert completes in `handleAddToPlanner` in Timeline.tsx
- The card checkmark appears only after the sync `onAddToPlanner` call

## Changes

### File: `src/components/timeline/ExploreView.tsx`

**Update `handleAdd` (line 402-405)** to be optimistic:

```typescript
const handleAdd = useCallback((place: ExploreResult) => {
  // Optimistic: mark as added + toast immediately
  setAddedPlaceIds(prev => new Set(prev).add(place.placeId));
  toast({ title: `Added ${place.name} to Planner` });
  
  // Fire DB insert in background, rollback on failure
  Promise.resolve(onAddToPlanner(place)).catch(() => {
    setAddedPlaceIds(prev => {
      const next = new Set(prev);
      next.delete(place.placeId);
      return next;
    });
    toast({ title: `Failed to add ${place.name}`, description: 'Please try again', variant: 'destructive' });
  });
}, [onAddToPlanner]);
```

### File: `src/pages/Timeline.tsx`

**Update `handleAddToPlanner` (line 270-309)** to remove the success toast (ExploreView now handles it) and re-throw errors so the optimistic rollback catches them:

```typescript
const handleAddToPlanner = useCallback(async (place: ExploreResult) => {
  if (!trip || !tripId) return;
  // No try/catch toast here -- ExploreView handles optimistic toast + rollback
  const catId = exploreCategoryId || inferCategoryFromTypes(place.types);
  const cat = findCategory(catId);
  const REFERENCE_DATE_STR = '2099-01-01';
  const startIso = localToUTC(REFERENCE_DATE_STR, '00:00', homeTimezone);
  const endIso = localToUTC(REFERENCE_DATE_STR, '01:00', homeTimezone);

  const { data: d, error } = await supabase
    .from('entries')
    .insert({ trip_id: tripId, start_time: startIso, end_time: endIso, is_scheduled: false } as any)
    .select('id').single();
  if (error) throw error;

  await supabase.from('entry_options').insert({ ... } as any);
  fetchData();
}, [trip, tripId, exploreCategoryId, homeTimezone, fetchData]);
```

Key change: remove `toast(...)` success call and remove `try/catch` so errors propagate to ExploreView's `.catch()`.

**Update `handleAddAtTime` (line 312-361)** similarly: move toast and close to happen before the await, with rollback on failure:

```typescript
const handleAddAtTime = useCallback(async (place: ExploreResult, startTime: string, endTime: string) => {
  if (!trip || !tripId) return;
  // Close Explore immediately
  setExploreOpen(false);
  setExploreCategoryId(null);
  const timeStr = new Date(startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  toast({ title: `Added ${place.name} at ${timeStr}` });

  try {
    // DB insert in background
    const catId = exploreCategoryId || inferCategoryFromTypes(place.types);
    const cat = findCategory(catId);
    const { data: d, error } = await supabase.from('entries').insert(...).select('id').single();
    if (error) throw error;
    await supabase.from('entry_options').insert({ ... } as any);
    await fetchData();
    if (trip) await autoExtendTripIfNeeded(tripId, endTime, trip, fetchData);
    // Opening hours conflict check
    if (place.openingHours) {
      const { isConflict, message } = checkOpeningHoursConflict(place.openingHours as string[], startTime);
      if (isConflict) {
        toast({ title: 'Venue may be closed', description: message, variant: 'destructive' });
      }
    }
  } catch (err: any) {
    toast({ title: `Failed to add ${place.name}`, description: err.message, variant: 'destructive' });
  }
}, [trip, tripId, exploreCategoryId, fetchData]);
```

## Files Summary

| File | Change |
|------|--------|
| `src/components/timeline/ExploreView.tsx` | Make `handleAdd` optimistic with immediate toast + rollback on error |
| `src/pages/Timeline.tsx` | Remove success toast from `handleAddToPlanner` (let errors propagate); move toast/close before await in `handleAddAtTime` |

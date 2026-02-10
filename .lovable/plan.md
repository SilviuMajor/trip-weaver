
# Fix Auto-Generate Transport Placement

## Problems Found

Three bugs cause transport entries to be placed incorrectly and events not to snap together:

### Bug 1: Transport starts at flight end, ignoring checkout
The edge function filters out checkin/checkout entries from `mainEntries` (line 219-221) so it doesn't create transport between checkout and cafe. But when it processes Flight -> Cafe, it sets `startTime = entryA.end_time` (flight end = 09:50 UTC). The checkout runs until 10:20 UTC, so the transport overlaps with checkout by 30 minutes.

**Fix**: When entryA is a flight, find its linked checkout entry and use the checkout's `end_time` as the transport start time. Similarly, when entryB is a flight, find its linked checkin entry and use the checkin's `start_time` as the transport destination arrival deadline.

### Bug 2: Transport doesn't snap the next event forward
The cafe starts at 11:15, and the transport ends around ~10:40. There's a 35-minute gap. The user expects the cafe to be pulled forward to connect with the transport end. The current push algorithm only handles overlaps (transport end > next event start), not gaps.

**Fix**: After creating transport entries, add a "snap" step that pulls the next unlocked event forward to start at the transport's end time (preserving its duration).

### Bug 3: Push algorithm doesn't cascade after snapping
After snapping the cafe forward to 10:40, we need to check if this creates overlap or gap with the next event (hotel at 14:00). Events should only be snapped if they're the immediate next event after transport.

**Fix**: The snap logic should only apply to the event immediately after each transport entry, not cascade further. Subsequent events keep their original times unless they overlap.

---

## File Changes

### 1. Edge Function: `supabase/functions/auto-generate-transport/index.ts`

**Account for checkin/checkout when determining transport start/end times:**

```typescript
// Before processing pairs, build a map of flight -> checkout end times
const flightCheckoutEnd = new Map<string, string>();
const flightCheckinStart = new Map<string, string>();
for (const e of dayEntries) {
  if (e.linked_type === 'checkout') {
    // Find the flight this checkout belongs to
    const flightEntry = dayEntries.find(f => {
      const fOpt = optionsByEntry.get(f.id);
      return fOpt?.category === 'flight' && 
             new Date(f.end_time).getTime() === new Date(e.start_time).getTime();
    });
    if (flightEntry) flightCheckoutEnd.set(flightEntry.id, e.end_time);
  }
  if (e.linked_type === 'checkin') {
    const flightEntry = dayEntries.find(f => {
      const fOpt = optionsByEntry.get(f.id);
      return fOpt?.category === 'flight' && 
             new Date(f.start_time).getTime() === new Date(e.end_time).getTime();
    });
    if (flightEntry) flightCheckinStart.set(flightEntry.id, e.start_time);
  }
}

// When determining startTime:
const startTime = flightCheckoutEnd.get(entryA.id) || entryA.end_time;
```

This ensures transport from a flight starts after checkout (10:20), not at flight end (09:50).

**Add snap information to the response:**

Return the `to_entry_id` and `transport_end_time` for each created transport so the client knows which event to snap.

### 2. Client Push Algorithm: `src/pages/Timeline.tsx`

**Add snap-forward logic after transport creation:**

After refreshing data, for each transport entry created:
1. Find the next non-transport, non-locked entry after it
2. If there's a gap between transport end and next entry start, snap the next entry forward (move its start to transport end, preserve duration)
3. Then run the existing cascade push for any resulting overlaps

```typescript
// Snap: pull next unlocked event to connect with transport end
for (const transport of data.created) {
  const nextEntry = dayEnts.find(e => 
    new Date(e.start_time).getTime() > new Date(transport.end_time).getTime() &&
    !e.is_locked &&
    optMap.get(e.id) !== 'transfer'
  );
  if (nextEntry) {
    const gap = new Date(nextEntry.start_time).getTime() - new Date(transport.end_time).getTime();
    if (gap > 0) {
      const duration = new Date(nextEntry.end_time).getTime() - new Date(nextEntry.start_time).getTime();
      nextEntry.start_time = transport.end_time;
      nextEntry.end_time = new Date(new Date(transport.end_time).getTime() + duration).toISOString();
      updates.push({ id: nextEntry.id, start_time: nextEntry.start_time, end_time: nextEntry.end_time });
    }
  }
}

// Then run existing cascade push for any remaining overlaps
```

---

## Expected Result

For the user's scenario (Day 1):

```text
BEFORE:
  Coach         06:00 - 07:30 UTC
  [Checkin]     06:30 - 08:15 UTC  
  Flight BA432  09:15 - 09:50 UTC  
  [Checkout]    09:50 - 10:20 UTC
  -- 55 min gap --
  Café          11:15 - 12:15 UTC
  -- 1h45m gap --
  Hotel         14:00 - 15:00 UTC

AFTER:
  Coach         06:00 - 07:30 UTC
  [Checkin]     06:30 - 08:15 UTC
  Flight BA432  09:15 - 09:50 UTC
  [Checkout]    09:50 - 10:20 UTC
  Transit       10:20 - 10:40 UTC  (transport starts at checkout end)
  Café          10:40 - 11:40 UTC  (snapped forward to transport end, duration preserved)
  -- gap --
  Hotel         14:00 - 15:00 UTC  (not moved, no overlap)
```

---

## Technical Summary

| File | Change |
|------|--------|
| `supabase/functions/auto-generate-transport/index.ts` | Use checkout end_time (not flight end_time) as transport start; use checkin start_time as transport deadline for destination flights |
| `src/pages/Timeline.tsx` | Add snap-forward logic to pull next unlocked event to transport end; then run cascade push for remaining overlaps |

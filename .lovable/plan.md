
# Fix Transport Generation + Flight Timing + Flight Editing

## Four Problems to Solve

### Problem 1: Spurious transport generation
The edge function creates transport between events that are themselves transport-like (e.g. Coach with category `travel`), and doesn't check if the effective gap is zero or negative. It also doesn't account for flights with linked checkins that already bridge the gap.

**Fix**: Add 3 guards to `supabase/functions/auto-generate-transport/index.ts`:
1. Skip pairs where either entry has a transport-like category (`transfer`, `travel`, `transport`)
2. Skip when transportStartTime >= deadlineTime (no effective gap)
3. Skip when the destination is a flight whose linked checkin already starts before transportStartTime

### Problem 2: Flight checkin/checkout times misaligned with flight
Checkin entry ends at 08:15 but flight departs at 09:15 (1h gap). The FlightGroupCard visually masks this by positioning checkin to end at flight departure, but the DB times are wrong. When a flight is created or its times change, linked checkin/checkout times should be recalculated.

**Fix**: In `CalendarDay.tsx` `handleDragCommit`, linked entries are already repositioned on drag. But the original creation (in EntrySheet save handler) may not set correct times. Also, when flight times are edited inline (Problem 4), linked entries must update. Add a shared helper that:
- Sets checkin end_time = flight start_time, checkin start_time = flight start_time - checkinHours
- Sets checkout start_time = flight end_time, checkout end_time = flight end_time + checkoutMin

For the existing data, provide a one-time fix query.

### Problem 3: Can't edit flight times in view dialog
In EntrySheet view mode, flight departure/arrival times are plain `<p>` tags, not `InlineField`. Users can't adjust flight times after creation.

**Fix**: Replace the time `<p>` tags with `InlineField` components that:
- Parse the edited time string (HH:MM) 
- Convert back to UTC using the appropriate timezone (departure_tz for start, arrival_tz for end)
- Update the `entries` table `start_time`/`end_time`
- Recalculate linked checkin/checkout times automatically

### Problem 4: Transport snap/push crossing days (from previous plan)
Already fixed in prior commit. No additional changes needed.

---

## File Changes Summary

| File | Changes |
|------|---------|
| `supabase/functions/auto-generate-transport/index.ts` | Add 3 skip guards: transport-like categories, no-gap, checkin-bridged flights |
| `src/components/timeline/EntrySheet.tsx` | Make flight times editable with InlineField; auto-update linked entries on time change |
| `src/lib/flightLinkedTimes.ts` | New helper to recalculate checkin/checkout times from flight times |

---

## Technical Details

### Edge function guards (auto-generate-transport/index.ts)

```typescript
// Guard 1: Skip transport-like categories
const TRANSPORT_CATS = ['transfer', 'travel', 'transport'];
if (TRANSPORT_CATS.includes(optA.category) || TRANSPORT_CATS.includes(optB.category)) continue;

// Guard 2: No effective gap
if (new Date(transportStartTime).getTime() >= new Date(deadlineTime).getTime()) continue;

// Guard 3: Checkin bridges gap for flights
if (optB.category === 'flight') {
  const checkin = entries.find(e => e.linked_flight_id === entryB.id && e.linked_type === 'checkin');
  if (checkin && new Date(checkin.start_time).getTime() <= new Date(transportStartTime).getTime()) continue;
}
```

### Flight time inline editing (EntrySheet.tsx)

Replace the departure/arrival time `<p>` tags with InlineField:

```tsx
<InlineField
  value={formatTimeInTz(entry.start_time, option.departure_tz!)}
  canEdit={isEditor}
  onSave={async (newTime) => {
    // Parse HH:MM, convert to UTC using departure_tz
    const dateStr = entry.start_time.substring(0, 10); // keep same date
    const newStartIso = localToUTC(dateStr, newTime, option.departure_tz!);
    await supabase.from('entries').update({ start_time: newStartIso }).eq('id', entry.id);
    // Recalculate linked entries
    await updateLinkedFlightTimes(entry.id, newStartIso, entry.end_time);
    onSaved();
  }}
/>
// Similar for arrival time with arrival_tz and end_time
```

### Linked times helper (src/lib/flightLinkedTimes.ts)

```typescript
import { supabase } from '@/integrations/supabase/client';

export async function updateLinkedFlightTimes(
  flightId: string,
  flightStartIso: string,
  flightEndIso: string,
  checkinHours = 2,
  checkoutMin = 30,
) {
  const { data: linked } = await supabase
    .from('entries')
    .select('id, linked_type')
    .eq('linked_flight_id', flightId);

  if (!linked) return;

  for (const entry of linked) {
    if (entry.linked_type === 'checkin') {
      const flightStart = new Date(flightStartIso);
      const ciEnd = flightStart.toISOString();
      const ciStart = new Date(flightStart.getTime() - checkinHours * 3600000).toISOString();
      await supabase.from('entries').update({ start_time: ciStart, end_time: ciEnd }).eq('id', entry.id);
    } else if (entry.linked_type === 'checkout') {
      const flightEnd = new Date(flightEndIso);
      const coStart = flightEnd.toISOString();
      const coEnd = new Date(flightEnd.getTime() + checkoutMin * 60000).toISOString();
      await supabase.from('entries').update({ start_time: coStart, end_time: coEnd }).eq('id', entry.id);
    }
  }
}
```

### One-time data fix for existing misaligned entries

```sql
-- Fix checkin for BA432: should end at flight start (09:15), start 2h before (07:15)
UPDATE entries SET start_time = '2026-02-21 07:15:00+00', end_time = '2026-02-21 09:15:00+00'
WHERE id = 'aab2c6dc-bcae-4f04-8bfa-88eaf4d69838';
```



# Fix Transport Placement Timezone Resolution

## Root Cause

On flight days, the timeline resolves which timezone to use for each entry based on whether its `start_time` is before or after the flight's end time (line 593-596 in `CalendarDay.tsx`):

```
resolvedTz = entryUtcMs >= flightEndMs ? destinationTz : originTz
```

When a transport connector starts at the **exact same instant** as the preceding event's end, and that event is positioned using the **origin timezone**, the transport may resolve to the **destination timezone** if its `start_time >= flightEndUtc`. This creates a 1-hour visual offset between where the prior event ends and where the transport begins.

Additionally, the `EntrySheet` form always uses `tripTimezone` for converting `prefillStartTime` to display time, rather than the resolved timezone for the entry's position. This causes the displayed start time in the form to be wrong on flight days.

## Fix Details

### 1. Pass resolved timezone through transport context

**File: `src/components/timeline/CalendarDay.tsx`**
- When the gap/transport button is clicked (line 520), also pass the `resolvedTz` that the prior event uses for positioning
- Change `onAddTransport` signature to include a `resolvedTz` parameter:
  ```
  onAddTransport(entry.id, nextEntry.id, entry.end_time, resolvedTzForEntry)
  ```

**File: `src/pages/Timeline.tsx`**
- Update `handleAddTransport` to accept and forward the resolved timezone
- Store it in `transportContext` so EntrySheet can use it

**File: `src/components/timeline/EntrySheet.tsx`**
- When `transportContext` includes a resolved timezone, use that instead of `tripTimezone` for `utcToLocal` conversions at lines 287 and 311

### 2. Ensure transport inherits the same timezone as its "from" entry

**File: `src/components/timeline/CalendarDay.tsx`**
- In the entry rendering block (line 593-596), when an entry has `from_entry_id`, resolve its timezone using the same timezone as the "from" entry rather than independently checking against the flight boundary
- This ensures the transport visually starts exactly where the prior event ends

### 3. Handle edge case at flight boundary

The `>=` comparison at line 596 means entries starting at exactly the flight end moment use the destination TZ. Transport connectors that bridge this boundary should use the **from entry's** timezone for their start position:

```typescript
if (entry.from_entry_id) {
  // Inherit TZ from the "from" entry so transport starts at the right visual position
  const fromEntry = sortedEntries.find(e => e.id === entry.from_entry_id);
  if (fromEntry) {
    const fromEntryMs = new Date(fromEntry.start_time).getTime();
    resolvedTz = fromEntryMs >= flightEndMs ? dayFlights[0].destinationTz : dayFlights[0].originTz;
  }
}
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/timeline/CalendarDay.tsx` | Pass resolvedTz through onAddTransport; inherit from-entry TZ for transport positioning |
| `src/pages/Timeline.tsx` | Accept resolvedTz in handleAddTransport; store in transportContext |
| `src/components/timeline/EntrySheet.tsx` | Use transport context's resolvedTz instead of tripTimezone for display conversions |

## What Is NOT Changed

- Transport save logic (prefillStartTime direct usage stays)
- Non-flight-day transport (no timezone boundary, no issue)
- Flight card positioning
- Mode switching / refresh behavior


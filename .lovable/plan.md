

# Fix: Preserve Card Duration on Move (Including Linked Entries)

## File 1: `src/hooks/useDragResize.ts`

### Change A: Fix cross-day clamping (lines 160-162)

Replace:
```typescript
if (newStart < 0) { newEnd -= newStart; }
const clampedStart = Math.max(0, newStart);
const clampedEnd = Math.min(24, newEnd);
```

With:
```typescript
if (newStart < 0) { newEnd -= newStart; newStart = 0; }
if (newEnd > 24) { newStart -= (newEnd - 24); newEnd = 24; }
newStart = Math.max(0, newStart);
newEnd = Math.min(24, newEnd);
```

Then update the `updated` object on lines 164-167 to use `newStart`/`newEnd` instead of `clampedStart`/`clampedEnd`.

### Change B: Pass `dragType` through `onCommit` (line 29 and line 208)

Update the `onCommit` signature to include `dragType`:
```typescript
onCommit: (entryId: string, newStartHour: number, newEndHour: number, tz?: string, targetDay?: Date, dragType?: DragType) => void;
```

In `commitDrag` (line 208), pass `state.type`:
```typescript
onCommit(state.entryId, state.currentStartHour, state.currentEndHour, state.tz, state.targetDay, state.type);
```

---

## File 2: `src/components/timeline/CalendarDay.tsx`

### Change: Rewrite `handleDragCommit` (lines 117-176) to preserve duration on moves

The updated function:

```typescript
const handleDragCommit = useCallback((entryId: string, newStartHour: number, newEndHour: number, tz?: string, targetDay?: Date, dragType?: DragType) => {
  if (!onEntryTimeChange) return;
  const entry = sortedEntries.find(e => e.id === entryId);
  if (entry?.is_locked) return;

  const effectiveDay = targetDay || dayDate;
  const dateStr = format(effectiveDay, 'yyyy-MM-dd');

  const toTimeStr = (hour: number) => {
    const minutes = Math.round(hour * 60);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const primaryOpt = entry?.options[0];
  const isFlight = primaryOpt?.category === 'flight' && primaryOpt?.departure_tz && primaryOpt?.arrival_tz;
  const startTz = isFlight ? primaryOpt.departure_tz! : (tz || activeTz || tripTimezone);
  const endTz = isFlight ? primaryOpt.arrival_tz! : startTz;

  const isMove = dragType === 'move';

  if (isMove && entry) {
    // MOVE: preserve original UTC duration
    const origDurationMs = new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime();
    const newStartIso = localToUTC(dateStr, toTimeStr(newStartHour), startTz);
    const newEndIso = new Date(new Date(newStartIso).getTime() + origDurationMs).toISOString();
    onEntryTimeChange(entryId, newStartIso, newEndIso);
  } else {
    // RESIZE: convert start and end independently (existing behavior)
    const newStartIso = localToUTC(dateStr, toTimeStr(newStartHour), startTz);
    const newEndIso = localToUTC(dateStr, toTimeStr(newEndHour), endTz);
    onEntryTimeChange(entryId, newStartIso, newEndIso);
  }

  // Move linked processing entries if this is a flight
  if (entry) {
    const linkedOpt = entry.options[0];
    const linkedEntries = allEntries.filter(e => e.linked_flight_id === entry.id);
    const fallbackTz = tz || activeTz || tripTimezone;

    linkedEntries.forEach(linked => {
      const linkedTz = linked.linked_type === 'checkin'
        ? (linkedOpt?.departure_tz || fallbackTz)
        : (linkedOpt?.arrival_tz || fallbackTz);

      // Preserve linked entry's original UTC duration
      const linkedDurationMs = new Date(linked.end_time).getTime() - new Date(linked.start_time).getTime();

      let newLinkedStartIso: string;
      let newLinkedEndIso: string;

      if (linked.linked_type === 'checkin') {
        // Check-in ends at flight start
        const newLinkedEndHour = newStartHour;
        newLinkedEndIso = localToUTC(dateStr, toTimeStr(newLinkedEndHour), linkedTz);
        newLinkedStartIso = new Date(new Date(newLinkedEndIso).getTime() - linkedDurationMs).toISOString();
      } else {
        // Checkout starts at flight end
        const newLinkedStartHour = newEndHour;
        newLinkedStartIso = localToUTC(dateStr, toTimeStr(newLinkedStartHour), linkedTz);
        newLinkedEndIso = new Date(new Date(newLinkedStartIso).getTime() + linkedDurationMs).toISOString();
      }

      onEntryTimeChange(linked.id, newLinkedStartIso, newLinkedEndIso);
    });
  }
}, [onEntryTimeChange, dayDate, tripTimezone, activeTz, sortedEntries, allEntries]);
```

Key changes:
- Accepts `dragType` parameter (new 6th argument from `useDragResize`)
- For **moves**: calculates `origDurationMs` from the entry's existing UTC timestamps, converts only the new start hour to ISO, then adds the original duration to get the end. This guarantees no duration drift regardless of timezone differences.
- For **resizes**: keeps the existing independent conversion behavior (user intentionally changing duration).
- For **linked entries**: always uses UTC duration preservation. Captures `linkedDurationMs` from the linked entry's existing timestamps, then anchors to the flight's new start/end hour and applies the duration. This prevents linked check-in/checkout cards from drifting.

Also add the `DragType` import at the top of CalendarDay.tsx:
```typescript
import { useDragResize, type DragType } from '@/hooks/useDragResize';
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useDragResize.ts` | Fix cross-day clamping to shift as block; pass `dragType` in `onCommit` |
| `src/components/timeline/CalendarDay.tsx` | Import `DragType`; rewrite `handleDragCommit` with move vs resize branching and UTC duration preservation for both primary and linked entries |


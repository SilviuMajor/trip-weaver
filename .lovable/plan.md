

# Memoize getEntryGlobalHours + Batch Transport Updates

## Summary
Two performance improvements: (1) cache the expensive `getEntryGlobalHours` computation per entry in a Map, eliminating 400+ redundant `Intl.DateTimeFormat` calls per render, and (2) batch sequential transport DB updates into a single `Promise.all`.

---

## Change 1: Memoize getEntryGlobalHours in ContinuousTimeline.tsx

### 1a. Add memoized map + lookup (after `sortedEntries`, ~line 278)

```typescript
const entryGlobalHoursMap = useMemo(() => {
  const map = new Map<string, { startGH: number; endGH: number; resolvedTz: string }>();
  for (const entry of sortedEntries) {
    map.set(entry.id, getEntryGlobalHours(entry));
  }
  return map;
}, [sortedEntries, getEntryGlobalHours]);

const getEntryGH = useCallback((entry: EntryWithOptions): { startGH: number; endGH: number; resolvedTz: string } => {
  return entryGlobalHoursMap.get(entry.id) ?? getEntryGlobalHours(entry);
}, [entryGlobalHoursMap, getEntryGlobalHours]);
```

### 1b. Replace all `getEntryGlobalHours(...)` call sites with `getEntryGH(...)`

There are ~25 call sites across the file. All instances of `getEntryGlobalHours(entry)`, `getEntryGlobalHours(e)`, `getEntryGlobalHours(other)`, `getEntryGlobalHours(origEntry)`, `getEntryGlobalHours(blockEntries[0])`, etc. will be replaced with the equivalent `getEntryGH(...)` call.

The affected useMemo/useCallback blocks and their approximate line numbers:
- `transportSnapTargets` (~line 506)
- `lockedBoundaries` (~line 520)
- `connectorData` (~lines 589-590)
- `overlapMap` (~lines 678-679)
- `overlapLayout` (~line 694)
- `snapTarget` (~lines 724-725, 746)
- RAF loop for floating card (~line 896)
- Hour label hide-for-pill (~line 1080)
- Gap buttons render (~lines 1274-1275)
- Main card render: resize branch (~line 1437), normal branch (~line 1439)
- `hasEntryDirectlyAbove` / `hasEntryDirectlyBelow` (~lines 1482, 1487)
- Drag hours for init (~line 1494)
- Time pills during move drag (~lines 1864-1865, 1870)
- Ghost outline during detached drag (~lines 1945-1946, 1952)

### 1c. Update dependency arrays

All useMemo/useCallback blocks that currently list `getEntryGlobalHours` in their dependency array will be updated to use `getEntryGH` instead. The original `getEntryGlobalHours` useCallback definition remains -- it's the computation engine -- but `getEntryGH` becomes the only accessor.

---

## Change 2: Batch Transport DB Updates in Timeline.tsx

### Current code (lines 1225-1256)

The transport reposition loop runs sequential `await` calls for each transport:
```typescript
for (const transport of linkedTransports) {
  // ...checks...
  updateEntryLocally(transport.id, { ... });
  await supabase.from('entries').update(...).eq('id', transport.id);
}
```

### New code

Replace the sequential loop with parallel execution. Separate into three phases:
1. Collect optimistic local updates and DB promises
2. Apply all local updates immediately (already instant)
3. Fire all DB updates in parallel via `Promise.all`

```typescript
const transportDbPromises: Promise<any>[] = [];
const transportDeletions: Promise<any>[] = [];

for (const transport of linkedTransports) {
  const fromId = transport.from_entry_id;
  const toId = transport.to_entry_id;
  if (!fromId || !toId) continue;

  const toEntry = entries.find(e => e.id === toId);
  if (toEntry?.is_locked) continue;

  const fromEndTime = fromId === entryId ? newEndIso : (entries.find(e => e.id === fromId)?.end_time ?? null);
  const toStartTime = toId === entryId ? newStartIso : (entries.find(e => e.id === toId)?.start_time ?? null);
  if (!fromEndTime || !toStartTime) continue;

  const gapMin = (new Date(toStartTime).getTime() - new Date(fromEndTime).getTime()) / 60000;

  if (gapMin > 90) {
    setEntries(prev => prev.filter(e => e.id !== transport.id));
    transportDeletions.push(
      supabase.from('entry_options').delete().eq('entry_id', transport.id)
        .then(() => supabase.from('entries').delete().eq('id', transport.id))
    );
  } else {
    const durationMs = new Date(transport.end_time).getTime() - new Date(transport.start_time).getTime();
    const newStart = fromEndTime;
    const newEnd = new Date(new Date(newStart).getTime() + durationMs).toISOString();
    updateEntryLocally(transport.id, { start_time: newStart, end_time: newEnd });
    transportDbPromises.push(
      supabase.from('entries').update({ start_time: newStart, end_time: newEnd }).eq('id', transport.id)
    );
  }
}

await Promise.all([...transportDbPromises, ...transportDeletions]);
```

Note: Deletions are chained (options must be deleted before entries due to FK constraint) but multiple transports are deleted in parallel with each other.

---

## Files Modified
- `src/components/timeline/ContinuousTimeline.tsx` -- add `entryGlobalHoursMap` + `getEntryGH`, replace ~25 call sites
- `src/pages/Timeline.tsx` -- batch transport DB updates with `Promise.all`

## What Is NOT Changed
- `getEntryGlobalHours` definition (kept as computation engine)
- Edge functions
- `useDragResize` hook
- Any other files

## Testing
- Open a trip with 15+ entries -- timeline should render noticeably faster
- Drag a card with 2+ linked transports -- check Network tab to confirm DB updates fire simultaneously
- Verify overlap indicators still appear correctly
- Verify gap buttons appear in correct positions
- Verify magnet snap icons still work
- Verify flight group rendering (checkin/checkout bounds) unchanged


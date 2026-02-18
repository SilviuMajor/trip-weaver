

# Optimistic Local State for Card Drag

## Summary
Replace the full `fetchData()` call after card drags and lock toggles with instant local state updates, eliminating the 200-500ms stutter caused by re-fetching all data from the database.

---

## Changes

### 1. Add `updateEntryLocally` helper

**File: `src/pages/Timeline.tsx`** (after entries state, ~line 76)

```typescript
const updateEntryLocally = useCallback((entryId: string, updates: Partial<Entry>) => {
  setEntries(prev => prev.map(e =>
    e.id === entryId ? { ...e, ...updates } : e
  ));
}, []);
```

### 2. Make `handleEntryTimeChange` optimistic (lines 1173-1344)

Restructure the function to:

**a) Apply optimistic local update immediately** (before any DB call):
```typescript
updateEntryLocally(entryId, { start_time: newStartIso, end_time: newEndIso });
```

**b) Make undo/redo also update local state** (not just DB):
```typescript
pushAction({
  description: desc,
  undo: async () => {
    await supabase.from('entries').update({ start_time: oldStart, end_time: oldEnd }).eq('id', entryId);
    updateEntryLocally(entryId, { start_time: oldStart, end_time: oldEnd });
  },
  redo: async () => {
    await supabase.from('entries').update({ start_time: newStartIso, end_time: newEndIso }).eq('id', entryId);
    updateEntryLocally(entryId, { start_time: newStartIso, end_time: newEndIso });
  },
});
```

**c) Rollback on DB error**:
```typescript
if (error) {
  updateEntryLocally(entryId, { start_time: oldStart, end_time: oldEnd });
  return;
}
```

**d) Reposition linked transports optimistically**:
- Use local `entries` state to find linked transports (filter by `from_entry_id`/`to_entry_id` and `category === 'transfer'`) instead of querying DB
- For each transport: call `updateEntryLocally` for instant visual update, then sync to DB
- For transport deletion (gap > 90min): remove from local state via `setEntries(prev => prev.filter(...))`, then delete from DB

**e) Smart-drop push**: Also apply `updateEntryLocally` for the pushed overlapped card, and update undo/redo to include local state changes.

**f) Remove `fetchData()` calls**: Remove the two `fetchData()` calls at lines 1269 and 1333. Keep `fetchData` only in `autoExtendTripIfNeeded` (which only fires when the trip duration changes -- rare) and in `handleSnapRelease` (which creates NEW transport entries).

### 3. Make `handleToggleLock` optimistic (lines 2191-2201)

```typescript
const handleToggleLock = async (entryId: string, currentLocked: boolean) => {
  const newLocked = !currentLocked;
  // Optimistic
  updateEntryLocally(entryId, { is_locked: newLocked } as any);
  // DB sync
  const { error } = await supabase.from('entries')
    .update({ is_locked: newLocked }).eq('id', entryId);
  if (error) {
    // Rollback
    updateEntryLocally(entryId, { is_locked: currentLocked } as any);
    toast({ title: 'Failed to toggle lock', description: error.message, variant: 'destructive' });
  }
  // No fetchData()
};
```

### 4. What still uses `fetchData()`

These operations create or delete entire entries/options, so they genuinely need a full refresh:
- `handleSnapRelease` -- creates new transport entries
- `handleDropOnTimeline` -- creates new entries from panel
- `handleModeSwitchConfirm` -- updates option data
- `handleDeleteTransport` -- removes entries
- `handleAutoGenerateTransport` -- creates multiple transports
- `EntrySheet` / `HotelWizard` `onSaved` callbacks
- Realtime sync (other users' changes)

---

## Files Modified
- `src/pages/Timeline.tsx` -- add `updateEntryLocally`, refactor `handleEntryTimeChange` and `handleToggleLock`

## What Is NOT Changed
- `fetchData()` function itself (still needed for other operations)
- `useRealtimeSync` (still syncs other users' changes)
- Edge functions
- `useDragResize` / `ContinuousTimeline` (drag mechanics unchanged)

## Testing
- Drag a card to a new time -- should update instantly with no flicker
- Drag a card with a transport connector -- transport repositions instantly
- Undo the drag -- reverts instantly
- Drag on throttled 3G network -- should still feel instant
- Lock/unlock a card -- toggles instantly with no flash
- Create transport via magnet snap -- still works (uses fetchData)
- Switch transport mode -- still works (uses fetchData)
- Smart-drop push -- pushed card moves instantly

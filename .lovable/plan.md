

# Fix: Stale Lock State in EntrySheet

## Problem

When toggling lock from the EntrySheet, `handleToggleLock` updates the database and calls `onSaved()`, which triggers `fetchData()` in Timeline.tsx. This refreshes the main entries arrays, but `sheetEntry` is a separate `useState` variable that was set when the sheet opened. It never gets updated with fresh data, so `entry.is_locked` (and therefore `isLocked` and the "Send to Planner" disabled state) remains stale until the sheet is closed and reopened.

## Solution

In Timeline.tsx's `onSaved` callback, after `fetchData()` completes, refresh `sheetEntry` from the newly fetched data so the sheet reflects the latest state.

### File: `src/pages/Timeline.tsx`

In the `onSaved` callback (line 1786), after `await fetchData()`, add logic to update `sheetEntry` if it's currently set:

```typescript
onSaved={async () => {
  await fetchData();

  // Refresh sheetEntry with latest data so lock state updates in the open sheet
  if (sheetEntry) {
    const freshEntries = /* reference to the latest scheduledEntries + ideaEntries */;
    const fresh = freshEntries.find(e => e.id === sheetEntry.id);
    if (fresh) {
      setSheetEntry(fresh);
      // Also refresh option if present
      if (sheetOption && fresh.options) {
        const freshOpt = fresh.options.find(o => o.id === sheetOption.id);
        if (freshOpt) setSheetOption(freshOpt);
      }
    }
  }

  // existing auto-extend logic...
}}
```

Because `fetchData` updates state asynchronously and we can't read the new state immediately, we have two approaches:

**Approach A (recommended)**: Make `fetchData` return the fetched data so `onSaved` can use it directly.

Currently `fetchData` sets state internally but doesn't return anything. We modify it to return the entries so the caller can use them:

1. In `fetchData`, add `return { scheduledEntries, ideaEntries }` at the end (returning the data before it's set into state).
2. In `onSaved`, capture the return value and use it to update `sheetEntry`.

```typescript
onSaved={async () => {
  const result = await fetchData();
  
  if (sheetEntry && result) {
    const allEntries = [...(result.scheduledEntries || []), ...(result.ideaEntries || [])];
    const fresh = allEntries.find(e => e.id === sheetEntry.id);
    if (fresh) {
      setSheetEntry(fresh);
      if (sheetOption && fresh.options) {
        const freshOpt = fresh.options.find(o => o.id === sheetOption.id);
        if (freshOpt) setSheetOption(freshOpt);
      }
    }
  }

  // existing auto-extend logic stays as-is
}}
```

**Approach B (simpler)**: Re-fetch just the single entry inside `onSaved` after the main `fetchData`:

```typescript
onSaved={async () => {
  await fetchData();
  
  if (sheetEntry) {
    const { data: freshEntry } = await supabase
      .from('entries')
      .select('*, entry_options(*)')
      .eq('id', sheetEntry.id)
      .single();
    if (freshEntry) {
      const mapped = mapEntryWithOptions(freshEntry);
      setSheetEntry(mapped);
      if (sheetOption && mapped.options) {
        const freshOpt = mapped.options.find(o => o.id === sheetOption.id);
        if (freshOpt) setSheetOption(freshOpt);
      }
    }
  }

  // existing auto-extend logic stays as-is
}}
```

I'll use whichever approach fits cleanest with the existing `fetchData` structure. The key outcome: after any save/toggle, the open sheet immediately reflects the latest DB state.

## Files Modified

| File | Change |
|------|--------|
| `src/pages/Timeline.tsx` | Update `onSaved` to refresh `sheetEntry` and `sheetOption` after `fetchData`; potentially modify `fetchData` to return data |

## What Does NOT Change
- EntrySheet.tsx (no changes needed -- it correctly reads from props)
- Lock toggle DB logic
- Timeline rendering
- Auto-extend logic (preserved as-is after the new refresh code)


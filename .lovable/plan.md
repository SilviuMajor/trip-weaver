

# Timeline Transport Fixes and Undo/Redo System

## Overview

Six fixes: attach transport to preceding event end, auto-pull next event, show From/To labels, remove confirmation step for mode switches, fix lingering gap buttons, and add Undo/Redo.

---

## Fix 1: Transport Attaches to Preceding Event End

### Root Cause
In `Timeline.tsx` line 410, `handleAddTransport` passes `entry.end_time` as `prefillTime`. But the "from" entry in gap detection could be a flight parent, while the actual end time should come from the checkout entry. Also, after transport creation in `EntrySheet.tsx`, the start time is derived from `prefillStartTime` via `utcToLocal` and `localToUTC` which may introduce rounding.

### Fix
**File: `src/pages/Timeline.tsx`** -- In `handleAddTransport`, ensure the prefill time uses the actual end time of the departing event (accounting for flight checkout entries):

```typescript
// If fromEntry is a flight with checkout, use checkout's end_time
const fromCheckout = entries.find(e => e.linked_flight_id === fromEntryId && e.linked_type === 'checkout');
const actualEndTime = fromCheckout?.end_time ?? fromEntry?.end_time ?? prefillTime;
```

Pass this as `prefillTime` instead.

**File: `src/components/timeline/EntrySheet.tsx`** -- In `handleSave` for transport with context (line 666-671), use `prefillStartTime` directly as the ISO start time instead of converting through `utcToLocal` then back through `localToUTC`:

```typescript
} else if (isTransfer && transportContext) {
  const blockDur = Math.ceil(durationMin / 5) * 5;
  startIso = prefillStartTime!; // Already ISO, no conversion needed
  endIso = new Date(new Date(startIso).getTime() + blockDur * 60000).toISOString();
}
```

**File: `src/pages/Timeline.tsx`** -- In `handleEntryTimeChange` (lines 440-465), when repositioning linked transports, also update the `to_entry_id` event: after repositioning transport, if the transport's new end time is after the "to" event's start time, push the "to" event forward.

---

## Fix 2: Transport Auto-Pulls Next Event

### Current State
`handleModeSwitchConfirm` (line 475) already pushes the next event if transport end overlaps it. But this doesn't happen on initial transport creation.

### Fix
**File: `src/components/timeline/EntrySheet.tsx`** -- After transport entry creation (around line 689), add logic to pull the next event forward to meet transport end:

```typescript
if (isTransfer && transportContext?.toEntryId) {
  const { data: nextEntry } = await supabase
    .from('entries')
    .select('id, start_time, end_time, is_locked')
    .eq('id', transportContext.toEntryId)
    .single();
  if (nextEntry && !nextEntry.is_locked) {
    const transportEnd = new Date(endIso);
    const nextStart = new Date(nextEntry.start_time);
    if (transportEnd.getTime() !== nextStart.getTime()) {
      const nextDuration = new Date(nextEntry.end_time).getTime() - nextStart.getTime();
      await supabase.from('entries').update({
        start_time: endIso,
        end_time: new Date(transportEnd.getTime() + nextDuration).toISOString(),
      }).eq('id', nextEntry.id);
    }
  }
}
```

**File: `src/pages/Timeline.tsx`** -- In `handleEntryTimeChange`, after repositioning transport, also pull the "to" event to meet the transport's new end time (same logic as above).

---

## Fix 3: Show From/To Labels

### Current State
`TransportConnector.tsx` line 70: `showLabels = height >= 100` (100px). At 80px/hour, 100px = 1.25 hours. The spec says show labels when connector is at least 2 hours of visual space.

### Fix
**File: `src/components/timeline/TransportConnector.tsx`** -- Change the threshold:

```typescript
const showLabels = height >= 160; // 2 hours at 80px/hour
```

Also verify that `fromLabel` and `toLabel` are actually being passed. In `CalendarDay.tsx` line 801-802, they come from `primaryOption.departure_location` and `primaryOption.arrival_location`. These should be populated from the transport context during creation (`transferFrom` and `transferTo` in EntrySheet). This already works -- the issue is likely just the height threshold being too low (currently only hidden when < 100px, but labels may not render because actual transport durations produce heights well under 100px). For a 23-min drive at 80px/hr, height = ~30px.

Since most transports are short (10-40 min), labels will rarely show even at 100px. The 2-hour threshold from the spec means labels only appear on very long transports (e.g., 2+ hour transit rides), which makes sense to avoid clutter.

---

## Fix 4: Remove Snap Preview, Apply Mode Switch Instantly

### Current State
`CalendarDay.tsx` uses `pendingModeSwitch` state with confirm/cancel buttons. `TransportConnector.tsx` shows confirm/cancel overlay.

### Fix
**File: `src/components/timeline/CalendarDay.tsx`** -- Remove `pendingModeSwitch` state entirely. Change the `onModeSelect` callback to call `onModeSwitchConfirm` directly:

```typescript
onModeSelect={async (mode, durationMin, distanceKm, polyline) => {
  if (onModeSwitchConfirm) {
    await onModeSwitchConfirm(entry.id, mode, durationMin, distanceKm, polyline);
  }
}}
```

Remove the `pendingMode`, `onConfirmSwitch`, `onCancelSwitch` props from the `TransportConnector` usage.

**File: `src/components/timeline/TransportConnector.tsx`** -- Remove `pendingMode`, `onConfirmSwitch`, `onCancelSwitch` props and the confirm/cancel overlay UI. Remove the `Check` and `X` icon imports. The `currentMode` should always be `detectCurrentMode()` (no pending override).

**File: `src/pages/Timeline.tsx`** -- `handleModeSwitchConfirm` already handles the push logic. Ensure it also pulls the next event to meet transport end when the new mode is shorter (not just pushes when longer):

```typescript
if (entry.to_entry_id) {
  const { data: nextEntry } = await supabase.from('entries')
    .select('id, start_time, end_time, is_locked')
    .eq('id', entry.to_entry_id).single();
  if (nextEntry && !nextEntry.is_locked) {
    const newTransportEnd = new Date(new Date(entry.start_time).getTime() + blockDur * 60000);
    const nextDuration = new Date(nextEntry.end_time).getTime() - new Date(nextEntry.start_time).getTime();
    await supabase.from('entries').update({
      start_time: newTransportEnd.toISOString(),
      end_time: new Date(newTransportEnd.getTime() + nextDuration).toISOString(),
    }).eq('id', nextEntry.id);
  }
}
```

---

## Fix 5: Remove Lingering Gap Buttons Around Transport

### Current State
Gap detection at line 413-418 already excludes `transfer` from `visibleEntries`. The `hasTransferBetween` check at line 457 catches transport by time position. But the `+ Add something` buttons still appear because the gap button logic at the entry card level (lines 931-955) shows `+` buttons on hover for every non-transport entry -- including entries adjacent to transport.

### Fix
The `+` buttons on individual cards (lines 931-955) are unrelated to gap detection -- they're hover-reveal insert buttons. These should also check if a transport connector already exists adjacent to the entry:

**File: `src/components/timeline/CalendarDay.tsx`** -- In the bottom `+` button (line 944), check if the next entry in sortedEntries is a transport:

```typescript
{onAddBetween && !isTransport && (() => {
  // Don't show bottom + if next entry is transport
  const nextIdx = sortedEntries.findIndex(e => e.id === entry.id) + 1;
  const nextE = sortedEntries[nextIdx];
  if (nextE?.options[0]?.category === 'transfer') return null;
  return (
    <button ...>
      <Plus className="h-3 w-3" />
    </button>
  );
})()}
```

Similarly for the top `+` button (line 931), check if the previous entry is a transport.

Also verify the `hasTransferBetween` function properly catches transport entries that have `from_entry_id`/`to_entry_id` set. Currently it checks by time position (line 260-267). Add a check by `from_entry_id`/`to_entry_id` as well:

```typescript
return sortedEntries.some(e => {
  const opt = e.options[0];
  if (!opt || opt.category !== 'transfer') return false;
  // Check by parent IDs
  if (e.from_entry_id === entryA.id && e.to_entry_id === entryB.id) return true;
  // Fallback: check by time position
  const eStart = new Date(e.start_time).getTime();
  return eStart >= aEnd && eStart <= bStart;
});
```

---

## Fix 6: Undo/Redo System

### Architecture
Create a client-side action history stack that records timeline modifications. Each action stores enough data to reverse and re-apply.

### New file: `src/hooks/useUndoRedo.ts`

A custom hook managing:
- `past`: array of completed actions (for undo)
- `future`: array of undone actions (for redo)
- `pushAction(action)`: records a new action, clears future
- `undo()`: pops last action from past, reverses it, pushes to future
- `redo()`: pops last action from future, re-applies it, pushes to past

Action shape:
```typescript
interface UndoAction {
  description: string;
  undo: () => Promise<void>; // Reversal function
  redo: () => Promise<void>; // Re-apply function
}
```

The hook also:
- Registers `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` keyboard shortcuts
- Returns `{ canUndo, canRedo, undo, redo, pushAction }`

### New file: `src/components/timeline/UndoRedoButtons.tsx`

Floating pill in bottom-right corner with two small icon buttons (Undo / Redo arrows). Grey out when nothing to undo/redo. Uses `fixed bottom-4 right-4 z-50` positioning.

### Integration in `src/pages/Timeline.tsx`

Wrap timeline modifications to record actions:

- `handleEntryTimeChange`: record old start/end, new start/end
- `handleModeSwitchConfirm`: record old mode/duration, new mode/duration
- Transport creation: record the created entry ID (undo = delete, redo = re-insert)
- Entry deletion: record the full entry data (undo = re-insert)

Each modification calls `pushAction` with the appropriate undo/redo closures. After undo/redo executes, call `fetchData()` to refresh.

Toast after each action: `toast.success('Undone: Move Lunch')` or `toast.success('Redone: Switch to Drive')`

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Timeline.tsx` | Fix transport start time in handleAddTransport; auto-pull next event after transport repositioning; instant mode switch (no confirm); integrate undo/redo |
| `src/components/timeline/EntrySheet.tsx` | Use prefillStartTime directly for transport ISO; auto-pull next event after creation |
| `src/components/timeline/TransportConnector.tsx` | Remove confirm/cancel UI; update label threshold to 160px |
| `src/components/timeline/CalendarDay.tsx` | Remove pendingModeSwitch state; instant mode select; hide + buttons adjacent to transport |
| `src/hooks/useUndoRedo.ts` | **New** -- undo/redo action history hook with keyboard shortcuts |
| `src/components/timeline/UndoRedoButtons.tsx` | **New** -- floating undo/redo button UI |

## What Is NOT Changed

- Transport calculation logic / API calls
- Event card styling
- Flight card behavior
- Refresh button behavior
- Hotel card behavior


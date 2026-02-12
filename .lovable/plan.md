

# Tiered SNAP System: Auto-Snap, SNAP + Add Something, Positioned SNAP

## Overview

Replace the single SNAP button with a three-tier system based on gap duration between a transport connector's end and its destination event.

## Changes

### File: `src/pages/Timeline.tsx` — Auto-snap after drag (Tier 1)

In `handleEntryTimeChange` (line 585), after transport entries are repositioned (line 637), add auto-snap logic for the transport's `to_entry_id`:

```typescript
// After repositioning transport (line 637), check gap to destination
if (transport.to_entry_id) {
  const { data: destEntry } = await supabase
    .from('entries')
    .select('id, start_time, end_time, is_locked')
    .eq('id', transport.to_entry_id)
    .single();

  if (destEntry && !destEntry.is_locked) {
    const transportNewEndMs = new Date(newTransportEnd).getTime();
    const destStartMs = new Date(destEntry.start_time).getTime();
    const gapMs = destStartMs - transportNewEndMs;
    const gapMin = gapMs / 60000;

    if (gapMin > 0 && gapMin < 30) {
      // Tier 1: auto-snap
      const destDuration = new Date(destEntry.end_time).getTime() - destStartMs;
      await supabase.from('entries').update({
        start_time: newTransportEnd,
        end_time: new Date(transportNewEndMs + destDuration).toISOString(),
      }).eq('id', destEntry.id);

      // Toast with undo (store original times for undo)
      // Push undo action for the snap
    }
  }
}
```

Also show a toast: `"Snapped [event name]"` with an Undo action that restores the destination event's original times. The undo action will be appended to the existing `pushAction` call.

### File: `src/components/timeline/CalendarDay.tsx` — Tiered SNAP rendering

Replace the existing SNAP button block (lines 1031-1141) with tiered rendering:

**Tier 1 (gap < 30 min):** No button rendered. Auto-snap is handled by `handleEntryTimeChange` in Timeline.tsx. If the destination is locked, fall through to Tier 2 (show SNAP button with locked warning).

**Tier 2 (gap 30-90 min):** Render both SNAP and "Add Something" stacked in the gap:

```typescript
if (gapMs > 0 && gapMin < 30 && !nextVisible.is_locked) {
  // Tier 1: auto-snap handled server-side, no button
  return null;
}

if (gapMs <= 0) return null;

const gapMin = gapMs / 60000;

// SNAP button position
const snapTopOffset = gapMin <= 90
  ? height + 2  // Tier 2: right below transport
  : height + (15 / 60) * PIXELS_PER_HOUR; // Tier 3: 15 min visual space below

// Add Something button position
const addBtnTopOffset = gapMin <= 90
  ? height + 24 // Tier 2: just below SNAP
  : height + (15 / 60) * PIXELS_PER_HOUR + 24; // Tier 3: below SNAP

return (
  <>
    <button onClick={handleSnapNext}
      className="absolute z-20 left-1/2 -translate-x-1/2 rounded-full bg-green-100 ..."
      style={{ top: snapTopOffset }}>
      SNAP
    </button>
    {onAddBetween && (
      <button onClick={(e) => {
        e.stopPropagation();
        onAddBetween(entry.end_time);
      }}
        className="absolute z-20 left-1/2 -translate-x-1/2 ..."
        style={{ top: addBtnTopOffset }}>
        <Plus /> + Add something
      </button>
    )}
  </>
);
```

**Tier 3 (gap > 90 min):** Same as Tier 2 but SNAP is positioned ~15 visual-minutes below the transport end (close to the connector), and "Add Something" sits in the remaining gap space.

**Locked destination + gap < 30 min:** Show SNAP button (Tier 2 style) instead of auto-snapping. Existing locked-event toast behavior preserved.

### Gap button deduplication (lines 476-514)

The existing gap button logic at line 491 already renders an "Add Something" button for gaps after transport connectors. This will conflict with the new SNAP-area "Add Something" button.

Fix: In the `hasTransferBetween` block (line 477), when a transfer exists and there is a remaining gap, return `null` (no gap button). The SNAP block on the transport card itself now handles rendering both SNAP and "Add Something" for that gap.

```typescript
if (hasTransferBetween(entry, nextEntry)) {
  return null; // SNAP block on transport card handles this gap
}
```

### Summary of rendering rules

| Gap Duration | Locked? | Renders |
|---|---|---|
| < 30 min | No | Nothing (auto-snapped by Timeline.tsx) |
| < 30 min | Yes | SNAP button (with locked toast on tap) |
| 30-90 min | Any | SNAP + Add Something (stacked below transport) |
| > 90 min | Any | SNAP (15 min below transport) + Add Something (in remaining gap) |

## Files Changed

| File | Changes |
|------|---------|
| `src/pages/Timeline.tsx` | Add auto-snap logic in `handleEntryTimeChange` for gaps < 30 min after transport repositioning; toast with undo |
| `src/components/timeline/CalendarDay.tsx` | Replace single SNAP button with tiered system; remove duplicate gap button for transport gaps |

## What is NOT changed

- SNAP pull mechanics (`handleSnapNext` function)
- Transport connector rendering (TransportConnector component)
- Locked event handling (existing toast behavior)
- Gap detection for non-transport gaps (the `isTransportGap` / Transport button logic)
- Transport generation auto-snap (line 533 in Timeline.tsx -- already works)

## Test cases covered

1. Drag creating 20 min gap after transport -- auto-snaps, toast "Snapped [name]" with Undo
2. Drag creating 45 min gap -- SNAP + Add Something both visible
3. Drag creating 2 hr gap -- SNAP near transport, Add Something in remaining space
4. Locked destination + 20 min gap -- no auto-snap, SNAP button shown (locked warning on tap)
5. Gap with no transport connector -- normal Transport/Add Something buttons unchanged


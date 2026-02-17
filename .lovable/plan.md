

# Prompt 5: Transport Auto-Recalculate on Move + Prompt 6: Transport Overlay

## Overview
Two changes: (1) When cards move, auto-recalculate adjacent transport connectors and auto-delete transports when cards move far apart. (2) Create a lightweight transport overlay sheet for mode switching, replacing the full EntrySheet when tapping the cog on a connector.

---

## Prompt 5: Transport Auto-Recalculate on Move

### Timeline.tsx -- Replace transport reposition logic in `handleEntryTimeChange` (lines 1116-1147)

Replace the current "Auto-reposition linked transport entries" try/catch block with enhanced logic that:

1. **Queries linked transports** (same as now) via `from_entry_id` or `to_entry_id` matching `entryId`
2. **For each linked transport**: calculates the gap between from-entry end and to-entry start
   - If gap > 90 minutes: **delete** the transport entry (options + entry)
   - Otherwise: **reposition** transport to start at from-entry's end time, preserving duration (same as current behavior)
3. **After repositioning**: checks for newly-adjacent cards (within 0-30 min gap) that don't have transport, and calls `handleSnapRelease` to auto-create transport

### Timeline.tsx -- Clean up orphaned transports on card deletion

There are two deletion sites:
- **Bin drop** (line 2489): `supabase.from('entries').delete().eq('id', entryId)`
- **EntrySheet delete** (line 2979): same pattern

Both need to be wrapped to first clean up transport entries referencing the deleted entry. Add a shared helper:

```typescript
const cleanupTransportsForEntry = async (deletedEntryId: string) => {
  const { data: orphaned } = await supabase
    .from('entries')
    .select('id')
    .or(`from_entry_id.eq.${deletedEntryId},to_entry_id.eq.${deletedEntryId}`);
  if (orphaned) {
    for (const t of orphaned) {
      await supabase.from('entry_options').delete().eq('entry_id', t.id);
      await supabase.from('entries').delete().eq('id', t.id);
    }
  }
};
```

Call this before deleting the entry itself at both deletion sites.

### Timeline.tsx -- Smart transport cleanup in handleSnapRelease

Before creating a new transport in `handleSnapRelease` (line 754), check for and delete any existing transport FROM the fromEntry to a different card, and any transport TO the toEntry from a different card. This handles the "insert between" case where old A-to-C transport needs to be replaced by A-to-B and B-to-C.

---

## Prompt 6: Lightweight Transport Overlay

### Create `src/components/timeline/TransportOverlay.tsx`

A bottom sheet (using the existing Sheet component) with:
- Header showing "Transport" title + from/to addresses
- 4 mode option cards: Walk, Transit, Drive, Cycle
- Current mode highlighted with colored background + border
- Each shows duration + distance from the `allModes` array
- Unavailable modes greyed out
- Tap a different mode: spinner, calls `onModeSwitchConfirm`, closes sheet

### Timeline.tsx -- Add overlay state and handler

- `transportOverlayOpen` + `transportOverlayData` state
- `handleTransportCogTap(transportEntryId)` callback that reads entry data and opens the overlay
- Render `<TransportOverlay>` in JSX, wired to `handleModeSwitchConfirm`

### ContinuousTimeline.tsx -- Wire cog tap to new overlay

- Add `onTransportCogTap?: (transportEntryId: string) => void` prop
- In connector rendering (line 1295), change `onCogTap` to call `onTransportCogTap` instead of `onCardTap`
- Timeline.tsx passes `onTransportCogTap={handleTransportCogTap}` to ContinuousTimeline

---

## Files Modified

- `src/pages/Timeline.tsx` -- enhanced transport reposition logic, orphan cleanup helper, overlay state/handler, old transport cleanup in handleSnapRelease
- `src/components/timeline/ContinuousTimeline.tsx` -- add `onTransportCogTap` prop, wire cog tap
- `src/components/timeline/TransportOverlay.tsx` -- new file, lightweight mode-switching sheet




# Transport Visual Connector Redesign

## Overview

Replace the current transport "card" with a slim visual connector strip between events. Pre-fetch all 4 transport modes on creation. Support inline mode switching with ghost-card snap preview. Fix transport stretching and gap detection bugs.

---

## Database Change

### Add `transport_modes` JSONB column to `entry_options`

Store pre-fetched results for all 4 modes so the connector can display them instantly without network calls.

```sql
ALTER TABLE public.entry_options
  ADD COLUMN transport_modes jsonb DEFAULT NULL;
```

Shape: `[{ "mode": "walk", "duration_min": 52, "distance_km": 4.1, "polyline": "..." }, ...]`

This column is populated when transport is created and when the user taps Refresh.

---

## Part 1: Visual Connector Component

### New file: `src/components/timeline/TransportConnector.tsx`

A purpose-built inline component (NOT using EntryCard). Receives:

- `entry`: the transport entry (for start/end times, entry ID)
- `option`: the entry option (for transport_modes, departure/arrival locations, selected mode name)
- `height`: pixel height (proportional to duration, same as event cards)
- `isCompact` / `isMedium`: for responsive layout based on height
- `onModeSelect(mode: string)`: callback when user taps a mode icon
- `onRefresh()`: callback to re-fetch all modes
- `fromLabel` / `toLabel`: place names for From/To display (from transport's own `departure_location` / `arrival_location`, falling back to parent event names)

Layout:
- Subtle background: `bg-stone-100 dark:bg-stone-900/20` with no card shadow, no heavy borders
- Horizontal row of 4 mode buttons: Walk, Drive, Transit, Bike -- each showing emoji + duration (e.g. "12m")
- Selected mode: accent color (orange), bolder text, slightly larger icon
- Unselected modes: muted/dimmed but clearly tappable
- Below selected mode: distance label (e.g. "13.7km")
- From/To labels: only shown if `height >= 100px` to avoid clutter on thin connectors
- Refresh icon button (top-right corner)
- No lock icon, no drag handles, cursor: default (not grab)

### CalendarDay changes

In `CalendarDay.tsx`, where transport entries are currently rendered via `EntryCard`:
- Replace the `EntryCard` rendering for `isTransport` entries with `TransportConnector`
- Remove `onDragStart` / `onTouchDragStart` props (no dragging)
- Remove the lock icon for transport entries
- Remove the + buttons (insert before/after) for transport entries
- Keep the SNAP button logic below transport cards (it still makes sense)

---

## Part 2: Mode Switching with Snap Preview

### State management in `CalendarDay.tsx`

Add local state:
- `pendingModeSwitch`: `{ entryId: string, mode: string, newDurationMin: number } | null`

When the user taps a different mode icon on `TransportConnector`:

1. `onModeSelect` fires with the new mode
2. CalendarDay sets `pendingModeSwitch` state
3. The connector immediately visually highlights the new mode and resizes to the new duration's height
4. A ghost card preview appears: the next event (found via `to_entry_id`) renders as a translucent clone at its new position (pushed down to accommodate the new transport duration), with a small "Confirm" / "Cancel" button pair
5. On **confirm**: 
   - Update the transport entry's `end_time` based on the new duration (rounded up to 5-min increments)
   - Update `entry_options.name` to reflect the new mode (e.g. "Walk to Museum")
   - Update `entry_options.distance_km` and `entry_options.route_polyline`
   - Push the next event (and any downstream events if needed) to the new position
   - Clear `pendingModeSwitch`
6. On **cancel**: clear `pendingModeSwitch`, revert visual state

### Ghost card rendering

When `pendingModeSwitch` is active, render a second copy of the next event's card with:
- `opacity-40` and a dashed border
- Positioned at where it would move to (transport end + new duration)
- A small confirm/cancel button bar overlaid

---

## Part 3: Fix Transport Stretching Bug

### Root cause

In `handleEntryTimeChange` (Timeline.tsx, line 429), when a parent event is moved, the auto-recalculate logic re-fetches directions and updates the transport duration. But the current code uses `google-directions` to get a NEW duration, which may differ from the stored one, causing apparent "stretching."

### Fix

The auto-recalculate in `handleEntryTimeChange` should:

1. **Reposition only**: Set transport `start_time` = parent's new `end_time`, and `end_time` = `start_time + stored_duration`
2. **NOT re-fetch** from directions API on drag (that's what Refresh is for)
3. The stored duration comes from the transport entry's current `end_time - start_time`

Update `handleEntryTimeChange` (lines 440-500):
```typescript
// Instead of calling google-directions, just reposition:
const transportDurationMs = new Date(transport.end_time).getTime() - new Date(transport.start_time).getTime();
const newTransportStart = fromEntry.end_time; // parent's new end
const newTransportEnd = new Date(new Date(newTransportStart).getTime() + transportDurationMs).toISOString();
await supabase.from('entries').update({ start_time: newTransportStart, end_time: newTransportEnd }).eq('id', transport.id);
```

This also requires fetching the transport's current `start_time` and `end_time` in the query (add those to the select).

---

## Part 4: Fix Gap Detection

### Current state (already partially done)

The `visibleEntries` filter at line 407 already excludes `transfer` category. However, gap detection still doesn't account for the case where transport fills part of a gap but leaves a remaining gap.

### Enhancement

After filtering out transport entries, the gap calculation already works correctly because it only looks at gaps between non-transport events. If transport fills 10:00-10:12 between Event A (ends 10:00) and Event B (starts 10:30), the gap logic sees A ends at 10:00 and B starts at 10:30 = 30 min gap, and shows a button.

But per the spec: "If Transport exists between Event A and Event B, no button between them." We need to check `hasTransferBetween` in the gap button logic. This is already partially implemented at line 249. We need to ensure the gap button rendering at line 457 checks this:

```typescript
// Before rendering the gap button, check if a transfer already exists between these events
if (hasTransferBetween(entry, nextEntry)) return null;
```

Wait -- actually looking more carefully, `hasTransferBetween` checks for transfers by time position. But transport entries are already filtered out of `visibleEntries`. The issue is that gap buttons STILL appear because the gap logic doesn't call `hasTransferBetween`. We need to add this check.

Additionally, if there's a remaining gap AFTER the transport (transport ends at 12:15, next event at 13:30), we need to show the gap button in THAT remaining gap. This means:

- If transport exists between A and B, skip the A-to-B gap button
- But calculate a new gap: transport_end to B_start. If that gap is > 5 min, show a button there

This requires knowing the transport entry's end time within the gap calculation. We'll look up transport entries in sortedEntries by `from_entry_id` / `to_entry_id`.

---

## Files Changed

| File | Change |
|------|--------|
| **Database migration** | Add `transport_modes` JSONB column to `entry_options` |
| `src/components/timeline/TransportConnector.tsx` | **New file** -- slim connector strip component with inline mode icons, refresh, from/to labels |
| `src/components/timeline/CalendarDay.tsx` | Replace EntryCard rendering for transport with TransportConnector; add ghost card preview state; add `hasTransferBetween` check in gap button rendering; remove drag/lock UI for transport |
| `src/pages/Timeline.tsx` | Fix `handleEntryTimeChange` to reposition-only (not re-fetch) for transport; update transport creation to pre-fetch all 4 modes and store in `transport_modes`; add mode-switch confirm handler |
| `src/components/timeline/EntrySheet.tsx` | Update transport creation to call all 4 modes and save `transport_modes` JSONB |
| `src/types/trip.ts` | Add `transport_modes` to `EntryOption` interface |

## What Is NOT Changed

- Transport calculation logic / API calls (google-directions edge function)
- Event card styling
- Flight card behavior
- Hotel card behavior
- Drag/drop behavior for regular events



# Connector Cards: Transport Non-Draggable, Flights Always Locked, Gap Detection Fix

## Overview

Establish a clear distinction between "connector" cards (transport, flight) and regular event cards. Connectors have restricted drag behavior and are excluded from gap detection.

---

## Database Change

### Add parent link columns to `entries` table

Transport entries (category `'transfer'`) currently don't store which two events they connect. We need to add two nullable columns:

- `from_entry_id` (UUID, FK to entries.id, ON DELETE CASCADE)
- `to_entry_id` (UUID, FK to entries.id, ON DELETE CASCADE)

The CASCADE delete means: if either parent event is deleted, the transport entry is automatically deleted by the database. No application code needed for auto-delete.

Migration SQL:
```sql
ALTER TABLE public.entries
  ADD COLUMN from_entry_id uuid REFERENCES public.entries(id) ON DELETE CASCADE,
  ADD COLUMN to_entry_id uuid REFERENCES public.entries(id) ON DELETE CASCADE;
```

---

## Change 1: Transport Cards Become Non-Draggable Connectors

### 1a. Store parent IDs on transport creation

**File: `src/pages/Timeline.tsx`** -- In `handleAddTransport`, after creating the transport entry, update it with `from_entry_id` and `to_entry_id`. The `fromEntryId` and `toEntryId` are already passed as parameters.

Also update `EntrySheet.tsx` save logic: when saving a transport entry created via `transportContext`, write `from_entry_id` and `to_entry_id` from the transport context into the entry.

### 1b. Block drag on transport cards

**File: `src/components/timeline/CalendarDay.tsx`** -- At line 604 where `canDrag` is computed:

```typescript
// Current:
const canDrag = onEntryTimeChange && !isLocked;

// New:
const isTransport = primaryOption.category === 'transfer';
const isFlightCard = !!flightGroup;
const canDrag = onEntryTimeChange && !isLocked && !isTransport && !isFlightCard;
```

Transport cards remain tappable/clickable (the `onClick` handler on `EntryCard` is unaffected). Users can still open the card to edit duration, transport method, etc.

### 1c. Auto-recalculate transport when parent moves

**File: `src/pages/Timeline.tsx`** -- In `handleEntryTimeChange` (line 429), after the entry update succeeds and before `fetchData()`:

1. Query all transport entries where `from_entry_id = entryId` or `to_entry_id = entryId`
2. For each transport found:
   - Look up the "from" event's `end_time` (the new transport start)
   - Look up the "to" event's `start_time` (constraint for transport end)
   - Call the `google-directions` edge function to re-fetch travel duration between the two parent locations
   - Update the transport entry with the new `start_time`, `end_time`, and duration

This re-fetch uses the existing Google Directions edge function that's already in the codebase.

### 1d. Auto-delete transport when parent is deleted

This is handled automatically by the `ON DELETE CASCADE` foreign key constraint in the database. No application code changes needed.

---

## Change 2: Flight Cards Always Drag-Locked

### 2a. Block move-drag on flight cards

Already handled by the `canDrag` change above (`!isFlightCard`). Flight groups will never initiate a `'move'` drag.

### 2b. Allow edge-resize on flight groups

**File: `src/components/timeline/CalendarDay.tsx`** -- Currently, resize handles are rendered when `canDrag && !flightGroup` (lines 644, 790). We need to add flight-specific resize handles:

- **Top resize handle on flight group**: Adjusts check-in duration. When dragged, it resizes the check-in entry (if present). The `onMouseDown`/`onTouchStart` should target the check-in entry ID with `'resize-top'`.
- **Bottom resize handle on flight group**: Adjusts checkout duration. When dragged, it resizes the checkout entry (if present). Target the checkout entry ID with `'resize-bottom'`.

Add after the `FlightGroupCard` rendering (around line 706):

```typescript
{/* Flight group resize handles */}
{onEntryTimeChange && flightGroup?.checkin && (
  <div
    className="absolute left-0 right-0 top-0 z-20 h-2 cursor-ns-resize"
    onMouseDown={(e) => onMouseDown(e, flightGroup.checkin!.id, 'resize-top', groupStartHour, groupStartHour + ciDurationH, dragTz, dayDate)}
    onTouchStart={(e) => onTouchStart(e, flightGroup.checkin!.id, 'resize-top', groupStartHour, groupStartHour + ciDurationH, dragTz, dayDate)}
    onTouchMove={onTouchMove}
    onTouchEnd={onTouchEnd}
  />
)}
{onEntryTimeChange && flightGroup?.checkout && (
  <div
    className="absolute bottom-0 left-0 right-0 z-20 h-2 cursor-ns-resize"
    onMouseDown={(e) => onMouseDown(e, flightGroup.checkout!.id, 'resize-bottom', groupEndHour - coDurationH, groupEndHour, dragTz, dayDate)}
    onTouchStart={(e) => onTouchStart(e, flightGroup.checkout!.id, 'resize-bottom', groupEndHour - coDurationH, groupEndHour, dragTz, dayDate)}
    onTouchMove={onTouchMove}
    onTouchEnd={onTouchEnd}
  />
)}
```

### 2c. Lock icon always shown as locked on flights

**File: `src/components/timeline/CalendarDay.tsx`** -- In the flight group lock icon section (lines 708-722), the lock icon currently toggles. Change it so that for flights, it always shows the locked icon and clicking does nothing (or shows a toast "Flight position is fixed"):

```typescript
{isEditor && onToggleLock && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      if (flightGroup) {
        toast.info('Flight position is fixed — edit times inside the card');
      } else {
        onToggleLock(entry.id, !!isLocked);
      }
    }}
    className="absolute -top-2 -right-2 z-30 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background shadow-sm"
  >
    {(isLocked || flightGroup) ? (
      <Lock className="h-3 w-3 text-amber-500" />
    ) : (
      <LockOpen className="h-3 w-3 text-muted-foreground/50" />
    )}
  </button>
)}
```

### 2d. Flight locked attempt feedback

Update `handleLockedAttempt` or the flight drag start handler to show a specific toast for flights: "Flight position is fixed — edit times inside the card" instead of the generic "Cannot drag a locked event".

In the `onDragStart` for `FlightGroupCard` (lines 691-696), always show the flight-specific message:

```typescript
onDragStart={(e) => {
  e.stopPropagation();
  toast.info('Flight position is fixed — edit times inside the card');
}}
```

---

## Change 3: Gap Detection Ignores Connector Cards

### Current behavior

The gap detection (lines 407-410) filters `visibleEntries` by excluding `airport_processing` and linked flight entries:

```typescript
const visibleEntries = sortedEntries.filter(e => {
  const opt = e.options[0];
  return opt && opt.category !== 'airport_processing' && !e.linked_flight_id;
});
```

### Fix

Add transport (`'transfer'`) to the exclusion filter:

```typescript
const visibleEntries = sortedEntries.filter(e => {
  const opt = e.options[0];
  return opt
    && opt.category !== 'airport_processing'
    && opt.category !== 'transfer'
    && !e.linked_flight_id;
});
```

This means gap detection only looks at gaps between real event cards (activities, restaurants, hotels, etc.) and flight parent cards. Transport cards sitting between two events won't cause extra "Transport" or "Add something" buttons.

---

## Files Changed

| File | Change |
|------|--------|
| **Database migration** | Add `from_entry_id` and `to_entry_id` columns with CASCADE delete |
| `src/types/trip.ts` | Add `from_entry_id` and `to_entry_id` to `Entry` interface |
| `src/pages/Timeline.tsx` | Save parent IDs on transport creation; auto-recalculate transport on parent move |
| `src/components/timeline/CalendarDay.tsx` | Block drag on transport/flight; add flight resize handles; fix gap detection filter; always-locked icon for flights |
| `src/components/timeline/EntrySheet.tsx` | Pass `from_entry_id`/`to_entry_id` when saving transport entries |

## What Is NOT Changed

- Hotel cards -- fully draggable and resizable
- Regular event cards -- fully draggable and resizable
- Transport calculation logic itself (Google Directions edge function)
- Visual styling of any cards
- EntryCard click/tap behavior (transport cards remain tappable to edit)

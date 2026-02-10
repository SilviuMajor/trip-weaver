

# Flight Card & Codebase Bug Fixes

## Bugs Identified

### Bug 1: "+ Add something" button overlaps the Check-in section of the Flight Group Card

**Root cause (CalendarDay.tsx, lines 382-440):**
The gap detection filters out `airport_processing` and `linked_flight_id` entries, then computes gaps between `visibleEntries`. However, the flight entry's `start_time` is the flight departure (e.g. 09:15), while the FlightGroupCard visually starts at the **check-in start** (e.g. 06:30). The gap button is positioned between the previous event and the flight's `start_time`, but the card renders from `groupStartHour` (check-in start), causing the button to land on top of the check-in section.

**Fix:** In the gap calculation loop, when computing `bStartHour` for a flight entry that has linked check-in entries, use the check-in's `start_time` instead of the flight's `start_time`. This ensures the gap is measured to the actual visual top of the flight group card.

### Bug 2: Vertical dashed line passes through the Flight Group Card

**Root cause:** Same as Bug 1 -- the dashed line's bottom point (`gapBottomPx`) is computed from the flight's `start_time`, not the group's visual top (check-in start). And also, the line from the flight group bottom to the next event needs to use `groupEndHour` (checkout end) not `entry.end_time`.

**Fix:** Same adjustment as Bug 1 -- account for the flight group bounds when computing gap start/end positions. Also need to handle the gap AFTER the flight group: use the checkout's `end_time` instead of the flight's `end_time`.

### Bug 3: Lock icon still inside FlightGroupCard

**Root cause (FlightGroupCard.tsx, lines 193-208):** The lock icon was moved outside the card for regular `EntryCard` (CalendarDay.tsx lines 666-681), but `FlightGroupCard` still renders its own lock button internally. This is inconsistent.

**Fix:** Remove the lock button from `FlightGroupCard.tsx`. Add an external lock button in `CalendarDay.tsx` for flight group entries (same pattern as regular entries, at `-top-2 -right-2`).

---

## Implementation Plan

### File: `src/components/timeline/CalendarDay.tsx`

**Gap calculation fix (lines 382-440):**
- Before computing `bStartHour` for the next entry, check if it has a flight group with a linked check-in. If so, use the check-in's `start_time` for the gap endpoint.
- Before computing `aEndHour` for the current entry, check if it has a flight group with a linked checkout. If so, use the checkout's `end_time` for the gap start.
- This requires building the `flightGroupMap` earlier (currently built at line 445, after the gap section). Move the flight group computation above the gap buttons section, or precompute a lookup of flight-to-group-bounds.

**Lock icon for flight groups (around line 585-627):**
- After `FlightGroupCard` is rendered, add the same external lock button pattern used for regular entries (the `-top-2 -right-2` positioned button).

### File: `src/components/timeline/FlightGroupCard.tsx`

**Remove internal lock button (lines 193-208):**
- Delete the lock button JSX from inside the component.
- Remove `canEdit`, `onToggleLock`, and `isLocked` from props (lock is now handled externally).
- Remove `Lock`, `LockOpen` from lucide imports.
- Keep the `isLocked` border-dashed styling on the outer container (pass it as a prop or keep it).

Actually, we should keep `isLocked` for the border-dashed styling but remove `canEdit` and `onToggleLock`.

### Restructure order in CalendarDay.tsx

Move the flight group map computation (lines 443-461) to **before** the gap buttons section (line 382) so it's available for gap calculations.

---

## Detailed Changes

### CalendarDay.tsx -- move flight group map earlier

```text
// BEFORE the gap buttons section (~line 382), insert:
const flightGroupMap = new Map<...>();
const linkedEntryIds = new Set<string>();
// ... same logic currently at lines 448-461
```

Then remove the duplicate from line 443-461.

### CalendarDay.tsx -- fix gap calculation

In the gap loop (line 388), when computing endpoints:

```text
// For entry (current), check if it's a flight with checkout
const aGroup = flightGroupMap.get(entry.id);
const aEffectiveEndTime = aGroup?.checkout?.end_time ?? entry.end_time;
const aEndHour = getHourInTimezone(aEffectiveEndTime, aTzs.endTz);

// For nextEntry, check if it's a flight with checkin
const bGroup = flightGroupMap.get(nextEntry.id);
const bEffectiveStartTime = bGroup?.checkin?.start_time ?? nextEntry.start_time;
const bStartHour = getHourInTimezone(bEffectiveStartTime, bTzs.startTz);
```

Also need to resolve TZ correctly for the checkout/checkin entries (use arrival_tz for checkout end, departure_tz for checkin start).

### FlightGroupCard.tsx -- remove lock button

- Remove lines 193-208 (the lock button JSX)
- Remove `handleLockClick` function (lines 71-74)
- Keep `isLocked` prop for dashed border styling
- Remove `canEdit` and `onToggleLock` props

### CalendarDay.tsx -- add external lock for flight groups

After the `FlightGroupCard` render (around line 627), wrap in a pattern similar to line 629-682:

```text
<div className="relative h-full">
  <FlightGroupCard ... />
  {isEditor && onToggleLock && (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggleLock(entry.id, !!isLocked);
      }}
      className="absolute -top-2 -right-2 z-30 flex h-5 w-5 ..."
    >
      {isLocked ? <Lock /> : <LockOpen />}
    </button>
  )}
</div>
```

---

## File Summary

| File | Changes |
|------|---------|
| `src/components/timeline/CalendarDay.tsx` | Move flight group map before gap section; fix gap endpoints to use checkin/checkout bounds; add external lock button for flight groups |
| `src/components/timeline/FlightGroupCard.tsx` | Remove internal lock button; remove `canEdit` and `onToggleLock` props |

No database changes. No new files.


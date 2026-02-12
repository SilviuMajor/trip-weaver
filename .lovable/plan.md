
# Continuous Timeline Refactor

## Overview

Replace the per-day `CalendarDay` loop with a single `ContinuousTimeline` component that renders all trip days as one unbroken vertical column. The core change: every hour gets a "global hour" number (Day 2 09:00 = hour 33), and all positioning uses `globalHour * 80px`.

## Architecture

```text
BEFORE                              AFTER
Timeline.tsx                        Timeline.tsx
  |-- days.map(CalendarDay)           |-- ContinuousTimeline
       |-- TimeSlotGrid (0-24)             |-- Single grid (0 to N*24)
       |-- per-day entries                 |-- ALL entries globally
       |-- per-day gaps                    |-- ALL gaps globally
       |-- per-day weather                 |-- ALL weather globally
       |-- per-day drag (useDragResize)    |-- Single drag space
       |-- sticky day header               |-- Subtle midnight labels
```

## Files to Create

### `src/components/timeline/ContinuousTimeline.tsx` (NEW -- ~1100 lines)

This replaces the `days.map(CalendarDay)` loop. It receives all entries, weather, travel segments, timezone maps, and callbacks as props.

**Props**: Same data previously split across CalendarDay instances -- `days`, `entries` (all scheduled), `allEntries`, `weatherData`, `travelSegments`, `dayTimezoneMap`, `dayLocationMap`, `homeTimezone`, `formatTime`, all callbacks (`onCardTap`, `onEntryTimeChange`, `onAddBetween`, `onAddTransport`, `onGenerateTransport`, `onDragSlot`, `onClickSlot`, `onDropFromPanel`, `onModeSwitchConfirm`, `onDeleteTransport`, `onToggleLock`, `onVoteChange`), and user state (`userId`, `userVotes`, `votingLocked`, `isEditor`, `userLat`, `userLng`, `scrollContainerRef`).

**Key internal logic**:

1. **Global hour helper**: For any entry, compute `getGlobalHour(entry)`:
   - Find which day the entry falls on using `getDateInTimezone(entry.start_time, resolvedTz)`
   - Find that day's index in the `days` array
   - Return `dayIndex * 24 + getHourInTimezone(entry.start_time, resolvedTz)`
   - For flight end hours, use `startGlobalHour + utcDurationHours` (preserving UTC duration across TZ boundaries)

2. **Grid container**: Single `div` with `height = days.length * 24 * 80` pixels, with `className="relative ml-20"` and `marginRight: 24`.

3. **Hour lines**: Render hour lines for hours 0 to `totalDays * 24`. Each line at `globalHour * 80px`. Labels show `HH:00` format where `HH = globalHour % 24`.

4. **Midnight day markers**: At globalHour 0, 24, 48, etc., render a subtle label in the left gutter with day name + date (e.g., "Tue 24 Feb"). At globalHour 0, show "Trip Begins" badge. At the last day's end, show "Trip Ends" badge. Current day's midnight gets a "TODAY" badge. These are NOT sticky headers -- just inline visual markers.

5. **Entry positioning**: For each entry, compute `startGlobalHour` and `endGlobalHour`. Cross-midnight entries naturally span (e.g., start=22, end=26). Position: `top = startGlobalHour * 80`, `height = (endGlobalHour - startGlobalHour) * 80`.

6. **TZ resolution per entry**: Same logic as current CalendarDay -- use `dayTimezoneMap` keyed by the entry's date string. For flight days, resolve based on whether entry is before/after flight arrival boundary. Transport entries inherit TZ from their "from" entry.

7. **Flight group rendering**: Identical to CalendarDay -- build `flightGroupMap`, compute checkin/flight/checkout fractions, render `FlightGroupCard`. Resize handles on top (checkin) and bottom (checkout) edges.

8. **Gap detection (global)**: Sort ALL non-transport, non-flight-linked visible entries by `startGlobalHour`. Iterate consecutive pairs. Compute gap = `nextStartGlobalHour - currentEndGlobalHour`. If gap > 5 minutes and no transfer exists between them: render gap button. Gap <= 2 hours = Transport button. Gap > 2 hours = "+ Add Something" button.

9. **SNAP system**: Below transport cards, find next visible entry. Compute gap in global hours. Apply tiered logic:
   - Tier 1 (< 30 min, not locked): Auto-snap handled by Timeline.tsx on drag commit
   - Tier 2 (30-90 min): SNAP button + Add Something button centered in gap
   - Tier 3 (> 90 min): SNAP ~15 visual-min below transport end, Add Something in remaining space
   All positioning uses global hours.

10. **Transport connectors**: Render `TransportConnector` at their global hour positions. Transport spanning midnight renders as one continuous strip.

11. **Overlap/conflict detection**: Compare consecutive sorted entries' `endGlobalHour > nextStartGlobalHour`. Cross-midnight overlaps detected naturally. Red ring + AlertTriangle badge on conflicting cards.

12. **Lock icons**: Same as current -- positioned outside card to the right, vertically centered. No lock on flights or transport.

13. **Weather column**: Iterate all days, all hours. Position each badge at `(dayIndex * 24 + hour) * 80px`.

14. **Sunrise/sunset gradient**: Render per-day gradient segments positioned at their global hour offsets. Each segment is 24 hours * 80px tall, positioned at `dayIndex * 24 * 80px`. They appear continuous since there are no day dividers between them.

15. **TZ change badges**: At flight arrival boundaries, render TZ offset badge at the flight's global end hour position.

16. **Drag-to-create (TimeSlotGrid replacement)**: Inline the drag-to-create functionality directly, using global coordinates. Mouse/touch down records global hour, drag shows preview block, release converts to day + local time + UTC.

17. **Drop from Planner**: Single drop zone over the entire grid. Y position / 80 = global hour. Convert to day index + local hour + resolved TZ + UTC.

18. **useDragResize integration**: Pass `startHour: 0` (global), no `dayBoundaries`. The hook operates in a single coordinate space from 0 to `totalDays * 24`.

**Drag commit flow inside ContinuousTimeline**:
```
globalHour -> dayIndex = Math.floor(globalHour / 24)
           -> localHour = globalHour % 24
           -> dayDate = days[dayIndex]
           -> dateStr = format(dayDate, 'yyyy-MM-dd')
           -> timeStr from localHour
           -> resolve TZ from dayTimezoneMap for that date
           -> localToUTC(dateStr, timeStr, resolvedTz)
           -> duration preserved from original entry
```

## Files to Modify

### `src/hooks/useDragResize.ts`

- Remove `DayBoundary` interface and `dayBoundaries` prop
- Remove all cross-day boundary detection in `startDrag` and `handlePointerMove`
- Remove `targetDay` and `originDay` from `DragState`
- `startDrag`: Compute `grabOffsetHours` using a single `gridTopPx` value (passed via a new optional prop or computed from `scrollContainerRef`)
- `handlePointerMove`: Always use single coordinate space. Remove the `dayBoundaries` branch. Compute cursor's global hour from absolute Y position relative to the grid top. No 0-24 clamping -- clamp to 0 and `totalHours` instead.
- Add `totalHours` prop (replaces the implicit 24h range) and `gridTopPx` prop (pixel offset from scroll container top to grid start)
- `onCommit` signature stays the same but `targetDay` parameter becomes undefined (ContinuousTimeline derives day from global hour)
- Keep: grab offset, auto-scroll, snap-to-15min, touch hold logic

### `src/pages/Timeline.tsx`

- Remove: `dayBoundaries` state, `useEffect` that computes boundaries, `dayRefsMap`, `setDayRef`, `getEntriesForDay()`, `getWeatherForDay()`
- Remove: `import CalendarDay`
- Add: `import ContinuousTimeline`
- Replace the `days.map(CalendarDay)` block (lines 1552-1594) with `<ContinuousTimeline>` passing all data
- Update `handleDropOnTimeline` signature: instead of `(entryId, dayDate, hourOffset)`, accept `(entryId, globalHour)` and derive day + local hour internally
- Keep everything else: sheet, sidebar, FAB, undo/redo, all handlers, Planner panel, Live panel, header, tab bar

### `src/components/timeline/TimeSlotGrid.tsx`

- No changes needed. TimeSlotGrid is no longer used directly (its functionality is inlined into ContinuousTimeline for the global grid). CalendarDay still imports it but CalendarDay is no longer rendered.

### `src/components/timeline/CalendarDay.tsx`

- No changes. Kept in codebase for reference but no longer rendered in the main timeline.

## What Does NOT Change

- All card components: EntryCard, FlightGroupCard, TransportConnector, TravelSegmentCard
- Card styling, dark gradient, lock icons, notes
- EntrySheet (event detail/edit overlay)
- Planner panel, Live panel, header, tab bar, FAB
- Event creation flows
- Undo/redo system
- All database operations and edge functions
- 80px per hour scale
- Weather fetching logic
- Timezone resolution logic (resolveEntryTz, getHourInTimezone)
- handleEntryTimeChange, handleModeSwitchConfirm, handleDeleteTransport, handleToggleLock
- All toast messages and SNAP auto-snap in handleEntryTimeChange

## Technical Considerations

- **Performance**: A 7-day trip = 168 hours = 13,440px. A 14-day trip = 26,880px. Both well within DOM limits. No virtualization needed.
- **Scroll-to-today**: Find current day's midnight global hour, scroll to `globalHour * 80px` position.
- **Cross-midnight entries**: `endGlobalHour < startGlobalHour` is impossible in global coordinates (unlike per-day where we had `if (entryEndHour < entryStartHour) entryEndHour = 24`). This hack is eliminated.
- **Empty days**: Just show hour grid and weather -- no "No plans yet" placeholder since it's a continuous flow.
- **Auto-scroll during drag**: Same mechanism, just potentially taller container. The edge-zone detection works on viewport bounds, so it scales naturally.
- **dayTimezoneMap lookup**: Still keyed by date string (yyyy-MM-dd). Given a global hour, derive `dayIndex = Math.floor(globalHour / 24)`, then `dayDate = days[dayIndex]`, then `format(dayDate, 'yyyy-MM-dd')` to look up TZ info.

## Implementation Order

1. Create `ContinuousTimeline.tsx` with all rendering logic (entries, gaps, transport, weather, sun gradient, drag, drop)
2. Modify `useDragResize.ts` to remove day boundaries and work in global coordinate space
3. Modify `Timeline.tsx` to use ContinuousTimeline instead of CalendarDay loop, update drop handler
4. Test: continuous scroll, card positioning, drag across days, gap detection, SNAP, transport connectors, flights, conflicts, weather, lock icons, drop from planner, undo/redo



# Fix Flight Card Alignment and Add Full Flight Details to Overlay

## Problem Summary

1. **Flight card position doesn't match gutter times**: BA432 departs LHR at 05:45 GMT, arrives AMS at 08:15 CET. The card is positioned using `tripTimezone` (CET) for both start and end, so it sits at 06:45-08:15 CET on the grid. But the card label says "05:45 GMT" -- this doesn't line up with the gutter which shows CET before the flight.

2. **Overlay shows no flight details**: When tapping a flight card, the overlay only shows generic time/distance/website. No airports, terminals, timezones, or flight duration.

3. **Edit works but details aren't visible**: The Edit button does open the form with flight data pre-filled, but the overlay itself doesn't display flight-specific information.

---

## Fix 1: Flight Card Position and Gutter Alignment

The core issue is that the gutter timezone before a flight should be the **departure timezone** (not the trip timezone), and after landing it should be the **arrival timezone**. The 3-hour crossover should center on the flight midpoint.

### Changes in `Timeline.tsx` (dayTimezoneMap computation, ~lines 211-258)

Currently `currentTz` starts as `tripTimezone` and only changes after a flight day. The flight's `flightStartHour` uses `departure_tz` but `flightEndHour` uses `currentTz` (which may not match departure_tz).

**Fix**: Before the first flight on any day, set `currentTz` to the flight's departure timezone (the user is physically in the departure city). Then:
- `flightStartHour` = hour of departure in `departure_tz` (already correct)
- `flightEndHour` = hour of arrival in `arrival_tz` (change from `currentTz` to `arrival_tz`)

After the flight, `currentTz` switches to `arrival_tz` (already done).

This means if trip starts with a LHR departure, the gutter before the flight shows GMT (matching the "05:45 GMT" on the card). During the 3h crossover centered on the flight midpoint, both GMT and CET are shown. After landing, only CET is shown.

### Changes in `CalendarDay.tsx` (card positioning, ~lines 362-370)

Currently all entries use `getHourInTimezone(entry.start_time, tripTimezone)`. For flights:
- Position `startHour` using the departure timezone (so 05:45 GMT = position 5.75)
- Position `endHour` using the arrival timezone (so 08:15 CET = position 8.25)

For non-flight entries, use `activeTz` (the timezone active at that point in the day) instead of `tripTimezone`. This ensures all cards align with whatever the gutter is showing.

The `activeTz` for entries before a flight = departure_tz. For entries after a flight = arrival_tz.

### Changes in `TimeSlotGrid.tsx`

Update the overlap calculation: currently `overlapStart = flightStartHour - 1.5` and `overlapEnd = flightEndHour + 1.5`. Change to center on the flight midpoint:
- `flightMidpoint = (flightStartHour + flightEndHour) / 2`
- `overlapStart = flightMidpoint - 1.5`
- `overlapEnd = flightMidpoint + 1.5`

This ensures the dual-TZ zone is centered on the middle of the flight.

---

## Fix 2: Full Flight Details in Overlay

### Changes in `EntryOverlay.tsx`

Add a flight-specific section that shows:
- Departure airport + terminal + local time (in departure TZ)
- Arrow separator
- Arrival airport + terminal + local time (in arrival TZ)
- Flight duration (computed from UTC times)
- Timezone abbreviations (e.g., "GMT", "CET")

This section replaces the generic time display when the entry is a flight.

### Layout

```text
+------------------------------------------+
| [FLIGHT badge]                           |
| BA432                                    |
|                                          |
| LHR Terminal 5          AMS Schiphol     |
| 05:45 GMT       ->      08:15 CET       |
| Duration: 1h 30m                         |
|                                          |
| [Vote] [Images] [Map]                    |
| [Edit] [Lock] [Delete]                   |
+------------------------------------------+
```

### Technical Details

- Import `Plane` icon from lucide-react (already available in EntryCard)
- Detect flight by checking `option.category === 'flight'`
- Format times using `toLocaleTimeString` with the respective timezone
- Get TZ abbreviation using `Intl.DateTimeFormat` with `timeZoneName: 'short'`
- Compute duration: `(endUTC - startUTC) / 60000` minutes

---

## Fix 3: Accurate `activeTz` for Non-Flight Entries

Currently all non-flight entries are positioned using `tripTimezone`. After fix 1, the gutter may show a different timezone (e.g., GMT before a LHR departure). Non-flight entries on the same day need to use the correct timezone for positioning.

### Changes in `CalendarDay.tsx`

- Accept `activeTz` (already passed as a prop) and use it instead of `tripTimezone` for positioning non-flight entries
- For flight entries specifically, use departure_tz for start and arrival_tz for end

---

## Files to Change

| File | Changes |
|------|---------|
| `Timeline.tsx` | Update `dayTimezoneMap` to set `currentTz` to departure_tz before flights. Compute `flightEndHour` using `arrival_tz`. |
| `CalendarDay.tsx` | Use `activeTz` for non-flight entry positioning. Use departure_tz/arrival_tz for flight entries. |
| `TimeSlotGrid.tsx` | Center the 3h overlap on flight midpoint instead of flight edges. |
| `EntryOverlay.tsx` | Add flight-specific detail section showing airports, terminals, times in respective TZs, and duration. |




# Fix Flight Card Sizing + Timezone Gutter Redesign + Checkin Alignment

## The Problem

Flight cards currently calculate their visual height using the difference between **departure local time** and **arrival local time**. This produces incorrect results when crossing timezones:

- **Outbound (LHR to AMS)**: Real duration is 35 minutes, but the card spans 1h35m visually because Amsterdam is +1h ahead
- **Return (AMS to LHR)**: Real duration is 1h15m, but the card shows as only 15 minutes tall because London is 1h behind
- **Check-in/flight gap**: Check-in ends at 08:15 but flight departs at 09:15, leaving a 1h gap that shouldn't exist

## The Solution

Three coordinated changes:

### 1. Flight card height = actual elapsed UTC duration

Instead of calculating height from `departureLocalTime` to `arrivalLocalTime`, use the actual UTC duration for the flight portion. The card stays positioned at the departure local time but extends for the real elapsed duration.

**Before (return flight AMS to LHR):**
```text
Start: 19:35 CET (18:35 UTC)
End:   19:50 GMT (19:50 UTC)
Visual span: 15 minutes -- WRONG
```

**After:**
```text
Start: 19:35 CET (positioned at 19:35 on grid)
Duration: 1h15m (UTC difference)
Visual span: 1h15m -- CORRECT
Card bottom: 20:50 on the grid
```

### 2. Timezone change indicator on time gutter

Replace the current dual-column overlapping timezone labels with a cleaner approach:

- Before the flight: show origin timezone labels (e.g., "CET")
- At the flight's midpoint on the gutter: show a small badge like **"TZ -1h"** or **"TZ +1h"**
- After the flight: show destination timezone labels (e.g., "GMT")

This replaces the current confusing overlap where both timezones are shown side-by-side for 3 hours around the flight.

```text
17:00  |
18:00  |  [Check-in card]
19:00  |  [           ]
19:35  |  [Flight card ] -- positioned at departure local
       |  [  1h15m     ]
       |  [           ]
       |  --- TZ -1h ---    <-- badge at midpoint
20:50  |  [           ]     <-- card ends here (19:35 + 1h15m)
20:00  |                    <-- gutter now shows GMT
21:00  |
```

### 3. Auto-align check-in end to flight departure

When rendering the flight group card, if the check-in `end_time` doesn't match the flight `start_time`, the visual fractions are computed to align them. Additionally, when flights are created or viewed, the check-in entry's `end_time` should always equal the flight's `start_time`, and `start_time` should equal `flight_start - checkin_hours`.

---

## File Changes

| File | Changes |
|------|---------|
| `src/components/timeline/CalendarDay.tsx` | Fix flight card height calculation to use UTC duration; fix group bounds; auto-align checkin times in visual computation |
| `src/components/timeline/TimeSlotGrid.tsx` | Replace dual-column overlap with single-column labels + TZ change badge at flight midpoint |
| `src/components/timeline/FlightGroupCard.tsx` | Update duration display to always use UTC elapsed time |
| `src/pages/Timeline.tsx` | Update `flightEndHour` in `dayTimezoneMap` to use UTC-based positioning instead of arrival local time |

---

## Technical Details

### CalendarDay.tsx -- Flight height fix (lines 524-554)

The key change is in how `entryEndHour` is computed for flights:

```typescript
// BEFORE (broken):
entryStartHour = getHourInTimezone(entry.start_time, primaryOption.departure_tz!);
entryEndHour = getHourInTimezone(entry.end_time, primaryOption.arrival_tz!);
// Return AMS->LHR: 19.583 to 19.833 = 0.25h (15min) -- WRONG

// AFTER (correct):
entryStartHour = getHourInTimezone(entry.start_time, primaryOption.departure_tz!);
const utcDurationHours = (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / 3600000;
entryEndHour = entryStartHour + utcDurationHours;
// Return AMS->LHR: 19.583 + 1.25 = 20.833 (1h15m) -- CORRECT
```

Same fix applies to the flight group bounds (checkin start, flight, checkout end):
- Checkin: positioned at checkin start in departure TZ, height = UTC duration of checkin
- Flight: positioned at flight start in departure TZ, height = UTC duration of flight
- Checkout: positioned at flight card bottom, height = UTC duration of checkout
- Group total height = sum of all three UTC durations

### CalendarDay.tsx -- Checkin alignment

When computing the flight group, force checkin end to match flight start:

```typescript
if (flightGroup.checkin) {
  // Checkin duration in hours (from UTC)
  const ciDurationH = (new Date(flightGroup.checkin.end_time).getTime() - 
                        new Date(flightGroup.checkin.start_time).getTime()) / 3600000;
  // Checkin ends at flight departure, starts ciDurationH before
  groupStartHour = entryStartHour - ciDurationH;
}
if (flightGroup.checkout) {
  const coDurationH = (new Date(flightGroup.checkout.end_time).getTime() - 
                        new Date(flightGroup.checkout.start_time).getTime()) / 3600000;
  // Checkout starts where flight ends visually
  groupEndHour = entryEndHour + coDurationH;
}
```

### TimeSlotGrid.tsx -- TZ change badge

Replace the current dual-column rendering with:

1. Before flight midpoint: single-column labels in origin timezone
2. At the flight midpoint: render a small horizontal badge spanning the gutter area saying "TZ +Xh" or "TZ -Xh"
3. After flight midpoint: single-column labels in destination timezone

The badge replaces the current 3-hour overlap gradient zone. It's a cleaner visual that tells the user exactly what changed.

```typescript
// At the flight midpoint hour:
<div className="absolute left-0 right-0 z-[16] flex items-center justify-center"
     style={{ top: midpointPx }}>
  <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 
                   text-[9px] font-bold text-primary whitespace-nowrap">
    TZ {offsetHours > 0 ? '+' : ''}{offsetHours}h
  </span>
</div>
```

### FlightGroupCard.tsx -- Duration display

The `formatDuration` function already uses UTC elapsed time (line 37-44), so the duration text on the card (e.g., "1h 15m") is already correct. No change needed there.

### Timeline.tsx -- dayTimezoneMap fix

The `flightEndHour` in the timezone map should use UTC-duration-based positioning (departure local + UTC duration) instead of `getHour(f.end_time, opt.arrival_tz)`:

```typescript
const depHour = getHour(f.start_time, opt.departure_tz!);
const utcDurH = (new Date(f.end_time).getTime() - new Date(f.start_time).getTime()) / 3600000;
return {
  originTz: opt.departure_tz!,
  destinationTz: opt.arrival_tz!,
  flightStartHour: depHour,
  flightEndHour: depHour + utcDurH,  // position-based, not local arrival time
  flightEndUtc: f.end_time,
};
```

### Layout + overlap calculations

The `computeOverlapLayout` and `overlapMap` also need the same fix -- anywhere `getHourInTimezone(entry.end_time, endTz)` is used for a flight, it should instead be `startHourInDepTz + utcDurationHours`. This ensures overlap detection works correctly for cross-timezone flights.

### Entries after the flight

Non-flight entries after the flight continue to use the destination timezone for positioning. The `resolveEntryTz` function already handles this via `flightEndUtc` comparison, but `flightEndHour` (used for the gutter transition) now correctly represents where the flight card visually ends on the grid.


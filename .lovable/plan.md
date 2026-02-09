

# Fix: Locks, Full Day, Layout Order, and Flight Alignment

## 1. Lock Symbols -- Top Right, Consistent Size

Currently locks are positioned `absolute bottom-1.5 right-1.5` with `h-3.5 w-3.5`. In compact mode they use `h-2.5 w-2.5`.

**Fix**: Move all lock buttons to `top-1.5 right-1.5` and standardize icon size to `h-3.5 w-3.5` for both compact and regular cards.

### Changes
- **`EntryCard.tsx`** line 305: Change `bottom-1.5` to `top-1.5`
- **`EntryCard.tsx`** lines 148-150 (compact mode): Change `h-2.5 w-2.5` to `h-3.5 w-3.5`

## 2. Show Full Day (All 24 Hours)

Currently the visible hour range is computed from entries with a 1-hour buffer (lines 104-116 of `CalendarDay.tsx`). This means if you only have entries from 8-10, you only see 7-11.

**Fix**: Always show 00:00 through 23:00 (full day). Set `startHour = 0` and `endHour = 24` regardless of entries.

### Changes
- **`CalendarDay.tsx`** lines 104-116: Replace the dynamic calculation with fixed `startHour = 0; endHour = 24;`

## 3. Correct Layout Order: Weather, Times, Gradient Line

Current positions (from left, using negative offsets from the card container):
- Gradient line: `left: -52` (5px wide)
- Weather column: `left: -48` (44px wide)
- Time labels: `left: -56` (single-TZ) / `left: -80` (dual-TZ)

These overlap and are in the wrong order. The correct order from far-left should be:

```text
[WEATHER] [TIMES] [GRADIENT LINE] | [CARDS]
```

With `ml-20` (80px) for dual-TZ and `ml-14` (56px) for single-TZ, we need to lay these out within that margin space.

### Single-TZ layout (56px margin):
- Weather: `left: -56` (leftmost, ~20px wide for emoji+temp)
- Times: `left: -36` (time label "08:00" ~30px)
- Gradient: `left: -6` (5px wide, right next to cards)

### Dual-TZ layout (80px margin):
- Weather: `left: -80`
- Times: `left: -58` (dual times need ~52px)
- Gradient: `left: -6`

### Changes
- **`CalendarDay.tsx`** lines 548-560: Move weather column to `left: -80` (dual) or `left: -56` (single). Pass `dayFlights.length > 0` to determine offset.
- **`CalendarDay.tsx`** lines 540-544: Move gradient line to `left: -6` (just left of cards).
- **`TimeSlotGrid.tsx`** line 269: Change dual-TZ label position from `left: -80` to `left: -58`.
- **`TimeSlotGrid.tsx`** line 291: Change single-TZ label position from `left: -56` to `left: -36`.

## 4. Flight Card Time Accuracy

The flight card displays times using `formatTimeInTz()` which correctly shows departure in departure_tz and arrival in arrival_tz (e.g., "LHR 08:15 GMT -> AMS 10:46 CET"). This is accurate.

The card's physical position on the timeline uses `getHourInTimezone(entry.start_time, tripTimezone)` and `getHourInTimezone(entry.end_time, tripTimezone)`. Since `tripTimezone` is the base timezone (e.g., GMT), the card spans from 08:15 to 09:46 on the GMT timeline -- this reflects the actual elapsed duration correctly.

The `flightEndHour` in `Timeline.tsx` line 248 already uses `currentTz` (which matches `tripTimezone` for the departure day), so the dual-TZ gutter transition should align with the card.

**Remaining issue**: If the gutter shows "10:00" in the destination column at the 10:00 GMT position, but the flight card ends at 09:46 GMT, the "10:46 CET" arrival label on the card doesn't visually align with any gutter mark. This is inherent to the dual-TZ display -- the destination time column shows what time it is in the destination at each physical position, so 09:46 GMT = 10:46 CET, and the gutter should show "10:46" at that position.

Let me verify: at position 09:46 GMT (physical position), the destination column should display "10:46" (CET = GMT+1). The current `destHour = hour + tzOffset` logic in `TimeSlotGrid.tsx` (line 258) does this correctly for whole hours. The flight card bottom edge at 09:46 should fall between the 09:00 and 10:00 gutter lines, and both gutter columns should show the correct times at those marks.

No additional code changes needed for flight accuracy -- the current implementation is correct. The visual "mismatch" is simply that the card ends between two hourly marks.

---

## Technical Summary

| File | Changes |
|------|---------|
| `EntryCard.tsx` | Move lock from `bottom-1.5` to `top-1.5`. Standardize compact lock icons to `h-3.5 w-3.5`. |
| `CalendarDay.tsx` | Set `startHour=0, endHour=24`. Reposition weather to far left, gradient line next to cards. |
| `TimeSlotGrid.tsx` | Adjust time label left offsets to sit between weather and gradient. |


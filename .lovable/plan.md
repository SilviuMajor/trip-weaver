

# Fix: Header Gap and Flight Card Proportional Sections

## Issue 1: Header Gap Has Gotten Worse

**Root cause**: The `ResizeObserver` uses `entry.contentRect.height` which only measures the **content area** -- it excludes padding and borders. The header has `py-3` (24px padding) and `border-b` (1px). The code adds `+ 1` for the border, but `contentRect` already excludes the 24px of padding.

**Fix**: Use `entry.borderBoxSize[0].blockSize` instead of `contentRect.height + 1`. This gives the full rendered height including padding and borders. Fallback to `headerRef.current.getBoundingClientRect().height` for browser compatibility.

### File: `src/pages/Timeline.tsx` (lines 82-89)

Change:
```text
const ro = new ResizeObserver(([entry]) => {
  setHeaderHeight(entry.contentRect.height + 1);
});
```
To:
```text
const ro = new ResizeObserver(([entry]) => {
  const h = entry.borderBoxSize?.[0]?.blockSize
    ?? headerRef.current?.getBoundingClientRect().height
    ?? 53;
  setHeaderHeight(h);
});
```

---

## Issue 2: Flight Card Needs Clear 3-Part Layout

**Current state**: Check-in and checkout are tiny fixed-height bars (py-1.5 = ~28px). The flight section uses `flex-1` so it takes all remaining space. There are no clear visual separators and no flight duration shown.

**Fix**: Redesign `FlightGroupCard` to use proportional flex sections with clear dividers.

### File: `src/components/timeline/FlightGroupCard.tsx`

**New props**: Add `checkinFraction`, `flightFraction`, `checkoutFraction` (0-1 values representing proportion of total card height).

**Layout changes**:
- Root div: `flex flex-col h-full` (already is)
- Check-in section: `style={{ flex: checkinFraction }}` -- show time range (just HH:MM, no TZ abbr), airport code, terminal
- Solid divider line between check-in and flight section (2px, category color at 40% opacity)
- Flight section: `style={{ flex: flightFraction }}` -- badge, flight name, route with times, **flight duration** (e.g. "2h 30m")
- Solid divider line between flight and checkout section
- Checkout section: `style={{ flex: checkoutFraction }}` -- show time range, airport code, terminal

**Time formatting**: Remove TZ abbreviations from displayed times (user confirmed: "just times, no TZ labels"). Create a `formatTimeOnly` helper that returns just `HH:MM`.

**Flight duration**: Compute from `flightEntry.start_time` and `flightEntry.end_time`, display as "Xh Ym" next to the route line.

### File: `src/components/timeline/CalendarDay.tsx` (around line 523-545)

Compute fractions when rendering `FlightGroupCard`:
- `checkinDuration` = hours of check-in entry (using departure_tz)
- `flightDuration` = flight entry hours (departure_tz for start, arrival_tz for end)
- `checkoutDuration` = hours of checkout entry (using arrival_tz)
- `totalDuration` = groupEndHour - groupStartHour
- Pass `checkinFraction = checkinDuration / totalDuration`, etc.

---

## Summary

| File | Change |
|------|--------|
| `src/pages/Timeline.tsx` | Fix ResizeObserver to use `borderBoxSize` instead of `contentRect.height` |
| `src/components/timeline/FlightGroupCard.tsx` | Proportional 3-part layout with clear dividers, flight duration, no TZ abbreviations |
| `src/components/timeline/CalendarDay.tsx` | Compute and pass duration fractions to FlightGroupCard |


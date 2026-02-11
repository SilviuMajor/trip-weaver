

# Align Left Gutter: Weather Between Hours + Inline TZ Badge

## Current Layout Issues

The left gutter currently has three independently positioned elements that don't align well:
- Time labels at each hour line
- Weather badges floating between hours (offset inconsistently)
- TZ change badge floating at the flight midpoint, overlapping weather

## Proposed Layout

The left column layout, from left to right:
1. **TZ badge** (only at the hour where the timezone changes) -- sits far left
2. **Weather emoji + temp** -- centered vertically between two hour lines
3. **Time label** -- at each hour line (top-aligned as now)
4. **Sun gradient line** -- stays where it is (rightmost, next to the content)

```text
 Left gutter (between hours)         At hour line
 ┌──────────────────────────┐       ┌──────────┐
 │  [TZ +1h]  [emoji 18deg] │       │  09:00   │
 └──────────────────────────┘       └──────────┘
```

## Changes

### 1. Move TZ badge from `TimeSlotGrid.tsx` to `CalendarDay.tsx`

Currently the TZ badge is rendered in `TimeSlotGrid` at the flight midpoint. It needs to move to `CalendarDay.tsx` so it can be rendered inline with the weather badge at the specific hour where the timezone transition occurs.

- Remove the TZ badge rendering block from `TimeSlotGrid.tsx` (lines 218-234)
- Export the `getUtcOffsetHoursDiff` and `getTzAbbr` helper functions from `TimeSlotGrid.tsx` so `CalendarDay.tsx` can use them (or duplicate them since they're small)

### 2. Update weather rendering in `CalendarDay.tsx` (lines 954-967)

Modify the weather column to render each hourly row as a flex container that holds both the TZ badge (when applicable) and the weather badge inline:

- For each hour, determine if this is the "TZ change hour" (the hour at or after the flight arrival where the timezone switches)
- Render a horizontal flex row: `[TZ badge (if this hour)] [Weather badge]`
- Keep the vertical position the same: `top + PIXELS_PER_HOUR/2 - 6` (centered between hour lines)
- Adjust the container positioning: use `left: -80` with enough width to fit both elements
- Use `flex items-center gap-1` so TZ badge and weather sit snugly inline

### 3. Determine TZ change hour

Using the existing `flights` prop (already available in CalendarDay as `flightTzInfo`):
- The TZ change hour = `Math.ceil(flight.flightEndHour)` (the first full hour after the flight lands)
- Only show the TZ badge at this one hour slot
- Compute offset using the existing `getUtcOffsetHoursDiff` helper

### 4. Styling

- TZ badge: keep existing pill style (`rounded-full bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[9px]`) but slightly smaller to fit inline
- Weather badge: no changes to the component itself
- The flex row ensures they naturally align horizontally

## Files Changed

| File | Change |
|------|--------|
| `src/components/timeline/TimeSlotGrid.tsx` | Remove TZ badge rendering (lines 218-234), export helper functions |
| `src/components/timeline/CalendarDay.tsx` | Render TZ badge inline with weather badge at the transition hour |


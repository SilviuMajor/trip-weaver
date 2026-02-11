

# Fix TZ Badge Position + Improve Sizing

## Problem

1. The TZ badge currently appears at `Math.ceil(flightEndHour)` -- the hour after landing. It should appear **between** the last origin-timezone hour and the first destination-timezone hour (i.e., at the flight arrival boundary).
2. The TZ badge is rendered inline with the weather icon, which pushes weather out of alignment on that row.
3. The TZ badge is too small (`text-[8px]`) and hard to read.

## Solution

### 1. Position TZ badge at flight arrival boundary

Change from `Math.ceil(flightEndHour)` to `Math.floor(flightEndHour)` so the badge sits between hour N and hour N+1 where the timezone transition actually happens. For example, if the flight lands at 10:xx, the badge sits between 10:00 and 11:00.

### 2. Separate TZ badge from weather layout

Render the TZ badge as its own absolutely-positioned element (not inside the weather flex row). This way:
- Weather icons stay perfectly aligned at the same left offset every hour
- TZ badge sits to the left of the weather icon at the transition hour, independently positioned

### 3. Make TZ badge bigger and clearer

- Increase font size from `text-[8px]` to `text-[10px]`
- Add slightly more padding (`px-2 py-0.5`)
- Use stronger colors: `bg-primary/20 border-primary/30` instead of `/10` and `/20`
- Include "TZ" prefix for clarity: `TZ +1h`

## Technical Details

### File: `src/components/timeline/CalendarDay.tsx` (lines 954-988)

**Weather rendering** -- remove the TZ badge from inside the weather flex row. Weather goes back to simple absolute positioning without gap/flex concerns:

```text
<div style={{ top: top + PIXELS_PER_HOUR/2 - 6 }}>
  <WeatherBadge ... />
</div>
```

**TZ badge** -- render as a separate element before/outside the weather loop, positioned at `flightEndHour` boundary:

```text
{dayFlights?.length > 0 && (() => {
  const f = dayFlights[0];
  const tzHour = Math.floor(f.flightEndHour);
  const offset = getUtcOffsetHoursDiff(f.originTz, f.destinationTz);
  if (offset === 0) return null;
  const top = (tzHour - startHour) * PIXELS_PER_HOUR + PIXELS_PER_HOUR/2 - 8;
  return (
    <div className="absolute z-[6]" style={{ top, left: -120, width: 46 }}>
      <span className="rounded-full bg-primary/20 border border-primary/30
        px-2 py-0.5 text-[10px] font-bold text-primary whitespace-nowrap">
        TZ {offset > 0 ? '+' : ''}{offset}h
      </span>
    </div>
  );
})()}
```

The weather container reverts to its original narrower width since it no longer shares space with the TZ badge.

## Files Changed

| File | Change |
|------|--------|
| `src/components/timeline/CalendarDay.tsx` | Separate TZ badge from weather; reposition at flight arrival hour; increase badge size |


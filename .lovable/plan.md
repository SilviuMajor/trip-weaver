

# Adjust Weather + TZ Badge Positioning

## What's Changing

Two small positioning tweaks in `src/components/timeline/CalendarDay.tsx`:

### 1. Move weather icons closer to the gradient line (right)

The weather column container is currently at `left: -74`. Moving it to `left: -50` will place the weather emoji and temperature closer to the gradient/time labels, sitting neatly between the hour markers.

- Line 971: Change `left: -74` to `left: -50`

### 2. Add more separation between TZ badge and weather

The TZ badge is currently at `left: -120`, which puts it too close to the weather icon. Moving it to `left: -140` gives a clearer visual gap.

- Line 962: Change `left: -120` to `left: -140`

## Files Changed

| File | Change |
|------|--------|
| `src/components/timeline/CalendarDay.tsx` | Adjust `left` offset for weather column (-74 to -50) and TZ badge (-120 to -140) |


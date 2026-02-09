

# Dynamic Weather Column, Day Header Cleanup, Lock Visibility, and Sunset Removal

## 1. Remove Sunset/Time-of-Day Gradient from Entry Cards

The `EntryCard` currently applies a `timeOfDayGradient` as a subtle background layer on cards (line 101, then used at line 191). This will be removed entirely -- cards will keep only their category tint background. The import of `getTimeOfDayGradient` will be removed from `EntryCard.tsx`.

## 2. Dynamic Circular Weather Badges

### New design
Replace the current pill-shaped `WeatherBadge` with a **circular badge** that combines:
- **Time-of-day color**: Background color derived from `getTimeOfDayColor()` using the hour's time and trip coordinates. Nighttime hours get dark indigo/navy backgrounds with white icons/text; daytime gets warm/bright backgrounds.
- **Weather condition modifier**: The base time-of-day color is adjusted based on weather -- rain makes it cooler/bluer, clear skies keep it warm, clouds desaturate slightly.
- **Icon**: Lucide weather icon (same set as now) rendered at center-top.
- **Temperature**: Below the icon in bold text.
- **Text color**: Automatically switches to white when the background is dark (lightness below 40%), otherwise stays dark.

### New props for WeatherBadge
- `hour: number` -- the hour this badge represents
- `date: Date` -- the day (for sun position calculation)
- `latitude?: number` -- trip location lat (defaults to Amsterdam 52.37)
- `longitude?: number` -- trip location lng (defaults to Amsterdam 4.9)

### Visual specs
- Size: 36x36px circle (`w-9 h-9 rounded-full`)
- Icon: 14px, centered
- Temp: 10px bold text below icon
- Shadow: subtle `shadow-sm`
- Transition: smooth color changes between hours

### Weather condition color modifications
The base HSL from `getTimeOfDayColor` will be modified:
- **Rain/shower/drizzle**: Shift hue towards blue (+20), reduce lightness (-5%)
- **Thunder**: Shift hue towards purple, reduce lightness (-10%)
- **Snow**: Increase lightness (+10%), reduce saturation (-20%)
- **Fog**: Reduce saturation (-30%), increase lightness (+5%)
- **Clear/sun**: Keep as-is (the pure time-of-day color)
- **Cloudy**: Reduce saturation (-15%)

## 3. Day Header Redesign

### Current issue
The sticky TZ header in `TimeSlotGrid` at line 300 is overlapping and creating visual artifacts. The day header (Saturday 21 Feb) is left-aligned.

### New layout
Merge the timezone info into the day header bar:
- **Left side**: Timezone abbreviation(s) (e.g., "GMT+0" or "GMT+0 | CET+1")
- **Center**: Day name and date (e.g., "Saturday 21 Feb"), with TODAY badge if applicable
- **Right side**: Empty (clean)

This replaces the separate sticky TZ label inside `TimeSlotGrid`. The sticky TZ header code in `TimeSlotGrid.tsx` (lines 299-312) will be removed.

### Changes
- **`CalendarDay.tsx`** (lines 221-257): Restructure the day header `div` to use a 3-column layout. Left column shows TZ abbreviation(s) from `activeTz` and `dayFlights`. Center column shows the day/date (centered). The sticky behavior stays.
- **`TimeSlotGrid.tsx`**: Remove the sticky TZ header block (lines 299-312).

## 4. Fix Time Labels Behind Cards (z-index)

### Problem
From the screenshot, the hour labels ("06:00", "07:00", etc.) in the time gutter are rendering behind the entry cards. The hour labels are at `z-index` via the grid, but cards are at `z-10`.

### Fix
- The hour labels in `TimeSlotGrid` are inside `div` elements that just have `border-t`. The labels use `absolute -top-2.5 left-0` positioning. These need a higher z-index than the entry cards, or the entry cards need their left edge to not overlap the gutter labels.
- The simplest fix: ensure the gutter labels have `z-[15]` (above the cards' `z-10`), so the time text always shows on top. This matches the expectation that times are outside and always visible.

### Changes
- **`TimeSlotGrid.tsx`**: Add `z-[15]` to each hour label's container div.

## 5. Lock Toggle on All Cards

### Problem
From the screenshot, only the compact "Airport Checkout" entry shows a lock icon. The larger cards (Coach to the airport, Airport Check-in, BA432 flight) do not show locks.

### Root cause
In `EntryCard.tsx`, the lock button for normal (non-compact) cards is inside the `!isProcessing` block (line 279). This means:
1. Processing entries (check-in/checkout with `isProcessing` flag) skip the entire bottom row, so they never render the lock.
2. The lock button requires both `canEdit` AND `onToggleLock` to be truthy.

### Fix
- Move the lock button rendering outside the `!isProcessing` conditional, so it appears on ALL card types (normal, processing, flight).
- For processing cards, add a small absolute-positioned lock button in the bottom-right corner.
- Ensure `onToggleLock` is always passed from `CalendarDay` for every entry.

### Changes
- **`EntryCard.tsx`**: Add a lock button that renders in the bottom-right corner for all card types, outside the `!isProcessing` conditional. Use `absolute bottom-2 right-2` positioning so it works regardless of card content layout.

---

## Technical Details

### Files to edit

| File | Changes |
|------|---------|
| `src/components/timeline/WeatherBadge.tsx` | Complete redesign: circular badge, time-of-day background colors with weather modifiers, dark/light text auto-switching. New props for `hour`, `date`, `latitude`, `longitude`. |
| `src/components/timeline/EntryCard.tsx` | Remove `timeOfDayGradient` import and usage. Move lock button outside the `!isProcessing` block so it appears on all cards. |
| `src/components/timeline/CalendarDay.tsx` | Restructure day header to 3-column layout with TZ on left, date centered. Pass `date` and `hour` to each `WeatherBadge`. |
| `src/components/timeline/TimeSlotGrid.tsx` | Remove sticky TZ header (lines 299-312). Add `z-[15]` to hour label containers so they render above cards. |

### Weather badge color computation

```text
1. Get base HSL from getTimeOfDayColor(dateAtHour, lat, lng)
2. Parse the HSL string into {h, s, l}
3. Apply weather modifier to h, s, l
4. Determine text color: l < 40 ? white : dark
5. Render circle with background: hsl(h, s%, l%)
```

### Day header layout

```text
[TZ label]     [Day Date]     [          ]
 left           center          right
 "GMT+0"       "Saturday"       (empty)
               "21 Feb"
```

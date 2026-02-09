

# Simplified Weather Colors, Bolder Icons, Card Margin Fix, and Flight Block Clarity

## 1. Simplified Weather Badge Colors

Replace the current sun-position-based HSL calculation with a straightforward scheme:

| Condition | Background | Text |
|-----------|-----------|------|
| Night (21:00-05:59), clear | Dark navy `hsl(225, 40%, 18%)` | White |
| Night, cloudy/overcast | Dark grey `hsl(220, 15%, 22%)` | White |
| Night, rain/drizzle/thunder | Dark blue-grey `hsl(215, 25%, 16%)` | White |
| Day, clear/sunny | Warm yellow `hsl(45, 80%, 72%)` | Dark |
| Day, partly cloudy | Light blue `hsl(200, 50%, 70%)` | Dark |
| Day, overcast | Grey-blue `hsl(210, 20%, 55%)` | White |
| Day, rain/drizzle | Darker blue `hsl(210, 35%, 45%)` | White |
| Day, thunder | Dark blue-purple `hsl(230, 35%, 38%)` | White |
| Day, snow | Light grey-white `hsl(200, 15%, 82%)` | Dark |
| Day, fog | Muted grey `hsl(200, 10%, 68%)` | Dark |

This removes the `getTimeOfDayColor` import and the `parseHSL`/`applyWeatherModifier` functions entirely.

### Changes
- **`WeatherBadge.tsx`**: Replace all color logic with a single `getWeatherColor(condition, isNight)` function that returns `{ bg, text }` based on the table above. Remove `timeOfDayColor` import.

## 2. Bolder Weather Icons

Increase icon stroke width from 2.5 to 3, and slightly increase icon size from `h-3.5 w-3.5` to `h-4 w-4` for more visual impact.

### Changes
- **`WeatherBadge.tsx`**: Update `strokeWidth` to 3 and icon class to `h-4 w-4`.

## 3. Increase Card Left Margin (Fix Time Labels Behind Cards)

From the screenshot, the hour labels (05:00, 06:00, etc.) sit behind the left edge of entry cards. The current card container uses `ml-10` (non-flight days) or `ml-16` (flight days with dual TZ). We need to increase these margins so the time gutter has enough room and labels never overlap cards.

### Changes
- **`CalendarDay.tsx`** (line 310): Change `ml-10` to `ml-14` for single-TZ days, and `ml-16` to `ml-20` for dual-TZ (flight) days. This gives the gutter 56px or 80px of space respectively.

## 4. Flight Block Positioning Explanation

The flight block (e.g., BA432 LHR 08:15 GMT to AMS 10:46 CET) is positioned on the timeline using the trip's active timezone. Since the timeline gutter shows GMT, the block spans from 08:15 to 09:46 GMT (which equals 10:46 CET). This is correct behavior -- the card already shows both timezone-aware departure and arrival times ("LHR T5 08:15 GMT to AMS 10:46 CET"), so no changes needed here. The visual block length reflects the actual flight duration in the displayed timezone.

No code changes for this item.

---

## Technical Details

### Files to edit

| File | Changes |
|------|---------|
| `src/components/timeline/WeatherBadge.tsx` | Replace color logic with simple day/night + weather condition lookup. Remove `getTimeOfDayColor` import. Bolder icons (strokeWidth 3, h-4 w-4). |
| `src/components/timeline/CalendarDay.tsx` | Line 310: increase `ml-10` to `ml-14`, `ml-16` to `ml-20`. |

### New color function (WeatherBadge)

```text
function getWeatherColor(condition, isNight):
  if isNight:
    if rain/thunder/drizzle -> dark blue-grey, white text
    if cloud/overcast -> dark grey, white text
    else -> dark navy, white text
  else (day):
    if thunder -> dark blue-purple, white text
    if rain/drizzle -> darker blue, white text
    if overcast -> grey-blue, white text
    if cloud/partly -> light blue, dark text
    if snow -> light grey-white, dark text
    if fog -> muted grey, dark text
    else (clear/sunny) -> warm yellow, dark text
```

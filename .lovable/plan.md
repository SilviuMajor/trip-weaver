

# Weather Emojis, Left-side Weather, Add Idea Button, and Flight Card Alignment

## 1. Weather Badges: Emojis Instead of Lucide Icons

Replace the current circular Lucide icon badges with inline emoji + temperature text. No circle background needed.

### Emoji mapping

| Condition | Day Emoji | Night Emoji |
|-----------|-----------|-------------|
| Clear/sunny | ☀️ | 🌙 |
| Partly cloudy | ⛅ | ☁️ |
| Cloudy/overcast | ☁️ | ☁️ |
| Rain/shower | 🌧️ | 🌧️ |
| Drizzle | 🌦️ | 🌧️ |
| Thunder | ⛈️ | ⛈️ |
| Snow | 🌨️ | 🌨️ |
| Fog | 🌫️ | 🌫️ |
| Default | ☀️ | 🌙 |

### Visual output
Each hour shows: `☀️ 18°` as a compact inline element. The emoji provides the color naturally.

### Changes
- **`WeatherBadge.tsx`**: Remove all Lucide icon imports. Replace with a `getWeatherEmoji(condition, isNight)` function returning an emoji string. Remove the circular div wrapper, render as a simple `span` with emoji + temp. Remove the `getWeatherColor` function entirely since emojis provide their own visual identity.

## 2. Move Weather Column to Far Left

Currently the weather column sits at `right: -44` (right side of the timeline). Move it to the far left, before the time labels.

### Layout change

```text
Current:  [time labels] --- [cards] --- [weather]
New:      [weather] [time labels] --- [cards]
```

### Changes
- **`CalendarDay.tsx`** (lines 517-529): Move the weather column from `right: -44` to `left: -48` (or similar), positioning it to the left of the entry container. Since the container already has `ml-14` / `ml-20`, we have space to the left. The weather elements will be positioned absolutely at negative left offset.
- Adjust `marginRight: 48` on the container (line 311) since we no longer need right-side space for weather. Set it to a smaller value (e.g. 8px).

## 3. Add Idea Button in Ideas Panel

Add a button at the top of the Ideas sidebar that opens the entry form pre-configured as an unscheduled/idea entry.

### Changes
- **`IdeasPanel.tsx`**: Add a `+ Add Idea` button in the sticky header bar (line 66-81), next to the "Ideas" title. Wire it to a new `onAddIdea` callback prop.
- **`Timeline.tsx`**: Pass an `onAddIdea` handler to `IdeasPanel` that opens the `EntryForm` with `is_scheduled: false` pre-set. This means setting `prefillStartTime` to undefined and opening the form.
- **`EntryForm.tsx`**: May need a new prop like `prefillUnscheduled?: boolean` so the form knows to create the entry as an idea (not scheduled). Need to check if the form already supports this.

## 4. Flight Card Positioning Fix

### The problem
Flight cards are positioned on the timeline using `tripTimezone` for both start and end times. For a flight departing at 08:15 GMT arriving 10:46 CET:
- The card starts at 08:15 on the GMT timeline (correct)
- The card ends at 09:46 GMT (= 10:46 CET), so the card is ~1.5 hours tall (correct duration)
- But the dual-TZ gutter shows "10:46" in the destination column at the 10:46 position, which is BELOW the card's bottom edge
- This makes it look like the flight card doesn't reach its arrival time

### Proposed fix
The card position is actually correct (it represents real elapsed time). The confusion comes from the gutter showing destination times that don't visually align with the card edge. Two improvements:

1. **Add a small arrival time annotation at the bottom of the flight card**: Show a subtle label like "Arrives 10:46 CET" pinned to the bottom-right of the flight card, making it clear where the flight ends relative to the card.

2. **Adjust the `flightEndHour` in the TZ overlap calculation**: Currently `flightEndHour` uses `getHour(f.end_time, opt.arrival_tz!)` which gives 10:46. But the card actually ends at `getHour(f.end_time, tripTimezone)` = 09:46 GMT. The overlap zone should use the trip-timezone-based end hour so the dual-TZ gutter transition aligns with the card edge.

### Changes
- **`Timeline.tsx`** (lines 236-249): Change `flightEndHour` calculation to use `tripTimezone` (or `originTz`) instead of `arrival_tz` so the overlap zone aligns with the card's visual position.
- **`EntryCard.tsx`**: No changes needed -- the card already shows "LHR T5 08:15 GMT -> AMS 10:46 CET" which is clear.

---

## Technical Summary

| File | Changes |
|------|---------|
| `WeatherBadge.tsx` | Replace Lucide icons with emoji strings. Remove circular badge wrapper. Render as inline `emoji temp` text. |
| `CalendarDay.tsx` | Move weather column from right to far left. Reduce right margin. |
| `IdeasPanel.tsx` | Add `onAddIdea` prop and render "+ Add Idea" button in header. |
| `Timeline.tsx` | Pass `onAddIdea` handler to IdeasPanel. Fix `flightEndHour` to use `tripTimezone` instead of `arrival_tz`. |
| `EntryForm.tsx` | Check if it supports creating unscheduled entries; add `prefillUnscheduled` prop if needed. |


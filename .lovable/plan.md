

# Lock Toggle on Cards, Weather Column, and Timezone Gutter Improvements

## 1. Lock/Unlock Button on Entry Cards

### Behavior
- A small lock icon button appears in the **bottom-right corner** of every entry card.
- When the entry is locked: shows a filled/closed lock icon.
- When unlocked: shows an open lock icon (subtle/dimmed).
- Clicking the button toggles `is_locked` on the entry via a database update.
- **Only users with editor or organizer role** can toggle. For viewers, the button is **not rendered at all** (silent -- no tooltip or error).
- Uses the existing `isEditor` flag from `useCurrentUser`.

### Compact entries
- On compact (single-line) entries, the time label moves to the **left side** (after the emoji), and the lock icon sits alone on the **far right edge**.

### Changes
- **`EntryCard.tsx`**: Add `onToggleLock` and `canEdit` props. Render a lock button in the bottom-right (normal cards) or far-right (compact cards). On click, call `onToggleLock` (stop propagation to prevent card click).
- **`CalendarDay.tsx`**: Pass `onToggleLock` and `canEdit` props down to `EntryCard`. The handler calls a Supabase update to toggle `is_locked`.
- **`Timeline.tsx`**: Pass `isEditor` down to `CalendarDay`.

---

## 2. Weather Column (Dedicated Right Column)

### Current state
Weather badge is absolutely positioned inside the entry card container (`right-2 top-2` at line 413-417 of CalendarDay).

### New layout
- Add a dedicated column to the **right** of the entry cards area (approx 44px wide).
- This column shows weather badges at every hour where weather data is available, not just at entry positions.
- Weather badges are positioned at their corresponding hour offset (same vertical positioning as the time gutter on the left).
- This gives a full hourly weather strip alongside the timeline.

### Changes
- **`CalendarDay.tsx`**:
  - Remove the weather badge from inside the entry card wrapper (remove lines 413-417).
  - Add a new absolute-positioned weather column on the right side of the timeline container.
  - Render a `WeatherBadge` for each hour that has weather data, positioned vertically by hour offset.
  - Adjust the entry cards area to leave room on the right (e.g. `pr-12` or `right: 48px`).

---

## 3. Timezone Labels Outside Cards (Sticky Gutter Header)

### Clarification
The user is **not** asking to move event-specific times (like "09:00 -- 10:30") outside the card. They want the **timezone gutter labels** (the hourly time labels on the left side, and the TZ abbreviation) to be clearly outside and separate from the entry cards, with a sticky TZ indicator at the top.

### Current state
- `TimeSlotGrid` renders hour labels at `left-0` with `text-[10px]`. The TZ abbreviation labels are positioned at `-top-5`.
- Entry cards in `CalendarDay` use `ml-10` or `ml-16` to offset from the gutter, but the gutter labels live inside the same container.

### Changes
- **`TimeSlotGrid.tsx`**: Add a sticky header element at the top of the gutter that shows the timezone abbreviation(s) (e.g., "GMT+0" or "GMT+0 | CET+1"). This uses `position: sticky; top: ...` so it stays visible while scrolling through the day.
- **`CalendarDay.tsx`**: Ensure the sticky TZ label is positioned in the gutter area (the `ml-10`/`ml-16` gap) and persists while scrolling. Use `z-index` to keep it above entry cards.
- The sticky label format: e.g., "GMT+0" for single timezone, or "GMT+0 | CET+1" for dual timezone days.

---

## Technical Details

### Files to edit

| File | Changes |
|------|---------|
| `src/components/timeline/EntryCard.tsx` | Add lock toggle button (bottom-right for normal, far-right for compact). Add `onToggleLock` and `canEdit` props. Move time to left side in compact mode. |
| `src/components/timeline/CalendarDay.tsx` | Remove weather from inside card, add weather column on right side with hourly badges. Pass lock toggle handler and `canEdit` to `EntryCard`. Add sticky TZ header in gutter. |
| `src/components/timeline/TimeSlotGrid.tsx` | Add sticky TZ abbreviation header at top of gutter. |
| `src/pages/Timeline.tsx` | Pass `isEditor` to `CalendarDay`. |

### Lock toggle handler (in CalendarDay or Timeline)

```text
onToggleLock(entryId):
  1. Find entry by id
  2. Update entries table: set is_locked = !current_value
  3. Refetch entries (or optimistically update local state)
```

### Weather column layout

```text
Timeline container (relative):
  [Gutter: 40-64px] [Entry cards area] [Weather column: 44px]
  
  Weather column:
    For each hour from startHour to endHour:
      If weatherData exists for this date+hour:
        Position WeatherBadge at (hour - startHour) * pixelsPerHour
```

### Compact entry layout change

```text
Current compact:  [emoji] Name ........... [time range] [lock?]
New compact:      [emoji] Name [time range] ........... [lock icon]
                  ^-- time moves left, lock takes far right
```



# Trip Image/Emoji, Weather Between Hours, and Timezone Centering

## 1. Trip Image or Custom Emoji

Add an `emoji` (text, nullable) and `image_url` (text, nullable) column to the `trips` table. The image overrides the emoji, and the emoji overrides the default plane icon.

### Database
- Add migration: `ALTER TABLE trips ADD COLUMN emoji text DEFAULT NULL; ALTER TABLE trips ADD COLUMN image_url text DEFAULT NULL;`

### Upload Flow
- In **TripSettings.tsx**, add an "Icon" section where the user can:
  - Pick an emoji from a small curated set (or type one)
  - Upload an image (stored in the existing `trip-images` bucket under `trips/{tripId}/icon.ext`)
  - Preview the current icon
- Save `emoji` and/or `image_url` to the trips row

### Display
- **Dashboard.tsx** (line 156-158): Replace the hardcoded `✈️` with: if `trip.image_url` exists, render a rounded `<img>`. Else if `trip.emoji` exists, render it. Else fall back to `✈️`.
- **TimelineHeader.tsx** (line 87-95): Replace the Home button area or add a trip icon next to the title. If `trip.image_url` exists, show a small circular image. Else show `trip.emoji ?? '✈️'`.

### Type Update
- The `Trip` type in `types/trip.ts` will auto-update from the database schema after migration.

## 2. Weather Badges at Half-Hour Marks

Currently weather badges are positioned at the top of each hour (`top = (hour - startHour) * PIXELS_PER_HOUR + 2`). Move them to the half-hour position to sit between hour lines.

### Changes
- **CalendarDay.tsx** (line 542): Change `top` calculation from `(hour - startHour) * PIXELS_PER_HOUR + 2` to `(hour - startHour) * PIXELS_PER_HOUR + (PIXELS_PER_HOUR / 2) - 6`. This positions each weather badge at the :30 mark of each hour, vertically centered.

## 3. Timezone Label Centering and Transition

### Single Timezone: Centered
Currently single-TZ labels sit at `left: -36`. Instead, center them within the gutter space (between weather column and gradient line).

- The gutter space runs from roughly `left: -36` (after weather) to `left: -6` (gradient line), so ~30px wide.
- Center the label in that space: `left: -36` with `width: 30px` and `text-align: center`.

### Dual Timezone Transition: Side-by-Side with Divider
Currently the two timezones are shown inline with a `│` divider but the positioning and opacity logic makes them hard to read.

Refactor the dual-TZ display so:
- Before the flight: Single origin timezone, centered (same as single-TZ layout)
- During transition (overlap zone): Two columns side-by-side. The origin time on the left, destination time on the right, with a thin vertical divider (the centerline) between them. Both equally visible.
- After the flight: Single destination timezone, centered

### Changes
- **TimeSlotGrid.tsx** lines 80-115: Simplify `getColumnsAtHour` to return three states:
  - `'single-origin'` -- before flight overlap zone
  - `'dual'` -- during the overlap zone (flight time +/- 1.5h buffer)
  - `'single-dest'` -- after flight overlap zone
- **TimeSlotGrid.tsx** lines 262-294: Render differently based on state:
  - `single-origin` / `single-dest`: One centered label in the gutter space
  - `dual`: Two labels, each taking half the gutter width, with a thin center divider line

### Layout Math (single-TZ, 56px margin)
```text
Weather: left -56, width ~20px
Gutter:  left -36, width 30px  (time labels centered here)
Gradient: left -6, width 5px
```

### Layout Math (dual-TZ, 80px margin)
```text
Weather: left -80, width ~20px
Gutter:  left -58, width 52px  (split into two 25px halves with 2px divider)
Gradient: left -6, width 5px
```

---

## Technical Summary

| File | Changes |
|------|---------|
| **Migration** | Add `emoji text` and `image_url text` columns to `trips` table |
| `TripSettings.tsx` | Add icon/emoji picker section with image upload |
| `Dashboard.tsx` | Show trip image/emoji instead of hardcoded plane icon |
| `TimelineHeader.tsx` | Show trip image/emoji next to trip name |
| `CalendarDay.tsx` | Move weather badge `top` to half-hour position |
| `TimeSlotGrid.tsx` | Refactor TZ labels: center single-TZ, side-by-side dual-TZ with centered divider |


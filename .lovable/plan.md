

# "I Don't Know When Yet" -- Undated Trip Support

## Overview

Add the ability to create a trip without specific dates. When the user chooses this, they specify how many days the trip will be. The timeline then shows "Day 1", "Day 2", etc. instead of real calendar dates. Weather is locked until real dates are set and those dates are within 14 days from now.

---

## How it works for users

**In the Trip Wizard (Dates step):**
- A toggle appears: "I don't know when yet"
- When toggled ON, the date pickers hide and a number input appears: "How many days?"
- When toggled OFF, the normal start/end date pickers show

**On the Timeline:**
- If the trip has no dates, day headers show "Day 1 -- Monday", "Day 2 -- Tuesday", etc. (no real calendar date)
- The "Today" scroll button and today highlighting are hidden (no real dates to compare)
- The weather button in the header is disabled with a tooltip explaining why

**Weather button logic:**
- Disabled if trip has no real dates (shows "Set dates first")
- Disabled if trip dates are more than 14 days away (shows "Available within 14 days")
- Enabled only when trip has real dates and they're within 14 days of today

---

## Technical details

### 1. Database migration

Add a `duration_days` column to the `trips` table and make `start_date`/`end_date` nullable:

```sql
ALTER TABLE public.trips
  ALTER COLUMN start_date DROP NOT NULL,
  ALTER COLUMN end_date DROP NOT NULL,
  ADD COLUMN duration_days integer;
```

When `duration_days` is set and `start_date` is NULL, the trip is in "undated" mode.

### 2. Type updates (`src/types/trip.ts`)

Update the `Trip` interface:
- `start_date: string | null`
- `end_date: string | null`
- `duration_days: number | null`

### 3. DateStep component changes (`src/components/wizard/DateStep.tsx`)

- Add a `datesUnknown` boolean prop and `onDatesUnknownChange` callback
- Add a `durationDays` number prop and `onDurationDaysChange` callback
- Show a switch/toggle: "I don't know when yet"
- When toggled ON: hide date inputs, show a number input for days (1-30 range)
- When toggled OFF: show the normal start/end date pickers

### 4. TripWizard changes (`src/pages/TripWizard.tsx`)

- Add state: `datesUnknown` (boolean), `durationDays` (number, default 3)
- Pass new props to DateStep
- Update validation: step 1 requires either (startDate AND endDate) OR (datesUnknown AND durationDays > 0)
- On create: if datesUnknown, send `start_date: null`, `end_date: null`, `duration_days: durationDays`
- If dates are known, send dates as before with `duration_days: null`

### 5. Timeline changes (`src/pages/Timeline.tsx`)

- Update `getDays()`: if `trip.start_date` is null, generate synthetic days using `trip.duration_days` (Day 1 through Day N, using a reference date like 2099-01-01 internally so entry timestamps still work)
- Pass a `dayLabel` or `dayIndex` prop to CalendarDay so it can show "Day 1" instead of a real date
- Hide "scroll to today" button when trip is undated

### 6. CalendarDay changes (`src/components/timeline/CalendarDay.tsx`)

- Accept an optional `dayLabel` prop (e.g., "Day 1")
- When `dayLabel` is provided, show it in the header instead of the formatted date
- Skip `isToday` and `isPast` logic when in undated mode

### 7. TimelineHeader changes (`src/components/timeline/TimelineHeader.tsx`)

- Weather button: check if `trip.start_date` is null -- if so, disable with "Set dates first" title
- Weather button: check if `trip.start_date` is more than 14 days from today -- if so, disable with "Available within 14 days" title
- Both conditions use the `disabled` prop on the button

### 8. EntryForm changes (`src/components/timeline/EntryForm.tsx`)

- Accept `trip` prop to know if we're in undated mode
- When undated: replace the date picker with a dropdown of "Day 1", "Day 2", ... "Day N"
- Internally map "Day 1" to reference date 2099-01-01, "Day 2" to 2099-01-02, etc.
- When dated: show normal date picker as today

### Files changed (8 files total)

| File | Change |
|------|--------|
| Database migration | Add `duration_days` column, make dates nullable |
| `src/types/trip.ts` | Update Trip interface |
| `src/components/wizard/DateStep.tsx` | Add toggle + day count input |
| `src/pages/TripWizard.tsx` | Handle undated state |
| `src/pages/Timeline.tsx` | Generate synthetic days, pass labels |
| `src/components/timeline/CalendarDay.tsx` | Accept/display day labels |
| `src/components/timeline/TimelineHeader.tsx` | Disable weather conditionally |
| `src/components/timeline/EntryForm.tsx` | Day dropdown for undated trips |




# Dual Timezone Display, Short Entry Fix, Return Flight Bug, and Ideas Sidebar

## 1. Dual Timezone Gutter in TimeSlotGrid

### How it works
The time gutter (left side of the timeline) currently shows one column of hour labels. We will expand it to support two timezone columns that change based on flights on that day.

### Logic
- **Default (no flight on this day):** Show only the "current" timezone -- this is the trip's destination timezone, OR after a flight lands, the arrival timezone becomes the new "current" one.
- **Flight day:** Show two timezone columns with a 3-hour overlap period centered around the flight time. Before the flight, show origin timezone. During the overlap (1.5h before to 1.5h after the flight), show both side by side. After the overlap, show only the destination timezone.
- **Multiple flights same day:** Show a third timezone column during the second flight's overlap.

### Determining which timezone applies
- Walk through all entries across all days chronologically. Track "current timezone" starting from the trip's timezone.
- When a flight is encountered, the current timezone switches to the flight's `arrival_tz` after that day.
- For each day, pass `originTz` and `destinationTz` (if a flight exists) plus the flight's start/end times to `TimeSlotGrid` and `CalendarDay`.

### Changes
- **`TimeSlotGrid.tsx`**: Add props for `originTz`, `destinationTz`, `flightStartHour`, `flightEndHour`. Render two columns of hour labels. The origin column fades out after the overlap period; the destination column fades in.
- **`CalendarDay.tsx`**: Compute which flight(s) exist on this day, extract their timezones, and pass them to `TimeSlotGrid`. Widen the left margin from `ml-10` to `ml-16` or `ml-20` when dual timezones are shown.
- **`Timeline.tsx`**: Precompute a `dayTimezoneMap` that maps each day to its active timezone(s) by scanning flights chronologically. Pass this info down to `CalendarDay`.

### Visual design
- Left gutter shows two small columns: origin TZ abbreviation on the far left, destination TZ on the right.
- During the overlap window, both columns are visible with a subtle divider.
- Outside the overlap, only one column is visible (the other is hidden or fully transparent).
- The overlap region gets a subtle gradient background to visually indicate the transition.

---

## 2. Short Entry Condensed Layout

### Problem
Line 348 in `CalendarDay.tsx`: `const height = Math.max(60, ...)` forces a 60px minimum. At 80px/hour, a 15-min entry should be 20px but gets forced to 60px, which misrepresents its actual duration.

### Fix
- **Remove the 60px minimum height** in `CalendarDay.tsx` -- let `height` be the true calculated value.
- **`EntryCard.tsx`**: Detect when the card is "compact" (height below a threshold, e.g. 50px). In compact mode:
  - Switch to a single-line horizontal layout: `[emoji] Name | 09:00-09:15`
  - Remove the category badge, distance, and vote elements.
  - Use smaller text (`text-[11px]`), minimal padding (`p-1 px-2`).
  - Remove the background image display.
- Pass a `compact` boolean prop from `CalendarDay` to `EntryCard` based on the calculated pixel height.

### Changes
- **`CalendarDay.tsx`**: Remove `Math.max(60, ...)`, pass `isCompact={height < 50}` to `EntryCard`.
- **`EntryCard.tsx`**: Add `isCompact` prop. When true, render the condensed single-line layout.

---

## 3. Return Flight Double-Prompt Bug

### Root cause
In `EntryForm.tsx` line 536: `if (isFlight && !isEditing)` triggers the return flight prompt after every new flight save. When the user confirms a return flight, `handleReturnFlightConfirm` sets `categoryId` to `'flight'`, opens the form again, and when that flight is saved, it hits the same condition again -- prompting for yet another return.

### Fix
- Add an `isReturnFlight` state flag (boolean, default `false`).
- In `handleReturnFlightConfirm`, set `isReturnFlight = true`.
- Change the prompt condition to: `if (isFlight && !isEditing && !isReturnFlight)`.
- In `reset()`, set `isReturnFlight = false`.

### Changes
- **`EntryForm.tsx`**: Add `isReturnFlight` state, guard the prompt, reset it in `reset()`.

---

## 4. Ideas Panel as Persistent Sidebar (Desktop) / FAB + Overlay (Mobile)

### Current implementation
`IdeasPanel` uses a Radix `Sheet` overlay. The toggle button is in the header.

### New behavior
- **Desktop**: The Ideas panel becomes a persistent sidebar on the right side of the timeline. When toggled open, the main timeline area shrinks to make room (flexbox layout, not overlay). Width: ~320px.
- **Mobile**: A floating action button (FAB) in the bottom-right corner with a lightbulb emoji. Tapping it opens a full-screen drawer/overlay.
- **Remove** the lightbulb button from the `TimelineHeader` (it moves to the FAB on mobile and the sidebar toggle on desktop).

### Changes
- **`IdeasPanel.tsx`**: Replace the `Sheet` with a conditional layout:
  - Desktop: A `div` with fixed width that sits alongside the timeline in a flex container.
  - Mobile: Keep the `Sheet` (full overlay).
- **`Timeline.tsx`**: Wrap the main content area and `IdeasPanel` in a flex row. Add the FAB button (mobile only) in the bottom-right corner with the lightbulb emoji.
- **`TimelineHeader.tsx`**: Remove the Ideas toggle button from the header (or keep it for desktop only as a subtle toggle).
- Use the existing `useIsMobile()` hook to switch between sidebar and overlay modes.

### FAB design
- Fixed position, bottom-right (e.g. `bottom-20 right-6` to sit above the zoom controls).
- Round button with `💡` emoji, with the count badge overlay.
- Only visible on mobile.

---

## Technical Details

### Files to create
None -- all changes are edits to existing files.

### Files to edit

| File | Changes |
|------|---------|
| `src/components/timeline/TimeSlotGrid.tsx` | Add dual timezone props, render two columns of labels with overlap logic |
| `src/components/timeline/CalendarDay.tsx` | Pass timezone info to grid, remove 60px min height, pass `isCompact` to cards, widen gutter for dual TZ |
| `src/components/timeline/EntryCard.tsx` | Add `isCompact` prop with condensed single-line layout |
| `src/components/timeline/EntryForm.tsx` | Add `isReturnFlight` flag to prevent double prompt |
| `src/components/timeline/IdeasPanel.tsx` | Replace Sheet with flex sidebar (desktop) / Sheet (mobile) |
| `src/components/timeline/TimelineHeader.tsx` | Remove or adjust Ideas toggle button |
| `src/pages/Timeline.tsx` | Compute day timezone map from flights, flex layout for sidebar, add mobile FAB |

### Timezone computation pseudocode

```text
let currentTz = trip.timezone

for each day in trip:
  let flightsToday = entries on this day where category = 'flight'
  
  if flightsToday.length == 0:
    dayTzMap[day] = { activeTz: currentTz }
  else:
    for each flight in flightsToday:
      dayTzMap[day] = {
        originTz: currentTz,
        destinationTz: flight.arrival_tz,
        flightStartHour: getHour(flight.start_time),
        flightEndHour: getHour(flight.end_time),
        overlapStart: flightStartHour - 1.5,
        overlapEnd: flightEndHour + 1.5
      }
      currentTz = flight.arrival_tz  // switch for subsequent days
```


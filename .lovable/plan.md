

# Multiple Improvements: Flights, Overlay, Markers, Add-Between, and Date Conversion

## Overview

This plan addresses 7 distinct issues/features across the entry form, timeline display, and overlay.

---

## 1. Flight Duration Auto-Calculated (Remove Manual Duration Field)

**Problem:** The "When" step shows a manual "Duration (minutes)" input for flights, but flight duration should be computed from depart/arrive times and their timezones.

**Changes to `src/components/timeline/EntryForm.tsx`:**
- Remove the "Duration (minutes)" input entirely for flights (hide it when `isFlight` is true)
- When the user changes depart time or arrive time for a flight, auto-calculate the duration and update `durationMin` state (for non-flights, keep the existing behavior)
- For non-flight entries, keep the duration field as-is (it helps recalculate end time)

---

## 2. Return Flight Prompt

**Problem:** No way to easily add a return flight after creating the outbound.

**Changes to `src/components/timeline/EntryForm.tsx`:**
- After successfully saving a flight entry, show a confirmation dialog: "Add return flight?"
- If "Yes", re-open the form pre-filled with:
  - Category: flight (already set)
  - Departure location = previous arrival location
  - Arrival location = previous departure location
  - Departure TZ = previous arrival TZ
  - Arrival TZ = previous departure TZ
  - Name cleared (user fills in return flight number)
  - Day/date cleared for user to pick the return day
- If "No", close as normal

**Implementation:** Add a `pendingReturnFlight` state that stores the reversed flight details. After the main save completes, if `isFlight && !isEditing`, set this state and show a dialog. On confirm, reset the form with the reversed values and re-open at the "details" step.

---

## 3. Dynamic Flight Location Labels

**Problem:** The message "Depart in London (GMT/BST) -- Arrive in Amsterdam (CET/CEST)" on line 463 is hardcoded from the timezone list labels, but it doesn't reflect the user's entered departure/arrival locations.

**Changes to `src/components/timeline/EntryForm.tsx`:**
- Update the flight timezone hint (line 463) to use the actual departure/arrival location names entered by the user
- Format: "Depart from {departureLocation || timezone label} -- Arrive at {arrivalLocation || timezone label}"
- Fall back to the timezone label only if no location is entered yet

**Changes to `src/components/timeline/EntryCard.tsx`:**
- The card already uses `option.departure_location` and `option.arrival_location` dynamically (line 149), so this should already work. The issue may be that existing entries were saved without these fields populated. Verify and ensure the card renders correctly with the stored data.

---

## 4. Flight Card Size Glitch

**Problem:** Flight cards appear half-size on the calendar. This is likely because `getHourInTimezone` calculates a very small time span when the arrival is in a different timezone than `tripTimezone`.

**Root cause in `src/components/timeline/CalendarDay.tsx`:** The card positioning uses `getHourInTimezone(entry.start_time, tripTimezone)` and `getHourInTimezone(entry.end_time, tripTimezone)` (lines 168-169). For flights, start_time is stored as UTC converted from the departure timezone, and end_time from the arrival timezone. When displayed using tripTimezone, the visual span should be correct. However, if the entry's arrival time crosses midnight or the timezone offset makes the span appear very small, the `Math.max(40, ...)` minimum height kicks in but may still look wrong.

**Fix in `src/components/timeline/CalendarDay.tsx`:**
- Ensure the minimum height for entry cards is reasonable (increase from 40px to at least 60px)
- For flights specifically, ensure we calculate the visual span correctly: both times are in UTC, so converting both to `tripTimezone` should give the correct visual duration. If end < start in tripTimezone (cross-midnight), handle that case.

---

## 5. Entry Overlay: Move Images to Bottom, Hide Empty State

**Changes to `src/components/timeline/EntryOverlay.tsx`:**
- Remove the image gallery section from the top of the overlay (lines 66-74)
- Remove the "No photos yet" placeholder entirely
- Move the `ImageGallery` component to after the map/vote section, just before the edit/delete buttons
- Only render it if `images.length > 0`

---

## 6. Visual "Trip Begins" / "Trip Ends" Markers

**Not stored in the database.** Rendered automatically on the timeline.

**Changes to `src/components/timeline/CalendarDay.tsx`:**
- Accept new props: `isFirstDay: boolean` and `isLastDay: boolean`
- When `isFirstDay`, render a visual "Trip Begins" marker at the top of the day (before entries), styled as a decorative banner with a flag emoji
- When `isLastDay`, render a "Trip Ends" marker at the bottom of the day (after entries)
- Styled with a warm amber background, rounded pill, centred text

**Changes to `src/pages/Timeline.tsx`:**
- Pass `isFirstDay={index === 0}` and `isLastDay={index === days.length - 1}` to each `CalendarDay`

---

## 7. "+" Add Button Between Entries

**Changes to `src/components/timeline/CalendarDay.tsx`:**
- Between each pair of entries (and after the last entry), render a small "+" button
- The button is positioned between entry cards in the timeline flow
- Clicking it calls a new callback `onAddBetween(afterEntryEndTime, beforeEntryStartTime)` that opens the entry form with pre-filled time context

**Changes to `src/pages/Timeline.tsx`:**
- Add handler for `onAddBetween` that opens `EntryForm` with a pre-filled start time (= the end time of the previous entry)
- Pass a new prop `prefillStartTime` to `EntryForm`

**Changes to `src/components/timeline/EntryForm.tsx`:**
- Accept optional `prefillStartTime?: string` prop
- When provided, use it to set the initial start time (overriding category defaults for time, but still using category default duration)

---

## 8. Convert Undated Trip to Real Dates (Including Auto-Detection from Flights)

**Changes to `src/pages/TripSettings.tsx`:**
- Add a "Trip Dates" section that shows current dates or "Undated (Day 1, Day 2...)"
- Add a "Set Dates" form with start date picker
- On save: update `trips.start_date` and `trips.end_date` (calculated from start + duration_days), then shift ALL existing entries by replacing the 2099-01-01 reference date with the real start date

**Changes to `src/components/timeline/EntryForm.tsx`:**
- After saving a flight entry on an undated trip, detect that the flight has a real date and auto-trigger the date conversion:
  - Calculate the trip start date by working backwards from the flight's date and which "Day" it was placed on
  - Update the trip's `start_date` and `end_date`
  - Shift all existing entries from 2099-01-xx to real dates
  - Show a toast: "Trip dates set based on your flight!"

**Shift logic:** For each entry, replace the date portion: if entry is on `2099-01-01` (Day 1), move to `start_date`; `2099-01-02` (Day 2) moves to `start_date + 1 day`, etc. Keep the time portion unchanged.

---

## Files Summary

| File | Changes |
|------|---------|
| `src/components/timeline/EntryForm.tsx` | Remove duration for flights, auto-calc, return flight prompt, dynamic labels, prefill support, auto-date-detection |
| `src/components/timeline/EntryOverlay.tsx` | Move images to bottom, hide empty state |
| `src/components/timeline/CalendarDay.tsx` | Trip begin/end markers, "+" add buttons between entries, fix flight card min height |
| `src/pages/Timeline.tsx` | Pass isFirstDay/isLastDay, handle addBetween callback |
| `src/pages/TripSettings.tsx` | Add date conversion section for undated trips |

No database schema changes needed -- all changes are UI/logic only.


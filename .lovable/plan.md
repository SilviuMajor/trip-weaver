

# Airport Dropdown, Terminal Display, and Timezone Fix

## Overview

Three interconnected changes: (1) replace free-text airport inputs with a searchable dropdown that auto-sets timezones, (2) add a terminal field to flights, and (3) fix the fundamental timezone handling so all times are stored as proper UTC, eliminating the 1-hour drag-and-drop shift.

---

## The Timezone Bug (Root Cause)

The drag-and-drop places entries 1 hour ahead because of a mismatch:

1. `getHourInTimezone()` reads an entry's UTC time and displays it as LOCAL time in the trip timezone (e.g. 10:00 CET)
2. When dragging completes, `handleDragCommit` takes that local hour (10) and saves it as `10:00+00:00` (UTC)
3. Next render, `getHourInTimezone` converts `10:00 UTC` to `11:00 CET` -- shifted by 1 hour

The same bug exists in `EntryForm.tsx` for non-flight entries (line 338): local times are stored with `+00:00` offset, treating them as UTC.

**Fix**: Convert local times to proper UTC before saving, and always use timezone-aware conversion in both directions.

---

## 1. Airport Data and Searchable Dropdown

### New file: `src/lib/airports.ts`
- Contains a comprehensive dataset of ~3000+ commercial airports with IATA codes
- Each entry: `{ iata: string, name: string, city: string, country: string, timezone: string }`
- Example: `{ iata: 'LHR', name: 'Heathrow', city: 'London', country: 'GB', timezone: 'Europe/London' }`
- Data sourced from a well-known open airport dataset, trimmed to commercial airports with IATA codes
- Export a search function: `searchAirports(query: string): Airport[]` that filters by IATA code, name, or city (case-insensitive, returns top 20 matches)

### New component: `src/components/timeline/AirportPicker.tsx`
- A searchable dropdown using the existing `cmdk` (Command) library already installed
- Shows a text input that opens a popover with filtered airport results
- Each result shows: IATA code (bold), airport name, city/country
- On selection: sets the airport name (e.g. "LHR - Heathrow") and auto-sets the timezone
- Props: `value: string`, `onChange: (airport: Airport) => void`, `placeholder: string`

### Changes to `src/components/timeline/EntryForm.tsx`
- Replace the two free-text "From (airport/city)" and "To (airport/city)" inputs with `AirportPicker` components
- When an airport is selected: auto-populate `departureLocation` / `arrivalLocation` with "IATA - Name" AND auto-set `departureTz` / `arrivalTz` from the airport's timezone
- Remove the manual timezone dropdown selects entirely (they become auto-set, but show the detected timezone as a read-only label so users can see it)
- Add a "Terminal" free-text input field below each airport picker (departure terminal, arrival terminal)

---

## 2. Terminal Field

### Database migration
- Add `departure_terminal` (text, nullable) and `arrival_terminal` (text, nullable) columns to `entry_options` table

### Changes to `src/components/timeline/EntryForm.tsx`
- Add `departureTerminal` and `arrivalTerminal` state variables
- Add free-text inputs below each airport picker: "Departure terminal" and "Arrival terminal"
- Include in the save payload: `departure_terminal`, `arrival_terminal`
- Pre-fill when editing

### Changes to `src/types/trip.ts`
- Add `departure_terminal` and `arrival_terminal` to `EntryOption` interface

### Changes to `src/components/timeline/EntryCard.tsx`
- Display terminal info on flight cards after the airport name
- Format: "LHR T5 08:00 GMT -> AMS T1 10:30 CET"

---

## 3. Fix All Timezone Handling (Store as UTC)

### New utility: `src/lib/timezoneUtils.ts`
- `localToUTC(dateStr: string, timeStr: string, timezone: string): string` -- converts a local date+time in a given timezone to a UTC ISO string. This already exists as `localToUTC` in EntryForm but needs to be extracted and shared.
- `utcToLocal(isoString: string, timezone: string): { date: string, time: string }` -- converts UTC ISO to local date and time string in a given timezone
- `getTimezoneOffsetMs(dateStr: string, timeStr: string, timezone: string): number` -- calculates the offset for a specific moment

### Changes to `src/components/timeline/EntryForm.tsx` (non-flight save)
- Line 338: Change from `${entryDate}T${startTime}:00+00:00` to use `localToUTC(entryDate, startTime, tripTimezone)`
- Line 339: Same for end time
- This ensures all entries are stored as proper UTC timestamps

### Changes to `src/components/timeline/CalendarDay.tsx` (drag commit)
- `handleDragCommit`: Instead of saving hours with `+00:00`, convert local hours in `tripTimezone` back to UTC
- Use the new `localToUTC` utility: build the local time string from the dragged hours, then convert to UTC using `tripTimezone`

### Changes to `src/pages/Timeline.tsx`
- `getEntriesForDay`: Currently compares using `format(new Date(entry.start_time), 'yyyy-MM-dd')` which uses the browser's local timezone. Fix to compare using the trip timezone instead, so entries appear on the correct day.

---

## Files Summary

| File | Action | What Changes |
|------|--------|-------------|
| `src/lib/airports.ts` | Create | Airport dataset (~3000 entries) with search function |
| `src/lib/timezoneUtils.ts` | Create | Shared UTC conversion utilities |
| `src/components/timeline/AirportPicker.tsx` | Create | Searchable airport dropdown component |
| `src/components/timeline/EntryForm.tsx` | Edit | Airport pickers, terminal fields, UTC-correct time storage |
| `src/components/timeline/EntryCard.tsx` | Edit | Display terminal info on flight cards |
| `src/components/timeline/CalendarDay.tsx` | Edit | Fix drag commit to convert local hours to UTC |
| `src/pages/Timeline.tsx` | Edit | Fix day filtering to use trip timezone |
| `src/types/trip.ts` | Edit | Add terminal fields to EntryOption |
| Database migration | Add | `departure_terminal` and `arrival_terminal` columns on `entry_options` |


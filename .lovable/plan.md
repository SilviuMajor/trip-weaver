

# Flight Handling, Smart Entry Creation, Delete Trip, and Navigation

## 1. Delete Trip Button in Trip Settings

Add a danger zone at the bottom of `TripSettings.tsx` with a red "Delete Trip" button that opens an AlertDialog confirmation. On confirm, delete the trip and navigate back to `/dashboard`.

**File:** `src/pages/TripSettings.tsx`

---

## 2. Back to My Trips (Timeline Header)

Replace the timezone toggle in `TimelineHeader.tsx` with a Home/back icon button that navigates to `/dashboard`. Remove the timezone toggle entirely (it's being replaced by the flight timezone approach).

**File:** `src/components/timeline/TimelineHeader.tsx`
- Remove the `Globe`, `Switch`, timezone toggle UI, and the `onToggleTimezone`/`timezoneLabel` props
- Add a `Home` icon button that navigates to `/dashboard`

**File:** `src/pages/Timeline.tsx`
- Remove the `useTimezone` hook usage and stop passing timezone props to TimelineHeader

---

## 3. Flight Category with Dual Timezones

When the user picks "Flight" as a category, the entry form collects extra flight-specific fields:

- Departure city/airport (e.g. "LHR" or "London Heathrow")
- Arrival city/airport (e.g. "AMS" or "Amsterdam Schiphol")
- Departure timezone (from a list like the wizard uses)
- Arrival timezone
- Departure time and arrival time (each shown in their respective timezone)

The entry's `start_time` and `end_time` are stored in UTC as usual, but calculated from the local times + their timezones. On the timeline, the EntryCard displays both times in their local zones (e.g. "Depart 08:00 GMT -- Arrive 10:30 CET").

### Database changes

Add columns to `entry_options` to store flight-specific data:
```sql
ALTER TABLE entry_options ADD COLUMN departure_location text;
ALTER TABLE entry_options ADD COLUMN arrival_location text;
ALTER TABLE entry_options ADD COLUMN departure_tz text;
ALTER TABLE entry_options ADD COLUMN arrival_tz text;
```

The trip's timezone field becomes the "destination timezone" used for all non-flight entries on the timeline.

### UI changes

**`src/components/timeline/OptionForm.tsx`:**
- When category is "flight", show departure/arrival city inputs and timezone selectors
- Show departure time and arrival time inputs (these feed back to the parent EntryForm to set start/end times, converted to UTC using the selected timezones)

**`src/components/timeline/EntryCard.tsx`:**
- When category is "flight", display departure and arrival info with their local times (e.g. "LHR 08:00 GMT -> AMS 10:30 CET")

**`src/components/timeline/EntryForm.tsx`:**
- When category is "flight", the time inputs are handled by OptionForm instead of the top-level time step (since they need timezone context)

**`src/types/trip.ts`:**
- Add the new optional fields to `EntryOption`

---

## 4. Redesigned Entry Creation Flow (Category-First with Smart Defaults)

Completely rework the `EntryForm` step order:

### New flow:
1. **Step 1 -- Category**: Pick what you're doing (Breakfast, Lunch, Activity, Flight, etc.)
2. **Step 2 -- Details**: Name, website, location (the current OptionForm fields). For flights, also departure/arrival info.
3. **Step 3 -- When**: Which day? Optional time override. Pre-filled with smart defaults based on category.

### Smart default durations per category:
| Category | Default Duration | Default Time Slot |
|----------|-----------------|-------------------|
| Breakfast | 1h | 08:00-09:00 |
| Lunch | 1.5h | 12:30-14:00 |
| Dinner | 2h | 19:00-21:00 |
| Drinks | 2h | 21:00-23:00 |
| Activity | 2h | 10:00-12:00 |
| Sightseeing | 2h | 14:00-16:00 |
| Shopping | 1.5h | 15:00-16:30 |
| Hotel | 10h | 22:00-08:00 |
| Flight | 3h | 10:00-13:00 |
| Travel | 1h | 09:00-10:00 |
| Home | 1h | 09:00-10:00 |

When the user picks a day but doesn't override the time, the system uses **smart placement**:
- Breakfast goes to morning (08:00)
- Lunch to midday (12:30)
- Dinner to evening (19:00)
- Activities/sightseeing fill the first available gap in the day
- The user can always override both start and end time

The time fields are pre-filled with the defaults but shown as editable, with a note like "Suggested: 12:30 - 14:00" so the user knows they can change it.

### File changes:

**`src/components/timeline/EntryForm.tsx`:** Major rewrite
- New step flow: `category` -> `details` -> `when`
- Step 1 shows the category grid (moved from OptionForm)
- Step 2 shows name/website/location fields (and flight fields if applicable)
- Step 3 shows day picker + pre-filled time inputs with smart defaults
- On save: creates the entry with the times, then creates the option with the details, all in one go

**`src/components/timeline/OptionForm.tsx`:**
- Extract category picker to be reusable, or inline it in EntryForm
- OptionForm becomes focused on just the detail fields (name, website, location, flight data)

---

## 5. Remove Old Timezone Toggle Hook

Since we're removing the UK/Amsterdam toggle in favor of per-flight timezone display and using the trip's timezone for everything else:

**`src/hooks/useTimezone.ts`:** Can be removed or simplified
**`src/pages/Timeline.tsx`:** Stop importing/using `useTimezone`, use `trip.timezone` directly for formatting non-flight times

---

## Files Summary

| File | Action | What Changes |
|------|--------|-------------|
| Database migration | Create | Add flight columns to `entry_options` |
| `src/pages/TripSettings.tsx` | Edit | Add delete trip danger zone with AlertDialog |
| `src/components/timeline/TimelineHeader.tsx` | Edit | Remove tz toggle, add Home button |
| `src/pages/Timeline.tsx` | Edit | Remove useTimezone, clean up props |
| `src/components/timeline/EntryForm.tsx` | Edit | Category-first flow with smart defaults |
| `src/components/timeline/OptionForm.tsx` | Edit | Add flight fields, restructure for new flow |
| `src/components/timeline/EntryCard.tsx` | Edit | Flight dual-timezone display |
| `src/types/trip.ts` | Edit | Add flight fields to EntryOption |
| `src/lib/categories.ts` | Edit | Add default durations and time slots per category |
| `src/hooks/useTimezone.ts` | Delete or simplify | No longer needed for toggle |


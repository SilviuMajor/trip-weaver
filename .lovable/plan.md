

# Bug Fix + Feature Improvements

## 1. Fix Login Crash (Dashboard.tsx)

**The bug:** On Dashboard line 120, `parseISO(trip.start_date)` is called for every trip, but `start_date` can be `null` when a trip was created with "dates unknown". `parseISO(null)` throws `Cannot read properties of null (reading 'split')`.

**Fix:** Guard the date display -- if `start_date` or `end_date` is null, show the `duration_days` value instead (e.g. "3-day trip" or "Dates TBD").

**File:** `src/pages/Dashboard.tsx` (line 120)

---

## 2. Wire Up Entry Edit and Delete

The edit/delete UI exists in `EntryOverlay.tsx` and `EntryForm.tsx` already supports edit mode, but `Timeline.tsx` doesn't pass the `onEdit` or `onDeleted` callbacks to the overlay.

**Changes to `src/pages/Timeline.tsx`:**
- Add state for `editEntry` and `editOption`
- Create an `handleEdit` function that sets these and opens the EntryForm in edit mode
- Pass `onEdit={handleEdit}` and `onDeleted={fetchData}` to `EntryOverlay`
- Pass `editEntry` and `editOption` props to `EntryForm`

This connects the existing edit/delete UI to the existing edit-mode logic -- no new components needed.

---

## 3. Add Trip Destination Field

Add a `destination` text column to the `trips` table so the organizer can set a city/destination.

**Database migration:**
- `ALTER TABLE trips ADD COLUMN destination text;`

**Changes to `src/pages/TripWizard.tsx`:**
- Add a destination input field in the Name step (or as a sub-field below the trip name)
- Save `destination` when inserting the trip

**Changes to `src/components/wizard/NameStep.tsx`:**
- Add a "Destination" input field below the trip name

**Changes to `src/pages/TripSettings.tsx`:**
- Add an editable destination field alongside the trip name

**Changes to `src/pages/Dashboard.tsx`:**
- Show destination below the trip name on trip cards (e.g. "Amsterdam Trip -- Amsterdam, NL")

---

## 4. Add Members After Creation (Trip Settings)

The TripSettings page currently shows existing members but has no way to add new ones.

**Changes to `src/pages/TripSettings.tsx`:**
- Add an "Add Member" section at the bottom of the members list
- Include a name input and role selector (defaulting to "viewer")
- On submit, insert a new row into `trip_users` for the current trip
- Refresh the members list after adding

---

## Files Summary

| File | Action | What Changes |
|------|--------|-------------|
| Database migration | Create | Add `destination` column to `trips` |
| `src/pages/Dashboard.tsx` | Edit | Fix null date crash, show destination |
| `src/pages/Timeline.tsx` | Edit | Wire onEdit/onDeleted to EntryOverlay and EntryForm |
| `src/pages/TripSettings.tsx` | Edit | Add destination editing, add member form |
| `src/pages/TripWizard.tsx` | Edit | Save destination field |
| `src/components/wizard/NameStep.tsx` | Edit | Add destination input |


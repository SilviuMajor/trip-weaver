

# Three Fixes: Member PIN Codes, Custom Categories in Settings, and Timezone-Aware Prefill

## 1. Member PIN Codes

**Goal**: Organizers can optionally set a PIN for any trip member. When that member taps their name on the User Select screen, they must enter the correct PIN before entering the trip.

### Database Change

Add a `pin_hash` column to `trip_users`:

```sql
ALTER TABLE public.trip_users ADD COLUMN pin_hash text;
```

PINs will be stored as plain short codes (4-6 digits) since this is a lightweight access gate, not true authentication. The column is nullable -- members without a PIN enter freely.

### Trip Settings (`src/pages/TripSettings.tsx`)

- Add a PIN input field next to each member row (a small `Input` with `type="password"`, `maxLength={6}`, `placeholder="PIN"`)
- When the organizer types a PIN and saves, update `trip_users.pin_hash` for that member
- Show a small lock icon next to members that have a PIN set
- Add a "Clear PIN" button to remove the PIN

### User Select Screen (`src/pages/UserSelect.tsx`)

- When a user taps a member name, check if that `trip_user` has a `pin_hash` value
- If yes, show a small dialog/modal with a PIN input (4-6 digit numeric input)
- Compare the entered value against `pin_hash`
- If it matches, call `login()` and proceed
- If no PIN is set, proceed as normal (current behavior)
- Fetch the `pin_hash` column along with the member data (it's already fetched via `select('*')`)

### Files to modify:
- `src/pages/TripSettings.tsx` -- add PIN input per member
- `src/pages/UserSelect.tsx` -- add PIN challenge dialog
- `src/types/trip.ts` -- add `pin_hash?: string` to `TripUser`

---

## 2. Custom Categories in Trip Settings

**Goal**: Allow adding custom categories to an existing trip from Trip Settings (currently only possible during trip creation wizard).

### Trip Settings (`src/pages/TripSettings.tsx`)

Add a new "Custom Categories" section (reusing the same UI pattern from `CategoryStep.tsx`):

- Show existing custom categories from `trip.category_presets` as colored pills
- Add an emoji input + name input + "Add" button (same as the wizard)
- Remove button (X) on each custom category
- On change, update `trips.category_presets` in the database

This is purely a UI addition -- the database already supports `category_presets` as a JSONB column on the `trips` table.

### Files to modify:
- `src/pages/TripSettings.tsx` -- add categories section

---

## 3. Timezone-Aware Prefill for "+" Buttons

**Root cause**: When clicking a "+" button on a card, the code does:
```typescript
// Top button (insert before):
const prefillDate = addMinutes(new Date(entry.start_time), -60);
onAddBetween(prefillDate.toISOString());

// Bottom button (insert after):
onAddBetween(entry.end_time);
```

Then in `EntryForm`, the prefill time is parsed with:
```typescript
const dt = new Date(prefillStartTime);
setStartTime(format(dt, 'HH:mm'));
```

`format(dt, 'HH:mm')` uses the **browser's local timezone** (e.g., GMT), not the trip timezone. If the trip timezone is `Europe/Amsterdam` (CET, UTC+1), the displayed time is off by 1 hour.

### Fix in `EntryForm.tsx`

When prefilling start/end times, convert the UTC ISO string to the trip timezone using `utcToLocal()`:

```typescript
// Instead of:
const dt = new Date(prefillStartTime);
setStartTime(format(dt, 'HH:mm'));

// Do:
import { utcToLocal } from '@/lib/timezoneUtils';
const { date: d, time: t } = utcToLocal(prefillStartTime, tripTimezone);
setStartTime(t);
if (!isUndated) setDate(d);
```

Apply the same fix for:
- `prefillEndTime` parsing (line 157)
- `applySmartDefaults` when using `prefillStartTime` (line 172)
- Edit mode prefill (line 112) -- currently uses `format(startDt, 'HH:mm')` which is also browser-local

### Files to modify:
- `src/components/timeline/EntryForm.tsx` -- use `utcToLocal` for all time prefills

---

## Summary

| Area | File(s) | Change |
|------|---------|--------|
| Member PINs | `TripSettings.tsx`, `UserSelect.tsx`, `trip.ts`, DB migration | Add `pin_hash` column, PIN input in settings, PIN challenge on login |
| Custom Categories | `TripSettings.tsx` | Add category management section (emoji + name + color pills) |
| Timezone Prefill | `EntryForm.tsx` | Use `utcToLocal(iso, tripTimezone)` instead of `format(new Date(iso), 'HH:mm')` |


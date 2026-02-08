

# Full Implementation: Multi-Tenancy, Calendar Timeline, Travel, Weather

This is a large build covering admin authentication, a trip dashboard, trip creation wizard, calendar-style timeline, time-of-day gradients, travel time via Google Maps, and live weather. Here is the complete breakdown.

---

## Step 1: Request API Keys

Before writing any code, two API keys need to be stored as backend secrets:

- **GOOGLE_MAPS_API_KEY** -- for the Directions API (public transit routing between entries)
- **OPENWEATHERMAP_API_KEY** -- for weather forecasts (free tier works fine)

You will be prompted to enter these when implementation starts.

---

## Step 2: Database Migration

A new migration to backfill existing `trip_users` with `trip_id` and add the `updated_at` trigger for `travel_segments`:

- Backfill any existing `trip_users` rows with the first trip's ID
- Add trigger for `updated_at` on `travel_segments` if needed

---

## Step 3: Admin Authentication

**New files:**
- `src/pages/Auth.tsx` -- Login/signup form using Supabase Auth (email + password). Clean design matching the warm travel journal aesthetic. Handles both sign-in and sign-up flows with proper error handling and email redirect configuration.
- `src/hooks/useAdminAuth.ts` -- Hook wrapping `supabase.auth.onAuthStateChange` and `supabase.auth.getSession`. Returns `{ adminUser, session, loading, signIn, signUp, signOut }`. Sets up the listener before checking session (per best practices). On first admin login, auto-inserts a row into `user_roles` with role `admin`.

**Modified files:**
- `src/hooks/useCurrentUser.ts` -- Add awareness of admin auth. If a Supabase Auth session exists, the user is treated as admin (organizer-level permissions). The admin can also "impersonate" trip members by selecting a name.

---

## Step 4: Dashboard + Trip Wizard

**New files:**
- `src/pages/Dashboard.tsx` -- Lists all trips owned by the logged-in admin (`trips.owner_id = auth.uid()`). Each trip shows name, date range, member count. "Create Trip" button navigates to the wizard. Clicking a trip navigates to `/trip/:tripId`.
- `src/pages/TripWizard.tsx` -- 5-step wizard with skip on each step:
  1. **Name** -- text input, placeholder suggestions
  2. **Dates** -- start/end date pickers
  3. **Timezone** -- select (UK / Amsterdam / custom)
  4. **Categories** -- add name + pick color for each category preset (stored as JSONB on trips)
  5. **Members** -- add names with role assignment (organizer/editor/viewer). These get inserted into `trip_users` with the new trip's ID.

Each step is a separate component under `src/components/wizard/`:
- `WizardStep.tsx` -- reusable step container with skip/next/back buttons and progress dots
- `NameStep.tsx`, `DateStep.tsx`, `TimezoneStep.tsx`, `CategoryStep.tsx`, `MembersStep.tsx`

On completion, creates the trip in `trips` table with `owner_id = auth.uid()`, then navigates to `/trip/:tripId`.

---

## Step 5: Update Routing

**Modified: `src/App.tsx`**
- `/auth` -- Auth page
- `/` -- Dashboard (requires admin auth, redirects to `/auth` if not logged in)
- `/trip/:tripId` -- Timeline for a specific trip (members access via shared link with name-select)
- `/trip/:tripId/wizard` -- Trip creation wizard (admin only)

**Modified: `src/pages/UserSelect.tsx`**
- Now accepts a `tripId` param and only shows trip_users for that specific trip
- URL becomes the shareable link: `/trip/:tripId` shows user select if not logged in as a member

---

## Step 6: Calendar-Style Timeline

**New files:**
- `src/lib/overlapLayout.ts` -- Calendar overlap algorithm. Takes entries sorted by start time, detects overlapping time ranges, assigns each entry to a column index. Returns `{ entryId, column, totalColumns }[]`. Logic: iterate entries, maintain an "active" list (entries whose end time hasn't passed when the current entry starts). Assign to the first available column.

- `src/components/timeline/TimeSlotGrid.tsx` -- Renders the vertical time axis for one day (06:00 to 00:00 by default). Hour markers as horizontal lines with labels. The grid uses a configurable `pixelsPerHour` value (controlled by zoom level). Click handler converts pixel offset to a time and calls `onClickSlot(time)`.

- `src/components/timeline/CalendarDay.tsx` -- Replaces the old stacked layout. Each day has:
  - A sticky day header (same as before)
  - A `TimeSlotGrid` as the background
  - Entry cards positioned absolutely: `top = (minutesSinceDayStart / totalMinutesInDay) * containerHeight`, `height = durationMinutes * pixelsPerMinute`
  - Overlapping entries placed side by side using `overlapLayout.ts` results
  - If more than 3 columns of overlaps, wraps in a horizontally scrollable container
  - Empty gaps are visible and clickable (opens entry form pre-filled with that time)

- `src/components/timeline/TravelSegment.tsx` -- A small card rendered between consecutive entries. Shows: transit icon, duration ("35 min"), mode, and departure guidance ("Leave by 14:25"). Styled differently from entry cards (muted, smaller, dashed border).

**Modified: `src/pages/Timeline.tsx`**
- Accept `tripId` from `useParams()` instead of fetching the first trip
- Replace `TimelineDay` with `CalendarDay`
- Fetch `travel_segments` for the trip and pass them to `CalendarDay`
- Fetch `weather_cache` for the trip and pass weather data to entry cards
- Add "Generate Travel Times" and "Update Weather" buttons to the header
- Integrate new `pixelsPerHour` from zoom level

**Modified: `src/components/timeline/TimelineDay.tsx`**
- This file will be largely replaced by `CalendarDay.tsx` but kept for reference

---

## Step 7: Time-of-Day Gradient + Weather Badges

**New files:**
- `src/lib/sunCalc.ts` -- Pure math solar position calculator. Given a date and lat/lng (defaulting to Amsterdam: 52.37, 4.90), calculates sunrise and sunset times using standard astronomical formulas. Returns `{ sunrise: Date, sunset: Date, solarNoon: Date }`.

- `src/lib/timeOfDayColor.ts` -- Maps a time + sunrise/sunset to an HSL color:
  - Pre-dawn (before sunrise - 1hr): `hsl(230, 40%, 15%)` deep indigo
  - Sunrise (-1hr to +1hr): `hsl(25, 80%, 55%)` warm orange
  - Morning (sunrise+1 to noon): `hsl(45, 70%, 65%)` soft golden
  - Midday (noon +/- 1hr): `hsl(200, 70%, 65%)` bright sky blue
  - Afternoon (noon+1 to sunset-1): `hsl(35, 75%, 55%)` warm amber
  - Sunset (-1hr to +1hr): `hsl(15, 75%, 50%)` deep orange-pink
  - Night (after sunset+1): `hsl(225, 45%, 18%)` dark indigo
  - Smooth interpolation between these keyframes

- `src/components/timeline/WeatherBadge.tsx` -- Small overlay showing weather icon (SVG) + temperature. Icons: sun, partly cloudy, cloudy, rain, thunderstorm, snow, fog. Renders as a small pill in the top-right corner of the entry card.

**Modified: `src/components/timeline/EntryCard.tsx`**
- Background changes from static gradient to dynamic time-of-day gradient
- Right side of card shows the time-appropriate color (fading from image on left)
- Weather badge appears in top-right corner if weather data is available
- The gradient uses the entry's start_time and the trip's location for sun position

---

## Step 8: Edge Functions

### `supabase/functions/google-directions/index.ts`
- Accepts POST body: `{ tripId: string }`
- Creates a Supabase client with the service role key
- Fetches all entries for the trip (ordered by start_time) with their options
- For each consecutive pair of entries with lat/lng, calls Google Maps Directions API with `mode=transit`
- Deletes existing travel_segments for the trip, then inserts new ones with duration, distance, mode, and polyline
- Returns summary of computed segments
- Uses `GOOGLE_MAPS_API_KEY` secret

### `supabase/functions/fetch-weather/index.ts`
- Accepts POST body: `{ tripId: string, lat: number, lng: number }`
- Creates a Supabase client with the service role key
- Gets the trip's date range
- Calls OpenWeatherMap forecast API (5-day/3-hour or One Call API) for the location
- Upserts results into `weather_cache` (trip_id, date, hour, temp_c, condition, icon_code, etc.)
- Returns the weather data
- Uses `OPENWEATHERMAP_API_KEY` secret

**Modified: `supabase/config.toml`**
- Add function configs with `verify_jwt = false` (auth handled in code)

---

## Step 9: Wire Header Buttons

**Modified: `src/components/timeline/TimelineHeader.tsx`**
- Add "Generate Travel Times" button (organizer only) -- calls the `google-directions` edge function
- Add "Update Weather" button (organizer only) -- calls the `fetch-weather` edge function
- Both show loading spinners while processing
- Toast notifications on success/failure

---

## Step 10: Updated Types

**Modified: `src/types/trip.ts`**
- Add `TravelSegment` type matching the database schema
- Add `WeatherData` type matching the `weather_cache` schema
- Update `Trip` type to include `owner_id`, `timezone`, `category_presets`
- Add `EntryWithOptionsAndWeather` type that includes weather data per entry

---

## Build Sequence

Given the size, implementation will follow this order:
1. Request API keys (Google Maps + OpenWeatherMap)
2. Types update (`trip.ts`)
3. Utility/lib files (`sunCalc.ts`, `timeOfDayColor.ts`, `overlapLayout.ts`)
4. Admin auth (`useAdminAuth.ts`, `Auth.tsx`)
5. Dashboard + Wizard pages and components
6. Calendar timeline components (`TimeSlotGrid.tsx`, `CalendarDay.tsx`, `TravelSegment.tsx`, `WeatherBadge.tsx`)
7. Edge functions (`google-directions`, `fetch-weather`)
8. Config updates (`config.toml`)
9. Route updates (`App.tsx`)
10. Wire everything in `Timeline.tsx`, `TimelineHeader.tsx`, `EntryCard.tsx`
11. Update `UserSelect.tsx` for trip-specific member selection

This is approximately 20+ files to create/modify. The implementation will be done in one pass.


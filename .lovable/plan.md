

# Major Evolution: Multi-Tenancy, Travel Time, Weather Cards, Calendar Timeline

This plan transforms the app from a single-trip viewer into a full multi-tenant trip platform with admin authentication, a trip creation wizard, Google Maps transit times, weather-aware card backgrounds, and a true calendar-style timeline.

---

## Overview of Changes

1. **Admin authentication** (email + password via Supabase Auth)
2. **Multi-tenancy** (one admin creates many trips, each with its own member list)
3. **Trip creation wizard** (step-by-step, skippable questions)
4. **Calendar-style timeline** (full day with time slots, gaps, click-to-create, horizontal scroll for overlaps)
5. **Travel time between entries** (Google Maps Directions API with a "Generate All" button)
6. **Weather-aware card backgrounds** (time-of-day gradient + live weather graphics via "Update" button)

---

## 1. Admin Authentication

**What changes:**
- You (the admin) log in with email + password using Supabase Auth
- Trip members continue using the name-select approach (no change for them)
- A new `/auth` page for admin login/signup
- The landing page (`/`) becomes a trip dashboard showing all your trips
- Admin session is stored via Supabase Auth; member sessions continue using localStorage

**New pages/routes:**
- `/auth` -- Admin login/signup form
- `/` -- Admin dashboard (list of trips, create new trip button)
- `/trip/:tripId` -- The trip timeline (accessed by members via a shared link, or by admin from dashboard)

---

## 2. Multi-Tenancy Database Changes

**Current state:** `trip_users` is a global table with no trip association. One trip exists.

**New schema changes:**

- Add `trip_id` column to `trip_users` (foreign key to `trips`)
- Add `owner_id` column to `trips` (the Supabase Auth user ID of the admin who created it)
- Add `timezone` column to `trips` (so each trip can have its own timezone setting)
- Add `category_presets` column to `trips` (JSONB array of `{name, color}` objects -- the default categories for that trip)
- Create a `travel_segments` table for storing computed transit times between consecutive entries
- Create RLS policies scoped to the admin's auth ID for trips, and trip membership for trip_users

**`travel_segments` table:**
```text
id            uuid PK
trip_id       uuid FK -> trips
from_entry_id uuid FK -> entries
to_entry_id   uuid FK -> entries
duration_min  integer
distance_km   numeric
mode          text (e.g. "transit", "walking")
polyline      text (encoded route for optional map display)
created_at    timestamptz
```

---

## 3. Trip Creation Wizard

A step-by-step flow where each step has a "Skip" button. Steps:

1. **Trip name** -- text input with placeholder suggestions
2. **Date range** -- start and end date pickers
3. **Location / Timezone** -- select timezone (UK, Amsterdam, or custom)
4. **Category presets** -- add custom category names + pick colors for each (or use defaults)
5. **Members** -- add names and assign roles (organizer/editor/viewer). The admin is automatically the organizer.

After completing (or skipping through), the trip is created and the admin lands on its timeline.

---

## 4. Calendar-Style Timeline

**Current:** Cards stacked vertically with spacing classes, no sense of actual time gaps.

**New:** A true day-planner layout where:

- Each day renders a vertical time axis (e.g. 06:00 to 00:00) with hour/half-hour markers
- Entry cards are **positioned absolutely** based on their start/end time, with height proportional to duration
- **Empty gaps** between entries are visible and clickable -- tapping an empty slot pre-fills a new entry form with that time
- **Overlapping entries** (entries whose time ranges overlap) are laid out in columns side by side, scrollable horizontally if they exceed the viewport width
- The zoom levels still work, controlling how many pixels per hour the timeline uses

**Technical approach:**
- Calculate pixel position: `top = (minutesSinceDayStart / totalMinutesVisible) * containerHeight`
- For overlaps: detect which entries share time ranges, assign them to "columns" (like a calendar algorithm), render them side by side within a horizontally scrollable container
- Click-to-create: register click position on the time axis, convert pixel offset back to a time, open the entry form pre-filled

---

## 5. Travel Time (Google Maps Directions API)

**How it works:**
- An edge function calls the Google Maps Directions API to compute public transit time + distance between consecutive entries
- The admin taps a **"Generate Travel Times"** button in the header
- The edge function iterates through all entries for the trip (sorted by start_time), computes transit directions from each entry's location to the next entry's location, and stores results in the `travel_segments` table
- Between entries on the timeline, a **travel card** appears showing: duration (e.g. "35 min by transit"), distance, and departure guidance (e.g. "Leave by 14:25 to arrive on time")
- These are **suggestion-style inserts** -- they appear between real entries, styled differently (smaller, muted, with a train/bus icon)

**Requirements:**
- Google Maps API key (stored as a secret in the backend)
- Edge function: `google-directions` that accepts from/to coordinates and returns transit time
- Only entries with lat/lng set are included in the calculation

---

## 6. Weather-Aware Card Backgrounds

**Two layers to the card background:**

**Layer 1 -- Time-of-day gradient:**
- Calculate sunrise and sunset times for the trip location and date (using a solar position formula -- no API needed, just math based on lat/lng and date)
- Map the entry's time to a color on this scale:
  - Pre-dawn: deep indigo/navy
  - Sunrise: warm orange/pink
  - Morning: soft golden
  - Midday: bright sky blue
  - Afternoon: warm amber
  - Sunset: deep orange/pink/purple
  - Night: dark blue/indigo
- This gradient appears on the right side of the card, fading from the image (or a default texture) on the left

**Layer 2 -- Weather graphics:**
- A small weather overlay with cute icons (sun, clouds, rain, snow, etc.) and temperature
- Weather data fetched via an edge function that calls a weather API (OpenWeatherMap free tier)
- An **"Update Weather"** button in the header fetches current/forecast weather for the trip dates and location, stores results
- Weather icons are rendered as small SVG graphics on the card

**Requirements:**
- OpenWeatherMap API key (stored as a secret)
- Edge function: `fetch-weather` that accepts lat/lng and date range, returns forecast data
- A `weather_cache` table to store fetched weather data per trip per date

**`weather_cache` table:**
```text
id           uuid PK
trip_id      uuid FK -> trips
date         date
hour         integer
temp_c       numeric
condition    text (e.g. "clear", "clouds", "rain", "snow")
icon_code    text
humidity     integer
wind_speed   numeric
created_at   timestamptz
updated_at   timestamptz
```

---

## Technical Details

### New Files

| File | Purpose |
|------|---------|
| `src/pages/Auth.tsx` | Admin login/signup page |
| `src/pages/Dashboard.tsx` | Admin trip list + "Create Trip" button |
| `src/pages/TripWizard.tsx` | Step-by-step trip creation wizard |
| `src/components/timeline/CalendarDay.tsx` | New calendar-style day layout with time axis, positioned cards, gap detection |
| `src/components/timeline/TimeSlotGrid.tsx` | Time axis rendering with hour markers and click-to-create |
| `src/components/timeline/TravelSegment.tsx` | Travel time card shown between entries |
| `src/components/timeline/WeatherBadge.tsx` | Small weather overlay for cards |
| `src/components/wizard/WizardStep.tsx` | Reusable wizard step container with skip/next |
| `src/components/wizard/NameStep.tsx` | Trip name input step |
| `src/components/wizard/DateStep.tsx` | Date range step |
| `src/components/wizard/TimezoneStep.tsx` | Timezone selection step |
| `src/components/wizard/CategoryStep.tsx` | Category presets step |
| `src/components/wizard/MembersStep.tsx` | Add members step |
| `src/hooks/useAdminAuth.ts` | Supabase Auth hook for admin login/session |
| `src/hooks/useSunTimes.ts` | Solar position calculations for sunrise/sunset |
| `src/lib/sunCalc.ts` | Pure math functions for solar position (no API needed) |
| `src/lib/timeOfDayColor.ts` | Maps a time + sun position to an HSL color |
| `src/lib/overlapLayout.ts` | Calendar overlap algorithm -- assigns entries to columns |
| `supabase/functions/google-directions/index.ts` | Edge function for Google Maps Directions API |
| `supabase/functions/fetch-weather/index.ts` | Edge function for OpenWeatherMap API |

### Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Add routes for `/auth`, `/`, `/trip/:tripId`, `/trip/:tripId/wizard` |
| `src/pages/Timeline.tsx` | Accept `tripId` from URL params; integrate weather data; use new CalendarDay layout; add "Generate Travel" and "Update Weather" buttons |
| `src/components/timeline/EntryCard.tsx` | Replace static background with time-of-day gradient + weather badge; adjust layout for calendar positioning |
| `src/components/timeline/TimelineHeader.tsx` | Add "Generate Travel Times" and "Update Weather" buttons; show trip name from trip data |
| `src/components/timeline/EntryForm.tsx` | Accept pre-filled time from click-to-create |
| `src/hooks/useCurrentUser.ts` | Add admin auth awareness -- if Supabase Auth session exists, treat as admin |
| `src/types/trip.ts` | Add `TravelSegment`, `WeatherData` types; update `Trip` type with new fields |
| `supabase/config.toml` | Add edge function configs for `google-directions` and `fetch-weather` |

### Database Migration

One migration covering:
- Add `trip_id` to `trip_users` with FK to `trips` (nullable initially, then backfill existing data)
- Add `owner_id` to `trips` (nullable, text -- stores Supabase Auth user ID)
- Add `timezone`, `category_presets` columns to `trips`
- Create `travel_segments` table
- Create `weather_cache` table
- Enable realtime on `travel_segments` and `weather_cache`
- RLS policies for all new/modified tables

### API Keys Needed

Two API keys will need to be stored as secrets:
1. **Google Maps API key** -- for the Directions API (transit routing)
2. **OpenWeatherMap API key** -- for weather forecasts (free tier available)

These will be requested before implementation begins.

### Overlap Layout Algorithm

The calendar overlap detection works like this:
1. Sort entries by start time
2. For each entry, check if it overlaps with any already-placed entry
3. If it overlaps, assign it to the next available column
4. Track the maximum number of columns needed
5. Each entry's width = `100% / maxColumns`, positioned at `column * width`
6. If total columns exceed ~3, wrap in a horizontally scrollable container

### Build Order

1. **Database migration** (new columns and tables)
2. **Admin auth** (`Auth.tsx`, `useAdminAuth.ts`)
3. **Dashboard + Wizard** (trip listing, step-by-step creation)
4. **Calendar timeline** (`CalendarDay.tsx`, `TimeSlotGrid.tsx`, `overlapLayout.ts`, click-to-create)
5. **Time-of-day gradient** (`sunCalc.ts`, `timeOfDayColor.ts`, updated `EntryCard.tsx`)
6. **API keys** (request Google Maps + OpenWeatherMap keys)
7. **Travel time** (edge function + `TravelSegment.tsx` + "Generate" button)
8. **Weather** (edge function + `WeatherBadge.tsx` + `weather_cache` + "Update" button)
9. **Routing update** (`App.tsx` with new routes, `Timeline.tsx` with tripId param)
10. **Polish** (backfill existing trip data with new trip_id on trip_users, test flows)


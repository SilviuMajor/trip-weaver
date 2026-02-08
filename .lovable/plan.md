

# Updated Plan: Use Open-Meteo for Weather (No API Key Needed)

This updates the previously approved plan with one key change: replacing OpenWeatherMap with Open-Meteo for weather data. Everything else from the approved plan remains the same.

---

## What changes from the previous plan

**Removed:**
- No longer need an `OPENWEATHERMAP_API_KEY` secret -- Open-Meteo is 100% free with no authentication required
- Only one API key is needed now: `GOOGLE_MAPS_API_KEY` for transit directions

**Updated: `fetch-weather` edge function**
- Instead of calling OpenWeatherMap, it calls the Open-Meteo Forecast API directly:
  `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&hourly=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&start_date={start}&end_date={end}&timezone=auto`
- No API key header needed -- just a plain GET request
- Open-Meteo returns WMO weather codes (0-99) which map to conditions like clear, cloudy, rain, snow, thunderstorm
- Response includes hourly temperature, humidity, wind speed, and weather codes
- Data is upserted into the same `weather_cache` table as before

---

## Everything else stays the same

The full build from the approved plan is unchanged:

1. Request **one** API key (Google Maps only)
2. Database migration (backfill `trip_users`, `updated_at` trigger)
3. Admin authentication (`Auth.tsx`, `useAdminAuth.ts`)
4. Dashboard + Trip Wizard (5-step flow)
5. Calendar-style timeline (`CalendarDay.tsx`, `TimeSlotGrid.tsx`, `overlapLayout.ts`)
6. Time-of-day gradients (`sunCalc.ts`, `timeOfDayColor.ts`)
7. Travel time edge function (`google-directions`)
8. Weather edge function (`fetch-weather` -- now using Open-Meteo)
9. Weather badges on cards (`WeatherBadge.tsx`)
10. Route updates, wiring, and polish

---

## Technical details for the Open-Meteo integration

### Open-Meteo API call (inside the edge function)

The endpoint is a simple GET request with query parameters:

```text
GET https://api.open-meteo.com/v1/forecast
  ?latitude=52.37
  &longitude=4.90
  &hourly=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m
  &start_date=2026-03-15
  &end_date=2026-03-20
  &timezone=auto
```

No headers or authentication needed.

### WMO Weather Code mapping

Open-Meteo uses WMO standard codes. The edge function will map these to friendly conditions:

| Code range | Condition | Icon |
|-----------|-----------|------|
| 0 | Clear sky | Sun |
| 1-3 | Partly cloudy | Partly cloudy |
| 45, 48 | Fog | Fog |
| 51-57 | Drizzle | Light rain |
| 61-67 | Rain | Rain |
| 71-77 | Snow | Snow |
| 80-82 | Rain showers | Rain |
| 85-86 | Snow showers | Snow |
| 95-99 | Thunderstorm | Thunderstorm |

### Edge function: `fetch-weather`

- Accepts POST body: `{ tripId: string, lat: number, lng: number }`
- Creates a Supabase client with the service role key
- Gets the trip's date range from the database
- Calls Open-Meteo forecast API (no key needed)
- Maps WMO weather codes to human-readable conditions
- Upserts hourly results into `weather_cache` table
- Returns the weather data

### Build sequence (updated)

1. Request Google Maps API key (only one secret needed now)
2. Types update (`trip.ts`)
3. Utility/lib files (`sunCalc.ts`, `timeOfDayColor.ts`, `overlapLayout.ts`)
4. Admin auth (`useAdminAuth.ts`, `Auth.tsx`)
5. Dashboard + Wizard pages and components
6. Calendar timeline components
7. Edge functions (`google-directions` + `fetch-weather` using Open-Meteo)
8. Config and route updates
9. Wire everything together
10. Polish and backfill

This is still approximately 20+ files. The implementation will be done in one pass, and now only requires one API key from you instead of two.


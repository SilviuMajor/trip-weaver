

# Hotel System Overhaul: Upload/Manual Entry, Hotels Table, Auto Night Assignment

## Overview

This is a significant restructure of the hotel flow. We add a `hotels` table, a booking parser edge function, and completely rebuild the HotelWizard with upload support, date-based night assignment (no manual checkboxes), and check-in/checkout blocks.

---

## 1. Database Migration

### New `hotels` table

```sql
CREATE TABLE hotels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  website TEXT,
  phone TEXT,
  rating NUMERIC(2,1),
  user_rating_count INTEGER,
  google_place_id TEXT,
  google_maps_uri TEXT,
  check_in_date DATE,
  check_in_time TIME DEFAULT '15:00',
  checkout_date DATE,
  checkout_time TIME DEFAULT '11:00',
  evening_return TIME DEFAULT '22:00',
  morning_leave TIME DEFAULT '08:00',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;

-- Match existing pattern: open access (same as entries, entry_options, etc.)
CREATE POLICY "Anyone can view hotels" ON hotels FOR SELECT USING (true);
CREATE POLICY "Anyone can insert hotels" ON hotels FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update hotels" ON hotels FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete hotels" ON hotels FOR DELETE USING (true);
```

Note: The user's proposed RLS references `trip_members` which doesn't exist. All other tables (entries, entry_options, travel_segments, etc.) use open `true` policies, so we follow the same pattern for consistency.

### Add `hotel_id` to `entry_options`

```sql
ALTER TABLE entry_options ADD COLUMN hotel_id UUID REFERENCES hotels(id) ON DELETE SET NULL;
```

---

## 2. New Edge Function: `parse-hotel-booking`

Create `supabase/functions/parse-hotel-booking/index.ts` -- exact same structure as `parse-flight-booking`:

- Same CORS headers
- Accepts `{ fileBase64, mimeType }`
- System prompt for hotel booking extraction (name, address, dates, times, room type, confirmation number)
- Tool calling with `extract_hotel` function (single object, not array)
- Same 429/402 error handling
- Same JSON fallback parsing

Add to `supabase/config.toml`:
```toml
[functions.parse-hotel-booking]
verify_jwt = false
```

---

## 3. Restructured HotelWizard (5 steps: 0-4)

### Step 0 -- Entry Method (NEW)
Two large buttons:
- "Upload Booking Confirmation" -- file picker (image/pdf), calls `parse-hotel-booking`, shows loading spinner
- "Enter Manually" -- proceeds to Step 1 with empty fields

### Step 1 -- Hotel Details
- Google Places search (pre-populated with parsed name if from upload)
- If from parser: show extracted name/address, allow edit
- When place selected: merge parser dates/times with Places location data

### Step 2 -- Dates and Times
- Check-in date + time pickers (pre-filled from parser or trip start + 15:00)
- Checkout date + time pickers (pre-filled from parser or trip end + 11:00)
- Validation: checkout after check-in
- Shows calculated number of nights
- Date pickers constrained to trip date range (with slight overflow allowed)

### Step 3 -- Daily Defaults
- Evening return time (default 22:00)
- Morning leave time (default 08:00)
- Summary line: "{name} . {N} nights . return {time} -> leave {time}"

### Step 4 -- Review and Another Hotel
- Summary card for current hotel
- Previously added hotels listed
- "Add Another Hotel" (resets to Step 0) | "Finish" (creates all)

### On "Finish" -- Entry Generation (per hotel)

Night assignment is **automatic** based on check-in/checkout dates (no manual checkbox selection).

For each hotel:
1. **Insert into `hotels` table** with all metadata
2. **Check-in block**: 1hr entry starting at check_in_time on check_in_date. Option name: "Check in . {name}", category: hotel, hotel_id set
3. **Overnight blocks** (one per night, from check-in date to checkout date - 1):
   - Start: evening_return on that day
   - End: morning_leave on next day
   - Option name: "{name}", category: hotel, hotel_id set
4. **Checkout block**: 1hr entry ending at checkout_time on checkout_date. Option name: "Check out . {name}", category: hotel, hotel_id set
5. **Photos**: Insert into `option_images` for every entry_option created

---

## 4. TypeScript Type Updates

### `src/types/trip.ts`

Add `Hotel` interface with all fields matching the table schema.

Add `hotel_id: string | null` to `EntryOption` interface.

---

## 5. Files Modified

| File | Change |
|------|--------|
| `supabase/functions/parse-hotel-booking/index.ts` | NEW -- hotel booking parser edge function |
| `src/components/timeline/HotelWizard.tsx` | Complete rewrite with 5-step flow, upload support, date-based nights |
| `src/types/trip.ts` | Add `Hotel` interface, add `hotel_id` to `EntryOption` |
| Database migration | Create `hotels` table, add `hotel_id` column to `entry_options` |

## 6. What Does NOT Change

- EntrySheet.tsx, EntryCard.tsx, ContinuousTimeline.tsx
- Transport, flight, SNAP, drag chain, undo systems
- Category definitions
- Any other existing components



# Part 1: Fix Google Maps Links + Part 2: Remove Destination Field

## Part 1 — Fix Google Maps Links

### Problem

There are two issues with Google Maps links:

1. **MapPreview component** (shown in the event detail sheet): Uses `https://www.google.com/maps?q={lat},{lng}` which is an older format. Should use the official `https://www.google.com/maps/search/?api=1&query={lat},{lng}` format for better cross-platform support (opens in Maps app on mobile, new tab on desktop).

2. **EntryCard (timeline cards)**: The MapPin icon on event cards only shows distance -- it is NOT a link to Google Maps. There is no way to tap a location on the card to open maps. We need to add a tappable location/address element on the full-size EntryCard.

### Changes

**File: `src/components/timeline/MapPreview.tsx`**

- Update the Google Maps URL from `https://www.google.com/maps?q={lat},{lng}` to `https://www.google.com/maps/search/?api=1&query={lat},{lng}`
- If `place_id` is available (it is not currently passed as a prop), use the place ID format instead -- but since `place_id` is not stored in `entry_options`, we will use the lat/lng format which works correctly
- The `target="_blank"` and `rel="noopener noreferrer"` are already in place, which handles desktop (new tab) and mobile (Maps app) correctly

**File: `src/components/timeline/EntryCard.tsx`**

- In the full-size card layout (the default, lines 683-896), add a tappable location row below the title that opens Google Maps
- Show `option.location_name` with a MapPin icon; tapping it opens `https://www.google.com/maps/search/?api=1&query={lat},{lng}` in a new tab
- Only render this when `option.location_name` exists and `option.latitude`/`option.longitude` are available
- Use `e.stopPropagation()` to prevent the card's onClick from firing
- For the condensed card layout (lines 588-681), add a similar but smaller tappable location line

---

## Part 2 — Remove Destination Field from Trip Settings

### Problem

The "Destination" field in Trip Settings is redundant since destinations are now auto-generated from event locations on the dashboard.

### Changes

**File: `src/pages/TripSettings.tsx`**

- Remove the `tripDestination` state variable (line 51)
- Remove `setTripDestination(t.destination ?? '')` from the data fetch (line 88)
- The section header comment on line 251 says "Name and Destination" -- update to just "Trip Name"
- No destination input field is currently rendered (it was already removed from the JSX based on the memory note), so the main cleanup is removing the unused state variable and the fetch assignment

---

## What is NOT changed

- Auto-generated destination logic on dashboard
- Event card styling (beyond adding the tappable location link)
- Google Places search functionality
- Transport card rendering
- EntrySheet MapPreview layout (only the URL format)

## Test cases

1. Tap location on any full-size event card -- Google Maps opens with correct location
2. Tap Google Maps button in event detail sheet (MapPreview) -- opens correct location
3. Works on desktop (new tab) and mobile (Maps app)
4. Trip Settings page no longer has destination-related state
5. Dashboard trip card still shows auto-generated destinations

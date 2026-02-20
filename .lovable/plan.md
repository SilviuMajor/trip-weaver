

# Phase 1a — Photo URL Fix + Timezone Fix + Migrations

## Overview
Fix two systemic bugs and migrate existing data:
1. Photos from Google Places stored as `{url, attribution}` objects instead of URL strings -- broken across all entry types
2. `localToUTC` uses browser-local timezone interpretation, shifting entry times by the browser's UTC offset

Both fixes ship with in-app data migrations that run automatically on timeline load.

## Changes

### Bug 1: Photo URL Normalisation (5 fixes + 1 migration)

**Fix 1a: `src/components/timeline/PlacesAutocomplete.tsx` (line 102)**
Normalise `data.photos` from `{url, attribution}` objects to plain URL strings. This cascades to fix EntrySheet creation, PhotoStripPicker previews, and all downstream consumers.

**Fix 1b: `src/components/timeline/HotelWizard.tsx` (line 212)**
Normalise photos in `autoEnrichFromParsedName` (direct edge function call).

**Fix 1c: `src/components/timeline/HotelWizard.tsx` (line 262)**
Normalise photos in `selectCandidate` (direct edge function call).

**Fix 1d: `src/pages/Timeline.tsx` (lines 386-391)**
Normalise photos in `handleAddToPlanner` before inserting into `option_images`.

**Fix 1e: `src/pages/Timeline.tsx` (lines 469-474)**
Normalise photos in `handleAddAtTime` before inserting into `option_images`.

**Fix 1f: Photo data migration in `src/pages/Timeline.tsx`**
Add a `useEffect` with ref guard that scans `option_images` for this trip, finds rows where `image_url` starts with `{`, parses the JSON to extract the `.url` field, and updates the row. Unrecoverable rows are deleted. Idempotent -- only touches broken rows. Triggers `fetchData()` refresh on completion.

### Bug 2: Timezone Fix (1 fix + 1 migration)

**Fix 2a: `src/lib/timezoneUtils.ts` (line 30)**
Add `Z` suffix to `new Date(\`...\`)` so JavaScript interprets it as UTC instead of browser-local time. One character fix that corrects all 30+ call sites across 4 files.

**Fix 2b: Timezone data migration in `src/pages/Timeline.tsx`**
Add a `useEffect` with ref + localStorage guard (`tz_migrated_{tripId}`) that corrects existing entry timestamps. For each entry, calculates what the browser's UTC offset was at that time (using `trip.home_timezone`), and adds it back to the stored timestamp. Handles DST transitions per-entry. Runs once per trip, persisted via localStorage.

## What does NOT change
- `utcToLocal`, `getHourInTimezone`, `resolveEntryTz`, `resolveDropTz` in timezoneUtils.ts
- EntrySheet.tsx handleSave, handlePlaceSelect (downstream of PlacesAutocomplete fix)
- PhotoStripPicker.tsx, EntryCard.tsx image rendering
- google-places edge function (correctly returns objects; fix is consumer-side)
- ContinuousTimeline.tsx drag/snap logic
- Entry/option copy paths in Timeline.tsx

## Files modified
| File | Change |
|------|--------|
| `src/lib/timezoneUtils.ts` | Line 30: add `Z` suffix |
| `src/components/timeline/PlacesAutocomplete.tsx` | Line 102: normalise photos |
| `src/components/timeline/HotelWizard.tsx` | Lines 212, 262: normalise photos |
| `src/pages/Timeline.tsx` | Lines 386-391, 469-474: normalise photos; add photo migration + timezone migration effects |

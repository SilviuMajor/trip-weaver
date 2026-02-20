

# Accounts & Sharing -- Phase 3: Global Planner

## Overview
Rename "My Places" to "Global Planner", update it to show places from all trips the user is a member of (not just owned), and add trip name attribution to each place.

## Changes

### 1. `src/types/trip.ts` -- Add `source_trip_name` field
- Add `source_trip_name?: string | null;` to `GlobalPlace` interface after `source_trip_id` (line 184)

### 2. `src/pages/GlobalPlanner.tsx` -- Query by membership + attribution

**a) Rename header** (line 308):
- Change `'My Places'` to `'Global Planner'`

**b) Query trips by membership** (lines 110-116):
- Replace `trips` query (which filters by `owner_id`) with a two-step approach:
  1. Query `trip_users` for all trips where `user_id = adminUser.id`
  2. Query `trips` with `.in('id', tripIds)` and include `name` in the select

**c) Build trip name lookup** (after trips query):
- Create `tripNameMap = new Map<string, string>()` from the trips result

**d) Add trip name to each place** (line 168, after `source_trip_id`):
- Add `source_trip_name: entry?.trip_id ? tripNameMap.get(entry.trip_id) ?? null : null`

**e) Trip attribution in city category view** (lines 366-374):
- After `SidebarEntryCard`, add a small `<p>` showing `"from {place.source_trip_name}"` when available

**f) Trip attribution in unsorted places list** (lines 441-448):
- Inside the address/rating flex div, add a span showing `"· {place.source_trip_name}"` when available

### 3. `src/pages/Dashboard.tsx` -- Rename button (lines 175-176)
- Change "My Places" to "Global Planner"
- Change "All saved places" to "All places across your trips"

## What does NOT change
- GlobalExplore.tsx, Timeline.tsx, EntrySheet.tsx, or any trip-scoped pages
- City/country grouping logic
- Visited/want-to-go status logic
- Deduplication logic

## Files modified
| File | Change |
|------|--------|
| `src/types/trip.ts` | Add `source_trip_name` to GlobalPlace |
| `src/pages/GlobalPlanner.tsx` | Rename header, query by membership, add tripNameMap, show trip attribution |
| `src/pages/Dashboard.tsx` | Rename button label |



# Global Places Table, Sync Edge Function, and Global Planner Page

## Overview
This is a multi-part feature: create a `global_places` database table, a sync edge function, a `GlobalPlace` TypeScript type, dashboard navigation buttons, routes, and a new Global Planner page showing all saved places.

## Part 1: Database Migration

Create the `global_places` table with the exact schema from the prompt: columns for place data, status/source enums via CHECK constraints, RLS policies scoped to `auth.uid() = user_id`, indexes for fast lookups, and a partial unique index on `(user_id, google_place_id)`.

Also add the `updated_at` trigger reusing the existing `update_updated_at_column()` function.

## Part 2: Edge Function `sync-global-places`

Create `supabase/functions/sync-global-places/index.ts`.

- Accepts `{ userId, tripId? }` in POST body
- Uses service role key to query `entries` joined with `trips` (filtering by `owner_id = userId`)
- Fetches related `entry_options` with non-null `google_place_id`
- Skips transport/airport categories
- Determines `status` based on whether the trip's `end_date` is in the past
- Upserts into `global_places` on the `(user_id, google_place_id)` conflict target
- Returns `{ synced: N }`

Add to `supabase/config.toml`:
```toml
[functions.sync-global-places]
verify_jwt = false
```

## Part 3: TypeScript Type

Add `GlobalPlace` interface to `src/types/trip.ts` with all columns typed.

## Part 4: Dashboard Navigation

In `src/pages/Dashboard.tsx`, add two navigation cards ("My Places" and "Explore") in a horizontal row between the header and the trip list. Import `ClipboardList` and `Search` from lucide-react.

## Part 5: Routes

In `src/App.tsx`, add:
- `/planner` -> `GlobalPlanner`
- `/explore` -> placeholder `NotFound` (for Phase F)

## Part 6: GlobalPlanner Page

Create `src/pages/GlobalPlanner.tsx`:

- **Auth guard**: Uses `useAdminAuth`, redirects to `/auth` if not logged in
- **Data fetch**: On mount, fetches `global_places` for current user. If empty, auto-invokes `sync-global-places` edge function, then refetches
- **Filter tabs**: "All", "Visited", "Want to Go" -- styled as rounded pills matching existing patterns
- **Sync button**: RefreshCw icon in header, triggers the sync function with loading spinner
- **Place cards**: Each card shows category emoji (looked up from `findCategory`), name, address (truncated), rating stars, and status badge (green for visited, blue for want_to_go)
- **Tapping a card**: Opens a Drawer with PlaceOverview using a temporary `EntryWithOptions` built from GlobalPlace data (same pattern as Explore's `buildTempEntry`)
- **Back button**: Navigates to `/`

### Layout
```text
+------------------------------------------+
| <- Back              My Places    [Sync] |
|                                          |
| [All] [Visited] [Want to Go]            |
|                                          |
| restaurant De Kas            Visited     |
| Amsterdam, NL  * 4.5                     |
|                                          |
| museum Rijksmuseum           Visited     |
| Amsterdam, NL  * 4.7                     |
|                                          |
| coffee Lot Sixty One        Want to Go   |
| Amsterdam  * 4.3                         |
+------------------------------------------+
```

## Files Summary

| File | Change |
|------|--------|
| Database migration | Create `global_places` table, indexes, RLS policies, updated_at trigger |
| `supabase/config.toml` | Add `sync-global-places` function config |
| `supabase/functions/sync-global-places/index.ts` | New edge function |
| `src/types/trip.ts` | Add `GlobalPlace` interface |
| `src/App.tsx` | Add `/planner` and `/explore` routes |
| `src/pages/Dashboard.tsx` | Add "My Places" and "Explore" navigation cards |
| `src/pages/GlobalPlanner.tsx` | New page with place list, filters, sync, and PlaceOverview drawer |


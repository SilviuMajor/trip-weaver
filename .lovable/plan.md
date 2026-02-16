
# Global Planner Fixes: Auto-sync, All Entries, Geocoding, and UI Cleanup

## Overview
Six fixes to make the Global Planner immediately useful: auto-sync on load, sync all entries (not just Google-linked), remove star feature, remove Explore button, improve geocoding with address fallback, and show instant results while sync runs.

## Fix 1: Auto-sync on Page Load

**File: `src/pages/GlobalPlanner.tsx`**

Change the mount `useEffect` (lines 117-125) to always trigger sync on load, not just when the table is empty. Run sync in background while showing a loading/syncing state.

```typescript
useEffect(() => {
  if (!adminUser) return;
  // Fetch existing places immediately for instant display
  fetchPlaces();
  // Always sync in background
  syncPlaces();
}, [adminUser]);
```

## Fix 2: Sync ALL Entries (Not Just Google-linked)

**File: `supabase/functions/sync-global-places/index.ts`**

- Remove the `.not('google_place_id', 'is', null)` filter (line 89)
- Instead filter to entries that have a `name` AND either (latitude + longitude) or an address
- Expand the skip list to include `flight`, `hotel` in addition to `transfer`, `transport`, `airport_processing`
- For entries without `google_place_id`, use a name+coordinates dedup approach: before inserting, check if a `global_place` already exists for the same user with matching name and coordinates within ~100m
- For entries WITH `google_place_id`, continue using the existing upsert on `user_id,google_place_id`

Updated flow:
```
1. Fetch ALL entry_options (remove google_place_id filter)
2. For each option:
   - Skip if category in [flight, hotel, transfer, transport, airport_processing]
   - Skip if no name
   - Skip if no coordinates AND no address
   - If has google_place_id -> upsert on (user_id, google_place_id) conflict
   - If no google_place_id -> check for existing match by name + nearby coords, insert only if no match
```

## Fix 3: Remove Star/Favourite Feature

**File: `src/components/timeline/PlaceOverview.tsx`**

- Remove `isStarred` state (line 163)
- Remove the star status check `useEffect` (lines 166-179)
- Remove `handleToggleStar` function (lines 181-201)
- Remove the star button JSX (lines 523-530)
- Remove `Star` from the lucide-react import if no longer used elsewhere in the file (check first -- it may be used in PlaceDetailsSection)

## Fix 4: Remove Explore Button from Dashboard

**File: `src/pages/Dashboard.tsx`**

- Remove the Explore button (lines 176-187)
- Change grid from `grid-cols-2` to just a single full-width button for "My Places"
- Remove `Search` from the lucide-react import

## Fix 5: Populate City/Country with Address Fallback

**File: `supabase/functions/sync-global-places/index.ts`**

Add an `extractCityCountry` fallback function that parses the address string:
```typescript
const extractCityCountry = (address: string | null): { city: string | null; country: string | null } => {
  if (!address) return { city: null, country: null };
  const parts = address.split(',').map(s => s.trim());
  if (parts.length >= 3) {
    const cityPart = parts[parts.length - 2];
    const city = cityPart.replace(/^\d{4,6}\s*[A-Z]{0,2}\s*/, '').trim();
    const country = parts[parts.length - 1].trim();
    return { city: city || null, country: country || null };
  }
  if (parts.length === 2) {
    return { city: parts[0], country: parts[1] };
  }
  return { city: null, country: null };
};
```

In the geocoding step:
- First try Google reverse geocode (existing logic)
- If Google geocoding returns no result or API key is missing, fall back to `extractCityCountry(address)`
- Apply this to all places missing city/country

**File: `src/pages/GlobalPlanner.tsx`**

Add the same `extractCityCountry` as a client-side fallback. In the `grouped` memo, for places with null city/country but an address, derive city/country from the address before grouping.

## Fix 6: Show Places Immediately via Direct Query

**File: `src/pages/GlobalPlanner.tsx`**

While sync runs in the background, also do a direct query of `entries` + `entry_options` joined through the user's trips to show results instantly.

On mount:
1. Fetch existing `global_places` (instant display)
2. In parallel, query entries directly from user's trips as a fallback
3. Start background sync
4. When sync completes, refetch `global_places` (now fully populated)

```typescript
const fetchDirectPlaces = async (): Promise<GlobalPlace[]> => {
  if (!adminUser) return [];
  // Get user's trip IDs
  const { data: trips } = await supabase
    .from('trips')
    .select('id, end_date')
    .eq('owner_id', adminUser.id);
  if (!trips?.length) return [];

  const tripIds = trips.map(t => t.id);
  const { data: entries } = await supabase
    .from('entries')
    .select('id, trip_id, is_scheduled')
    .in('trip_id', tripIds);
  if (!entries?.length) return [];

  const { data: options } = await supabase
    .from('entry_options')
    .select('*')
    .in('entry_id', entries.map(e => e.id));

  // Convert to GlobalPlace format, skip flights/hotels/transfers
  // Apply extractCityCountry for grouping
  // Deduplicate by google_place_id or name+coords
};
```

Merge direct results with `global_places` results, preferring `global_places` entries (which have proper city/country from geocoding).

## Files Summary

| File | Change |
|------|--------|
| `supabase/functions/sync-global-places/index.ts` | Remove google_place_id filter, add flight/hotel to skip list, add name+coords dedup for non-Google entries, add `extractCityCountry` fallback for geocoding |
| `src/pages/GlobalPlanner.tsx` | Auto-sync on mount, direct query fallback, client-side `extractCityCountry` for grouping |
| `src/components/timeline/PlaceOverview.tsx` | Remove star button, star state, star useEffect, and handleToggleStar |
| `src/pages/Dashboard.tsx` | Remove Explore button, make My Places full-width |

## Technical Notes

- The edge function skip list becomes: `['flight', 'hotel', 'transfer', 'transport', 'airport_processing']`
- For non-Google entries dedup: compare names case-insensitively and coordinates within ~0.001 degrees (~100m)
- The `extractCityCountry` regex handles European-style addresses like "Street, 1016 DR Amsterdam, Netherlands"
- Direct query results are converted to `GlobalPlace` shape with `source: 'trip_auto'` and synthesized IDs

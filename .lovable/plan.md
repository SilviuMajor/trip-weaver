

# Reverse Geocode City/Country + Grouped Global Planner View

## Overview
Add reverse geocoding to the sync edge function to populate `city` and `country`, then upgrade the Global Planner from a flat list to a country/city hierarchy with Netflix-style category rows when drilling into a city.

## Part 1: Update Sync Edge Function

**File: `supabase/functions/sync-global-places/index.ts`**

Add a `reverseGeocode` helper that calls the Google Geocoding API using the existing `GOOGLE_MAPS_API_KEY` secret. After upserting each place, if it has coordinates but no city/country already set, reverse geocode it. Cap at 20 geocode calls per sync to avoid API quota issues.

```typescript
const reverseGeocode = async (lat: number, lng: number, apiKey: string) => {
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&result_type=locality|administrative_area_level_1`
  );
  const data = await res.json();
  if (!data.results?.length) return { city: null, country: null };
  const components = data.results[0].address_components ?? [];
  const city = components.find((c: any) => c.types.includes('locality'))?.long_name ?? null;
  const country = components.find((c: any) => c.types.includes('country'))?.long_name ?? null;
  return { city, country };
};
```

Flow changes:
- After all upserts complete, query `global_places` for this user where `city IS NULL` and `latitude IS NOT NULL`, limit 20
- For each, call `reverseGeocode`, then update the row's `city` and `country`
- Read `GOOGLE_MAPS_API_KEY` from `Deno.env.get()`

## Part 2: Update GlobalPlanner -- Grouped View

**File: `src/pages/GlobalPlanner.tsx`**

Replace the flat list with a two-level view controlled by `selectedCity` state (already declared but unused).

### Top-level view (selectedCity is null)

Group filtered places by `country` then `city`. Places without city/country go into an "Other" section.

```typescript
const grouped = useMemo(() => {
  const filtered = statusFilter === 'all' ? places : places.filter(p => p.status === statusFilter);
  const countryMap = new Map<string, Map<string, GlobalPlace[]>>();
  const unsorted: GlobalPlace[] = [];

  filtered.forEach(place => {
    if (!place.country || !place.city) { unsorted.push(place); return; }
    if (!countryMap.has(place.country)) countryMap.set(place.country, new Map());
    const cities = countryMap.get(place.country)!;
    if (!cities.has(place.city)) cities.set(place.city, []);
    cities.get(place.city)!.push(place);
  });

  return { countryMap, unsorted };
}, [places, statusFilter]);
```

Render as country section headers with tappable city rows showing place count and a chevron. Tapping a city sets `selectedCity`.

### City detail view (selectedCity is set)

Header: back arrow + city name. Content: group the city's places by category, render each category as a horizontal scrolling row using `SidebarEntryCard` (build temporary `EntryWithOptions` from `GlobalPlace` using the existing `buildTempEntry`).

Add a visited badge overlay on cards where `status === 'visited'`.

### SidebarEntryCard visited badge

**File: `src/components/timeline/SidebarEntryCard.tsx`**

Add optional `visitedBadge?: boolean` prop. When true, render a small green check badge below the usage count badge position (top-right area, offset down):

```tsx
{visitedBadge && (
  <div className="absolute top-8 right-2 z-20">
    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-bold bg-green-500/25 text-green-300 border-green-500/20">
      Visited
    </Badge>
  </div>
)}
```

Adjust the `top` offset if `usageCount` badge is also shown (use `top-14` when both exist).

## Files Summary

| File | Change |
|------|--------|
| `supabase/functions/sync-global-places/index.ts` | Add `reverseGeocode` helper; after upserts, geocode up to 20 places missing city/country |
| `src/pages/GlobalPlanner.tsx` | Replace flat list with country/city grouped view; add city detail with Netflix category rows using SidebarEntryCard |
| `src/components/timeline/SidebarEntryCard.tsx` | Add optional `visitedBadge` prop rendering a green "Visited" badge |


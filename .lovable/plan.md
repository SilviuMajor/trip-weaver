

# "From Your Places" in Explore + Star/Favourite

## Overview
Two features: (1) show matching global places above Google results in trip Explore, and (2) add a star/favourite toggle to PlaceOverview that upserts into global_places.

## Feature 1: "From Your Places" Section in ExploreView

**File: `src/components/timeline/ExploreView.tsx`**

### New state and imports
- Import `haversineKm` from `@/lib/distance`
- Import `useAdminAuth` from `@/hooks/useAdminAuth`
- Import `GlobalPlace` type from `@/types/trip`
- Add state: `const [yourPlaces, setYourPlaces] = useState<GlobalPlace[]>([])`

### Fetch user's nearby global places
Add a `useEffect` that runs when `open`, `originLocation`, and `categoryId` change. It queries `global_places` for the admin user, then client-side filters to places within 10km of `originLocation` using `haversineKm`, optionally filtering by category. Store results in `yourPlaces`.

```typescript
useEffect(() => {
  if (!open || !originLocation || !adminUser) { setYourPlaces([]); return; }
  (async () => {
    const { data } = await supabase
      .from('global_places')
      .select('*')
      .eq('user_id', adminUser.id);
    if (!data) return;
    const nearby = data.filter(p => {
      if (!p.latitude || !p.longitude) return false;
      if (haversineKm(originLocation.lat, originLocation.lng, Number(p.latitude), Number(p.longitude)) > 10) return false;
      if (categoryId && p.category !== categoryId) return false;
      return true;
    });
    setYourPlaces(nearby);
  })();
}, [open, originLocation, categoryId, adminUser]);
```

### Render "FROM YOUR PLACES" section
Inside the ScrollArea, before the Google results grid (line ~926), render a horizontal scroll row when `yourPlaces.length > 0`. Each place is converted to an `ExploreResult` to reuse `ExploreCard`:

```typescript
const globalToExploreResult = (p: GlobalPlace): ExploreResult => ({
  placeId: p.google_place_id || p.id,
  name: p.name,
  address: p.address || '',
  lat: p.latitude ? Number(p.latitude) : null,
  lng: p.longitude ? Number(p.longitude) : null,
  rating: p.rating ? Number(p.rating) : null,
  userRatingCount: null,
  priceLevel: p.price_level,
  openingHours: p.opening_hours as string[] | null,
  types: [],
  googleMapsUri: null,
  website: p.website,
  phone: p.phone,
  photoRef: null,
});
```

Render as:
```tsx
{yourPlaces.length > 0 && !loading && (
  <div className="mb-3">
    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
      From your places
    </p>
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
      {yourPlaces.map(place => {
        const asExplore = globalToExploreResult(place);
        const inTrip = existingPlaceIds.has(asExplore.placeId) || addedPlaceIds.has(asExplore.placeId);
        return (
          <div key={place.id} className="shrink-0" style={{ width: 200 }}>
            <ExploreCard
              place={asExplore}
              categoryId={place.category}
              onAddToPlanner={() => handleAdd(asExplore)}
              onTap={() => handleCardTap(asExplore)}
              isInTrip={inTrip}
            />
          </div>
        );
      })}
    </div>
  </div>
)}
```

## Feature 2: Star/Favourite in PlaceOverview

**File: `src/components/timeline/PlaceOverview.tsx`**

### New imports and state
- Import `Star` from `lucide-react`
- Import `useAdminAuth` from `@/hooks/useAdminAuth`
- Add state: `isStarred` (boolean), initialized by querying `global_places` on mount when `option.google_place_id` exists

### Star status check on mount
```typescript
const { adminUser } = useAdminAuth();
const [isStarred, setIsStarred] = useState(false);

useEffect(() => {
  if (!option.google_place_id || !adminUser) return;
  supabase
    .from('global_places')
    .select('starred')
    .eq('google_place_id', option.google_place_id)
    .eq('user_id', adminUser.id)
    .maybeSingle()
    .then(({ data }) => {
      if (data) setIsStarred(data.starred);
    });
}, [option.google_place_id, adminUser]);
```

### Toggle handler
```typescript
const handleToggleStar = async () => {
  if (!option.google_place_id || !adminUser) return;
  const newStarred = !isStarred;
  setIsStarred(newStarred); // Optimistic
  
  await supabase
    .from('global_places')
    .upsert({
      user_id: adminUser.id,
      google_place_id: option.google_place_id,
      name: option.name,
      category: option.category,
      latitude: option.latitude,
      longitude: option.longitude,
      status: 'want_to_go',
      source: 'favourite',
      starred: newStarred,
      rating: option.rating,
      price_level: option.price_level,
      address: option.address ?? option.location_name,
    } as any, { onConflict: 'user_id,google_place_id' });
};
```

### Render star button
Add to the action row (line ~459, alongside lock and delete buttons):
```tsx
{option.google_place_id && adminUser && (
  <button
    className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted/50 transition-colors"
    onClick={handleToggleStar}
  >
    <Star className={cn('h-4 w-4', isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground')} />
  </button>
)}
```

## Files Summary

| File | Change |
|------|--------|
| `src/components/timeline/ExploreView.tsx` | Add `yourPlaces` state, fetch global_places on open, render "From Your Places" horizontal row above results |
| `src/components/timeline/PlaceOverview.tsx` | Add star button with optimistic toggle that upserts into global_places |


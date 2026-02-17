

# City-level Explore from Global Planner

## Overview
Add an "Explore" button to the city detail view in GlobalPlanner that opens ExploreView as an overlay, letting users discover and save new places for that city.

## Changes

### File: `src/pages/GlobalPlanner.tsx`

**New imports:**
- Add `Search` to lucide-react imports
- Import `ExploreView` and `ExploreResult` from `@/components/timeline/ExploreView`
- Import `PICKER_CATEGORIES` from `@/lib/categories`
- Import `cn` from `@/lib/utils`

**New state (around line 99):**
```typescript
const [cityExploreOpen, setCityExploreOpen] = useState(false);
```

**New memo for city center coordinates:**
```typescript
const cityCenter = useMemo(() => {
  if (!selectedCity) return null;
  const cp = cityPlaces.filter(p => p.latitude && p.longitude);
  if (!cp.length) return null;
  return {
    lat: cp.reduce((s, p) => s + Number(p.latitude), 0) / cp.length,
    lng: cp.reduce((s, p) => s + Number(p.longitude), 0) / cp.length,
  };
}, [cityPlaces, selectedCity]);
```

**Explore categories constant (top-level, same as GlobalExplore):**
```typescript
const EXPLORE_CATEGORIES = PICKER_CATEGORIES.filter(
  c => !['flight', 'hotel', 'private_transfer'].includes(c.id)
);
```

**handleCityExploreAdd handler:**
Saves the place to `global_places` with the city name pre-filled, then refetches places so the new entry appears immediately.
```typescript
const handleCityExploreAdd = async (place: ExploreResult) => {
  if (!adminUser) return;
  await supabase.from('global_places').upsert({
    user_id: adminUser.id,
    google_place_id: place.placeId,
    name: place.name,
    category: /* derive from ExploreView categoryId or fallback */,
    latitude: place.lat,
    longitude: place.lng,
    status: 'want_to_go',
    source: 'explore_save',
    rating: place.rating,
    price_level: place.priceLevel,
    address: place.address,
    city: selectedCity,
  } as any, { onConflict: 'user_id,google_place_id' });
  toast({ title: `Saved ${place.name} to My Places` });
  fetchPlaces(); // Refetch so the new place appears
};
```

**City header modification (lines 303-328):**
When `selectedCity` is set, replace the generic header with one that includes an "Explore" button on the right side:
```tsx
<div className="flex items-center gap-2">
  <Button variant="ghost" size="icon" onClick={() => {
    if (cityExploreOpen) { setCityExploreOpen(false); }
    else if (selectedCity) { setSelectedCity(null); }
    else { navigate('/'); }
  }}>
    <ArrowLeft className="h-5 w-5" />
  </Button>
  <h1 className="text-lg font-bold">
    {selectedCity ? (
      <span className="flex items-center gap-1.5">
        <MapPin className="h-4 w-4 text-primary" />
        {selectedCity}
      </span>
    ) : 'My Places'}
  </h1>
</div>
<div className="flex items-center gap-2">
  {syncing && <span className="text-xs text-muted-foreground">Syncing...</span>}
  {selectedCity && !cityExploreOpen && (
    <Button variant="outline" size="sm" onClick={() => setCityExploreOpen(true)}>
      <Search className="h-3.5 w-3.5 mr-1.5" />
      Explore
    </Button>
  )}
  {!selectedCity && (
    <Button variant="ghost" size="icon" onClick={syncPlaces} disabled={syncing}>
      <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
    </Button>
  )}
</div>
```

**ExploreView overlay (after main, before the Drawer):**
When `cityExploreOpen` is true and `cityCenter` exists, render ExploreView as a full-screen overlay:
```tsx
{cityExploreOpen && cityCenter && (
  <div className="fixed inset-0 z-40 bg-background flex flex-col">
    <ExploreView
      open={true}
      onClose={() => setCityExploreOpen(false)}
      trip={null}
      entries={[]}
      isEditor={true}
      onAddToPlanner={handleCityExploreAdd}
      onCardTap={() => {}}
      onAddManually={() => {}}
      initialOrigin={{ name: selectedCity!, ...cityCenter }}
    />
  </div>
)}
```

Note: ExploreView already has its own category picker built in (the category pills row), so we don't need to add a separate one here. The `categoryId` prop can be left undefined to let the user pick within ExploreView.

**Reset cityExploreOpen when leaving city:**
When `setSelectedCity(null)` is called, also reset `setCityExploreOpen(false)`.

## Files Summary

| File | Change |
|------|--------|
| `src/pages/GlobalPlanner.tsx` | Add Explore button to city header, cityCenter memo, ExploreView overlay with global_places save handler, refetch on add |


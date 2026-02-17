

# Map View for Explore

## Overview
Replace the "coming soon" map toggle with a working map view that shows a static map image with colored markers (blue for scheduled entries, gold for explore results) and a horizontally scrollable card row beneath it.

## Changes

### 1. Extend `supabase/functions/static-map/index.ts`

Add support for a `markers` query parameter containing a JSON-encoded array of `{ lat, lng, color }` objects. The function will:

- Parse the `markers` param
- Group markers by color
- Build a Google Static Maps URL with multiple marker groups
- Use `center` and `zoom` params (or auto-center on first marker)
- Accept this as an alternative to the existing single `lat`/`lng` marker flow

The validation at the top changes to allow `markers` as a third alternative (alongside `path` and `lat`/`lng`).

### 2. Add `viewMode` state and map rendering in `src/components/timeline/ExploreView.tsx`

**New state:**
```typescript
const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
```

**Wire toggle buttons (lines 780-792):**
Replace the hardcoded active/inactive styles and the "coming soon" toast with actual toggle logic:
- List button: active when `viewMode === 'list'`, sets `viewMode` to `'list'`
- Map button: active when `viewMode === 'map'`, sets `viewMode` to `'map'`

**Build map URL function:**
```typescript
const mapImageUrl = useMemo(() => {
  if (viewMode !== 'map' || !originLat || !originLng) return null;
  const markers = [];

  // Blue: scheduled entries with coordinates
  entries.forEach(entry => {
    const opt = entry.options[0];
    if (opt?.latitude && opt?.longitude && entry.is_scheduled) {
      markers.push({ lat: opt.latitude, lng: opt.longitude, color: '0x4285F4' });
    }
  });

  // Gold: explore results
  sortedResults.forEach(result => {
    if (result.lat && result.lng) {
      markers.push({ lat: result.lat, lng: result.lng, color: '0xFFD700' });
    }
  });

  if (markers.length === 0) return null;
  const markersParam = encodeURIComponent(JSON.stringify(markers));
  const center = `${originLat},${originLng}`;
  return `${supabaseUrl}/functions/v1/static-map?center=${center}&zoom=14&size=800x600&markers=${markersParam}`;
}, [viewMode, originLat, originLng, entries, sortedResults]);
```

**Conditional rendering in the results area (lines 1070-1204):**
When `viewMode === 'map'`, render:
- A map image container (50% height, min 300px) with the static map
- A horizontal card scroll row beneath it with 200px-wide ExploreCard components
- The "Load more" and "Add manually" links below

When `viewMode === 'list'`, keep the existing ScrollArea with vertical card list.

The filters, search bar, origin picker, and travel mode pills all stay visible above regardless of view mode.

### 3. Map view layout (within ExploreView render)

```tsx
{viewMode === 'map' ? (
  <div className="flex-1 flex flex-col overflow-hidden">
    {/* Map image */}
    <div className="relative w-full flex-1 min-h-[250px] bg-muted">
      {mapImageUrl ? (
        <img src={mapImageUrl} alt="Map" className="w-full h-full object-cover" />
      ) : loading ? (
        <div className="flex items-center justify-center h-full">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          No results to show on map
        </div>
      )}
      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex gap-2 text-[10px] bg-background/80 backdrop-blur-sm rounded-md px-2 py-1">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Your plans</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> Suggestions</span>
      </div>
    </div>
    {/* Horizontal card scroll */}
    <div className="border-t border-border">
      <div className="flex gap-2 overflow-x-auto p-3 scrollbar-hide">
        {sortedResults.map(place => (
          <div key={place.placeId} className="w-[200px] shrink-0">
            <ExploreCard ... />
          </div>
        ))}
      </div>
    </div>
  </div>
) : (
  <ScrollArea className="flex-1">
    {/* existing list view */}
  </ScrollArea>
)}
```

## Files Summary

| File | Changes |
|------|---------|
| `supabase/functions/static-map/index.ts` | Add multi-marker support via `markers` query param |
| `src/components/timeline/ExploreView.tsx` | Add `viewMode` state, wire toggle buttons, build map URL, conditional map/list rendering |




# Interactive Leaflet Map, Drag from Explore, and "Add to Timeline"

## Overview
Three related features: (1) Replace the static map image in ExploreView with an interactive Leaflet map, (2) Make ExploreCards draggable onto the timeline, and (3) Add an "Add to Timeline" action in PlaceOverview that lets users tap a time slot to place an entry.

---

## Feature 1: Interactive Leaflet Map

### Dependencies
Install `leaflet`, `react-leaflet`, and `@types/leaflet`.

### Leaflet CSS
Add `import 'leaflet/dist/leaflet.css';` in `src/App.tsx`.

### New Component: `src/components/timeline/ExploreMap.tsx`
A dedicated component that wraps the Leaflet map logic:
- Uses `MapContainer`, `TileLayer`, `Marker`, `Popup` from `react-leaflet`
- Custom marker icons: blue (scheduled entries) and gold (explore results)
- A `FitBounds` child component using `useMap()` to auto-zoom to fit all markers with padding
- Gold pin tap highlights the corresponding card in the strip below (via a callback)
- Props: `entries`, `sortedResults`, `originLat`, `originLng`, `onPinTap`, `selectedPlaceId`

### ExploreView.tsx Changes (lines 1148-1214)
Replace the static map image section with the new `ExploreMap` component.

**Mobile (inline):** Render the map inline within ExploreView, full-width, taking the available flex space.

**Desktop (overlay):** When `!isMobile && viewMode === 'map'`, render the map as a large fixed overlay (80vw x 80vh, centered, dark backdrop with close button). The card strip renders at the bottom of the overlay.

Add state: `selectedMapPlaceId` to track which gold pin is tapped, and scroll the corresponding card into view in the horizontal strip.

### Card Strip
The horizontal card strip below the map (already exists at lines 1170-1213) stays mostly the same, but each card gets a `ref` for scroll-into-view, and a visual ring highlight (`ring-2 ring-primary`) when its placeId matches `selectedMapPlaceId`.

---

## Feature 2: Drag ExploreCard to Timeline

### ExploreCard.tsx
Add `draggable` and `onDragStart` to the root div. On drag start, encode the place data as JSON in `e.dataTransfer.setData('application/json', ...)` with `{ source: 'explore', place, categoryId }`. Also set `e.dataTransfer.effectAllowed = 'copy'`.

### ContinuousTimeline.tsx (lines 725-741)
Update the `onDrop` handler to check for `application/json` data first:
```
const jsonData = e.dataTransfer.getData('application/json');
if (jsonData) {
  const parsed = JSON.parse(jsonData);
  if (parsed.source === 'explore') {
    onDropExploreCard?.(parsed.place, parsed.categoryId, snappedGlobalHour);
    return;
  }
}
// fallback to existing entry ID logic
```

Add a new prop `onDropExploreCard?: (place: ExploreResult, categoryId: string | null, globalHour: number) => void`.

### Timeline.tsx
Add a `handleDropExploreCard` handler that:
1. Calculates the drop time from `globalHour` (same logic as `handleDropOnTimeline`)
2. Creates entry + entry_option in the database (reusing logic from `handleAddAtTime`)
3. Triggers `fetchData()` to refresh
4. Pass this handler to `ContinuousTimeline` as `onDropExploreCard`

---

## Feature 3: "Add to Timeline" from PlaceOverview

### PlaceOverview.tsx
No changes needed here -- the action buttons are rendered in `ExploreView.tsx` above `PlaceOverview` (lines 787-824).

### ExploreView.tsx (detail content, lines 781-838)
Add an "Add to Timeline" button alongside the existing "Add to Planner" / "Add at [time]" buttons. This button calls a new `onAddToTimeline` prop:
```tsx
<Button variant="outline" className="w-full gap-2" onClick={() => onAddToTimeline?.(selectedPlace)}>
  <MapPin className="h-4 w-4" />
  Add to Timeline
</Button>
```

Add `onAddToTimeline?: (place: ExploreResult) => void` to `ExploreViewProps`.

### Timeline.tsx
Add state: `floatingPlaceForTimeline` (stores the ExploreResult being placed).

When `onAddToTimeline` is called:
1. Close Explore and PlaceOverview
2. Set `floatingPlaceForTimeline` to the place

When `floatingPlaceForTimeline` is set, render an instruction overlay:
- Semi-transparent dark backdrop
- Centered instruction text: "Tap a time slot on the timeline to place this entry"
- Cancel button to exit the mode
- The timeline remains interactive beneath the instruction bar

When the user taps/clicks on the timeline (via the existing `onClickSlot` or `TimeSlotGrid` tap), detect that `floatingPlaceForTimeline` is set:
- Create the entry at the tapped time position (reuse `handleAddAtTime` logic)
- Clear `floatingPlaceForTimeline`
- Show success toast

Update the `onClickSlot` handler in Timeline.tsx to check for `floatingPlaceForTimeline` and create the entry at the clicked time if set.

---

## Files Summary

| File | Changes |
|------|---------|
| `src/App.tsx` | Add `import 'leaflet/dist/leaflet.css'` |
| `src/components/timeline/ExploreMap.tsx` | **New file** -- Leaflet map component with blue/gold markers, FitBounds, pin tap callbacks |
| `src/components/timeline/ExploreView.tsx` | Replace static map with ExploreMap; desktop overlay mode; add `selectedMapPlaceId` state; add `onAddToTimeline` prop and button in detail content |
| `src/components/timeline/ExploreCard.tsx` | Add `draggable` + `onDragStart` with JSON payload |
| `src/components/timeline/ContinuousTimeline.tsx` | Add `onDropExploreCard` prop; update drop handler to parse JSON data |
| `src/pages/Timeline.tsx` | Add `handleDropExploreCard` handler; add `floatingPlaceForTimeline` state; instruction overlay for tap-to-place mode; update `onClickSlot` to handle placement; pass new props to ExploreView and ContinuousTimeline |

### Package installations
- `leaflet`
- `react-leaflet`
- `@types/leaflet` (dev)


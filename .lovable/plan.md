

# Multi-Part Transport Overview Improvements

## Part 1 -- Route Map via Google Static Maps Edge Function

### Edge function (`supabase/functions/static-map/index.ts`)
- Add support for an optional `path` query parameter (encoded polyline)
- When `path` is present, build the Google Static Maps URL with `path=weight:4|color:0x4285F4ff|enc:{path}` and omit the center/zoom/markers params
- When `path` is absent, use existing single-marker logic (no change)
- `lat`/`lng` become optional (only required when `path` is absent)

### `RouteMapPreview.tsx`
- Replace the OpenStreetMap URL with a call to the `static-map` edge function: `${VITE_SUPABASE_URL}/functions/v1/static-map?path=${encodeURIComponent(polyline)}&size=${mapSize}`
- Add `destLat`, `destLng`, `destName` optional props (needed for Uber deep link -- Part 6)
- Keep Apple Maps and Google Maps buttons; add Uber button (Part 6)

---

## Part 2 -- Preload All Transport Modes on Open

### `EntrySheet.tsx` (view mode, transfer section around line 1414)
- Currently shows a "Refresh routes" button that populates `viewResults` only on click
- On mount (when `mode === 'view'` and `option.category === 'transfer'`), read `option.transport_modes` (the stored JSON with all 4 mode results) and populate `viewResults` directly
- Derive `viewSelectedMode` from the current option name (walk/drive/transit/bicycle)
- The "Refresh routes" button remains for fetching fresh data from the API, but modes are visible immediately

---

## Part 3 -- Remove Title from Transport Overview

### `EntrySheet.tsx` (lines 1348-1357)
- Remove the mode header block that shows the emoji, mode label ("Walking"), and subtitle (`option.name`)
- Keep the TRANSFER badge, From/To addresses, mode list, duration/distance, and map

---

## Part 4 -- Mode Switch Undo Support

### `Timeline.tsx` (`handleModeSwitchConfirm`, lines 748-786)
- Before any DB changes, capture: `oldEndTime`, `oldOptName`, `oldDistanceKm`, `oldPolyline`, and if `entry.to_entry_id` exists, the next entry's `start_time`/`end_time`
- After computing new values, push an undo action that restores all captured state
- This makes each mode switch independently undoable instead of skipping back to transport creation

---

## Part 5 -- Hide "Add Photo" for Transport

### `EntrySheet.tsx` (line 1612-1614)
- Wrap the `ImageUploader` render in an additional condition: hide when `option.category === 'transfer'`

---

## Part 6 -- Uber Deep Link Button

### `RouteMapPreview.tsx`
- Add a third button "Uber" alongside Apple Maps and Google Maps
- URL: `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=my_location&pickup[longitude]=my_location&dropoff[latitude]={destLat}&dropoff[longitude]={destLng}&dropoff[nickname]={destName}`
- Accept `destLat`, `destLng`, `destName` as new optional props
- Only render the Uber button when `destLat` and `destLng` are provided
- Use a `Car` icon from lucide-react

### `EntrySheet.tsx` -- transport view (line 1391-1398)
- Pass `destLat`/`destLng`/`destName` to `RouteMapPreview` from the option's lat/lng or parsed arrival location

### `EntrySheet.tsx` -- regular event view (line 1573-1588)
- Add an Uber button below the map preview alongside the Google Maps link
- Only show when `option.latitude` and `option.longitude` exist
- Same deep link format with event lat/lng as dropoff

---

## Part 7 -- Move Delete Button to Top-Right Header

### `EntrySheet.tsx` (view mode)
- Add a delete icon button (Trash2, h-5 w-5, destructive color) in the top-right header row, positioned to the left of the lock toggle and close button
- Layout order: `[Delete] [Lock] [Close X]` -- delete at `right-25`, lock stays at `right-14`, close stays at `right-3`
- Clicking the delete icon sets `deleting` to true (opens existing AlertDialog confirmation)
- Show delete icon for ALL entry types (events, flights, transport) when `isEditor` is true
- Remove the Delete button from the bottom action bar (line 1625-1629)
- Keep "Send to Planner" at the bottom by itself for non-transport/non-flight entries

---

## Files Modified

| File | Changes |
|------|---------|
| `supabase/functions/static-map/index.ts` | Add `path` param support for polyline routes |
| `src/components/timeline/RouteMapPreview.tsx` | Use edge function for map image; add Uber button; accept dest coords props |
| `src/components/timeline/EntrySheet.tsx` | Preload transport modes; remove transport title; hide ImageUploader for transport; add Uber button on regular events; move delete to header |
| `src/pages/Timeline.tsx` | Add undo support to `handleModeSwitchConfirm` |
| `src/components/timeline/MapPreview.tsx` | Add Uber button alongside existing map buttons |

## What Does NOT Change

- Transport card visual design on timeline (pill, colours, overlay)
- SNAP system, drag chain, continuous timeline
- Flight overview layout (except delete button moves to header)
- Navigation, tabs, panels
- Create mode in EntrySheet


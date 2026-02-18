
# Transport Overlay — Dedicated Bottom Sheet

## Overview
Replace the current minimal TransportOverlay (simple mode grid only) with a full-featured bottom sheet that includes: mode selection with duration as hero text, reactive route map, deep link buttons for navigation apps, and refresh/delete footer actions.

## Changes

### 1. Rewrite `src/components/timeline/TransportOverlay.tsx`

Complete rewrite. New props interface accepting `entry`, `option`, `formatTime`, `onSaved`, `onDelete` instead of the current flat data props.

**Layout (top to bottom):**
- **Header**: `from → to` addresses (first part only, split on comma), close button
- **Mode Grid (2x2)**: Duration as hero (17-18px, bold, mode colour, top-right), mode label (emoji + name, top-left), distance below. Active mode has 2px primary border + subtle mode-colour bg. Tapping switches mode and saves to DB.
- **Route Map**: Uses existing `RouteMapPreview` with `size="full"`. Polyline updates reactively when mode changes. 160px height, rounded-xl border.
- **Deep Links Row**: Google Maps, Apple Maps, Uber buttons. Platform-aware (hide Apple Maps on Android). Uses same URL patterns as RouteMapPreview.
- **Footer**: "Refresh routes" button (calls `google-directions` edge function for all 4 modes, updates `transport_modes` on option) and "Remove transport" button (red, calls `onDelete`).

**Mode switch logic** (matches existing `handleModeSwitchConfirm` in Timeline.tsx):
- Round duration to nearest 5min
- Update `entry.end_time`, `option.name` (e.g. "Walk to British Museum"), `option.distance_km`, `option.route_polyline`
- Call `onSaved()` to refresh

**Refresh routes**: Call `supabase.functions.invoke('google-directions')` with all 4 modes, update `transport_modes` on the option, refresh local state.

**Data source**: `option.transport_modes` array. If empty/missing, show "Refresh routes" prominently in the mode grid area.

### 2. Update `src/pages/Timeline.tsx`

**Replace transport overlay state** (lines 158-169): Change from flat `transportOverlayData` to `transportOverlayEntry` + `transportOverlayOption` state.

**Update `handleCardTap`** (line 1109): Add transport detection. If the tapped entry is a transport (category = 'transfer', or has from_entry_id + to_entry_id, or name starts with walk/drive/transit/cycle to), open TransportOverlay instead of EntrySheet.

**Update `handleTransportCogTap`** (line 1455): Also open the new overlay with entry + option references.

**Update JSX** (line 2915-2929): Render new TransportOverlay with entry/option props, wire `onSaved={fetchData}` and `onDelete` to existing `handleDeleteTransport`.

### 3. Files Modified

- `src/components/timeline/TransportOverlay.tsx` — complete rewrite with rich layout
- `src/pages/Timeline.tsx` — updated state, handleCardTap routing, overlay rendering

### Technical Notes

- RouteMapPreview already handles Google/Apple/Uber deep links internally, but we render custom deep link buttons in the overlay for a cleaner layout with the mode grid above
- The mode switch DB update reuses the same logic as `handleModeSwitchConfirm` — we call it directly from the overlay via a prop
- Platform detection for Apple Maps: `const isAndroid = /android/i.test(navigator.userAgent)`
- No changes to EntrySheet — transport create mode still uses it



# Transport System Upgrade: Smart Gaps, Route Maps, Contingency Buffers

## Overview

Three changes to the transport creation and display flow:

1. **Clean up transport form**: Remove website and date fields for transport entries; the transport appears at the gap where it was clicked
2. **Smart gap handling**: Always round transport duration up to nearest 5 minutes for the calendar block, show real duration in details. When transport exceeds the gap, trigger the existing Conflict Resolver with smart suggestions
3. **Route map previews**: Show a static route map (from the polyline data) in the creation dialog, the view overlay, and a mini version on the timeline card

---

## 1. Clean Up Transport Form

**In `EntrySheet.tsx` (create mode, transfer section):**
- Remove the "Website" field when `isTransfer` is true
- Remove the "Date" field when `transportContext` is provided (the date is inherited from the gap position)
- The "Day" selector is also hidden when transport context exists (it's implicit from the gap)

---

## 2. Smart Gap Handling with Contingency Buffer

### Rounding Logic

When a transport mode is selected (or auto-selected):
- **Real duration** (e.g., 23 min) is stored and shown in the card details and view overlay
- **Block duration** = real duration rounded UP to the nearest 5 minutes (e.g., 23 min becomes 25 min)
- The calendar card occupies the block duration's time span
- The difference (2 min) is labeled as "contingency" in the card subtitle

### How It Works

When user clicks a transport gap button:
1. Routes are fetched (existing behavior)
2. User selects a mode (or fastest is auto-selected)
3. Calculate: `blockDuration = Math.ceil(realDuration / 5) * 5`
4. Calculate: `gapMinutes` (time between the two adjacent entries)
5. Compare `blockDuration` vs `gapMinutes`:

**If blockDuration <= gapMinutes (fits in gap):**
- Transport card is created with `start_time = previousEntry.end_time` and `end_time = start + blockDuration`
- Remaining gap after transport = `gapMinutes - blockDuration`
- If remaining gap > 0, this becomes a new smaller gap on the timeline (no auto-snapping -- the contingency buffer is already built into the block duration)

**If blockDuration > gapMinutes (doesn't fit):**
- Trigger the existing Conflict Resolver (`analyzeConflict` + `generateRecommendations`)
- The conflict resolver already generates suggestions like "Push next event later by Xm", "Shorten previous event by Xm", etc.
- User picks a resolution or chooses "figure it out later" (places with red conflict marker)

### Implementation

**`EntrySheet.tsx`:**
- New state: `gapMinutes: number | null` (passed from Timeline via new prop)
- When `transportContext` is provided, also receive `gapMinutes`
- On mode selection, compute `blockDuration` and compare with `gapMinutes`
- If overflow detected: show inline warning banner with overflow amount, and a "Resolve" button that calls back to Timeline to trigger Conflict Resolver
- The `handleSave` function uses `blockDuration` (rounded) for the entry's time span on the calendar

**`Timeline.tsx`:**
- In `handleAddTransport`, calculate and pass `gapMinutes` to the transport context
- New prop on `EntrySheet`: `transportContext.gapMinutes`
- New callback prop: `onTransportConflict` that opens ConflictResolver when transport overflows

**Entry card display:**
- Transport cards show the real duration (e.g., "23 min transit") in the details
- The card physically occupies the rounded block time (25 min)
- A small "+2m buffer" label appears in muted text

---

## 3. Route Map Previews

### Data Flow

The `google-directions` edge function already returns `polyline` (encoded polyline) for single-mode requests. The multi-mode response currently drops it. We need to:

1. **Update `google-directions` edge function**: Include `polyline` in multi-mode results
2. **Store polyline**: Save the selected route's polyline when creating the transport entry (new column or stored in option metadata)
3. **Render static map**: Use Google Static Maps API or an open-source alternative to render the polyline as a static image

### Static Route Map Implementation

Use Google Maps Static API to render polyline:
```
https://maps.googleapis.com/maps/api/staticmap?size=600x200&path=enc:{polyline}&key={API_KEY}
```

Since the API key is server-side only, create a small helper in the `google-directions` edge function (or a new endpoint) that returns the static map URL given a polyline.

**Alternative (no extra API cost):** Use OpenStreetMap-based static map with polyline overlay. This avoids needing the Google Static Maps API.

### Where Maps Appear

1. **Transport creation dialog** (EntrySheet, create mode, transfer): Below the route list, show the static map of the currently selected route. Clicking opens Google Maps directions URL.

2. **Transport view overlay** (EntrySheet, view mode, transfer): Show the route map below the From/To details. Buttons to "Open in Google Maps" and "Open in Apple Maps" with the directions URL (not just a pin).

3. **Timeline card** (EntryCard/TravelSegmentCard): A mini route map thumbnail at the bottom of transport cards. Only shown on cards with enough height (not compact layout).

### Map Link Format

- Google Maps directions: `https://www.google.com/maps/dir/?api=1&origin={from}&destination={to}&travelmode={mode}`
- Apple Maps directions: `https://maps.apple.com/?saddr={from}&daddr={to}&dirflg={mode_flag}`

### Database Change

Add a `route_polyline` column to `entry_options` to store the encoded polyline string for transport entries.

---

## File Summary

| File | Action | Changes |
|------|--------|---------|
| `supabase/functions/google-directions/index.ts` | Edit | Include `polyline` in multi-mode results; add static map URL endpoint |
| `src/components/timeline/EntrySheet.tsx` | Edit | Remove website/date for transport; add gap comparison logic with contingency buffer; add route map preview; accept `gapMinutes` in transport context |
| `src/pages/Timeline.tsx` | Edit | Pass `gapMinutes` in transport context; add `onTransportConflict` callback to trigger Conflict Resolver |
| `src/components/timeline/EntryCard.tsx` | Edit | Show mini route map on transport cards; show contingency buffer label |
| `src/components/timeline/RouteMapPreview.tsx` | Create | New component: renders static route map image with "Open in Maps" buttons |
| Database migration | Create | Add `route_polyline TEXT` column to `entry_options` table |

---

## Technical Details

### Transport Context (Updated)

```text
transportContext: {
  fromAddress: string;
  toAddress: string;
  gapMinutes: number;       // NEW: gap between adjacent entries in minutes
  fromEntryId: string;      // NEW: needed for conflict resolution
  toEntryId: string;        // NEW: needed for conflict resolution
}
```

### Gap Calculation in Timeline.tsx

```text
const gapMs = new Date(toEntry.start_time).getTime() - new Date(fromEntry.end_time).getTime();
const gapMinutes = Math.round(gapMs / 60000);
```

### Block Duration Rounding

```text
const blockDuration = Math.ceil(realDuration / 5) * 5;
const contingencyMin = blockDuration - realDuration;
```

### Overflow Detection in EntrySheet

```text
if (transportContext?.gapMinutes != null && blockDuration > transportContext.gapMinutes) {
  // Show warning: "Transport takes Xm but gap is only Ym"
  // Show "Resolve" button -> triggers onTransportConflict callback
}
```

### RouteMapPreview Component

```text
Props:
  polyline: string              // encoded polyline
  fromAddress: string
  toAddress: string
  travelMode: string            // walk, transit, drive, bicycle
  size?: 'mini' | 'full'        // mini for card, full for dialog
  className?: string

Renders:
  - Static map image with polyline overlay
  - "Open in Google Maps" / "Open in Apple Maps" buttons (full size only)
  - Click handler on mini opens the view overlay
```

### Edge Function Update

In the multi-mode handler (line 111-113 of google-directions), include polyline:

```text
// Current: { mode, duration_min, distance_km }
// Updated: { mode, duration_min, distance_km, polyline }
```

### Static Map Rendering

For the static map image, use a lightweight approach with OpenStreetMap tiles and polyline overlay. The `RouteMapPreview` component will decode the polyline and render an image via a static tile service, or we can use a simple embedded approach with the polyline drawn on a canvas over map tiles.

Simpler alternative: Use the existing MapPreview component pattern but with a directions-oriented URL. For Google, generate: `https://maps.googleapis.com/maps/api/staticmap?size=400x150&path=enc:{polyline}&key={key}`. The key is fetched server-side via a new lightweight edge function endpoint that returns the image URL (or proxies the image).

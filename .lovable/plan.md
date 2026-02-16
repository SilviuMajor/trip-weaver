

# ExploreCard Component + Photo Loading + Card Tap Detail Sheet

## Overview
Replace the placeholder result cards in ExploreView with polished ExploreCard components matching SidebarEntryCard's visual design, add lazy photo loading from Google Places, and wire card taps to open PlaceOverview in a Drawer/Dialog.

## New File: `src/components/timeline/ExploreCard.tsx`

A card component that mirrors SidebarEntryCard's visual treatment for Explore search results.

### Visual Design (copied from SidebarEntryCard)
- `rounded-[14px]` with `overflow-hidden`, full width, fixed `h-[140px]`
- **With photo**: background image + diagonal fade overlay (`linear-gradient(152deg, transparent 25%, rgba(10,8,6,0.3) 35%, rgba(10,8,6,0.7) 50%, rgba(10,8,6,0.92) 65%)`)
- **Without photo**: glossy gradient fallback using extracted hue from category color (same `glossyBg`, `glassBg`, `glossyBorder` logic as SidebarEntryCard)
- **Corner flag**: top-left category emoji on colored background with `borderRadius: '14px 0 8px 0'`
- **Travel time pill**: top-right, same `durPillStyle` as SidebarEntryCard's duration pill (only shown if `travelTime` prop provided)
- **Name**: bottom-right, `text-sm font-bold`, white with text-shadow over images, theme-aware otherwise
- **Address**: below name, `text-[10px]` with map pin emoji, truncated
- **Rating + price row**: bottom-left area, format: "star 4.4 (2,891) . euro-symbols" using `formatPriceLevel` from entryHelpers
- **Compact hours**: below address in `text-[9px]` if provided
- **Planner button**: 32x32 circle, bottom-right, `bg-white/20 backdrop-blur-sm`, ClipboardList icon; swaps to Check icon when `isInTrip`
- **"Already in trip" state**: opacity 0.75, Check badge replaces clipboard icon

### Photo Loading
- `useEffect` on `photoRef`: if present and no `photoUrl`, call `supabase.functions.invoke('google-places', { body: { action: 'photo', photoRef } })`
- Store resolved URL in local `useState`
- Show glossy gradient while loading; transition to image once loaded
- On failure, keep gradient

### Props
```
place: ExploreResult
categoryId: string | null
onAddToPlanner: () => void
onTap: () => void
travelTime?: string | null
isInTrip?: boolean
compactHours?: string | null
```

## Modified File: `src/components/timeline/ExploreView.tsx`

### Replace placeholder cards with ExploreCard
- Import ExploreCard
- For each result, compute `isInTrip` by checking if `place.placeId` matches any `google_place_id` in existing `entries[*].options[*]`
- Track a local `Set<string>` of `addedPlaceIds` state (starts empty, grows as user adds places during this session) to immediately reflect newly added items
- Pass `categoryId`, `onAddToPlanner` (wrapping existing handler + adding to local set), `onTap`
- Leave `travelTime` and `compactHours` as null (future prompts)

### Add card tap -> PlaceOverview detail sheet
- New state: `selectedPlace: ExploreResult | null`, `detailOpen: boolean`
- `onTap` sets selectedPlace and opens detail
- `buildTempEntry(place)` function creates fake `EntryWithOptions` + `EntryOption` from ExploreResult for PlaceOverview consumption (temporary IDs prefixed with `explore-`, `is_scheduled: false`, photoUrl mapped to images array)
- Render detail using `Drawer` (mobile via `useIsMobile`) or `Dialog` (desktop) containing:
  - "Add to Planner" button at top (ClipboardList icon + text)
  - PlaceOverview component with `context="explore"`, `isEditor={false}`
- On add from detail sheet: call `onAddToPlanner`, close sheet

## Modified File: `src/pages/Planner.tsx`

- Remove the placeholder `onCardTap` toast
- Pass the actual `onCardTap` callback that ExploreView will now handle internally (or keep it as a no-op since ExploreView manages its own detail sheet state)

## Technical Details

### isInTrip detection
```typescript
const existingPlaceIds = useMemo(() => {
  const ids = new Set<string>();
  for (const entry of entries) {
    for (const opt of entry.options) {
      if (opt.google_place_id) ids.add(opt.google_place_id);
    }
  }
  return ids;
}, [entries]);
```

### buildTempEntry mapping
Maps ExploreResult fields to EntryOption fields:
- `placeId` -> `google_place_id`
- `lat/lng` -> `latitude/longitude`
- `address` -> `location_name` and `address`
- `rating`, `userRatingCount` -> `rating`, `user_rating_count`
- `openingHours` -> `opening_hours`
- `photoUrl` -> single-element `images` array (if available)
- All flight-specific fields (departure_tz, arrival_tz, terminals) set to null

### Detail sheet wrapper
Uses the same Drawer/Dialog pattern as EntrySheet:
- Mobile: `<Drawer open={detailOpen} onOpenChange={setDetailOpen}><DrawerContent className="max-h-[92vh]">...`
- Desktop: `<Dialog open={detailOpen} onOpenChange={setDetailOpen}><DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">...`

## Files Summary
| File | Action |
|------|--------|
| `src/components/timeline/ExploreCard.tsx` | Create |
| `src/components/timeline/ExploreView.tsx` | Modify (replace placeholder cards, add detail sheet) |
| `src/pages/Planner.tsx` | Modify (update onCardTap to no-op since ExploreView handles it internally) |


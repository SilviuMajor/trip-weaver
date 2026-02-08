

# Phases 2, 3 & 4 -- Complete Implementation Plan

This plan covers all the remaining features: the entry detail overlay, image uploads, swipeable options with voting, live location tracking, pinch-to-zoom, real-time sync, and organizer/editor controls.

---

## What gets built

### Phase 2 -- Rich Entries
- **Entry detail overlay**: Tapping a card opens a full-screen sheet with all images (gallery), name, website link, location with a map preview (static image from OpenStreetMap) and Apple/Google Maps navigation links, category, time, and distance.
- **Image upload**: Organizers and editors can upload photos from their camera roll. Images are stored in the existing `trip-images` storage bucket and linked via the `option_images` table. Drag-to-reorder support so the first image becomes the card background.
- **Custom categories**: A text input + color picker when creating/editing an option. The category label and color display on the card.
- **Timezone toggle**: Already built -- just verify it works in the overlay too.

### Phase 3 -- Options & Voting
- **Swipe navigation**: On the timeline, each entry card becomes horizontally swipeable (using `embla-carousel-react`, already installed) to browse competing options.
- **Voting**: A vote button on each option card. Tapping it inserts/removes a vote in the `votes` table for the current user. Vote count displays on each card. Options auto-reorder by vote count (highest first).
- **Lock voting**: The organizer gets a toggle in the header to lock/unlock voting trip-wide. When locked, the vote button is hidden for all users.
- **Real-time votes**: Subscribe to `votes` table changes via Supabase Realtime so vote counts update live across all users.

### Phase 4 -- Location, Zoom & Permissions
- **Live location**: A `useGeolocation` hook that requests the browser's current position. Distance from each entry's lat/lng is calculated using the Haversine formula and displayed on all cards.
- **Pinch-to-zoom**: A `useTimelineZoom` hook that listens for touch pinch gestures on the timeline container. Zoom level controls CSS spacing between entries (from 15-min granularity to full-day compressed view).
- **Past entry greying**: Already partially built -- will ensure entries whose end time has passed get the greyed-out treatment consistently.
- **"Today" button**: Already built.
- **Entry creation/editing (organizers + editors)**: A floating "+" button to add new entries. A form dialog to set time range, then add options with name, website, location, category, and images.
- **Real-time sync**: Subscribe to `entries`, `entry_options`, and `option_images` table changes so all users see new/updated entries live.

---

## Technical details

### New files to create

| File | Purpose |
|------|---------|
| `src/components/timeline/EntryOverlay.tsx` | Full-screen sheet showing entry detail: image gallery, name, website, map, category, time, distance, vote button |
| `src/components/timeline/OptionSwiper.tsx` | Horizontal swipeable carousel wrapping multiple `EntryCard` components per entry using `embla-carousel-react` |
| `src/components/timeline/ImageGallery.tsx` | Scrollable image gallery inside the overlay with reorder capability |
| `src/components/timeline/ImageUploader.tsx` | Camera roll upload component that stores images in `trip-images` bucket |
| `src/components/timeline/MapPreview.tsx` | Static map tile preview + Apple/Google Maps links |
| `src/components/timeline/VoteButton.tsx` | Vote/unvote button with animated state |
| `src/components/timeline/EntryForm.tsx` | Dialog form for creating/editing entries and their options |
| `src/components/timeline/OptionForm.tsx` | Sub-form for adding/editing a single option (name, website, location, category, images) |
| `src/hooks/useGeolocation.ts` | Browser geolocation hook returning `{ latitude, longitude, error }` |
| `src/hooks/useTimelineZoom.ts` | Pinch-to-zoom gesture handler returning a zoom level that controls timeline spacing |
| `src/hooks/useRealtimeSync.ts` | Supabase Realtime subscription hook for votes, entries, and options |
| `src/lib/distance.ts` | Haversine formula utility for calculating km distance between two lat/lng points |

### Files to modify

| File | Changes |
|------|---------|
| `src/components/timeline/TimelineDay.tsx` | Replace single `EntryCard` render with `OptionSwiper`; pass zoom level for spacing; pass geolocation for distance; pass `onCardTap` to open overlay |
| `src/components/timeline/EntryCard.tsx` | Add `onClick` handler to open overlay; accept and display distance from geolocation; add vote button |
| `src/components/timeline/TimelineHeader.tsx` | Add "Lock Voting" toggle for organizer; add "+" button for organizer/editor |
| `src/pages/Timeline.tsx` | Integrate `useGeolocation`, `useTimelineZoom`, `useRealtimeSync`; manage overlay open/close state; manage entry form state; pass zoom level to day components |
| `src/types/trip.ts` | No changes needed -- types already cover everything |

### Database changes
- **Enable Realtime on `option_images`**: `ALTER PUBLICATION supabase_realtime ADD TABLE public.option_images;` -- needed so image changes sync live.
- No new tables needed; the existing schema covers all features.

### Key implementation details

**Swipe navigation (OptionSwiper)**
- Uses `embla-carousel-react` (already installed) to create a horizontal carousel
- Each slide is an `EntryCard` for one option
- Dot indicators show which option is active and how many exist
- Options sorted by vote count descending

**Voting flow**
1. User taps vote button on an option card
2. Check if user already voted for this option -- if yes, delete the vote; if no, insert a new vote
3. Realtime subscription picks up the change and updates vote counts for all connected users
4. The `voting_locked` flag on the trip hides the vote UI when true

**Image upload flow**
1. User taps "Add image" in the entry form or overlay
2. File picker opens (accepts `image/*`)
3. File is uploaded to `trip-images` bucket with path `{option_id}/{timestamp}_{filename}`
4. A row is inserted into `option_images` with the public URL and next sort order
5. Drag handles allow reordering; reorder saves updated `sort_order` values

**Pinch-to-zoom**
- Touch event listeners (`touchstart`, `touchmove`, `touchend`) track two-finger distance
- Zoom level maps to a CSS variable controlling entry card height and time slot spacing
- 5 zoom levels: 15min, 30min, 1hr, 2hr, full-day
- Zoom level persists in component state (resets on page reload)

**Live location**
- `navigator.geolocation.watchPosition()` for continuous tracking
- Haversine formula calculates distance to each option's lat/lng
- If permission denied, distance simply doesn't show (graceful fallback)
- Distance updates as user moves

**Map preview**
- Uses OpenStreetMap static tile image (no API key required): `https://staticmap.openstreetmap.de/staticmap.php?center={lat},{lng}&zoom=15&size=600x200&markers={lat},{lng}`
- Links to `https://maps.apple.com/?ll={lat},{lng}` and `https://www.google.com/maps?q={lat},{lng}`

**Real-time sync**
- Single Supabase channel subscribing to `postgres_changes` on `votes`, `entries`, `entry_options`, and `option_images`
- On any change, re-fetch the affected data and update state
- Ensures all connected users see live updates

**Entry creation form**
- A floating action button ("+" icon) visible only to organizers and editors
- Opens a dialog with: date picker, start/end time pickers
- After creating the entry shell, a sub-form lets you add options (name, website, category + color, location name + lat/lng, images)
- Location can be entered as a place name with lat/lng fields (manual input for now)

### Build order
1. Utility files first: `distance.ts`, `useGeolocation.ts`, `useTimelineZoom.ts`, `useRealtimeSync.ts`
2. UI components: `MapPreview`, `VoteButton`, `ImageGallery`, `ImageUploader`
3. Composite components: `EntryOverlay`, `OptionSwiper`, `EntryForm`, `OptionForm`
4. Wire everything together in `TimelineDay`, `EntryCard`, `TimelineHeader`, and `Timeline`


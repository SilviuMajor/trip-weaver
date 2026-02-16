

# Changes: Flight Card Right-Align, Timeline Dots, Overview Editable Empty States, Opening Hours Fix

## Overview
Four changes across FlightGroupCard.tsx and EntrySheet.tsx: right-align flight content, replace check-in/checkout bars with timeline dots, add editable empty states in the overview, and confirm opening hours fix.

## Change 1: FlightGroupCard.tsx -- Right-align + Timeline Dots

### 1a. Right-align flight content (lines 156-175)
Change the content div from left-aligned to right-aligned:
- Add `text-right` to the content wrapper div
- Add `justify-end` to the route flex row
- Add text shadow to the title for readability

### 1b. Replace check-in bar with timeline dot (lines 91-112)
Remove the flat bar layout and replace with a timeline dot + dashed line design:
- Left side: circle dot at top with dashed line extending down
- Right side: "Check-in" label, terminal info, and time range
- Delete the check-in divider line (lines 109-111)

### 1c. Replace checkout bar with timeline dot (lines 178-199)
Same pattern but inverted -- dashed line on top, dot at bottom:
- Left side: dashed line coming from above with circle dot at bottom
- Right side: "Checkout" label, terminal info, and time range
- Delete the checkout divider line (lines 178-180)

## Change 2: Opening Hours -- Already Fixed

The opening hours fix from the previous batch is already in place (line 187 shows `{entryDayHoursText || 'Opening hours'}` without a day prefix). The `getEntryDayHours` function (line 139) already accepts `entryStartTime` and `PlaceDetailsSection` (line 149) already has the `entryStartTime` prop. No changes needed here.

## Change 3: Hero Image Height -- Already 240px

The hero is already at 240px (line 1222) and empty state at 160px (line 1259). No changes needed.

## Change 4: EntrySheet.tsx -- Editable Empty States

### 4a. Map cell empty state (lines 1676-1680)
Replace the plain pin emoji placeholder with a tappable button that triggers place search:
- Dashed border, "Tap to add location" text
- On click: opens PlacesAutocomplete inline or triggers a search flow
- Add state: `showPlaceSearch` and `placeSearchQuery`

### 4b. Phone -- editable when empty (lines 1698-1710)
When phone is empty and user is editor, show an `InlineField` with "Add phone" placeholder. On save, update `entry_options.phone` via supabase and call `onSaved()`.

### 4c. Website -- editable when empty (lines 1705-1709)
Same pattern: when website is empty and user is editor, show `InlineField` with "Add website" placeholder. On save, call `handleInlineSaveOption('website', v)`.

### 4d. Notes -- always visible for editors (lines 1713-1738)
Remove the Collapsible wrapper for notes. Show the textarea directly with dashed border and "Add a note..." placeholder. For non-editors with no notes, show nothing.

### 4e. Title triggers place search on rename (lines 1276-1283)
When InlineField for the title saves a new name that differs from the original, add state to show a PlacesAutocomplete dropdown below the title. When a place is selected, auto-fill location, phone, website, hours, rating, photos. Add `showPlaceSearch`, `placeSearchQuery` state variables and render PlacesAutocomplete conditionally.

## Technical Details

### New state variables in EntrySheet (view mode section)
```typescript
const [showPlaceSearch, setShowPlaceSearch] = useState(false);
const [placeSearchQuery, setPlaceSearchQuery] = useState('');
```

### PlacesAutocomplete reuse
The existing `PlacesAutocomplete` component (already imported) will be rendered below the title when `showPlaceSearch` is true. When a place is selected, update the option fields via supabase and call `onSaved()`.

### handlePlaceSelectInView function
New handler that takes a PlaceDetails result and updates the entry_option with all enriched data (name, location, phone, website, opening_hours, rating, photos, etc.) via a single supabase update call.

## Files Modified
| File | Scope |
|------|-------|
| `src/components/timeline/FlightGroupCard.tsx` | Right-align content, timeline dot check-in/checkout, remove dividers |
| `src/components/timeline/EntrySheet.tsx` | Editable empty states (map, phone, website, notes, title-search) |


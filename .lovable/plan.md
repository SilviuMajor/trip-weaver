

# Create PlaceOverview.tsx — Extract View Mode from EntrySheet

## Overview
Extract the entire view-mode rendering (lines 1119-1825 of EntrySheet.tsx) into a standalone `PlaceOverview.tsx` component. EntrySheet will delegate to PlaceOverview for view mode while keeping the Drawer/Dialog wrapper. No visual or behavioral changes.

## New File: `src/components/timeline/PlaceOverview.tsx`

### Props Interface
```typescript
interface PlaceOverviewProps {
  entry: EntryWithOptions;
  option: EntryOption;
  trip?: Trip | null;
  context: 'timeline' | 'planner' | 'explore' | 'create' | 'global';
  isEditor: boolean;
  resolvedTz?: string;
  formatTime?: (iso: string, tz?: string) => string;
  userLat?: number | null;
  userLng?: number | null;
  votingLocked?: boolean;
  userVotes?: string[];
  onVoteChange?: () => void;
  onSaved: () => void;
  onClose: () => void;
  onMoveToIdeas?: (entryId: string) => void;
}
```

### Imports (moved from EntrySheet)
- UI components: AlertDialog, Badge, Button, Input, Label, Collapsible, Popover
- Icons: Loader2, Check, Clock, ExternalLink, Pencil, Trash2, Lock, Unlock, LockOpen, ClipboardList, Plane, RefreshCw, Phone, ChevronDown, Navigation, Car
- Supabase client, toast, date-fns helpers, timezone utils
- Local components: InlineField, PlacesAutocomplete, ImageGallery, ImageUploader, MapPreview, RouteMapPreview
- Helpers: haversineKm, decodePolylineEndpoint, formatPriceLevel, getEntryDayHours, formatTimeInTz, getTzAbbr
- Types: Trip, EntryWithOptions, EntryOption

### Internal State (moved from EntrySheet view-mode state, lines 167-180)
- deleting, hotelBlockCount, hotelBlockEntryIds
- toggling
- viewRefreshing, viewResults, viewSelectedMode, viewModesPreloaded, viewApplying
- notesValue, notesDirty
- heroIndex
- showPlaceSearch, placeSearchQuery

### Internal Handlers (moved from EntrySheet)
- handlePlaceSelectInView (lines 182-215)
- handleNotesSave (lines 259-265)
- handleToggleLock (lines 990-1001)
- handleInlineSaveOption (lines 1003-1008)
- handleFlightTimeSave (lines 1011-1061)
- cascadeCheckinDuration (lines 1064-1082)
- cascadeCheckoutDuration (lines 1085-1103)
- handleInlineSaveEntry (lines 1105-1110)
- handleGenericTimeSave (lines 977-986)

### Internal Sub-component
- PlaceDetailsSection (lines 40-97) — moved into PlaceOverview file

### Effects (moved from EntrySheet)
- Notes sync effect (lines 217-222)
- Hotel block count fetch (lines 225-237)
- Transport modes preload (lines 240-257)

### Rendered Content
The entire JSX currently inside `viewContent` (lines 1142-1805) — everything from the hero image gallery through the delete confirmation dialogs. This is the inner content only; no Drawer/Dialog wrapper.

### Trip-derived values computed inside PlaceOverview
- homeTimezone from `trip?.home_timezone`
- defaultCheckinHours from `trip?.default_checkin_hours`
- defaultCheckoutMin from `trip?.default_checkout_min`

## Modified File: `src/components/timeline/EntrySheet.tsx`

### Remove
- All view-mode state variables (lines 167-180)
- All view-mode handlers: handlePlaceSelectInView, handleNotesSave, handleToggleLock, handleInlineSaveOption, handleFlightTimeSave, cascadeCheckinDuration, cascadeCheckoutDuration, handleInlineSaveEntry, handleGenericTimeSave
- View-mode effects (notes sync, hotel block count, transport modes preload)
- PlaceDetailsSection sub-component (lines 40-97)
- View-mode-only imports that are no longer needed (ImageGallery, ImageUploader, MapPreview, RouteMapPreview, haversineKm, etc.)

### Add
- `import PlaceOverview from './PlaceOverview';`

### Replace view mode block (lines 1119-1825) with
```tsx
if (mode === 'view') {
  if (!entry || !option) return null;

  const viewContent = (
    <PlaceOverview
      entry={entry}
      option={option}
      trip={trip}
      context="timeline"
      isEditor={isEditor}
      resolvedTz={resolvedTzProp}
      formatTime={formatTimeProp}
      userLat={userLat}
      userLng={userLng}
      votingLocked={votingLocked}
      userVotes={userVotes}
      onVoteChange={onVoteChange}
      onSaved={onSaved}
      onClose={() => onOpenChange(false)}
      onMoveToIdeas={onMoveToIdeas}
    />
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92vh] overflow-y-auto">
          {viewContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        {viewContent}
      </DialogContent>
    </Dialog>
  );
}
```

### Keep unchanged in EntrySheet
- All create-mode state, handlers, effects, and JSX
- The Drawer/Dialog wrapper for view mode (just delegates inner content to PlaceOverview)
- All props interface and types
- The return flight prompt AlertDialog (lines 2207-2224, create-mode related)

## What stays visually identical
Everything. This is a pure extraction — the same JSX, same state, same handlers, same effects, just living in a different file. The onClose prop maps to `onOpenChange(false)` for delete dialog callbacks that need to close the sheet.


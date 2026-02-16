

# Transport Simplification, Flight Card Update, Compact Resize Handles, Map Popover

## Overview
Four targeted changes: simplify TransportConnector to a tappable info pill, ensure FlightGroupCard matches the diagonal-fade design, enable resize handles on compact cards, and add a navigation popover to the map thumbnail in the overview sheet.

## 1. TransportConnector.tsx -- Full rewrite (simplify)

Replace the entire component. Remove all expand/collapse logic, mode switching buttons, refresh, delete, and confirm-delete state. The new component is a simple tappable info pill that calls `onTap`.

### New interface
```ts
interface TransportConnectorProps {
  entry: EntryWithOptions;
  option: EntryOption;
  height: number;
  fromLabel?: string;
  toLabel?: string;
  onTap: () => void;
}
```

### New component body
- Keep `STRIP_COLORS_LIGHT`, `STRIP_COLORS_DARK`, `MODE_EMOJI`, `fmtDur`, `fmtDist` helpers
- Keep `detectCurrentMode()` logic (without `selectedModeProp`)
- Render: background strip (with `right: 4`), a single tappable pill showing `[emoji] [duration] [dot distance]`, and a from-to label below the pill
- No expand/collapse state, no mode buttons, no Settings/RefreshCw/Trash2/X/Info icons, no `confirmingDelete` state

### Remove imports
Remove `useState`, `useRef`, `useEffect`, `RefreshCw`, `Loader2`, `Trash2`, `Info`, `Settings`, `X` from lucide-react -- none are needed.

## 2. ContinuousTimeline.tsx -- Update TransportConnector usage

### 2a. Simplify TransportConnector props (lines 1346-1384)
Replace all the complex props (`onModeSelect`, `onRefresh`, `isRefreshing`, `onDelete`, `onInfoTap`) with just `onTap`:
```tsx
<TransportConnector
  entry={entry}
  option={primaryOption}
  height={height}
  fromLabel={primaryOption.departure_location || undefined}
  toLabel={primaryOption.arrival_location || undefined}
  onTap={() => onCardTap(entry, primaryOption)}
/>
```

### 2b. Remove `refreshingTransportId` state (line 369)
Remove `const [refreshingTransportId, setRefreshingTransportId] = useState<string | null>(null);` and all references to it (the inline `onRefresh` callback that invoked `google-directions`).

### 2c. Compact card resize handles
Remove `!isCompact` from 4 resize handle conditions:
- Line 1227: `canDrag && !flightGroup && !isCompact` becomes `canDrag && !flightGroup`
- Line 1241: `!canDrag && isLocked && !flightGroup && !isCompact` becomes `!canDrag && isLocked && !flightGroup`
- Line 1526: `canDrag && !flightGroup && !isTransport && !isCompact` becomes `canDrag && !flightGroup && !isTransport`
- Line 1540: `!canDrag && isLocked && !flightGroup && !isTransport && !isCompact` becomes `!canDrag && isLocked && !flightGroup && !isTransport`

Hide the visual pill indicator when compact (add `&& !isCompact` to the inner pill div conditions at lines 1236, 1248, 1535, 1547).

## 3. FlightGroupCard.tsx -- Already correct

The FlightGroupCard already has the diagonal fade, corner flag, duration pill, left-aligned boarding pass layout, and no `font-display` class. The check-in/checkout bars already have `rounded-t-[14px]` and `rounded-b-[14px]`. The dividers use `h-[2px]` with catColor -- will update to `h-px` with `border-border` color and the wrapper already uses `rounded-[14px]`. Only minor divider softening needed.

## 4. EntrySheet.tsx -- Map thumbnail with navigation popover

### 4a. Add imports
- Import `Popover, PopoverTrigger, PopoverContent` from `@/components/ui/popover`
- Import `Navigation, Car` from `lucide-react`

### 4b. Add `mapPopoverOpen` state
Add `const [mapPopoverOpen, setMapPopoverOpen] = useState(false);` near other state declarations.

### 4c. Build navigation URLs
Add `appleMapsUrl`, `googleMapsUrl`, `uberUrl` computed from `option.latitude`/`option.longitude`/`option.location_name`.

### 4d. Replace map cell (lines 1619-1627)
Wrap the map thumbnail in a `<Popover>` with `<PopoverTrigger>` around the existing thumbnail. The `<PopoverContent>` shows 3 links: Apple Maps (with Navigation icon), Google Maps (with ExternalLink icon), Uber (with Car icon, black bg).

### 4e. Remove standalone MapPreview
The MapPreview component import stays (it's used for the thumbnail image), but the popover replaces the navigation buttons that were inside MapPreview.

Actually, looking at the current code, MapPreview renders its own buttons. We need to either:
- Replace the `<MapPreview>` call with just the static map image + popover, OR
- Keep MapPreview but wrap it in a Popover

The cleaner approach: replace the MapPreview call with just the static map `<img>` tag (same URL pattern) wrapped in a Popover trigger, with the 3 navigation links in the popover content.

## What does NOT change
- EntryCard.tsx (already redesigned)
- EntrySheet.tsx CREATE/EDIT modes
- SidebarEntryCard.tsx
- Any drag/interaction mechanics beyond the resize handle conditions
- Database schema

## Files modified
| File | Scope |
|------|-------|
| `src/components/timeline/TransportConnector.tsx` | Full rewrite to simple info pill + onTap |
| `src/components/timeline/ContinuousTimeline.tsx` | Simplify transport props, remove refreshingTransportId, remove !isCompact from resize handles |
| `src/components/timeline/FlightGroupCard.tsx` | Soften divider lines |
| `src/components/timeline/EntrySheet.tsx` | Map popover with Apple Maps / Google Maps / Uber |


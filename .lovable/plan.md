
# Transport Connector: Mode Colours, Compressed Overlay, Info Sheet

## Overview

Rework the TransportConnector component with mode-based background colours, a compressed overlay mode for short transports, and a new transport overview sheet. Also swap the X icon for a trash icon and add an (i) info button.

## Part 1 -- Mode-Based Background Colours

Update `TransportConnector.tsx` to apply a background colour based on the selected mode:

| Mode | Colour (light) | Colour (dark) |
|------|----------------|---------------|
| Walk | `hsl(140, 40%, 85%)` | `hsla(140, 40%, 30%, 0.3)` |
| Drive | `hsl(0, 40%, 85%)` | `hsla(0, 40%, 30%, 0.3)` |
| Transit | `hsl(45, 50%, 85%)` | `hsla(45, 50%, 30%, 0.3)` |
| Bicycle | `hsl(210, 40%, 85%)` | `hsla(210, 40%, 30%, 0.3)` |

Replace the static `bg-stone-100` class with a dynamic `style={{ backgroundColor }}` that changes based on `currentMode`. Add `transition-colors duration-300` for smooth switching.

## Part 2 -- Info Icon and Trash Icon

**TransportConnector.tsx changes:**

- Add a new `onInfoTap` prop to the component
- Add an `Info` icon (from lucide-react) on the left side of the mode icons row, with a 32x32px minimum tap target. Tapping calls `onInfoTap`.
- Replace the `X` icon with `Trash2` icon (from lucide-react). Same position, same two-tap delete behaviour.
- Remove any `onClick` handler from the card body itself (the outer `div` already has `cursor-default`, so this is mostly about ensuring no click propagation triggers anything)

## Part 3 -- Compressed Overlay Mode

When `height <= 50`, switch to compressed mode:

**TransportConnector.tsx:**
- New `isCompressed` flag: `height <= 50`
- When compressed:
  - Card width becomes `60%` and is centred: `style={{ width: '60%', margin: '0 auto' }}`
  - Show content as a horizontal pill: selected mode emoji + duration, then smaller unselected mode icons
  - Info (i) and trash icons shrink but remain accessible (min 28x28px tap target)
  - Mode switching still works by tapping icons

**ContinuousTimeline.tsx:**
- For transport entries, when `height <= 50`:
  - Apply `z-index: 20` (above normal cards at z-10) so the compressed card overlays adjacent events
  - Adjust the positioned `div` to allow the card to visually overflow by adding negative margins or extending height slightly (e.g., `top: top - 8, height: height + 16`) so the pill overlaps boundaries
  - The `overflow-visible` class is already on the parent

## Part 4 -- Transport Overview Sheet (New Component)

Create `src/components/timeline/TransportOverviewSheet.tsx`:

**Props:**
- `open: boolean`
- `onOpenChange: (open: boolean) => void`
- `option: EntryOption`
- `entry: EntryWithOptions`
- `fromLabel: string`
- `toLabel: string`
- `selectedMode: string`
- `onModeSelect: (mode, durationMin, distanceKm, polyline?) => void`
- `onRefresh: () => void`
- `isRefreshing: boolean`
- `onDelete: () => void`

**Content (using existing Sheet component):**
1. **Title**: "Route" at top
2. **From/To**: Full place names with arrow
3. **Mode grid**: 4 mode cards in a 2x2 grid, each showing emoji + label + duration + distance. Selected mode highlighted with coloured border matching mode colour. Tapping switches mode.
4. **Selected mode details**: Duration and distance shown prominently
5. **Map preview**: Use existing `RouteMapPreview` component with `size="full"` if `route_polyline` exists
6. **Refresh button**: Full-width secondary button
7. **Delete button**: Full-width red destructive button at bottom. Tapping calls `onDelete` and closes sheet.
8. **Close (X)**: 44x44px tap target, top-right

**Integration in ContinuousTimeline.tsx:**
- Add state: `transportSheetEntry` (the entry to show in the sheet, or null)
- Pass `onInfoTap={() => setTransportSheetEntry(entry)}` to TransportConnector
- Render `<TransportOverviewSheet>` once at the bottom of the component, controlled by `transportSheetEntry`

## Files Modified

| File | Changes |
|------|---------|
| `src/components/timeline/TransportConnector.tsx` | Mode colours, compressed mode, info icon, trash icon, `onInfoTap` prop |
| `src/components/timeline/TransportOverviewSheet.tsx` | **NEW** -- transport overview sheet component |
| `src/components/timeline/ContinuousTimeline.tsx` | Transport sheet state, pass `onInfoTap`, compressed overlay z-index/positioning |

## What Does NOT Change

- Transport connector positioning logic (global hour system)
- Transport duration locking
- Transport attachment logic (starts at exact end of departing event)
- SNAP system behaviour
- Drag chain behaviour
- EntryCard transport variants (compact/medium/condensed/full in EntryCard.tsx -- these are separate from TransportConnector and used in different contexts)
- Auto-scroll or continuous timeline
- Flight cards, regular event cards

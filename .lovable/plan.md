

# Design Overhaul: Diagonal Fade Cards, Transport Pill, Overview Layout

## Overview
A comprehensive visual redesign across 4 files, replacing the current left-border card style with immersive diagonal-fade image cards, compact transport connectors, and a reorganized entry overview sheet.

## Phase 1 -- EntryCard.tsx (Core Card Redesign)

### 1a. Add `extractHue` helper
Utility to pull the hue from category HSL strings for glossy no-image backgrounds:
```ts
const extractHue = (hslString: string): number => {
  const match = hslString.match(/hsl\((\d+)/);
  return match ? parseInt(match[1]) : 260;
};
```

### 1b. Diagonal fade gradients (all 4 tiers)
Replace the current vertical `bg-gradient-to-t from-black/80 via-black/40 to-black/5` with tier-specific diagonal gradients applied as inline `style.background` on an overlay div:

- **Full** (>=160px): `linear-gradient(152deg, transparent 30%, rgba(10,8,6,0.3) 40%, rgba(10,8,6,0.72) 50%, rgba(10,8,6,0.94) 60%)`
- **Condensed** (80-159px): `linear-gradient(155deg, transparent 22%, ...0.92 52%)`
- **Medium** (40-79px): `linear-gradient(158deg, transparent 18%, ...0.96 52%)`
- **Compact** (<40px): `linear-gradient(160deg, transparent 12%, ...0.96 46%)`

### 1c. Glossy no-image cards
Replace `borderLeftWidth + tintBg` with:
- Dark mode: `linear-gradient(145deg, hsl(H,30%,16%), hsl(H,15%,9%))` + glass highlight `linear-gradient(152deg, rgba(255,255,255,0.05) 25%, ..., transparent 55%)`
- Light mode: `linear-gradient(145deg, hsl(H,25%,92%), hsl(H,15%,86%))` + brighter glass + `border: 1px solid rgba(0,0,0,0.06)`
- Remove `borderLeftWidth`, `borderLeftColor`, `borderColor` inline styles

### 1d. Corner flags (emoji only, all tiers)
Replace category badge pills (`<span>` with emoji + text name) with a corner flag:
- Position: `absolute top-0 left-0 z-20`
- Style: `borderRadius: '14px 0 8px 0'`, background = catColor, white emoji
- Sizes: Full 16px, Condensed 13px, Medium 11px, Compact 9px
- Remove all `catName` text from badges

### 1e. Duration pills (top-right, frosted glass)
Move duration from bottom content area to `absolute top-right z-20`:
- Image cards: `rgba(255,255,255,0.22)` bg, `backdrop-filter: blur(12px)`, white border, white text
- No-image dark: `rgba(255,255,255,0.1)` bg, lighter border
- No-image light: `rgba(0,0,0,0.06)` bg, dark text
- Sizes: Full 14px/5px 14px padding, Condensed 12px, Medium 11px, Compact 10px

### 1f. Content repositioning
- Content container: `absolute bottom-0 right-0 z-10 text-right text-white` with tier-appropriate padding and `max-width: 68-75%`
- Full: name 17px bold, rating 11px, location 10px, time 10px
- Condensed: name 14px bold, rating 10px (1 line), time small
- Medium: name 13px bold, time only
- Compact: name 12px bold only, centered vertically

### 1g. Compact cards full redesign
Replace the current flat single-line layout (lines 482-516) with the same diagonal-fade/glossy structure at 34-38px height with tiny corner flag, tiny duration pill, and right-aligned title.

### 1h. Preserve existing functionality
- All drag handlers (`onMouseDown`, `onTouchStart`, etc.) remain unchanged
- `isDragging` classes (ring-2, scale, shadow-xl, z-50) remain
- `isShaking`, `isEntryPast`, `overlapFraction` overlays remain
- `isCheckIn`/`isCheckOut` labels remain
- Transport card variants (isTransfer) remain unchanged (they use their own layout)
- Lock icon display stays
- Vote button stays on full cards

## Phase 2 -- TransportConnector.tsx (Compact Pill + Expand)

### 2a. Add `expanded` state
```ts
const [expanded, setExpanded] = useState(false);
```

### 2b. Collapsed state (default)
Left-aligned pill showing: `[selectedEmoji] [duration] [· distance] [cog button]`
- Position: `absolute left-1 top-1/2 -translate-y-1/2 z-20`
- `min-height: 32px`, `rounded-2xl`
- Cog button with orange tint opens expanded state

### 2c. Expanded state
Left-aligned wider pill showing: `[info] [walk dur] [transit dur] [drive dur] [bike dur] [refresh] [trash] [close]`
- Same position but wider, `min-height: 40px`, `rounded-3xl`
- Close button (X icon) returns to collapsed
- Mode buttons styled same as current but in left-aligned pill

### 2d. From/To label
Always shown below the pill (not only when height >= 100), `absolute bottom-1 left-1`, truncated, small text.

### 2e. Background strip
Unchanged -- fills gap with mode-colored background at the `height` provided by ContinuousTimeline.

## Phase 3 -- EntrySheet.tsx (Overview Redesign)

### 3a. Time + Map side-by-side
Replace the current single-row time display (lines 1567-1599) and standalone MapPreview (lines 1653-1657) with a `grid grid-cols-2 gap-2.5`:
- Left cell: Time card with rounded-xl border, showing start-end times (InlineField) + duration as large bold text
- Right cell: MapPreview in rounded-xl border with "Open in Maps" link, or a placeholder pin emoji

### 3b. Phone + Website side-by-side
Replace the separate phone (in PlaceDetailsSection) and website (InlineField at lines 1616-1630) with a `grid grid-cols-2 gap-2.5`:
- Left: Phone card with emoji, label, tappable link
- Right: Website card with emoji, label, truncated hostname link

### 3c. Opening hours -- show entry day, not today
Change `getTodayHours` to `getEntryDayHours` accepting the entry's `start_time`. Show the entry's day name + hours in the collapsed trigger. Highlight the entry's day (not today) when expanded.

### 3d. Notes and Budget collapsible
Wrap Notes and Budget sections in `<Collapsible>` components, starting closed with chevron triggers.

### 3e. PlaceDetailsSection refactor
Extract phone out of PlaceDetailsSection (it moves to the grid). Keep rating + price level in PlaceDetailsSection. Opening hours stays but uses entry day logic.

## Phase 4 -- SidebarEntryCard.tsx (Match Design Language)

### 4a. Diagonal fade for image cards
Replace `bg-gradient-to-r from-black/80 via-black/50 to-black/30` with diagonal: `linear-gradient(152deg, transparent 25%, rgba(10,8,6,0.3) 35%, rgba(10,8,6,0.7) 50%, rgba(10,8,6,0.92) 65%)`

### 4b. Corner flag
Add category emoji corner flag (top-left, 13px emoji, same style as timeline cards).

### 4c. Glossy no-image cards
Replace colored left border + tinted bg with the same glossy dark/light gradient treatment.

### 4d. Duration pill
Move duration from bottom-row badge to top-right frosted pill.

## What does NOT change
- Drag mechanics, touch handling, RAF loop, auto-scroll
- ContinuousTimeline entry rendering structure (positioning divs, height calculations)
- Flight cards and flight group rendering
- Hotel special handling (check-in/out labels)
- Database schema
- Category definitions
- WeatherBadge positioning
- Undo/redo system
- Lock/voting functionality

## Files modified
| File | Scope |
|------|-------|
| `src/components/timeline/EntryCard.tsx` | Full redesign of all 4 tiers + glossy fallback |
| `src/components/timeline/TransportConnector.tsx` | Replace centered pill with collapsed/expanded left-aligned pill |
| `src/components/timeline/EntrySheet.tsx` | Overview layout: grids, collapsibles, entry-day hours |
| `src/components/timeline/SidebarEntryCard.tsx` | Match diagonal fade, corner flag, glossy, duration pill |


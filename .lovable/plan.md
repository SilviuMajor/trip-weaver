

# Rewrite TransportConnector + Update Rendering

## Overview
Replace the current minimal dot-line connector with a full-width colour-fill band that visually represents travel time vs buffer time. Add a "+" button for quick event insertion at the transport arrival time.

## Changes

### 1. Rewrite `src/components/timeline/TransportConnector.tsx`

Complete rewrite with new props and visual design:

**Props**: Accept `entry`, `option` (EntryWithOptions/EntryOption types), `height`, `gapHeight`, `transportMinutes`, `gapMinutes`, `fromLabel`, `toLabel`, `onTap`, `onAddAtArrival`.

**Mode detection**: Parse mode from option name (walk/drive/bicycle/transit) using existing pattern from connectorData.

**Colour scheme**: Per-mode colours for stripe, fill, background, and text. Different opacities for light vs dark mode (detect via `window.matchMedia` or CSS variable approach -- will use inline rgba so it works in both).

**Three rendering modes** based on `gapHeight`:
- **Normal** (>=22px): Full text row (emoji + duration + destination + cog), fill band, "+" button at bottom-right
- **Compact** (14-22px): Emoji + duration + cog only, smaller font, no "+" button
- **Overflow** (<14px): 22px minimum height, centered on gap midpoint via negative top offset, backdrop-blur for readability, z-5

**Structure**:
- Outer div: full width, `position: absolute` when overflow, `position: relative` otherwise
- Left stripe: 3px wide, full height, solid mode colour, rounded-l-sm
- Fill area: starts from top, height = `min(100, transportMinutes/gapMinutes * 100)%`, mode colour at 12% opacity
- Background: mode colour at 3% opacity (unfilled area)
- Text row: top of band, left-aligned after stripe
- "+" button: 20x20 circle, bottom-right, dashed border, calls `onAddAtArrival`

### 2. Update `src/components/timeline/ContinuousTimeline.tsx` -- Connector rendering (lines 1278-1309)

**Enhance connectorData useMemo** (lines 529-586): Add `fromLabel`, `toLabel`, and `transportEntry` reference to each connector object so we can pass the full entry/option to TransportConnector.

**Update rendering block** (lines 1279-1309):
- Compute `gapMinutes` and `transportMinutes` for each connector
- For overflow mode (gapPx < 14): set container `overflow: visible` and z-index 5
- Pass new props to TransportConnector: `entry`, `option`, `gapHeight`, `gapMinutes`, `transportMinutes`, `fromLabel`, `toLabel`, `onAddAtArrival`
- `onAddAtArrival` calls `onAddBetween` with the transport entry's `end_time`
- `onTap` still opens the transport overlay via `onTransportCogTap` or falls back to `onCardTap`

**Gap rendering update** (lines 1218-1276): 
- The `hasTransferBetween` check at line 1220 already skips gap buttons when transport exists between entries
- No changes needed to existing gap rendering -- the connector band replaces the dashed center line only in the connector rendering area, and gap buttons remain for non-transport gaps

### 3. Files Modified

- `src/components/timeline/TransportConnector.tsx` -- complete rewrite
- `src/components/timeline/ContinuousTimeline.tsx` -- update connectorData memo and connector rendering block

### Technical Details

**Overflow positioning**: The parent container div already handles overflow centering (line 1283: `connTop = topPx - (20 - gapPx) / 2`). Will update this to use 22px minimum and pass the computed values to TransportConnector. The component itself will handle backdrop-blur and elevated z-index internally based on `gapHeight < 14`.

**No drag/snap changes**: This is purely visual. All drag, snap, and transport creation/deletion logic remains untouched.

**Import changes**: TransportConnector import stays the same. Need to add `Settings, Plus` to imports in TransportConnector (from lucide-react).

**Dark/light mode**: Using inline rgba colours that work in both modes. The fill opacity differences (0.12 dark vs 0.15 light) can be handled with a simple `prefers-color-scheme` media query check or by using slightly higher base opacity that works well in both.

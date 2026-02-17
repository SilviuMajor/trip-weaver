
# Unified Explore to Timeline Drag

## Overview
Add touch-hold drag (and desktop mouse-drag) to ExploreCards so they can be dragged directly onto the timeline, producing the same floating card and ghost outline as sidebar drags. Reuses the existing `handleDropExploreCard` function which already creates entries from ExploreResults at a given global hour.

## Changes

### 1. `ExploreCard.tsx` -- Add touch-hold and mouse-drag system

**New props:**
- `onExploreDragStart?: (place: ExploreResult, position: { x: number; y: number }) => void`
- `onExploreDragMove?: (x: number, y: number) => void`
- `onExploreDragEnd?: () => void`

**Touch handling (identical pattern to SidebarEntryCard from Prompt 8):**
- `onTouchStart`: register document-level `touchmove` (passive: false), `touchend`, `touchcancel`
- 300ms hold timer with 10px movement threshold cancellation
- On hold: call `onExploreDragStart(place, pos)`, vibrate 20ms
- Move/end call `onExploreDragMove`/`onExploreDragEnd`
- Keep existing `draggable` + `onDragStart` for HTML5 fallback

**Mouse drag for desktop:**
- `onMouseDown`: register document-level `mousemove`/`mouseup`
- 5px movement threshold before starting
- Calls same drag callbacks

### 2. `ExploreView.tsx` -- Thread drag callbacks

**New props on `ExploreViewProps`:**
- `onExploreDragStart?: (place: ExploreResult, position: { x: number; y: number }) => void`
- `onExploreDragMove?: (x: number, y: number) => void`
- `onExploreDragEnd?: () => void`

**Pass to all 3 ExploreCard render sites:**
- Map view cards (line ~1218)
- "Your Places" cards (line ~1347)
- Main results list cards (line ~1371)

Each passes the callbacks through, with `onExploreDragStart` wrapping the place and also inferring the category:
```
onExploreDragStart={(place, pos) => onExploreDragStart?.(place, pos)}
```

### 3. `Timeline.tsx` -- Add explore drag state and visuals

**New state:**
```
exploreDrag: {
  place: ExploreResult;
  categoryId: string | null;
  clientX: number;
  clientY: number;
  globalHour: number | null;
} | null
```

**New callbacks:**
- `handleExploreDragStartUnified(place, pos)`: sets `exploreDrag` state, closes explore panel on mobile, starts 5-second cancel timeout
- `handleExploreDragMoveUnified(x, y)`: updates position, computes `globalHour` from timeline area (same logic as sidebar drag), auto-scroll near edges
- `handleExploreDragEndUnified()`: reads `globalHour`, calls existing `handleDropExploreCard(place, categoryId, globalHour)` which already handles creating the entry with photos in the background. Cleans up state.

**Pass to both ExploreView instances** (desktop embedded at line ~2892, mobile at line ~3063):
```
onExploreDragStart={handleExploreDragStartUnified}
onExploreDragMove={handleExploreDragMoveUnified}
onExploreDragEnd={handleExploreDragEndUnified}
```

**Floating card render (fixed position, z-[60]):**
- Rendered at page level when `exploreDrag` is set
- Shows a simplified card: rounded-xl with place name, address, rating, and category emoji
- Time pill shows computed drop time when over the timeline area

**Ghost outline on timeline:**
- When `exploreDrag` is active and `globalHour` is computed, the ghost outline appears at the computed position (1-hour default height)
- Uses green snap style when within 20min of another card (same logic as existing snap detection)

### Key Reuse

The `handleDropExploreCard` function already exists at line 1938 and handles:
- Converting globalHour to ISO timestamps with timezone awareness
- Calling `handleAddAtTime` which creates the entry + option in the database
- Background photo fetching
- Smart Drop (from Prompt 7) applies automatically since `handleAddAtTime` calls `handleEntryTimeChange` internally

No database changes needed -- uses existing `entries` and `entry_options` tables.

## Files Modified
- `src/components/timeline/ExploreCard.tsx` -- touch-hold + mouse-drag callbacks
- `src/components/timeline/ExploreView.tsx` -- thread callbacks to all ExploreCard instances
- `src/pages/Timeline.tsx` -- explore drag state, floating card, ghost outline, pass callbacks to ExploreView

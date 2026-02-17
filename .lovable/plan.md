

# Unified Planner to Timeline Drag

## Overview
Replace the existing touch-based drag system in `SidebarEntryCard` with a unified system that uses document-level touch listeners (surviving sidebar DOM changes), and add desktop mouse-drag support. The floating card and ghost outline match the timeline's visual style. The existing HTML5 drag-and-drop is kept as a fallback for desktop.

## Changes

### 1. `SidebarEntryCard.tsx` -- Add unified drag callbacks and rewrite touch handling

**New props added to interface:**
- `onSidebarDragStart?: (entry: EntryWithOptions, position: { x: number; y: number }) => void`
- `onSidebarDragMove?: (x: number, y: number) => void`
- `onSidebarDragEnd?: () => void`

**Touch handling rewrite (replace existing `onTouchStart`/`onTouchMove`/`onTouchEnd`):**
- Remove the React-level `onTouchMove` and `onTouchEnd` handlers from the div
- In `onTouchStart`: register document-level `touchmove` (passive: false), `touchend`, and `touchcancel` listeners
- 300ms hold timer with 10px movement threshold cancellation
- On hold trigger: call `onSidebarDragStart`, then subsequent `touchmove` calls `onSidebarDragMove`, and `touchend` calls `onSidebarDragEnd`
- All listeners cleaned up on end/cancel
- Keep `draggable` and `onDragStart` for HTML5 desktop fallback

**Mouse drag for desktop (new `onMouseDown`):**
- On mousedown, register document-level `mousemove` and `mouseup`
- Use a 5px movement threshold before starting drag (to distinguish from clicks)
- Once threshold crossed: call `onSidebarDragStart`, then `onSidebarDragMove` on each `mousemove`, `onSidebarDragEnd` on `mouseup`
- Clean up listeners on mouseup
- Prevent default to avoid conflicting with HTML5 drag

### 2. `PlannerContent.tsx` -- Thread new callbacks through

**New props on PlannerContentProps:**
- `onSidebarDragStart?: (entry: EntryWithOptions, position: { x: number; y: number }) => void`
- `onSidebarDragMove?: (x: number, y: number) => void`
- `onSidebarDragEnd?: () => void`

**Pass to every `SidebarEntryCard` instance** in both `renderCategoryRow` and `renderOtherRow`.

### 3. `CategorySidebar.tsx` -- Thread new callbacks through

**New props on CategorySidebarProps:**
- `onSidebarDragStart?: (entry: EntryWithOptions, position: { x: number; y: number }) => void`
- `onSidebarDragMove?: (x: number, y: number) => void`
- `onSidebarDragEnd?: () => void`

**Pass to `PlannerContent`.**

### 4. `Timeline.tsx` -- Manage sidebar drag state and render visuals

**New state:**
```
sidebarDrag: { entry: EntryWithOptions; clientX: number; clientY: number } | null
```

**New callbacks:**
- `handleSidebarDragStartUnified(entry, pos)`: sets `sidebarDrag` state, hides planner on mobile (`touchDragHidePlanner = true`), starts 5-second cancel timeout
- `handleSidebarDragMoveUnified(x, y)`: updates `sidebarDrag.clientX/clientY`, computes `globalHour` from timeline area (same logic as existing `handleTouchMove` at lines 2009-2035), resets cancel timeout on movement
- `handleSidebarDragEndUnified()`: reads computed `globalHour`, calls existing `handleDropOnTimeline(entry.id, globalHour)` which already handles scheduling + Smart Drop. Cleans up state.

**Pass to both `CategorySidebar` instances** (mobile and desktop).

**Floating card render (fixed position, z-[60]):**
- Rendered at page level (outside sidebar DOM) when `sidebarDrag` is set
- Shows a compact `SidebarEntryCard` at 200px width, centered on finger/cursor with slight offset
- Shows time pill below the card when over the timeline area (same style as existing touch drag ghost)

**Ghost outline on timeline:**
- When `sidebarDrag` is active and `globalHour` is computed, render a ghost outline on the timeline grid at the computed position
- Width matches the timeline entry column, height based on entry duration
- Uses green snap style when within 20min of another card (reuses existing snap detection)

**Remove old touch drag system:**
- The old `touchDragEntry`/`touchDragPosition`/`touchDragGlobalHour` state and related `handleTouchDragStart`/`cleanupTouchDrag`/document-level listener effect (lines 1970-2067) are replaced by the new unified system
- The old touch drag ghost render (lines 3152-3178) is replaced by the new floating card

## Behavior Summary

| Platform | Interaction | Result |
|----------|-------------|--------|
| Mobile touch | 300ms hold on sidebar card | Floating card follows finger, ghost on timeline, drop schedules entry |
| Desktop mouse | Click + drag sidebar card | Floating card follows cursor, ghost on timeline, drop schedules entry |
| Desktop HTML5 | Native drag (fallback) | Existing behavior preserved via `draggable` + `onDragStart` |
| Snap | Drop within 20min of card | Green snap ghost, transport created on release |
| Smart Drop | Drop on unlocked card | Pushed card down (from Prompt 7) |

## Files Modified
- `src/components/timeline/SidebarEntryCard.tsx` -- new drag callbacks, document-level listeners
- `src/components/timeline/PlannerContent.tsx` -- thread callbacks
- `src/components/timeline/CategorySidebar.tsx` -- thread callbacks  
- `src/pages/Timeline.tsx` -- state management, floating card, ghost outline, replace old touch drag


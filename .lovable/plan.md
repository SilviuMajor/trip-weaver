

# Keep Sheet Mounted During Touch Drag via `forceHide` Prop

## Problem
The previous fix closed the Sheet (`setSidebarOpen(false)`) during touch drag, which unmounts the DOM element that started the touch. iOS Safari cancels the active touch sequence when its originating element is removed, freezing the ghost card.

## Solution
Add a `forceHide` prop to the Sheet component that visually hides the overlay and content via inline styles while keeping everything mounted in the DOM. This preserves the iOS touch context.

## Changes

### 1. `src/components/ui/sheet.tsx` -- Add `forceHide` prop to SheetContent
- Extend `SheetContentProps` with `forceHide?: boolean`
- When `forceHide` is true, apply inline styles to `SheetOverlay` (`opacity: 0`, `pointerEvents: 'none'`) and to `SheetPrimitive.Content` (`transform: translateX(100%)`, `pointerEvents: 'none'`) with 150ms transitions
- All existing Sheet usage is unaffected (forceHide defaults to undefined/false)

### 2. `src/components/timeline/CategorySidebar.tsx` -- Re-add `hiddenForDrag` prop
- Add `hiddenForDrag?: boolean` back to the interface
- Pass it as `forceHide={hiddenForDrag}` to `SheetContent`
- Sheet stays `open={open}` at all times -- never conditionally closed during drag

### 3. `src/pages/Timeline.tsx` -- Use hide state instead of closing
- Re-add `touchDragHidePlanner` state (boolean, default false)
- `handleTouchDragStart`: set `setTouchDragHidePlanner(true)` instead of `setSidebarOpen(false)`
- `cleanupTouchDrag`: set `setTouchDragHidePlanner(false)` then `setSidebarOpen(false)` to properly close the planner after drag ends
- Pass `hiddenForDrag={touchDragHidePlanner}` to the mobile `CategorySidebar`

## Files changed
1. `src/components/ui/sheet.tsx`
2. `src/components/timeline/CategorySidebar.tsx`
3. `src/pages/Timeline.tsx`


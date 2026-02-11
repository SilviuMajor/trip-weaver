

# Remove Zoom and Today Buttons (Keep Undo/Redo)

## Overview

Remove the zoom controls (ZoomIn/ZoomOut + label) and the "Today" scroll button from the bottom-right corner. The Undo/Redo floating pill (rendered by `UndoRedoButtons` component) stays untouched.

---

## Changes

### File: `src/pages/Timeline.tsx`

1. **Remove the bottom controls block** (lines 1328-1348) -- the entire `fixed bottom-6 right-6` div containing:
   - Zoom in/out buttons + zoom label
   - "Today" scroll button

2. **Clean up unused imports**:
   - Remove `ZoomIn`, `ZoomOut`, `ArrowDown` from the lucide-react import (line 7)
   - Remove `useTimelineZoom` import (line 12)

3. **Remove zoom hook call** (line 94): `const { zoom, changeZoom, spacingClass, cardSizeClass, zoomLabel } = useTimelineZoom(scrollRef);`

4. **Remove `scrollToToday` function** if it exists and is only used by this button.

5. **Remove references to `spacingClass`, `cardSizeClass`, `zoom`** wherever they're used in the JSX (these control card sizing based on zoom level). Replace with fixed defaults (the zoom=2 / "1hr" defaults: `space-y-3` and `min-h-[100px]`).

### File: `src/hooks/useTimelineZoom.ts`

No deletion needed immediately, but it becomes unused dead code. Can be cleaned up later.

### What stays

- `UndoRedoButtons` component (fixed bottom-4 right-4) -- completely untouched
- Mobile FABs (sidebar toggle, live panel) -- untouched



# Remove All Diagnostic Alerts

## Changes

### File 1: `src/hooks/useDragResize.ts`
- **Line 110**: Remove `alert('START DRAG');`
- **Line 291**: Remove `alert('TOUCH START');`
- **Line 320**: Remove `alert('HOLD CANCEL');`
- **Line 363**: Remove `alert('HOLD OK');`

No import changes needed (the `toast` import was already removed previously).

### File 2: `src/components/timeline/ContinuousTimeline.tsx`
- **Lines 616-623**: Delete the entire document-level diagnostic `useEffect` block (`alert('DOC TOUCH')`)
- **Lines 625-638**: Delete the entire grid-level diagnostic `useEffect` block (`alert('GRID TOUCH')`)

### Nothing else changes
All drag functionality, touch handlers, card rendering, `touch-action` styles, `data-entry-card` / `data-entry-id` attributes, and everything else remains exactly as-is.

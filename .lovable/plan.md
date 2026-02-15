

# Replace Diagnostic Toasts with Native alert() Calls

## Why
Sonner toasts may not be rendering on mobile Safari. Native `alert()` creates a blocking browser dialog that is impossible to miss -- it will definitively confirm whether touch events are firing.

## Changes

### File 1: `src/components/timeline/ContinuousTimeline.tsx`

**Document-level diagnostic (~line 615-620):**
Replace `toast('Document touch fired', ...)` with `alert('DOC TOUCH')`.

**Grid-level diagnostic (~line 625-640):**
Replace the `toast.info(...)` call with `alert('GRID TOUCH: ' + (cardEl ? 'CARD' : target.tagName))`. Remove the extra details (isEditor, entryId) to keep the alert short.

### File 2: `src/hooks/useDragResize.ts`

Replace all 4 diagnostic toast calls with alert:
- `toast.info('startDrag called...')` at line ~108 becomes `alert('START DRAG')`
- `toast.info('Touch started', ...)` at line ~212 becomes `alert('TOUCH START')`
- `toast.success('Hold succeeded...')` at line ~254 becomes `alert('HOLD OK')`
- `toast.warning('Hold cancelled...', ...)` at line ~243 becomes `alert('HOLD CANCEL')`

Remove `import { toast } from 'sonner';` if no other toast calls remain.

### No other changes
All existing drag logic, card rendering, touch handlers, and styling remain untouched.

### What to report after applying
Touch anywhere on the mobile timeline. A native browser alert dialog (blocking popup) will appear. Report exactly what text it shows.


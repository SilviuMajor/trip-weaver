

# Add Native DOM Touch Diagnostics

## What and Why
React's `onTouchStart` on the card wrapper div is not firing on mobile. We need to bypass React's synthetic event system entirely and attach native DOM `addEventListener('touchstart', ...)` to determine:
- Whether native touch events reach the grid at all
- Whether the touch target is a card element
- Whether `isEditor` and `onEntryTimeChange` have the expected values

## Changes (single file: `src/components/timeline/ContinuousTimeline.tsx`)

### 1. Add `data-entry-id` to the card wrapper div (line 1048)
Add `data-entry-id={entry.id}` so the diagnostic listener can identify which card was touched.

### 2. Add document-level native touch diagnostic (before line 616)
A `useEffect` that attaches a native `touchstart` listener on `document`. This confirms whether ANY touch events fire at all on the page. Shows toast: "Document touch fired".

### 3. Add grid-level native touch diagnostic (before line 616)
A `useEffect` that attaches a native `touchstart` listener on `gridRef.current`. This reports:
- Whether the touch target is a CARD element or something else
- The current value of `isEditor`
- Whether `onEntryTimeChange` is defined (both are required for `canDrag` to be true)

### No other changes
All existing code, diagnostic toasts in `useDragResize.ts`, card styling, and touch handlers remain untouched.

### Technical Detail
Both listeners use `{ passive: true }` since they are read-only diagnostics that do not call `preventDefault()`. They are cleaned up on unmount via the returned cleanup function.

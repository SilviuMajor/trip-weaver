

# Fix SNAP Button Visibility (CSS Positioning Bug)

## Root Cause

The SNAP button is rendered but invisible due to a CSS positioning error.

The SNAP button JSX (line 1034-1144) sits inside `<div key={entry.id}>` which has `position: static`. The button itself has `position: absolute` with `style={{ top: height + 2 }}`. Since its parent is not positioned, the `absolute` positioning references the nearest positioned ancestor -- the grid container itself. This means `top: height + 2` (e.g., `top: 28px` for a short transport card) places the button near the top of the entire grid, far from where it should appear.

## Fix

Move the SNAP button **inside** the positioned card container (the `div` at line 748 with `position: absolute` and explicit `top`/`height`). Place it just before that container's closing tag (line 1032), but allow it to overflow by removing `overflow: hidden` if present, or by positioning it differently.

Specifically:

### File: `src/components/timeline/CalendarDay.tsx`

**Option A (simplest):** Move the SNAP button inside the card's absolutely-positioned wrapper (line 748-1032) and set `overflow: visible` on that wrapper so the button can render below the card bounds.

1. Move the SNAP button block (lines 1034-1144) to just before line 1031 (inside the positioned card div, after the `+ buttons` section).

2. Add `overflow-visible` to the card wrapper div at line 749:
   ```typescript
   className={cn(
     'absolute pr-1 group overflow-visible',
     isDragged && 'opacity-80 z-30',
     !isDragged && 'z-10'
   )}
   ```

3. The SNAP button's `style={{ top: height + 2 }}` will now correctly position relative to this card's positioned parent, placing it just below the transport connector strip.

4. Keep the existing SNAP-DEBUG logging for verification.

No other files need changes.

## Technical Details

| Item | Detail |
|------|--------|
| File | `src/components/timeline/CalendarDay.tsx` |
| Lines affected | ~748-749 (add overflow-visible), ~1031-1144 (move SNAP block inside positioned parent) |
| Risk | Low -- only moves existing JSX within the same component scope; all variables (`isTransport`, `entry`, `primaryOption`, `height`, etc.) remain in scope |

## Expected Outcome

- SNAP button appears visually below transport connector cards when there is a gap to the next event
- Button is clickable and triggers the existing `handleSnapNext` logic
- SNAP-DEBUG logs continue to confirm `shouldShowSnap: true`

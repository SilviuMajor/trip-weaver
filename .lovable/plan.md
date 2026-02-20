

# Fix Mobile Scroll-on-Card (Remaining Issues)

Two of the four fixes are already in place (EntryCard `pan-y` and useDragResize two-phase lifecycle). Two issues remain:

---

## Fix 1: Remove `touchAction: 'none'` from Card Wrapper

**File:** `src/components/timeline/ContinuousTimeline.tsx` (line 1587)

Delete `touchAction: 'none'` from the wrapper div's style object. The child EntryCard already handles touch action via `pan-y`.

---

## Fix 2: Remove Double-Fire (wrapper onTouchStart)

**File:** `src/components/timeline/ContinuousTimeline.tsx` (lines 1566-1569)

Remove the `onTouchStart` prop from the wrapper div entirely. Both the wrapper and EntryCard currently call `onTouchStart`, creating duplicate timers and listeners.

Move the `dismissCardHint()` call into the EntryCard's `onTouchDragStart` handler (line 1736-1737), so the hint is still dismissed on touch.

---

## Fix 3: Add Double-Fire Guard to useDragResize

**File:** `src/hooks/useDragResize.ts` (line 344, after the function signature)

Add `if (touchTimerRef.current) return;` guard at the top of `onTouchStart` to prevent duplicate sequences if somehow called twice.

---

## Technical Details

| File | Line(s) | Change |
|------|---------|--------|
| `ContinuousTimeline.tsx` | 1587 | Delete `touchAction: 'none'` from wrapper style |
| `ContinuousTimeline.tsx` | 1566-1569 | Delete `onTouchStart` prop from wrapper div |
| `ContinuousTimeline.tsx` | 1736-1737 | Add `dismissCardHint();` before `onTouchStart` call |
| `useDragResize.ts` | 344 | Add `if (touchTimerRef.current) return;` guard |


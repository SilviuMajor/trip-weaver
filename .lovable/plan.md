

# Fix: Gap, Gutter Z-Index, Click Issues, Category Badges, and Sunrise/Sunset Line

## 1. Gap Above Date Header

The day header has `py-3` (12px top+bottom padding) and the content below also has `py-3`. Combined with the "Trip Begins" banner on the first day, this creates noticeable whitespace.

**Fix**: Reduce header padding from `py-3` to `py-1.5` and content padding from `py-3` to `py-2`. This tightens the layout without removing structure.

**File**: `CalendarDay.tsx` line 226 (`py-2` to `py-1.5`) and line 288 (`py-3` to `py-2`).

## 2. Timezone Gutter Behind Cards

The time labels (05:00, 06:00, etc.) are positioned at `left: 0` inside `TimeSlotGrid`, which sits inside a container with `ml-14` / `ml-20`. This means the labels start at the left edge of the card area -- they are not to the left of cards, they overlap them.

The labels need to be positioned with a negative `left` value so they appear in the margin space, outside the card container.

**Fix**: In `TimeSlotGrid.tsx`, change the time label positioning from `left-0` to a negative left value (e.g., `left: -56px` for single-TZ, `left: -80px` for dual-TZ) so labels sit in the `ml-14`/`ml-20` margin space. Pass a prop for the margin width so labels know where to go.

Alternatively, simpler approach: Move the time labels out of `TimeSlotGrid` and into `CalendarDay` positioned absolutely with negative left, ensuring they are outside the card container entirely.

**File**: `TimeSlotGrid.tsx` lines 269-294 -- change `left-0` positioning to negative left values.
**File**: `CalendarDay.tsx` -- pass `gutterWidth` prop to `TimeSlotGrid`.

## 3. Card Click Requires Multiple Clicks

The drag system in `useDragResize.ts` sets `wasDraggedRef.current = true` in `startDrag()` (line 63), which is called on every mousedown for draggable cards. The click handler on the card checks `if (!wasDraggedRef.current)` before opening the overlay (CalendarDay line 452). Since `wasDragged` is true immediately on mousedown, the first click after any interaction is blocked. It only resets after a 150ms timeout.

**Fix**: Don't set `wasDraggedRef.current = true` immediately in `startDrag`. Instead, only set it to true once actual movement occurs (i.e., in `handlePointerMove` when delta exceeds a small threshold like 5px). This way, a simple click (mousedown + mouseup without movement) will not flag as "dragged" and the overlay will open immediately.

**File**: `useDragResize.ts` -- remove `wasDraggedRef.current = true` from `startDrag` (line 63). Add it to `handlePointerMove` when actual movement is detected.

## 4. Category Indicators: Uniform Size

Currently, regular categories use `px-2.5 py-1 text-xs` while processing entries (Check-in/Checkout) use `text-[10px] px-2 py-0.5`. The user prefers the Check-in size for all.

**Fix**: Make all category badges use the smaller Check-in styling: `text-[10px] px-2 py-0.5` with slightly smaller emoji.

**File**: `EntryCard.tsx` lines 201-213 -- remove the conditional sizing and apply the compact style universally.

## 5. Sunrise/Sunset Gradient Line

Replace the orange background effect with a 5px-wide vertical gradient line that runs alongside the time gutter. The gradient should transition through:
- Dark blue (night) at the top/bottom
- Warm sunrise colors (orange/amber) around sunrise hour
- Light blue (day) through midday
- Warm sunset colors around sunset hour
- Back to dark blue (night)

This uses the existing `sunCalc.ts` to determine sunrise/sunset hours for the day, then renders a thin absolute-positioned div with a CSS gradient.

**File**: `CalendarDay.tsx` -- add a new 5px-wide `div` positioned at the left edge of the time gutter (next to or just inside the weather column). The gradient stops are computed from `calculateSunTimes()` mapped to the day's hour range.

---

## Technical Summary

| File | Changes |
|------|---------|
| `CalendarDay.tsx` | Reduce header/content padding. Add 5px sunrise/sunset gradient line. |
| `TimeSlotGrid.tsx` | Move time labels to negative left positioning so they sit in the margin, not overlapping cards. |
| `useDragResize.ts` | Only set `wasDraggedRef` to true on actual pointer movement, not on mousedown. Fixes single-click overlay opening. |
| `EntryCard.tsx` | Normalize all category badges to the compact Check-in size (`text-[10px] px-2 py-0.5`). |

### Sunrise/Sunset Gradient Implementation

```text
Gradient line (5px wide, full height of day):
  - Position: absolute, left of time labels
  - Colors computed from sunCalc:
    top (early hours) -> hsl(220, 50%, 20%) dark blue
    sunrise hour     -> hsl(30, 80%, 55%) warm orange  
    mid-morning      -> hsl(200, 60%, 70%) light blue
    midday           -> hsl(200, 70%, 75%) bright sky
    afternoon        -> hsl(200, 60%, 70%) light blue
    sunset hour      -> hsl(25, 80%, 50%) deep orange
    evening          -> hsl(220, 50%, 20%) dark blue
```

### Click Fix Logic

```text
Current flow:
  mousedown -> startDrag() -> wasDragged = true
  mouseup   -> commitDrag() -> setTimeout(150ms, wasDragged = false)
  click     -> if (!wasDragged) openOverlay  // BLOCKED because wasDragged is true

Fixed flow:
  mousedown -> startDrag() -> wasDragged = false (unchanged)
  mousemove -> if delta > 5px: wasDragged = true
  mouseup   -> commitDrag()
  click     -> if (!wasDragged) openOverlay  // WORKS for simple clicks
```

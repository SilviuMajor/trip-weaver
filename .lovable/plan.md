

# Sticky Day Headers, Gradient Alignment, and Short Card Titles

## Problem Summary

1. **Day headers don't replace each other** -- Each day header has `sticky top: 0`, but because each `CalendarDay` is its own container, the sticky headers don't push the previous day's header off screen. They stack or overlap instead.

2. **Gradient line and time labels misaligned between days** -- The sun gradient line is positioned at `left: -6` relative to the grid container, but the grid container itself has different left margins (`ml-14` vs `ml-20`) depending on whether the day has flights. This causes the gradient to jump position between days.

3. **Short cards (under 1 hour) clip titles** -- Cards under ~37 minutes get a compact layout (`isCompact` when height < 50px), but cards between 50px-80px (37-60 min) use the full layout which has too much padding and content to fit, causing overflow/clipping.

---

## Changes

### 1. Sticky Day Headers That Replace Each Other

**File: `src/components/timeline/CalendarDay.tsx`**

The day header currently uses `sticky` with `top: 0`. The issue is that sticky positioning works relative to the scroll container, and each day's content area is tall enough that the header stays pinned. However, because the headers all stick to `top: 0`, they overlap rather than pushing each other away.

The fix: The headers already work correctly as sticky elements -- the real issue is the `top` value. The `TimelineHeader` is fixed/sticky at the top, so day headers need to stick just below it. Currently `style={{ top: 0 }}` means they sit behind the main header or overlap each other.

The solution is to keep `top: 0` (which is correct for the scroll container) but ensure the scroll container itself starts below the TimelineHeader. Looking at the Timeline layout, the `<main>` tag at line 618 is the scroll container (`overflow-y-auto`). The day headers with `sticky top: 0` inside this scrollable container should naturally replace each other as you scroll -- each new day's header pushes the previous one up.

After reviewing more carefully: the sticky headers DO work within the scrollable `<main>`. The real fix needed is that the `top` value should account for any offset. Since the `<main>` is the scroll container and starts below the TimelineHeader, `top: 0` is correct. But if the headers aren't replacing each other, it's likely because the day containers don't have enough content height. With 24h x 80px/hr = 1920px per day, this should be fine.

The actual fix: ensure all day containers (even empty ones) produce enough height so the sticky header mechanics work. For empty days, the content is just a small "No plans yet" div, which means the header leaves the viewport quickly. We should give empty days a minimum height so the sticky header stays visible longer and transitions smoothly.

Additionally, we should make the `top` value consistent -- currently it's `0` via inline style. We'll keep it at 0 since the `<main>` scroll container is the reference.

### 2. Consistent Gradient Line Position

**File: `src/components/timeline/CalendarDay.tsx`**

Currently the grid container uses `ml-14` (no flights) or `ml-20` (with flights), which shifts everything including the gradient line. The gradient line is at `left: -6` relative to the grid.

Fix: Use a consistent left margin for ALL days (always `ml-20`), and adjust the time label/weather positioning for non-flight days to center within the wider gutter. This ensures the gradient line and grid are always at the same horizontal position.

### 3. Better Short Card Rendering

**File: `src/components/timeline/EntryCard.tsx`**

Currently:
- `isCompact` (< 50px / ~37 min): single-line layout with emoji + name + time -- works but very tight
- Normal layout (>= 50px): full card with category badge, title, time row, distance/votes -- too much for sub-hour

Add a **medium** layout for cards between 50px and 80px (37-60 min). This layout:
- Removes the category badge row (saves ~24px)
- Shows title and time on two tight lines
- Keeps the left border color indicator
- Reduces padding from `p-4` to `p-2`

Also improve the compact layout:
- Ensure the name has `min-w-0` and `flex-1` so it can truncate properly
- Make the time text slightly smaller to give more room to the title

**File: `src/components/timeline/CalendarDay.tsx`**

Update the compact threshold: 
- `isCompact` when height < 40px (very short)
- New `isMedium` when height >= 40px and < 80px (sub-hour)
- Pass both flags to EntryCard

---

## Technical Details

### CalendarDay.tsx changes:

1. **Line 243-246**: Keep sticky header with `top: 0` (correct for scroll container)
2. **Line 307-325**: Add `min-h-[200px]` to empty day containers so sticky headers transition smoothly
3. **Line 328**: Change from conditional `ml-20`/`ml-14` to always `ml-20` for consistent gutter width
4. **Line 433**: Update compact/medium logic:
   ```
   const isCompact = height < 40 && !flightGroup;
   const isMedium = height >= 40 && height < 80 && !flightGroup;
   ```
5. **Line 664**: Gradient line `left` stays at `-6` (now consistent since margin is always `ml-20`)
6. **Line 671**: Weather column positioning uses consistent gutter width

### EntryCard.tsx changes:

1. Add `isMedium` prop
2. Add medium layout between compact and full:
   - Two lines: title + time, reduced padding
   - No category badge, no distance/votes
   - Keep left border color accent
3. Adjust compact layout: ensure title gets `flex-1 min-w-0` for proper truncation

### Timeline.tsx changes:

None -- all changes are in the child components.




# Fix: Header Gap, Invisible Flight Dividers, and Misplaced + Buttons

## Root Cause Analysis

After thoroughly reviewing the full codebase, I found three distinct bugs:

### 1. Header Gap (Sticky Day Header)

The page structure is:
```text
<div>                                    (root, no overflow)
  <TimelineHeader sticky top-0 z-30 />  (sticks to viewport)
  <div className="flex overflow-hidden"> (layout wrapper)
    <main overflow-y-auto>               (SCROLL CONTAINER)
      <CalendarDay>
        <div sticky top={headerHeight}>  (day header)
```

The day headers are inside `<main>` which has `overflow-y-auto` -- making `<main>` the scroll container. Sticky elements inside `<main>` position relative to `<main>`'s viewport, which already starts directly below the TimelineHeader. So the correct `top` value is `0`, not `headerHeight`.

Setting `top: headerHeight` (53-69px) pushes the day header DOWN by the header's height, creating the visible gap.

**Fix**: Set `top: 0` on the day header sticky div. Remove the `headerHeight` prop entirely -- it's not needed.

### 2. Invisible Flight Card Dividers

The dividers use:
```text
style={{ backgroundColor: `${catColor}66` }}
```

But `catColor` is an HSL string like `hsl(260, 50%, 55%)`. Appending `66` to it produces `hsl(260, 50%, 55%)66` which is an invalid CSS color. The browser ignores it, so the dividers are invisible.

**Fix**: Use `hsla()` format or CSS `opacity` instead. Replace with a proper rgba/hsla approach, or use Tailwind's opacity utilities with an inline border approach.

### 3. Misplaced + Buttons

The + buttons use `className="absolute left-0"` but are positioned inside the grid container that has `ml-20` (or `ml-14`). With `left: 0` they render at the left edge of the grid, overlapping the time labels. They should be positioned further left (negative left) to sit in the gutter, or use a different positioning approach.

**Fix**: Change the + buttons to use `style={{ left: -14 }}` (for non-flight days) or `style={{ left: -20 }}` (for flight days) to position them in the gutter area between the time labels and the gradient line.

---

## Implementation

### File: `src/components/timeline/CalendarDay.tsx`

**Day header sticky offset (line 247)**:
- Change `style={{ top: headerHeight ?? 53 }}` to `style={{ top: 0 }}`
- Remove `headerHeight` from the props interface and destructuring

**+ button positioning (lines 369, 627, 657, 674)**:
- Change all `className="absolute left-0 z-[15] flex w-10 items-center justify-center"` instances to use `style={{ left: -14 }}` so buttons sit in the gutter, left of cards

### File: `src/components/timeline/FlightGroupCard.tsx`

**Divider colors (lines 118, 172)**:
- Replace `style={{ backgroundColor: catColor + '66' }}` with a proper approach
- Use: `style={{ backgroundColor: catColor, opacity: 0.4 }}` which works regardless of color format

### File: `src/pages/Timeline.tsx`

**Remove headerHeight logic**:
- Remove the `headerRef`, `headerHeight` state, and `ResizeObserver` effect (lines 79-92)
- Remove `ref={headerRef}` from TimelineHeader (line 537)
- Remove `headerHeight={headerHeight}` from CalendarDay (line 603)

### File: `src/components/timeline/TimelineHeader.tsx`

**Simplify**: Can remove `forwardRef` since the ref is no longer needed. Revert to a plain function component. (Optional -- keeping forwardRef is harmless.)

---

## Summary

| File | Change |
|------|--------|
| `CalendarDay.tsx` | Day header `top: 0`, remove `headerHeight` prop, fix + button left positioning |
| `FlightGroupCard.tsx` | Fix divider color to use `opacity: 0.4` instead of invalid hex suffix on HSL |
| `Timeline.tsx` | Remove ResizeObserver, headerRef, headerHeight state and prop passing |

These are three small, surgical fixes targeting the actual root causes rather than adding more complexity.

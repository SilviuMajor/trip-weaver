
# Midnight Day Marker Redesign + Sticky Floating Day Pill

## Part 1 -- Midnight Day Marker Redesign

**File: `src/components/timeline/ContinuousTimeline.tsx`**

Replace the current midnight day marker block (lines 500-544) with a cleaner layout:

**Current** (lines 507-543): A stacked block in the gutter showing day name, TZ abbreviation, and optional TODAY badge, positioned at `left: -80`. Plus a dashed midnight line for `dayIndex > 0`.

**New**: The `00:00` hour label continues to render normally from the hour lines loop (already works -- `globalHour % 24 === 0` produces "00:00"). The midnight marker becomes:

- A small pill/badge positioned to the **right** of the 00:00 label, inline with the hour line
- Pill content: `SUN 22 FEB . CET` (day name, date, dot separator, TZ abbreviation)
- Pill style: `rounded-full bg-secondary/80 px-2 py-0.5 text-[9px] font-semibold text-secondary-foreground` (warm beige/tan from the app palette)
- Positioned at `left: -12` (just right of the 00:00 label which ends around left: -16), `top: globalHour * 80 - 8`
- For `dayIndex === 0` (globalHour 0), append "Trip Begins" text or a small flag emoji inside the pill: `SUN 22 FEB . CET . Trip Begins`
- TODAY badge: If `isToday(day)`, add a small `bg-primary text-primary-foreground` "TODAY" tag beside or below the pill
- Keep the dashed midnight line for `dayIndex > 0` (unchanged)
- Add a `data-day-marker` attribute and `data-day-index` to each midnight marker div for the IntersectionObserver in Part 2

Remove the old stacked gutter block with `left: -80` and the `flex-col items-end` layout.

## Part 2 -- Sticky Floating Day Pill

**File: `src/components/timeline/ContinuousTimeline.tsx`**

Add scroll-tracking state and a sticky pill element:

1. **State**: `const [currentDayIndex, setCurrentDayIndex] = useState(0)`

2. **Scroll listener** (useEffect): Attach a scroll event listener to `scrollContainerRef.current`. On scroll:
   - Calculate approximate day: `Math.floor(scrollTop / (24 * PIXELS_PER_HOUR))` after accounting for `gridTopPx`
   - More precisely: `dayIndex = Math.max(0, Math.min(days.length - 1, Math.floor((scrollTop - gridTopPx + 60) / (24 * PIXELS_PER_HOUR))))`
   - The `+ 60` offset accounts for the sticky pill being ~60px from the top of the scroll area, so the day transitions as the midnight line passes behind the pill
   - `setCurrentDayIndex(clamped value)`

3. **Sticky pill element**: Rendered as a `position: sticky; top: 0` element at the top of the ContinuousTimeline's outer wrapper (above the grid):
   - Actually, since the scroll container is `<main>`, the sticky element should be inside the component but with `position: sticky; top: 0; z-index: 40`
   - Wrap the existing content in a container, and place the sticky pill as a sibling before the grid
   - Content: `SUN 22 FEB . CET` derived from `days[currentDayIndex]`
   - Style: `sticky top-0 z-40 flex items-center gap-1.5 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 px-3 py-1 text-xs font-semibold text-foreground shadow-sm`
   - Left-aligned: wrap in a div with `flex justify-start pl-1 py-1`
   - TZ derived from `dayTimezoneMap.get(format(days[currentDayIndex], 'yyyy-MM-dd'))`

4. **Smooth transition**: The pill text updates instantly when `currentDayIndex` changes (no animation needed -- the scroll tracking makes it feel natural).

## Detailed Code Changes

### `src/components/timeline/ContinuousTimeline.tsx`

**Add state** (near line 95):
```typescript
const [currentDayIndex, setCurrentDayIndex] = useState(0);
```

**Add scroll listener** (new useEffect, after the gridTopPx effect):
```typescript
useEffect(() => {
  const container = scrollContainerRef?.current;
  if (!container || days.length === 0) return;
  const handleScroll = () => {
    const scrollTop = container.scrollTop;
    const adjustedScroll = scrollTop - gridTopPx + 60;
    const dayIdx = Math.floor(adjustedScroll / (24 * PIXELS_PER_HOUR));
    const clamped = Math.max(0, Math.min(days.length - 1, dayIdx));
    setCurrentDayIndex(clamped);
  };
  container.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll(); // initial
  return () => container.removeEventListener('scroll', handleScroll);
}, [scrollContainerRef, gridTopPx, days.length]);
```

**Add sticky pill** (inside the return, before the grid div, around line 444):
```tsx
{/* Sticky floating day pill */}
<div className="sticky top-0 z-40 flex justify-start pl-1 py-1">
  <div className="inline-flex items-center gap-1 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
    <span>{isUndated ? `Day ${currentDayIndex + 1}` : format(days[currentDayIndex], 'EEE d MMM').toUpperCase()}</span>
    <span className="text-muted-foreground/60">.</span>
    <span className="text-muted-foreground">{tzAbbrev}</span>
    {!isUndated && isToday(days[currentDayIndex]) && (
      <span className="ml-1 rounded-full bg-primary px-1.5 py-0 text-[8px] font-semibold text-primary-foreground">TODAY</span>
    )}
  </div>
</div>
```

Where `tzAbbrev` is computed from the current day's timezone info (a small helper or inline).

**Replace midnight markers** (lines 500-544): New version renders a pill beside the hour line instead of a stacked gutter label.

## What Does NOT Change

- Hour line rendering (00:00 still shows in gutter)
- Card positioning, drag/drop, SNAP
- Transport connectors, weather gutter, sunrise/sunset gradient
- TZ change badges at flight boundaries
- "Trip Begins" / "Trip Ends" full-width banners (keep or integrate "Trip Begins" into the first midnight pill)
- All other timeline functionality

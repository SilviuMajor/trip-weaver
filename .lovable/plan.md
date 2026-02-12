

# Fix Day Pill: Position to 110px + Fix Day Update + Bigger Text

## Root Cause of Day Not Updating

The `gridTopPx` measurement effect (line 101) depends on `scrollContainerRef?.current` being available, but refs don't trigger re-renders when `.current` changes. If the effect runs before the `<main>` element mounts, `scrollContainerRef?.current` is null, the effect bails out, and `gridTopPx` stays at 0 forever. Then the scroll handler guard (`if (gridTopPx <= 0) return`) blocks all day calculations.

**Fix**: Remove the `gridTopPx` guard approach entirely. Instead, measure the grid position directly inside the scroll handler itself (it's a cheap DOM read). This guarantees correct measurement every time, regardless of mount timing.

## Changes

### 1. `src/pages/Timeline.tsx` -- Top 130px to 110px + bigger text

- Change `style={{ top: '130px' }}` to `style={{ top: '110px' }}`
- Increase pill text size from `text-xs` to `text-sm` and padding from `px-3 py-1` to `px-4 py-1.5`
- Increase TODAY badge from `text-[8px]` to `text-[10px]`

### 2. `src/components/timeline/ContinuousTimeline.tsx` -- Fix scroll calculation

Replace the two separate effects (gridTopPx measurement + scroll listener) with a single scroll listener that measures the grid position inline:

```typescript
// Remove the gridTopPx state and its measurement effect entirely.
// Replace the scroll listener effect with:

useEffect(() => {
  const container = scrollContainerRef?.current;
  const grid = gridRef.current;
  if (!container || !grid || days.length === 0) return;

  const handleScroll = () => {
    const containerRect = container.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    const gridTop = gridRect.top - containerRect.top + container.scrollTop;
    const centreScroll = container.scrollTop + container.clientHeight / 2;
    const adjustedScroll = centreScroll - gridTop;
    const dayIdx = Math.floor(adjustedScroll / (24 * PIXELS_PER_HOUR));
    const clamped = Math.max(0, Math.min(days.length - 1, dayIdx));
    setCurrentDayIndex(clamped);
    onCurrentDayChange?.(clamped);
  };

  container.addEventListener('scroll', handleScroll, { passive: true });
  // Run once after a short delay to ensure layout is settled
  const timer = setTimeout(handleScroll, 150);
  return () => {
    container.removeEventListener('scroll', handleScroll);
    clearTimeout(timer);
  };
}, [scrollContainerRef?.current, days.length, onCurrentDayChange]);
```

This eliminates the timing dependency on `gridTopPx` state. The grid position is measured fresh on every scroll event (getBoundingClientRect is fast), so it always works regardless of mount order.

### What does NOT change
- Inline midnight pills, timeline content, cards, drag/drop
- Tab bar, header, navigation
- Timezone logic (same midnight-TZ resolution)


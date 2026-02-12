

# Fix Day Pill: Top Position + Day Update

## Changes

### 1. `src/pages/Timeline.tsx` — Change top from 98px to 130px

Line 1517: Change `style={{ top: '98px' }}` to `style={{ top: '130px' }}`.

### 2. `src/components/timeline/ContinuousTimeline.tsx` — Fix scroll calculation reliability

The scroll handler logic looks correct but may not be firing reliably due to a timing issue: `gridTopPx` starts at 0 and is set after a 100ms timeout (line 110). If the scroll listener attaches before `gridTopPx` is computed, the initial `handleScroll()` call at line 129 uses `gridTopPx = 0`, producing an incorrect day index. When `gridTopPx` later updates, the effect re-runs and re-attaches, but only recalculates on the next scroll event -- not immediately if the user hasn't scrolled.

**Fix**: Add a guard so the scroll handler only calculates when `gridTopPx > 0` (the grid is never at position 0 since there's content above it). Also re-run the initial calculation whenever `gridTopPx` changes.

Updated scroll handler (lines 118-131):

```typescript
const handleScroll = () => {
  if (gridTopPx <= 0) return; // Grid position not yet measured
  const scrollTop = container.scrollTop;
  const viewportHeight = container.clientHeight;
  const centreScroll = scrollTop + viewportHeight / 2;
  const adjustedScroll = centreScroll - gridTopPx;
  const dayIdx = Math.floor(adjustedScroll / (24 * PIXELS_PER_HOUR));
  const clamped = Math.max(0, Math.min(days.length - 1, dayIdx));
  setCurrentDayIndex(clamped);
  onCurrentDayChange?.(clamped);
};
container.addEventListener('scroll', handleScroll, { passive: true });
handleScroll(); // Initial calculation
return () => container.removeEventListener('scroll', handleScroll);
```

This ensures:
- No calculation happens with an unmeasured grid position
- When `gridTopPx` updates from 0 to the real value, the useEffect re-runs and calls `handleScroll()` immediately with the correct offset
- The day pill in Timeline.tsx updates via `onCurrentDayChange(clamped)` -> `setCurrentDayIndex`

### What does NOT change
- Inline midnight pills, timeline content, cards, drag/drop
- Tab bar, header, navigation
- Timezone logic (same midnight-TZ resolution)


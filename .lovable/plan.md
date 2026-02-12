

# Fixed Position Day Pill

## Problem
The current day pill uses flow-based positioning between the tab bar and scroll container, but it still scrolls with content. The user wants a truly `position: fixed` element pinned to the screen.

## Approach
Replace the current day pill with a `position: fixed` element. Update the scroll calculation to use viewport-centre logic.

## Changes

### 1. `src/pages/Timeline.tsx`

**Replace the day pill block** (lines 1501-1526):

Remove the current `<div className="flex justify-center py-1 ...">` pill that sits in document flow.

Replace with a `position: fixed` element:

```tsx
{days.length > 0 && (() => {
  const dayDate = days[currentDayIndex];
  const dayStr = format(dayDate, 'yyyy-MM-dd');
  const tzInfo = dayTimezoneMap.get(dayStr);
  let tzAbbrev = '';
  if (tzInfo) {
    const tz = tzInfo.flights.length > 0 ? tzInfo.flights[0].originTz : tzInfo.activeTz;
    try {
      tzAbbrev = new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'short' })
        .formatToParts(dayDate).find(p => p.type === 'timeZoneName')?.value || '';
    } catch { /* ignore */ }
  }
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50"
      style={{ top: '98px' }}
    >
      <div className="inline-flex items-center gap-1 rounded-full bg-background/95 backdrop-blur-md border border-border/50 px-3 py-1 text-xs font-semibold text-foreground shadow-md">
        <span>{isUndated ? `Day ${currentDayIndex + 1}` : format(dayDate, 'EEE d MMM').toUpperCase()}</span>
        <span className="text-muted-foreground/60">·</span>
        <span className="text-muted-foreground">{tzAbbrev}</span>
        {!isUndated && isToday(dayDate) && (
          <span className="ml-1 rounded-full bg-primary px-1.5 py-0 text-[8px] font-semibold text-primary-foreground">TODAY</span>
        )}
      </div>
    </div>
  );
})()}
```

Key properties:
- `fixed left-1/2 -translate-x-1/2` centres it horizontally on screen
- `top: 98px` positions it just below the header (57px) + tab bar (~41px)
- `z-50` keeps it above timeline content but below modals/sheets
- No longer in document flow, so no impact on the scroll container layout

### 2. `src/components/timeline/ContinuousTimeline.tsx`

**Update scroll calculation** (lines 118-124) to use viewport centre:

```typescript
const handleScroll = () => {
  const scrollTop = container.scrollTop;
  const viewportHeight = container.clientHeight;
  const centreScroll = scrollTop + viewportHeight / 2;
  const adjustedScroll = centreScroll - gridTopPx;
  const dayIdx = Math.floor(adjustedScroll / (24 * PIXELS_PER_HOUR));
  const clamped = Math.max(0, Math.min(days.length - 1, dayIdx));
  setCurrentDayIndex(clamped);
  onCurrentDayChange?.(clamped);
};
```

This calculates the day at the vertical centre of the visible viewport, giving a more intuitive "current day" feel.

### 3. What does NOT change
- Inline midnight pills within the timeline (kept with correct TZ)
- Timeline content, cards, drag/drop, SNAP
- Tab bar, header, navigation
- Transport connectors, weather gutter
- The `onCurrentDayChange` callback pattern (stays the same)




# Fix Day Pill Timezone + Sticky Positioning

## Fix 1 — Timezone on day pills uses wrong TZ

**Root cause**: `getTzAbbrev(dayDate)` at line 129 uses `tzInfo.activeTz`, which on flight days resolves to the **destination** timezone. But midnight (00:00) of a flight day is still in the **origin** timezone -- the flight hasn't departed yet.

**File**: `src/components/timeline/ContinuousTimeline.tsx`

**Change**: Create a new helper `getMidnightTzAbbrev(dayDate)` that resolves the timezone at midnight for each day:

- Look up `dayTimezoneMap` for the day's date string
- If the day has flights (`tzInfo.flights.length > 0`), use `flights[0].originTz` -- this is the timezone at midnight before any flight departs
- If no flights, use `tzInfo.activeTz` as normal
- Convert the resolved IANA timezone to an abbreviation using `Intl.DateTimeFormat`

Apply this helper to:
- The inline midnight day pills (line 542, replacing `getTzAbbrev(day)`)
- The sticky pill's TZ abbreviation (line 471, replacing `getTzAbbrev(days[currentDayIndex])`)

This ensures:
- Day 1 (flight departs London): pill shows "GMT" (origin TZ at midnight)
- Day 2 (already in Amsterdam): pill shows "CET" (activeTz, no flights that day, or originTz of any Day 2 flight)

## Fix 2 — Sticky pill must be fixed at top, horizontally centred

**Root cause**: The sticky pill at line 476 uses `sticky top-0` but it scrolls away because the outer wrapper scrolls. The pill also needs to be centred, not left-aligned.

**Changes** (same file):

1. **Centre the pill**: Change the sticky pill wrapper from `flex justify-start pl-1` to `flex justify-center`. This centres the pill horizontally in the timeline area.

2. **Ensure sticky works**: The pill's parent `<div className="mx-auto max-w-2xl px-4 py-2">` is inside the scroll container (`<main>`). `position: sticky; top: 0` should work here as long as there's no `overflow: hidden` on an ancestor between the sticky element and the scroll container. The sticky div needs to be a direct child of a container that doesn't clip overflow.

   Move the sticky pill **outside** the `max-w-2xl` wrapper so it's a sibling, not a child. Wrap the entire return in a fragment: the sticky pill as the first element (full-width, centred content), then the existing `max-w-2xl` content below.

3. **Improve readability**: Add slightly stronger background and shadow to the pill so it's clearly visible over scrolling content. Use `bg-background/90 backdrop-blur-md shadow-md` instead of `bg-background/80 backdrop-blur-sm shadow-sm`.

4. **Z-index**: Keep `z-40` -- above cards (`z-10`-`z-20`) and weather, below modals/sheets (`z-50`).

## Detailed code changes

### `src/components/timeline/ContinuousTimeline.tsx`

**Add `getMidnightTzAbbrev` helper** (replace or supplement `getTzAbbrev`, around line 128):
```typescript
const getMidnightTzAbbrev = useCallback((dayDate: Date): string => {
  const dayStr = format(dayDate, 'yyyy-MM-dd');
  const tzInfo = dayTimezoneMap.get(dayStr);
  if (!tzInfo) return '';
  // At midnight, use the origin TZ (before any flight departs that day)
  const tz = tzInfo.flights.length > 0 ? tzInfo.flights[0].originTz : tzInfo.activeTz;
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(dayDate).find(p => p.type === 'timeZoneName')?.value || '';
  } catch { return ''; }
}, [dayTimezoneMap]);
```

**Update inline midnight pills** (line 542): Change `getTzAbbrev(day)` to `getMidnightTzAbbrev(day)`

**Update sticky pill TZ** (line 471): Change `getTzAbbrev(days[currentDayIndex])` to `getMidnightTzAbbrev(days[currentDayIndex])`

**Restructure return** (lines 473-485): Move sticky pill outside the `max-w-2xl` wrapper and centre it:
```tsx
return (
  <>
    {/* Sticky floating day pill - outside max-w-2xl for proper sticky */}
    <div className="sticky top-0 z-40 flex justify-center py-1">
      <div className="inline-flex items-center gap-1 rounded-full bg-background/90 backdrop-blur-md border border-border/50 px-3 py-1 text-xs font-semibold text-foreground shadow-md">
        <span>{isUndated ? `Day ${currentDayIndex + 1}` : format(days[currentDayIndex], 'EEE d MMM').toUpperCase()}</span>
        <span className="text-muted-foreground/60">·</span>
        <span className="text-muted-foreground">{stickyTzAbbrev}</span>
        {!isUndated && days[currentDayIndex] && isToday(days[currentDayIndex]) && (
          <span className="ml-1 rounded-full bg-primary px-1.5 py-0 text-[8px] font-semibold text-primary-foreground">TODAY</span>
        )}
      </div>
    </div>

    <div className="mx-auto max-w-2xl px-4 py-2">
      {/* ... rest of grid content unchanged ... */}
    </div>
  </>
);
```

## What does NOT change
- Inline midnight pill content and positioning (just TZ text fix)
- Hour line rendering, card positioning, drag/drop, SNAP
- Transport connectors, weather gutter, sunrise/sunset gradient
- Any other timeline functionality

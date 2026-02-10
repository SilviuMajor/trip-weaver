
# Fix: Timeline Alignment, Cross-Day Consistency, and Dynamic Header

## Problems Identified

### 1. Layout vs Visual Position Mismatch (Within a Day)
`CalendarDay.tsx` line 180-182 computes overlap layout using `tripTimezone` for ALL entries. But visual positioning (lines 391-411) uses per-entry resolved timezones (departure_tz, arrival_tz, or destination TZ for post-flight entries). The overlap engine places cards at one position; the visual renderer places them at another.

**Fix**: Use the same per-entry TZ resolution in `layoutEntries` as in the visual positioning block. Extract a shared helper `resolveEntryTz(entry, dayFlights, activeTz, tripTimezone)` and call it in both places.

### 2. Cross-Day Alignment (Days Don't Line Up)
Entries are bucketed into days on line 230 and 346 of `Timeline.tsx` using `getDateInTimezone(entry.start_time, tripTimezone)`. But after a timezone-changing flight, the active TZ for rendering is the destination TZ. If the trip timezone is GMT but the destination is CET (+1), an entry at 23:30 GMT would show at 00:30 CET on the grid -- but it's bucketed into the GMT day, not the next CET day.

**Fix**: In `getEntriesForDay` and the `dayTimezoneMap` builder, bucket entries using the **active timezone for that day** (from `dayTimezoneMap`) rather than always using `tripTimezone`. This requires a two-pass approach:
1. First pass: build the timezone map from flights (already done)
2. Second pass: bucket entries using each day's `activeTz`

For non-flight entries after a TZ change, use the destination TZ to determine which calendar day they fall on.

### 3. Header Stickiness Gap
The `TimelineHeader` is approximately 65-70px tall (varies with content), but the day bar uses `sticky top-[49px]`. 

**Fix**: 
- Add a `ref` to `TimelineHeader`'s root element (use `React.forwardRef`)
- In `Timeline.tsx`, measure the header height with `useEffect` + `getBoundingClientRect()`
- Pass `headerHeight` as a prop to `CalendarDay`
- Replace `top-[49px]` with `style={{ top: headerHeight }}`

### 4. Timezone Scope (Only Flights)
Already the case in the data model -- only flight `entry_options` have `departure_tz` and `arrival_tz`. No changes needed to the form. The fix is ensuring all computation respects this: non-flight entries inherit timezone from their position relative to flights.

## Implementation Details

### New Helper: `resolveEntryTz`
In `CalendarDay.tsx`, extract a function used by both layout and rendering:

```text
function resolveEntryTz(
  entry: EntryWithOptions,
  dayFlights: FlightTzInfo[],
  activeTz: string | undefined,
  tripTimezone: string
): { startTz: string; endTz: string } {
  const opt = entry.options[0];
  if (opt?.category === 'flight' && opt.departure_tz && opt.arrival_tz) {
    return { startTz: opt.departure_tz, endTz: opt.arrival_tz };
  }
  let tz = activeTz || tripTimezone;
  if (dayFlights.length > 0 && dayFlights[0].flightEndUtc) {
    const entryMs = new Date(entry.start_time).getTime();
    const flightEndMs = new Date(dayFlights[0].flightEndUtc).getTime();
    tz = entryMs >= flightEndMs ? dayFlights[0].destinationTz : dayFlights[0].originTz;
  }
  return { startTz: tz, endTz: tz };
}
```

### CalendarDay.tsx -- Fix layoutEntries (line 180-185)
Replace:
```text
const s = (getHourInTimezone(e.start_time, tripTimezone) - startHour) * 60;
let en = (getHourInTimezone(e.end_time, tripTimezone) - startHour) * 60;
```
With:
```text
const { startTz, endTz } = resolveEntryTz(e, dayFlights, activeTz, tripTimezone);
const s = (getHourInTimezone(e.start_time, startTz) - startHour) * 60;
let en = (getHourInTimezone(e.end_time, endTz) - startHour) * 60;
```

### Timeline.tsx -- Fix Entry Bucketing (line 343-348)
Change `getEntriesForDay` to use the day's active timezone:
```text
const getEntriesForDay = (day: Date): EntryWithOptions[] => {
  const dayStr = format(day, 'yyyy-MM-dd');
  const tzInfo = dayTimezoneMap.get(dayStr);
  const tz = tzInfo?.activeTz || tripTimezone;
  return scheduledEntries.filter(entry => {
    const entryDay = getDateInTimezone(entry.start_time, tz);
    return entryDay === dayStr;
  });
};
```

Also fix the same in `dayTimezoneMap` builder (line 230) -- use a progressive TZ for bucketing:
```text
// After computing currentTz for the day, use it to bucket entries
const dayEntries = scheduledEntries
  .filter(entry => {
    const entryDay = getDateInTimezone(entry.start_time, currentTz);
    return entryDay === dayStr;
  })
```

### Timeline.tsx + TimelineHeader.tsx -- Dynamic Header Height
**TimelineHeader.tsx**: Convert to `forwardRef`:
```text
const TimelineHeader = React.forwardRef<HTMLElement, TimelineHeaderProps>(
  ({ trip, tripId, ... }, ref) => {
    return (
      <header ref={ref} className="sticky top-0 z-30 ...">
        ...
      </header>
    );
  }
);
```

**Timeline.tsx**: Add measurement:
```text
const headerRef = useRef<HTMLElement>(null);
const [headerHeight, setHeaderHeight] = useState(53);

useEffect(() => {
  if (!headerRef.current) return;
  const ro = new ResizeObserver(([entry]) => {
    setHeaderHeight(entry.contentRect.height + /* border */ 1);
  });
  ro.observe(headerRef.current);
  return () => ro.disconnect();
}, []);

// Pass to TimelineHeader:
<TimelineHeader ref={headerRef} ... />

// Pass to CalendarDay:
<CalendarDay headerHeight={headerHeight} ... />
```

**CalendarDay.tsx**: Accept `headerHeight` prop, replace `top-[49px]` with:
```text
style={{ top: headerHeight }}
```

## Files Summary

| File | Changes |
|------|---------|
| `CalendarDay.tsx` | Add `resolveEntryTz` helper, fix `layoutEntries` to use it, fix visual positioning to use it, accept `headerHeight` prop, replace hardcoded sticky offset |
| `Timeline.tsx` | Fix `getEntriesForDay` to use per-day active TZ, fix `dayTimezoneMap` entry bucketing, add header measurement via ResizeObserver, pass `headerHeight` to CalendarDay |
| `TimelineHeader.tsx` | Convert to `forwardRef` to expose root element ref |

## Implementation Order

1. Extract `resolveEntryTz` helper and fix layout computation in CalendarDay
2. Fix entry bucketing in Timeline.tsx to use active TZ per day
3. Dynamic header height (forwardRef + ResizeObserver + prop)

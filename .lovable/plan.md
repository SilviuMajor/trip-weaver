

# Fix Build Errors — Complete ContinuousTimeline Wiring

## Problem

The previous step created `ContinuousTimeline.tsx` and updated `useDragResize.ts`, but left `CalendarDay.tsx` and `Timeline.tsx` partially updated, causing 15 build errors.

## Changes

### 1. `src/components/timeline/CalendarDay.tsx` — Fix compilation (kept but unused)

CalendarDay is no longer rendered but still in the codebase. Update it to compile against the new `useDragResize` API:

- **Line 197**: Remove `dayBoundaries` from the `useDragResize()` call, add `totalHours: 24` and `gridTopPx: 0` instead
- **All `onMouseDown`/`onTouchStart` calls** (lines 740-741, 802-803, 814-815, 897, 903, 935-936): Remove the 7th argument (`dayDate`) — the new hook signature only accepts 5-6 args: `(e, entryId, type, startHour, endHour, tz?)`

### 2. `src/pages/Timeline.tsx` — Remove legacy day-boundary code, wire ContinuousTimeline

- **Lines 1421-1459**: Delete the `dayBoundaries` state, the `useEffect` that computes boundaries, `dayRefsMap`, and `setDayRef` callback — all no longer needed
- **Lines 1557-1599**: Replace the `days.map(CalendarDay)` block with a single `<ContinuousTimeline>` component, passing all required props (days, entries, weatherData, callbacks, dayTimezoneMap, dayLocationMap, etc.)
- **Line 1588**: The `onDropFromPanel` prop passes `(entryId, globalHour)` directly to `handleDropOnTimeline` (2 args, matching the updated signature)

### Summary

| File | Fix |
|---|---|
| `CalendarDay.tsx` | Remove `dayBoundaries` prop, remove 7th arg from drag handlers, add `totalHours`/`gridTopPx` |
| `Timeline.tsx` | Delete `dayBoundaries`/`dayRefsMap`/`setDayRef` code blocks, replace CalendarDay loop with ContinuousTimeline |

All 15 build errors are resolved by these two sets of changes. No new functionality — just completing the wiring that was started in the previous step.

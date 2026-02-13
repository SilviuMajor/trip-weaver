
# Trip Ends Pill Position + Top Padding

## Fix 1: Move "Trip Ends" pill to the END of the last day

Currently the "Trip Ends" marker is rendered inside the `days.map()` loop at the last day's midnight position (`dayIndex * 24 * PIXELS_PER_HOUR`). It needs to be at `(dayIndex + 1) * 24 * PIXELS_PER_HOUR` -- the bottom of the last day.

**Approach**: Extract the "Trip Ends" marker out of the `days.map()` loop entirely and render it as a standalone element after the loop, positioned at `days.length * 24 * PIXELS_PER_HOUR`.

In `src/components/timeline/ContinuousTimeline.tsx`:

1. Remove the `dayIndex === days.length - 1` block (lines 572-589) from inside the `days.map()` loop.

2. After the `days.map()` closing (line 604), add a new standalone "Trip Ends" pill:

```tsx
{/* Trip Ends marker — positioned at end of last day */}
{days.length > 0 && (
  <div
    className="absolute z-[16] flex items-center gap-1"
    style={{ top: days.length * 24 * PIXELS_PER_HOUR - 8, left: -12 }}
  >
    <div className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border/40 px-3 py-1 text-xs font-semibold text-secondary-foreground shadow-sm">
      <span>🏁 Trip Ends</span>
      {(() => {
        const lastDay = days[days.length - 1];
        const dayStr = format(lastDay, 'yyyy-MM-dd');
        const isEmpty = !scheduledEntries.some(e => getDateInTimezone(e.start_time, homeTimezone) === dayStr);
        return isEmpty && days.length > 1 ? (
          <button
            onClick={(e) => { e.stopPropagation(); onTrimDay?.('end'); }}
            className="ml-1 text-[10px] text-muted-foreground/70 hover:text-destructive underline"
          >
            ✂ Trim
          </button>
        ) : null;
      })()}
    </div>
  </div>
)}
```

3. Extend the container height to accommodate the Trip Ends pill below the last day. Change `containerHeight` from `totalHours * PIXELS_PER_HOUR` to `totalHours * PIXELS_PER_HOUR + 30` (enough space for the pill to not be clipped).

For a 1-day trip: "Trip Begins" appears at the top (hour 0), "Trip Ends" appears at the bottom (hour 24) -- properly separated.

## Fix 2: Add ~50px top padding

Add `paddingTop: 50` to the outer container div (line 477, the `mx-auto max-w-2xl px-4 py-2` div), or more precisely to the grid-relative container. The simplest approach: change `py-2` to include top padding.

Change line 477:
```tsx
<div className="mx-auto max-w-2xl px-4 pb-2 pt-[50px]">
```

This gives breathing room above the first hour label and Trip Begins pill.

## Files Modified

| File | Change |
|------|--------|
| `src/components/timeline/ContinuousTimeline.tsx` | Extract Trip Ends pill out of loop, position at end of last day; add 50px top padding; extend container height by 30px |

## What Does NOT Change
- Trip Begins position and logic
- Trim button logic (preserved, just moved)
- Auto-extend logic
- All other timeline rendering

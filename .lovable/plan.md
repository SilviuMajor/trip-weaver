

# TZ-Aware Time Pills During Drag/Resize

## Problem
Hour labels in the gutter correctly shift after a flight (e.g., "10, 11, 13, 14..." for +1hr TZ change). But the drag/resize time pills use raw `gh % 24` with no timezone awareness, showing times 1 hour out of sync with the gutter labels.

## Changes (single file: `src/components/timeline/ContinuousTimeline.tsx`)

### 1. Add shared helper function (before the return statement, around line 645)
A `formatGlobalHourToDisplay` callback that converts a global hour float to a TZ-aware time string. It reuses the exact same logic as the hour label rendering: check if the hour falls after a flight on that day, and if so, apply the UTC offset difference.

### 2. Replace move drag time pills (lines 1617-1621)
Delete the inline `formatGH` function and replace `formatGH(startGH)` / `formatGH(endGH)` with `formatGlobalHourToDisplay(startGH)` / `formatGlobalHourToDisplay(endGH)`.

### 3. Replace resize time pill (lines 1641-1643)
Replace the inline `h`/`m`/`timeStr` calculation with a single call to `formatGlobalHourToDisplay(activeGH)`.

### 4. Simplify hour label rendering (lines 697-705)
Replace the inline TZ offset logic with `formatGlobalHourToDisplay(globalHour)`, consolidating the duplicated logic into the shared helper.

### What does not change
Positioning, visibility logic, hide-for-pill logic, drag behavior, flight markers -- all untouched. Only the displayed time strings become TZ-aware.

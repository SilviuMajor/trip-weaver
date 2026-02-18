

# Fix Transport Position Bug (Bug 3)

## Context
Bugs 1 and 2 (timezone offset) are already fixed from the previous approved plan. Only Bug 3 remains: gap buttons between entries pass the flight's `end_time` instead of the checkout's `end_time` when creating transport or adding entries after a flight group.

## Problem
When clicking gap buttons below a flight group, `entry.end_time` (the flight landing time, e.g. 10:50) is used as the prefill/start time instead of the checkout's `end_time` (e.g. 11:20). This causes transport entries to overlap the checkout section.

## Changes

### `src/components/timeline/ContinuousTimeline.tsx`

In the gap buttons section (lines 1232-1279), compute an `effectiveEndTime` using `flightGroupMap` and replace all `entry.end_time` references with it.

**Add before the gap button JSX (after line 1229):**
```typescript
const effectiveEndTime = aGroup?.checkout?.end_time ?? entry.end_time;
```

**Three replacements inside the gap button JSX:**

1. **Line 1241** (large gap, top "Add something" button):
   - Replace `entry.end_time` with `effectiveEndTime` in the `addMinutes(new Date(entry.end_time), 60)` call

2. **Line 1269** (normal gap, single "Add something" button):
   - Replace `entry.end_time` with `effectiveEndTime` in `onAddBetween(entry.end_time, ...)`

Line 1254 (large gap, bottom button) uses `nextEntry.start_time` which is correct and needs no change.

## Files Modified
- `src/components/timeline/ContinuousTimeline.tsx` — 3 lines changed (add effectiveEndTime variable, update 2 gap button calls)

## What Is NOT Changed
- Timeline.tsx handlers (`handleAddBetween`, `handleGenerateTransportDirect`) — these have their own checkout lookups as a safety net
- Connector `onAddAtArrival` (line 1334) — this uses the transport entry's own end_time which is correct
- Magnet snap handling — already uses effectiveEndTime pattern

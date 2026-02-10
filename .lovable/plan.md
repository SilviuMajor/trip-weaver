

# Fix: Flight Input, Header Gap, and Lock/Unlock Time Shift

## Issue 1: Can't input a flight on Monday Feb 23rd

**Root cause**: The trip runs Feb 21-23, so Feb 23rd is the last day. The EntryForm date input has no restrictions, but when pre-filling from a "+" button click, the `prefillStartTime` is passed as an ISO string. In `EntryForm` (line 147), the prefill sets `startTime` via `format(dt, 'HH:mm')` -- but it never sets the `date` field. Since `date` starts as `''`, clicking "Create Entry" triggers the validation "Please select a date" on line 399.

**Fix**: When `prefillStartTime` is provided for a dated trip, also pre-fill the `date` field from it.

## Issue 2: Header sticky gap

**Root cause**: The day header in `CalendarDay.tsx` line 215 uses `sticky top-[57px]`, assuming the `TimelineHeader` is exactly 57px tall. But the header contains a greeting line ("Hey, {name}") which makes it taller. The hardcoded `57px` doesn't match the actual header height, creating a visible gap between the main header and the day bar.

**Fix**: Change `top-[57px]` to a value that matches the actual header height. The header has `py-3` (12px top + 12px bottom = 24px) plus content (title ~28px line-height + greeting ~16px) plus 1px border = roughly 69px. A cleaner approach: use a CSS variable or measure the header, but the simplest fix is to adjust to the correct pixel value. Based on the header structure (py-3 = 24px padding, ~24px content height with two lines, 1px border), the correct value is approximately `top-[53px]` (the header with single-line name + small greeting). We should verify and adjust. Alternatively, we can remove the gap by setting `top-[49px]` which accounts for py-3 (24px total) + single line content (~24px) + border (1px).

Actually the cleanest fix: make the header height consistent by measuring. The header `py-3` = 12+12 = 24px. The content inside is a flex row. The trip name is `text-lg leading-tight` (~24px) and the greeting is `text-xs` (~16px). Total inner = ~40px + 24px padding = ~64px + 1px border = ~65px. But this varies. The safest approach is to remove the hardcoded value and use `top-0` on the day header while nesting it inside a container that accounts for the main header via scroll margin or making both part of the same sticky context.

**Simplest reliable fix**: Set the TimelineHeader to a fixed height and match `top-[Xpx]` exactly, or better: wrap both in a way that the day header stacks below the main header using a shared sticky parent.

## Issue 3: Lock/unlock adds 1 hour to arrival time

**Root cause**: This is the critical bug. When you click on a flight card (even without dragging), the mousedown handler fires `startDrag`, and on mouseup `commitDrag` fires `onCommit` which calls `handleDragCommit`. 

In `handleDragCommit` (CalendarDay line 113-130), it converts BOTH start and end hours back to UTC using a single `commitTz`. But for flights:
- `origStartHour` was computed using `departure_tz` 
- `origEndHour` was computed using `arrival_tz`

Yet `commitTz` = `dragTz` = `departure_tz`. So the arrival time (which was read in arrival_tz) gets written back using departure_tz. If there's a 1-hour difference between the two timezones, every click shifts the arrival by 1 hour.

The lock toggle button is inside the card, so clicking it triggers the card's mousedown -> mouseup cycle, committing a "drag" with corrupted arrival time.

**Fix**: For flight entries, `handleDragCommit` must convert start_time using departure_tz and end_time using arrival_tz separately, rather than using a single timezone for both.

## Implementation Plan

### File: `src/components/timeline/CalendarDay.tsx`

**Fix drag commit for flights (Issue 3)**:
- Modify `handleDragCommit` to detect if the entry is a flight (has departure_tz and arrival_tz)
- If flight: convert `newStartHour` with `departure_tz` and `newEndHour` with `arrival_tz`
- If not flight: use single `commitTz` as currently
- Additionally: skip the commit entirely if `wasDraggedRef.current` is false (no actual movement occurred). This prevents "phantom" drag commits from simple clicks on lock buttons, card taps, etc.

**Fix header gap (Issue 2)**:
- Change `sticky top-[57px]` to `sticky top-[53px]` initially, and add an approach that's more robust: use a ref on the main header to measure its height dynamically.

### File: `src/components/timeline/EntryForm.tsx`

**Fix flight input date pre-fill (Issue 1)**:
- In the `prefillStartTime` useEffect (lines 144-149), also set `date` from the prefilled time when the trip is dated.

### File: `src/hooks/useDragResize.ts`

**Prevent phantom commits (Issue 3 defense-in-depth)**:
- In `commitDrag`, only call `onCommit` if `wasDraggedRef.current` is true (actual movement occurred). If no movement, just clean up drag state without committing.

### File: `src/pages/Timeline.tsx`

**No changes needed** - the header height fix will be in CalendarDay's sticky offset.

## Technical Details

### CalendarDay.tsx - handleDragCommit flight-aware conversion

```text
Current (broken):
  const commitTz = tz || activeTz || tripTimezone;
  const newStartIso = localToUTC(dateStr, toTimeStr(newStartHour), commitTz);
  const newEndIso = localToUTC(dateStr, toTimeStr(newEndHour), commitTz);

Fixed:
  const entry = sortedEntries.find(e => e.id === entryId);
  const primaryOpt = entry?.options[0];
  const isFlight = primaryOpt?.category === 'flight' && primaryOpt?.departure_tz && primaryOpt?.arrival_tz;

  const startTz = isFlight ? primaryOpt.departure_tz! : (tz || activeTz || tripTimezone);
  const endTz = isFlight ? primaryOpt.arrival_tz! : startTz;
  
  const newStartIso = localToUTC(dateStr, toTimeStr(newStartHour), startTz);
  const newEndIso = localToUTC(dateStr, toTimeStr(newEndHour), endTz);
```

### useDragResize.ts - Skip phantom commits

```text
Current:
  const commitDrag = useCallback(() => {
    const state = dragStateRef.current;
    if (state) {
      onCommit(state.entryId, state.currentStartHour, state.currentEndHour, state.tz);
    }
    ...

Fixed:
  const commitDrag = useCallback(() => {
    const state = dragStateRef.current;
    if (state && wasDraggedRef.current) {
      onCommit(state.entryId, state.currentStartHour, state.currentEndHour, state.tz);
    }
    ...
```

This is the most important fix -- it prevents ANY click (lock toggle, card tap) from accidentally re-writing entry times.

### EntryForm.tsx - Pre-fill date

```text
Current (line 144-149):
  useEffect(() => {
    if (prefillStartTime && open && !editEntry) {
      const dt = new Date(prefillStartTime);
      setStartTime(format(dt, 'HH:mm'));
    }
  }, [prefillStartTime, open, editEntry]);

Fixed:
  useEffect(() => {
    if (prefillStartTime && open && !editEntry) {
      const dt = new Date(prefillStartTime);
      setStartTime(format(dt, 'HH:mm'));
      if (!isUndated) {
        setDate(format(dt, 'yyyy-MM-dd'));
      }
    }
  }, [prefillStartTime, open, editEntry, isUndated]);
```

### CalendarDay.tsx - Header offset

Change line 215 from `top-[57px]` to `top-[53px]`. This will need visual verification and may need further tuning.

## Summary of Changes

| File | Change | Issue |
|------|--------|-------|
| `useDragResize.ts` | Skip commit when no actual drag movement | #3 (primary fix) |
| `CalendarDay.tsx` | Flight-aware dual-TZ in handleDragCommit | #3 (safety net) |
| `CalendarDay.tsx` | Adjust sticky top offset | #2 |
| `EntryForm.tsx` | Pre-fill date from prefillStartTime | #1 |


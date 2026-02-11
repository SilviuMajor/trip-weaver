

# Make Timing Editable in Event Overview + Remove Duration from Creation

## Change 1: Editable Timing in Event Overview (View Mode)

### Current Behavior
Lines 1314-1319 in `EntrySheet.tsx` show a read-only time span for generic (non-flight, non-transport) events:
```
<Clock /> 09:00 — 10:00
```
No way to edit start/end times from the overview.

### New Behavior
Replace the read-only time span with three fields:
- **Start time** -- editable via `InlineField` with `type="time"`
- **End time** -- editable via `InlineField` with `type="time"`
- **Duration** -- auto-calculated, read-only display (e.g. "1h 30m")

When Start or End is changed and saved:
1. Save the new time to the database (update `entries.start_time` or `entries.end_time`)
2. Duration recalculates live in the display
3. Call `onSaved()` to refresh the timeline

### Implementation
In `EntrySheet.tsx`, replace lines 1314-1319 (the generic time block) with:

```tsx
{/* Editable Start / End / Duration */}
<div className="space-y-2">
  <div className="flex items-center gap-3">
    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
    <div className="flex items-center gap-1.5">
      <InlineField
        value={formatTimeProp?.(entry.start_time) ?? ''}
        canEdit={isEditor}
        onSave={async (v) => handleGenericTimeSave('start', v)}
        inputType="time"
        renderDisplay={(val) => <span className="text-sm font-medium">{val}</span>}
      />
      <span className="text-sm text-muted-foreground">—</span>
      <InlineField
        value={formatTimeProp?.(entry.end_time) ?? ''}
        canEdit={isEditor}
        onSave={async (v) => handleGenericTimeSave('end', v)}
        inputType="time"
        renderDisplay={(val) => <span className="text-sm font-medium">{val}</span>}
      />
    </div>
    <span className="text-xs text-muted-foreground ml-auto">{genericDurationStr}</span>
    {isLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground/60" />}
  </div>
</div>
```

A new `handleGenericTimeSave` function will:
- Take the new HH:MM value and the entry's current date (extracted from the existing ISO timestamp in the trip timezone)
- Convert to UTC using `localToUTC`
- Update `entries.start_time` or `entries.end_time` in the database
- Call `onSaved()` to refresh

A computed `genericDurationStr` will calculate duration from `entry.end_time - entry.start_time` and format as "Xh Ym".

No preview/confirm step is needed here -- the user is informed that this will immediately reposition the card. The `InlineField` pattern (click to edit, blur/Enter to save, Escape to cancel) already provides a natural cancel mechanism.

---

## Change 2: Remove Duration Input from Event Creation

### Current Behavior
Lines 1769-1791 show a "Duration (minutes)" number input for non-flight events. Changing duration auto-adjusts end time. The `handleStartTimeChange` function (line 840) also recalculates end time from `start + duration`.

### New Behavior
- Remove the entire "Duration (minutes)" input block (lines 1769-1791)
- Show a read-only duration label derived from `endTime - startTime` next to the time inputs (replacing the current "Suggested: ..." text)
- Change `handleStartTimeChange` to no longer auto-adjust end time -- just set start time and let duration auto-recalculate in the display
- End time input already works independently (line 1764: `setEndTime(...)`)

### Implementation

1. **Remove duration input block** (lines 1769-1791): Delete the entire `{!isFlight && (...)}` block containing the Duration input and Calculate button.

2. **Update the time label** (line 1750-1755): Replace the "Suggested: ..." text with a simple computed duration display:
   ```tsx
   <span className="text-xs text-muted-foreground">
     Duration: {computedDuration}
   </span>
   ```
   Where `computedDuration` is calculated from `endTime - startTime`.

3. **Simplify `handleStartTimeChange`** (line 840): Change it to only set start time without adjusting end time:
   ```tsx
   const handleStartTimeChange = (newStart: string) => {
     setStartTime(newStart);
   };
   ```

4. The `durationMin` state variable is still used internally for transport calculations, so it remains but is no longer user-facing for regular events.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/timeline/EntrySheet.tsx` | Add `handleGenericTimeSave` function; replace read-only time display with editable InlineFields + auto-duration; remove Duration input from creation form; simplify `handleStartTimeChange` |

## What Is NOT Changed

- Timeline card rendering
- Drag-to-resize behavior
- Flight card overview (flights already have their own editable time fields)
- Transport card overview
- The `durationMin` state (still used internally for transport logic)


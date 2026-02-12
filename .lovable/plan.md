

# Fix Card Position Mismatch, Gutter Labels, and SNAP Debug

## Root Cause: Gutter Double-Counts TZ Offset

The timeline grid has two coordinate systems fighting each other:

- **Cards** are positioned using `getHourInTimezone(entry.start_time, resolvedTz)`. For post-flight entries, `resolvedTz = Europe/Amsterdam`, so Cocktails gets `startHour = 12.25`. Card top = `12.25 * PIXELS_PER_HOUR`.

- **Gutter labels** in `TimeSlotGrid` detect it's a flight day (`hasDualTz = true`), then for hours after the flight midpoint, display `hour + tzOffset`. Hour 12 on the pixel grid becomes label "13:00" (12 + 1h CET offset).

Result: A card at pixel position 12.25 visually appears at the gutter's "13:15" mark instead of "12:15".

The fix is simple: since cards already position themselves in the correct local-time hours, the gutter labels should just show the raw hour numbers without any offset. The gutter is a neutral 0-23 scale; pre-flight cards use departure-TZ hours and post-flight cards use destination-TZ hours, and both are already at the correct pixel positions.

## Changes

### Fix 1: Remove gutter label TZ offset (TimeSlotGrid.tsx)

**File: `src/components/timeline/TimeSlotGrid.tsx`** (lines 192-217)

Remove the entire dual-TZ label offset logic. Replace with a single simple label for all hours:

```typescript
{hours.map(hour => {
  const displayHour = `${String(hour).padStart(2, '0')}:00`;

  return (
    <div
      key={hour}
      className="absolute left-0 right-0 border-t border-border/30"
      style={{ top: (hour - startHour) * pixelsPerHour }}
    >
      <span className="absolute -top-2.5 z-[15] select-none text-[10px] font-medium text-muted-foreground/50 text-center" style={{ left: -46, width: 30 }}>
        {displayHour}
      </span>
    </div>
  );
})}
```

Also remove the now-unused `getHourTz`, `getTzOffsetHours`, `tzInfo` computed values, the `hasDualTz` variable, and the `getUtcOffsetHoursDiff` / `getUtcOffsetMinutes` imports (since the gutter no longer needs them). Keep the `flights` prop in the interface for TimeSlotGrid since it's still used for slot click TZ resolution.

### Fix 2: Add POSITION-DEBUG log (CalendarDay.tsx)

**File: `src/components/timeline/CalendarDay.tsx`** (after line 670)

Add a temporary debug log right where the CSS top is computed:

```typescript
console.log('[POSITION-DEBUG]', primaryOption.name, {
  entryStartHour,
  groupStartHour,
  topPx: top,
  heightPx: height,
  pixelsPerHour: PIXELS_PER_HOUR,
  resolvedTz,
  activeTz,
});
```

### Fix 3: Verify SNAP-DEBUG path (CalendarDay.tsx)

The SNAP-DEBUG log at line 1038 is already present. The issue is likely that the data migration for transport category didn't execute, so `isTransport` (line 704) is false and the SNAP block at line 1013 is never entered.

Add a broader debug log inside the `sortedEntries.map` loop, right after the `isTransport` calculation (after line 709):

```typescript
if (primaryOption.name?.toLowerCase().includes('drive') || 
    primaryOption.name?.toLowerCase().includes('walk') ||
    primaryOption.name?.toLowerCase().includes('transit')) {
  console.log('[TRANSPORT-DEBUG]', primaryOption.name, {
    category: primaryOption.category,
    isTransport,
    fromEntryId: entry.from_entry_id,
    toEntryId: entry.to_entry_id,
  });
}
```

This will tell us whether the data migration actually set `category = 'transfer'` on the old transport entries.

### Fix 4: activeTz for pre-flight entries (no code change needed)

The TZ-DEBUG shows `resolvedTz=Europe/London` for the coach (pre-flight), which is correct. The `activeTz=Europe/Amsterdam` is misleading but harmless for rendering because the per-entry `resolvedTz` override (lines 618-633) correctly detects pre-flight entries and switches to `originTz`.

The only downstream impact of `activeTz` being the destination TZ is:
- `handleDragCommit` fallback (line 141): If dragging a pre-flight entry, it uses `activeTz` (Amsterdam) instead of London. This is a minor edge case that can be addressed later.
- TimeSlotGrid slot clicks: clicking a pre-flight time slot uses Amsterdam TZ. Also minor.

These are acceptable trade-offs for now. The critical rendering path (card positions + gutter labels) will be fixed.

## Files Changed

| File | Changes |
|------|---------|
| `src/components/timeline/TimeSlotGrid.tsx` | Remove dual-TZ label offset logic; simplify to raw hour display; remove unused computed values and imports |
| `src/components/timeline/CalendarDay.tsx` | Add POSITION-DEBUG and TRANSPORT-DEBUG temporary console.logs |

## Expected Outcome

- Gutter labels show 00:00 through 23:00 without TZ offset
- Card at `startHour=12.25` aligns with the 12:00-13:00 gutter range (correct)
- Pre-flight cards at `startHour=5.0` align with the 05:00 gutter mark (correct)
- POSITION-DEBUG logs confirm card pixel positions match their startHour values
- TRANSPORT-DEBUG logs reveal whether the data migration applied `category='transfer'`
- SNAP-DEBUG logs appear if transport entries are correctly detected

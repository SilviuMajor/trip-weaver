

# Transport Connector Visual Redesign + Conflict Fix

## Part A: Fix False Conflicts

### `ContinuousTimeline.tsx` -- overlapMap useMemo (line 603)

Add transport entry exclusion after the `linkedEntryIds` check:

```
if (linkedEntryIds.has(a.id) || linkedEntryIds.has(b.id)) continue;
if (isTransportEntry(a) || isTransportEntry(b)) continue;  // NEW
```

### `ContinuousTimeline.tsx` -- overlapLayout useMemo (line 617-618)

Add transport exclusion to the filter:

```
.filter(e => !linkedEntryIds.has(e.id) && !isTransportEntry(e))
```

This prevents transport entries from creating false horizontal offset columns.

## Part B: Rewrite TransportConnector.tsx

Replace the full component with the updated design:

- **Thresholds**: Normal >= 28px (was 22), Compact 14-28px (was 14-22), Overflow < 14px (unchanged)
- **Text row order**: Settings cog FIRST (mode-coloured, 14x14, 4px padding), then emoji, then duration, then destination
- **Cog styling**: Mode colour at 70% opacity, full opacity on hover. Wrapped in a padded button for tap target
- **Fill area**: Add `borderRadius: '0 0 8px 0'` on the fill div for rounded bottom-right corner (6px in compact mode)
- **"+" button**: Show when `gapHeight >= 28` (was checking `isNormal` which used 22px threshold). Add hover styles: `hover:border-primary hover:bg-primary/10 hover:text-primary`
- **Overflow mode**: `fill` opacity 0.20, `bg` opacity 0.10 (was 0.18/0.08)
- **Background**: Add `bg-background` to "+" button for contrast

## Part C: Update ContinuousTimeline.tsx Connector Rendering

Minor update to the connector container at line 1304: the current code already computes `gapPx`, `gapMinutes`, `transportMinutes` and passes them correctly. No changes needed to the rendering block -- it already works with the new TransportConnector props.

The overflow threshold check at line 1308 (`gapPx < 14`) stays the same.

## Part D: Post-Transport Gap Cleanup

No changes identified -- the current code at line 1292-1293 already skips rendering when there's no transport entry. The gap rendering between non-transport cards is unaffected.

## Files Modified

- `src/components/timeline/TransportConnector.tsx` -- rewrite with updated thresholds, cog-first layout, fill border-radius, hover styles
- `src/components/timeline/ContinuousTimeline.tsx` -- add transport exclusion to overlapMap and overlapLayout useMemos (2 lines changed)

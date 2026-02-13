

# Remove TransportOverviewSheet, Use EntrySheet for Transport Info

## Summary

Wire the transport card's info button to open the same EntrySheet used by all other entry types, then delete the now-unused TransportOverviewSheet component.

## Changes

### 1. `src/components/timeline/ContinuousTimeline.tsx`

- **Change `onInfoTap` handler** (around line 850): Replace `() => setTransportSheetEntry(entry)` with `() => onCardTap(entry, primaryOption)` so tapping (i) opens EntrySheet in view mode.
- **Remove state variable** (line 316): Delete `const [transportSheetEntry, setTransportSheetEntry] = useState<EntryWithOptions | null>(null);`
- **Remove JSX block** (lines 1201-1253): Delete the entire `{transportSheetEntry && ...}` block that renders `<TransportOverviewSheet>`.
- **Remove import** (line 14): Delete `import TransportOverviewSheet from './TransportOverviewSheet';`

### 2. Delete `src/components/timeline/TransportOverviewSheet.tsx`

This file is no longer referenced anywhere and can be removed entirely.

## What does NOT change

- EntrySheet.tsx (already handles transport/transfer entries)
- Transport card visuals (colours, pill layout, overlay behaviour)
- Mode switching, refresh, delete interactions on the card itself

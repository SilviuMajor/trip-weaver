

# Replace TransportConnector with Thin Inline Connectors

## Overview
Rewrite TransportConnector.tsx as a minimal inline text connector (dot-line + emoji + duration + destination + cog icon). Then add auto-connector rendering in ContinuousTimeline so connectors appear between ALL adjacent scheduled cards, and hide transport entries from the card list entirely.

## Changes

### 1. TransportConnector.tsx -- Complete rewrite

Delete all existing content. Replace with a stateless component that accepts simple props:
- `mode: string` -- transport mode key
- `durationMin: number` -- travel duration
- `destinationName: string` -- where you're going (first part before comma)
- `distanceKm?: number | null`
- `isLoading?: boolean` -- shows "Calculating..." when no transport data exists
- `onCogTap: () => void` -- opens the transport entry detail
- `height?: number` -- defaults to 24px, min 20px

Layout: horizontal flex row with:
1. Dot-line connector (thin vertical line + dot, 8px wide, 40% opacity)
2. Info text: mode emoji + bold duration + "to [shortDest]" (all 10-11px, muted)
3. Settings cog icon (ml-auto, 3x3, very subtle)

No colored background strip. No pill with shadow. Just inline text.

### 2. ContinuousTimeline.tsx -- Add `connectorData` memo

After the existing `visibleEntries` memo (line ~528), add a new `connectorData` useMemo that iterates `visibleEntries` pairs and for each adjacent pair:

- Checks if a transport entry exists between them (using `sortedEntries.find` where `category === 'transfer'` and `from_entry_id`/`to_entry_id` match)
- If transport entry exists: extract mode (from option name), duration (from timestamps), destination name, distance, and store the `transportEntryId`
- If no transport entry: create a placeholder connector with `durationMin: 0` and `isLoading: true`

Returns an array of connector objects with `fromEntryId`, `toEntryId`, `fromEndGH`, `toStartGH`, mode, duration, destination, distance, and optional `transportEntryId`.

### 3. ContinuousTimeline.tsx -- Render connectors

After the gap buttons section (line ~1231) and before the entry cards section, render the `connectorData` array as absolutely-positioned TransportConnector elements:

- Position: `top = fromEndGH * pixelsPerHour`, height = gap in pixels (min 20px)
- If gap is tiny, center the connector vertically around the boundary
- Each connector gets `z-[12]` so it sits between the gap buttons and card layer
- `onCogTap` opens the transport entry via `onCardTap` if a `transportEntryId` exists

### 4. ContinuousTimeline.tsx -- Hide transport entries from card rendering

At the top of the card render loop (line ~1287, after `const isTransport = isTransportEntry(entry)`), add an early return:

```
if (isTransport) return null;
```

This removes the entire old transport card rendering branch (the colored strip TransportConnector + magnet button). Transport entries are now represented only by the inline connectors from step 3.

### 5. ContinuousTimeline.tsx -- Clean up gap buttons

In the gap buttons section (line ~1162), remove the `hasTransferBetween` check that skips rendering gap buttons when a transport entry exists. Since transport entries are now inline connectors, gap buttons should still appear where appropriate. Actually -- we should keep the check but also skip gaps where a connector already exists (they overlap visually). The connectors replace the transport button, so modify the gap logic:
- When `hasTransferBetween` returns true, skip the gap entirely (connector handles it)
- When `gapMin <= 5`, skip (too small)
- Otherwise render gap buttons as before

This is the existing behavior, so no change needed here.

### 6. Import cleanup

- Remove unused imports from TransportConnector.tsx (cn, EntryWithOptions, EntryOption, TransportMode)
- Add `Settings` import from lucide-react in TransportConnector.tsx
- In ContinuousTimeline.tsx, the existing TransportConnector import stays but now points to the new component

## Technical Details

**Transport detection for connectors**: Uses the same `isTransportEntry` helper that checks for 'transfer' category and transport-related option names.

**Mode detection**: Same logic as old TransportConnector -- checks if option name starts with walk/drive/transit/cycle/bicycle.

**Connector height**: Uses actual gap pixels between cards. Minimum 20px ensures visibility even when cards are nearly adjacent.

**No magnet button on connectors**: The old transport card had a magnet snap button. This is removed -- magnet remains only on regular entry cards. The cog icon on the connector opens the transport entry detail where users can edit transport.

## Files Modified
- `src/components/timeline/TransportConnector.tsx` -- complete rewrite with new props/UI
- `src/components/timeline/ContinuousTimeline.tsx` -- add connectorData memo, render connectors, hide transport cards from card loop


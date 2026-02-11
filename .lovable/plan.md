

# Reposition UI Elements on Cards and Transport Connector

## Overview

Three layout adjustments: move conflict warning badge to right-center of cards, move lock icon to left side of cards, and add inline Refresh + Delete buttons to the transport connector strip.

---

## Change 1: Move Conflict Warning Badge to Right-Center

### Current position
`CalendarDay.tsx` line 692-695: `absolute -top-1 -right-1` -- top-right corner, overlapping with lock icon.

### New position
Change to `absolute right-1 top-1/2 -translate-y-1/2` -- vertically centered on the right edge of the card.

Applies to the AlertTriangle badge at line 692. The red ring glow (`ring-2 ring-red-400/60` at line 690) stays unchanged as it covers the full card.

---

## Change 2: Move Lock Icon to Left Side

### Current positions (two instances)

1. **Flight lock icon** (line 789): `absolute -top-2 -right-2` -- move to `absolute -top-2 -left-2`
2. **Regular card lock icon** (line 889): `absolute -top-2 -right-2` -- move to `absolute -top-2 -left-2`

Both instances get the same position change. No other styling changes needed.

---

## Change 3: Transport Connector -- Inline Refresh and Delete Buttons

### Current state
`TransportConnector.tsx` has a Refresh button at `absolute top-1 right-1` (floating in the corner, separate from the mode icons row).

### New layout
Remove the absolute-positioned refresh button. Instead, add Refresh and X (delete) buttons inline in the mode icons row, to the right of the bicycle icon:

```
🚶 52m | 🚗 12m | 🚌 25m | 🚲 18m | 🔄 | ✕
```

- Refresh button: same RefreshCw icon, same behavior, styled consistently with mode buttons (muted, same size)
- X (delete) button: `X` icon from lucide-react, with a two-tap confirmation:
  - First tap: button turns red, icon changes to a checkmark or stays X with red background, indicating "tap again to confirm"
  - Second tap (within 3 seconds): triggers `onDelete` callback
  - After 3 seconds without second tap: reverts to normal X state
- Both buttons use the same rounded-md padding as mode buttons for visual consistency

### Props change
Add `onDelete: () => void` prop to `TransportConnectorProps`.

### CalendarDay integration
Pass `onDelete` from CalendarDay, which calls a new `onDeleteTransport` prop (bubbles up to Timeline.tsx).

### Timeline.tsx integration
`onDeleteTransport(entryId)`:
1. Record undo action with the full transport entry data (for undo = re-insert)
2. Delete the entry from the database
3. Next event stays in place (per user preference)
4. Call `fetchData()` to refresh

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/timeline/CalendarDay.tsx` | Move conflict badge to right-center; move lock icons to left side; pass `onDelete` to TransportConnector |
| `src/components/timeline/TransportConnector.tsx` | Remove absolute refresh button; add inline Refresh + X delete buttons in mode row; add `onDelete` prop with 2-tap confirmation |
| `src/pages/Timeline.tsx` | Add `handleDeleteTransport` with undo support |

## What Is NOT Changed

- Transport calculation logic
- Event card styling (beyond icon repositioning)
- Flight card behavior
- Refresh recalculation behavior
- Mode switching behavior


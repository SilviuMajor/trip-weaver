

# Transport Visual Connector Redesign — IMPLEMENTED

## Status: Complete

All 4 parts implemented:

1. **TransportConnector component** — slim inline strip with 4 mode icons (walk/drive/transit/bike), duration labels, refresh button, from/to labels
2. **Mode switching with snap preview** — pending mode highlight, confirm/cancel buttons, auto-push downstream events
3. **Transport stretching fix** — reposition-only on parent drag (preserve stored duration, no API re-fetch)
4. **Gap detection fix** — `hasTransferBetween` check prevents gap buttons around transport; remaining gaps after transport still show buttons

## Files Changed

| File | Change |
|------|--------|
| **Database migration** | Added `transport_modes` JSONB column to `entry_options` |
| `src/types/trip.ts` | Added `TransportMode` interface and `transport_modes` to `EntryOption` |
| `src/components/timeline/TransportConnector.tsx` | **New** — slim connector strip component |
| `src/components/timeline/CalendarDay.tsx` | Replaced EntryCard for transport with TransportConnector; added ghost preview state; fixed gap detection; removed drag/lock/+ buttons for transport |
| `src/pages/Timeline.tsx` | Fixed stretching (reposition-only); added `handleModeSwitchConfirm` handler |
| `src/components/timeline/EntrySheet.tsx` | Saves `transport_modes` JSONB on creation |

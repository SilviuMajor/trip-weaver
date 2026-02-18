

# Fix Transport Connector Position for Flight Groups

## Problem
The transport connector renders starting at the flight's end time (10:50) instead of after the checkout end (11:20). The connector values (duration, times) are correct, but its visual position on the timeline is wrong because `connectorData` doesn't account for flight group checkout bounds.

## Root Cause
In `connectorData` useMemo (line 568), `fromEndGH` is set directly from `getEntryGlobalHours(from).endGH`. For a flight entry, this is the flight landing time. But visually, the flight group includes a checkout section that extends below the flight card. The connector should start after the checkout, not after the flight.

The gap buttons section (line 1208-1213) already has this fix — it adjusts `aEndGH` by adding the checkout duration. The `connectorData` useMemo needs the same treatment.

## Fix

### `src/components/timeline/ContinuousTimeline.tsx` (lines 565-569 in connectorData useMemo)

After computing `fromGH` and `toGH`, check if the `from` entry has a flight group with checkout in `flightGroupMap`. If so, extend `fromEndGH` by the checkout duration (same pattern as the gap buttons at line 1210-1213).

Similarly, if the `to` entry has a checkin, pull `toStartGH` earlier (same as line 1217-1219).

```typescript
// Before pushing to connectors:
let fromEndGH = fromGH.endGH;
let toStartGH = toGH.startGH;

const fromGroup = flightGroupMap.get(from.id);
if (fromGroup?.checkout) {
  const coDur = (new Date(fromGroup.checkout.end_time).getTime() - new Date(fromGroup.checkout.start_time).getTime()) / 3600000;
  fromEndGH = fromGH.endGH + coDur;
}

const toGroup = flightGroupMap.get(to.id);
if (toGroup?.checkin) {
  const ciDur = (new Date(toGroup.checkin.end_time).getTime() - new Date(toGroup.checkin.start_time).getTime()) / 3600000;
  toStartGH = toGH.startGH - ciDur;
}
```

Then use these adjusted values in the `connectors.push()` calls (both the transport branch and the else branch) instead of `fromGH.endGH` and `toGH.startGH`.

Also add `flightGroupMap` to the useMemo dependency array.

## Files Modified
- `src/components/timeline/ContinuousTimeline.tsx` — adjust `connectorData` useMemo to account for flight group checkout/checkin bounds (same pattern already used by gap buttons)

## What Is NOT Changed
- Gap buttons section (already correct)
- `getEntryGlobalHours` (flight endGH is correct for the flight itself; the group extension is a rendering concern)
- Transport entry values/times (already correct as confirmed by user)

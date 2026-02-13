

# Magnet Icon Overhaul: Gap-Aware, Transport-Aware, with Correct Rotation

## Overview
Four interconnected fixes to make the magnet snap system smarter: only show the icon when there's actually a gap, show it on the right element (card or transport), support snapping from transport cards, and fix the icon rotation.

---

## Fix 1 -- Icon faces downward (inline style)

**File: `src/components/timeline/ContinuousTimeline.tsx`**

Replace the Tailwind `rotate-180` class with an inline `style={{ transform: 'rotate(180deg)' }}` on the `<Magnet>` component to guarantee the rotation works regardless of CSS specificity.

---

## Fix 2 -- Only show magnet when there is a gap

**File: `src/components/timeline/ContinuousTimeline.tsx`**

Replace the current `hasNextEntry` boolean logic (lines ~990-998) with a `computeMagnetState` function that checks for actual time gaps using a 2-minute tolerance (120,000ms). If the end of the current element (card or transport) aligns with the start of the next element within 2 minutes, no magnet is shown.

---

## Fix 3 -- Magnet appears on cards AND transport connectors

**File: `src/components/timeline/ContinuousTimeline.tsx`**

Currently, the magnet button only renders inside the regular card branch (line 924 onward). The transport connector branch (lines 882-922) has no magnet.

Changes:
- Extract the magnet button into a shared rendering block
- For **regular cards**: show magnet if there's a gap between the card's end and the transport start (or next event if no transport)
- For **transport connectors**: show magnet if there's a gap between the transport's end and the next event's start
- The `computeMagnetState` function handles all 5 scenarios from the prompt table

---

## Fix 4 -- handleMagnetSnap works from transport cards

**File: `src/pages/Timeline.tsx`**

Add a check at the start of `handleMagnetSnap` for whether the source entry is a transport (`opt.category === 'transfer'`). If so:
- Skip transport lookup (the source IS the transport)
- Find the next non-transport event
- Snap it to this transport's end time
- Include undo/redo support
- Return early before the existing Case A/B/C logic

Existing Case A, B, and C logic remains unchanged for regular card sources.

---

## Technical Details

### computeMagnetState logic (ContinuousTimeline.tsx)

```text
For each entry in the render loop:

1. Skip flights and airport_processing -- no magnet ever
2. Find transportAfter and nextEvent by scanning forward
3. GAP_TOLERANCE = 2 minutes (120000ms)

If entry is transport:
  - gapMs = nextEvent.start_time - entry.end_time
  - showMagnet = gapMs > tolerance

If entry is regular card:
  - If transportAfter exists:
      gapMs = transportAfter.start_time - entry.end_time
  - Else:
      gapMs = nextEvent.start_time - entry.end_time
  - showMagnet = gapMs > tolerance

nextLocked = nextEvent.is_locked
```

### Transport magnet button placement

The magnet button for transport connectors will be added inside the transport branch (after the `<TransportConnector>` component), using the same absolute positioning (`-bottom-3 -right-3`) and styling as the regular card magnet.

### handleMagnetSnap transport-source path (Timeline.tsx)

```text
At top of handleMagnetSnap, after finding opt:

if (opt.category === 'transfer'):
  - Scan forward for next non-transport, non-flight event
  - If not found or locked, return
  - Snap next event start to entry.end_time, preserve duration
  - Push undo action
  - Update DB, toast, fetchData, return
```

## Files Changed
1. `src/components/timeline/ContinuousTimeline.tsx` -- Fixes 1, 2, 3
2. `src/pages/Timeline.tsx` -- Fix 4

## What Does NOT Change
- Case B/C magnet snap logic for regular cards
- "+ Add something" buttons
- Lock icon positioning
- Card drag/resize
- Hotel, flight, EntrySheet systems

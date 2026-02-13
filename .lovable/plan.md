

# Move Magnet Icon from EntryCard to ContinuousTimeline Overlay

## Problem
The magnet icon is currently rendered inside `EntryCard.tsx` as an internal element. The lock icon, by contrast, is rendered as a sibling overlay in `ContinuousTimeline.tsx` at the card wrapper level. The magnet should follow the same pattern for consistent positioning and behavior.

## Changes

### File 1: `src/components/timeline/EntryCard.tsx`

Remove all magnet-related code:
- Remove `Magnet` from the lucide-react import (line 3)
- Remove the 4 magnet props from the interface (lines 58-61): `onMagnetSnap`, `nextEntryLocked`, `hasNextEntry`, `magnetLoading`
- Remove the 4 magnet prop destructurings (lines 130-133)
- Remove the `showMagnet` variable and `magnetButton` JSX block (lines 143-172)
- Remove the 4 `{magnetButton}` render calls at lines 522, 562, 696, 938

### File 2: `src/components/timeline/ContinuousTimeline.tsx`

**Remove magnet props from EntryCard** (lines 969-991): Remove the `onMagnetSnap`, `hasNextEntry`, `nextEntryLocked`, and `magnetLoading` props currently passed to `<EntryCard>`.

**Add magnet overlay below the lock icon** (after line 1011): Add a new `<button>` element as a sibling to the lock icon, positioned at `-bottom-3 -right-3` on the card wrapper div:

```
{/* Magnet snap icon outside card -- bottom right */}
{!isTransport && !isFlightCard && hasNextEntry && (
  <button
    onClick={...}
    className="absolute -bottom-3 -right-3 z-30 flex h-7 w-7 ..."
  >
    <Magnet className="h-3.5 w-3.5 rotate-180" /> or <Loader2 ... />
  </button>
)}
```

The `hasNextEntry` and `nextEntryIsLocked` values are computed inline (same logic that was previously passed as props -- reuse those IIFEs but move them into local variables before the JSX).

**Keep `magnetLoadingId` state** -- it already exists in ContinuousTimeline. The `handleMagnet` wrapper also stays, just called from the overlay button instead of passed to EntryCard.

**Add `Magnet` to the lucide-react imports** in ContinuousTimeline if not already there.

### Positioning Summary

| Icon | Position | Purpose |
|------|----------|---------|
| Lock | `top-1/2 -translate-y-1/2 -right-3` | Vertically centered, right edge |
| Magnet | `-bottom-3 -right-3` | Bottom-right corner |

Both use `h-7 w-7 rounded-full border border-border shadow-sm z-30`.

### Icon Rotation
The `Magnet` icon gets `rotate-180` to point the horseshoe straight down.

## What Does NOT Change
- Lock icon positioning or behavior
- `handleMagnetSnap` logic in Timeline.tsx
- Transport connector rendering
- The `onMagnetSnap` prop on ContinuousTimeline (it stays, just no longer forwarded to EntryCard)


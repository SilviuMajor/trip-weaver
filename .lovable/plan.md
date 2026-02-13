

# Fix Transport Pill: Matching Colour, Z-Index, and No-Op Tap

## Changes

### 1. `TransportConnector.tsx` -- Pill background matches strip

Replace the pill's `bg-white/95 dark:bg-stone-900/95` with the same mode colour used for the background strip. Keep the shadow and border so the pill remains visually raised.

Change line 147 from:
```
'bg-white/95 dark:bg-stone-900/95',
```
to using `style={{ backgroundColor: stripColor }}` on the pill div, removing the bg class.

### 2. `ContinuousTimeline.tsx` -- Raise transport z-index

The transport card's outer container (line 741) currently gets `zIndex: 10`, the same as event cards. Card B renders after the transport in DOM order, so it paints on top, hiding the pill's bottom overflow.

Fix: When the entry is a transport, set `zIndex: 20` (above event cards at 10). This ensures the pill's overflow is visible above both Card A and Card B.

Change line 741 from:
```
zIndex: isDragged ? 30 : hasConflict ? 10 + index : 10,
```
to:
```
zIndex: isDragged ? 30 : isTransport ? 20 : hasConflict ? 10 + index : 10,
```

### 3. `TransportConnector.tsx` -- Disable body tap

Add `pointer-events-none` to the outer container div, then add `pointer-events-auto` to each interactive button (info, mode buttons, refresh, trash). This ensures tapping empty space does nothing while all icons remain clickable.

### Files Modified

| File | Change |
|------|--------|
| `TransportConnector.tsx` | Pill bg matches strip colour; pointer-events-none on container with pointer-events-auto on buttons |
| `ContinuousTimeline.tsx` | Transport entries get zIndex 20 instead of 10 |

### What Does NOT Change

- Two-layer structure (background strip + content pill)
- Mode switching, info button, refresh, delete behaviour
- Event card positioning, continuous timeline, SNAP, drag chain

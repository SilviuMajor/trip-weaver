
# Fix Compressed Transport Overlay Mode

## Problem

The current compressed mode shrinks the transport card to 60% width and centres it as a pill. The desired behaviour is:

- Always 100% width
- Enforce a minimum height (~40px) so content is always readable
- When the timeline gap is smaller than the min height, the card overflows equally above and below the gap boundary, overlaying adjacent event cards
- Events are NOT pushed apart

## Changes

### 1. `TransportConnector.tsx` -- Remove 60% width, unify rendering

Remove the `isCompressed` branch entirely (lines 113-189). Instead, use a single render path:

- Remove `width: '60%'` and `margin: '0 auto'` -- card is always 100% width
- Remove the `rounded-full` pill shape for compressed mode
- The component always renders the same structure (the "normal" mode, lines 192-290)
- Change the `height` in the style to `Math.max(height, 40)` so the card never renders smaller than 40px
- For short heights (< 80px), use the compact horizontal row layout (all 4 modes in a single row with smaller icons, no from/to labels, no distance line)
- For taller heights (>= 80px), show the expanded layout with from/to labels and distance
- Add `shadow-sm border-solid` (instead of `border-dashed`) when the card is in overlay mode (`height < 40`) to visually distinguish it from event cards it overlays

### 2. `ContinuousTimeline.tsx` -- Fix overlay positioning

Update the transport positioning logic (around line 737):

- Define `MIN_TRANSPORT_HEIGHT = 40`
- When the gap `height < MIN_TRANSPORT_HEIGHT`:
  - The rendered height becomes `MIN_TRANSPORT_HEIGHT`
  - The top offset is adjusted to vertically centre the card on the gap: `top + (height / 2) - (MIN_TRANSPORT_HEIGHT / 2)`
  - z-index is set to 20 (above event cards at 10)
- When the gap `height >= MIN_TRANSPORT_HEIGHT`:
  - Render normally: `top` and `height` as-is, z-index 10
- Remove the old `top - 8` / `height + 16` logic

### Summary of positioning logic

```text
if (isTransport && height < MIN_TRANSPORT_HEIGHT):
  renderedTop = top + (height / 2) - (MIN_TRANSPORT_HEIGHT / 2)
  renderedHeight = MIN_TRANSPORT_HEIGHT
  zIndex = 20
else:
  renderedTop = top
  renderedHeight = height
  zIndex = 10
```

### Files Modified

| File | Change |
|------|--------|
| `src/components/timeline/TransportConnector.tsx` | Remove compressed branch, single render path with `minHeight: 40`, compact layout for short heights |
| `src/components/timeline/ContinuousTimeline.tsx` | Replace overlay positioning with centred min-height logic |

### What Does NOT Change

- Mode-based background colours
- Info (i) and trash icons, two-tap delete
- Transport overview sheet
- Mode switching
- SNAP system, drag chain, continuous timeline
- Event card positioning

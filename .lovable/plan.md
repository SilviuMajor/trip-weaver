

# Fix Transport Connector: Full-Width, Colours, Layout

## Changes

### 1. `TransportConnector.tsx` -- Colour and Layout Overhaul

**Background colours at 20% opacity:**

Replace the current `MODE_COLORS_LIGHT` and `MODE_COLORS_DARK` with lower-opacity versions:

```text
Light mode: hsla(hue, sat%, lightness%, 0.2) over transparent
Dark mode:  hsla(hue, sat%, lightness%, 0.12)
```

| Mode | Light background | Dark background |
|------|-----------------|-----------------|
| Walk | `hsla(140, 50%, 50%, 0.2)` | `hsla(140, 50%, 50%, 0.12)` |
| Drive | `hsla(0, 50%, 50%, 0.2)` | `hsla(0, 50%, 50%, 0.12)` |
| Transit | `hsla(45, 60%, 50%, 0.2)` | `hsla(45, 60%, 50%, 0.12)` |
| Bicycle | `hsla(210, 50%, 50%, 0.2)` | `hsla(210, 50%, 50%, 0.12)` |

**Selected mode highlight -- solid colour:**

Add a new `MODE_HIGHLIGHT` map with solid (opaque) mode colours. Replace the current `bg-orange-100` selected class with a dynamic `style={{ backgroundColor: MODE_HIGHLIGHT[currentMode] }}`.

| Mode | Highlight colour |
|------|-----------------|
| Walk | `hsl(140, 45%, 75%)` / dark: `hsl(140, 40%, 30%)` |
| Drive | `hsl(0, 45%, 80%)` / dark: `hsl(0, 40%, 30%)` |
| Transit | `hsl(45, 55%, 75%)` / dark: `hsl(45, 50%, 30%)` |
| Bicycle | `hsl(210, 45%, 78%)` / dark: `hsl(210, 40%, 30%)` |

**Layout -- single horizontal row with flex spread:**

Change the outer container from `flex-col items-center justify-center` to `flex items-center justify-between px-2`. This creates one row:

- Left: `(i)` info icon
- Centre: 4 mode buttons (each showing emoji + duration vertically stacked)
- Right: refresh + trash icons

Remove `flex-col` from the info, refresh, and trash button classes so they are inline `flex items-center justify-center` with consistent sizing. All icons use the same `h-3.5 w-3.5` size and are vertically centred via `items-center` on the parent row.

Remove the separate "From/To labels" and "Distance" lines for compact mode -- only show them when `renderedHeight >= 100` (wrapped above/below the main row in a `flex-col` wrapper).

### 2. No changes to `ContinuousTimeline.tsx`

The positioning logic (full width, overlay centering at z-20) is already correct. The card is already `width: 100%` and `left: 0%`. The issue was purely within TransportConnector's internal styling.

## Files Modified

| File | Change |
|------|--------|
| `src/components/timeline/TransportConnector.tsx` | 20% opacity backgrounds, solid mode highlights, single-row layout with flex justify-between |

## What Does NOT Change

- Transport overview sheet
- Mode switching behaviour
- Min-height / overlay logic in ContinuousTimeline
- SNAP, drag chain, continuous timeline
- Event card positioning


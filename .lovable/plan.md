

# Lighten Transport Card Colours + Shadow on Selected Mode

## Changes

### `src/components/timeline/TransportConnector.tsx`

1. **Use highlight colours for strip and pill**: Replace `STRIP_COLORS_LIGHT` and `STRIP_COLORS_DARK` values with the corresponding `MODE_HIGHLIGHT_LIGHT` and `MODE_HIGHLIGHT_DARK` values. This makes the background strip and pill light pastel tones instead of saturated mid-tones.

| Mode | Light (before) | Light (after) |
|------|---------------|--------------|
| Walk | `hsl(140, 50%, 50%)` | `hsl(140, 45%, 75%)` |
| Drive | `hsl(0, 50%, 50%)` | `hsl(0, 45%, 80%)` |
| Transit | `hsl(45, 60%, 50%)` | `hsl(45, 55%, 75%)` |
| Bicycle | `hsl(210, 50%, 50%)` | `hsl(210, 45%, 78%)` |

Same approach for dark mode using the `MODE_HIGHLIGHT_DARK` values.

2. **Selected mode button gets a shadow border**: On the selected mode button (line 182), replace the `backgroundColor: highlightColor` with a `box-shadow` ring instead, since the button background now matches the pill background. This makes the selected mode stand out via a subtle inset/outline shadow rather than a colour fill.

Style for selected mode button:
```
boxShadow: '0 0 0 1.5px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.15)'
```
(Dark mode uses `rgba(255,255,255,0.3)` for the ring.)

Remove `backgroundColor: highlightColor` from the selected button since it now matches the pill.

### Files Modified

| File | Change |
|------|--------|
| `TransportConnector.tsx` | Strip/pill colours use highlight (pastel) values; selected mode gets shadow ring instead of colour fill |

### What Does NOT Change

- Two-layer structure, mode switching, info/refresh/delete behaviour
- Event card positioning, z-index stacking, pointer-events logic


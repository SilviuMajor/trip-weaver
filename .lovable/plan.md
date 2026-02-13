

# Transport Card: Full Opacity, No Border, Unified Colour

## Changes

### `src/components/timeline/TransportConnector.tsx`

1. **Opacity to 100%**: Update all `STRIP_COLORS_LIGHT` and `STRIP_COLORS_DARK` values from `0.8` to `1.0` alpha.

2. **Remove pill border**: On the content pill div (around line 142), remove `border border-stone-200/60 dark:border-stone-700/60` classes.

3. **Colours already match**: Both the background strip and the content pill already use the same `stripColor` variable, so no colour change is needed -- they will both become 100% opacity together.

### Files Modified

| File | Change |
|------|--------|
| `TransportConnector.tsx` | Alpha `0.8` to `1.0` in all 8 colour constants; remove border classes from pill |

### What Does NOT Change

- Two-layer structure, mode switching, info/refresh/delete behaviour
- Event card positioning, z-index stacking, pointer-events logic


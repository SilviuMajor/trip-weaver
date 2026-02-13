

# Transport Card: Two-Layer Structure (Background Strip + Content Pill)

## Concept

The transport card becomes two distinct visual layers:

1. **Background strip** -- full-width, constrained exactly to the gap height, never overflows
2. **Content pill** -- auto-width, centred, has min-height, overflows into adjacent cards when gap is small

## Changes

### 1. `ContinuousTimeline.tsx` -- Revert overlay positioning

Remove the min-height centering logic. The transport card container should always be positioned at the exact gap location with the exact gap height. The overflow is handled inside the component, not at the positioning level.

```
// BEFORE (current):
top: isTransport && height < 40 ? top + (height / 2) - 20 : top,
height: isTransport && height < 40 ? 40 : height,
zIndex: isDragged ? 30 : isTransport && height < 40 ? 20 : ...

// AFTER:
top: top,
height: height,
zIndex: isDragged ? 30 : hasConflict ? 10 + index : 10,
```

Add `overflow-visible` to the transport card's container div (it already has `overflow-visible` on the outer div but the style height constraint clips content -- we need the inner content to be able to spill out).

### 2. `TransportConnector.tsx` -- Two-layer render

Completely rework the render structure:

**Colour constants:** Replace `MODE_COLORS_LIGHT/DARK` with ~15% opacity versions for the background strip. Keep the existing `MODE_HIGHLIGHT` maps for selected mode highlights.

| Mode | Strip bg (light) | Strip bg (dark) |
|------|------------------|-----------------|
| Walk | `hsla(140, 50%, 50%, 0.15)` | `hsla(140, 50%, 50%, 0.1)` |
| Drive | `hsla(0, 50%, 50%, 0.15)` | `hsla(0, 50%, 50%, 0.1)` |
| Transit | `hsla(45, 60%, 50%, 0.15)` | `hsla(45, 60%, 50%, 0.1)` |
| Bicycle | `hsla(210, 50%, 50%, 0.15)` | `hsla(210, 50%, 50%, 0.1)` |

**Render structure:**

```text
<div className="relative w-full" style={{ height }} (overflow: visible)>
  
  <!-- Layer 1: Background strip -->
  <div className="absolute inset-0 rounded-sm" (overflow: hidden)
       style={{ backgroundColor: stripColor }} />
  
  <!-- Layer 2: Content pill -->
  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 
                   z-20 min-h-[40px] w-fit px-3 py-1 
                   bg-white/95 dark:bg-stone-900/95 
                   rounded-full shadow-md border border-stone-200/60 dark:border-stone-700/60
                   flex items-center gap-1.5">
    (i) | mode icons with durations | refresh | trash
  </div>
  
</div>
```

- The outer div has `overflow: visible` -- the content pill can spill out
- Layer 1 (background strip) has `overflow: hidden` and `inset-0` -- exactly fills the gap, never overflows
- Layer 2 (content pill) is absolutely positioned at 50%/50% with translate centering -- sits at the midpoint of the gap, overflows equally into adjacent cards when gap is small
- Content pill has `z-20` so it renders above event cards
- Content pill has white/cream background with shadow so it's readable over any event card content

**Content pill layout** (single horizontal row):
- Info (i) icon
- 4 mode buttons (emoji + duration stacked vertically in each), selected one gets highlight background
- Refresh icon
- Trash icon (with existing two-tap confirm)

**Extended content:** When `height >= 100`, show from/to labels and distance as additional text lines above/below the content pill (or inside it).

### Files Modified

| File | Change |
|------|--------|
| `src/components/timeline/TransportConnector.tsx` | Two-layer structure: background strip + content pill with overflow |
| `src/components/timeline/ContinuousTimeline.tsx` | Revert overlay positioning -- use exact gap top/height, remove min-height centering |

### What Does NOT Change

- Transport overview sheet
- Mode switching behaviour
- SNAP system, drag chain, continuous timeline
- Event card rendering or positioning
- Mode highlight colours


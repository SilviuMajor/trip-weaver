
# Fix Day Pill Scroll Detection + Bigger Inline Date Markers

## Root Cause

The outer wrapper `<div className="flex min-h-screen flex-col">` uses `min-h-screen` instead of `h-screen`. This means the `<main>` element with `flex-1 overflow-y-auto` is never height-constrained -- it just grows to fit all content. The **page itself** (window/document) scrolls, not the `<main>` element.

So when the scroll handler reads `container.scrollTop` from `<main>`, it's always 0. And `container.clientHeight` equals the full content height, not the visible viewport. The "centre" calculation then points to the middle of the entire timeline content, not the middle of what the user sees on screen.

## Fix Strategy

**Option chosen**: Change the outer container from `min-h-screen` to `h-screen` so that the flex layout constrains `<main>` to the remaining viewport height. This activates `overflow-y-auto` on `<main>`, making it the actual scroll container. The scroll handler then correctly reads viewport-relative values.

This is the cleanest fix because the rest of the code (drag/resize, scroll-to-now, etc.) already assumes `mainScrollRef` is the scroll container.

## Changes

### 1. `src/pages/Timeline.tsx` -- Fix outer container height

Line 1426: Change `min-h-screen` to `h-screen`:

```tsx
<div className="flex h-screen flex-col bg-background" ref={scrollRef}>
```

This single change makes the `<main>` element become the actual scroll container, so `scrollTop` and `clientHeight` work correctly.

### 2. `src/components/timeline/ContinuousTimeline.tsx` -- Inline midnight markers: bigger and more obvious

Lines 534-556: Update the inline midnight day marker styling:

- Increase text from `text-[9px]` to `text-xs` (12px)
- Increase padding from `px-2 py-0.5` to `px-3 py-1`
- Add a stronger background and border: `bg-secondary border border-border/40`
- Increase the "TODAY" badge from `text-[8px]` to `text-[10px]`
- Add a subtle shadow for depth

### What does NOT change
- The scroll calculation logic in the useEffect (lines 100-125) -- it's already correct, it just needs the scroll container to actually scroll
- Fixed day pill position (stays at top: 110px)
- Fixed day pill text size (stays at text-sm)
- Timeline cards, drag/drop, transport connectors
- Tab bar, header, navigation

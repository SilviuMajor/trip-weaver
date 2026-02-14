
# Rendering Fixes: Threshold, Card 1 Visibility, Card 3 Clamping

## Fix 1 -- Viewport-relative horizontal threshold
**File:** `src/components/timeline/ContinuousTimeline.tsx`, line 544

Replace `const threshold = 20` with viewport-relative calculation:
```typescript
const vw = window.innerWidth;
const threshold = Math.max(30, vw * 0.12);
```
375px phone = 45px threshold. 1920px desktop = 230px threshold.

## Fix 2 -- Card 1 (original position) visibility
**File:** `src/components/timeline/ContinuousTimeline.tsx`

**Line 1046** -- Remove `opacity-80` from className (it fights with inline opacity):
```typescript
// Before: isDragged && 'opacity-80 z-30',
// After:
isDragged && 'z-30',
```

**Line 1055** -- Increase opacity to 0.35 and add dashed outline:
```typescript
opacity: isBeingDragged ? 0.35 : undefined,
outline: isBeingDragged ? '2px dashed hsl(var(--primary) / 0.4)' : undefined,
outlineOffset: isBeingDragged ? '-2px' : undefined,
borderRadius: isBeingDragged ? '16px' : undefined,
```

## Fix 3 -- Card 3 (floating/detached) clamped to viewport
**File:** `src/components/timeline/ContinuousTimeline.tsx`, lines 1686-1687

Replace direct positioning with clamped values:
```typescript
const rawLeft = dragState.currentClientX - cardWidth / 2;
const clampedLeft = Math.max(4, Math.min(window.innerWidth - cardWidth - 4, rawLeft));
const rawTop = dragState.currentClientY - moveHeight / 2;
const clampedTop = Math.max(4, Math.min(window.innerHeight - moveHeight - 4, rawTop));
```
Use `clampedLeft` and `clampedTop` in the style block.

## Files changed
1. `src/components/timeline/ContinuousTimeline.tsx` -- all three fixes

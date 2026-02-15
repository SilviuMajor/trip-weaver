
# GPU-Composited Floating Card for Smooth Mobile Drag

## Change (single file: `src/components/timeline/ContinuousTimeline.tsx`, lines 1710-1717)

Replace the current `left`/`top` positioning with `transform: translate()` and remove the CSS transition.

**Before:**
```typescript
style={{
  left: Math.max(4, Math.min(window.innerWidth - cardWidth - 4, dragState.currentClientX - cardWidth / 2)),
  top: Math.max(4, Math.min(window.innerHeight - moveHeight - 4, dragState.currentClientY - moveHeight / 2)),
  width: cardWidth,
  height: moveHeight,
  transform: shrinkFactor < 1 ? `scale(${shrinkFactor})` : undefined,
  transition: 'left 0.1s ease-out, top 0.1s ease-out, transform 0.1s ease-out',
}}
```

**After:**
```typescript
style={{
  left: 0,
  top: 0,
  width: cardWidth,
  height: moveHeight,
  transform: `translate(${Math.max(4, Math.min(window.innerWidth - cardWidth - 4, dragState.currentClientX - cardWidth / 2))}px, ${Math.max(4, Math.min(window.innerHeight - moveHeight - 4, dragState.currentClientY - moveHeight / 2))}px)${shrinkFactor < 1 ? ` scale(${shrinkFactor})` : ''}`,
  willChange: 'transform',
}}
```

### Why
- **No transition**: removes the 100ms delay so the card tracks the finger instantly
- **transform: translate()**: GPU-composited, no layout recalculation, much smoother on mobile
- **willChange: 'transform'**: promotes element to its own compositing layer

### Nothing else changes
All drag logic, thresholds, shrink-to-bin animation, EntryCard rendering -- all untouched.

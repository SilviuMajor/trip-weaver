

# Replace dragPhase with Horizontal-Distance-From-Start Logic

## Changes (single file: `src/components/timeline/ContinuousTimeline.tsx`)

### Replace dragPhase useMemo (lines 534-549)

**Before:** Measures distance from the grid edge, which varies depending on where on the card you grab.

**After:** Measures horizontal distance from the initial touch/click point (`startClientX`), giving consistent behavior regardless of grab position.

```typescript
const dragPhase = useMemo((): 'timeline' | 'detached' | null => {
  if (!dragState || dragState.type !== 'move') return null;
  
  const horizontalDist = Math.abs(dragState.currentClientX - dragState.startClientX);
  const vw = window.innerWidth;
  const isMobileDevice = vw < 768;
  const threshold = isMobileDevice ? Math.max(15, vw * 0.04) : Math.max(40, vw * 0.04);
  
  return horizontalDist > threshold ? 'detached' : 'timeline';
}, [dragState]);
```

Thresholds: ~15px on a 375px phone, ~77px on a 1920px desktop.

### Nothing else changes
All card positioning, TZ-aware labels, drag handlers, and everything else stays as-is.


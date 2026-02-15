

# Adjust Detach Threshold and Remove Diagnostic Toast

## Changes (single file: `src/components/timeline/ContinuousTimeline.tsx`)

### 1. Replace threshold calculation (lines 544-545)

**Before:**
```typescript
const vw = window.innerWidth;
const threshold = Math.max(30, vw * 0.12);
```

**After:**
```typescript
const vw = window.innerWidth;
const isMobileDevice = vw < 768;
const threshold = isMobileDevice ? Math.max(12, vw * 0.04) : Math.max(30, vw * 0.06);
```

This makes detaching much easier on mobile (~15px on a 375px phone) while keeping a reasonable threshold on desktop (~115px on 1920px).

### 2. Remove diagnostic toast (lines 548-550)

Delete the `toast.info('dragPhase: ...')` block entirely (the 3-line if-block with `id: 'dragphase'`).

### Nothing else changes
All drag logic, card positioning, TZ-aware labels, and everything else stays as-is.


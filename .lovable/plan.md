
# Replace motion.div with plain div in EntryCard + Restore Touch Props

## Problem
Framer-motion's `motion.div` registers native DOM touch event listeners that call `stopPropagation()` before React's synthetic event system fires. This kills all touch events on EntryCard -- explaining why zero diagnostic toasts appeared despite correct code on both the wrapper div and the card itself.

## Solution

### File 1: `src/components/timeline/EntryCard.tsx`

**Remove framer-motion import (line 2):**
Delete `import { motion } from 'framer-motion';`

**Replace all 8 `<motion.div` with `<div` and remove animation props:**

Each instance loses `initial`, `animate`, `transition` props but keeps all other props (`onClick`, `onMouseDown`, `onTouchStart`, `onTouchMove`, `onTouchEnd`, `className`, `style`). Closing `</motion.div>` becomes `</div>`.

The 8 locations:
1. Line 290 -- transport compact
2. Line 315 -- transport medium
3. Line 341 -- transport condensed
4. Line 378 -- transport full
5. Line 440 -- regular medium
6. Line 491 -- regular compact
7. Line 540 -- regular condensed
8. Line 654 -- regular full

Each closing tag also changes: lines 309, 335, 372, 433, 484, 524, 649, 886.

All `style` props already contain `touchAction: 'none'` from the previous fix -- no changes needed there.

### File 2: `src/components/timeline/ContinuousTimeline.tsx`

**Restore touch props on the main EntryCard render (after line 1303):**
Add back:
```typescript
onTouchDragStart={canDrag ? (e) => {
  onTouchStart(e as any, entry.id, 'move', origStartGH, origEndGH, dragTz);
} : isLocked ? (e) => {
  e.stopPropagation();
  handleLockedAttempt(entry.id);
} : undefined}
onTouchDragMove={onTouchMove}
onTouchDragEnd={onTouchEnd}
```

This gives belt-and-suspenders: touch handlers on both the wrapper div (already there) and the EntryCard itself. First one to fire wins.

### No changes to other files
- `useDragResize.ts` -- keep all diagnostic toasts as-is
- Card 1 visibility styling -- keep as-is (opacity 0.4, dashed primary border)
- Card 2/3 rendering, resize handles, bin/planner logic -- unchanged

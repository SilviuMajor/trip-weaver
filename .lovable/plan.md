
# Fix Floating Card Grab-Point Alignment

## Problem
The floating card (Card 3) centers on the finger (`cy - moveHeight / 2`), but the ghost outline positions by the card's top edge using `grabOffsetHours`. When you grab near the bottom of a tall card, the floating card jumps up relative to the ghost.

## Changes (single file: `src/components/timeline/ContinuousTimeline.tsx`)

### Change 1: RAF loop (line 569)
Replace `cy - moveHeight / 2` with `cy - grabOffsetPx` so the grab point stays under the finger:

```typescript
// Before
const ty = Math.max(4, Math.min(window.innerHeight - moveHeight - 4, cy - moveHeight / 2));

// After
const grabOffsetPx = dragState.grabOffsetHours * pixelsPerHour;
const ty = Math.max(4, Math.min(window.innerHeight - moveHeight - 4, cy - grabOffsetPx));
```

### Change 2: Initial render transform (line 1745)
Same fix for the initial inline transform -- replace `clientYRef.current - moveHeight / 2` with `clientYRef.current - dragState.grabOffsetHours * pixelsPerHour`:

```typescript
// Before
...clientYRef.current - moveHeight / 2))}px)`,

// After
...clientYRef.current - dragState.grabOffsetHours * pixelsPerHour))}px)`,
```

### Nothing else changes
Card 1, Card 2, time pills, ghost outline, bin logic, resize -- all untouched.

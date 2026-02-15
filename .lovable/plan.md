
# Smoother Drag Feel: Haptic Ticks, Visual Lift, and Focus Fade

## Overview
Three targeted changes to make timeline card dragging feel polished and responsive, matching Google Calendar's interaction quality.

## Changes

### 1. Haptic on every snap tick (`src/hooks/useDragResize.ts`)

Add 1ms micro-vibrations when the snapped grid position changes during drag/resize.

**Move handler (~line 198):** Inside the existing `if (newStart !== state.currentStartHour || newEnd !== state.currentEndHour || wasDetached !== isDetached)` block, add before `setDragState(updated)`:
```ts
if (newStart !== state.currentStartHour || newEnd !== state.currentEndHour) {
  if (navigator.vibrate) navigator.vibrate(1);
}
```

**Resize-top handler (~line 217):** Before `setDragState(updated)`, add:
```ts
if (newStart !== state.currentStartHour) {
  if (navigator.vibrate) navigator.vibrate(1);
}
```

**Resize-bottom handler (~line 230):** Before `setDragState(updated)`, add:
```ts
if (newEnd !== state.currentEndHour) {
  if (navigator.vibrate) navigator.vibrate(1);
}
```

### 2. Visual lift on dragged card (`src/components/timeline/EntryCard.tsx`)

In all 8 layout branches (lines 297, 321, 346, 382, 445, 493, 539, 650), change:
```
isDragging ? 'cursor-grabbing ring-2 ring-primary'
```
to:
```
isDragging ? 'cursor-grabbing ring-2 ring-primary scale-[1.03] shadow-xl z-50 transition-transform duration-100'
```

This adds a subtle 3% scale-up, deeper shadow, and elevated z-index with a smooth 100ms transition on pickup.

### 3. Fade non-dragged cards during move drag (`src/components/timeline/ContinuousTimeline.tsx`)

On the card wrapper div (line 1200-1210), modify the `opacity` and add `transition` to the existing style object:

Change line 1206 from:
```ts
opacity: isBeingDragged ? 0.4 : undefined,
```
to:
```ts
opacity: isBeingDragged ? 0.4
  : (dragState && dragState.type === 'move' && dragState.entryId !== entry.id) ? 0.4
  : undefined,
transition: 'opacity 0.2s ease',
```

This fades all non-dragged cards to 40% during move drags only (not resize), making the dragged card the clear visual focus. The `isBeingDragged` case (the ghost at the original position) keeps its existing 0.4 opacity. The 0.2s transition makes the fade smooth.

## What does NOT change
- Drag mechanics, touch handling, RAF loop, floating card positioning
- Auto-scroll behavior
- Any drag state logic beyond adding haptic calls
- The existing `ring-2 ring-primary` styling (kept, just extended)

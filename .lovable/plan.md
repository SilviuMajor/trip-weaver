

# Fix Touch Drag Placement Offset

## Problem
The entry lands about an hour below where the user's finger is. The ghost card's visual position doesn't match where the entry gets placed on the timeline.

## Changes (all in `src/pages/Timeline.tsx`)

### 1. Centre ghost card vertically on finger
Change the ghost card's `top` from `touchDragPosition.y - 40` to `touchDragPosition.y - 55` (approximate vertical centre of a ~110px card scaled to 0.85).

### 2. Centre placement calculation using entry duration
In the `handleTouchMove` document listener (around line 1451), adjust the globalHour calculation to offset by half the entry's duration, so the entry's midpoint aligns with the finger position:

```
const relativeY = touch.clientY - rect.top;
const rawGlobalHour = relativeY / PIXELS_PER_HOUR;
const entryDurationHours = touchDragEntryRef.current
  ? (new Date(touchDragEntryRef.current.end_time).getTime() -
     new Date(touchDragEntryRef.current.start_time).getTime()) / 3600000
  : 1;
const centredHour = rawGlobalHour - (entryDurationHours / 2);
const snapped = Math.round(centredHour * 4) / 4;
setTouchDragGlobalHour(snapped >= 0 ? snapped : 0);
```

This means: finger position = ghost centre = entry midpoint on timeline.

### Summary of edits
- **Line ~1451-1454**: Replace globalHour calculation with duration-centred version
- **Line ~2283**: Change ghost `top` offset from `-40` to `-55`

### What does NOT change
- Desktop drag and drop
- Ghost card rendering (SidebarEntryCard component)
- Planner hide/show logic
- Magnet snap, EntryCard drag/resize




# Fix Auto-Schedule Transport + Add Auto-Scroll & Cross-Day Drag

## Three Problems to Solve

### Problem 1: Snap is pulling events across days
The current snap logic in `handleAutoGenerateTransport` indiscriminately pulls forward ANY unlocked event after a transport entry, regardless of which day it belongs to. Events are grouped by ISO date string (`start_time.substring(0, 10)`), but if a Sunday event falls into a group due to timezone differences or if the snap logic crosses day boundaries, it gets pulled into Saturday's schedule.

**Root cause**: The `dayStr` grouping uses raw ISO date which may not match the trip timezone day. Also, the cascade push doesn't check whether pushing an event would cross midnight into the next day.

### Problem 2: No auto-scroll when dragging to screen edge
The `useDragResize` hook handles vertical drag movement within a single day's CalendarDay container but has no awareness of the scroll container or viewport edges. When you drag to the bottom of the screen, nothing scrolls.

### Problem 3: Can't drag entries between different day timelines
Each `CalendarDay` component is an isolated drag context. The `useDragResize` hook tracks `clientY` relative to a single day's pixel grid and commits back to the same day. There's no mechanism to detect that a drag has moved into an adjacent day's area and update the target day accordingly.

---

## Solution Design

### Fix 1: Guard snap/push against cross-day and cross-midnight shifts

**Changes to `src/pages/Timeline.tsx` (`handleAutoGenerateTransport`)**:

- Use the trip timezone to determine the calendar day for each entry (not raw ISO substring)
- Add a midnight guard: never snap or push an entry if doing so would move it across midnight into a different calendar day
- Only snap events that are on the SAME calendar day as the transport entry
- Only snap the FIRST non-transport unlocked event after each transport (already correct, just needs the day guard)

```
Before snap/push:
  entryDay = getDateInTimezone(entry.start_time, tripTimezone)
  transportDay = getDateInTimezone(transport.end_time, tripTimezone)
  if entryDay !== transportDay -> skip this entry entirely
  
Before push:
  newStart = currentEnd (the pushed time)
  newDay = getDateInTimezone(newStart, tripTimezone)  
  if newDay !== originalDay -> skip, don't push across midnight
```

### Fix 2: Auto-scroll with acceleration when dragging near viewport edges

**Changes to `src/hooks/useDragResize.ts`**:

Add an auto-scroll mechanism that activates during drag:

- Define an edge zone (80px from top/bottom of the scroll container)
- When the pointer is within the edge zone during a drag, scroll the container
- Use accelerating speed: the closer to the edge, the faster it scrolls (200px/s at zone boundary, up to 800px/s at the very edge)
- Use `requestAnimationFrame` for smooth scrolling
- Clean up the animation frame on drag end

The hook needs a new parameter: `scrollContainerRef` pointing to the main timeline scroll container (`scrollRef` in Timeline.tsx).

```typescript
// During drag, check if pointer is near edge
const EDGE_ZONE = 80; // px from edge
const MIN_SPEED = 200; // px/s
const MAX_SPEED = 800; // px/s

// In rAF loop:
const rect = scrollContainer.getBoundingClientRect();
const distFromBottom = rect.bottom - clientY;
const distFromTop = clientY - rect.top;

if (distFromBottom < EDGE_ZONE) {
  const ratio = 1 - (distFromBottom / EDGE_ZONE); // 0 at zone edge, 1 at screen edge
  const speed = MIN_SPEED + ratio * (MAX_SPEED - MIN_SPEED);
  scrollContainer.scrollTop += speed * deltaTime;
}
// Similar for top edge (scroll up)
```

### Fix 3: Cross-day drag-and-drop

**Changes to `src/hooks/useDragResize.ts`**:

Add a new parameter `dayBoundaries` -- an array of `{ dayDate: Date, topPx: number, bottomPx: number }` representing where each day's timeline sits in the scroll container. During drag:

- Track which day the pointer is currently over
- If the pointer crosses into a different day, update a `targetDay` field in `dragState`
- On commit, pass the target day along with the new hour offsets

**Changes to `src/components/timeline/CalendarDay.tsx`**:

- Accept a `ref` or expose its container element position so Timeline.tsx can build the `dayBoundaries` array
- When rendering, respect `dragState.targetDay` to show the ghost/preview in the correct day

**Changes to `src/pages/Timeline.tsx`**:

- Collect refs from each CalendarDay to build the boundaries array
- Pass `scrollRef` and boundaries to `useDragResize`
- Update `handleEntryTimeChange` (the commit handler) to also handle day changes:
  - Compute new `start_time` and `end_time` using the TARGET day + hour offset
  - Update the entry in the database

```typescript
// In onCommit callback:
onCommit: (entryId, newStartHour, newEndHour, tz, targetDayDate) => {
  // If targetDayDate differs from original day, recompute ISO times for new day
  const newStart = localToUTC(targetDayDate, newStartHour, tz);
  const newEnd = localToUTC(targetDayDate, newEndHour, tz);
  handleEntryTimeChange(entryId, newStart, newEnd);
}
```

---

## File Changes Summary

| File | Changes |
|------|---------|
| `src/pages/Timeline.tsx` | Fix day grouping in snap/push to use trip timezone; add midnight guard; collect day refs for cross-day drag; pass scrollRef to useDragResize; update commit handler for cross-day moves |
| `src/hooks/useDragResize.ts` | Add `scrollContainerRef` param for auto-scroll; add `dayBoundaries` param for cross-day detection; implement accelerating edge-scroll in rAF loop; add `targetDay` to DragState; clean up rAF on unmount |
| `src/components/timeline/CalendarDay.tsx` | Forward ref on the day container div so Timeline can measure its position for dayBoundaries |

---

## Technical Details

### Auto-scroll implementation in useDragResize.ts

```typescript
interface UseDragResizeOptions {
  pixelsPerHour: number;
  startHour: number;
  onCommit: (entryId: string, newStartHour: number, newEndHour: number, tz?: string, targetDay?: Date) => void;
  scrollContainerRef?: React.RefObject<HTMLElement>;
  dayBoundaries?: Array<{ dayDate: Date; topPx: number; bottomPx: number }>;
}

// New fields in DragState:
interface DragState {
  // ...existing fields...
  targetDay?: Date;  // which day the drag is currently over
}

// Auto-scroll loop (started on drag start, stopped on commit):
const scrollRafRef = useRef<number>(0);
const lastFrameRef = useRef<number>(0);

const autoScrollLoop = useCallback((timestamp: number) => {
  if (!isDraggingRef.current || !scrollContainerRef?.current) return;
  
  const dt = (timestamp - lastFrameRef.current) / 1000;
  lastFrameRef.current = timestamp;
  
  const container = scrollContainerRef.current;
  const rect = container.getBoundingClientRect();
  const clientY = lastClientYRef.current;  // track last known pointer Y
  
  const EDGE = 80;
  const distBottom = rect.bottom - clientY;
  const distTop = clientY - rect.top;
  
  if (distBottom < EDGE && distBottom > 0) {
    const ratio = 1 - distBottom / EDGE;
    container.scrollTop += (200 + ratio * 600) * dt;
  } else if (distTop < EDGE && distTop > 0) {
    const ratio = 1 - distTop / EDGE;
    container.scrollTop -= (200 + ratio * 600) * dt;
  }
  
  scrollRafRef.current = requestAnimationFrame(autoScrollLoop);
}, [scrollContainerRef]);
```

### Cross-day detection in useDragResize.ts

```typescript
// During handlePointerMove, after computing new hours:
if (dayBoundaries && dayBoundaries.length > 0) {
  const scrollTop = scrollContainerRef?.current?.scrollTop ?? 0;
  const containerTop = scrollContainerRef?.current?.getBoundingClientRect().top ?? 0;
  const absoluteY = clientY - containerTop + scrollTop;
  
  for (const boundary of dayBoundaries) {
    if (absoluteY >= boundary.topPx && absoluteY < boundary.bottomPx) {
      // Update target day and recalculate hour within this day's grid
      const hourWithinDay = startHourForDay + (absoluteY - boundary.topPx) / pixelsPerHour;
      // ...update dragState with targetDay and recalculated hours
      break;
    }
  }
}
```

### Midnight guard in Timeline.tsx snap/push

```typescript
// Helper to get calendar day string in trip timezone
const getDayKey = (isoTime: string) => {
  return getDateInTimezone(isoTime, tripTimezone)
    .toISOString().substring(0, 10);
};

// In SNAP phase:
for (const transport of data.created) {
  const transportDayKey = getDayKey(transport.end_time);
  const nextEntry = dayEnts.find((e) => {
    // Must be same calendar day
    if (getDayKey(e.start_time) !== transportDayKey) return false;
    // ...existing filters (not locked, not transfer, etc.)
  });
  // ...
}

// In CASCADE PUSH phase:
if (currentEnd > nextStart && !dayEnts[i + 1].is_locked) {
  const newStartTime = new Date(currentEnd).toISOString();
  // Guard: don't push across midnight
  if (getDayKey(newStartTime) !== getDayKey(dayEnts[i].start_time)) {
    continue; // skip, would cross into next day
  }
  // ...existing push/compress logic
}
```

### CalendarDay ref forwarding

```typescript
// CalendarDay.tsx - wrap the outer container with forwardRef
const CalendarDay = forwardRef<HTMLDivElement, CalendarDayProps>(({ ... }, ref) => {
  return (
    <div ref={ref} className="relative">
      {/* ...existing content */}
    </div>
  );
});
```

### Timeline.tsx - collecting day boundaries

```typescript
const dayRefs = useRef<Map<string, HTMLDivElement>>(new Map());

// After render, compute boundaries:
const dayBoundaries = useMemo(() => {
  if (!scrollRef.current) return [];
  const scrollRect = scrollRef.current.getBoundingClientRect();
  return days.map(day => {
    const key = format(day, 'yyyy-MM-dd');
    const el = dayRefs.current.get(key);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      dayDate: day,
      topPx: rect.top - scrollRect.top + scrollRef.current!.scrollTop,
      bottomPx: rect.bottom - scrollRect.top + scrollRef.current!.scrollTop,
    };
  }).filter(Boolean);
}, [days, entries]); // recalc when entries change (affects heights)
```


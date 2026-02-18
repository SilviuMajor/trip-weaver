

# Snap-to-Transport-End + Locked Card Walls During Drag

## Overview
Two real-time drag enhancements in `useDragResize.ts`, fed by computed snap targets and locked boundaries from `ContinuousTimeline.tsx`.

---

## Changes

### 1. Extend `useDragResize.ts` interfaces and options

Add two new interfaces and optional parameters to `UseDragResizeOptions`:

```typescript
export interface SnapTarget {
  globalHour: number;
  label: string;
}

export interface LockedBoundary {
  startGH: number;
  endGH: number;
  entryId: string;
}

interface UseDragResizeOptions {
  // ... existing
  snapTargets?: SnapTarget[];
  lockedBoundaries?: LockedBoundary[];
}
```

Destructure these in the hook function signature.

### 2. Add snap + wall logic in `handlePointerMove` (move branch, after grid snap)

After the existing grid snap (line 177) and boundary clamping (lines 180-183), insert two new passes in order:

**Pass A -- Transport endpoint magnetic snap (15-min threshold):**
```typescript
const SNAP_THRESHOLD_HOURS = 0.25;
if (snapTargets?.length) {
  for (const target of snapTargets) {
    if (Math.abs(newStart - target.globalHour) < SNAP_THRESHOLD_HOURS) {
      newStart = target.globalHour;
      newEnd = newStart + duration;
      break;
    }
  }
}
```

**Pass B -- Locked card wall clamping:**
```typescript
if (lockedBoundaries?.length) {
  for (const boundary of lockedBoundaries) {
    if (boundary.entryId === state.entryId) continue;
    if (newStart < boundary.endGH && newEnd > boundary.startGH) {
      const overlapFromAbove = state.originalStartHour <= boundary.startGH;
      if (overlapFromAbove) {
        newEnd = boundary.startGH;
        newStart = newEnd - duration;
      } else {
        newStart = boundary.endGH;
        newEnd = newStart + duration;
      }
    }
  }
}
```

**Haptic differentiation:** Change the existing `navigator.vibrate(1)` to use `8` when snapped to a transport target and `15` when hitting a locked wall. Track whether we hit a wall or snap target using simple boolean flags set during the passes.

Also add `snapTargets` and `lockedBoundaries` to the `useCallback` dependency array.

### 3. Compute `snapTargets` in `ContinuousTimeline.tsx`

Add a `useMemo` after the existing `isTransportEntry` helper (~line 499):

```typescript
const snapTargets = useMemo(() => {
  const targets: SnapTarget[] = [];
  for (const entry of sortedEntries) {
    if (!isTransportEntry(entry)) continue;
    const gh = getEntryGlobalHours(entry);
    targets.push({
      globalHour: gh.endGH,
      label: `After ${entry.options[0]?.name || 'transport'}`,
    });
  }
  return targets;
}, [sortedEntries, getEntryGlobalHours, isTransportEntry]);
```

### 4. Compute `lockedBoundaries` in `ContinuousTimeline.tsx`

Add another `useMemo` nearby:

```typescript
const lockedBoundaries = useMemo(() => {
  return sortedEntries
    .filter(e => e.is_locked && !e.linked_flight_id)
    .map(e => {
      const gh = getEntryGlobalHours(e);
      let startGH = gh.startGH;
      let endGH = gh.endGH;
      const group = flightGroupMap.get(e.id);
      if (group?.checkin) {
        const ciDur = (new Date(group.checkin.end_time).getTime() -
          new Date(group.checkin.start_time).getTime()) / 3600000;
        startGH -= ciDur;
      }
      if (group?.checkout) {
        const coDur = (new Date(group.checkout.end_time).getTime() -
          new Date(group.checkout.start_time).getTime()) / 3600000;
        endGH += coDur;
      }
      return { startGH, endGH, entryId: e.id };
    });
}, [sortedEntries, getEntryGlobalHours, flightGroupMap]);
```

### 5. Pass both into `useDragResize` call (~line 437)

```typescript
const { dragState, ... } = useDragResize({
  pixelsPerHour,
  startHour: 0,
  totalHours,
  gridTopPx,
  onCommit: handleDragCommit,
  scrollContainerRef,
  snapTargets,
  lockedBoundaries,
});
```

### 6. Visual feedback in `ContinuousTimeline.tsx` drag render section

**Green snap line** (when card is snapped to a transport endpoint):
```tsx
{dragState?.type === 'move' && snapTargets?.some(t =>
  Math.abs(dragState.currentStartHour - t.globalHour) < 0.01
) && (
  <div
    className="absolute left-0 right-0 h-0.5 bg-green-500/70 z-[51] pointer-events-none"
    style={{ top: dragState.currentStartHour * pixelsPerHour }}
  />
)}
```

**Red locked-wall indicator** (when card touches a locked card edge):
```tsx
{dragState && lockedBoundaries?.map(boundary => {
  const dragEnd = dragState.currentEndHour;
  const touchingTop = Math.abs(dragState.currentStartHour - boundary.endGH) < 0.02;
  const touchingBottom = Math.abs(dragEnd - boundary.startGH) < 0.02;
  if (!touchingTop && !touchingBottom) return null;
  return (
    <div
      key={boundary.entryId}
      className="absolute left-0 right-0 z-[49] pointer-events-none border-t-2 border-red-400/60"
      style={{
        top: (touchingTop ? boundary.endGH : boundary.startGH) * pixelsPerHour
      }}
    />
  );
})}
```

Both go in the drag overlay rendering section (~line 1745 area, "Stage 1" block).

### 7. Export new types from `useDragResize.ts`

Export `SnapTarget` and `LockedBoundary` so ContinuousTimeline can import them for type safety.

---

## Files Modified
- `src/hooks/useDragResize.ts` -- new interfaces, snap + wall logic in handlePointerMove
- `src/components/timeline/ContinuousTimeline.tsx` -- compute snapTargets and lockedBoundaries, pass to hook, render visual indicators

## What Is NOT Changed
- `handleSnapRelease` / `handleEntryTimeChange` in Timeline.tsx (these handle post-drop logic, not drag-time)
- Edge functions
- EntryCard rendering

## Testing
- Drag a card near a transport connector's end -- should magnetically snap with green line and stronger haptic
- Move away from snap zone -- should release back to normal 5-min grid
- Lock a card and drag an adjacent card toward it -- should stop at the edge with red indicator and haptic
- Lock a flight group -- drag should stop at checkin start or checkout end
- Drag between two locked cards -- constrained to the gap
- Test on mobile with long-press drag


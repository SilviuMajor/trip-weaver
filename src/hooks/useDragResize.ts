import { useState, useRef, useCallback, useEffect } from 'react';

export type DragType = 'move' | 'resize-top' | 'resize-bottom';

export interface SnapTarget {
  globalHour: number;
  label: string;
}

export interface LockedBoundary {
  startGH: number;
  endGH: number;
  entryId: string;
}

interface DragState {
  entryId: string;
  type: DragType;
  startY: number;
  originalStartHour: number;
  originalEndHour: number;
  currentStartHour: number;
  currentEndHour: number;
  tz?: string;
  /** Offset in hours between cursor position and card top at grab time */
  grabOffsetHours: number;
  // 2D tracking for unified lift-and-place
  startClientX: number;
  startClientY: number;
  currentClientX: number;
  currentClientY: number;
}

interface UseDragResizeOptions {
  pixelsPerHour: number;
  startHour: number;
  totalHours: number;
  gridTopPx: number;
  onCommit: (entryId: string, newStartHour: number, newEndHour: number, tz?: string, targetDay?: Date, dragType?: DragType, clientX?: number, clientY?: number) => void;
  scrollContainerRef?: React.RefObject<HTMLElement>;
  snapTargets?: SnapTarget[];
  lockedBoundaries?: LockedBoundary[];
}

const SNAP_MINUTES = 5;
const TOUCH_HOLD_MS = 400;
const TOUCH_MOVE_THRESHOLD = 10;

// Auto-scroll constants
const EDGE_ZONE = 80; // px from edge
const MIN_SPEED = 200; // px/s
const MAX_SPEED = 800; // px/s

function snapToGrid(hour: number): number {
  const totalMinutes = hour * 60;
  const snapped = Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES;
  return snapped / 60;
}

export function useDragResize({ pixelsPerHour, startHour, totalHours, gridTopPx, onCommit, scrollContainerRef, snapTargets, lockedBoundaries }: UseDragResizeOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const wasDraggedRef = useRef(false);
  const dragStateRef = useRef<DragState | null>(null);
  const lastClientYRef = useRef(0);
  const scrollRafRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const clientXRef = useRef(0);
  const clientYRef = useRef(0);

  // Keep ref in sync
  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  // Auto-scroll loop
  const autoScrollLoop = useCallback((timestamp: number) => {
    if (!isDraggingRef.current || !scrollContainerRef?.current) return;

    const dt = lastFrameRef.current === 0 ? 0.016 : (timestamp - lastFrameRef.current) / 1000;
    lastFrameRef.current = timestamp;

    const container = scrollContainerRef.current;
    const rect = container.getBoundingClientRect();
    const clientY = lastClientYRef.current;

    const distBottom = rect.bottom - clientY;
    const distTop = clientY - rect.top;

    if (distBottom < EDGE_ZONE && distBottom > 0) {
      const ratio = 1 - distBottom / EDGE_ZONE;
      container.scrollTop += (MIN_SPEED + ratio * (MAX_SPEED - MIN_SPEED)) * dt;
    } else if (distTop < EDGE_ZONE && distTop > 0) {
      const ratio = 1 - distTop / EDGE_ZONE;
      container.scrollTop -= (MIN_SPEED + ratio * (MAX_SPEED - MIN_SPEED)) * dt;
    }

    scrollRafRef.current = requestAnimationFrame(autoScrollLoop);
  }, [scrollContainerRef]);

  const startAutoScroll = useCallback(() => {
    if (!scrollContainerRef?.current) return;
    lastFrameRef.current = 0;
    scrollRafRef.current = requestAnimationFrame(autoScrollLoop);
  }, [autoScrollLoop, scrollContainerRef]);

  const stopAutoScroll = useCallback(() => {
    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = 0;
    }
  }, []);

  const startDrag = useCallback((
    entryId: string,
    type: DragType,
    clientX: number,
    clientY: number,
    entryStartHour: number,
    entryEndHour: number,
    tz?: string,
  ) => {
    // Compute grab offset in the single global coordinate space
    let grabOffsetHours = 0;
    if (scrollContainerRef?.current) {
      const container = scrollContainerRef.current;
      const containerRect = container.getBoundingClientRect();
      const absoluteY = clientY - containerRect.top + container.scrollTop;
      const relativeY = absoluteY - gridTopPx;
      const cursorHour = startHour + relativeY / pixelsPerHour;
      grabOffsetHours = cursorHour - entryStartHour;
    }

    const state: DragState = {
      entryId,
      type,
      startY: clientY,
      originalStartHour: entryStartHour,
      originalEndHour: entryEndHour,
      currentStartHour: entryStartHour,
      currentEndHour: entryEndHour,
      tz,
      grabOffsetHours,
      startClientX: clientX,
      startClientY: clientY,
      currentClientX: clientX,
      currentClientY: clientY,
    };
    setDragState(state);
    dragStateRef.current = state;
    isDraggingRef.current = true;
    wasDraggedRef.current = false;
    lastClientYRef.current = clientY;
    clientXRef.current = clientX;
    clientYRef.current = clientY;
    startAutoScroll();
  }, [startAutoScroll, scrollContainerRef, startHour, pixelsPerHour, gridTopPx]);

  const handlePointerMove = useCallback((clientX: number, clientY: number) => {
    const state = dragStateRef.current;
    if (!state) return;

    lastClientYRef.current = clientY;

    // Update 2D position
    state.currentClientX = clientX;
    state.currentClientY = clientY;

    // Flag as dragged if movement exceeds 5px in any direction
    if (!wasDraggedRef.current) {
      const dx = clientX - state.startClientX;
      const dy = clientY - state.startClientY;
      if (Math.hypot(dx, dy) > 5) {
        wasDraggedRef.current = true;
      }
    }

    // Single global coordinate space
    if (scrollContainerRef?.current) {
      const container = scrollContainerRef.current;
      const containerRect = container.getBoundingClientRect();
      const absoluteY = clientY - containerRect.top + container.scrollTop;
      const relativeY = absoluteY - gridTopPx;
      const duration = state.originalEndHour - state.originalStartHour;

      if (state.type === 'move') {
        const rawHour = startHour + relativeY / pixelsPerHour - state.grabOffsetHours;
        let newStart = snapToGrid(rawHour);
        let newEnd = newStart + duration;

        if (newStart < 0) { newEnd -= newStart; newStart = 0; }
        if (newEnd > totalHours) { newStart -= (newEnd - totalHours); newEnd = totalHours; }
        newStart = Math.max(0, newStart);
        newEnd = Math.min(totalHours, newEnd);

        // Pass A: Magnetic snap to transport endpoints (15-min threshold)
        let snappedToTarget = false;
        const SNAP_THRESHOLD_HOURS = 0.25;
        if (snapTargets?.length) {
          for (const target of snapTargets) {
            if (Math.abs(newStart - target.globalHour) < SNAP_THRESHOLD_HOURS) {
              newStart = target.globalHour;
              newEnd = newStart + duration;
              snappedToTarget = true;
              break;
            }
          }
        }

        // Pass B: Locked card wall clamping
        let hitWall = false;
        if (lockedBoundaries?.length) {
          for (const boundary of lockedBoundaries) {
            if (boundary.entryId === state.entryId) continue;
            if (newStart < boundary.endGH && newEnd > boundary.startGH) {
              hitWall = true;
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

        // Always update pixel-position refs (read by RAF loop, no re-render)
        clientXRef.current = clientX;
        clientYRef.current = clientY;

        // Check if drag phase would change (horizontal threshold crossing)
        const horizontalDist = Math.abs(clientX - state.startClientX);
        const vw = window.innerWidth;
        const isMobileDevice = vw < 768;
        const phaseThreshold = isMobileDevice ? Math.max(15, vw * 0.04) : Math.max(40, vw * 0.04);
        const wasDetached = Math.abs(state.currentClientX - state.startClientX) > phaseThreshold;
        const isDetached = horizontalDist > phaseThreshold;

        // Only trigger React re-render when snapped position or phase changes
        if (newStart !== state.currentStartHour || newEnd !== state.currentEndHour || wasDetached !== isDetached) {
          // Haptic tick: differentiate snap vs wall vs normal
          if (newStart !== state.currentStartHour || newEnd !== state.currentEndHour) {
            if (navigator.vibrate) navigator.vibrate(hitWall ? 15 : snappedToTarget ? 8 : 1);
          }
          const updated: DragState = {
            ...state,
            currentStartHour: newStart,
            currentEndHour: newEnd,
            currentClientX: clientX,
            currentClientY: clientY,
          };
          setDragState(updated);
          dragStateRef.current = updated;
        }
        return;
      } else if (state.type === 'resize-top') {
        const rawHour = startHour + relativeY / pixelsPerHour;
        let newStart = snapToGrid(rawHour);
        let newEnd = state.originalEndHour;
        if (newStart >= newEnd - 0.25) newStart = newEnd - 0.25;
        if (newStart < 0) newStart = 0;

        if (newStart !== state.currentStartHour) {
          if (navigator.vibrate) navigator.vibrate(1);
        }
        const updated: DragState = { ...state, currentStartHour: newStart, currentEndHour: newEnd };
        setDragState(updated);
        dragStateRef.current = updated;
        clientXRef.current = clientX;
        clientYRef.current = clientY;
        return;
      } else if (state.type === 'resize-bottom') {
        let newStart = state.originalStartHour;
        const rawHour = startHour + relativeY / pixelsPerHour;
        let newEnd = snapToGrid(rawHour);
        if (newEnd <= newStart + 0.25) newEnd = newStart + 0.25;
        if (newEnd > totalHours) newEnd = totalHours;

        if (newEnd !== state.currentEndHour) {
          if (navigator.vibrate) navigator.vibrate(1);
        }
        const updated: DragState = { ...state, currentStartHour: newStart, currentEndHour: newEnd };
        setDragState(updated);
        dragStateRef.current = updated;
        clientXRef.current = clientX;
        clientYRef.current = clientY;
        return;
      }
    }

  }, [pixelsPerHour, startHour, totalHours, scrollContainerRef, gridTopPx, snapTargets, lockedBoundaries]);

  const commitDrag = useCallback(() => {
    const state = dragStateRef.current;
    if (state && wasDraggedRef.current) {
      onCommit(state.entryId, state.currentStartHour, state.currentEndHour, state.tz, undefined, state.type, state.currentClientX, state.currentClientY);
    }
    stopAutoScroll();
    setDragState(null);
    dragStateRef.current = null;
    isDraggingRef.current = false;
    setTimeout(() => { wasDraggedRef.current = false; }, 150);
  }, [onCommit, stopAutoScroll]);

  // Refs that always point to latest handlePointerMove and commitDrag
  const handlePointerMoveRef = useRef(handlePointerMove);
  const commitDragRef = useRef(commitDrag);

  useEffect(() => {
    handlePointerMoveRef.current = handlePointerMove;
  }, [handlePointerMove]);

  useEffect(() => {
    commitDragRef.current = commitDrag;
  }, [commitDrag]);

  // Mouse handlers
  const onMouseDown = useCallback((
    e: React.MouseEvent,
    entryId: string,
    type: DragType,
    entryStartHour: number,
    entryEndHour: number,
    tz?: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    startDrag(entryId, type, e.clientX, e.clientY, entryStartHour, entryEndHour, tz);
  }, [startDrag]);

  // Touch: hold-to-drag — lets browser scroll natively during hold window
  const onTouchStart = useCallback((
    e: React.TouchEvent,
    entryId: string,
    type: DragType,
    entryStartHour: number,
    entryEndHour: number,
    tz?: string,
  ) => {
    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    touchStartPosRef.current = { x: startX, y: startY };

    let holdCancelled = false;
    let dragListenersAttached = false;

    // Phase 1 listener — lightweight, passive, just checks if finger moved
    // Browser scrolling works normally during this phase
    const checkMovement = (ev: TouchEvent) => {
      if (holdCancelled) return;
      const t = ev.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.sqrt(dx * dx + dy * dy) > TOUCH_MOVE_THRESHOLD) {
        // User is scrolling — cancel the hold timer
        holdCancelled = true;
        if (touchTimerRef.current) {
          clearTimeout(touchTimerRef.current);
          touchTimerRef.current = null;
        }
      }
    };

    // Phase 2 listener — non-passive, attached only after hold fires
    const handleDragMove = (ev: TouchEvent) => {
      ev.preventDefault();
      const t = ev.touches[0];
      handlePointerMoveRef.current(t.clientX, t.clientY);
    };

    const handleTouchEnd = () => {
      if (isDraggingRef.current) {
        commitDragRef.current();
      }
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current);
        touchTimerRef.current = null;
      }
      touchStartPosRef.current = null;
      cleanup();
    };

    const cleanup = () => {
      document.removeEventListener('touchmove', checkMovement);
      if (dragListenersAttached) {
        document.removeEventListener('touchmove', handleDragMove);
      }
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
    };

    // Attach Phase 1: passive listener (allows browser scroll)
    document.addEventListener('touchmove', checkMovement, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchEnd);

    // Hold timer — if finger stays still for TOUCH_HOLD_MS, start dragging
    touchTimerRef.current = setTimeout(() => {
      touchTimerRef.current = null;
      if (!holdCancelled) {
        // Remove passive listener, attach non-passive drag listener
        document.removeEventListener('touchmove', checkMovement);
        document.addEventListener('touchmove', handleDragMove, { passive: false });
        dragListenersAttached = true;

        startDrag(entryId, type, startX, startY, entryStartHour, entryEndHour, tz);
        if (navigator.vibrate) navigator.vibrate(20);
      }
    }, TOUCH_HOLD_MS);
  }, [startDrag]);

  // Safety-net React handlers
  const onTouchMove = useCallback((_e: React.TouchEvent) => {}, []);
  const onTouchEnd = useCallback(() => {}, []);

  // Mouse-only listeners during active drag
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      handlePointerMove(e.clientX, e.clientY);
    };
    const handleMouseUp = () => {
      commitDrag();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, handlePointerMove, commitDrag]);

  // Cleanup auto-scroll on unmount
  useEffect(() => {
    return () => { stopAutoScroll(); };
  }, [stopAutoScroll]);

  return {
    dragState,
    isDragging: isDraggingRef.current,
    wasDraggedRef,
    clientXRef,
    clientYRef,
    onMouseDown,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}

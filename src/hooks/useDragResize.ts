import { useState, useRef, useCallback, useEffect } from 'react';

export type DragType = 'move' | 'resize-top' | 'resize-bottom';

interface DragState {
  entryId: string;
  type: DragType;
  startY: number;
  originalStartHour: number;
  originalEndHour: number;
  currentStartHour: number;
  currentEndHour: number;
}

interface UseDragResizeOptions {
  pixelsPerHour: number;
  startHour: number;
  onCommit: (entryId: string, newStartHour: number, newEndHour: number) => void;
}

const SNAP_MINUTES = 15;
const TOUCH_HOLD_MS = 200;
const TOUCH_MOVE_THRESHOLD = 10;

function snapToGrid(hour: number): number {
  const totalMinutes = hour * 60;
  const snapped = Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES;
  return snapped / 60;
}

export function useDragResize({ pixelsPerHour, startHour, onCommit }: UseDragResizeOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStateRef = useRef<DragState | null>(null);

  // Keep ref in sync
  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  const startDrag = useCallback((
    entryId: string,
    type: DragType,
    clientY: number,
    entryStartHour: number,
    entryEndHour: number,
  ) => {
    const state: DragState = {
      entryId,
      type,
      startY: clientY,
      originalStartHour: entryStartHour,
      originalEndHour: entryEndHour,
      currentStartHour: entryStartHour,
      currentEndHour: entryEndHour,
    };
    setDragState(state);
    dragStateRef.current = state;
    isDraggingRef.current = true;
  }, []);

  const handlePointerMove = useCallback((clientY: number) => {
    const state = dragStateRef.current;
    if (!state) return;

    const deltaPixels = clientY - state.startY;
    const deltaHours = deltaPixels / pixelsPerHour;

    let newStart = state.originalStartHour;
    let newEnd = state.originalEndHour;

    if (state.type === 'move') {
      const duration = state.originalEndHour - state.originalStartHour;
      newStart = snapToGrid(state.originalStartHour + deltaHours);
      newEnd = newStart + duration;
    } else if (state.type === 'resize-top') {
      newStart = snapToGrid(state.originalStartHour + deltaHours);
      newEnd = state.originalEndHour;
      if (newStart >= newEnd - 0.25) newStart = newEnd - 0.25; // min 15min
    } else if (state.type === 'resize-bottom') {
      newStart = state.originalStartHour;
      newEnd = snapToGrid(state.originalEndHour + deltaHours);
      if (newEnd <= newStart + 0.25) newEnd = newStart + 0.25;
    }

    // Clamp to valid range
    if (newStart < 0) { newEnd -= newStart; newStart = 0; }
    if (newEnd > 24) { newStart -= (newEnd - 24); newEnd = 24; }

    const updated = { ...state, currentStartHour: newStart, currentEndHour: newEnd };
    setDragState(updated);
    dragStateRef.current = updated;
  }, [pixelsPerHour]);

  const commitDrag = useCallback(() => {
    const state = dragStateRef.current;
    if (state) {
      onCommit(state.entryId, state.currentStartHour, state.currentEndHour);
    }
    setDragState(null);
    dragStateRef.current = null;
    // Delay resetting so click handlers can check
    setTimeout(() => { isDraggingRef.current = false; }, 50);
  }, [onCommit]);

  // Mouse handlers
  const onMouseDown = useCallback((
    e: React.MouseEvent,
    entryId: string,
    type: DragType,
    entryStartHour: number,
    entryEndHour: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    startDrag(entryId, type, e.clientY, entryStartHour, entryEndHour);
  }, [startDrag]);

  // Touch handlers with hold-to-drag
  const onTouchStart = useCallback((
    e: React.TouchEvent,
    entryId: string,
    type: DragType,
    entryStartHour: number,
    entryEndHour: number,
  ) => {
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    
    touchTimerRef.current = setTimeout(() => {
      startDrag(entryId, type, touch.clientY, entryStartHour, entryEndHour);
    }, TOUCH_HOLD_MS);
  }, [startDrag]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const startPos = touchStartPosRef.current;
    
    // Cancel hold if moved too much before activation
    if (!isDraggingRef.current && startPos && touchTimerRef.current) {
      const dx = touch.clientX - startPos.x;
      const dy = touch.clientY - startPos.y;
      if (Math.sqrt(dx * dx + dy * dy) > TOUCH_MOVE_THRESHOLD) {
        clearTimeout(touchTimerRef.current);
        touchTimerRef.current = null;
        return;
      }
    }

    if (isDraggingRef.current) {
      e.preventDefault();
      handlePointerMove(touch.clientY);
    }
  }, [handlePointerMove]);

  const onTouchEnd = useCallback(() => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    touchStartPosRef.current = null;
    if (isDraggingRef.current) {
      commitDrag();
    }
  }, [commitDrag]);

  // Global mouse listeners
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      handlePointerMove(e.clientY);
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

  return {
    dragState,
    isDragging: isDraggingRef.current,
    onMouseDown,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}

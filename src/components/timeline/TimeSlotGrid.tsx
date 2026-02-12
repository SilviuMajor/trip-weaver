import { useState, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { localToUTC } from '@/lib/timezoneUtils';

interface FlightTzInfo {
  originTz: string;
  destinationTz: string;
  flightStartHour: number;
  flightEndHour: number;
}

interface TimeSlotGridProps {
  startHour: number;
  endHour: number;
  pixelsPerHour: number;
  date: Date;
  onClickSlot?: (isoTime: string) => void;
  onDragSlot?: (startIso: string, endIso: string) => void;
  activeTz?: string;
  flights?: FlightTzInfo[];
}

const SNAP_MINUTES = 15;

function snapMinutes(totalMinutes: number): number {
  return Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES;
}


const TimeSlotGrid = ({
  startHour,
  endHour,
  pixelsPerHour,
  date,
  onClickSlot,
  onDragSlot,
  activeTz,
  flights = [],
}: TimeSlotGridProps) => {
  const hours: number[] = [];
  for (let h = startHour; h < endHour; h++) {
    hours.push(h);
  }


  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const yToMinutes = useCallback((y: number): number => {
    const minutesFromStart = (y / pixelsPerHour) * 60;
    return startHour * 60 + minutesFromStart;
  }, [pixelsPerHour, startHour]);

  const minutesToIso = useCallback((totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const dateStr = format(date, 'yyyy-MM-dd');
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return localToUTC(dateStr, timeStr, activeTz || 'UTC');
  }, [date, activeTz]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onClickSlot && !onDragSlot) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = snapMinutes(yToMinutes(y));
    setDragStart(minutes);
    setDragEnd(minutes);
    isDraggingRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragStart === null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = snapMinutes(yToMinutes(y));
    if (Math.abs(minutes - dragStart) > 5) {
      isDraggingRef.current = true;
    }
    setDragEnd(minutes);
  };

  const handleMouseUp = () => {
    if (dragStart === null) return;

    if (isDraggingRef.current && onDragSlot && dragEnd !== null) {
      const s = Math.min(dragStart, dragEnd);
      const e = Math.max(dragStart, dragEnd);
      if (e - s >= SNAP_MINUTES) {
        onDragSlot(minutesToIso(s), minutesToIso(e));
      }
    } else if (onClickSlot) {
      onClickSlot(minutesToIso(dragStart));
    }

    setDragStart(null);
    setDragEnd(null);
    isDraggingRef.current = false;
  };

  // Preview block during drag
  const renderPreview = () => {
    if (dragStart === null || dragEnd === null || !isDraggingRef.current) return null;
    const s = Math.min(dragStart, dragEnd);
    const e = Math.max(dragStart, dragEnd);
    if (e - s < SNAP_MINUTES) return null;

    const top = ((s - startHour * 60) / 60) * pixelsPerHour;
    const height = ((e - s) / 60) * pixelsPerHour;

    const sH = Math.floor(s / 60);
    const sM = s % 60;
    const eH = Math.floor(e / 60);
    const eM = e % 60;
    const label = `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')} – ${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`;

    return (
      <div
        className="pointer-events-none absolute left-0 right-0 z-[12] rounded-lg border-2 border-dashed border-primary/50 bg-primary/10"
        style={{ top, height }}
      >
        <span className="absolute left-2 top-1 select-none text-xs font-medium text-primary">
          {label}
        </span>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        if (dragStart !== null) {
          setDragStart(null);
          setDragEnd(null);
          isDraggingRef.current = false;
        }
      }}
    >
      {hours.map(hour => {
        const displayHour = `${String(hour).padStart(2, '0')}:00`;

        return (
          <div
            key={hour}
            className="absolute left-0 right-0 border-t border-border/30"
            style={{ top: (hour - startHour) * pixelsPerHour }}
          >
            <span className="absolute -top-2.5 z-[15] select-none text-[10px] font-medium text-muted-foreground/50 text-center" style={{ left: -46, width: 30 }}>
              {displayHour}
            </span>
          </div>
        );
      })}

      {renderPreview()}
    </div>
  );
};



export default TimeSlotGrid;

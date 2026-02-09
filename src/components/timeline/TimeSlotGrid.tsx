import { useState, useRef, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';

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
  onClickSlot?: (time: Date) => void;
  onDragSlot?: (startTime: Date, endTime: Date) => void;
  activeTz?: string;
  flights?: FlightTzInfo[];
}

const SNAP_MINUTES = 15;
const OVERLAP_HOURS = 1.5;

function snapMinutes(totalMinutes: number): number {
  return Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES;
}

function getTzAbbr(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value ?? tz.split('/').pop() ?? tz;
  } catch {
    return tz.split('/').pop() ?? tz;
  }
}

function formatHourInTz(hour: number, minute: number, tz: string, refDate: Date): string {
  // Create a date at the given hour in UTC-ish, then format in the target TZ
  // For the gutter we just show the hour label offset by TZ difference
  const h = Math.floor(hour);
  const m = minute;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

  const hasDualTz = flights.length > 0;

  // Compute visibility ranges for each timezone column
  const tzRanges = useMemo(() => {
    if (!hasDualTz) return null;

    // For each flight, compute when origin fades out and destination fades in
    return flights.map(f => ({
      ...f,
      overlapStart: f.flightStartHour - OVERLAP_HOURS,
      overlapEnd: f.flightEndHour + OVERLAP_HOURS,
      originAbbr: getTzAbbr(f.originTz),
      destAbbr: getTzAbbr(f.destinationTz),
    }));
  }, [flights, hasDualTz]);

  // Determine TZ display state at a given hour
  type TzState = 'single-origin' | 'dual' | 'single-dest';
  const getTzStateAtHour = useCallback((hour: number): TzState => {
    if (!tzRanges || tzRanges.length === 0) return 'single-origin';
    const r = tzRanges[0];
    if (hour < r.overlapStart) return 'single-origin';
    if (hour > r.overlapEnd) return 'single-dest';
    return 'dual';
  }, [tzRanges]);

  // Compute TZ offset in hours between two timezones
  const getTzOffsetHours = useCallback((originTz: string, destTz: string): number => {
    try {
      const now = new Date();
      const originOffset = getUtcOffsetMinutes(now, originTz);
      const destOffset = getUtcOffsetMinutes(now, destTz);
      return (destOffset - originOffset) / 60;
    } catch {
      return 0;
    }
  }, []);

  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const yToMinutes = useCallback((y: number): number => {
    const minutesFromStart = (y / pixelsPerHour) * 60;
    return startHour * 60 + minutesFromStart;
  }, [pixelsPerHour, startHour]);

  const minutesToTime = useCallback((totalMinutes: number): Date => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const time = new Date(date);
    time.setHours(h, m, 0, 0);
    return time;
  }, [date]);

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
        onDragSlot(minutesToTime(s), minutesToTime(e));
      }
    } else if (onClickSlot) {
      onClickSlot(minutesToTime(dragStart));
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

  // Render the overlap gradient background
  const renderOverlapBg = () => {
    if (!tzRanges || tzRanges.length === 0) return null;
    const r = tzRanges[0];
    const overlapStart = r.overlapStart;
    const overlapEnd = r.overlapEnd;

    if (overlapStart >= endHour || overlapEnd <= startHour) return null;

    const clampedStart = Math.max(overlapStart, startHour);
    const clampedEnd = Math.min(overlapEnd, endHour);
    const top = (clampedStart - startHour) * pixelsPerHour;
    const height = (clampedEnd - clampedStart) * pixelsPerHour;

    return (
      <div
        className="pointer-events-none absolute left-0 right-0 z-[1] bg-gradient-to-b from-primary/5 via-primary/8 to-primary/5"
        style={{ top, height }}
      />
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
      {renderOverlapBg()}

      {hours.map(hour => {
        const tzState = hasDualTz ? getTzStateAtHour(hour) : null;
        const tzOffset = hasDualTz && tzRanges?.[0]
          ? getTzOffsetHours(tzRanges[0].originTz, tzRanges[0].destinationTz)
          : 0;
        const destHour = hour + tzOffset;
        const destH = ((Math.floor(destHour) % 24) + 24) % 24;
        const destM = Math.round((destHour % 1) * 60);

        return (
          <div
            key={hour}
            className="absolute left-0 right-0 border-t border-border/30"
            style={{ top: (hour - startHour) * pixelsPerHour }}
          >
            {hasDualTz && tzState === 'dual' ? (
              <div className="absolute -top-2.5 z-[15] flex select-none items-center" style={{ left: -58, width: 52 }}>
                <span className="flex-1 text-center text-[9px] font-medium text-muted-foreground">
                  {String(hour).padStart(2, '0')}:00
                </span>
                <span className="h-3 w-px bg-border/60" />
                <span className="flex-1 text-center text-[9px] font-medium text-primary/70">
                  {String(destH).padStart(2, '0')}:{String(destM).padStart(2, '0')}
                </span>
              </div>
            ) : hasDualTz && tzState === 'single-dest' ? (
              <span className="absolute -top-2.5 z-[15] select-none text-[10px] font-medium text-muted-foreground/50 text-center" style={{ left: -36, width: 30 }}>
                {String(destH).padStart(2, '0')}:{String(destM).padStart(2, '0')}
              </span>
            ) : (
              <span className="absolute -top-2.5 z-[15] select-none text-[10px] font-medium text-muted-foreground/50 text-center" style={{ left: -36, width: 30 }}>
                {String(hour).padStart(2, '0')}:00
              </span>
            )}
          </div>
        );
      })}


      {renderPreview()}
    </div>
  );
};

function getUtcOffsetMinutes(date: Date, tz: string): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = date.toLocaleString('en-US', { timeZone: tz });
  return (new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 60000;
}

export default TimeSlotGrid;

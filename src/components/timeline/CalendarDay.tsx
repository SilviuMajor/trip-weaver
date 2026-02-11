import { useCallback, useMemo, useState, forwardRef } from 'react';
import { format, isToday, isPast, addMinutes } from 'date-fns';
import { calculateSunTimes } from '@/lib/sunCalc';
import type { EntryWithOptions, EntryOption, TravelSegment, WeatherData } from '@/types/trip';
import { cn } from '@/lib/utils';
import { haversineKm } from '@/lib/distance';
import { localToUTC, getHourInTimezone, resolveEntryTz } from '@/lib/timezoneUtils';
import { computeOverlapLayout } from '@/lib/overlapLayout';
import { Plus, Bus, Lock, LockOpen } from 'lucide-react';
import { useDragResize } from '@/hooks/useDragResize';
import TimeSlotGrid, { getUtcOffsetHoursDiff } from './TimeSlotGrid';
import EntryCard from './EntryCard';
import FlightGroupCard from './FlightGroupCard';
import TravelSegmentCard from './TravelSegmentCard';
import WeatherBadge from './WeatherBadge';
import { toast } from 'sonner';

const PIXELS_PER_HOUR = 80;

interface FlightTzInfo {
  originTz: string;
  destinationTz: string;
  flightStartHour: number;
  flightEndHour: number;
  flightEndUtc?: string;
}

interface DayBoundary {
  dayDate: Date;
  topPx: number;
  bottomPx: number;
}

interface CalendarDayProps {
  date: Date;
  entries: EntryWithOptions[];
  allEntries?: EntryWithOptions[];
  formatTime: (iso: string) => string;
  tripTimezone: string;
  userLat: number | null;
  userLng: number | null;
  votingLocked: boolean;
  userId: string | undefined;
  userVotes: string[];
  onVoteChange: () => void;
  onCardTap: (entry: EntryWithOptions, option: EntryOption) => void;
  travelSegments?: TravelSegment[];
  weatherData?: WeatherData[];
  onClickSlot?: (isoTime: string) => void;
  onDragSlot?: (startIso: string, endIso: string) => void;
  dayLabel?: string;
  dayIndex?: number;
  isFirstDay?: boolean;
  isLastDay?: boolean;
  onAddBetween?: (prefillTime: string) => void;
  onAddTransport?: (fromEntryId: string, toEntryId: string, prefillTime: string) => void;
  onEntryTimeChange?: (entryId: string, newStartIso: string, newEndIso: string) => Promise<void>;
  onDropFromPanel?: (entryId: string, hourOffset: number) => void;
  dayFlights?: FlightTzInfo[];
  activeTz?: string;
  isEditor?: boolean;
  onToggleLock?: (entryId: string, currentLocked: boolean) => void;
  scrollContainerRef?: React.RefObject<HTMLElement>;
  dayBoundaries?: DayBoundary[];
}

// resolveEntryTz and getHourInTimezone are now imported from @/lib/timezoneUtils

const CalendarDay = forwardRef<HTMLDivElement, CalendarDayProps>(({
  date: dayDate,
  entries,
  allEntries = [],
  formatTime,
  tripTimezone,
  userLat,
  userLng,
  votingLocked,
  userId,
  userVotes,
  onVoteChange,
  onCardTap,
  travelSegments = [],
  weatherData = [],
  onClickSlot,
  onDragSlot,
  dayLabel,
  dayIndex,
  isFirstDay,
  isLastDay,
  onAddBetween,
  onAddTransport,
  onEntryTimeChange,
  onDropFromPanel,
  dayFlights = [],
  activeTz,
  isEditor,
  onToggleLock,
  scrollContainerRef,
  dayBoundaries,
}, ref) => {
  const isUndated = !!dayLabel;
  const today = !isUndated && isToday(dayDate);
  const dayPast = !isUndated && isPast(dayDate) && !today;

  const sortedEntries = [...entries].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  // Show full 24-hour day
  const startHour = 0;
  const endHour = 24;

  const totalHours = endHour - startHour;
  const containerHeight = totalHours * PIXELS_PER_HOUR;

  // Drag-to-resize/move
  const handleDragCommit = useCallback((entryId: string, newStartHour: number, newEndHour: number, tz?: string, targetDay?: Date) => {
    if (!onEntryTimeChange) return;
    const entry = sortedEntries.find(e => e.id === entryId);
    if (entry?.is_locked) return;

    const effectiveDay = targetDay || dayDate;
    const dateStr = format(effectiveDay, 'yyyy-MM-dd');

    const toTimeStr = (hour: number) => {
      const minutes = Math.round(hour * 60);
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    // For flights, use departure_tz for start and arrival_tz for end
    const primaryOpt = entry?.options[0];
    const isFlight = primaryOpt?.category === 'flight' && primaryOpt?.departure_tz && primaryOpt?.arrival_tz;
    const startTz = isFlight ? primaryOpt.departure_tz! : (tz || activeTz || tripTimezone);
    const endTz = isFlight ? primaryOpt.arrival_tz! : startTz;

    const newStartIso = localToUTC(dateStr, toTimeStr(newStartHour), startTz);
    const newEndIso = localToUTC(dateStr, toTimeStr(newEndHour), endTz);
    onEntryTimeChange(entryId, newStartIso, newEndIso);

    // Move linked processing entries if this is a flight
    if (entry) {
      const linkedOpt = entry.options[0];
      const linkedEntries = allEntries.filter(e => e.linked_flight_id === entry.id);
      const fallbackTz = tz || activeTz || tripTimezone;

      linkedEntries.forEach(linked => {
        // Check-in uses departure TZ, checkout uses arrival TZ
        const linkedTz = linked.linked_type === 'checkin'
          ? (linkedOpt?.departure_tz || fallbackTz)
          : (linkedOpt?.arrival_tz || fallbackTz);

        const linkedStartHour = getHourInTimezone(linked.start_time, linkedTz);
        const linkedEndHour = getHourInTimezone(linked.end_time, linkedTz);
        const duration = linkedEndHour - linkedStartHour;

        let newLinkedStart: number;
        let newLinkedEnd: number;

        if (linked.linked_type === 'checkin') {
          newLinkedEnd = newStartHour;
          newLinkedStart = newLinkedEnd - duration;
        } else {
          newLinkedStart = newEndHour;
          newLinkedEnd = newLinkedStart + duration;
        }

        onEntryTimeChange(
          linked.id,
          localToUTC(dateStr, toTimeStr(newLinkedStart), linkedTz),
          localToUTC(dateStr, toTimeStr(newLinkedEnd), linkedTz),
        );
      });
    }
  }, [onEntryTimeChange, dayDate, tripTimezone, activeTz, sortedEntries, allEntries]);

  const { dragState, wasDraggedRef, onMouseDown, onTouchStart, onTouchMove, onTouchEnd } = useDragResize({
    pixelsPerHour: PIXELS_PER_HOUR,
    startHour,
    onCommit: handleDragCommit,
    scrollContainerRef,
    dayBoundaries,
  });

  // Locked-entry drag feedback
  const [shakeEntryId, setShakeEntryId] = useState<string | null>(null);
  const handleLockedAttempt = useCallback((entryId: string) => {
    toast.error('Cannot drag a locked event');
    setShakeEntryId(entryId);
    setTimeout(() => setShakeEntryId(null), 400);
  }, []);

  // Compute overlap layout
  const layoutEntries = sortedEntries.map(e => {
    const { startTz, endTz } = resolveEntryTz(e, dayFlights, activeTz, tripTimezone);
    const opt = e.options[0];
    const isFlight = opt?.category === 'flight' && opt.departure_tz && opt.arrival_tz;
    const sHour = getHourInTimezone(e.start_time, startTz);
    let eHour: number;
    if (isFlight) {
      const utcDurH = (new Date(e.end_time).getTime() - new Date(e.start_time).getTime()) / 3600000;
      eHour = sHour + utcDurH;
    } else {
      eHour = getHourInTimezone(e.end_time, endTz);
    }
    const s = (sHour - startHour) * 60;
    let en = (eHour - startHour) * 60;
    if (en <= s) en = s + 120;
    return { id: e.id, startMinutes: s, endMinutes: en };
  });

  const layout = computeOverlapLayout(layoutEntries);
  const layoutMap = new Map(layout.map(l => [l.entryId, l]));

  // Compute pairwise overlaps for consecutive entries
  const overlapMap = useMemo(() => {
    const map = new Map<string, { minutes: number; position: 'top' | 'bottom' }>();
    for (let i = 0; i < sortedEntries.length - 1; i++) {
      const a = sortedEntries[i];
      const b = sortedEntries[i + 1];
      const aTzs = resolveEntryTz(a, dayFlights, activeTz, tripTimezone);
      const bTzs = resolveEntryTz(b, dayFlights, activeTz, tripTimezone);
      const aOpt = a.options[0];
      const aIsFlight = aOpt?.category === 'flight' && aOpt.departure_tz && aOpt.arrival_tz;
      let aEnd: number;
      if (aIsFlight) {
        const aStart = getHourInTimezone(a.start_time, aTzs.startTz);
        const aUtcDur = (new Date(a.end_time).getTime() - new Date(a.start_time).getTime()) / 3600000;
        aEnd = aStart + aUtcDur;
      } else {
        aEnd = getHourInTimezone(a.end_time, aTzs.endTz);
      }
      const bStart = getHourInTimezone(b.start_time, bTzs.startTz);
      if (aEnd > bStart) {
        const overlapMin = Math.round((aEnd - bStart) * 60);
        map.set(a.id, { minutes: overlapMin, position: 'bottom' });
        map.set(b.id, { minutes: overlapMin, position: 'top' });
      }
    }
    return map;
  }, [sortedEntries, dayFlights, activeTz, tripTimezone]);

  const getWeatherForEntry = (entry: EntryWithOptions) => {
    const hour = Math.floor(getHourInTimezone(entry.start_time, tripTimezone));
    const dateStr = format(dayDate, 'yyyy-MM-dd');
    return weatherData.find(w => w.date === dateStr && w.hour === hour);
  };

  const getTravelSegment = (fromId: string, toId: string) => {
    return travelSegments.find(s => s.from_entry_id === fromId && s.to_entry_id === toId);
  };

  // Check if a manual Transfer entry exists between two entries, OR if they are linked flight<->processing
  const hasTransferBetween = (entryA: EntryWithOptions, entryB: EntryWithOptions): boolean => {
    // Skip travel segments between flight and its linked processing entries
    if (entryA.linked_flight_id === entryB.id || entryB.linked_flight_id === entryA.id) return true;
    if (entryA.linked_flight_id && entryB.linked_flight_id && entryA.linked_flight_id === entryB.linked_flight_id) return true;

    const aEnd = new Date(entryA.end_time).getTime();
    const bStart = new Date(entryB.start_time).getTime();
    return sortedEntries.some(e => {
      const opt = e.options[0];
      if (!opt || opt.category !== 'transfer') return false;
      const eStart = new Date(e.start_time).getTime();
      return eStart >= aEnd && eStart <= bStart;
    });
  };

  return (
    <div ref={ref} className="relative" data-day-index={dayIndex}>
      {/* Day header */}
      <div
        className={cn(
          'sticky z-20 border-b border-border bg-background/90 px-4 py-1.5 backdrop-blur-md',
          today && 'border-primary/30 bg-primary/5'
        )}
        style={{ top: 52 }}
        id={today ? 'today' : undefined}
      >
        <div className="mx-auto flex max-w-2xl items-center px-0">
          {/* Left: TZ abbreviation(s) */}
          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 w-16 shrink-0">
            {dayFlights.length > 0 ? (
              <>
                <span>{(() => { try { return new Intl.DateTimeFormat('en-GB', { timeZone: dayFlights[0].originTz, timeZoneName: 'short' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value; } catch { return ''; } })()}</span>
                <span className="text-muted-foreground/30">│</span>
                <span className="text-primary/60">{(() => { try { return new Intl.DateTimeFormat('en-GB', { timeZone: dayFlights[0].destinationTz, timeZoneName: 'short' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value; } catch { return ''; } })()}</span>
              </>
            ) : activeTz ? (
              <span>{(() => { try { return new Intl.DateTimeFormat('en-GB', { timeZone: activeTz, timeZoneName: 'short' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value; } catch { return activeTz; } })()}</span>
            ) : null}
          </div>

          {/* Center: Day name + date */}
          <div className="flex flex-1 items-baseline justify-center gap-2">
            <span className={cn(
              'font-display text-sm font-bold',
              today ? 'text-primary' : dayPast ? 'text-muted-foreground' : 'text-foreground'
            )}>
              {isUndated ? dayLabel : format(dayDate, 'EEEE')}
            </span>
            {!isUndated && (
              <span className={cn(
                'text-xs',
                today ? 'text-primary/70' : 'text-muted-foreground'
              )}>
                {format(dayDate, 'd MMM')}
              </span>
            )}
            {isUndated && (
              <span className="text-xs text-muted-foreground">
                {format(dayDate, 'EEEE')}
              </span>
            )}
            {today && (
              <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                TODAY
              </span>
            )}
          </div>

          {/* Right: empty for balance */}
          <div className="w-16 shrink-0" />
        </div>
      </div>

      {/* Trip Begins marker */}
      {isFirstDay && (
        <div className="mx-auto max-w-2xl px-4 pt-3">
          <div className="flex items-center justify-center rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            🚩 Trip Begins
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="mx-auto max-w-2xl px-4 py-2">
        {sortedEntries.length === 0 ? (
          <div className="relative min-h-[200px]">
            <div className={cn(
              'py-6 text-center text-xs',
              dayPast ? 'text-muted-foreground/40' : 'text-muted-foreground/60'
            )}>
              No plans yet
            </div>
            {onAddBetween && (
              <div className="flex justify-center pb-2">
                <button
                  onClick={() => onAddBetween(dayDate.toISOString())}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground/50 transition-all hover:border-primary hover:bg-primary/10 hover:text-primary"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div
            className="relative ml-20"
            style={{ height: containerHeight, minHeight: 200, marginRight: 8 }}
            onDragOver={(e) => {
              if (onDropFromPanel) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }
            }}
            onDrop={(e) => {
              if (!onDropFromPanel) return;
              e.preventDefault();
              const entryId = e.dataTransfer.getData('text/plain');
              if (!entryId) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const y = e.clientY - rect.top;
              const hourOffset = startHour + (y / PIXELS_PER_HOUR);
              // Snap to 15 min
              const snapped = Math.round(hourOffset * 4) / 4;
              onDropFromPanel(entryId, snapped);
            }}
          >
            <TimeSlotGrid
              startHour={startHour}
              endHour={endHour}
              pixelsPerHour={PIXELS_PER_HOUR}
              date={dayDate}
              onClickSlot={onClickSlot}
              onDragSlot={onDragSlot}
              activeTz={activeTz}
              flights={dayFlights}
            />

            {/* Pre-compute flight groups (needed for gap calculations below) */}
            {(() => {
              const flightGroupMap = new Map<string, { flight: EntryWithOptions; checkin?: EntryWithOptions; checkout?: EntryWithOptions }>();
              const linkedEntryIds = new Set<string>();

              sortedEntries.forEach(entry => {
                const opt = entry.options[0];
                if (opt?.category === 'flight') {
                  const group: { flight: EntryWithOptions; checkin?: EntryWithOptions; checkout?: EntryWithOptions } = { flight: entry };
                  sortedEntries.forEach(e => {
                    if (e.linked_flight_id === entry.id) {
                      linkedEntryIds.add(e.id);
                      if (e.linked_type === 'checkin') group.checkin = e;
                      else if (e.linked_type === 'checkout') group.checkout = e;
                    }
                  });
                  flightGroupMap.set(entry.id, group);
                }
              });

              /* ---------- Between-entry gap buttons + dashed line ---------- */
              const visibleEntries = sortedEntries.filter(e => {
                const opt = e.options[0];
                return opt && opt.category !== 'airport_processing' && !e.linked_flight_id;
              });

              const gapElements = visibleEntries.map((entry, idx) => {
                if (idx >= visibleEntries.length - 1) return null;
                const nextEntry = visibleEntries[idx + 1];

                const aTzs = resolveEntryTz(entry, dayFlights, activeTz, tripTimezone);
                const bTzs = resolveEntryTz(nextEntry, dayFlights, activeTz, tripTimezone);

                // Use flight group bounds for gap endpoints
                const aGroup = flightGroupMap.get(entry.id);
                const aOpt = entry.options[0];
                const aIsFlight = aOpt?.category === 'flight' && aOpt.departure_tz && aOpt.arrival_tz;
                let aEndHour: number;
                if (aGroup?.checkout) {
                  // Checkout end: flight visual end + checkout UTC duration
                  const flightStartH = getHourInTimezone(entry.start_time, aOpt?.departure_tz || aTzs.startTz);
                  const flightUtcDur = (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / 3600000;
                  const flightEndH = flightStartH + flightUtcDur;
                  const coDur = (new Date(aGroup.checkout.end_time).getTime() - new Date(aGroup.checkout.start_time).getTime()) / 3600000;
                  aEndHour = flightEndH + coDur;
                } else if (aIsFlight) {
                  const flightStartH = getHourInTimezone(entry.start_time, aOpt.departure_tz!);
                  const flightUtcDur = (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / 3600000;
                  aEndHour = flightStartH + flightUtcDur;
                } else {
                  aEndHour = getHourInTimezone(entry.end_time, aTzs.endTz);
                }

                const bGroup = flightGroupMap.get(nextEntry.id);
                const bEffectiveStartTime = bGroup?.checkin?.start_time ?? nextEntry.start_time;
                const bEffectiveStartTz = bGroup?.checkin ? (nextEntry.options[0]?.departure_tz || bTzs.startTz) : bTzs.startTz;
                const bStartHour = getHourInTimezone(bEffectiveStartTime, bEffectiveStartTz);
                const gapMin = Math.round((bStartHour - aEndHour) * 60);

                if (gapMin <= 5) return null; // too small

                const gapTopPx = (aEndHour - startHour) * PIXELS_PER_HOUR;
                const gapBottomPx = (bStartHour - startHour) * PIXELS_PER_HOUR;
                const gapHeight = gapBottomPx - gapTopPx;
                const midHour = (aEndHour + bStartHour) / 2;
                const btnTop = (midHour - startHour) * PIXELS_PER_HOUR - 12;
                const isTransportGap = gapMin < 120;

                return (
                  <div key={`gap-${entry.id}-${nextEntry.id}`}>
                    {/* Vertical dashed connector line */}
                    <div
                      className="absolute left-1/2 border-l-2 border-dashed border-primary/20 pointer-events-none"
                      style={{ top: gapTopPx, height: gapHeight }}
                    />
                    {/* Gap button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isTransportGap && onAddTransport) {
                          onAddTransport(entry.id, nextEntry.id, entry.end_time);
                        } else if (onAddBetween) {
                          onAddBetween(entry.end_time);
                        }
                      }}
                      className="absolute z-20 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/30 bg-background px-2 py-1 text-[10px] text-muted-foreground/60 transition-all hover:border-primary hover:bg-primary/10 hover:text-primary"
                      style={{ top: btnTop }}
                    >
                      {isTransportGap ? (
                        <>
                          <Bus className="h-3 w-3" />
                          <span>Transport</span>
                        </>
                      ) : (
                        <>
                          <Plus className="h-3 w-3" />
                          <span>+ Add something</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              });

              return <>{gapElements}</>;
            })()}

            {/* Entry cards */}
            {(() => {
              // Build flight groups (same as above, needed for card rendering)
              const flightGroupMap = new Map<string, { flight: EntryWithOptions; checkin?: EntryWithOptions; checkout?: EntryWithOptions }>();
              const linkedEntryIds = new Set<string>();

              sortedEntries.forEach(entry => {
                const opt = entry.options[0];
                if (opt?.category === 'flight') {
                  const group: { flight: EntryWithOptions; checkin?: EntryWithOptions; checkout?: EntryWithOptions } = { flight: entry };
                  sortedEntries.forEach(e => {
                    if (e.linked_flight_id === entry.id) {
                      linkedEntryIds.add(e.id);
                      if (e.linked_type === 'checkin') group.checkin = e;
                      else if (e.linked_type === 'checkout') group.checkout = e;
                    }
                  });
                  flightGroupMap.set(entry.id, group);
                }
              });

              return sortedEntries.map((entry, index) => {
                // Skip linked entries (rendered as part of flight group)
                if (linkedEntryIds.has(entry.id)) return null;

                const entryPast = isPast(new Date(entry.end_time));
                const primaryOption = entry.options[0];
                if (!primaryOption) return null;

                const isDragged = dragState?.entryId === entry.id;
                const isLocked = entry.is_locked;
                let entryStartHour: number;
                let entryEndHour: number;
                let resolvedTz = activeTz || tripTimezone;

                if (isDragged && dragState) {
                  entryStartHour = dragState.currentStartHour;
                  entryEndHour = dragState.currentEndHour;
                } else {
                  const isFlight = primaryOption.category === 'flight' && primaryOption.departure_tz && primaryOption.arrival_tz;
                  if (isFlight) {
                    entryStartHour = getHourInTimezone(entry.start_time, primaryOption.departure_tz!);
                    const utcDurationHours = (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / 3600000;
                    entryEndHour = entryStartHour + utcDurationHours;
                  } else {
                    // Per-entry TZ: check if entry is before or after flight
                    if (dayFlights.length > 0 && dayFlights[0].flightEndUtc) {
                      const entryUtcMs = new Date(entry.start_time).getTime();
                      const flightEndMs = new Date(dayFlights[0].flightEndUtc).getTime();
                      resolvedTz = entryUtcMs >= flightEndMs ? dayFlights[0].destinationTz : dayFlights[0].originTz;
                    }
                    entryStartHour = getHourInTimezone(entry.start_time, resolvedTz);
                    entryEndHour = getHourInTimezone(entry.end_time, resolvedTz);
                  }
                  if (entryEndHour < entryStartHour) entryEndHour = 24;
                }

                // For flight groups, expand bounds to cover checkin + checkout
                const flightGroup = flightGroupMap.get(entry.id);
                let groupStartHour = entryStartHour;
                let groupEndHour = entryEndHour;

                if (flightGroup) {
                  if (flightGroup.checkin) {
                    // Checkin duration via UTC, positioned to end at flight start
                    const ciDurationH = (new Date(flightGroup.checkin.end_time).getTime() - new Date(flightGroup.checkin.start_time).getTime()) / 3600000;
                    groupStartHour = entryStartHour - ciDurationH;
                  }
                  if (flightGroup.checkout) {
                    // Checkout duration via UTC, starts where flight ends visually
                    const coDurationH = (new Date(flightGroup.checkout.end_time).getTime() - new Date(flightGroup.checkout.start_time).getTime()) / 3600000;
                    groupEndHour = entryEndHour + coDurationH;
                  }
                  if (groupEndHour < groupStartHour) groupEndHour = 24;
                }

                const top = Math.max(0, (groupStartHour - startHour) * PIXELS_PER_HOUR);
                const height = (groupEndHour - groupStartHour) * PIXELS_PER_HOUR;
                const isCompact = height < 40 && !flightGroup;
                const isMedium = height >= 40 && height < 80 && !flightGroup;
                const isCondensed = height >= 80 && height < 160 && !flightGroup;

                const layoutInfo = layoutMap.get(entry.id);
                const column = layoutInfo?.column ?? 0;
                const totalColumns = layoutInfo?.totalColumns ?? 1;
                const widthPercent = 100 / totalColumns;
                const leftPercent = column * widthPercent;

                const distanceKm =
                  userLat != null && userLng != null && primaryOption.latitude != null && primaryOption.longitude != null
                    ? haversineKm(userLat, userLng, primaryOption.latitude, primaryOption.longitude)
                    : null;

                const weather = getWeatherForEntry(entry);

                const nextEntry = sortedEntries[index + 1];
                const travelSeg = nextEntry ? getTravelSegment(entry.id, nextEntry.id) : null;
                const showTravelSeg = travelSeg && nextEntry && !hasTransferBetween(entry, nextEntry);

                // Use the same resolved TZ for drag init as for visual positioning
                const dragTz = primaryOption.category === 'flight'
                  ? (primaryOption.departure_tz || resolvedTz)
                  : resolvedTz;
                const origStartHour = getHourInTimezone(entry.start_time, dragTz);
                let origEndHour: number;
                if (primaryOption.category === 'flight' && primaryOption.departure_tz) {
                  const utcDur = (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / 3600000;
                  origEndHour = origStartHour + utcDur;
                } else {
                  origEndHour = getHourInTimezone(entry.end_time, dragTz);
                }
                if (origEndHour < origStartHour) origEndHour = 24;

                const canDrag = onEntryTimeChange && !isLocked;

                // Per-entry formatTime using resolved TZ
                const entryFormatTime = (iso: string) => {
                  const d = new Date(iso);
                  return d.toLocaleTimeString('en-GB', {
                    timeZone: resolvedTz,
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  });
                };

                return (
                  <div key={entry.id}>
                    <div
                      className={cn(
                        'absolute z-10 pr-1 group',
                        isDragged && 'opacity-80 z-30'
                      )}
                      style={{
                        top,
                        height,
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                      }}
                    >
                      <div className="relative h-full">
                        {/* Top resize handle */}
                        {canDrag && !flightGroup && (
                          <div
                            className="absolute left-0 right-0 top-0 z-20 h-2 cursor-ns-resize"
                            onMouseDown={(e) => onMouseDown(e, entry.id, 'resize-top', origStartHour, origEndHour, dragTz, dayDate)}
                            onTouchStart={(e) => onTouchStart(e, entry.id, 'resize-top', origStartHour, origEndHour, dragTz, dayDate)}
                            onTouchMove={onTouchMove}
                            onTouchEnd={onTouchEnd}
                          />
                        )}
                        {!canDrag && isLocked && !flightGroup && (
                          <div
                            className="absolute left-0 right-0 top-0 z-20 h-2 cursor-not-allowed"
                            onMouseDown={(e) => { e.stopPropagation(); handleLockedAttempt(entry.id); }}
                            onTouchStart={(e) => { e.stopPropagation(); handleLockedAttempt(entry.id); }}
                          />
                        )}

                        {flightGroup ? (() => {
                          // Compute proportional fractions for each section
                          const totalDuration = groupEndHour - groupStartHour;
                          const checkinDuration = flightGroup.checkin
                            ? (new Date(flightGroup.checkin.end_time).getTime() - new Date(flightGroup.checkin.start_time).getTime()) / 3600000
                            : 0;
                          const flightDuration = entryEndHour - entryStartHour;
                          const checkoutDuration = flightGroup.checkout
                            ? (new Date(flightGroup.checkout.end_time).getTime() - new Date(flightGroup.checkout.start_time).getTime()) / 3600000
                            : 0;
                          const ciFrac = totalDuration > 0 ? checkinDuration / totalDuration : 0.25;
                          const flFrac = totalDuration > 0 ? flightDuration / totalDuration : 0.5;
                          const coFrac = totalDuration > 0 ? checkoutDuration / totalDuration : 0.25;

                          return (
                          <div className="relative h-full">
                            <FlightGroupCard
                              flightOption={primaryOption}
                              flightEntry={entry}
                              checkinEntry={flightGroup.checkin}
                              checkoutEntry={flightGroup.checkout}
                              checkinFraction={ciFrac}
                              flightFraction={flFrac}
                              checkoutFraction={coFrac}
                              isPast={entryPast}
                              isDragging={isDragged}
                              isLocked={isLocked}
                              onClick={() => {
                                if (!wasDraggedRef.current) onCardTap(entry, primaryOption);
                              }}
                              onDragStart={canDrag ? (e) => {
                                onMouseDown(e as any, entry.id, 'move', origStartHour, origEndHour, dragTz, dayDate);
                              } : isLocked ? (e) => {
                                e.stopPropagation();
                                handleLockedAttempt(entry.id);
                              } : undefined}
                              onTouchDragStart={canDrag ? (e) => {
                                onTouchStart(e as any, entry.id, 'move', origStartHour, origEndHour, dragTz, dayDate);
                              } : isLocked ? (e) => {
                                e.stopPropagation();
                                handleLockedAttempt(entry.id);
                              } : undefined}
                              onTouchDragMove={onTouchMove}
                              onTouchDragEnd={onTouchEnd}
                              isShaking={shakeEntryId === entry.id}
                            />
                            {/* Lock icon outside card */}
                            {isEditor && onToggleLock && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleLock(entry.id, !!isLocked);
                                }}
                                className="absolute -top-2 -right-2 z-30 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background shadow-sm"
                              >
                                {isLocked ? (
                                  <Lock className="h-3 w-3 text-amber-500" />
                                ) : (
                                  <LockOpen className="h-3 w-3 text-muted-foreground/50" />
                                )}
                              </button>
                            )}
                          </div>
                          );
                        })() : (
                          <div className="relative h-full">
                            <EntryCard
                              overlapMinutes={overlapMap.get(entry.id)?.minutes}
                              overlapPosition={overlapMap.get(entry.id)?.position}
                              isCompact={isCompact}
                              isMedium={isMedium}
                              isCondensed={isCondensed}
                              option={primaryOption}
                              startTime={entry.start_time}
                              endTime={entry.end_time}
                              formatTime={entryFormatTime}
                              isPast={entryPast}
                              optionIndex={0}
                              totalOptions={entry.options.length}
                              distanceKm={distanceKm}
                              votingLocked={votingLocked}
                              userId={userId}
                              hasVoted={userVotes.includes(primaryOption.id)}
                              onVoteChange={onVoteChange}
                              onClick={() => {
                                if (!wasDraggedRef.current) onCardTap(entry, primaryOption);
                              }}
                              cardSizeClass="h-full"
                              isDragging={isDragged}
                              isLocked={isLocked}
                              isProcessing={primaryOption.category === 'airport_processing'}
                              linkedType={entry.linked_type}
                              canEdit={isEditor}
                              onDragStart={canDrag ? (e) => {
                                onMouseDown(e as any, entry.id, 'move', origStartHour, origEndHour, dragTz, dayDate);
                              } : isLocked ? (e) => {
                                e.stopPropagation();
                                handleLockedAttempt(entry.id);
                              } : undefined}
                              onTouchDragStart={canDrag ? (e) => {
                                onTouchStart(e as any, entry.id, 'move', origStartHour, origEndHour, dragTz, dayDate);
                              } : isLocked ? (e) => {
                                e.stopPropagation();
                                handleLockedAttempt(entry.id);
                              } : undefined}
                              onTouchDragMove={onTouchMove}
                              onTouchDragEnd={onTouchEnd}
                              isShaking={shakeEntryId === entry.id}
                            />
                            {/* Lock icon outside card */}
                            {isEditor && onToggleLock && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleLock(entry.id, !!isLocked);
                                }}
                                className="absolute -top-2 -right-2 z-30 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background shadow-sm"
                              >
                                {isLocked ? (
                                  <Lock className="h-3 w-3 text-amber-500" />
                                ) : (
                                  <LockOpen className="h-3 w-3 text-muted-foreground/50" />
                                )}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Bottom resize handle */}
                        {canDrag && !flightGroup && (
                          <div
                            className="absolute bottom-0 left-0 right-0 z-20 h-2 cursor-ns-resize"
                            onMouseDown={(e) => onMouseDown(e, entry.id, 'resize-bottom', origStartHour, origEndHour, dragTz, dayDate)}
                            onTouchStart={(e) => onTouchStart(e, entry.id, 'resize-bottom', origStartHour, origEndHour, dragTz, dayDate)}
                            onTouchMove={onTouchMove}
                            onTouchEnd={onTouchEnd}
                          />
                        )}
                        {!canDrag && isLocked && !flightGroup && (
                          <div
                            className="absolute bottom-0 left-0 right-0 z-20 h-2 cursor-not-allowed"
                            onMouseDown={(e) => { e.stopPropagation(); handleLockedAttempt(entry.id); }}
                            onTouchStart={(e) => { e.stopPropagation(); handleLockedAttempt(entry.id); }}
                          />
                        )}

                        {/* + button: top-left corner (insert before) */}
                        {onAddBetween && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const prefillDate = addMinutes(new Date(entry.start_time), -60);
                              onAddBetween(prefillDate.toISOString());
                            }}
                            className="absolute z-20 flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/30 bg-background text-muted-foreground/50 opacity-0 transition-all group-hover:opacity-100 hover:border-primary hover:bg-primary/10 hover:text-primary"
                            style={{ top: -10, left: -10 }}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        )}

                        {/* + button: bottom-left corner (insert after) */}
                        {onAddBetween && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddBetween(entry.end_time);
                            }}
                            className="absolute z-20 flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/30 bg-background text-muted-foreground/50 opacity-0 transition-all group-hover:opacity-100 hover:border-primary hover:bg-primary/10 hover:text-primary"
                            style={{ bottom: -10, left: -10 }}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* SNAP button below transport cards */}
                    {primaryOption.category === 'transfer' && (() => {
                      // Find the next non-linked entry in sortedEntries
                      const nextVisible = sortedEntries.find((e, i) => {
                        if (i <= index) return false;
                        if (linkedEntryIds.has(e.id)) return false;
                        return true;
                      });
                      if (!nextVisible || nextVisible.is_locked) return null;
                      const gapMs = new Date(nextVisible.start_time).getTime() - new Date(entry.end_time).getTime();
                      if (gapMs <= 0) return null;

                      const handleSnapNext = async (e: React.MouseEvent) => {
                        e.stopPropagation();
                        const transportEndMs = new Date(entry.end_time).getTime();
                        const nextStartMs = new Date(nextVisible.start_time).getTime();
                        const nextEndMs = new Date(nextVisible.end_time).getTime();
                        const duration = nextEndMs - nextStartMs;
                        const newStart = new Date(transportEndMs).toISOString();
                        const newEnd = new Date(transportEndMs + duration).toISOString();

                        const { supabase } = await import('@/integrations/supabase/client');
                        await supabase.from('entries')
                          .update({ start_time: newStart, end_time: newEnd })
                          .eq('id', nextVisible.id);
                        onVoteChange();
                        toast.success('Snapped next event into place');
                      };

                      return (
                        <button
                          onClick={handleSnapNext}
                          className="absolute z-20 left-1/2 -translate-x-1/2 rounded-full bg-orange-100 dark:bg-orange-900/30 px-3 py-0.5 text-[10px] font-bold text-orange-600 dark:text-orange-300 border border-orange-200 dark:border-orange-800/40 hover:bg-orange-200 dark:hover:bg-orange-800/40 transition-colors"
                          style={{ top: height + 2 }}
                        >
                          SNAP
                        </button>
                      );
                    })()}

                    {/* Travel segment connector */}
                    {showTravelSeg && (
                      <div
                        className="absolute left-0 right-0 z-[5]"
                        style={{ top: top + height }}
                      >
                        <TravelSegmentCard
                          durationMin={travelSeg.duration_min}
                          mode={travelSeg.mode}
                          departBy={entryFormatTime(entry.end_time)}
                        />
                      </div>
                    )}
                  </div>
                );
              });
            })()}

            {/* Sunrise/Sunset gradient line */}
            {(() => {
              // Use trip location or default lat/lng for sun calc
              const sunTimes = calculateSunTimes(dayDate, userLat ?? 51.5, userLng ?? -0.1);
              const sunriseHour = sunTimes.sunrise ? sunTimes.sunrise.getUTCHours() + sunTimes.sunrise.getUTCMinutes() / 60 : 6;
              const sunsetHour = sunTimes.sunset ? sunTimes.sunset.getUTCHours() + sunTimes.sunset.getUTCMinutes() / 60 : 20;
              
              // Convert sun hours to percentage of the visible range
              const toPercent = (h: number) => Math.max(0, Math.min(100, ((h - startHour) / totalHours) * 100));
              const sunrisePct = toPercent(sunriseHour);
              const sunsetPct = toPercent(sunsetHour);
              const midPct = (sunrisePct + sunsetPct) / 2;
              
              const gradient = `linear-gradient(to bottom, 
                hsl(220, 50%, 20%) 0%, 
                hsl(30, 80%, 55%) ${sunrisePct}%, 
                hsl(200, 60%, 70%) ${sunrisePct + (midPct - sunrisePct) * 0.3}%, 
                hsl(200, 70%, 75%) ${midPct}%, 
                hsl(200, 60%, 70%) ${sunsetPct - (midPct - sunrisePct) * 0.3}%, 
                hsl(25, 80%, 50%) ${sunsetPct}%, 
                hsl(220, 50%, 20%) 100%)`;
              
              return (
                <div
                  className="absolute top-0 bottom-0 rounded-full z-[4]"
                  style={{ left: -6, width: 5, background: gradient }}
                />
              );
            })()}

            {/* TZ change badge — separate from weather, at flight arrival boundary */}
            {dayFlights && dayFlights.length > 0 && (() => {
              const f = dayFlights[0];
              const tzHour = Math.floor(f.flightEndHour);
              const offset = getUtcOffsetHoursDiff(f.originTz, f.destinationTz);
              if (offset === 0) return null;
              const badgeTop = (tzHour - startHour) * PIXELS_PER_HOUR + PIXELS_PER_HOUR / 2 - 8;
              return (
                <div className="absolute z-[6]" style={{ top: badgeTop, left: -100, width: 46 }}>
                  <span className="rounded-full bg-primary/20 border border-primary/30 px-2 py-0.5 text-[10px] font-bold text-primary whitespace-nowrap">
                    TZ {offset > 0 ? '+' : ''}{offset}h
                  </span>
                </div>
              );
            })()}

            {/* Weather column — between time labels */}
            <div className="absolute top-0 bottom-0 z-[5]" style={{ left: -50, width: 50 }}>
              {Array.from({ length: endHour - startHour }, (_, i) => startHour + i).map(hour => {
                const dateStr = format(dayDate, 'yyyy-MM-dd');
                const w = weatherData.find(wd => wd.date === dateStr && wd.hour === hour);
                if (!w) return null;
                const top = (hour - startHour) * PIXELS_PER_HOUR;
                return (
                  <div
                    key={hour}
                    className="absolute left-0"
                    style={{ top: top + (PIXELS_PER_HOUR / 2) - 6 }}
                  >
                    <WeatherBadge temp={w.temp_c} condition={w.condition} hour={hour} date={dayDate} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Trip Ends marker */}
      {isLastDay && (
        <div className="mx-auto max-w-2xl px-4 pb-3">
          <div className="flex items-center justify-center rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            🏁 Trip Ends
          </div>
        </div>
      )}
    </div>
  );
});

CalendarDay.displayName = 'CalendarDay';

export default CalendarDay;


import { useCallback } from 'react';
import { format, isToday, isPast, addMinutes } from 'date-fns';
import { calculateSunTimes } from '@/lib/sunCalc';
import type { EntryWithOptions, EntryOption, TravelSegment, WeatherData } from '@/types/trip';
import { cn } from '@/lib/utils';
import { haversineKm } from '@/lib/distance';
import { localToUTC } from '@/lib/timezoneUtils';
import { computeOverlapLayout } from '@/lib/overlapLayout';
import { Plus } from 'lucide-react';
import { useDragResize } from '@/hooks/useDragResize';
import TimeSlotGrid from './TimeSlotGrid';
import EntryCard from './EntryCard';
import FlightGroupCard from './FlightGroupCard';
import TravelSegmentCard from './TravelSegmentCard';
import WeatherBadge from './WeatherBadge';

const PIXELS_PER_HOUR = 80;

interface FlightTzInfo {
  originTz: string;
  destinationTz: string;
  flightStartHour: number;
  flightEndHour: number;
  flightEndUtc?: string;
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
  onClickSlot?: (time: Date) => void;
  onDragSlot?: (startTime: Date, endTime: Date) => void;
  dayLabel?: string;
  isFirstDay?: boolean;
  isLastDay?: boolean;
  onAddBetween?: (prefillTime: string) => void;
  onEntryTimeChange?: (entryId: string, newStartIso: string, newEndIso: string) => Promise<void>;
  onDropFromPanel?: (entryId: string, hourOffset: number) => void;
  dayFlights?: FlightTzInfo[];
  activeTz?: string;
  isEditor?: boolean;
  onToggleLock?: (entryId: string, currentLocked: boolean) => void;
  headerHeight?: number;
}

/** Resolve the timezone(s) to use for positioning an entry on the grid */
function resolveEntryTz(
  entry: EntryWithOptions,
  dayFlights: FlightTzInfo[],
  activeTz: string | undefined,
  tripTimezone: string
): { startTz: string; endTz: string } {
  const opt = entry.options[0];
  if (opt?.category === 'flight' && opt.departure_tz && opt.arrival_tz) {
    return { startTz: opt.departure_tz, endTz: opt.arrival_tz };
  }
  let tz = activeTz || tripTimezone;
  if (dayFlights.length > 0 && dayFlights[0].flightEndUtc) {
    const entryMs = new Date(entry.start_time).getTime();
    const flightEndMs = new Date(dayFlights[0].flightEndUtc).getTime();
    tz = entryMs >= flightEndMs ? dayFlights[0].destinationTz : dayFlights[0].originTz;
  }
  return { startTz: tz, endTz: tz };
}

function getHourInTimezone(isoString: string, tzName: string): number {
  const date = new Date(isoString);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tzName,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0');
  return hour + minute / 60;
}

const CalendarDay = ({
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
  isFirstDay,
  isLastDay,
  onAddBetween,
  onEntryTimeChange,
  onDropFromPanel,
  dayFlights = [],
  activeTz,
  isEditor,
  onToggleLock,
  headerHeight,
}: CalendarDayProps) => {
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
  const handleDragCommit = useCallback((entryId: string, newStartHour: number, newEndHour: number, tz?: string) => {
    if (!onEntryTimeChange) return;
    const entry = sortedEntries.find(e => e.id === entryId);
    if (entry?.is_locked) return;

    const dateStr = format(dayDate, 'yyyy-MM-dd');

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
  });

  // Compute overlap layout
  const layoutEntries = sortedEntries.map(e => {
    const { startTz, endTz } = resolveEntryTz(e, dayFlights, activeTz, tripTimezone);
    const s = (getHourInTimezone(e.start_time, startTz) - startHour) * 60;
    let en = (getHourInTimezone(e.end_time, endTz) - startHour) * 60;
    if (en <= s) en = s + 120;
    return { id: e.id, startMinutes: s, endMinutes: en };
  });

  const layout = computeOverlapLayout(layoutEntries);
  const layoutMap = new Map(layout.map(l => [l.entryId, l]));

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
    <div className="relative">
      {/* Day header */}
      <div
        className={cn(
          'sticky z-20 border-b border-border bg-background/90 px-4 py-1.5 backdrop-blur-md',
          today && 'border-primary/30 bg-primary/5'
        )}
        style={{ top: headerHeight ?? 53 }}
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
          <div className="relative">
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
            className={cn("relative", dayFlights.length > 0 ? "ml-20" : "ml-14")}
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

            {/* "+" before first entry */}
            {onAddBetween && sortedEntries.length > 0 && (() => {
              const firstEntry = sortedEntries[0];
              const firstStartHour = getHourInTimezone(firstEntry.start_time, tripTimezone);
              const firstTop = Math.max(0, (firstStartHour - startHour) * PIXELS_PER_HOUR);
              const prefillDate = addMinutes(new Date(firstEntry.start_time), -60);
              return (
                <div
                  className="absolute left-0 z-[15] flex w-10 items-center justify-center"
                  style={{ top: Math.max(0, firstTop - 14) }}
                >
                  <button
                    onClick={() => onAddBetween(prefillDate.toISOString())}
                    className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/30 bg-background text-muted-foreground/50 transition-all hover:border-primary hover:bg-primary/10 hover:text-primary"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              );
            })()}

            {/* Flight group computation */}
            {(() => {
              // Build flight groups
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
                    entryEndHour = getHourInTimezone(entry.end_time, primaryOption.arrival_tz!);
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
                    groupStartHour = getHourInTimezone(flightGroup.checkin.start_time, primaryOption.departure_tz || tripTimezone);
                  }
                  if (flightGroup.checkout) {
                    groupEndHour = getHourInTimezone(flightGroup.checkout.end_time, primaryOption.arrival_tz || tripTimezone);
                  }
                  if (groupEndHour < groupStartHour) groupEndHour = 24;
                }

                const top = Math.max(0, (groupStartHour - startHour) * PIXELS_PER_HOUR);
                const height = (groupEndHour - groupStartHour) * PIXELS_PER_HOUR;
                const isCompact = height < 50 && !flightGroup;

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
                let origEndHour = primaryOption.category === 'flight'
                  ? getHourInTimezone(entry.end_time, primaryOption.arrival_tz || dragTz)
                  : getHourInTimezone(entry.end_time, dragTz);
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
                        'absolute z-10 pr-1',
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
                        {/* Top resize handle (not for locked or flight group entries) */}
                        {canDrag && !flightGroup && (
                          <div
                            className="absolute left-0 right-0 top-0 z-20 h-2 cursor-ns-resize"
                            onMouseDown={(e) => onMouseDown(e, entry.id, 'resize-top', origStartHour, origEndHour, dragTz)}
                            onTouchStart={(e) => onTouchStart(e, entry.id, 'resize-top', origStartHour, origEndHour, dragTz)}
                            onTouchMove={onTouchMove}
                            onTouchEnd={onTouchEnd}
                          />
                        )}

                        {flightGroup ? (() => {
                          // Compute proportional fractions for each section
                          const depTz = primaryOption.departure_tz || tripTimezone;
                          const arrTz = primaryOption.arrival_tz || tripTimezone;
                          const totalDuration = groupEndHour - groupStartHour;
                          const checkinDuration = flightGroup.checkin
                            ? getHourInTimezone(flightGroup.checkin.end_time, depTz) - getHourInTimezone(flightGroup.checkin.start_time, depTz)
                            : 0;
                          const flightDuration = entryEndHour - entryStartHour;
                          const checkoutDuration = flightGroup.checkout
                            ? getHourInTimezone(flightGroup.checkout.end_time, arrTz) - getHourInTimezone(flightGroup.checkout.start_time, arrTz)
                            : 0;
                          const ciFrac = totalDuration > 0 ? checkinDuration / totalDuration : 0.25;
                          const flFrac = totalDuration > 0 ? flightDuration / totalDuration : 0.5;
                          const coFrac = totalDuration > 0 ? checkoutDuration / totalDuration : 0.25;

                          return (
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
                            canEdit={isEditor}
                            onToggleLock={() => onToggleLock?.(entry.id, !!isLocked)}
                            onClick={() => {
                              if (!wasDraggedRef.current) onCardTap(entry, primaryOption);
                            }}
                            onDragStart={canDrag ? (e) => {
                              onMouseDown(e as any, entry.id, 'move', origStartHour, origEndHour, dragTz);
                            } : undefined}
                            onTouchDragStart={canDrag ? (e) => {
                              onTouchStart(e as any, entry.id, 'move', origStartHour, origEndHour, dragTz);
                            } : undefined}
                            onTouchDragMove={onTouchMove}
                            onTouchDragEnd={onTouchEnd}
                          />
                          );
                        })() : (
                          <EntryCard
                            isCompact={isCompact}
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
                            onToggleLock={() => onToggleLock?.(entry.id, !!isLocked)}
                            onDragStart={canDrag ? (e) => {
                              onMouseDown(e as any, entry.id, 'move', origStartHour, origEndHour, dragTz);
                            } : undefined}
                            onTouchDragStart={canDrag ? (e) => {
                              onTouchStart(e as any, entry.id, 'move', origStartHour, origEndHour, dragTz);
                            } : undefined}
                            onTouchDragMove={onTouchMove}
                            onTouchDragEnd={onTouchEnd}
                          />
                        )}

                        {/* Bottom resize handle (not for locked or flight group entries) */}
                        {canDrag && !flightGroup && (
                          <div
                            className="absolute bottom-0 left-0 right-0 z-20 h-2 cursor-ns-resize"
                            onMouseDown={(e) => onMouseDown(e, entry.id, 'resize-bottom', origStartHour, origEndHour, dragTz)}
                            onTouchStart={(e) => onTouchStart(e, entry.id, 'resize-bottom', origStartHour, origEndHour, dragTz)}
                            onTouchMove={onTouchMove}
                            onTouchEnd={onTouchEnd}
                          />
                        )}
                      </div>
                    </div>

                    {/* + button between/after entries */}
                    {onAddBetween && (() => {
                      // Find next non-linked entry
                      const remainingEntries = sortedEntries.slice(index + 1).filter(e => !linkedEntryIds.has(e.id));
                      const nextVisibleEntry = remainingEntries[0];
                      const isLastVisible = !nextVisibleEntry;

                      if (isLastVisible) {
                        // After last entry
                        return (
                          <div
                            className="absolute left-0 z-[15] flex w-10 items-center justify-center"
                            style={{ top: top + height + 8 }}
                          >
                            <button
                              onClick={() => onAddBetween(entry.end_time)}
                              className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/30 bg-background text-muted-foreground/50 transition-all hover:border-primary hover:bg-primary/10 hover:text-primary"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      }

                      // Gap between this entry and next
                      const thisEndHour = entryEndHour;
                      const nextResolvedTz = (() => {
                        let tz = activeTz || tripTimezone;
                        if (dayFlights.length > 0 && dayFlights[0].flightEndUtc) {
                          const nUtc = new Date(nextVisibleEntry.start_time).getTime();
                          const fEnd = new Date(dayFlights[0].flightEndUtc).getTime();
                          tz = nUtc >= fEnd ? dayFlights[0].destinationTz : dayFlights[0].originTz;
                        }
                        return tz;
                      })();
                      const nextStartHour = getHourInTimezone(nextVisibleEntry.start_time, nextResolvedTz);
                      const gapHours = nextStartHour - thisEndHour;

                      if (gapHours > 0.25) {
                        // Visible gap — place + in middle
                        const midTop = top + height + (gapHours * PIXELS_PER_HOUR / 2) - 10;
                        return (
                          <div
                            className="absolute left-0 z-[15] flex w-10 items-center justify-center"
                            style={{ top: midTop }}
                          >
                            <button
                              onClick={() => onAddBetween(entry.end_time)}
                              className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/30 bg-background text-muted-foreground/50 transition-all hover:border-primary hover:bg-primary/10 hover:text-primary"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      } else {
                        // Back-to-back — thin plus line
                        return (
                          <div
                            className="absolute left-0 z-[15] flex w-10 items-center justify-center"
                            style={{ top: top + height - 2 }}
                          >
                            <button
                              onClick={() => onAddBetween(entry.end_time)}
                              className="flex h-4 w-4 items-center justify-center rounded-full border border-dashed border-muted-foreground/20 bg-background text-muted-foreground/40 transition-all hover:border-primary hover:bg-primary/10 hover:text-primary"
                            >
                              <Plus className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        );
                      }
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

            {/* Weather column — directly under time labels */}
            <div className="absolute top-0 bottom-0 z-[5]" style={{ left: dayFlights.length > 0 ? -68 : -46, width: dayFlights.length > 0 ? 52 : 30 }}>
              {Array.from({ length: endHour - startHour }, (_, i) => startHour + i).map(hour => {
                const dateStr = format(dayDate, 'yyyy-MM-dd');
                const w = weatherData.find(wd => wd.date === dateStr && wd.hour === hour);
                if (!w) return null;
                const top = (hour - startHour) * PIXELS_PER_HOUR;
                return (
                  <div key={hour} className="absolute left-0" style={{ top: top + (PIXELS_PER_HOUR / 2) - 6 }}>
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
};

export default CalendarDay;

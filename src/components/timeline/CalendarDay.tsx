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
import TravelSegmentCard from './TravelSegmentCard';
import WeatherBadge from './WeatherBadge';

const PIXELS_PER_HOUR = 80;

interface FlightTzInfo {
  originTz: string;
  destinationTz: string;
  flightStartHour: number;
  flightEndHour: number;
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
  const handleDragCommit = useCallback((entryId: string, newStartHour: number, newEndHour: number) => {
    if (!onEntryTimeChange) return;
    const entry = sortedEntries.find(e => e.id === entryId);
    // Don't allow dragging locked entries
    if (entry?.is_locked) return;

    const dateStr = format(dayDate, 'yyyy-MM-dd');
    const startMinutes = Math.round(newStartHour * 60);
    const endMinutes = Math.round(newEndHour * 60);
    const sH = Math.floor(startMinutes / 60);
    const sM = startMinutes % 60;
    const eH = Math.floor(endMinutes / 60);
    const eM = endMinutes % 60;
    const startTimeStr = `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`;
    const endTimeStr = `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`;
    const newStartIso = localToUTC(dateStr, startTimeStr, tripTimezone);
    const newEndIso = localToUTC(dateStr, endTimeStr, tripTimezone);
    onEntryTimeChange(entryId, newStartIso, newEndIso);

    // Move linked processing entries if this is a flight
    if (entry) {
      const linkedEntries = allEntries.filter(e => e.linked_flight_id === entry.id);
      const origStartHour = getHourInTimezone(entry.start_time, tripTimezone);
      const origEndHour = getHourInTimezone(entry.end_time, tripTimezone);

      linkedEntries.forEach(linked => {
        const linkedStartHour = getHourInTimezone(linked.start_time, tripTimezone);
        const linkedEndHour = getHourInTimezone(linked.end_time, tripTimezone);

        let newLinkedStart: number;
        let newLinkedEnd: number;

        if (linked.linked_type === 'checkin') {
          // Check-in ends at flight start
          const duration = linkedEndHour - linkedStartHour;
          newLinkedEnd = newStartHour;
          newLinkedStart = newLinkedEnd - duration;
        } else {
          // Checkout starts at flight end
          const duration = linkedEndHour - linkedStartHour;
          newLinkedStart = newEndHour;
          newLinkedEnd = newLinkedStart + duration;
        }

        const lsMin = Math.round(newLinkedStart * 60);
        const leMin = Math.round(newLinkedEnd * 60);
        const lsH = Math.floor(lsMin / 60);
        const lsM = lsMin % 60;
        const leH = Math.floor(leMin / 60);
        const leM = leMin % 60;
        const lStartStr = `${String(lsH).padStart(2, '0')}:${String(lsM).padStart(2, '0')}`;
        const lEndStr = `${String(leH).padStart(2, '0')}:${String(leM).padStart(2, '0')}`;
        onEntryTimeChange(linked.id, localToUTC(dateStr, lStartStr, tripTimezone), localToUTC(dateStr, lEndStr, tripTimezone));
      });
    }
  }, [onEntryTimeChange, dayDate, tripTimezone, sortedEntries, allEntries]);

  const { dragState, wasDraggedRef, onMouseDown, onTouchStart, onTouchMove, onTouchEnd } = useDragResize({
    pixelsPerHour: PIXELS_PER_HOUR,
    startHour,
    onCommit: handleDragCommit,
  });

  // Compute overlap layout
  const layoutEntries = sortedEntries.map(e => {
    const s = (getHourInTimezone(e.start_time, tripTimezone) - startHour) * 60;
    let en = (getHourInTimezone(e.end_time, tripTimezone) - startHour) * 60;
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
          'sticky top-[57px] z-20 border-b border-border bg-background/90 px-4 py-1.5 backdrop-blur-md',
          today && 'border-primary/30 bg-primary/5'
        )}
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

            {/* Positioned entries */}
            {sortedEntries.map((entry, index) => {
              const entryPast = isPast(new Date(entry.end_time));
              const primaryOption = entry.options[0];
              if (!primaryOption) return null;

              const isDragged = dragState?.entryId === entry.id;
              const isLocked = entry.is_locked;
              let entryStartHour: number;
              let entryEndHour: number;

              if (isDragged && dragState) {
                entryStartHour = dragState.currentStartHour;
                entryEndHour = dragState.currentEndHour;
              } else {
                entryStartHour = getHourInTimezone(entry.start_time, tripTimezone);
                entryEndHour = getHourInTimezone(entry.end_time, tripTimezone);
                if (entryEndHour < entryStartHour) entryEndHour = 24;
              }

              const top = Math.max(0, (entryStartHour - startHour) * PIXELS_PER_HOUR);
              const height = (entryEndHour - entryStartHour) * PIXELS_PER_HOUR;
              const isCompact = height < 50;

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

              const origStartHour = getHourInTimezone(entry.start_time, tripTimezone);
              let origEndHour = getHourInTimezone(entry.end_time, tripTimezone);
              if (origEndHour < origStartHour) origEndHour = 24;

              const canDrag = onEntryTimeChange && !isLocked;

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
                      {/* Top resize handle (not for locked entries) */}
                      {canDrag && (
                        <div
                          className="absolute left-0 right-0 top-0 z-20 h-2 cursor-ns-resize"
                          onMouseDown={(e) => onMouseDown(e, entry.id, 'resize-top', origStartHour, origEndHour)}
                          onTouchStart={(e) => onTouchStart(e, entry.id, 'resize-top', origStartHour, origEndHour)}
                          onTouchMove={onTouchMove}
                          onTouchEnd={onTouchEnd}
                        />
                      )}


                      <EntryCard
                        isCompact={isCompact}
                        option={primaryOption}
                        startTime={entry.start_time}
                        endTime={entry.end_time}
                        formatTime={formatTime}
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
                          onMouseDown(e as any, entry.id, 'move', origStartHour, origEndHour);
                        } : undefined}
                        onTouchDragStart={canDrag ? (e) => {
                          onTouchStart(e as any, entry.id, 'move', origStartHour, origEndHour);
                        } : undefined}
                        onTouchDragMove={onTouchMove}
                        onTouchDragEnd={onTouchEnd}
                      />

                      {/* Bottom resize handle (not for locked entries) */}
                      {canDrag && (
                        <div
                          className="absolute bottom-0 left-0 right-0 z-20 h-2 cursor-ns-resize"
                          onMouseDown={(e) => onMouseDown(e, entry.id, 'resize-bottom', origStartHour, origEndHour)}
                          onTouchStart={(e) => onTouchStart(e, entry.id, 'resize-bottom', origStartHour, origEndHour)}
                          onTouchMove={onTouchMove}
                          onTouchEnd={onTouchEnd}
                        />
                      )}
                    </div>
                  </div>

                  {/* + button between entries */}
                  {onAddBetween && (
                    <div
                      className="absolute left-0 z-[15] flex w-10 items-center justify-center"
                      style={{ top: top + height - 2 }}
                    >
                      <button
                        onClick={() => onAddBetween(entry.end_time)}
                        className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/30 bg-background text-muted-foreground/50 transition-all hover:border-primary hover:bg-primary/10 hover:text-primary"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {/* Travel segment connector */}
                  {showTravelSeg && (
                    <div
                      className="absolute left-0 right-0 z-[5]"
                      style={{ top: top + height }}
                    >
                      <TravelSegmentCard
                        durationMin={travelSeg.duration_min}
                        mode={travelSeg.mode}
                        departBy={formatTime(entry.end_time)}
                      />
                    </div>
                  )}
                </div>
              );
            })}

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

            {/* Weather column on the far left */}
            <div className="absolute top-0 bottom-0 z-[5]" style={{ left: dayFlights.length > 0 ? -80 : -56, width: 44 }}>
              {Array.from({ length: endHour - startHour }, (_, i) => startHour + i).map(hour => {
                const dateStr = format(dayDate, 'yyyy-MM-dd');
                const w = weatherData.find(wd => wd.date === dateStr && wd.hour === hour);
                if (!w) return null;
                const top = (hour - startHour) * PIXELS_PER_HOUR;
                return (
                  <div key={hour} className="absolute left-0" style={{ top: top + 2 }}>
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

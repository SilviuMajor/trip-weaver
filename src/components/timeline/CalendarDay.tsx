import { useCallback } from 'react';
import { format, isToday, isPast, addMinutes } from 'date-fns';
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

interface CalendarDayProps {
  date: Date;
  entries: EntryWithOptions[];
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
  dayLabel?: string;
  isFirstDay?: boolean;
  isLastDay?: boolean;
  onAddBetween?: (prefillTime: string) => void;
  onEntryTimeChange?: (entryId: string, newStartIso: string, newEndIso: string) => Promise<void>;
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
  dayLabel,
  isFirstDay,
  isLastDay,
  onAddBetween,
  onEntryTimeChange,
}: CalendarDayProps) => {
  const isUndated = !!dayLabel;
  const today = !isUndated && isToday(dayDate);
  const dayPast = !isUndated && isPast(dayDate) && !today;

  const sortedEntries = [...entries].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  // Calculate dynamic time range from entries
  let startHour = 6;
  let endHour = 24;

  if (sortedEntries.length > 0) {
    const hours = sortedEntries.flatMap(e => {
      const s = getHourInTimezone(e.start_time, tripTimezone);
      let en = getHourInTimezone(e.end_time, tripTimezone);
      if (en < s) en = 24;
      return [s, en];
    });
    startHour = Math.max(0, Math.floor(Math.min(...hours)) - 1);
    endHour = Math.min(24, Math.ceil(Math.max(...hours)) + 1);
  }

  const totalHours = endHour - startHour;
  const containerHeight = totalHours * PIXELS_PER_HOUR;

  // Drag-to-resize/move
  const handleDragCommit = useCallback((entryId: string, newStartHour: number, newEndHour: number) => {
    if (!onEntryTimeChange) return;
    const dateStr = format(dayDate, 'yyyy-MM-dd');
    const startMinutes = Math.round(newStartHour * 60);
    const endMinutes = Math.round(newEndHour * 60);
    const sH = Math.floor(startMinutes / 60);
    const sM = startMinutes % 60;
    const eH = Math.floor(endMinutes / 60);
    const eM = endMinutes % 60;
    const startTimeStr = `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`;
    const endTimeStr = `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`;
    // Convert local hours in tripTimezone to proper UTC
    const newStartIso = localToUTC(dateStr, startTimeStr, tripTimezone);
    const newEndIso = localToUTC(dateStr, endTimeStr, tripTimezone);
    onEntryTimeChange(entryId, newStartIso, newEndIso);
  }, [onEntryTimeChange, dayDate, tripTimezone]);

  const { dragState, onMouseDown, onTouchStart, onTouchMove, onTouchEnd } = useDragResize({
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

  // Check if a manual Transfer entry exists between two entries
  const hasTransferBetween = (entryA: EntryWithOptions, entryB: EntryWithOptions): boolean => {
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
          'sticky top-[57px] z-20 border-b border-border bg-background/90 px-4 py-2 backdrop-blur-md',
          today && 'border-primary/30 bg-primary/5'
        )}
        id={today ? 'today' : undefined}
      >
        <div className="mx-auto flex max-w-2xl items-baseline gap-2">
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
      <div className="mx-auto max-w-2xl px-4 py-3">
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
          <div className="relative ml-10" style={{ height: containerHeight, minHeight: 200 }}>
            <TimeSlotGrid
              startHour={startHour}
              endHour={endHour}
              pixelsPerHour={PIXELS_PER_HOUR}
              date={dayDate}
              onClickSlot={onClickSlot}
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

              // Check if this entry is being dragged
              const isDragged = dragState?.entryId === entry.id;
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
              const height = Math.max(60, (entryEndHour - entryStartHour) * PIXELS_PER_HOUR);

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

              // Original hours for drag initiation
              const origStartHour = getHourInTimezone(entry.start_time, tripTimezone);
              let origEndHour = getHourInTimezone(entry.end_time, tripTimezone);
              if (origEndHour < origStartHour) origEndHour = 24;

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
                      {/* Top resize handle */}
                      {onEntryTimeChange && (
                        <div
                          className="absolute left-0 right-0 top-0 z-20 h-2 cursor-ns-resize"
                          onMouseDown={(e) => onMouseDown(e, entry.id, 'resize-top', origStartHour, origEndHour)}
                          onTouchStart={(e) => onTouchStart(e, entry.id, 'resize-top', origStartHour, origEndHour)}
                          onTouchMove={onTouchMove}
                          onTouchEnd={onTouchEnd}
                        />
                      )}

                      {weather && (
                        <div className="absolute right-2 top-2 z-20">
                          <WeatherBadge temp={weather.temp_c} condition={weather.condition} />
                        </div>
                      )}

                      <EntryCard
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
                          if (!isDragged) onCardTap(entry, primaryOption);
                        }}
                        cardSizeClass="h-full"
                        isDragging={isDragged}
                        onDragStart={onEntryTimeChange ? (e) => {
                          onMouseDown(e as any, entry.id, 'move', origStartHour, origEndHour);
                        } : undefined}
                        onTouchDragStart={onEntryTimeChange ? (e) => {
                          onTouchStart(e as any, entry.id, 'move', origStartHour, origEndHour);
                        } : undefined}
                        onTouchDragMove={onTouchMove}
                        onTouchDragEnd={onTouchEnd}
                      />

                      {/* Bottom resize handle */}
                      {onEntryTimeChange && (
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

                  {/* Travel segment connector (skip if manual Transfer exists between) */}
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

import { format, isToday, isPast } from 'date-fns';
import type { EntryWithOptions, EntryOption, TravelSegment, WeatherData } from '@/types/trip';
import type { Timezone } from '@/types/trip';
import { cn } from '@/lib/utils';
import { haversineKm } from '@/lib/distance';
import { computeOverlapLayout } from '@/lib/overlapLayout';
import TimeSlotGrid from './TimeSlotGrid';
import EntryCard from './EntryCard';
import TravelSegmentCard from './TravelSegmentCard';
import WeatherBadge from './WeatherBadge';

const PIXELS_PER_HOUR = 80;

interface CalendarDayProps {
  date: Date;
  entries: EntryWithOptions[];
  formatTime: (iso: string) => string;
  timezone: Timezone;
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
}

function getHourInTimezone(isoString: string, tz: Timezone): number {
  const date = new Date(isoString);
  const tzName = tz === 'UK' ? 'Europe/London' : 'Europe/Amsterdam';
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
  date,
  entries,
  formatTime,
  timezone,
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
}: CalendarDayProps) => {
  const isUndated = !!dayLabel;
  const today = !isUndated && isToday(date);
  const dayPast = !isUndated && isPast(date) && !today;

  const sortedEntries = [...entries].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  // Calculate dynamic time range from entries
  let startHour = 6;
  let endHour = 24;

  if (sortedEntries.length > 0) {
    const hours = sortedEntries.flatMap(e => [
      getHourInTimezone(e.start_time, timezone),
      getHourInTimezone(e.end_time, timezone),
    ]);
    startHour = Math.max(0, Math.floor(Math.min(...hours)) - 1);
    endHour = Math.min(24, Math.ceil(Math.max(...hours)) + 1);
  }

  const totalHours = endHour - startHour;
  const containerHeight = totalHours * PIXELS_PER_HOUR;

  // Compute overlap layout
  const layoutEntries = sortedEntries.map(e => ({
    id: e.id,
    startMinutes: (getHourInTimezone(e.start_time, timezone) - startHour) * 60,
    endMinutes: (getHourInTimezone(e.end_time, timezone) - startHour) * 60,
  }));

  const layout = computeOverlapLayout(layoutEntries);
  const layoutMap = new Map(layout.map(l => [l.entryId, l]));

  const getWeatherForEntry = (entry: EntryWithOptions) => {
    const hour = Math.floor(getHourInTimezone(entry.start_time, timezone));
    const dateStr = format(date, 'yyyy-MM-dd');
    return weatherData.find(w => w.date === dateStr && w.hour === hour);
  };

  const getTravelSegment = (fromId: string, toId: string) => {
    return travelSegments.find(s => s.from_entry_id === fromId && s.to_entry_id === toId);
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
            {isUndated ? dayLabel : format(date, 'EEEE')}
          </span>
          {!isUndated && (
            <span className={cn(
              'text-xs',
              today ? 'text-primary/70' : 'text-muted-foreground'
            )}>
              {format(date, 'd MMM')}
            </span>
          )}
          {isUndated && (
            <span className="text-xs text-muted-foreground">
              {format(date, 'EEEE')}
            </span>
          )}
          {today && (
            <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
              TODAY
            </span>
          )}
        </div>
      </div>

      {/* Calendar grid */}
      <div className="mx-auto max-w-2xl px-4 py-3">
        {sortedEntries.length === 0 ? (
          <div className={cn(
            'py-6 text-center text-xs',
            dayPast ? 'text-muted-foreground/40' : 'text-muted-foreground/60'
          )}>
            No plans yet
          </div>
        ) : (
          <div className="relative ml-10" style={{ height: containerHeight, minHeight: 200 }}>
            <TimeSlotGrid
              startHour={startHour}
              endHour={endHour}
              pixelsPerHour={PIXELS_PER_HOUR}
              date={date}
              onClickSlot={onClickSlot}
            />

            {/* Positioned entries */}
            {sortedEntries.map((entry, index) => {
              const entryPast = isPast(new Date(entry.end_time));
              const primaryOption = entry.options[0];
              if (!primaryOption) return null;

              const entryStartHour = getHourInTimezone(entry.start_time, timezone);
              const entryEndHour = getHourInTimezone(entry.end_time, timezone);
              const top = Math.max(0, (entryStartHour - startHour) * PIXELS_PER_HOUR);
              const height = Math.max(40, (entryEndHour - entryStartHour) * PIXELS_PER_HOUR);

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

              return (
                <div key={entry.id}>
                  <div
                    className="absolute z-10 pr-1"
                    style={{
                      top,
                      height,
                      left: `${leftPercent}%`,
                      width: `${widthPercent}%`,
                    }}
                  >
                    <div className="relative h-full">
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
                        onClick={() => onCardTap(entry, primaryOption)}
                        cardSizeClass="h-full"
                      />
                    </div>
                  </div>

                  {/* Travel segment connector */}
                  {travelSeg && (
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
    </div>
  );
};

export default CalendarDay;

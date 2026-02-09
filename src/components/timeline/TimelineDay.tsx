import { format, isToday, isPast } from 'date-fns';
import type { EntryWithOptions, EntryOption } from '@/types/trip';
import OptionSwiper from './OptionSwiper';
import { cn } from '@/lib/utils';
import { haversineKm } from '@/lib/distance';

interface TimelineDayProps {
  date: Date;
  entries: EntryWithOptions[];
  formatTime: (iso: string) => string;
  userLat: number | null;
  userLng: number | null;
  votingLocked: boolean;
  userId: string | undefined;
  userVotes: string[];
  onVoteChange: () => void;
  onCardTap: (entry: EntryWithOptions, option: EntryOption) => void;
  spacingClass?: string;
  cardSizeClass?: string;
}

const TimelineDay = ({
  date,
  entries,
  formatTime,
  userLat,
  userLng,
  votingLocked,
  userId,
  userVotes,
  onVoteChange,
  onCardTap,
  spacingClass = 'space-y-3',
  cardSizeClass,
}: TimelineDayProps) => {
  const today = isToday(date);
  const dayPast = isPast(date) && !today;

  const sortedEntries = [...entries].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const activityCount = sortedEntries.length;

  return (
    <div className="relative">
      {/* Day header */}
      <div
        className={cn(
          'sticky top-[57px] z-20 border-b border-border bg-card/90 px-4 py-3 backdrop-blur-md',
          today && 'border-primary/30 bg-primary/10'
        )}
        id={today ? 'today' : undefined}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <span className="text-lg">
            {today ? '☀️' : dayPast ? '📅' : '🗓️'}
          </span>
          <div>
            <div className="flex items-baseline gap-2">
              <span className={cn(
                'font-display text-sm font-bold',
                today ? 'text-primary' : dayPast ? 'text-muted-foreground' : 'text-foreground'
              )}>
                {format(date, 'EEEE')}
              </span>
              <span className={cn(
                'text-xs',
                today ? 'text-primary/70' : 'text-muted-foreground'
              )}>
                {format(date, 'd MMM')}
              </span>
              {today && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  TODAY
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {activityCount === 0 ? 'No plans yet' : `${activityCount} ${activityCount === 1 ? 'activity' : 'activities'} planned`}
            </p>
          </div>
        </div>
      </div>

      {/* Entries */}
      <div className="mx-auto max-w-2xl px-4 py-3">
        {sortedEntries.length === 0 ? (
          <div className={cn(
            'py-6 text-center text-xs',
            dayPast ? 'text-muted-foreground/40' : 'text-muted-foreground/60'
          )}>
            ✨ Free day — add something fun!
          </div>
        ) : (
          <div className={spacingClass}>
            {sortedEntries.map((entry) => {
              const entryPast = isPast(new Date(entry.end_time));
              const primaryOption = entry.options[0];
              if (!primaryOption) return null;

              const distanceKm =
                userLat != null && userLng != null && primaryOption.latitude != null && primaryOption.longitude != null
                  ? haversineKm(userLat, userLng, primaryOption.latitude, primaryOption.longitude)
                  : null;

              return (
                <OptionSwiper
                  key={entry.id}
                  entry={entry}
                  formatTime={formatTime}
                  isPast={entryPast}
                  distanceKm={distanceKm}
                  votingLocked={votingLocked}
                  userId={userId}
                  userVotes={userVotes}
                  onVoteChange={onVoteChange}
                  onCardTap={onCardTap}
                  cardSizeClass={cardSizeClass}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelineDay;

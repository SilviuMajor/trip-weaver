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

  // Sort entries by start_time
  const sortedEntries = [...entries].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

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
            {format(date, 'EEEE')}
          </span>
          <span className={cn(
            'text-xs',
            today ? 'text-primary/70' : 'text-muted-foreground'
          )}>
            {format(date, 'd MMM')}
          </span>
          {today && (
            <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
              TODAY
            </span>
          )}
        </div>
      </div>

      {/* Entries */}
      <div className="mx-auto max-w-2xl px-4 py-3">
        {sortedEntries.length === 0 ? (
          <div className={cn(
            'py-6 text-center text-xs',
            dayPast ? 'text-muted-foreground/40' : 'text-muted-foreground/60'
          )}>
            No plans yet
          </div>
        ) : (
          <div className={spacingClass}>
            {sortedEntries.map((entry) => {
              const entryPast = isPast(new Date(entry.end_time));
              const primaryOption = entry.options[0];
              if (!primaryOption) return null;

              // Calculate distance from user to primary option
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

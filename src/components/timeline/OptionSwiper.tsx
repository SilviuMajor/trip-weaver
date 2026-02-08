import useEmblaCarousel from 'embla-carousel-react';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { EntryWithOptions, EntryOption } from '@/types/trip';
import EntryCard from './EntryCard';

interface OptionSwiperProps {
  entry: EntryWithOptions;
  formatTime: (iso: string) => string;
  isPast: boolean;
  distanceKm?: number | null;
  votingLocked: boolean;
  userId: string | undefined;
  userVotes: string[];
  onVoteChange: () => void;
  onCardTap: (entry: EntryWithOptions, option: EntryOption) => void;
  cardSizeClass?: string;
}

const OptionSwiper = ({
  entry,
  formatTime,
  isPast,
  distanceKm,
  votingLocked,
  userId,
  userVotes,
  onVoteChange,
  onCardTap,
  cardSizeClass,
}: OptionSwiperProps) => {
  // Sort options by vote count descending
  const sortedOptions = [...entry.options].sort(
    (a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0)
  );

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    active: sortedOptions.length > 1,
  });

  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onSelect);
    onSelect();
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  if (sortedOptions.length === 0) return null;

  // Single option — no carousel needed
  if (sortedOptions.length === 1) {
    const opt = sortedOptions[0];
    return (
      <EntryCard
        option={opt}
        startTime={entry.start_time}
        endTime={entry.end_time}
        formatTime={formatTime}
        isPast={isPast}
        optionIndex={0}
        totalOptions={1}
        distanceKm={distanceKm}
        votingLocked={votingLocked}
        userId={userId}
        hasVoted={userVotes.includes(opt.id)}
        onVoteChange={onVoteChange}
        onClick={() => onCardTap(entry, opt)}
        cardSizeClass={cardSizeClass}
      />
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-3">
          {sortedOptions.map((opt, i) => (
            <div key={opt.id} className="min-w-0 flex-[0_0_92%]">
              <EntryCard
                option={opt}
                startTime={entry.start_time}
                endTime={entry.end_time}
                formatTime={formatTime}
                isPast={isPast}
                optionIndex={i}
                totalOptions={sortedOptions.length}
                distanceKm={distanceKm}
                votingLocked={votingLocked}
                userId={userId}
                hasVoted={userVotes.includes(opt.id)}
                onVoteChange={onVoteChange}
                onClick={() => onCardTap(entry, opt)}
                cardSizeClass={cardSizeClass}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1">
        {sortedOptions.map((_, i) => (
          <button
            key={i}
            onClick={() => emblaApi?.scrollTo(i)}
            className={cn(
              'h-1.5 rounded-full transition-all',
              i === selectedIndex
                ? 'w-4 bg-primary'
                : 'w-1.5 bg-muted-foreground/30'
            )}
          />
        ))}
      </div>
    </div>
  );
};

export default OptionSwiper;

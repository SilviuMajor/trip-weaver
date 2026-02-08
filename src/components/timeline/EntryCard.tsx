import { motion } from 'framer-motion';
import { MapPin, Clock } from 'lucide-react';
import type { EntryOption } from '@/types/trip';
import { cn } from '@/lib/utils';
import { getTimeOfDayGradient } from '@/lib/timeOfDayColor';
import { findCategory, categoryLabel } from '@/lib/categories';
import VoteButton from './VoteButton';

interface EntryCardProps {
  option: EntryOption;
  startTime: string;
  endTime: string;
  formatTime: (iso: string) => string;
  isPast: boolean;
  optionIndex: number;
  totalOptions: number;
  distanceKm?: number | null;
  votingLocked: boolean;
  userId?: string;
  hasVoted: boolean;
  onVoteChange: () => void;
  onClick?: () => void;
  cardSizeClass?: string;
}

const getCategoryStyle = (catId: string | null, customColor: string | null) => {
  const predefined = findCategory(catId ?? '');
  if (predefined) return { backgroundColor: predefined.color, color: '#fff' };
  if (customColor) return { backgroundColor: customColor, color: '#fff' };
  return { backgroundColor: 'hsl(240, 40%, 55%)', color: '#fff' };
};

const getCategoryDisplay = (catId: string | null): string => {
  const predefined = findCategory(catId ?? '');
  if (predefined) return `${predefined.emoji} ${predefined.name}`;
  // For legacy/custom categories, catId is the raw text
  return catId ?? '';
};

const EntryCard = ({
  option,
  startTime,
  endTime,
  formatTime,
  isPast: isEntryPast,
  optionIndex,
  totalOptions,
  distanceKm,
  votingLocked,
  userId,
  hasVoted,
  onVoteChange,
  onClick,
  cardSizeClass,
}: EntryCardProps) => {
  const firstImage = option.images?.[0]?.image_url;
  const categoryStyle = option.category ? getCategoryStyle(option.category, option.category_color) : {};
  const categoryDisplay = getCategoryDisplay(option.category);

  // Dynamic time-of-day gradient for cards without images
  const timeGradient = getTimeOfDayGradient(new Date(startTime), new Date(endTime));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: optionIndex * 0.05 }}
      onClick={onClick}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-xl border border-border shadow-sm transition-all hover:shadow-md',
        isEntryPast && 'opacity-50 grayscale-[30%]',
        cardSizeClass
      )}
    >
      {/* Background image or time-of-day gradient */}
      {firstImage ? (
        <div className="absolute inset-0">
          <img
            src={firstImage}
            alt={option.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/40 to-transparent" />
        </div>
      ) : (
        <div className="absolute inset-0" style={{ background: timeGradient }}>
          <div className="absolute inset-0 bg-foreground/10" />
        </div>
      )}

      {/* Content */}
      <div className={cn(
        'relative z-10 p-4',
        firstImage ? 'text-primary-foreground' : 'text-white'
      )}>
        {/* Top row: Category + Options indicator */}
        <div className="mb-3 flex items-start justify-between">
          {option.category && (
            <span
              className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
              style={categoryStyle}
            >
              {categoryDisplay}
            </span>
          )}

          {totalOptions > 1 && (
            <span className="text-[10px] font-medium text-white/70">
              {optionIndex + 1}/{totalOptions}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="mb-2 font-display text-lg font-bold leading-tight">{option.name}</h3>

        {/* Time */}
        <div className="mb-2 flex items-center gap-1.5 text-xs text-white/80">
          <Clock className="h-3 w-3" />
          <span>{formatTime(startTime)} — {formatTime(endTime)}</span>
        </div>

        {/* Bottom row: Distance + Votes */}
        <div className="flex items-center justify-between">
          {distanceKm !== null && distanceKm !== undefined ? (
            <div className="flex items-center gap-1 text-xs text-white/70">
              <MapPin className="h-3 w-3" />
              <span>{distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`}</span>
            </div>
          ) : (
            <div />
          )}

          {userId && totalOptions > 1 && (
            <VoteButton
              optionId={option.id}
              userId={userId}
              voteCount={option.vote_count ?? 0}
              hasVoted={hasVoted}
              locked={votingLocked}
              onVoteChange={onVoteChange}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default EntryCard;

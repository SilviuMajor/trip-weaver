import { motion } from 'framer-motion';
import { MapPin, Clock } from 'lucide-react';
import type { EntryOption } from '@/types/trip';
import { cn } from '@/lib/utils';
import { getTimeOfDayGradient } from '@/lib/timeOfDayColor';
import { findCategory } from '@/lib/categories';
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

const getCategoryColor = (catId: string | null, customColor: string | null): string => {
  const predefined = findCategory(catId ?? '');
  if (predefined) return predefined.color;
  if (customColor) return customColor;
  return 'hsl(260, 50%, 55%)';
};

const getCategoryEmoji = (catId: string | null): string => {
  const predefined = findCategory(catId ?? '');
  return predefined?.emoji ?? '📌';
};

const getCategoryName = (catId: string | null): string => {
  const predefined = findCategory(catId ?? '');
  return predefined?.name ?? catId ?? '';
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
  const catColor = getCategoryColor(option.category, option.category_color);
  const catEmoji = getCategoryEmoji(option.category);
  const catName = getCategoryName(option.category);
  const timeGradient = getTimeOfDayGradient(new Date(startTime), new Date(endTime));

  // For cards without images, use a light tinted bg
  const tintBg = `${catColor}18`; // ~10% opacity hex suffix

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: optionIndex * 0.05 }}
      onClick={onClick}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-2xl border shadow-md transition-all hover:shadow-lg',
        isEntryPast && 'opacity-50 grayscale-[30%]',
        cardSizeClass
      )}
      style={!firstImage ? { borderColor: catColor, borderLeftWidth: 4 } : undefined}
    >
      {/* Background */}
      {firstImage ? (
        <div className="absolute inset-0">
          <img src={firstImage} alt={option.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        </div>
      ) : (
        <div className="absolute inset-0" style={{ background: tintBg }}>
          <div className="absolute inset-0" style={{ background: timeGradient, opacity: 0.15 }} />
        </div>
      )}

      {/* Content */}
      <div className={cn(
        'relative z-10 p-4',
        firstImage ? 'text-white' : 'text-foreground'
      )}>
        {/* Top row: Category + Options indicator */}
        <div className="mb-3 flex items-start justify-between">
          {option.category && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ backgroundColor: catColor, color: '#fff' }}
            >
              <span className="text-sm">{catEmoji}</span>
              {catName}
            </span>
          )}
          {totalOptions > 1 && (
            <span className={cn(
              'text-[10px] font-medium',
              firstImage ? 'text-white/70' : 'text-muted-foreground'
            )}>
              {optionIndex + 1}/{totalOptions}
            </span>
          )}
        </div>

        {/* Title with emoji */}
        <h3 className="mb-2 flex items-center gap-2 font-display text-lg font-bold leading-tight">
          {!option.category && <span className="text-xl">{catEmoji}</span>}
          {option.name}
        </h3>

        {/* Time */}
        <div className={cn(
          'mb-2 flex items-center gap-1.5 text-xs',
          firstImage ? 'text-white/80' : 'text-muted-foreground'
        )}>
          <Clock className="h-3 w-3" />
          <span>{formatTime(startTime)} — {formatTime(endTime)}</span>
        </div>

        {/* Bottom row: Distance + Votes */}
        <div className="flex items-center justify-between">
          {distanceKm !== null && distanceKm !== undefined ? (
            <div className={cn(
              'flex items-center gap-1 text-xs',
              firstImage ? 'text-white/70' : 'text-muted-foreground'
            )}>
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

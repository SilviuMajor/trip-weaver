import { motion } from 'framer-motion';
import { MapPin, Clock, Plane, ArrowRight, Lock, LockOpen } from 'lucide-react';
import type { EntryOption } from '@/types/trip';
import { cn } from '@/lib/utils';

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
  isDragging?: boolean;
  isLocked?: boolean;
  isProcessing?: boolean;
  linkedType?: string | null;
  isCompact?: boolean;
  canEdit?: boolean;
  onToggleLock?: () => void;
  onDragStart?: (e: React.MouseEvent) => void;
  onTouchDragStart?: (e: React.TouchEvent) => void;
  onTouchDragMove?: (e: React.TouchEvent) => void;
  onTouchDragEnd?: () => void;
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

const formatTimeInTz = (isoString: string, tz: string | null): string => {
  if (!tz) return '';
  const date = new Date(isoString);
  const time = date.toLocaleTimeString('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const tzAbbr = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    timeZoneName: 'short',
  }).formatToParts(date).find(p => p.type === 'timeZoneName')?.value ?? '';
  return `${time} ${tzAbbr}`;
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
  isDragging,
  isLocked,
  isProcessing,
  linkedType,
  isCompact,
  canEdit,
  onToggleLock,
  onDragStart,
  onTouchDragStart,
  onTouchDragMove,
  onTouchDragEnd,
}: EntryCardProps) => {
  const firstImage = option.images?.[0]?.image_url;
  const catColor = getCategoryColor(option.category, option.category_color);
  const catEmoji = getCategoryEmoji(option.category);
  const catName = getCategoryName(option.category);
  const isTransfer = option.category === 'transfer';

  const tintBg = isProcessing ? `${catColor}10` : `${catColor}18`;

  const handleLockClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleLock?.();
  };

  // Compact single-line layout for very short entries
  if (isCompact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClick}
        onMouseDown={onDragStart}
        onTouchStart={onTouchDragStart}
        onTouchMove={onTouchDragMove}
        onTouchEnd={onTouchDragEnd}
        className={cn(
          'group relative flex items-center gap-1.5 overflow-hidden rounded-lg border shadow-sm transition-all hover:shadow-md',
          isEntryPast && 'opacity-50 grayscale-[30%]',
          isDragging ? 'cursor-grabbing ring-2 ring-primary' : onDragStart ? 'cursor-grab' : 'cursor-pointer',
          isLocked && 'border-dashed border-2 border-muted-foreground/40',
          cardSizeClass
        )}
        style={{
          borderColor: isLocked ? undefined : catColor,
          borderLeftWidth: isLocked ? undefined : 3,
          background: tintBg,
        }}
      >
        <div className="relative z-10 flex w-full items-center gap-1.5 px-2 py-0.5">
          <span className="text-xs shrink-0">{catEmoji}</span>
          <span className="truncate text-[11px] font-semibold leading-tight">{option.name}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">
            {formatTime(startTime)}–{formatTime(endTime)}
          </span>
          <span className="flex-1" />
          {canEdit && onToggleLock && (
            <button
              onClick={handleLockClick}
              className="shrink-0 p-0.5 rounded hover:bg-muted/50 transition-colors"
            >
              {isLocked ? (
              <Lock className="h-3.5 w-3.5 text-muted-foreground/80" />
              ) : (
                <LockOpen className="h-3.5 w-3.5 text-muted-foreground/30" />
              )}
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: optionIndex * 0.05 }}
      onClick={onClick}
      onMouseDown={onDragStart}
      onTouchStart={onTouchDragStart}
      onTouchMove={onTouchDragMove}
      onTouchEnd={onTouchDragEnd}
      className={cn(
        'group relative overflow-hidden rounded-2xl border shadow-md transition-all hover:shadow-lg',
        isEntryPast && 'opacity-50 grayscale-[30%]',
        isDragging ? 'cursor-grabbing ring-2 ring-primary' : onDragStart ? 'cursor-grab' : 'cursor-pointer',
        isLocked && 'border-dashed border-2 border-muted-foreground/40',
        isProcessing && 'opacity-80',
        cardSizeClass
      )}
      style={!firstImage ? {
        borderColor: isLocked ? undefined : catColor,
        borderLeftWidth: isLocked ? undefined : 4,
      } : undefined}
    >
      {/* Background */}
      {firstImage ? (
        <div className="absolute inset-0">
          <img src={firstImage} alt={option.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        </div>
      ) : (
        <div className="absolute inset-0" style={{ background: tintBg }} />
      )}

      {/* Content */}
      <div className={cn(
        'relative z-10 p-4',
        firstImage ? 'text-white' : 'text-foreground',
        isProcessing && 'p-3'
      )}>
        {/* Top row: Category + Options indicator */}
        <div className="mb-3 flex items-start justify-between">
          {option.category && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: catColor, color: '#fff' }}
            >
              <span className="text-xs">{catEmoji}</span>
              {isProcessing
                ? (linkedType === 'checkin' ? 'Check-in' : 'Checkout')
                : catName
              }
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
        <h3 className={cn(
          'mb-2 flex items-center gap-2 font-display font-bold leading-tight',
          isProcessing ? 'text-sm' : 'text-lg'
        )}>
          {!option.category && <span className="text-xl">{catEmoji}</span>}
          {option.name}
        </h3>

        {/* Transfer FROM → TO display */}
        {isTransfer && (option.departure_location || option.arrival_location) && (
          <div className={cn(
            'mb-2 flex items-center gap-1.5 text-xs',
            firstImage ? 'text-white/80' : 'text-muted-foreground'
          )}>
            <span>{option.departure_location}</span>
            <ArrowRight className="h-3 w-3" />
            <span>{option.arrival_location}</span>
          </div>
        )}

        {/* Time / Flight info */}
        {option.category === 'flight' && option.departure_location ? (
          <div className={cn(
            'mb-2 flex items-center gap-1.5 text-xs',
            firstImage ? 'text-white/80' : 'text-muted-foreground'
          )}>
            <Plane className="h-3 w-3" />
            <span>
              {option.departure_location?.split(' - ')[0]}{option.departure_terminal ? ` T${option.departure_terminal}` : ''} {formatTimeInTz(startTime, option.departure_tz)} → {option.arrival_location?.split(' - ')[0]}{option.arrival_terminal ? ` T${option.arrival_terminal}` : ''} {formatTimeInTz(endTime, option.arrival_tz)}
            </span>
          </div>
        ) : !isTransfer && !isProcessing && (
          <div className={cn(
            'mb-2 flex items-center gap-1.5 text-xs',
            firstImage ? 'text-white/80' : 'text-muted-foreground'
          )}>
            <Clock className="h-3 w-3" />
            <span>{formatTime(startTime)} — {formatTime(endTime)}</span>
          </div>
        )}

        {/* Processing: show time compactly */}
        {isProcessing && (
          <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatTime(startTime)} — {formatTime(endTime)}</span>
          </div>
        )}

        {/* Bottom row: Distance + Votes */}
        {!isProcessing && (
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
        )}

        {/* Lock button - always visible on all card types */}
        {canEdit && onToggleLock && (
          <button
            onClick={handleLockClick}
            className={cn(
              'absolute top-1.5 right-1.5 rounded-md p-1 transition-colors z-20',
              firstImage ? 'hover:bg-white/20' : 'hover:bg-muted/50'
            )}
          >
            {isLocked ? (
              <Lock className={cn('h-3.5 w-3.5', firstImage ? 'text-white/70' : 'text-muted-foreground/80')} />
            ) : (
              <LockOpen className={cn('h-3.5 w-3.5', firstImage ? 'text-white/30' : 'text-muted-foreground/30')} />
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default EntryCard;

import { motion } from 'framer-motion';
import { Plane, Lock, LockOpen, ArrowRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EntryOption, EntryWithOptions } from '@/types/trip';
import { findCategory } from '@/lib/categories';

interface FlightGroupCardProps {
  flightOption: EntryOption;
  flightEntry: EntryWithOptions;
  checkinEntry?: EntryWithOptions;
  checkoutEntry?: EntryWithOptions;
  isPast: boolean;
  isDragging?: boolean;
  isLocked?: boolean;
  canEdit?: boolean;
  onToggleLock?: () => void;
  onClick?: () => void;
  onDragStart?: (e: React.MouseEvent) => void;
  onTouchDragStart?: (e: React.TouchEvent) => void;
  onTouchDragMove?: (e: React.TouchEvent) => void;
  onTouchDragEnd?: () => void;
}

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

const FlightGroupCard = ({
  flightOption,
  flightEntry,
  checkinEntry,
  checkoutEntry,
  isPast,
  isDragging,
  isLocked,
  canEdit,
  onToggleLock,
  onClick,
  onDragStart,
  onTouchDragStart,
  onTouchDragMove,
  onTouchDragEnd,
}: FlightGroupCardProps) => {
  const catInfo = findCategory('flight');
  const catColor = catInfo?.color ?? 'hsl(260, 50%, 55%)';
  const firstImage = flightOption.images?.[0]?.image_url;

  const handleLockClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleLock?.();
  };

  const depCode = flightOption.departure_location?.split(' - ')[0] ?? '';
  const arrCode = flightOption.arrival_location?.split(' - ')[0] ?? '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      onMouseDown={onDragStart}
      onTouchStart={onTouchDragStart}
      onTouchMove={onTouchDragMove}
      onTouchEnd={onTouchDragEnd}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border shadow-md transition-all hover:shadow-lg h-full',
        isPast && 'opacity-50 grayscale-[30%]',
        isDragging ? 'cursor-grabbing ring-2 ring-primary' : onDragStart ? 'cursor-grab' : 'cursor-pointer',
        isLocked && 'border-dashed border-2 border-muted-foreground/40',
      )}
      style={{ borderColor: isLocked ? undefined : catColor, borderLeftWidth: isLocked ? undefined : 4 }}
    >
      {/* Check-in section */}
      {checkinEntry && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 text-[10px]"
          style={{ background: `${catColor}0A`, borderBottom: `2px solid ${catColor}30` }}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
          <span className="font-semibold text-muted-foreground/70">Check-in</span>
          <span className="text-muted-foreground/50">
            {depCode}{flightOption.departure_terminal ? ` T${flightOption.departure_terminal}` : ''}
          </span>
          <span className="ml-auto text-muted-foreground/50 flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {formatTimeInTz(checkinEntry.start_time, flightOption.departure_tz)} – {formatTimeInTz(checkinEntry.end_time, flightOption.departure_tz)}
          </span>
        </div>
      )}

      {/* Main flight section */}
      <div className="relative flex-1 min-h-0">
        {firstImage ? (
          <div className="absolute inset-0">
            <img src={firstImage} alt={flightOption.name} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0" style={{ background: `${catColor}22` }} />
        )}

        <div className={cn('relative z-10 p-4', firstImage ? 'text-white' : 'text-foreground')}>
          {/* Category badge */}
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold mb-2"
            style={{ backgroundColor: catColor, color: '#fff' }}
          >
            <Plane className="h-3 w-3" /> Flight
          </span>

          {/* Flight name */}
          <h3 className="mb-1.5 font-display text-lg font-bold leading-tight">
            {flightOption.name}
          </h3>

          {/* Route with times */}
          <div className={cn(
            'flex items-center gap-2 text-sm',
            firstImage ? 'text-white/80' : 'text-muted-foreground'
          )}>
            <span>
              {depCode}{flightOption.departure_terminal ? ` T${flightOption.departure_terminal}` : ''}{' '}
              {formatTimeInTz(flightEntry.start_time, flightOption.departure_tz)}
            </span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0" />
            <span>
              {arrCode}{flightOption.arrival_terminal ? ` T${flightOption.arrival_terminal}` : ''}{' '}
              {formatTimeInTz(flightEntry.end_time, flightOption.arrival_tz)}
            </span>
          </div>
        </div>
      </div>

      {/* Checkout section */}
      {checkoutEntry && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 text-[10px]"
          style={{ background: `${catColor}0A`, borderTop: `2px solid ${catColor}30` }}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
          <span className="font-semibold text-muted-foreground/70">Checkout</span>
          <span className="text-muted-foreground/50">
            {arrCode}{flightOption.arrival_terminal ? ` T${flightOption.arrival_terminal}` : ''}
          </span>
          <span className="ml-auto text-muted-foreground/50 flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {formatTimeInTz(checkoutEntry.start_time, flightOption.arrival_tz)} – {formatTimeInTz(checkoutEntry.end_time, flightOption.arrival_tz)}
          </span>
        </div>
      )}

      {/* Lock button */}
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
    </motion.div>
  );
};

export default FlightGroupCard;

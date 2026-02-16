import { motion } from 'framer-motion';
import { ArrowRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EntryOption, EntryWithOptions } from '@/types/trip';
import { findCategory } from '@/lib/categories';

interface FlightGroupCardProps {
  flightOption: EntryOption;
  flightEntry: EntryWithOptions;
  checkinEntry?: EntryWithOptions;
  checkoutEntry?: EntryWithOptions;
  checkinFraction?: number;
  flightFraction?: number;
  checkoutFraction?: number;
  isPast: boolean;
  isDragging?: boolean;
  isLocked?: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.MouseEvent) => void;
  onTouchDragStart?: (e: React.TouchEvent) => void;
  onTouchDragMove?: (e: React.TouchEvent) => void;
  onTouchDragEnd?: () => void;
  isShaking?: boolean;
}

const formatTimeOnly = (isoString: string, tz: string | null): string => {
  if (!tz) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const formatDuration = (startIso: string, endIso: string): string => {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const FlightGroupCard = ({
  flightOption,
  flightEntry,
  checkinEntry,
  checkoutEntry,
  checkinFraction = 0.25,
  flightFraction = 0.5,
  checkoutFraction = 0.25,
  isPast,
  isDragging,
  isLocked,
  onClick,
  onDragStart,
  onTouchDragStart,
  onTouchDragMove,
  onTouchDragEnd,
  isShaking,
}: FlightGroupCardProps) => {
  const catInfo = findCategory('flight');
  const catColor = catInfo?.color ?? 'hsl(260, 50%, 55%)';
  const firstImage = flightOption.images?.[0]?.image_url;

  const depCode = flightOption.departure_location?.split(' - ')[0] ?? '';
  const arrCode = flightOption.arrival_location?.split(' - ')[0] ?? '';
  const flightDuration = formatDuration(flightEntry.start_time, flightEntry.end_time);

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
        'group relative flex flex-col overflow-hidden rounded-[14px] shadow-md transition-all hover:shadow-lg h-full',
        isPast && 'opacity-50 grayscale-[30%]',
        isDragging ? 'cursor-grabbing ring-2 ring-primary' : onDragStart ? 'cursor-grab' : 'cursor-pointer',
        isLocked && 'border-dashed border-2 border-muted-foreground/40',
        isShaking && 'animate-shake',
      )}
    >
      {/* Check-in section */}
      {checkinEntry && (
        <div
          className="flex items-center gap-2 px-3 text-[11px] min-h-0 overflow-hidden rounded-t-[14px]"
          style={{ flex: checkinFraction, background: `${catColor}0A` }}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
          <span className="font-semibold text-muted-foreground/70 shrink-0">Check-in</span>
          <span className="text-muted-foreground/50 truncate">
            {depCode}{flightOption.departure_terminal ? ` T${flightOption.departure_terminal}` : ''}
          </span>
          <span className="ml-auto text-muted-foreground/50 flex items-center gap-1 shrink-0">
            <Clock className="h-2.5 w-2.5" />
            {formatTimeOnly(checkinEntry.start_time, flightOption.departure_tz)} – {formatTimeOnly(checkinEntry.end_time, flightOption.departure_tz)}
          </span>
        </div>
      )}

      {/* Divider: check-in → flight */}
      {checkinEntry && (
        <div className="h-[2px] shrink-0" style={{ backgroundColor: catColor, opacity: 0.4 }} />
      )}

      {/* Main flight section — diagonal fade */}
      <div className="relative min-h-0 overflow-hidden" style={{ flex: flightFraction }}>
        {/* Layer 1: Image or glossy background */}
        {firstImage ? (
          <>
            <img src={firstImage} alt={flightOption.name} className="absolute inset-0 h-full w-full object-cover" />
            {/* Layer 2: Diagonal fade */}
            <div
              className="absolute inset-0 z-[5]"
              style={{ background: 'linear-gradient(155deg, transparent 22%, rgba(10,8,6,0.25) 32%, rgba(10,8,6,0.68) 42%, rgba(10,8,6,0.92) 52%)' }}
            />
          </>
        ) : (
          <>
            {/* Glossy no-image background */}
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(145deg, hsl(210, 22%, 14%), hsl(210, 10%, 7%))' }}
            />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(152deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.02) 40%, transparent 55%)' }}
            />
          </>
        )}

        {/* Corner flag — top-left, emoji only */}
        <div
          className="absolute top-0 left-0 z-20 flex items-center justify-center px-2 py-1"
          style={{ backgroundColor: catColor, borderRadius: '14px 0 8px 0' }}
        >
          <span className="text-sm">✈️</span>
        </div>

        {/* Duration pill — top-right */}
        <div
          className="absolute top-2 right-2 z-20 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white/90"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          {flightDuration}
        </div>

        {/* Content — LEFT-aligned (boarding pass style) */}
        <div className="relative z-10 p-3 h-full flex flex-col justify-end">
          {/* Flight name/number */}
          <h3 className="text-base font-bold text-white leading-tight truncate mb-1">
            {flightOption.name}
          </h3>

          {/* Route: DEP TIME → ARR TIME */}
          <div className="flex items-center gap-2 text-xs text-white/80 font-medium">
            <span className="shrink-0">
              {depCode}{flightOption.departure_terminal ? ` T${flightOption.departure_terminal}` : ''}{' '}
              {formatTimeOnly(flightEntry.start_time, flightOption.departure_tz)}
            </span>
            <ArrowRight className="h-3 w-3 shrink-0" />
            <span className="shrink-0">
              {arrCode}{flightOption.arrival_terminal ? ` T${flightOption.arrival_terminal}` : ''}{' '}
              {formatTimeOnly(flightEntry.end_time, flightOption.arrival_tz)}
            </span>
          </div>
        </div>
      </div>

      {/* Divider: flight → checkout */}
      {checkoutEntry && (
        <div className="h-[2px] shrink-0" style={{ backgroundColor: catColor, opacity: 0.4 }} />
      )}

      {/* Checkout section */}
      {checkoutEntry && (
        <div
          className="flex items-center gap-2 px-3 text-[11px] min-h-0 overflow-hidden rounded-b-[14px]"
          style={{ flex: checkoutFraction, background: `${catColor}0A` }}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
          <span className="font-semibold text-muted-foreground/70 shrink-0">Checkout</span>
          <span className="text-muted-foreground/50 truncate">
            {arrCode}{flightOption.arrival_terminal ? ` T${flightOption.arrival_terminal}` : ''}
          </span>
          <span className="ml-auto text-muted-foreground/50 flex items-center gap-1 shrink-0">
            <Clock className="h-2.5 w-2.5" />
            {formatTimeOnly(checkoutEntry.start_time, flightOption.arrival_tz)} – {formatTimeOnly(checkoutEntry.end_time, flightOption.arrival_tz)}
          </span>
        </div>
      )}
    </motion.div>
  );
};

export default FlightGroupCard;

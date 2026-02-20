import { motion } from 'framer-motion';
import { ArrowRight, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EntryOption, EntryWithOptions } from '@/types/trip';
import { findCategory } from '@/lib/categories';
import AIRPORTS from '@/lib/airports';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from 'next-themes';

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
  const { toast } = useToast();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const processBarBg = isDark ? 'hsla(210, 50%, 45%, 0.25)' : 'hsla(210, 55%, 55%, 0.15)';
  const processBarBorder = '1px solid hsla(210, 50%, 55%, 0.12)';

  const catInfo = findCategory('flight');
  const catColor = catInfo?.color ?? 'hsl(260, 50%, 55%)';
  const firstImage = flightOption.images?.[0]?.image_url;

  const depCode = flightOption.departure_location?.split(' - ')[0] ?? '';
  const arrCode = flightOption.arrival_location?.split(' - ')[0] ?? '';
  const flightDuration = formatDuration(flightEntry.start_time, flightEntry.end_time);

  const arrCity = AIRPORTS.find(a => a.iata === arrCode.trim().toUpperCase())?.city;
  const displayTitle = arrCity ? `Flight to ${arrCity}` : flightOption.name;

  const handleFlightLockTap = (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    e.stopPropagation();
    toast({ description: "Flights are locked — edit times in the overview" });
  };

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
      {/* Check-in — timeline dot style */}
      {checkinEntry && (
        <div
          className="flex items-center gap-3 px-3 min-h-0 overflow-hidden"
          style={{ flex: checkinFraction, background: processBarBg, borderBottom: processBarBorder }}
        >
          {/* Timeline dot + dashed line going down */}
          <div className="flex flex-col items-center self-stretch py-1">
            <div className="w-2.5 h-2.5 rounded-full border-2 shrink-0"
              style={{ borderColor: catColor, backgroundColor: `${catColor}30` }} />
            <div className="flex-1 w-0 border-l-2 border-dashed"
              style={{ borderColor: `${catColor}40` }} />
          </div>
          {/* Content */}
          <div className="flex-1 flex items-center justify-between min-w-0 py-1">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-foreground/70">Check-in</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {depCode}{flightOption.departure_terminal ? ` T${flightOption.departure_terminal}` : ''}
              </p>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
              {formatTimeOnly(checkinEntry.start_time, flightOption.departure_tz)} – {formatTimeOnly(checkinEntry.end_time, flightOption.departure_tz)}
            </span>
          </div>
        </div>
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
            <img src="/default-flight.jpg" alt="Flight" className="absolute inset-0 h-full w-full object-cover" />
            <div
              className="absolute inset-0 z-[5]"
              style={{ background: 'linear-gradient(155deg, transparent 22%, rgba(10,8,6,0.25) 32%, rgba(10,8,6,0.68) 42%, rgba(10,8,6,0.92) 52%)' }}
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

        {/* Lock-in-pill — always locked on flights */}
        <div
          className="absolute top-[7px] right-[7px] z-20 rounded-full font-bold flex items-center gap-1 cursor-pointer select-none"
          style={{
            fontSize: 10,
            padding: '3px 10px',
            background: 'rgba(224, 138, 58, 0.85)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(224, 138, 58, 0.4)',
            color: '#fff',
          }}
          onClick={handleFlightLockTap}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Lock className="h-2.5 w-2.5" />
          <span>{flightDuration}</span>
        </div>

        {/* Content — RIGHT-aligned at bottom */}
        <div className="relative z-10 p-3 h-full flex flex-col justify-end text-right text-white">
          <h3 className="text-sm font-bold leading-tight truncate mb-1"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
            {displayTitle}
          </h3>
          <div className="flex items-center gap-2 text-xs text-white/80 font-medium justify-end">
            <span className="shrink-0">
              {depCode}{flightOption.departure_terminal ? ` T${flightOption.departure_terminal}` : ''}{' '}
              {formatTimeOnly(flightEntry.start_time, flightOption.departure_tz)}
            </span>
            <ArrowRight className="h-3 w-3 shrink-0 text-white/50" />
            <span className="shrink-0">
              {arrCode}{flightOption.arrival_terminal ? ` T${flightOption.arrival_terminal}` : ''}{' '}
              {formatTimeOnly(flightEntry.end_time, flightOption.arrival_tz)}
            </span>
          </div>
        </div>
      </div>

      {/* Checkout — timeline dot style */}
      {checkoutEntry && (
        <div
          className="flex items-center gap-3 px-3 min-h-0 overflow-hidden"
          style={{ flex: checkoutFraction, background: processBarBg, borderTop: processBarBorder }}
        >
          {/* Dashed line coming from above + dot at bottom */}
          <div className="flex flex-col items-center self-stretch py-1">
            <div className="flex-1 w-0 border-l-2 border-dashed"
              style={{ borderColor: `${catColor}40` }} />
            <div className="w-2.5 h-2.5 rounded-full border-2 shrink-0"
              style={{ borderColor: catColor, backgroundColor: `${catColor}30` }} />
          </div>
          {/* Content */}
          <div className="flex-1 flex items-center justify-between min-w-0 py-1">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-foreground/70">Checkout</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {arrCode}{flightOption.arrival_terminal ? ` T${flightOption.arrival_terminal}` : ''}
              </p>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
              {formatTimeOnly(checkoutEntry.start_time, flightOption.arrival_tz)} – {formatTimeOnly(checkoutEntry.end_time, flightOption.arrival_tz)}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default FlightGroupCard;

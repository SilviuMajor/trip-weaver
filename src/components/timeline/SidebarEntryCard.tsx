import { useRef } from 'react';
import { Copy, GripVertical, ArrowRightToLine, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { findCategory } from '@/lib/categories';
import { Badge } from '@/components/ui/badge';
import type { EntryWithOptions } from '@/types/trip';

interface SidebarEntryCardProps {
  entry: EntryWithOptions;
  onDragStart?: (e: React.DragEvent, entry: EntryWithOptions) => void;
  onClick?: () => void;
  onDuplicate?: (entry: EntryWithOptions) => void;
  onInsert?: (entry: EntryWithOptions) => void;
  onTouchDragStart?: (entry: EntryWithOptions, initialPosition: { x: number; y: number }) => void;
  usageCount?: number;
  isFlight?: boolean;
}

const formatDuration = (startIso: string, endIso: string): string => {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const extractHue = (hslString: string): number => {
  const match = hslString.match(/hsl\((\d+)/);
  return match ? parseInt(match[1]) : 260;
};

const SidebarEntryCard = ({ entry, onDragStart, onClick, onDuplicate, onInsert, onTouchDragStart, usageCount, isFlight }: SidebarEntryCardProps) => {
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const option = entry.options[0];
  if (!option) return null;

  const cat = findCategory(option.category ?? '');
  const emoji = cat?.emoji ?? '📌';
  const color = cat?.color ?? option.category_color ?? 'hsl(260, 50%, 55%)';
  const firstImage = option.images?.[0]?.image_url;
  const hue = extractHue(color);
  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');

  const isScheduled = entry.is_scheduled !== false;
  const dayLabel = isScheduled
    ? `Day ${(entry.scheduled_day ?? 0) + 1}`
    : 'Idea';

  const duration = formatDuration(entry.start_time, entry.end_time);

  // Flights that are scheduled cannot be dragged
  const isDraggable = !(isFlight && isScheduled);

  // Glossy backgrounds
  const glossyBg = isDark
    ? `linear-gradient(145deg, hsl(${hue}, 30%, 16%), hsl(${hue}, 15%, 9%))`
    : `linear-gradient(145deg, hsl(${hue}, 25%, 92%), hsl(${hue}, 15%, 86%))`;
  const glassBg = isDark
    ? 'linear-gradient(152deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.02) 40%, transparent 55%)'
    : 'linear-gradient(152deg, rgba(255,255,255,0.6) 25%, rgba(255,255,255,0.3) 40%, transparent 55%)';
  const glossyBorder = isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)';

  const textColor = firstImage ? 'text-white' : isDark ? 'text-white' : 'text-foreground';
  const subTextColor = firstImage ? 'text-white/70' : isDark ? 'text-white/60' : 'text-muted-foreground';

  // Duration pill style
  const durPillStyle: React.CSSProperties = firstImage
    ? { background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }
    : isDark
      ? { background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }
      : { background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.08)', color: 'hsl(25, 30%, 20%)' };

  return (
    <div
      draggable={isDraggable}
      onDragStart={(e) => isDraggable && onDragStart?.(e, entry)}
      onClick={onClick}
      onContextMenu={(e) => e.preventDefault()}
      onTouchStart={(e) => {
        if (!isDraggable || !onTouchDragStart) return;
        const touch = e.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
        touchTimerRef.current = setTimeout(() => {
          if (touchStartRef.current) {
            onTouchDragStart(entry, touchStartRef.current);
          }
          touchTimerRef.current = null;
        }, 300);
      }}
      onTouchMove={(e) => {
        if (touchTimerRef.current && touchStartRef.current) {
          const touch = e.touches[0];
          const dx = touch.clientX - touchStartRef.current.x;
          const dy = touch.clientY - touchStartRef.current.y;
          if (Math.sqrt(dx * dx + dy * dy) > 10) {
            clearTimeout(touchTimerRef.current);
            touchTimerRef.current = null;
          }
        }
      }}
      onTouchEnd={() => {
        if (touchTimerRef.current) {
          clearTimeout(touchTimerRef.current);
          touchTimerRef.current = null;
        }
      }}
      className={cn(
        'group relative flex flex-col rounded-[14px] overflow-hidden transition-all',
        isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        firstImage ? 'h-[144px]' : 'min-h-[100px]',
        'hover:shadow-lg',
      )}
      style={{
        opacity: isScheduled ? 0.7 : 1,
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
        touchAction: 'manipulation',
      } as React.CSSProperties}
    >
      {/* Background */}
      {firstImage ? (
        <>
          <img src={firstImage} alt={option.name} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 z-[5]" style={{ background: 'linear-gradient(152deg, transparent 25%, rgba(10,8,6,0.3) 35%, rgba(10,8,6,0.7) 50%, rgba(10,8,6,0.92) 65%)' }} />
        </>
      ) : (
        <>
          <div className="absolute inset-0" style={{ background: glossyBg, border: glossyBorder }} />
          <div className="absolute inset-0 z-[5]" style={{ background: glassBg }} />
        </>
      )}

      {/* Corner flag */}
      <div
        className="absolute top-0 left-0 z-20 flex items-center justify-center"
        style={{ background: color, padding: '5px 7px', borderRadius: '14px 0 8px 0' }}
      >
        <span className="text-white" style={{ fontSize: 13, lineHeight: 1 }}>{emoji}</span>
      </div>

      {/* Duration pill — top-right */}
      <div
        className="absolute top-2 right-2 z-20 rounded-full text-[11px] font-bold px-2.5 py-1"
        style={durPillStyle}
      >
        {duration}
      </div>

      {/* Usage count badge */}
      {usageCount != null && usageCount > 1 && (
        <div className="absolute top-8 right-2 z-20">
          <Badge
            variant="secondary"
            className="text-[9px] px-1.5 py-0 h-4 font-bold bg-white/25 text-white border-white/20"
          >
            x{usageCount}
          </Badge>
        </div>
      )}

      {/* Content — bottom-right */}
      <div className={cn(
        'absolute bottom-0 right-0 z-10 text-right max-w-[75%] px-3 py-2.5',
        textColor,
      )}>
        <p className="truncate text-sm font-bold leading-tight" style={{ textShadow: firstImage ? '0 1px 3px rgba(0,0,0,0.3)' : undefined }}>
          {option.name}
        </p>
        {option.location_name && (
          <p className={cn('truncate text-[10px] leading-tight mt-0.5', subTextColor)}>
            📍 {option.location_name}
          </p>
        )}
        {(option as any).rating != null && (
          <p className={cn('text-[10px] leading-tight mt-0.5', subTextColor)}>
            ⭐ {(option as any).rating} ({Number((option as any).user_rating_count ?? 0).toLocaleString()})
          </p>
        )}
      </div>

      {/* Bottom-left: day label + actions */}
      <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5">
        <Badge
          variant={isScheduled ? 'default' : 'secondary'}
          className={cn(
            'text-[9px] px-1.5 py-0 h-4 font-medium',
            'bg-white/20 text-white border-white/20 hover:bg-white/20'
          )}
        >
          {dayLabel}
        </Badge>
      </div>

      {/* Action buttons */}
      <div className="absolute bottom-2 right-2 z-20 flex shrink-0 items-center gap-1">
        {isDraggable && (
          <div className={cn('flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all')}>
            {onInsert && (
              <button
                onClick={(e) => { e.stopPropagation(); onInsert(entry); }}
                className="h-6 w-6 rounded-md flex items-center justify-center text-white/60 hover:bg-white/20 hover:text-white"
                title="Insert on day"
              >
                <ArrowRightToLine className="h-3 w-3" />
              </button>
            )}
            {onDuplicate && (
              <button
                onClick={(e) => { e.stopPropagation(); onDuplicate(entry); }}
                className="h-6 w-6 rounded-md flex items-center justify-center text-white/60 hover:bg-white/20 hover:text-white"
                title="Duplicate entry"
              >
                <Copy className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SidebarEntryCard;

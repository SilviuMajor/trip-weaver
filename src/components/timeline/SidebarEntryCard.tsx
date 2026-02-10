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

const SidebarEntryCard = ({ entry, onDragStart, onClick, onDuplicate, onInsert, usageCount, isFlight }: SidebarEntryCardProps) => {
  const option = entry.options[0];
  if (!option) return null;

  const cat = findCategory(option.category ?? '');
  const emoji = cat?.emoji ?? '📌';
  const color = cat?.color ?? option.category_color ?? 'hsl(260, 50%, 55%)';
  const firstImage = option.images?.[0]?.image_url;

  const isScheduled = entry.is_scheduled !== false;
  const dayLabel = isScheduled
    ? `Day ${(entry.scheduled_day ?? 0) + 1}`
    : 'Idea';

  const duration = formatDuration(entry.start_time, entry.end_time);

  // Flights that are scheduled cannot be dragged
  const isDraggable = !(isFlight && isScheduled);

  return (
    <div
      draggable={isDraggable}
      onDragStart={(e) => isDraggable && onDragStart?.(e, entry)}
      onClick={onClick}
      className={cn(
        'group relative flex flex-col rounded-xl border border-border overflow-hidden transition-all',
        isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        firstImage ? 'h-[144px]' : 'min-h-[100px]',
        'hover:shadow-lg',
      )}
      style={{
        opacity: isScheduled ? 0.7 : 1,
        ...((!firstImage) ? { borderLeftWidth: 3, borderLeftColor: color } : {}),
      }}
    >
      {/* Usage count badge */}
      {usageCount != null && usageCount > 1 && (
        <div className="absolute top-1.5 right-1.5 z-20">
          <Badge
            variant="secondary"
            className={cn(
              'text-[9px] px-1.5 py-0 h-4 font-bold',
              firstImage
                ? 'bg-white/25 text-white border-white/20'
                : 'bg-primary/15 text-primary border-primary/20'
            )}
          >
            x{usageCount}
          </Badge>
        </div>
      )}

      {/* Image background */}
      {firstImage && (
        <div className="absolute inset-0">
          <img src={firstImage} alt={option.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
        </div>
      )}

      {/* Content */}
      <div className={cn(
        'relative z-10 flex w-full flex-1 flex-col justify-between px-3 py-2.5',
        firstImage ? 'text-white' : 'text-foreground',
      )}>
        <div className="flex items-start gap-2">
          {isDraggable ? (
            <GripVertical className={cn(
              'h-3.5 w-3.5 shrink-0 mt-0.5',
              firstImage ? 'text-white/40' : 'text-muted-foreground/30'
            )} />
          ) : (
            <Check className={cn(
              'h-3.5 w-3.5 shrink-0 mt-0.5',
              firstImage ? 'text-white/50' : 'text-muted-foreground/40'
            )} />
          )}

          {!firstImage && (
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {emoji}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className={cn(
              'truncate text-sm font-semibold leading-tight',
              firstImage && 'text-white drop-shadow-sm'
            )}>
              {firstImage && <span className="mr-1">{emoji}</span>}
              {option.name}
            </p>
            {option.location_name && (
              <p className={cn(
                'truncate text-[10px] leading-tight mt-0.5',
                firstImage ? 'text-white/70' : 'text-muted-foreground'
              )}>
                📍 {option.location_name}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1.5">
            <Badge
              variant={isScheduled ? 'default' : 'secondary'}
              className={cn(
                'text-[9px] px-1.5 py-0 h-4 font-medium',
                firstImage
                  ? isScheduled
                    ? 'bg-white/20 text-white border-white/20 hover:bg-white/20'
                    : 'bg-white/10 text-white/80 hover:bg-white/10'
                  : isScheduled
                    ? 'bg-primary/15 text-primary border-primary/20 hover:bg-primary/15'
                    : 'bg-muted text-muted-foreground hover:bg-muted'
              )}
            >
              {dayLabel}
            </Badge>
            <span className={cn(
              'text-[10px] font-bold',
              firstImage ? 'text-white/60' : 'text-muted-foreground/60'
            )}>
              {duration}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onInsert && isDraggable && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onInsert(entry);
                }}
                className={cn(
                  'h-6 w-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all',
                  firstImage
                    ? 'text-white/60 hover:bg-white/20 hover:text-white'
                    : 'text-muted-foreground/50 hover:bg-accent hover:text-foreground'
                )}
                title="Insert on day"
              >
                <ArrowRightToLine className="h-3 w-3" />
              </button>
            )}
            {onDuplicate && isDraggable && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(entry);
                }}
                className={cn(
                  'h-6 w-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all',
                  firstImage
                    ? 'text-white/60 hover:bg-white/20 hover:text-white'
                    : 'text-muted-foreground/50 hover:bg-accent hover:text-foreground'
                )}
                title="Duplicate entry"
              >
                <Copy className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SidebarEntryCard;

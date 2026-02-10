import { Copy, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { findCategory } from '@/lib/categories';
import { Badge } from '@/components/ui/badge';
import type { EntryWithOptions } from '@/types/trip';

interface SidebarEntryCardProps {
  entry: EntryWithOptions;
  onDragStart?: (e: React.DragEvent, entry: EntryWithOptions) => void;
  onClick?: () => void;
  onDuplicate?: (entry: EntryWithOptions) => void;
}

const SidebarEntryCard = ({ entry, onDragStart, onClick, onDuplicate }: SidebarEntryCardProps) => {
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

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart?.(e, entry)}
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-xl border border-border overflow-hidden transition-all cursor-grab active:cursor-grabbing hover:shadow-lg',
        firstImage ? 'h-[72px]' : 'h-auto',
      )}
      style={!firstImage ? { borderLeftWidth: 3, borderLeftColor: color } : undefined}
    >
      {/* Image background */}
      {firstImage && (
        <div className="absolute inset-0">
          <img src={firstImage} alt={option.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
        </div>
      )}

      {/* Content */}
      <div className={cn(
        'relative z-10 flex w-full items-center gap-2.5 px-2.5 py-2.5',
        firstImage ? 'text-white' : 'text-foreground',
      )}>
        <GripVertical className={cn(
          'h-3.5 w-3.5 shrink-0',
          firstImage ? 'text-white/40' : 'text-muted-foreground/30'
        )} />

        {!firstImage && (
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs"
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

        <div className="flex shrink-0 items-center gap-1">
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
          {onDuplicate && (
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
  );
};

export default SidebarEntryCard;

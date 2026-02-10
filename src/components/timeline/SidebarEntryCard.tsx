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
        'group flex items-center gap-2 rounded-lg border border-border bg-card p-2.5 transition-all cursor-grab active:cursor-grabbing hover:shadow-md',
      )}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30" />
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">{option.name}</p>
        {option.location_name && (
          <p className="truncate text-[10px] text-muted-foreground leading-tight">
            📍 {option.location_name}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Badge
          variant={isScheduled ? 'default' : 'secondary'}
          className={cn(
            'text-[9px] px-1.5 py-0 h-4 font-medium',
            isScheduled
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
            className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-foreground transition-all"
            title="Duplicate entry"
          >
            <Copy className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
};

export default SidebarEntryCard;

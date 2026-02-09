import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { findCategory } from '@/lib/categories';
import type { EntryWithOptions } from '@/types/trip';

interface IdeaCardProps {
  entry: EntryWithOptions;
  isAlternative?: boolean;
  activeOptionName?: string;
  onDragStart?: (e: React.DragEvent, entry: EntryWithOptions) => void;
  onClick?: () => void;
}

const IdeaCard = ({ entry, isAlternative, activeOptionName, onDragStart, onClick }: IdeaCardProps) => {
  const option = entry.options[0];
  if (!option) return null;

  const cat = findCategory(option.category ?? '');
  const emoji = cat?.emoji ?? '📌';
  const color = cat?.color ?? option.category_color ?? 'hsl(260, 50%, 55%)';

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart?.(e, entry)}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-xl border border-border bg-card p-3 transition-all cursor-grab active:cursor-grabbing hover:shadow-md',
        isAlternative && 'opacity-60 border-dashed'
      )}
    >
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{option.name}</p>
        {isAlternative && activeOptionName && (
          <p className="truncate text-[10px] text-muted-foreground">
            Alt. to: {activeOptionName}
          </p>
        )}
        {option.location_name && !isAlternative && (
          <p className="truncate text-[10px] text-muted-foreground">
            📍 {option.location_name}
          </p>
        )}
        {entry.scheduled_day !== null && entry.scheduled_day !== undefined && (
          <p className="text-[10px] text-muted-foreground">
            Day {entry.scheduled_day + 1}
          </p>
        )}
      </div>
    </div>
  );
};

export default IdeaCard;

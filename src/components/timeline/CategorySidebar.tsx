import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import type { EntryWithOptions, Trip } from '@/types/trip';
import PlannerContent from './PlannerContent';
import { cn } from '@/lib/utils';

interface CategorySidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: EntryWithOptions[];
  trip: Trip | null;
  onDragStart: (e: React.DragEvent, entry: EntryWithOptions) => void;
  onCardTap?: (entry: EntryWithOptions) => void;
  onAddEntry?: (categoryId: string) => void;
  onDuplicate?: (entry: EntryWithOptions) => void;
  onInsert?: (entry: EntryWithOptions) => void;
  onTouchDragStart?: (entry: EntryWithOptions, initialPosition: { x: number; y: number }) => void;
  compact?: boolean;
  hiddenForDrag?: boolean;
}

const CategorySidebar = ({
  open,
  onOpenChange,
  entries,
  trip,
  onDragStart,
  onCardTap,
  onAddEntry,
  onDuplicate,
  onInsert,
  onTouchDragStart,
  compact = false,
  hiddenForDrag,
}: CategorySidebarProps) => {
  const isMobile = useIsMobile();

  const panelContent = (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 backdrop-blur-sm px-3 py-2.5">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onOpenChange(false)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-1 items-center gap-2 text-base font-semibold">
          <ClipboardList className="h-4 w-4 text-primary" />
          Planner
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        <PlannerContent
          entries={entries}
          trip={trip}
          isEditor={!!onAddEntry}
          onCardTap={(e) => onCardTap?.(e)}
          onAddEntry={onAddEntry}
          onDragStart={onDragStart}
          onDuplicate={onDuplicate}
          onInsert={onInsert}
          onTouchDragStart={onTouchDragStart}
        />
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[60vw] min-w-[280px] overflow-y-auto p-0" forceHide={hiddenForDrag}>
          <SheetHeader className="sr-only">
            <SheetTitle>Planner</SheetTitle>
          </SheetHeader>
          {panelContent}
        </SheetContent>
      </Sheet>
    );
  }

  if (!open) return null;

  return (
    <div
      className={cn(
        'shrink-0 border-l border-border bg-background flex flex-col overflow-hidden transition-all duration-300',
        open
          ? compact
            ? 'w-[25vw]'
            : 'w-[30vw] max-w-[500px]'
          : 'w-0'
      )}
      style={{ height: '100%' }}
    >
      {open && panelContent}
    </div>
  );
};

export default CategorySidebar;

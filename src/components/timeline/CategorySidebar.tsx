import { useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { LayoutList, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { PREDEFINED_CATEGORIES, type CategoryDef } from '@/lib/categories';
import type { EntryWithOptions, Trip, CategoryPreset } from '@/types/trip';
import SidebarEntryCard from './SidebarEntryCard';
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
}: CategorySidebarProps) => {
  const isMobile = useIsMobile();

  // Build full category list: predefined (minus airport_processing) + custom
  const allCategories = useMemo(() => {
    const cats: CategoryDef[] = PREDEFINED_CATEGORIES.filter(c => c.id !== 'airport_processing');
    const custom = (trip?.category_presets as CategoryPreset[] | null) ?? [];
    custom.forEach((c, i) => {
      cats.push({
        id: `custom_${i}`,
        name: c.name,
        emoji: c.emoji || '📌',
        color: c.color,
        defaultDurationMin: 60,
        defaultStartHour: 10,
        defaultStartMin: 0,
      });
    });
    return cats;
  }, [trip?.category_presets]);

  // Group entries by category
  const grouped = useMemo(() => {
    const map = new Map<string, EntryWithOptions[]>();
    // Init all categories
    for (const cat of allCategories) {
      map.set(cat.id, []);
    }
    map.set('other', []);

    for (const entry of entries) {
      const catId = entry.options[0]?.category;
      // Skip airport_processing entries (they're linked to flights)
      if (catId === 'airport_processing') continue;

      if (catId && map.has(catId)) {
        map.get(catId)!.push(entry);
      } else if (catId) {
        // Check if it's a custom category by name match
        const customMatch = allCategories.find(c => c.id === catId || c.name.toLowerCase() === catId.toLowerCase());
        if (customMatch) {
          map.get(customMatch.id)!.push(entry);
        } else {
          map.get('other')!.push(entry);
        }
      } else {
        map.get('other')!.push(entry);
      }
    }
    return map;
  }, [entries, allCategories]);

  const unscheduledCount = entries.filter(e => e.is_scheduled === false).length;

  const panelContent = (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center gap-2 font-display text-lg font-semibold">
          <LayoutList className="h-5 w-5 text-primary" />
          All Entries
          {unscheduledCount > 0 && (
            <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {unscheduledCount} ideas
            </span>
          )}
        </div>
        {!isMobile && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Category sections */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {allCategories.map(cat => {
          const catEntries = grouped.get(cat.id) ?? [];
          return (
            <div key={cat.id}>
              {/* Category header */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{cat.emoji}</span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {cat.name}
                  </span>
                  {catEntries.length > 0 && (
                    <span className="text-[10px] text-muted-foreground/60">
                      ({catEntries.length})
                    </span>
                  )}
                </div>
                {onAddEntry && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => onAddEntry(cat.id)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              {/* Entry cards */}
              {catEntries.length > 0 ? (
                <div className="space-y-1.5">
                  {catEntries.map(entry => (
                    <SidebarEntryCard
                      key={entry.id}
                      entry={entry}
                      onDragStart={onDragStart}
                      onClick={() => onCardTap?.(entry)}
                      onDuplicate={onDuplicate}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground/40 pl-6 py-1">No entries</p>
              )}
            </div>
          );
        })}

        {/* Other / uncategorized */}
        {(grouped.get('other')?.length ?? 0) > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-sm">📌</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Other
              </span>
              <span className="text-[10px] text-muted-foreground/60">
                ({grouped.get('other')!.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {grouped.get('other')!.map(entry => (
                <SidebarEntryCard
                  key={entry.id}
                  entry={entry}
                  onDragStart={onDragStart}
                  onClick={() => onCardTap?.(entry)}
                  onDuplicate={onDuplicate}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Mobile: Sheet overlay
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:w-[380px] overflow-y-auto p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>All Entries</SheetTitle>
          </SheetHeader>
          {panelContent}
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: persistent sidebar
  if (!open) return null;

  return (
    <div
      className={cn(
        'shrink-0 border-l border-border bg-background overflow-hidden transition-all duration-300',
        'w-[320px]'
      )}
    >
      {panelContent}
    </div>
  );
};

export default CategorySidebar;

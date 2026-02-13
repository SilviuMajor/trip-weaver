import { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ArrowLeft, ClipboardList, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { PREDEFINED_CATEGORIES, type CategoryDef } from '@/lib/categories';
import type { EntryWithOptions, Trip, CategoryPreset } from '@/types/trip';
import SidebarEntryCard from './SidebarEntryCard';
import { cn } from '@/lib/utils';

type FilterTab = 'all' | 'ideas' | 'scheduled';

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
  onTouchDragStart?: (entry: EntryWithOptions) => void;
  compact?: boolean;
}

interface DeduplicatedEntry {
  original: EntryWithOptions;
  usageCount: number;
  isFlight: boolean;
}

const alwaysShowCategories = ['hotel'];

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
}: CategorySidebarProps) => {
  const isMobile = useIsMobile();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  // Debug: log entries reaching sidebar
  console.log('[CategorySidebar] entries:', entries.map(e => ({ id: e.id, cat: e.options[0]?.category, name: e.options[0]?.name })));

  // Build full category list
  const allCategories = useMemo(() => {
    const cats: CategoryDef[] = PREDEFINED_CATEGORIES.filter(c => c.id !== 'airport_processing' && c.id !== 'transport' && c.id !== 'transfer');
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

  // Filter entries by tab
  const filteredEntries = useMemo(() => {
    if (activeFilter === 'ideas') return entries.filter(e => e.is_scheduled === false);
    if (activeFilter === 'scheduled') return entries.filter(e => e.is_scheduled !== false);
    return entries;
  }, [entries, activeFilter]);

  // Deduplicate: group by name+category, keep original (earliest), count usage
  const deduplicatedMap = useMemo(() => {
    const groups = new Map<string, EntryWithOptions[]>();
    for (const entry of entries) {
      const opt = entry.options[0];
      if (!opt) continue;
      const key = `${opt.name}::${opt.category ?? ''}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(entry);
    }
    // Map entry id -> DeduplicatedEntry for the original
    const result = new Map<string, DeduplicatedEntry>();
    for (const [, group] of groups) {
      const sorted = [...group].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const original = sorted[0];
      const isFlight = original.options[0]?.category === 'flight';
      result.set(original.id, {
        original,
        usageCount: group.length,
        isFlight,
      });
    }
    return result;
  }, [entries]);

  // Get deduplicated entries that pass the current filter
  const getFilteredOriginals = (catEntries: EntryWithOptions[]): DeduplicatedEntry[] => {
    const seen = new Set<string>();
    const results: DeduplicatedEntry[] = [];
    for (const entry of catEntries) {
      const opt = entry.options[0];
      if (!opt) continue;
      // Hotel entries: dedup by hotel_id when available, else by name
      let key: string;
      if (opt.category === 'hotel' && opt.hotel_id) {
        key = `hotel::${opt.hotel_id}`;
      } else {
        key = `${opt.name}::${opt.category ?? ''}`;
      }
      if (seen.has(key)) continue;
      seen.add(key);

      // For hotel groups, prefer an overnight block as representative
      if (opt.category === 'hotel' && opt.hotel_id) {
        const hotelEntries = catEntries.filter(e => e.options[0]?.hotel_id === opt.hotel_id);
        const overnight = hotelEntries.find(e => {
          const name = e.options[0]?.name ?? '';
          return !name.startsWith('Check in ·') && !name.startsWith('Check out ·');
        });
        const representative = overnight ?? hotelEntries[0];
        const isFlight = false;
        results.push({
          original: representative,
          usageCount: hotelEntries.length,
          isFlight,
        });
      } else {
        // Find the original from dedup map
        const dedup = [...deduplicatedMap.values()].find(d => {
          const dOpt = d.original.options[0];
          if (!dOpt) return false;
          const dKey = `${dOpt.name}::${dOpt.category ?? ''}`;
          return dKey === key;
        });
        if (dedup) results.push(dedup);
      }
    }
    return results;
  };

  // Group filtered entries by category
  const grouped = useMemo(() => {
    const map = new Map<string, EntryWithOptions[]>();
    for (const cat of allCategories) map.set(cat.id, []);
    map.set('other', []);

    for (const entry of filteredEntries) {
      const catId = entry.options[0]?.category;
      if (catId === 'airport_processing' || catId === 'transport' || catId === 'transfer') continue;
      if (catId && map.has(catId)) {
        map.get(catId)!.push(entry);
      } else if (catId) {
        const customMatch = allCategories.find(c => c.id === catId || c.name.toLowerCase() === catId.toLowerCase());
        if (customMatch) map.get(customMatch.id)!.push(entry);
        else map.get('other')!.push(entry);
      } else {
        map.get('other')!.push(entry);
      }
    }
    return map;
  }, [filteredEntries, allCategories]);

  // Counts for tabs
  const ideasCount = entries.filter(e => e.is_scheduled === false).length;
  const scheduledCount = entries.filter(e => e.is_scheduled !== false).length;
  const totalCount = entries.filter(e => {
    const catId = e.options[0]?.category;
    return catId !== 'airport_processing' && catId !== 'transport' && catId !== 'transfer';
  }).length;

  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: totalCount },
    { key: 'ideas', label: 'Not Used', count: ideasCount },
    { key: 'scheduled', label: 'Scheduled', count: scheduledCount },
  ];

  const panelContent = (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 backdrop-blur-sm px-3 py-2.5">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onOpenChange(false)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-1 items-center gap-2 font-display text-base font-semibold">
          <ClipboardList className="h-4 w-4 text-primary" />
          Planner
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border">
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              activeFilter === tab.key
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Category sections */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {allCategories.map(cat => {
          const catEntries = grouped.get(cat.id) ?? [];
          const dedupedEntries = getFilteredOriginals(catEntries);
          if (dedupedEntries.length === 0 && !alwaysShowCategories.includes(cat.id)) return null;

          return (
            <div key={cat.id}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{cat.emoji}</span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {cat.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    ({dedupedEntries.length})
                  </span>
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
              {dedupedEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 italic pl-6">No hotel added yet</p>
              ) : (
                <div className="space-y-1.5">
                  {dedupedEntries.map(({ original, usageCount, isFlight }) => (
                    <SidebarEntryCard
                      key={original.id}
                      entry={original}
                      onDragStart={onDragStart}
                      onClick={() => onCardTap?.(original)}
                      onDuplicate={isFlight ? undefined : onDuplicate}
                      onInsert={isFlight ? undefined : onInsert}
                      onTouchDragStart={onTouchDragStart}
                      usageCount={usageCount}
                      isFlight={isFlight}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Other / uncategorized */}
        {(() => {
          const otherEntries = grouped.get('other') ?? [];
          const dedupedOther = getFilteredOriginals(otherEntries);
          if (dedupedOther.length === 0) return null;
          return (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-sm">📌</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Other
                </span>
                <span className="text-[10px] text-muted-foreground/60">
                  ({dedupedOther.length})
                </span>
              </div>
              <div className="space-y-1.5">
                {dedupedOther.map(({ original, usageCount, isFlight }) => (
                  <SidebarEntryCard
                    key={original.id}
                    entry={original}
                    onDragStart={onDragStart}
                    onClick={() => onCardTap?.(original)}
                    onDuplicate={isFlight ? undefined : onDuplicate}
                    onInsert={isFlight ? undefined : onInsert}
                    onTouchDragStart={onTouchDragStart}
                    usageCount={usageCount}
                    isFlight={isFlight}
                  />
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[60vw] min-w-[280px] overflow-y-auto p-0">
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

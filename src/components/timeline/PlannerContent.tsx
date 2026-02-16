import { useMemo, useState } from 'react';
import { Search, Plus, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { PICKER_CATEGORIES, type CategoryDef } from '@/lib/categories';
import { cn } from '@/lib/utils';
import SidebarEntryCard from './SidebarEntryCard';
import type { EntryWithOptions, Trip, CategoryPreset } from '@/types/trip';

interface PlannerContentProps {
  entries: EntryWithOptions[];
  trip: Trip | null;
  isEditor: boolean;
  onCardTap: (entry: EntryWithOptions) => void;
  onAddEntry?: (categoryId: string) => void;
  onExploreOpen?: (categoryId: string | null) => void;
  onDragStart: (e: React.DragEvent, entry: EntryWithOptions) => void;
  onDuplicate?: (entry: EntryWithOptions) => void;
  onInsert?: (entry: EntryWithOptions) => void;
  onTouchDragStart?: (entry: EntryWithOptions, initialPosition: { x: number; y: number }) => void;
}

interface DeduplicatedEntry {
  original: EntryWithOptions;
  usageCount: number;
  isFlight: boolean;
}

const alwaysShowCategories = ['hotel'];
const EXCLUDED_CATEGORIES = ['airport_processing', 'transport', 'transfer'];

const PlannerContent = ({
  entries,
  trip,
  isEditor,
  onCardTap,
  onAddEntry,
  onExploreOpen,
  onDragStart,
  onDuplicate,
  onInsert,
  onTouchDragStart,
}: PlannerContentProps) => {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [timelineOpen, setTimelineOpen] = useState(false);

  // Build full category list
  const allCategories = useMemo(() => {
    const cats: CategoryDef[] = [...PICKER_CATEGORIES];
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

  // Sort categories by time-of-day relevance
  const sortedCategories = useMemo(() => {
    const currentHour = new Date().getHours();

    const getCategoryRelevance = (cat: CategoryDef): number => {
      const diff = Math.abs(cat.defaultStartHour - currentHour);
      return Math.min(diff, 24 - diff);
    };

    const pinToBottom = ['flight', 'hotel'];
    const normal: CategoryDef[] = [];
    const custom: CategoryDef[] = [];
    const bottom: CategoryDef[] = [];

    for (const cat of allCategories) {
      if (pinToBottom.includes(cat.id)) bottom.push(cat);
      else if (cat.id.startsWith('custom_')) custom.push(cat);
      else normal.push(cat);
    }

    normal.sort((a, b) => getCategoryRelevance(a) - getCategoryRelevance(b));

    return [...normal, ...custom, ...bottom];
  }, [allCategories]);

  // Deduplicate with hotel_id grouping
  const deduplicatedMap = useMemo(() => {
    const groups = new Map<string, EntryWithOptions[]>();
    for (const entry of entries) {
      const opt = entry.options[0];
      if (!opt) continue;
      const key = `${opt.name}::${opt.category ?? ''}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(entry);
    }
    const result = new Map<string, DeduplicatedEntry>();
    for (const [, group] of groups) {
      const sorted = [...group].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const original = sorted[0];
      result.set(original.id, {
        original,
        usageCount: group.length,
        isFlight: original.options[0]?.category === 'flight',
      });
    }
    return result;
  }, [entries]);

  const getFilteredOriginals = (catEntries: EntryWithOptions[]): DeduplicatedEntry[] => {
    const seen = new Set<string>();
    const results: DeduplicatedEntry[] = [];
    for (const entry of catEntries) {
      const opt = entry.options[0];
      if (!opt) continue;
      let key: string;
      if (opt.category === 'hotel' && opt.hotel_id) {
        key = `hotel::${opt.hotel_id}`;
      } else {
        key = `${opt.name}::${opt.category ?? ''}`;
      }
      if (seen.has(key)) continue;
      seen.add(key);

      if (opt.category === 'hotel' && opt.hotel_id) {
        const hotelEntries = catEntries.filter(e => e.options[0]?.hotel_id === opt.hotel_id);
        const overnight = hotelEntries.find(e => {
          const name = e.options[0]?.name ?? '';
          return !name.startsWith('Check in ·') && !name.startsWith('Check out ·');
        });
        const representative = overnight ?? hotelEntries[0];
        results.push({ original: representative, usageCount: hotelEntries.length, isFlight: false });
      } else {
        const dedup = [...deduplicatedMap.values()].find(d => {
          const dOpt = d.original.options[0];
          if (!dOpt) return false;
          return `${dOpt.name}::${dOpt.category ?? ''}` === key;
        });
        if (dedup) results.push(dedup);
      }
    }
    return results;
  };

  // Group entries by scheduled status, then by category
  const groupByCategory = (entryList: EntryWithOptions[]) => {
    const map = new Map<string, EntryWithOptions[]>();
    for (const cat of allCategories) map.set(cat.id, []);
    map.set('other', []);
    for (const entry of entryList) {
      const catId = entry.options[0]?.category;
      if (EXCLUDED_CATEGORIES.includes(catId ?? '')) continue;
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
  };

  const unscheduled = useMemo(() => entries.filter(e => e.is_scheduled === false), [entries]);
  const scheduled = useMemo(() => entries.filter(e => e.is_scheduled !== false), [entries]);

  const unscheduledGrouped = useMemo(() => groupByCategory(unscheduled), [unscheduled, allCategories]);
  const scheduledGrouped = useMemo(() => groupByCategory(scheduled), [scheduled, allCategories]);

  const scheduledCount = useMemo(() =>
    scheduled.filter(e => {
      const catId = e.options[0]?.category;
      return !EXCLUDED_CATEGORIES.includes(catId ?? '');
    }).length
  , [scheduled]);

  const cardWidth = isMobile ? 'w-[160px]' : 'w-[180px]';

  const renderCategoryRow = (cat: { id: string; name: string; emoji: string }, grouped: Map<string, EntryWithOptions[]>, showAlwaysShow: boolean) => {
    const catEntries = grouped.get(cat.id) ?? [];
    const dedupedEntries = getFilteredOriginals(catEntries);
    if (dedupedEntries.length === 0 && !(showAlwaysShow && alwaysShowCategories.includes(cat.id))) return null;

    return (
      <div key={cat.id}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{cat.emoji}</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat.name}</span>
            <span className="text-[10px] text-muted-foreground/60">({dedupedEntries.length})</span>
          </div>
          {onAddEntry && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => {
              const bypassCategories = ['hotel', 'flight'];
              if (bypassCategories.includes(cat.id)) {
                onAddEntry(cat.id);
              } else {
                onExploreOpen?.(cat.id);
              }
            }}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        {dedupedEntries.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic pl-6">No hotel added yet</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            {dedupedEntries.map(({ original, usageCount, isFlight }) => {
              const isCompact = original.options[0]?.category === 'flight' || original.options[0]?.category === 'hotel';
              return (
                <div key={original.id} className={cn(isCompact ? 'w-[140px]' : cardWidth, 'shrink-0')}>
                  <SidebarEntryCard
                    entry={original}
                    onDragStart={onDragStart}
                    onClick={() => onCardTap(original)}
                    onDuplicate={isFlight ? undefined : onDuplicate}
                    onInsert={isFlight ? undefined : onInsert}
                    onTouchDragStart={onTouchDragStart}
                    usageCount={usageCount}
                    isFlight={isFlight}
                    compact={isCompact}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderOtherRow = (grouped: Map<string, EntryWithOptions[]>) => {
    const otherEntries = grouped.get('other') ?? [];
    const dedupedOther = getFilteredOriginals(otherEntries);
    if (dedupedOther.length === 0) return null;
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-sm">📌</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Other</span>
          <span className="text-[10px] text-muted-foreground/60">({dedupedOther.length})</span>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          {dedupedOther.map(({ original, usageCount, isFlight }) => (
            <div key={original.id} className={cn(cardWidth, 'shrink-0')}>
              <SidebarEntryCard
                entry={original}
                onDragStart={onDragStart}
                onClick={() => onCardTap(original)}
                onDuplicate={isFlight ? undefined : onDuplicate}
                onInsert={isFlight ? undefined : onInsert}
                onTouchDragStart={onTouchDragStart}
                usageCount={usageCount}
                isFlight={isFlight}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search toolbar */}
      <div className="flex items-center justify-end px-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => onExploreOpen?.(null)}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* Unscheduled section */}
      {sortedCategories.map(cat => renderCategoryRow(cat, unscheduledGrouped, true))}
      {renderOtherRow(unscheduledGrouped)}

      {/* On timeline collapsible */}
      {scheduledCount > 0 && (
        <Collapsible open={timelineOpen} onOpenChange={setTimelineOpen}>
          <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted/50 transition-colors">
            <ChevronDown className={cn('h-4 w-4 transition-transform', timelineOpen && 'rotate-180')} />
            On timeline ({scheduledCount})
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2">
            {sortedCategories.map(cat => renderCategoryRow(cat, scheduledGrouped, false))}
            {renderOtherRow(scheduledGrouped)}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

export default PlannerContent;

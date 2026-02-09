import { useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Lightbulb } from 'lucide-react';
import type { EntryWithOptions } from '@/types/trip';
import IdeaCard from './IdeaCard';

interface IdeasPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: EntryWithOptions[];
  scheduledEntries: EntryWithOptions[];
  onDragStart: (e: React.DragEvent, entry: EntryWithOptions) => void;
  onCardTap?: (entry: EntryWithOptions) => void;
}

const IdeasPanel = ({
  open,
  onOpenChange,
  entries,
  scheduledEntries,
  onDragStart,
  onCardTap,
}: IdeasPanelProps) => {
  // Find active entries for option groups
  const activeByGroup = useMemo(() => {
    const map = new Map<string, EntryWithOptions>();
    for (const e of scheduledEntries) {
      if (e.option_group_id) {
        map.set(e.option_group_id, e);
      }
    }
    return map;
  }, [scheduledEntries]);

  // Split into unassigned and day-assigned
  const unassigned = entries.filter(e => e.scheduled_day === null || e.scheduled_day === undefined);
  const byDay = useMemo(() => {
    const map = new Map<number, EntryWithOptions[]>();
    for (const e of entries) {
      if (e.scheduled_day !== null && e.scheduled_day !== undefined) {
        const arr = map.get(e.scheduled_day) ?? [];
        arr.push(e);
        map.set(e.scheduled_day, arr);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [entries]);

  const getAlternativeInfo = (entry: EntryWithOptions) => {
    if (!entry.option_group_id) return null;
    const active = activeByGroup.get(entry.option_group_id);
    if (!active || active.id === entry.id) return null;
    return active.options[0]?.name ?? 'scheduled option';
  };

  const totalCount = entries.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[340px] sm:w-[380px] overflow-y-auto p-0">
        <SheetHeader className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm px-4 py-3">
          <SheetTitle className="flex items-center gap-2 font-display text-lg">
            <Lightbulb className="h-5 w-5 text-primary" />
            Ideas
            {totalCount > 0 && (
              <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {totalCount}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-1 p-4">
          {totalCount === 0 && (
            <div className="py-12 text-center">
              <Lightbulb className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No ideas yet</p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Add entries to the ideas panel when creating activities
              </p>
            </div>
          )}

          {/* Unassigned entries */}
          {unassigned.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Unassigned
              </p>
              {unassigned.map(entry => (
                <IdeaCard
                  key={entry.id}
                  entry={entry}
                  isAlternative={!!getAlternativeInfo(entry)}
                  activeOptionName={getAlternativeInfo(entry) ?? undefined}
                  onDragStart={onDragStart}
                  onClick={() => onCardTap?.(entry)}
                />
              ))}
            </div>
          )}

          {/* Day-assigned entries */}
          {byDay.map(([day, dayEntries]) => (
            <Collapsible key={day} defaultOpen>
              <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                Day {day + 1} ideas
                <ChevronDown className="h-3.5 w-3.5 transition-transform [[data-state=open]>&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2">
                {dayEntries.map(entry => (
                  <IdeaCard
                    key={entry.id}
                    entry={entry}
                    isAlternative={!!getAlternativeInfo(entry)}
                    activeOptionName={getAlternativeInfo(entry) ?? undefined}
                    onDragStart={onDragStart}
                    onClick={() => onCardTap?.(entry)}
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default IdeasPanel;

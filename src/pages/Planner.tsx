import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { PREDEFINED_CATEGORIES, type CategoryDef } from '@/lib/categories';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import TimelineHeader from '@/components/timeline/TimelineHeader';
import TripNavBar from '@/components/timeline/TripNavBar';
import SidebarEntryCard from '@/components/timeline/SidebarEntryCard';
import EntrySheet from '@/components/timeline/EntrySheet';
import HotelWizard from '@/components/timeline/HotelWizard';
import type { Trip, Entry, EntryOption, EntryWithOptions, CategoryPreset } from '@/types/trip';

type FilterTab = 'all' | 'ideas' | 'scheduled';

const Planner = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const { currentUser, isEditor } = useCurrentUser();
  const navigate = useNavigate();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [entries, setEntries] = useState<EntryWithOptions[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<'create' | 'view' | null>(null);
  const [sheetEntry, setSheetEntry] = useState<EntryWithOptions | null>(null);
  const [sheetOption, setSheetOption] = useState<EntryOption | null>(null);
  const [prefillCategory, setPrefillCategory] = useState<string | undefined>();
  const [hotelWizardOpen, setHotelWizardOpen] = useState(false);
  const [userVotes, setUserVotes] = useState<string[]>([]);

  useEffect(() => {
    if (!currentUser) navigate(tripId ? `/trip/${tripId}` : '/');
  }, [currentUser, navigate, tripId]);

  const fetchData = useCallback(async () => {
    if (!tripId) return;
    const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single();
    if (tripData) setTrip(tripData as unknown as Trip);

    const { data: entriesData } = await supabase.from('entries').select('*').eq('trip_id', tripId).order('start_time');
    if (!entriesData || entriesData.length === 0) { setEntries([]); setLoading(false); return; }

    const entryIds = entriesData.map(e => e.id);
    const [optionsRes, imagesRes, votesRes] = await Promise.all([
      supabase.from('entry_options').select('*').in('entry_id', entryIds),
      supabase.from('option_images').select('*').order('sort_order'),
      supabase.from('votes').select('option_id, user_id'),
    ]);

    const options = (optionsRes.data ?? []) as unknown as EntryOption[];
    const images = imagesRes.data ?? [];
    const votes = votesRes.data ?? [];
    const voteCounts: Record<string, number> = {};
    votes.forEach(v => { voteCounts[v.option_id] = (voteCounts[v.option_id] || 0) + 1; });
    if (currentUser) setUserVotes(votes.filter(v => v.user_id === currentUser.id).map(v => v.option_id));

    const optionsWithImages = options.map(o => ({
      ...o,
      vote_count: voteCounts[o.id] || 0,
      images: images.filter(img => img.option_id === o.id),
    }));

    setEntries((entriesData as Entry[]).map(entry => ({
      ...entry,
      options: optionsWithImages.filter(o => o.entry_id === entry.id),
    })));
    setLoading(false);
  }, [tripId, currentUser]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useRealtimeSync(fetchData);

  const homeTimezone = trip?.home_timezone ?? 'Europe/London';
  const formatTime = useCallback((isoString: string, tz?: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-GB', { timeZone: tz || homeTimezone, hour: '2-digit', minute: '2-digit', hour12: false });
  }, [homeTimezone]);

  const allCategories = useMemo(() => {
    const cats: CategoryDef[] = PREDEFINED_CATEGORIES.filter(c => c.id !== 'airport_processing' && c.id !== 'transport' && c.id !== 'transfer');
    const custom = (trip?.category_presets as CategoryPreset[] | null) ?? [];
    custom.forEach((c, i) => {
      cats.push({ id: `custom_${i}`, name: c.name, emoji: c.emoji || '📌', color: c.color, defaultDurationMin: 60, defaultStartHour: 10, defaultStartMin: 0 });
    });
    return cats;
  }, [trip?.category_presets]);

  const filteredEntries = useMemo(() => {
    if (activeFilter === 'ideas') return entries.filter(e => e.is_scheduled === false);
    if (activeFilter === 'scheduled') return entries.filter(e => e.is_scheduled !== false);
    return entries;
  }, [entries, activeFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, EntryWithOptions[]>();
    for (const cat of allCategories) map.set(cat.id, []);
    map.set('other', []);
    for (const entry of filteredEntries) {
      const catId = entry.options[0]?.category;
      if (catId === 'airport_processing' || catId === 'transport' || catId === 'transfer') continue;
      if (catId && map.has(catId)) map.get(catId)!.push(entry);
      else if (catId) {
        const customMatch = allCategories.find(c => c.id === catId || c.name.toLowerCase() === catId.toLowerCase());
        if (customMatch) map.get(customMatch.id)!.push(entry);
        else map.get('other')!.push(entry);
      } else map.get('other')!.push(entry);
    }
    return map;
  }, [filteredEntries, allCategories]);

  const deduplicatedMap = useMemo(() => {
    const groups = new Map<string, EntryWithOptions[]>();
    for (const entry of entries) {
      const opt = entry.options[0];
      if (!opt) continue;
      const key = `${opt.name}::${opt.category ?? ''}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(entry);
    }
    const result = new Map<string, { original: EntryWithOptions; usageCount: number; isFlight: boolean }>();
    for (const [, group] of groups) {
      const sorted = [...group].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      result.set(sorted[0].id, { original: sorted[0], usageCount: group.length, isFlight: sorted[0].options[0]?.category === 'flight' });
    }
    return result;
  }, [entries]);

  const getFilteredOriginals = (catEntries: EntryWithOptions[]) => {
    const seen = new Set<string>();
    const results: { original: EntryWithOptions; usageCount: number; isFlight: boolean }[] = [];
    for (const entry of catEntries) {
      const opt = entry.options[0];
      if (!opt) continue;
      const key = `${opt.name}::${opt.category ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const dedup = [...deduplicatedMap.values()].find(d => {
        const dOpt = d.original.options[0];
        return dOpt && `${dOpt.name}::${dOpt.category ?? ''}` === key;
      });
      if (dedup) results.push(dedup);
    }
    return results;
  };

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

  const handleCardTap = (entry: EntryWithOptions) => {
    const opt = entry.options[0];
    if (opt) {
      setSheetMode('view');
      setSheetEntry(entry);
      setSheetOption(opt);
      setSheetOpen(true);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TimelineHeader trip={trip} tripId={tripId ?? ''} />
      <TripNavBar liveOpen={false} plannerOpen={true} isMobile={false} onToggleLive={() => {}} onTogglePlanner={() => {}} onTimelineOnly={() => navigate(`/trip/${tripId}/timeline`)} />

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading planner...</p>
          </div>
        </div>
      ) : (
        <main className="flex-1 overflow-y-auto">
          <div className="sticky top-[105px] z-10 flex items-center gap-1.5 border-b border-border bg-background/95 backdrop-blur-sm px-4 py-2">
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

          <div className="mx-auto max-w-2xl p-4 space-y-4">
            {allCategories.map(cat => {
              const catEntries = grouped.get(cat.id) ?? [];
              const dedupedEntries = getFilteredOriginals(catEntries);
              if (dedupedEntries.length === 0) return null;

              return (
                <div key={cat.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{cat.emoji}</span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat.name}</span>
                      <span className="text-[10px] text-muted-foreground/60">({dedupedEntries.length})</span>
                    </div>
                    {isEditor && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          if (cat.id === 'hotel') { setHotelWizardOpen(true); return; }
                          setPrefillCategory(cat.id);
                          setSheetMode('create');
                          setSheetEntry(null);
                          setSheetOption(null);
                          setSheetOpen(true);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {dedupedEntries.map(({ original, usageCount, isFlight }) => (
                      <SidebarEntryCard
                        key={original.id}
                        entry={original}
                        onDragStart={() => {}}
                        onClick={() => handleCardTap(original)}
                        usageCount={usageCount}
                        isFlight={isFlight}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {(() => {
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
                  <div className="space-y-1.5">
                    {dedupedOther.map(({ original, usageCount, isFlight }) => (
                      <SidebarEntryCard
                        key={original.id}
                        entry={original}
                        onDragStart={() => {}}
                        onClick={() => handleCardTap(original)}
                        usageCount={usageCount}
                        isFlight={isFlight}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </main>
      )}

      {/* FAB */}
      <button
        onClick={() => {
          setPrefillCategory(undefined);
          setSheetMode('create');
          setSheetEntry(null);
          setSheetOption(null);
          setSheetOpen(true);
        }}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        title="Add entry"
      >
        <span className="text-2xl font-light">+</span>
      </button>

      {trip && (
        <>
          <EntrySheet
            mode={sheetMode ?? 'create'}
            open={sheetOpen}
            onOpenChange={(open) => {
              setSheetOpen(open);
              if (!open) { setSheetMode(null); setSheetEntry(null); setSheetOption(null); setPrefillCategory(undefined); }
            }}
            tripId={trip.id}
            onSaved={fetchData}
            trip={trip}
            entry={sheetEntry}
            option={sheetOption}
            formatTime={formatTime}
            votingLocked={trip.voting_locked}
            userVotes={userVotes}
            onVoteChange={fetchData}
            prefillCategory={prefillCategory}
          />
          <HotelWizard
            open={hotelWizardOpen}
            onOpenChange={setHotelWizardOpen}
            tripId={trip.id}
            trip={trip}
            onCreated={fetchData}
          />
        </>
      )}
    </div>
  );
};

export default Planner;

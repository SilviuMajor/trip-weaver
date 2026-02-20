import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTripMember } from '@/hooks/useTripMember';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { addDays, format, parseISO } from 'date-fns';
import { localToUTC } from '@/lib/timezoneUtils';
import { findCategory } from '@/lib/categories';
import { inferCategoryFromTypes } from '@/lib/placeTypeMapping';
import { toast } from '@/hooks/use-toast';
import TimelineHeader from '@/components/timeline/TimelineHeader';
import TripNavBar from '@/components/timeline/TripNavBar';
import PlannerContent from '@/components/timeline/PlannerContent';
import EntrySheet from '@/components/timeline/EntrySheet';
import HotelWizard from '@/components/timeline/HotelWizard';
import ExploreView from '@/components/timeline/ExploreView';
import type { ExploreResult } from '@/components/timeline/ExploreView';
import type { Trip, Entry, EntryOption, EntryWithOptions, CategoryPreset } from '@/types/trip';

const Planner = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const { member: currentUser, isEditor } = useTripMember(tripId);
  const { session } = useAdminAuth();
  const navigate = useNavigate();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [entries, setEntries] = useState<EntryWithOptions[]>([]);
  const [loading, setLoading] = useState(true);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<'create' | 'view' | null>(null);
  const [sheetEntry, setSheetEntry] = useState<EntryWithOptions | null>(null);
  const [sheetOption, setSheetOption] = useState<EntryOption | null>(null);
  const [prefillCategory, setPrefillCategory] = useState<string | undefined>();
  const [hotelWizardOpen, setHotelWizardOpen] = useState(false);
  const [userVotes, setUserVotes] = useState<string[]>([]);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [exploreCategoryId, setExploreCategoryId] = useState<string | null>(null);

  const REFERENCE_DATE = '2099-01-01';

  useEffect(() => {
    if (!currentUser && !session) navigate('/auth');
  }, [currentUser, session, navigate]);

  const fetchingRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!tripId) return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single();
      if (tripData) setTrip(tripData as unknown as Trip);

      const { data: entriesData } = await supabase.from('entries').select('*').eq('trip_id', tripId).order('start_time');
      if (!entriesData || entriesData.length === 0) { setEntries([]); setLoading(false); return; }

      const entryIds = entriesData.map(e => e.id);
      const [optionsRes] = await Promise.all([
        supabase.from('entry_options').select('*').in('entry_id', entryIds),
      ]);

      const optionIds = (optionsRes.data ?? []).map((o: any) => o.id);
      const [imagesRes, votesRes] = await Promise.all([
        optionIds.length > 0
          ? supabase.from('option_images').select('*').in('option_id', optionIds).order('sort_order')
          : Promise.resolve({ data: [] as any[] }),
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
    } finally {
      fetchingRef.current = false;
    }
  }, [tripId, currentUser]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useRealtimeSync(fetchData);

  const homeTimezone = trip?.home_timezone ?? 'Europe/London';
  const formatTime = useCallback((isoString: string, tz?: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-GB', { timeZone: tz || homeTimezone, hour: '2-digit', minute: '2-digit', hour12: false });
  }, [homeTimezone]);

  const handleCardTap = (entry: EntryWithOptions) => {
    const opt = entry.options[0];
    if (opt) {
      setSheetMode('view');
      setSheetEntry(entry);
      setSheetOption(opt);
      setSheetOpen(true);
    }
  };

  const handleAddToPlanner = useCallback(async (place: ExploreResult) => {
    if (!trip) return;
    try {
      const catId = exploreCategoryId || inferCategoryFromTypes(place.types);
      const cat = findCategory(catId);
      const placeholderDate = format(addDays(parseISO(REFERENCE_DATE), 0), 'yyyy-MM-dd');
      const startIso = localToUTC(placeholderDate, '00:00', homeTimezone);
      const endIso = localToUTC(placeholderDate, '01:00', homeTimezone);

      const { data: d, error } = await supabase
        .from('entries')
        .insert({ trip_id: trip.id, start_time: startIso, end_time: endIso, is_scheduled: false, created_by: session?.user?.id ?? null } as any)
        .select('id').single();
      if (error) throw error;

      await supabase.from('entry_options').insert({
        entry_id: d.id,
        name: place.name,
        category: cat?.id ?? catId,
        category_color: cat?.color ?? null,
        location_name: place.address || null,
        latitude: place.lat,
        longitude: place.lng,
        rating: place.rating,
        user_rating_count: place.userRatingCount,
        phone: place.phone || null,
        address: place.address || null,
        google_maps_uri: place.googleMapsUri || null,
        google_place_id: place.placeId || null,
        price_level: place.priceLevel || null,
        opening_hours: place.openingHours || null,
        website: place.website || null,
      } as any);

      toast({ title: `Added ${place.name} to Planner` });
      fetchData();

      // Background: fetch details and persist photos
      if (place.placeId && !place.placeId.startsWith('manual-')) {
        const entryId = d.id;
        (async () => {
          try {
            const { data: details } = await supabase.functions.invoke('google-places', {
              body: { action: 'details', placeId: place.placeId },
            });
            if (details?.photos?.length > 0) {
              const optionRes = await supabase
                .from('entry_options')
                .select('id')
                .eq('entry_id', entryId)
                .single();
              if (optionRes.data) {
                for (let i = 0; i < details.photos.length; i++) {
                  await supabase.from('option_images').insert({
                    option_id: optionRes.data.id,
                    image_url: details.photos[i],
                    sort_order: i,
                  });
                }
                fetchData();
              }
            }
          } catch (e) {
            console.error('Background photo fetch failed:', e);
          }
        })();
      }
    } catch (err: any) {
      toast({ title: 'Failed to add', description: err.message, variant: 'destructive' });
    }
  }, [trip, exploreCategoryId, homeTimezone, fetchData]);

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
          <div className="mx-auto max-w-2xl p-4">
            <PlannerContent
              entries={entries}
              trip={trip}
              isEditor={isEditor}
              onCardTap={handleCardTap}
              onAddEntry={(catId) => {
                if (catId === 'hotel') { setHotelWizardOpen(true); return; }
                setPrefillCategory(catId);
                setSheetMode('create');
                setSheetEntry(null);
                setSheetOption(null);
                setSheetOpen(true);
              }}
              onExploreOpen={(catId) => {
                setExploreCategoryId(catId);
                setExploreOpen(true);
              }}
              onDragStart={() => {}}
            />
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
            onExploreRequest={(catId) => {
              setSheetOpen(false);
              setExploreCategoryId(catId);
              setExploreOpen(true);
            }}
          />
          <HotelWizard
            open={hotelWizardOpen}
            onOpenChange={setHotelWizardOpen}
            tripId={trip.id}
            trip={trip}
            onCreated={fetchData}
          />
          <ExploreView
            open={exploreOpen}
            onClose={() => { setExploreOpen(false); setExploreCategoryId(null); }}
            trip={trip}
            entries={entries}
            categoryId={exploreCategoryId}
            isEditor={isEditor}
            onAddToPlanner={handleAddToPlanner}
            onCardTap={() => {}}
            onAddManually={() => {
              setExploreOpen(false);
              setPrefillCategory(exploreCategoryId || undefined);
              setExploreCategoryId(null);
              setSheetMode('create');
              setSheetEntry(null);
              setSheetOption(null);
              setSheetOpen(true);
            }}
          />
        </>
      )}
    </div>
  );
};

export default Planner;

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { addDays, parseISO, startOfDay, format, isPast } from 'date-fns';
import { getDateInTimezone } from '@/lib/timezoneUtils';
import { ArrowDown, ZoomIn, ZoomOut } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useTimelineZoom } from '@/hooks/useTimelineZoom';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useTravelCalculation } from '@/hooks/useTravelCalculation';
import { analyzeConflict, generateRecommendations } from '@/lib/conflictEngine';
import { toast } from '@/hooks/use-toast';
import TimelineHeader from '@/components/timeline/TimelineHeader';
import CalendarDay from '@/components/timeline/CalendarDay';
import EntryOverlay from '@/components/timeline/EntryOverlay';
import EntryForm from '@/components/timeline/EntryForm';
import IdeasPanel from '@/components/timeline/IdeasPanel';
import ConflictResolver from '@/components/timeline/ConflictResolver';
import type { Trip, Entry, EntryOption, EntryWithOptions, TravelSegment, WeatherData } from '@/types/trip';
import type { ConflictInfo, Recommendation } from '@/lib/conflictEngine';

const Timeline = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const { currentUser, isEditor } = useCurrentUser();
  const navigate = useNavigate();
  const { latitude: userLat, longitude: userLng } = useGeolocation();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [entries, setEntries] = useState<EntryWithOptions[]>([]);
  const [userVotes, setUserVotes] = useState<string[]>([]);
  const [travelSegments, setTravelSegments] = useState<TravelSegment[]>([]);
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);
  const [loading, setLoading] = useState(true);

  const tripTimezone = trip?.timezone ?? 'Europe/Amsterdam';

  const formatTime = useCallback((isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-GB', {
      timeZone: tripTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }, [tripTimezone]);

  // Overlay state
  const [overlayEntry, setOverlayEntry] = useState<EntryWithOptions | null>(null);
  const [overlayOption, setOverlayOption] = useState<EntryOption | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);

  // Entry form state
  const [entryFormOpen, setEntryFormOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<EntryWithOptions | null>(null);
  const [editOption, setEditOption] = useState<EntryOption | null>(null);
  const [prefillStartTime, setPrefillStartTime] = useState<string | undefined>();
  const [prefillEndTime, setPrefillEndTime] = useState<string | undefined>();

  // Ideas panel state
  const [ideasPanelOpen, setIdeasPanelOpen] = useState(false);

  // Conflict resolution state
  const [conflictOpen, setConflictOpen] = useState(false);
  const [currentConflict, setCurrentConflict] = useState<ConflictInfo | null>(null);
  const [currentRecommendations, setCurrentRecommendations] = useState<Recommendation[]>([]);
  const [pendingPlacement, setPendingPlacement] = useState<EntryWithOptions | null>(null);

  // Travel calculation
  const { calculateTravel } = useTravelCalculation();

  // Zoom
  const scrollRef = useRef<HTMLDivElement>(null);
  const { zoom, changeZoom, spacingClass, cardSizeClass, zoomLabel } = useTimelineZoom(scrollRef);

  // Redirect if no user
  useEffect(() => {
    if (!currentUser) {
      navigate(tripId ? `/trip/${tripId}` : '/');
    }
  }, [currentUser, navigate, tripId]);

  // Data fetching
  const fetchData = useCallback(async () => {
    if (!tripId) return;

    const { data: tripData } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single();

    if (!tripData) {
      setLoading(false);
      return;
    }

    setTrip(tripData as unknown as Trip);

    const [entriesRes, segmentsRes, weatherRes] = await Promise.all([
      supabase.from('entries').select('*').eq('trip_id', tripId).order('start_time'),
      supabase.from('travel_segments').select('*').eq('trip_id', tripId),
      supabase.from('weather_cache').select('*').eq('trip_id', tripId),
    ]);

    setTravelSegments((segmentsRes.data ?? []) as TravelSegment[]);
    setWeatherData((weatherRes.data ?? []) as WeatherData[]);

    const entriesData = entriesRes.data;
    if (!entriesData || entriesData.length === 0) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const entryIds = entriesData.map(e => e.id);

    const [optionsRes, imagesRes, votesRes] = await Promise.all([
      supabase.from('entry_options').select('*').in('entry_id', entryIds),
      supabase.from('option_images').select('*').order('sort_order'),
      supabase.from('votes').select('option_id, user_id'),
    ]);

    const options = (optionsRes.data ?? []) as EntryOption[];
    const images = imagesRes.data ?? [];
    const votes = votesRes.data ?? [];

    const voteCounts: Record<string, number> = {};
    votes.forEach(v => {
      voteCounts[v.option_id] = (voteCounts[v.option_id] || 0) + 1;
    });

    if (currentUser) {
      setUserVotes(
        votes.filter(v => v.user_id === currentUser.id).map(v => v.option_id)
      );
    }

    const optionsWithImages = options.map(o => ({
      ...o,
      vote_count: voteCounts[o.id] || 0,
      images: images.filter(img => img.option_id === o.id),
    }));

    const entriesWithOptions: EntryWithOptions[] = (entriesData as Entry[]).map(entry => ({
      ...entry,
      options: optionsWithImages.filter(o => o.entry_id === entry.id),
    }));

    setEntries(entriesWithOptions);
    setLoading(false);
  }, [currentUser, tripId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useRealtimeSync(fetchData);

  useEffect(() => {
    if (!loading) {
      const todayEl = document.getElementById('today');
      if (todayEl) {
        setTimeout(() => {
          todayEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    }
  }, [loading]);

  const scrollToToday = () => {
    const todayEl = document.getElementById('today');
    if (todayEl) {
      todayEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Split entries into scheduled and unscheduled
  const scheduledEntries = useMemo(() =>
    entries.filter(e => e.is_scheduled !== false), [entries]
  );
  const unscheduledEntries = useMemo(() =>
    entries.filter(e => e.is_scheduled === false), [entries]
  );

  const isMobile = useIsMobile();

  const isUndated = !trip?.start_date;
  const REFERENCE_DATE = '2099-01-01';

  const getDays = (): Date[] => {
    if (!trip) return [];
    if (isUndated) {
      const count = trip.duration_days ?? 3;
      return Array.from({ length: count }, (_, i) => addDays(parseISO(REFERENCE_DATE), i));
    }
    const start = parseISO(trip.start_date!);
    const end = parseISO(trip.end_date!);
    const days: Date[] = [];
    let current = startOfDay(start);
    while (current <= end) {
      days.push(new Date(current));
      current = addDays(current, 1);
    }
    return days;
  };

  // Compute timezone map per day based on flights
  const dayTimezoneMap = useMemo(() => {
    const map = new Map<string, { activeTz: string; flights: Array<{ originTz: string; destinationTz: string; flightStartHour: number; flightEndHour: number }> }>();
    if (!trip) return map;

    const days = getDays();
    let currentTz = tripTimezone;

    for (const day of days) {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayEntries = scheduledEntries
        .filter(entry => {
          const entryDay = getDateInTimezone(entry.start_time, tripTimezone);
          return entryDay === dayStr;
        })
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      const flightEntries = dayEntries.filter(e => {
        const opt = e.options[0];
        return opt?.category === 'flight' && opt.departure_tz && opt.arrival_tz;
      });

      if (flightEntries.length === 0) {
        map.set(dayStr, { activeTz: currentTz, flights: [] });
      } else {
        const flights = flightEntries.map(f => {
          const opt = f.options[0];
          const getHour = (iso: string, tz: string) => {
            const d = new Date(iso);
            const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(d);
            const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0');
            const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0');
            return h + m / 60;
          };
          return {
            originTz: opt.departure_tz!,
            destinationTz: opt.arrival_tz!,
            flightStartHour: getHour(f.start_time, opt.departure_tz!),
            flightEndHour: getHour(f.end_time, opt.arrival_tz!),
          };
        });
        map.set(dayStr, { activeTz: currentTz, flights });
        // After this day, the current TZ switches to the last flight's arrival
        currentTz = flightEntries[flightEntries.length - 1].options[0].arrival_tz!;
      }
    }

    return map;
  }, [trip, scheduledEntries, tripTimezone]);

  const getEntriesForDay = (day: Date): EntryWithOptions[] => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return scheduledEntries.filter(entry => {
      const entryDay = getDateInTimezone(entry.start_time, tripTimezone);
      return entryDay === dayStr;
    });
  };

  const getWeatherForDay = (day: Date): WeatherData[] => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return weatherData.filter(w => w.date === dayStr);
  };

  const handleCardTap = (entry: EntryWithOptions, option: EntryOption) => {
    setOverlayEntry(entry);
    setOverlayOption(option);
    setOverlayOpen(true);
  };

  const handleAddBetween = (prefillTime: string) => {
    setPrefillStartTime(prefillTime);
    setPrefillEndTime(undefined);
    setEntryFormOpen(true);
  };

  const handleDragSlot = (startTime: Date, endTime: Date) => {
    setPrefillStartTime(startTime.toISOString());
    setPrefillEndTime(endTime.toISOString());
    setEntryFormOpen(true);
  };

  const handleEntryTimeChange = async (entryId: string, newStartIso: string, newEndIso: string) => {
    const { error } = await supabase
      .from('entries')
      .update({ start_time: newStartIso, end_time: newEndIso })
      .eq('id', entryId);
    if (error) {
      console.error('Failed to update entry time:', error);
      return;
    }
    await fetchData();
  };

  // Handle drop from ideas panel onto timeline
  const handleDropOnTimeline = async (entryId: string, dayDate: Date, hourOffset: number) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    const dateStr = format(dayDate, 'yyyy-MM-dd');
    const startMinutes = Math.round(hourOffset * 60);
    const sH = Math.floor(startMinutes / 60);
    const sM = startMinutes % 60;

    // Default 1h duration
    const endMinutes = startMinutes + 60;
    const eH = Math.floor(endMinutes / 60);
    const eM = endMinutes % 60;

    const { localToUTC } = await import('@/lib/timezoneUtils');
    const startIso = localToUTC(dateStr, `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`, tripTimezone);
    const endIso = localToUTC(dateStr, `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`, tripTimezone);

    // Update entry to scheduled
    const { error } = await supabase
      .from('entries')
      .update({
        is_scheduled: true,
        start_time: startIso,
        end_time: endIso,
      } as any)
      .eq('id', entryId);

    if (error) {
      toast({ title: 'Failed to place entry', description: error.message, variant: 'destructive' });
      return;
    }

    await fetchData();

    // Live travel calculation
    const updatedEntry = { ...entry, start_time: startIso, end_time: endIso, is_scheduled: true };
    const dayEntries = getEntriesForDay(dayDate);
    const sortedDay = [...dayEntries, updatedEntry].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
    const placedIdx = sortedDay.findIndex(e => e.id === entryId);
    const prevEntry = placedIdx > 0 ? sortedDay[placedIdx - 1] : null;
    const nextEntry = placedIdx < sortedDay.length - 1 ? sortedDay[placedIdx + 1] : null;

    try {
      const { prevTravel, nextTravel } = await calculateTravel(updatedEntry, prevEntry, nextEntry);

      const conflict = analyzeConflict(
        updatedEntry,
        prevEntry,
        nextEntry,
        prevTravel?.durationMin ?? null,
        nextTravel?.durationMin ?? null,
      );

      if (conflict.discrepancyMin > 0) {
        const recs = generateRecommendations(conflict, sortedDay, entryId);
        setCurrentConflict(conflict);
        setCurrentRecommendations(recs);
        setPendingPlacement(updatedEntry);
        setConflictOpen(true);
      } else {
        toast({ title: 'Placed on timeline ✨' });
      }
    } catch {
      // Travel calc failed silently, still placed
      toast({ title: 'Placed on timeline ✨' });
    }
  };

  const handleApplyRecommendation = async (rec: Recommendation) => {
    for (const change of rec.changes) {
      await supabase
        .from('entries')
        .update({ start_time: change.newStartIso, end_time: change.newEndIso })
        .eq('id', change.entryId);
    }
    setConflictOpen(false);
    setCurrentConflict(null);
    setPendingPlacement(null);
    toast({ title: 'Schedule adjusted ✨' });
    await fetchData();
  };

  const handleSkipConflict = () => {
    setConflictOpen(false);
    setCurrentConflict(null);
    setPendingPlacement(null);
    toast({ title: 'Placed with conflict marker ⚠️', description: 'Adjust the schedule manually when ready.' });
  };

  // Handle "Move to ideas" from overlay
  const handleMoveToIdeas = async (entryId: string) => {
    const { error } = await supabase
      .from('entries')
      .update({ is_scheduled: false } as any)
      .eq('id', entryId);
    if (error) {
      toast({ title: 'Failed to move', description: error.message, variant: 'destructive' });
      return;
    }
    setOverlayOpen(false);
    toast({ title: 'Moved to ideas panel 💡' });
    await fetchData();
  };

  // Handle drag start from ideas panel
  const handleIdeaDragStart = (e: React.DragEvent, entry: EntryWithOptions) => {
    e.dataTransfer.setData('text/plain', entry.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleToggleLock = async (entryId: string, currentLocked: boolean) => {
    const { error } = await supabase
      .from('entries')
      .update({ is_locked: !currentLocked })
      .eq('id', entryId);
    if (error) {
      toast({ title: 'Failed to toggle lock', description: error.message, variant: 'destructive' });
      return;
    }
    await fetchData();
  };

  const days = getDays();

  if (!currentUser) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background" ref={scrollRef}>
      <TimelineHeader
        trip={trip}
        tripId={tripId ?? ''}
        onAddEntry={() => {
          setPrefillStartTime(undefined);
          setPrefillEndTime(undefined);
          setEntryFormOpen(true);
        }}
        onDataRefresh={fetchData}
        onToggleIdeas={() => setIdeasPanelOpen(prev => !prev)}
        ideasCount={unscheduledEntries.length}
      />

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading itinerary...</p>
          </div>
        </div>
      ) : !trip ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center">
            <h2 className="mb-2 text-xl font-bold">No trip found</h2>
            <p className="text-sm text-muted-foreground">
              This trip doesn't exist or was deleted.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 overflow-y-auto pb-20">
              {days.map((day, index) => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const tzInfo = dayTimezoneMap.get(dayStr);
                return (
                  <CalendarDay
                    key={day.toISOString()}
                    date={day}
                    entries={getEntriesForDay(day)}
                    allEntries={scheduledEntries}
                    formatTime={formatTime}
                    tripTimezone={tripTimezone}
                    userLat={userLat}
                    userLng={userLng}
                    votingLocked={trip.voting_locked}
                    userId={currentUser?.id}
                    userVotes={userVotes}
                    onVoteChange={fetchData}
                    onCardTap={handleCardTap}
                    travelSegments={travelSegments}
                    weatherData={getWeatherForDay(day)}
                    dayLabel={isUndated ? `Day ${index + 1}` : undefined}
                    isFirstDay={index === 0}
                    isLastDay={index === days.length - 1}
                    onAddBetween={handleAddBetween}
                    onDragSlot={handleDragSlot}
                    onEntryTimeChange={handleEntryTimeChange}
                    onDropFromPanel={(entryId, hourOffset) => handleDropOnTimeline(entryId, day, hourOffset)}
                    activeTz={tzInfo?.activeTz}
                    dayFlights={tzInfo?.flights}
                    isEditor={isEditor}
                    onToggleLock={handleToggleLock}
                  />
                );
              })}
            </main>

            {/* Desktop sidebar */}
            {!isMobile && (
              <IdeasPanel
                open={ideasPanelOpen}
                onOpenChange={setIdeasPanelOpen}
                entries={unscheduledEntries}
                scheduledEntries={scheduledEntries}
                onDragStart={handleIdeaDragStart}
                onCardTap={(entry) => {
                  const opt = entry.options[0];
                  if (opt) handleCardTap(entry, opt);
                }}
              />
            )}
          </div>

          {/* Bottom controls */}
          <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2">
            <div className="flex items-center gap-1 rounded-full bg-card/90 px-2 py-1 shadow-lg backdrop-blur-sm border border-border">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => changeZoom(-1)}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[10px] font-medium text-muted-foreground min-w-[36px] text-center">
                {zoomLabel}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => changeZoom(1)}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
            </div>

            {!isUndated && (
              <Button onClick={scrollToToday} size="sm" className="rounded-full shadow-lg">
                <ArrowDown className="mr-1 h-3.5 w-3.5" />
                Today
              </Button>
            )}
          </div>

          {/* Mobile FAB for Ideas */}
          {isMobile && (
            <>
              <button
                onClick={() => setIdeasPanelOpen(prev => !prev)}
                className="fixed bottom-20 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                <span className="text-xl">💡</span>
                {unscheduledEntries.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {unscheduledEntries.length}
                  </span>
                )}
              </button>

              <IdeasPanel
                open={ideasPanelOpen}
                onOpenChange={setIdeasPanelOpen}
                entries={unscheduledEntries}
                scheduledEntries={scheduledEntries}
                onDragStart={handleIdeaDragStart}
                onCardTap={(entry) => {
                  const opt = entry.options[0];
                  if (opt) handleCardTap(entry, opt);
                }}
              />
            </>
          )}

          <EntryOverlay
            entry={overlayEntry}
            option={overlayOption}
            open={overlayOpen}
            onOpenChange={setOverlayOpen}
            formatTime={formatTime}
            userLat={userLat}
            userLng={userLng}
            votingLocked={trip.voting_locked}
            userVotes={userVotes}
            onVoteChange={fetchData}
            onImageUploaded={fetchData}
            onEdit={(entry, option) => {
              setEditEntry(entry);
              setEditOption(option);
              setEntryFormOpen(true);
            }}
            onDeleted={fetchData}
            onMoveToIdeas={handleMoveToIdeas}
          />

          <EntryForm
            open={entryFormOpen}
            onOpenChange={(open) => {
              setEntryFormOpen(open);
              if (!open) {
                setEditEntry(null);
                setEditOption(null);
                setPrefillStartTime(undefined);
                setPrefillEndTime(undefined);
              }
            }}
            tripId={trip.id}
            onCreated={fetchData}
            trip={trip}
            editEntry={editEntry}
            editOption={editOption}
            prefillStartTime={prefillStartTime}
            prefillEndTime={prefillEndTime}
          />

          <ConflictResolver
            open={conflictOpen}
            onOpenChange={setConflictOpen}
            conflict={currentConflict}
            recommendations={currentRecommendations}
            onApply={handleApplyRecommendation}
            onSkip={handleSkipConflict}
          />
        </>
      )}
    </div>
  );
};

export default Timeline;

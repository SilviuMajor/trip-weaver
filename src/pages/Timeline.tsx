import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { addDays, parseISO, startOfDay, format, isPast } from 'date-fns';
import { ArrowDown, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTimezone } from '@/hooks/useTimezone';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useTimelineZoom } from '@/hooks/useTimelineZoom';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import TimelineHeader from '@/components/timeline/TimelineHeader';
import CalendarDay from '@/components/timeline/CalendarDay';
import EntryOverlay from '@/components/timeline/EntryOverlay';
import EntryForm from '@/components/timeline/EntryForm';
import type { Trip, Entry, EntryOption, EntryWithOptions, TravelSegment, WeatherData } from '@/types/trip';

const Timeline = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const { timezone, toggle, formatTime, getTimezoneLabel } = useTimezone();
  const { latitude: userLat, longitude: userLng } = useGeolocation();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [entries, setEntries] = useState<EntryWithOptions[]>([]);
  const [userVotes, setUserVotes] = useState<string[]>([]);
  const [travelSegments, setTravelSegments] = useState<TravelSegment[]>([]);
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);
  const [loading, setLoading] = useState(true);

  // Overlay state
  const [overlayEntry, setOverlayEntry] = useState<EntryWithOptions | null>(null);
  const [overlayOption, setOverlayOption] = useState<EntryOption | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);

  // Entry form state
  const [entryFormOpen, setEntryFormOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<EntryWithOptions | null>(null);
  const [editOption, setEditOption] = useState<EntryOption | null>(null);

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

    // Get entries, travel segments, and weather in parallel
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

    // Fetch options, images, and votes in parallel
    const [optionsRes, imagesRes, votesRes] = await Promise.all([
      supabase.from('entry_options').select('*').in('entry_id', entryIds),
      supabase.from('option_images').select('*').order('sort_order'),
      supabase.from('votes').select('option_id, user_id'),
    ]);

    const options = (optionsRes.data ?? []) as EntryOption[];
    const images = imagesRes.data ?? [];
    const votes = votesRes.data ?? [];

    // Count votes per option
    const voteCounts: Record<string, number> = {};
    votes.forEach(v => {
      voteCounts[v.option_id] = (voteCounts[v.option_id] || 0) + 1;
    });

    // User's votes
    if (currentUser) {
      setUserVotes(
        votes.filter(v => v.user_id === currentUser.id).map(v => v.option_id)
      );
    }

    // Attach images to options
    const optionsWithImages = options.map(o => ({
      ...o,
      vote_count: voteCounts[o.id] || 0,
      images: images.filter(img => img.option_id === o.id),
    }));

    // Assemble entries with options
    const entriesWithOptions: EntryWithOptions[] = (entriesData as Entry[]).map(entry => ({
      ...entry,
      options: optionsWithImages.filter(o => o.entry_id === entry.id),
    }));

    setEntries(entriesWithOptions);
    setLoading(false);
  }, [currentUser, tripId]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime sync
  useRealtimeSync(fetchData);

  // Scroll to today on load
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

  const isUndated = !trip?.start_date;

  // Reference date used for synthetic "Day 1" entries when no real dates
  const REFERENCE_DATE = '2099-01-01';

  // Generate days between trip start and end (or synthetic days)
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

  // Group entries by day
  const getEntriesForDay = (day: Date): EntryWithOptions[] => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return entries.filter(entry => {
      const entryDay = format(new Date(entry.start_time), 'yyyy-MM-dd');
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

  if (!currentUser) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background" ref={scrollRef}>
      <TimelineHeader
        trip={trip}
        tripId={tripId ?? ''}
        timezone={timezone}
        onToggleTimezone={toggle}
        timezoneLabel={getTimezoneLabel()}
        onAddEntry={() => setEntryFormOpen(true)}
        onDataRefresh={fetchData}
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
          <main className="flex-1 pb-20">
            {getDays().map((day, index) => (
              <CalendarDay
                key={day.toISOString()}
                date={day}
                entries={getEntriesForDay(day)}
                formatTime={formatTime}
                timezone={timezone}
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
              />
            ))}
          </main>

          {/* Bottom controls */}
          <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2">
            <div className="flex items-center gap-1 rounded-full bg-card/90 px-2 py-1 shadow-lg backdrop-blur-sm border border-border">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => changeZoom(-1)}
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[10px] font-medium text-muted-foreground min-w-[36px] text-center">
                {zoomLabel}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => changeZoom(1)}
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
            </div>

            {!isUndated && (
              <Button
                onClick={scrollToToday}
                size="sm"
                className="rounded-full shadow-lg"
              >
                <ArrowDown className="mr-1 h-3.5 w-3.5" />
                Today
              </Button>
            )}
          </div>

          {/* Entry overlay */}
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
          />

          {/* Entry form */}
          <EntryForm
            open={entryFormOpen}
            onOpenChange={(open) => {
              setEntryFormOpen(open);
              if (!open) {
                setEditEntry(null);
                setEditOption(null);
              }
            }}
            tripId={trip.id}
            onCreated={fetchData}
            trip={trip}
            editEntry={editEntry}
            editOption={editOption}
          />
        </>
      )}
    </div>
  );
};

export default Timeline;

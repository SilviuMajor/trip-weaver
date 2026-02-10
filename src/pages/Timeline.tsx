import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { addDays, parseISO, startOfDay, format, isPast } from 'date-fns';
import { getDateInTimezone, localToUTC } from '@/lib/timezoneUtils';
import { findCategory } from '@/lib/categories';
import { ArrowDown, LayoutList, ZoomIn, ZoomOut } from 'lucide-react';
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
import EntrySheet from '@/components/timeline/EntrySheet';
import CategorySidebar from '@/components/timeline/CategorySidebar';
import LivePanel from '@/components/timeline/LivePanel';
import ConflictResolver from '@/components/timeline/ConflictResolver';
import DayPickerDialog from '@/components/timeline/DayPickerDialog';
import HotelWizard from '@/components/timeline/HotelWizard';
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

  // Unified sheet state
  const [sheetMode, setSheetMode] = useState<'create' | 'view' | null>(null);
  const [sheetEntry, setSheetEntry] = useState<EntryWithOptions | null>(null);
  const [sheetOption, setSheetOption] = useState<EntryOption | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [prefillStartTime, setPrefillStartTime] = useState<string | undefined>();
  const [prefillEndTime, setPrefillEndTime] = useState<string | undefined>();
  const [prefillCategory, setPrefillCategory] = useState<string | undefined>();

  // Category sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Live panel state
  const [liveOpen, setLiveOpen] = useState(false);

  // Conflict resolution state
  const [conflictOpen, setConflictOpen] = useState(false);
  const [currentConflict, setCurrentConflict] = useState<ConflictInfo | null>(null);
  const [currentRecommendations, setCurrentRecommendations] = useState<Recommendation[]>([]);
  const [pendingPlacement, setPendingPlacement] = useState<EntryWithOptions | null>(null);

  // Insert day picker state
  const [insertDayPickerOpen, setInsertDayPickerOpen] = useState(false);
  const [insertingEntry, setInsertingEntry] = useState<EntryWithOptions | null>(null);

  // Hotel wizard state
  const [hotelWizardOpen, setHotelWizardOpen] = useState(false);

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

    // Auto-detect starting TZ from first flight's departure airport
    let currentTz = tripTimezone;
    const allFlightEntries = scheduledEntries
      .filter(e => e.options[0]?.category === 'flight' && e.options[0]?.departure_tz)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    if (allFlightEntries.length > 0) {
      currentTz = allFlightEntries[0].options[0].departure_tz!;
    }

    for (const day of days) {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayEntries = scheduledEntries
        .filter(entry => {
          const entryDay = getDateInTimezone(entry.start_time, currentTz);
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
        // Before the first flight, the user is in the departure city
        const firstFlightOpt = flightEntries[0].options[0];
        if (firstFlightOpt.departure_tz) {
          currentTz = firstFlightOpt.departure_tz;
        }

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
            flightEndUtc: f.end_time,
          };
        });
        map.set(dayStr, { activeTz: currentTz, flights });
        // After this day, the current TZ switches to the last flight's arrival
        currentTz = flightEntries[flightEntries.length - 1].options[0].arrival_tz!;
      }
    }

    return map;
  }, [trip, scheduledEntries, tripTimezone]);

  // Compute per-day location (lat/lng) based on flights for sun gradient & weather
  const dayLocationMap = useMemo(() => {
    const map = new Map<string, { lat: number; lng: number }>();
    if (!trip) return map;

    const days = getDays();

    // Find all flights sorted chronologically
    const allFlights = scheduledEntries
      .filter(e => e.options[0]?.category === 'flight')
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    // Determine initial location from first flight's departure, or fallback
    let currentLat = allFlights[0]?.options[0]?.latitude ?? null;
    let currentLng = allFlights[0]?.options[0]?.longitude ?? null;

    // For flights, departure_location has "IATA - City" but lat/lng are on the option
    // We need to derive coords from airport data. For now, use option lat/lng as departure coords
    // and look for arrival coords from the next entry after the flight or from airport DB
    // Simple approach: track location changes at flight boundaries
    if (allFlights.length > 0) {
      // Before first flight: use departure location coords
      // Entry options store lat/lng for the primary location; for flights this might be departure
      const firstOpt = allFlights[0].options[0];
      if (firstOpt.latitude != null && firstOpt.longitude != null) {
        currentLat = firstOpt.latitude;
        currentLng = firstOpt.longitude;
      }
    }

    let flightIdx = 0;
    for (const day of days) {
      const dayStr = format(day, 'yyyy-MM-dd');

      // Check if any flight lands on or before this day
      while (flightIdx < allFlights.length) {
        const flight = allFlights[flightIdx];
        const flightDay = getDateInTimezone(flight.end_time, tripTimezone);
        if (flightDay <= dayStr) {
          // After this flight, location is arrival
          const opt = flight.options[0];
          // Try to get arrival coords - check entries right after the flight
          const arrivalEntries = scheduledEntries.filter(e =>
            e.linked_flight_id === flight.id && e.linked_type === 'checkout'
          );
          if (arrivalEntries[0]?.options[0]?.latitude != null) {
            currentLat = arrivalEntries[0].options[0].latitude;
            currentLng = arrivalEntries[0].options[0].longitude;
          } else if (opt.latitude != null && opt.longitude != null) {
            // Fallback to flight option coords (which might be departure)
            // For proper arrival coords we'd need airport DB lookup
            currentLat = opt.latitude;
            currentLng = opt.longitude;
          }
          flightIdx++;
        } else {
          break;
        }
      }

      if (currentLat != null && currentLng != null) {
        map.set(dayStr, { lat: currentLat, lng: currentLng });
      }
    }

    return map;
  }, [trip, scheduledEntries, tripTimezone]);

  const getEntriesForDay = (day: Date): EntryWithOptions[] => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const tzInfo = dayTimezoneMap.get(dayStr);
    const tz = tzInfo?.activeTz || tripTimezone;
    return scheduledEntries.filter(entry => {
      const entryDay = getDateInTimezone(entry.start_time, tz);
      return entryDay === dayStr;
    });
  };

  const getWeatherForDay = (day: Date): WeatherData[] => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return weatherData.filter(w => w.date === dayStr);
  };

  const handleCardTap = (entry: EntryWithOptions, option: EntryOption) => {
    setSheetMode('view');
    setSheetEntry(entry);
    setSheetOption(option);
    setSheetOpen(true);
  };

  // Transport context for gap button
  const [transportContext, setTransportContext] = useState<{ fromAddress: string; toAddress: string; gapMinutes?: number; fromEntryId?: string; toEntryId?: string } | null>(null);

  const handleAddBetween = (prefillTime: string) => {
    setPrefillStartTime(prefillTime);
    setPrefillEndTime(undefined);
    setTransportContext(null);
    setSheetMode('create');
    setSheetEntry(null);
    setSheetOption(null);
    setSheetOpen(true);
  };

  const handleAddTransport = (fromEntryId: string, toEntryId: string, prefillTime: string) => {
    const fromEntry = entries.find(e => e.id === fromEntryId);
    const toEntry = entries.find(e => e.id === toEntryId);
    const fromOpt = fromEntry?.options[0];
    const toOpt = toEntry?.options[0];

    // Use location_name for regular entries, arrival_location for flights (where you end up)
    const fromAddr = fromOpt?.location_name || fromOpt?.arrival_location || '';
    const toAddr = toOpt?.location_name || toOpt?.departure_location || '';

    // Calculate gap in minutes
    let gapMinutes: number | undefined;
    if (fromEntry && toEntry) {
      const gapMs = new Date(toEntry.start_time).getTime() - new Date(fromEntry.end_time).getTime();
      gapMinutes = Math.round(gapMs / 60000);
    }

    setTransportContext({ fromAddress: fromAddr, toAddress: toAddr, gapMinutes, fromEntryId, toEntryId });
    setPrefillStartTime(prefillTime);
    setPrefillEndTime(undefined);
    setPrefillCategory('transfer');
    setSheetMode('create');
    setSheetEntry(null);
    setSheetOption(null);
    setSheetOpen(true);
  };

  const handleDragSlot = (startTime: Date, endTime: Date) => {
    setPrefillStartTime(startTime.toISOString());
    setPrefillEndTime(endTime.toISOString());
    setSheetMode('create');
    setSheetEntry(null);
    setSheetOption(null);
    setSheetOpen(true);
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

    const isFlight = entry.options[0]?.category === 'flight';

    // Block flights that are already scheduled
    if (isFlight && entry.is_scheduled !== false) {
      toast({ title: 'Flight already scheduled', description: 'Flights can only be placed once.', variant: 'destructive' });
      return;
    }

    const dateStr = format(dayDate, 'yyyy-MM-dd');

    // Compute original duration to preserve it
    const originalDurationMs = new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime();
    const durationMin = Math.max(Math.round(originalDurationMs / 60000), 30); // at least 30m

    const startMinutes = Math.round(hourOffset * 60);
    const sH = Math.floor(startMinutes / 60);
    const sM = startMinutes % 60;

    const endMinutes = startMinutes + durationMin;
    const eH = Math.floor(endMinutes / 60);
    const eM = endMinutes % 60;

    const { localToUTC } = await import('@/lib/timezoneUtils');
    const startIso = localToUTC(dateStr, `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`, tripTimezone);
    const endIso = localToUTC(dateStr, `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`, tripTimezone);

    // If already scheduled somewhere, create a copy instead of moving
    const alreadyScheduled = entry.is_scheduled !== false;

    let placedEntryId = entryId;

    if (alreadyScheduled && !isFlight) {
      // Create a copy
      try {
        const { data: newEntry, error: entryErr } = await supabase
          .from('entries')
          .insert({
            trip_id: entry.trip_id,
            start_time: startIso,
            end_time: endIso,
            is_scheduled: true,
            scheduled_day: entry.scheduled_day,
          } as any)
          .select('id')
          .single();
        if (entryErr || !newEntry) throw entryErr;

        placedEntryId = newEntry.id;

        for (const opt of entry.options) {
          const { data: newOpt, error: optErr } = await supabase
            .from('entry_options')
            .insert({
              entry_id: newEntry.id,
              name: opt.name,
              website: opt.website,
              category: opt.category,
              category_color: opt.category_color,
              location_name: opt.location_name,
              latitude: opt.latitude,
              longitude: opt.longitude,
              departure_location: opt.departure_location,
              arrival_location: opt.arrival_location,
              departure_tz: opt.departure_tz,
              arrival_tz: opt.arrival_tz,
              departure_terminal: opt.departure_terminal,
              arrival_terminal: opt.arrival_terminal,
              airport_checkin_hours: opt.airport_checkin_hours,
              airport_checkout_min: opt.airport_checkout_min,
            } as any)
            .select('id')
            .single();
          if (optErr || !newOpt) throw optErr;

          if (opt.images && opt.images.length > 0) {
            await supabase.from('option_images').insert(
              opt.images.map(img => ({
                option_id: newOpt.id,
                image_url: img.image_url,
                sort_order: img.sort_order,
              }))
            );
          }
        }
      } catch (err: any) {
        toast({ title: 'Failed to place copy', description: err?.message, variant: 'destructive' });
        return;
      }
    } else {
      // First placement: move the original
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
    }

    await fetchData();

    // Live travel calculation
    const updatedEntry = { ...entry, start_time: startIso, end_time: endIso, is_scheduled: true };
    const dayEntries = getEntriesForDay(dayDate);
    const sortedDay = [...dayEntries, updatedEntry].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
    const placedIdx = sortedDay.findIndex(e => e.id === placedEntryId);
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
        const recs = generateRecommendations(conflict, sortedDay, placedEntryId);
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
    setSheetOpen(false);
    toast({ title: 'Moved to ideas panel 💡' });
    await fetchData();
  };

  // Handle drag start from sidebar
  const handleSidebarDragStart = (e: React.DragEvent, entry: EntryWithOptions) => {
    e.dataTransfer.setData('text/plain', entry.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Handle duplicate entry
  const handleDuplicate = async (entry: EntryWithOptions) => {
    try {
      // 1. Clone entry row
      const { data: newEntry, error: entryErr } = await supabase
        .from('entries')
        .insert({
          trip_id: entry.trip_id,
          start_time: entry.start_time,
          end_time: entry.end_time,
          is_scheduled: false,
          scheduled_day: entry.scheduled_day,
        } as any)
        .select('id')
        .single();
      if (entryErr || !newEntry) throw entryErr;

      // 2. Clone each option + its images
      for (const opt of entry.options) {
        const { data: newOpt, error: optErr } = await supabase
          .from('entry_options')
          .insert({
            entry_id: newEntry.id,
            name: opt.name,
            website: opt.website,
            category: opt.category,
            category_color: opt.category_color,
            location_name: opt.location_name,
            latitude: opt.latitude,
            longitude: opt.longitude,
            departure_location: opt.departure_location,
            arrival_location: opt.arrival_location,
            departure_tz: opt.departure_tz,
            arrival_tz: opt.arrival_tz,
            departure_terminal: opt.departure_terminal,
            arrival_terminal: opt.arrival_terminal,
            airport_checkin_hours: opt.airport_checkin_hours,
            airport_checkout_min: opt.airport_checkout_min,
          } as any)
          .select('id')
          .single();
        if (optErr || !newOpt) throw optErr;

        // Clone images
        if (opt.images && opt.images.length > 0) {
          await supabase.from('option_images').insert(
            opt.images.map(img => ({
              option_id: newOpt.id,
              image_url: img.image_url,
              sort_order: img.sort_order,
            }))
          );
        }
      }

      toast({ title: 'Entry duplicated ✨' });
      await fetchData();
    } catch (err: any) {
      toast({ title: 'Failed to duplicate', description: err?.message, variant: 'destructive' });
    }
  };

  // Handle insert from sidebar: open day picker
  const handleInsert = (entry: EntryWithOptions) => {
    setInsertingEntry(entry);
    setInsertDayPickerOpen(true);
  };

  // Handle day selection for insert
  const handleInsertDaySelected = async (dayIndex: number) => {
    if (!insertingEntry || !trip) return;

    try {
      const cat = findCategory(insertingEntry.options[0]?.category ?? '');
      const defaultStartHour = cat?.defaultStartHour ?? 10;
      const defaultStartMin = cat?.defaultStartMin ?? 0;
      const defaultDuration = cat?.defaultDurationMin ?? 60;

      const endMinutes = defaultStartHour * 60 + defaultStartMin + defaultDuration;
      const eH = Math.floor(endMinutes / 60);
      const eM = endMinutes % 60;

      const dayDateStr = isUndated
        ? format(addDays(parseISO(REFERENCE_DATE), dayIndex), 'yyyy-MM-dd')
        : format(addDays(parseISO(trip.start_date!), dayIndex), 'yyyy-MM-dd');

      const startIso = localToUTC(
        dayDateStr,
        `${String(defaultStartHour).padStart(2, '0')}:${String(defaultStartMin).padStart(2, '0')}`,
        tripTimezone
      );
      const endIso = localToUTC(
        dayDateStr,
        `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`,
        tripTimezone
      );

      // Clone entry
      const { data: newEntry, error: entryErr } = await supabase
        .from('entries')
        .insert({
          trip_id: insertingEntry.trip_id,
          start_time: startIso,
          end_time: endIso,
          is_scheduled: true,
          scheduled_day: dayIndex,
        } as any)
        .select('id')
        .single();
      if (entryErr || !newEntry) throw entryErr;

      // Clone options + images
      for (const opt of insertingEntry.options) {
        const { data: newOpt, error: optErr } = await supabase
          .from('entry_options')
          .insert({
            entry_id: newEntry.id,
            name: opt.name,
            website: opt.website,
            category: opt.category,
            category_color: opt.category_color,
            location_name: opt.location_name,
            latitude: opt.latitude,
            longitude: opt.longitude,
            departure_location: opt.departure_location,
            arrival_location: opt.arrival_location,
            departure_tz: opt.departure_tz,
            arrival_tz: opt.arrival_tz,
            departure_terminal: opt.departure_terminal,
            arrival_terminal: opt.arrival_terminal,
            airport_checkin_hours: opt.airport_checkin_hours,
            airport_checkout_min: opt.airport_checkout_min,
          } as any)
          .select('id')
          .single();
        if (optErr || !newOpt) throw optErr;

        if (opt.images && opt.images.length > 0) {
          await supabase.from('option_images').insert(
            opt.images.map(img => ({
              option_id: newOpt.id,
              image_url: img.image_url,
              sort_order: img.sort_order,
            }))
          );
        }
      }

      // Close sidebar, scroll to day
      setSidebarOpen(false);
      setInsertingEntry(null);

      await fetchData();

      // Scroll to that day
      setTimeout(() => {
        const dayEl = document.querySelector(`[data-day-index="${dayIndex}"]`);
        if (dayEl) {
          dayEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 200);

      toast({ title: `Entry placed on Day ${dayIndex + 1} ✨` });
    } catch (err: any) {
      toast({ title: 'Failed to insert', description: err?.message, variant: 'destructive' });
    }
  };

  // Day labels for the day picker
  const dayLabels = useMemo(() => {
    const d = getDays();
    return d.map((day, i) => {
      if (isUndated) return `Day ${i + 1}`;
      return `Day ${i + 1} — ${format(day, 'EEE d MMM')}`;
    });
  }, [trip, isUndated]);

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
          setPrefillCategory(undefined);
          setTransportContext(null);
          setSheetMode('create');
          setSheetEntry(null);
          setSheetOption(null);
          setSheetOpen(true);
        }}
        onDataRefresh={fetchData}
        onToggleIdeas={() => setSidebarOpen(prev => !prev)}
        onToggleLive={() => setLiveOpen(prev => !prev)}
        liveOpen={liveOpen}
        ideasCount={unscheduledEntries.length}
        scheduledEntries={scheduledEntries}
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
            {/* LIVE panel (left) */}
            {!isMobile && (
              <LivePanel open={liveOpen} onOpenChange={setLiveOpen} />
            )}

            <main className="flex-1 overflow-y-auto pb-20">
              {days.map((day, index) => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const tzInfo = dayTimezoneMap.get(dayStr);
                const dayLoc = dayLocationMap.get(dayStr);
                return (
                  <CalendarDay
                    key={day.toISOString()}
                    date={day}
                    entries={getEntriesForDay(day)}
                    allEntries={scheduledEntries}
                    formatTime={formatTime}
                    tripTimezone={tripTimezone}
                    userLat={dayLoc?.lat ?? userLat}
                    userLng={dayLoc?.lng ?? userLng}
                    votingLocked={trip.voting_locked}
                    userId={currentUser?.id}
                    userVotes={userVotes}
                    onVoteChange={fetchData}
                    onCardTap={handleCardTap}
                    travelSegments={travelSegments}
                    weatherData={getWeatherForDay(day)}
                    dayLabel={isUndated ? `Day ${index + 1}` : undefined}
                    dayIndex={index}
                    isFirstDay={index === 0}
                    isLastDay={index === days.length - 1}
                    onAddBetween={handleAddBetween}
                    onAddTransport={handleAddTransport}
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
              <CategorySidebar
                open={sidebarOpen}
                onOpenChange={setSidebarOpen}
                entries={entries}
                trip={trip}
                onDragStart={handleSidebarDragStart}
                onCardTap={(entry) => {
                  const opt = entry.options[0];
                  if (opt) handleCardTap(entry, opt);
                }}
                onAddEntry={(catId) => {
                  if (catId === 'hotel') {
                    setHotelWizardOpen(true);
                    return;
                  }
                  setPrefillStartTime(undefined);
                  setPrefillEndTime(undefined);
                  setPrefillCategory(catId);
                  setSheetMode('create');
                  setSheetEntry(null);
                  setSheetOption(null);
                  setSheetOpen(true);
                }}
                onDuplicate={handleDuplicate}
                onInsert={handleInsert}
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

          {/* Mobile FABs */}
          {isMobile && (
            <>
              {/* Mobile Live panel */}
              <LivePanel open={liveOpen} onOpenChange={setLiveOpen} />
              <button
                onClick={() => setSidebarOpen(prev => !prev)}
                className="fixed bottom-20 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                <LayoutList className="h-5 w-5 text-primary-foreground" />
                {unscheduledEntries.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {unscheduledEntries.length}
                  </span>
                )}
              </button>

              <CategorySidebar
                open={sidebarOpen}
                onOpenChange={setSidebarOpen}
                entries={entries}
                trip={trip}
                onDragStart={handleSidebarDragStart}
                onCardTap={(entry) => {
                  const opt = entry.options[0];
                  if (opt) handleCardTap(entry, opt);
                }}
                onAddEntry={(catId) => {
                  if (catId === 'hotel') {
                    setHotelWizardOpen(true);
                    return;
                  }
                  setPrefillStartTime(undefined);
                  setPrefillEndTime(undefined);
                  setPrefillCategory(catId);
                  setSheetMode('create');
                  setSheetEntry(null);
                  setSheetOption(null);
                  setSheetOpen(true);
                }}
                onDuplicate={handleDuplicate}
                onInsert={handleInsert}
              />
            </>
          )}

          <EntrySheet
            mode={sheetMode ?? 'create'}
            open={sheetOpen}
            onOpenChange={(open) => {
              setSheetOpen(open);
              if (!open) {
                setSheetMode(null);
                setSheetEntry(null);
                setSheetOption(null);
                setPrefillStartTime(undefined);
                setPrefillEndTime(undefined);
                setPrefillCategory(undefined);
                setTransportContext(null);
              }
            }}
            tripId={trip.id}
            onSaved={fetchData}
            trip={trip}
            // View mode props
            entry={sheetEntry}
            option={sheetOption}
            formatTime={formatTime}
            userLat={userLat}
            userLng={userLng}
            votingLocked={trip.voting_locked}
            userVotes={userVotes}
            onVoteChange={fetchData}
            onMoveToIdeas={handleMoveToIdeas}
            // Create mode props
            prefillStartTime={prefillStartTime}
            prefillEndTime={prefillEndTime}
            prefillCategory={prefillCategory}
            transportContext={transportContext}
            onTransportConflict={(blockDuration, gapMinutes) => {
              const overflow = blockDuration - gapMinutes;
              if (overflow > 0) {
                const conflict: ConflictInfo = {
                  entryId: 'transport-pending',
                  entryName: 'Transport',
                  discrepancyMin: overflow,
                  prevTravelMin: null,
                  nextTravelMin: null,
                  prevGapMin: gapMinutes,
                  nextGapMin: 0,
                };
                // Find adjacent entries for recommendations
                const fromEntry = transportContext?.fromEntryId ? entries.find(e => e.id === transportContext.fromEntryId) : null;
                const toEntry = transportContext?.toEntryId ? entries.find(e => e.id === transportContext.toEntryId) : null;
                const dayEntries = fromEntry ? entries.filter(e => {
                  const d1 = new Date(e.start_time).toDateString();
                  const d2 = new Date(fromEntry.start_time).toDateString();
                  return d1 === d2 && e.is_scheduled !== false;
                }) : [];
                const recs = generateRecommendations(conflict, dayEntries, 'transport-pending');
                setCurrentConflict(conflict);
                setCurrentRecommendations(recs);
                setConflictOpen(true);
              }
            }}
          />

          <ConflictResolver
            open={conflictOpen}
            onOpenChange={setConflictOpen}
            conflict={currentConflict}
            recommendations={currentRecommendations}
            onApply={handleApplyRecommendation}
            onSkip={handleSkipConflict}
          />

          <DayPickerDialog
            open={insertDayPickerOpen}
            onOpenChange={(open) => {
              setInsertDayPickerOpen(open);
              if (!open) setInsertingEntry(null);
            }}
            days={dayLabels}
            onSelectDay={handleInsertDaySelected}
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

export default Timeline;

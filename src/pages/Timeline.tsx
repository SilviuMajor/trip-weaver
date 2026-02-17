import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { addDays, parseISO, startOfDay, format, isPast, isToday } from 'date-fns';
import { getDateInTimezone, localToUTC, resolveDropTz } from '@/lib/timezoneUtils';
import { findCategory } from '@/lib/categories';
import { inferCategoryFromTypes } from '@/lib/placeTypeMapping';
import { checkOpeningHoursConflict } from '@/lib/entryHelpers';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useGeolocation } from '@/hooks/useGeolocation';

import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useTravelCalculation } from '@/hooks/useTravelCalculation';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { analyzeConflict, generateRecommendations } from '@/lib/conflictEngine';
import { getBlock, getEntriesAfterInBlock } from '@/lib/blockDetection';
import { toast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { Trash2, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import TimelineHeader from '@/components/timeline/TimelineHeader';
import TripNavBar from '@/components/timeline/TripNavBar';
import ContinuousTimeline from '@/components/timeline/ContinuousTimeline';
import EntrySheet from '@/components/timeline/EntrySheet';
import CategorySidebar from '@/components/timeline/CategorySidebar';
import SidebarEntryCard from '@/components/timeline/SidebarEntryCard';
import EntryCard from '@/components/timeline/EntryCard';
import LivePanel from '@/components/timeline/LivePanel';
import ConflictResolver from '@/components/timeline/ConflictResolver';
import DayPickerDialog from '@/components/timeline/DayPickerDialog';
import HotelWizard from '@/components/timeline/HotelWizard';
import UndoRedoButtons from '@/components/timeline/UndoRedoButtons';
import ExploreView from '@/components/timeline/ExploreView';
import type { ExploreResult } from '@/components/timeline/ExploreView';
import type { Trip, Entry, EntryOption, EntryWithOptions, WeatherData } from '@/types/trip';
import type { ConflictInfo, Recommendation } from '@/lib/conflictEngine';

async function autoExtendTripIfNeeded(
  tripId: string,
  entryEndIso: string,
  trip: Trip,
  fetchData: () => Promise<any>
) {
  const REFERENCE_DATE_STR = '2099-01-01';
  if (trip.start_date) {
    // Dated trip: check against end_date
    const entryDateStr = format(new Date(entryEndIso), 'yyyy-MM-dd');
    if (entryDateStr >= REFERENCE_DATE_STR) return; // Don't extend for unscheduled entries
    if (!trip.end_date || entryDateStr > trip.end_date) {
      await supabase.from('trips').update({ end_date: entryDateStr }).eq('id', tripId);
      toast({ title: `Trip extended to ${format(parseISO(entryDateStr), 'EEE d MMM')}` });
      await fetchData();
    }
  } else {
    // Undated trip: check against duration_days
    const refDate = parseISO(REFERENCE_DATE_STR);
    const entryDate = new Date(entryEndIso);
    const daysDiff = Math.ceil((entryDate.getTime() - refDate.getTime()) / 86400000) + 1;
    if (daysDiff > (trip.duration_days ?? 3)) {
      await supabase.from('trips').update({ duration_days: daysDiff }).eq('id', tripId);
      toast({ title: `Trip extended to Day ${daysDiff}` });
      await fetchData();
    }
  }
}

const Timeline = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const { currentUser, isEditor } = useCurrentUser();
  const navigate = useNavigate();
  const { latitude: userLat, longitude: userLng } = useGeolocation();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [entries, setEntries] = useState<EntryWithOptions[]>([]);
  const [userVotes, setUserVotes] = useState<string[]>([]);
  
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalRefreshing, setGlobalRefreshing] = useState(false);

  const homeTimezone = trip?.home_timezone ?? 'Europe/London';

  const formatTime = useCallback((isoString: string, tz?: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-GB', {
      timeZone: tz || homeTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }, [homeTimezone]);

  // Unified sheet state
  const [sheetMode, setSheetMode] = useState<'create' | 'view' | null>(null);
  const [sheetEntry, setSheetEntry] = useState<EntryWithOptions | null>(null);
  const [sheetOption, setSheetOption] = useState<EntryOption | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [prefillStartTime, setPrefillStartTime] = useState<string | undefined>();
  const [prefillEndTime, setPrefillEndTime] = useState<string | undefined>();
  const [prefillCategory, setPrefillCategory] = useState<string | undefined>();
  const [sheetResolvedTz, setSheetResolvedTz] = useState<string | undefined>();

  // Category sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Live panel state
  const [liveOpen, setLiveOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'timeline' | 'live'>('timeline');

  // Zoom state
  const zoomEnabled = localStorage.getItem('timeline-zoom-enabled') !== 'false';
  const [zoomLevel, setZoomLevel] = useState(() => {
    if (!zoomEnabled) return 1.0;
    const saved = sessionStorage.getItem('timeline-zoom');
    return saved ? parseFloat(saved) : 1.0;
  });
  const pixelsPerHour = 80 * zoomLevel;
  const zoomLevelRef = useRef(zoomLevel);
  useEffect(() => { zoomLevelRef.current = zoomLevel; }, [zoomLevel]);

  // Persist zoom to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('timeline-zoom', String(zoomLevel));
  }, [zoomLevel]);

  // Zoom indicator
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const zoomIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (zoomLevel === 1.0) return;
    setShowZoomIndicator(true);
    if (zoomIndicatorTimeoutRef.current) clearTimeout(zoomIndicatorTimeoutRef.current);
    zoomIndicatorTimeoutRef.current = setTimeout(() => setShowZoomIndicator(false), 1200);
  }, [zoomLevel]);
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

  // Explore state
  const [exploreOpen, setExploreOpen] = useState(false);
  const [exploreCategoryId, setExploreCategoryId] = useState<string | null>(null);
  const [exploreSearchQuery, setExploreSearchQuery] = useState<string | null>(null);

  // Floating place for "Add to Timeline" mode
  const [floatingPlaceForTimeline, setFloatingPlaceForTimeline] = useState<ExploreResult | null>(null);

  // Unified sidebar drag state (replaces old touch drag)
  const [sidebarDrag, setSidebarDrag] = useState<{
    entry: EntryWithOptions;
    clientX: number;
    clientY: number;
    globalHour: number | null;
  } | null>(null);
  const [sidebarDragHidePlanner, setSidebarDragHidePlanner] = useState(false);
  const sidebarDragTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sidebarDragRef = useRef<typeof sidebarDrag>(null);

  // Unified explore drag state
  const [exploreDrag, setExploreDrag] = useState<{
    place: ExploreResult;
    clientX: number;
    clientY: number;
    globalHour: number | null;
  } | null>(null);
  const exploreDragTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exploreDragRef = useRef<typeof exploreDrag>(null);

  // Travel calculation
  const { calculateTravel } = useTravelCalculation();

  // Undo/Redo (fetchData ref will be set after declaration)
  const fetchDataRef = useRef<() => Promise<EntryWithOptions[] | undefined>>();
  const { canUndo, canRedo, undo, redo, pushAction } = useUndoRedo(async () => { await fetchDataRef.current?.(); });

  const scrollRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLElement>(null);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [scrollContainerReady, setScrollContainerReady] = useState(false);

  // Drag-to-delete bin state
  const [dragActiveEntryId, setDragActiveEntryId] = useState<string | null>(null);
  const [binHighlighted, setBinHighlighted] = useState(false);
  const binRef = useRef<HTMLDivElement>(null);

  // Sidebar HTML5 drag state (for drag-to-bin from Planner sidebar)
  const [sidebarDragActive, setSidebarDragActive] = useState(false);

  // Planner FAB drop target state
  const plannerFabRef = useRef<HTMLButtonElement>(null);
  const [plannerFabHighlighted, setPlannerFabHighlighted] = useState(false);

  // Three-stage drag phase from ContinuousTimeline
  const [currentDragPhase, setCurrentDragPhase] = useState<'timeline' | 'detached' | null>(null);

  // Detect HTML5 sidebar drags for drag-to-bin
  useEffect(() => {
    const handleDragStart = () => setSidebarDragActive(true);
    const handleDragEnd = () => {
      setSidebarDragActive(false);
      setBinHighlighted(false);
    };
    window.addEventListener('dragstart', handleDragStart);
    window.addEventListener('dragend', handleDragEnd);
    return () => {
      window.removeEventListener('dragstart', handleDragStart);
      window.removeEventListener('dragend', handleDragEnd);
    };
  }, []);


  // Redirect if no user
  useEffect(() => {
    if (!currentUser) {
      navigate(tripId ? `/trip/${tripId}` : '/');
    }
  }, [currentUser, navigate, tripId]);

  // Concurrent fetch guard
  const fetchingRef = useRef(false);

  // Data fetching
  const fetchData = useCallback(async () => {
    if (!tripId) return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
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

      // Step 1: Fetch entries and weather in parallel
      const [entriesRes, weatherRes] = await Promise.all([
        supabase.from('entries').select('*').eq('trip_id', tripId).order('start_time'),
        supabase.from('weather_cache').select('*').eq('trip_id', tripId),
      ]);

      setWeatherData((weatherRes.data ?? []) as WeatherData[]);

      const entriesData = entriesRes.data;
      if (!entriesData || entriesData.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }

      // Step 2: Fetch entry_options filtered by entry IDs
      const entryIds = entriesData.map(e => e.id);
      const [optionsRes] = await Promise.all([
        supabase.from('entry_options').select('*').in('entry_id', entryIds),
      ]);

      // Step 3: Fetch option_images (filtered by option IDs) and votes in parallel
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
      return entriesWithOptions;
    } finally {
      fetchingRef.current = false;
    }
  }, [currentUser, tripId]);

  fetchDataRef.current = fetchData;

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useRealtimeSync(fetchData);

  // Handle adding an Explore result as an unscheduled entry
  const handleAddToPlanner = useCallback(async (place: ExploreResult) => {
    if (!trip || !tripId) return;
    const catId = exploreCategoryId || inferCategoryFromTypes(place.types);
    const cat = findCategory(catId);
    const REFERENCE_DATE_STR = '2099-01-01';
    const startIso = localToUTC(REFERENCE_DATE_STR, '00:00', homeTimezone);
    const endIso = localToUTC(REFERENCE_DATE_STR, '01:00', homeTimezone);

    const { data: d, error } = await supabase
      .from('entries')
      .insert({ trip_id: tripId, start_time: startIso, end_time: endIso, is_scheduled: false } as any)
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
              fetchData(); // Refresh to show images
            }
          }
        } catch (e) {
          console.error('Background photo fetch failed:', e);
        }
      })();
    }
  }, [trip, tripId, exploreCategoryId, homeTimezone, fetchData]);

  // Handle adding an Explore result as a scheduled entry at a specific time
  const handleAddAtTime = useCallback(async (place: ExploreResult, startTime: string, endTime: string) => {
    if (!trip || !tripId) return;
    setExploreOpen(false);
    setExploreCategoryId(null);
    setExploreSearchQuery(null);
    const timeStr = new Date(startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    toast({ title: `Added ${place.name} at ${timeStr}` });

    try {
      const catId = exploreCategoryId || inferCategoryFromTypes(place.types);
      const cat = findCategory(catId);

      const { data: d, error } = await supabase
        .from('entries')
        .insert({ trip_id: tripId, start_time: startTime, end_time: endTime, is_scheduled: true } as any)
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

      await fetchData();
      if (trip) await autoExtendTripIfNeeded(tripId, endTime, trip, fetchData);

      if (place.openingHours) {
        const { isConflict, message } = checkOpeningHoursConflict(place.openingHours as string[], startTime);
        if (isConflict) {
          toast({ title: '⚠️ Venue may be closed', description: message, variant: 'destructive' });
        }
      }

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
      toast({ title: `Failed to add ${place.name}`, description: err.message, variant: 'destructive' });
    }
  }, [trip, tripId, exploreCategoryId, fetchData]);

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

  const _scrollToToday = () => {
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

  const days = useMemo((): Date[] => {
    if (!trip) return [];
    if (isUndated) {
      const count = trip.duration_days ?? 3;
      return Array.from({ length: count }, (_, i) => addDays(parseISO(REFERENCE_DATE), i));
    }
    const start = parseISO(trip.start_date!);
    const end = parseISO(trip.end_date!);
    const maxEnd = addDays(start, 60); // Safety cap: max 60 days
    const cappedEnd = end < maxEnd ? end : maxEnd;
    const result: Date[] = [];
    let current = startOfDay(start);
    while (current <= cappedEnd) {
      result.push(new Date(current));
      current = addDays(current, 1);
    }
    return result;
  }, [trip?.start_date, trip?.end_date, trip?.duration_days, isUndated]);

  const handleTrimDay = async (side: 'start' | 'end') => {
    if (!trip || !tripId) return;
    if (days.length <= 1) return;

    if (side === 'end') {
      let lastOccupied = -1;
      for (let i = days.length - 1; i >= 0; i--) {
        const dayStr = format(days[i], 'yyyy-MM-dd');
        if (scheduledEntries.some(e => getDateInTimezone(e.start_time, homeTimezone) === dayStr)) {
          lastOccupied = i;
          break;
        }
      }
      const trimTo = lastOccupied >= 0 ? lastOccupied : 0;
      const trimCount = days.length - 1 - trimTo;
      if (trimCount <= 0) return;

      if (trip.start_date) {
        await supabase.from('trips').update({ end_date: format(days[trimTo], 'yyyy-MM-dd') }).eq('id', tripId);
      } else {
        await supabase.from('trips').update({ duration_days: trimTo + 1 }).eq('id', tripId);
      }
      toast({ title: `Trimmed ${trimCount} empty day(s) from end` });
      await fetchData();
    } else {
      let firstOccupied = days.length;
      for (let i = 0; i < days.length; i++) {
        const dayStr = format(days[i], 'yyyy-MM-dd');
        if (scheduledEntries.some(e => getDateInTimezone(e.start_time, homeTimezone) === dayStr)) {
          firstOccupied = i;
          break;
        }
      }
      const trimCount = firstOccupied;
      if (trimCount <= 0 || firstOccupied >= days.length) return;

      if (trip.start_date) {
        await supabase.from('trips').update({ start_date: format(days[firstOccupied], 'yyyy-MM-dd') }).eq('id', tripId);
      } else {
        await supabase.from('trips').update({ duration_days: (trip.duration_days ?? 3) - trimCount }).eq('id', tripId);
      }
      toast({ title: `Trimmed ${trimCount} empty day(s) from start` });
      await fetchData();
    }
  };

  // Compute timezone map per day based on flights
  const dayTimezoneMap = useMemo(() => {
    const map = new Map<string, { activeTz: string; flights: Array<{ originTz: string; destinationTz: string; flightStartHour: number; flightEndHour: number; flightEndUtc: string }> }>();
    if (!trip) return map;

    // Auto-detect starting TZ from first flight's departure airport
    let currentTz = homeTimezone;
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
          const depHour = getHour(f.start_time, opt.departure_tz!);
          const utcDurH = (new Date(f.end_time).getTime() - new Date(f.start_time).getTime()) / 3600000;
          return {
            originTz: opt.departure_tz!,
            destinationTz: opt.arrival_tz!,
            flightStartHour: depHour,
            flightEndHour: depHour + utcDurH,
            flightEndUtc: f.end_time,
          };
        });
        // activeTz = destination TZ after last flight (most entries on flight day are post-flight)
        const postFlightTz = flightEntries[flightEntries.length - 1].options[0].arrival_tz!;
        map.set(dayStr, { activeTz: postFlightTz, flights });
        // After this day, the current TZ switches to the last flight's arrival
        currentTz = flightEntries[flightEntries.length - 1].options[0].arrival_tz!;
      }
    }

    return map;
  }, [days, scheduledEntries, homeTimezone]);

  // Compute per-day location (lat/lng) based on flights for sun gradient & weather
  const dayLocationMap = useMemo(() => {
    const map = new Map<string, { lat: number; lng: number }>();
    if (!trip) return map;

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
        const flightOpt = flight.options[0];
        const flightArrTz = flightOpt?.arrival_tz || homeTimezone;
        const flightDay = getDateInTimezone(flight.end_time, flightArrTz);
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
  }, [days, scheduledEntries, homeTimezone]);


  // ─── Snap Release handler (auto-transport on drag snap) ───
  const handleSnapRelease = useCallback(async (draggedEntryId: string, targetEntryId: string, side: 'above' | 'below') => {
    // side === 'below': dragged card placed AFTER target. target=from, dragged=to
    // side === 'above': dragged card placed BEFORE target. dragged=from, target=to
    const fromEntryId = side === 'below' ? targetEntryId : draggedEntryId;
    const toEntryId = side === 'below' ? draggedEntryId : targetEntryId;

    const fromEntry = entries.find(e => e.id === fromEntryId);
    const toEntry = entries.find(e => e.id === toEntryId);
    if (!fromEntry || !toEntry || !tripId) return;

    const fromOpt = fromEntry.options[0];
    const toOpt = toEntry.options[0];
    const fromAddr = fromOpt?.address || fromOpt?.location_name;
    const toAddr = toOpt?.address || toOpt?.location_name;

    // If no addresses on either side, just place adjacent without transport
    if (!fromAddr || !toAddr) return;

    const toastId = sonnerToast.loading('Calculating transport...');

    try {
      const { data: dirData, error: dirError } = await supabase.functions.invoke('google-directions', {
        body: {
          fromAddress: fromAddr,
          toAddress: toAddr,
          modes: ['walk', 'transit', 'drive', 'bicycle'],
          departureTime: fromEntry.end_time,
        },
      });
      if (dirError) throw dirError;

      const defaultMode = (trip as any)?.default_transport_mode || 'transit';
      const allResults: Array<{ mode: string; duration_min: number; distance_km: number; polyline?: string }> = dirData?.results ?? [];
      const defaultResult = allResults.find((r: any) => r.mode === defaultMode) || allResults[0];
      const durationMin = defaultResult?.duration_min ?? 15;
      const blockDur = Math.ceil(durationMin / 5) * 5;

      const transportStartMs = new Date(fromEntry.end_time).getTime();
      const transportEndMs = transportStartMs + blockDur * 60000;

      // Create transport entry
      const { data: newTransport } = await supabase.from('entries').insert({
        trip_id: fromEntry.trip_id,
        start_time: new Date(transportStartMs).toISOString(),
        end_time: new Date(transportEndMs).toISOString(),
        is_scheduled: true,
        from_entry_id: fromEntryId,
        to_entry_id: toEntryId,
      } as any).select().single();

      if (newTransport) {
        const toShort = toAddr.split(',')[0].trim();
        const modeLabel = defaultMode === 'walk' ? 'Walk' : defaultMode === 'transit' ? 'Transit' : defaultMode === 'drive' ? 'Drive' : defaultMode === 'bicycle' ? 'Cycle' : 'Transit';
        await supabase.from('entry_options').insert({
          entry_id: newTransport.id,
          name: `${modeLabel} to ${toShort}`,
          category: 'transfer',
          departure_location: fromAddr,
          arrival_location: toAddr,
          distance_km: defaultResult?.distance_km ?? null,
          route_polyline: defaultResult?.polyline ?? null,
          transport_modes: allResults.length > 0 ? allResults : [{ mode: defaultMode, duration_min: durationMin, distance_km: 0, polyline: null }],
        } as any);
      }

      // Shift the "to" entry to after the transport
      const toOldStart = toEntry.start_time;
      const toOldEnd = toEntry.end_time;
      const toDuration = new Date(toOldEnd).getTime() - new Date(toOldStart).getTime();
      await supabase.from('entries').update({
        start_time: new Date(transportEndMs).toISOString(),
        end_time: new Date(transportEndMs + toDuration).toISOString(),
      }).eq('id', toEntryId);

      sonnerToast.dismiss(toastId);
      sonnerToast.success('Snapped with transport');

      pushAction({
        description: 'Snap with transport',
        undo: async () => {
          if (newTransport) {
            await supabase.from('entry_options').delete().eq('entry_id', newTransport.id);
            await supabase.from('entries').delete().eq('id', newTransport.id);
          }
          await supabase.from('entries').update({
            start_time: toOldStart,
            end_time: toOldEnd,
          }).eq('id', toEntryId);
        },
        redo: async () => { await fetchData(); },
      });

      await fetchData();
    } catch (err) {
      sonnerToast.dismiss(toastId);
      sonnerToast.error('Failed to calculate transport');
      console.error('Snap release failed:', err);
    }
  }, [entries, tripId, trip, fetchData, pushAction]);

  // ─── Chain Shift handler (block resize) ───
  const handleChainShift = useCallback(async (resizedEntryId: string, entryIdsToShift: string[], deltaMs: number) => {
    const updates = entryIdsToShift.map(id => {
      const entry = entries.find(e => e.id === id);
      if (!entry) return null;
      return {
        id,
        oldStart: entry.start_time,
        oldEnd: entry.end_time,
        newStart: new Date(new Date(entry.start_time).getTime() + deltaMs).toISOString(),
        newEnd: new Date(new Date(entry.end_time).getTime() + deltaMs).toISOString(),
      };
    }).filter(Boolean) as { id: string; oldStart: string; oldEnd: string; newStart: string; newEnd: string }[];

    for (const u of updates) {
      await supabase.from('entries').update({ start_time: u.newStart, end_time: u.newEnd }).eq('id', u.id);
    }

    pushAction({
      description: 'Chain resize',
      undo: async () => {
        for (const u of updates) {
          await supabase.from('entries').update({ start_time: u.oldStart, end_time: u.oldEnd }).eq('id', u.id);
        }
      },
      redo: async () => {
        for (const u of updates) {
          await supabase.from('entries').update({ start_time: u.newStart, end_time: u.newEnd }).eq('id', u.id);
        }
      },
    });

    await fetchData();

    // Fire-and-forget transport recalculation for shifted transports
    const transportIds = entryIdsToShift.filter(id => {
      const entry = entries.find(e => e.id === id);
      return entry?.options[0]?.category === 'transfer';
    });
    if (transportIds.length > 0) {
      recalculateTransports(transportIds);
    }
  }, [entries, pushAction, fetchData]);

  // ─── Transport recalculation after chain shift ───
  const recalculateTransports = useCallback(async (transportEntryIds: string[]) => {
    for (const tid of transportEntryIds) {
      const transport = entries.find(e => e.id === tid);
      if (!transport) continue;
      const opt = transport.options[0];
      if (!opt?.departure_location || !opt?.arrival_location) continue;

      try {
        const { data } = await supabase.functions.invoke('google-directions', {
          body: {
            fromAddress: opt.departure_location,
            toAddress: opt.arrival_location,
            modes: ['walk', 'transit', 'drive', 'bicycle'],
            departureTime: transport.start_time,
          },
        });

        const defaultMode = (trip as any)?.default_transport_mode || 'transit';
        const allResults = data?.results ?? [];
        const defaultResult = allResults.find((r: any) => r.mode === defaultMode) || allResults[0];

        if (defaultResult) {
          const newDurationMin = Math.ceil(defaultResult.duration_min / 5) * 5;
          const newEndMs = new Date(transport.start_time).getTime() + newDurationMin * 60000;

          await supabase.from('entries').update({
            end_time: new Date(newEndMs).toISOString(),
          }).eq('id', tid);

          await supabase.from('entry_options').update({
            distance_km: defaultResult.distance_km ?? null,
            route_polyline: defaultResult.polyline ?? null,
            transport_modes: allResults,
          }).eq('entry_id', tid);

          // If transport grew longer, shift subsequent entries forward (expand only)
          const freshEntries = await fetchData() as EntryWithOptions[] | undefined;
          if (freshEntries) {
            const block = getBlock(tid, freshEntries);
            const afterInBlock = getEntriesAfterInBlock(tid, block);

            for (const ae of afterInBlock) {
              const aeStart = new Date(ae.start_time).getTime();
              if (aeStart < newEndMs) {
                const shift = newEndMs - aeStart;
                const aeDur = new Date(ae.end_time).getTime() - aeStart;
                await supabase.from('entries').update({
                  start_time: new Date(aeStart + shift).toISOString(),
                  end_time: new Date(aeStart + shift + aeDur).toISOString(),
                }).eq('id', ae.id);
              } else {
                break;
              }
            }
          }
        }
      } catch (err) {
        console.error('Transport recalc failed for', tid, err);
      }
    }

    await fetchData();
  }, [entries, trip, fetchData]);

  // ─── Group drop handler ───
  const handleGroupDrop = useCallback(async (entryIds: string[], deltaMs: number) => {
    if (deltaMs === 0) return;

    const updates = entryIds.map(id => {
      const entry = entries.find(e => e.id === id);
      if (!entry) return null;
      return {
        id,
        oldStart: entry.start_time,
        oldEnd: entry.end_time,
        newStart: new Date(new Date(entry.start_time).getTime() + deltaMs).toISOString(),
        newEnd: new Date(new Date(entry.end_time).getTime() + deltaMs).toISOString(),
      };
    }).filter(Boolean) as { id: string; oldStart: string; oldEnd: string; newStart: string; newEnd: string }[];

    if (updates.length === 0) return;

    for (const u of updates) {
      await supabase.from('entries').update({ start_time: u.newStart, end_time: u.newEnd }).eq('id', u.id);
    }

    pushAction({
      description: 'Move group',
      undo: async () => {
        for (const u of updates) {
          await supabase.from('entries').update({ start_time: u.oldStart, end_time: u.oldEnd }).eq('id', u.id);
        }
      },
      redo: async () => {
        for (const u of updates) {
          await supabase.from('entries').update({ start_time: u.newStart, end_time: u.newEnd }).eq('id', u.id);
        }
      },
    });

    await fetchData();

    // Recalculate transports in the group (background)
    const transportIds = entryIds.filter(id => {
      const entry = entries.find(e => e.id === id);
      return entry?.options[0]?.category === 'transfer';
    });
    if (transportIds.length > 0) {
      recalculateTransports(transportIds);
    }
  }, [entries, pushAction, fetchData, recalculateTransports]);


  // Global refresh: recalculate all transport + weather
  const handleGlobalRefresh = useCallback(async () => {
    if (!tripId || !trip) return;
    setGlobalRefreshing(true);
    try {
      // Build weather segments from dayLocationMap
      const refreshDays = (() => {
        if (!trip.start_date) return [];
        const start = parseISO(trip.start_date);
        const end = parseISO(trip.end_date!);
        const result: Date[] = [];
        let cur = startOfDay(start);
        while (cur <= end) { result.push(new Date(cur)); cur = addDays(cur, 1); }
        return result;
      })();

      // Group consecutive days with same location into segments
      const segments: { lat: number; lng: number; startDate: string; endDate: string }[] = [];
      let currentSeg: { lat: number; lng: number; startDate: string; endDate: string } | null = null;
      for (const day of refreshDays) {
        const dayStr = format(day, 'yyyy-MM-dd');
        const loc = dayLocationMap.get(dayStr);
        if (!loc) continue;
        if (currentSeg && currentSeg.lat === loc.lat && currentSeg.lng === loc.lng) {
          currentSeg.endDate = dayStr;
        } else {
          if (currentSeg) segments.push(currentSeg);
          currentSeg = { lat: loc.lat, lng: loc.lng, startDate: dayStr, endDate: dayStr };
        }
      }
      if (currentSeg) segments.push(currentSeg);

      await Promise.all([
        supabase.functions.invoke('auto-generate-transport', { body: { tripId } }),
        segments.length > 0
          ? supabase.functions.invoke('fetch-weather', { body: { tripId, segments } })
          : Promise.resolve(),
      ]);
      await fetchDataRef.current?.();
      toast({ title: 'Weather & routes updated' });
    } catch (err) {
      console.error('Global refresh failed:', err);
      toast({ title: 'Refresh failed', description: 'Please try again', variant: 'destructive' });
    } finally {
      setGlobalRefreshing(false);
    }
  }, [tripId, trip, dayLocationMap]);

  const getEntriesForDay = (day: Date): EntryWithOptions[] => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const tzInfo = dayTimezoneMap.get(dayStr);
    const tz = tzInfo?.activeTz || homeTimezone;
    return scheduledEntries.filter(entry => {
      const entryDay = getDateInTimezone(entry.start_time, tz);
      return entryDay === dayStr;
    });
  };

  const getWeatherForDay = (day: Date): WeatherData[] => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return weatherData.filter(w => w.date === dayStr);
  };

  // Resolve correct TZ for a given UTC time, accounting for flight boundaries
  const resolveTimezoneForTime = useCallback((isoTime: string): string => {
    for (const [dayStr, info] of dayTimezoneMap) {
      if (getDateInTimezone(isoTime, info.activeTz) === dayStr) {
        if (info.flights.length > 0) {
          const lastFlight = info.flights[info.flights.length - 1];
          if (lastFlight.flightEndUtc) {
            const timeMs = new Date(isoTime).getTime();
            const flightEndMs = new Date(lastFlight.flightEndUtc).getTime();
            if (timeMs >= flightEndMs) {
              return lastFlight.destinationTz;
            }
          }
        }
        return info.activeTz;
      }
    }
    return homeTimezone;
  }, [dayTimezoneMap, homeTimezone]);

  const handleCardTap = (entry: EntryWithOptions, option: EntryOption) => {
    setSheetResolvedTz(resolveTimezoneForTime(entry.start_time));
    setSheetMode('view');
    setSheetEntry(entry);
    setSheetOption(option);
    setSheetOpen(true);
  };

  // Transport context for gap button
  const [transportContext, setTransportContext] = useState<{ fromAddress: string; toAddress: string; gapMinutes?: number; fromEntryId?: string; toEntryId?: string; resolvedTz?: string } | null>(null);
  const [gapContext, setGapContext] = useState<{ fromName: string; toName: string; fromAddress: string; toAddress: string } | null>(null);

  const handleAddBetween = (prefillTime: string, ctx?: { fromName: string; toName: string; fromAddress: string; toAddress: string }) => {
    setPrefillStartTime(prefillTime);
    setPrefillEndTime(undefined);
    setTransportContext(null);
    setGapContext(ctx ?? null);
    setSheetResolvedTz(resolveTimezoneForTime(prefillTime));
    setSheetMode('create');
    setSheetEntry(null);
    setSheetOption(null);
    setSheetOpen(true);
  };


  const handleDragSlot = (startIso: string, endIso: string) => {
    setPrefillStartTime(startIso);
    setPrefillEndTime(endIso);
    setSheetResolvedTz(resolveTimezoneForTime(startIso));
    setSheetMode('create');
    setSheetEntry(null);
    setSheetOption(null);
    setSheetOpen(true);
  };

  const handleEntryTimeChange = async (entryId: string, newStartIso: string, newEndIso: string) => {
    // Record undo action
    const entry = entries.find(e => e.id === entryId);
    if (entry) {
      const oldStart = entry.start_time;
      const oldEnd = entry.end_time;
      const desc = `Move ${entry.options[0]?.name || 'entry'}`;
      pushAction({
        description: desc,
        undo: async () => {
          await supabase.from('entries').update({ start_time: oldStart, end_time: oldEnd }).eq('id', entryId);
        },
        redo: async () => {
          await supabase.from('entries').update({ start_time: newStartIso, end_time: newEndIso }).eq('id', entryId);
        },
      });
    }

    const { error } = await supabase
      .from('entries')
      .update({ start_time: newStartIso, end_time: newEndIso })
      .eq('id', entryId);
    if (error) {
      console.error('Failed to update entry time:', error);
      return;
    }

    // Auto-reposition linked transport entries (preserve duration, don't re-fetch)
    try {
      const { data: linkedTransports } = await supabase
        .from('entries')
        .select('id, from_entry_id, to_entry_id, start_time, end_time')
        .or(`from_entry_id.eq.${entryId},to_entry_id.eq.${entryId}`);

      if (linkedTransports && linkedTransports.length > 0) {
        for (const transport of linkedTransports) {
          const fromId = transport.from_entry_id;
          if (!fromId) continue;

          // Get the "from" entry's new end time
          const { data: fromEntry } = await supabase
            .from('entries')
            .select('end_time')
            .eq('id', fromId)
            .single();

          if (!fromEntry) continue;

          // Preserve existing transport duration, just reposition
          const transportDurationMs = new Date(transport.end_time).getTime() - new Date(transport.start_time).getTime();
          const newTransportStart = fromEntry.end_time;
          const newTransportEnd = new Date(new Date(newTransportStart).getTime() + transportDurationMs).toISOString();
          await supabase.from('entries').update({ start_time: newTransportStart, end_time: newTransportEnd }).eq('id', transport.id);

        }
      }
    } catch (err) {
      console.error('Failed to reposition transport:', err);
    }

    await fetchData();

    // ─── Smart Drop: push overlapped card down ───
    const newStartMs = new Date(newStartIso).getTime();
    const newEndMs = new Date(newEndIso).getTime();

    const overlapped = scheduledEntries.find(e => {
      if (e.id === entryId) return false;
      if (e.options[0]?.category === 'transfer') return false;
      const eStart = new Date(e.start_time).getTime();
      const eEnd = new Date(e.end_time).getTime();
      return newStartMs < eEnd && newEndMs > eStart;
    });

    if (overlapped && !overlapped.is_locked) {
      const pushedStart = newEndMs;
      const pushedDuration = new Date(overlapped.end_time).getTime() - new Date(overlapped.start_time).getTime();
      const pushedEnd = pushedStart + pushedDuration;

      // Check: would push collide with a locked card?
      const wouldCollide = scheduledEntries.find(e => {
        if (e.id === entryId || e.id === overlapped.id) return false;
        if (!e.is_locked) return false;
        const eStart = new Date(e.start_time).getTime();
        return pushedEnd > eStart && pushedStart < new Date(e.end_time).getTime();
      });

      // Check: would push overlap ANY other card? (no cascading)
      const wouldOverlapAnother = scheduledEntries.find(e => {
        if (e.id === entryId || e.id === overlapped.id) return false;
        if (e.options[0]?.category === 'transfer') return false;
        const eStart = new Date(e.start_time).getTime();
        const eEnd = new Date(e.end_time).getTime();
        return pushedStart < eEnd && pushedEnd > eStart;
      });

      if (!wouldCollide && !wouldOverlapAnother) {
        const oldOverlapStart = overlapped.start_time;
        const oldOverlapEnd = overlapped.end_time;

        await supabase.from('entries').update({
          start_time: new Date(pushedStart).toISOString(),
          end_time: new Date(pushedEnd).toISOString(),
        }).eq('id', overlapped.id);

        sonnerToast.success(`Pushed ${overlapped.options[0]?.name || 'entry'} to make room`);

        pushAction({
          description: 'Smart drop + push',
          undo: async () => {
            await supabase.from('entries').update({
              start_time: oldOverlapStart,
              end_time: oldOverlapEnd,
            }).eq('id', overlapped.id);
          },
          redo: async () => {
            await supabase.from('entries').update({
              start_time: new Date(pushedStart).toISOString(),
              end_time: new Date(pushedEnd).toISOString(),
            }).eq('id', overlapped.id);
          },
        });

        handleSnapRelease(entryId, overlapped.id, 'below');
        await fetchData();
      }
    } else if (overlapped && overlapped.is_locked) {
      sonnerToast(`Overlaps ${overlapped.options[0]?.name || 'a locked entry'}`, {
        description: 'Unlock it to rearrange',
      });
    }

    // Auto-extend trip if entry goes past final day
    if (trip && tripId) await autoExtendTripIfNeeded(tripId, newEndIso, trip, fetchData);

  };

  // Handle mode switch confirm from TransportConnector
  const handleModeSwitchConfirm = async (entryId: string, mode: string, newDurationMin: number, distanceKm: number, polyline?: string | null) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    const opt = entry.options[0];

    // Capture old state for undo
    const oldEndTime = entry.end_time;
    const oldOptName = opt?.name ?? '';
    const oldDistanceKm = (opt as any)?.distance_km ?? null;
    const oldPolyline = (opt as any)?.route_polyline ?? null;
    let oldNextStart: string | null = null;
    let oldNextEnd: string | null = null;

    if (entry.to_entry_id) {
      const nextE = entries.find(e => e.id === entry.to_entry_id);
      if (nextE) {
        oldNextStart = nextE.start_time;
        oldNextEnd = nextE.end_time;
      }
    }

    const blockDur = Math.ceil(newDurationMin / 5) * 5;
    const newEndIso = new Date(new Date(entry.start_time).getTime() + blockDur * 60000).toISOString();

    // Update entry times
    await supabase.from('entries').update({ end_time: newEndIso }).eq('id', entryId);

    // Update option name, distance, polyline
    if (opt) {
      const modeLabels: Record<string, string> = { walk: 'Walk', transit: 'Transit', drive: 'Drive', bicycle: 'Cycle' };
      const toShort = (opt.arrival_location || '').split(',')[0].trim();
      const newName = `${modeLabels[mode] || mode} to ${toShort}`;
      await supabase.from('entry_options').update({
        name: newName,
        distance_km: distanceKm,
        route_polyline: polyline ?? null,
      } as any).eq('id', opt.id);
    }

    // Fix 2 & 4: Always pull/push the next event to meet transport end
    if (entry.to_entry_id) {
      const { data: nextEntry } = await supabase.from('entries').select('id, start_time, end_time, is_locked').eq('id', entry.to_entry_id).single();
      if (nextEntry && !nextEntry.is_locked) {
        const newTransportEnd = new Date(new Date(entry.start_time).getTime() + blockDur * 60000);
        const nextDuration = new Date(nextEntry.end_time).getTime() - new Date(nextEntry.start_time).getTime();
        await supabase.from('entries').update({
          start_time: newTransportEnd.toISOString(),
          end_time: new Date(newTransportEnd.getTime() + nextDuration).toISOString(),
        }).eq('id', nextEntry.id);
      }
    }

    // Push undo action for mode switch
    pushAction({
      description: `Switch transport mode to ${mode}`,
      undo: async () => {
        await supabase.from('entries').update({ end_time: oldEndTime }).eq('id', entryId);
        if (opt) {
          await supabase.from('entry_options').update({
            name: oldOptName,
            distance_km: oldDistanceKm,
            route_polyline: oldPolyline,
          } as any).eq('id', opt.id);
        }
        if (entry.to_entry_id && oldNextStart && oldNextEnd) {
          await supabase.from('entries').update({
            start_time: oldNextStart,
            end_time: oldNextEnd,
          }).eq('id', entry.to_entry_id);
        }
      },
      redo: async () => {
        await handleModeSwitchConfirm(entryId, mode, newDurationMin, distanceKm, polyline);
      },
    });

    await fetchData();
  };

  // Handle delete transport with undo support
  const handleDeleteTransport = async (entryId: string) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    const opt = entry.options[0];
    const entryData = {
      trip_id: entry.trip_id,
      start_time: entry.start_time,
      end_time: entry.end_time,
      from_entry_id: entry.from_entry_id,
      to_entry_id: entry.to_entry_id,
      is_scheduled: entry.is_scheduled,
      scheduled_day: entry.scheduled_day,
    };
    const optionData = opt ? {
      name: opt.name,
      category: opt.category,
      category_color: opt.category_color,
      departure_location: opt.departure_location,
      arrival_location: opt.arrival_location,
      distance_km: (opt as any).distance_km,
      route_polyline: (opt as any).route_polyline,
      transport_modes: opt.transport_modes,
    } : null;

    pushAction({
      description: `Delete ${opt?.name || 'transport'}`,
      undo: async () => {
        // Re-insert the transport entry
        const { data: newEntry } = await supabase.from('entries').insert(entryData as any).select().single();
        if (newEntry && optionData) {
          await supabase.from('entry_options').insert({ ...optionData, entry_id: newEntry.id } as any);
        }
        await fetchData();
      },
      redo: async () => {
        // Delete again by matching from/to
        const { data: match } = await supabase.from('entries')
          .select('id')
          .eq('from_entry_id', entryData.from_entry_id ?? '')
          .eq('to_entry_id', entryData.to_entry_id ?? '')
          .eq('trip_id', entryData.trip_id)
          .single();
        if (match) {
          await supabase.from('entry_options').delete().eq('entry_id', match.id);
          await supabase.from('entries').delete().eq('id', match.id);
        }
        await fetchData();
      },
    });

    // Delete option first, then entry
    if (opt) {
      await supabase.from('entry_options').delete().eq('entry_id', entryId);
    }
    await supabase.from('entries').delete().eq('id', entryId);

    toast({ title: 'Transport deleted', description: 'Press Ctrl+Z to undo' });
    await fetchData();
  };

  // Handle drop from ideas panel onto timeline (global hour)
  const handleDropOnTimeline = async (entryId: string, globalHour: number) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    const isFlight = entry.options[0]?.category === 'flight';

    // Block flights that are already scheduled
    if (isFlight && entry.is_scheduled !== false) {
      toast({ title: 'Flight already scheduled', description: 'Flights can only be placed once.', variant: 'destructive' });
      return;
    }

    const dayIndex = Math.max(0, Math.min(Math.floor(globalHour / 24), days.length - 1));
    const dayDate = days[dayIndex];
    const dateStr = format(dayDate, 'yyyy-MM-dd');
    const localHour = globalHour - dayIndex * 24;

    // Compute original duration to preserve it
    const originalDurationMs = new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime();
    const durationMin = Math.max(Math.round(originalDurationMs / 60000), 30); // at least 30m

    const startMinutes = Math.round(localHour * 60);
    const sH = Math.floor(startMinutes / 60) % 24;
    const sM = startMinutes % 60;

    const endMinutes = startMinutes + durationMin;
    const eH = Math.floor(endMinutes / 60) % 24;
    const eM = endMinutes % 60;

    const dayKey = format(dayDate, 'yyyy-MM-dd');
    const tzInfo = dayTimezoneMap.get(dayKey);
    const resolvedTz = resolveDropTz(localHour, tzInfo, homeTimezone);
    const startIso = localToUTC(dateStr, `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`, resolvedTz);
    // End might be on next day
    const endDayIndex = Math.min(Math.floor((globalHour + durationMin / 60) / 24), days.length - 1);
    const endDateStr = format(days[endDayIndex], 'yyyy-MM-dd');
    const endIso = localToUTC(endDateStr, `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`, resolvedTz);

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

    // Auto-extend trip if entry goes past final day
    if (trip) await autoExtendTripIfNeeded(tripId!, endIso, trip, fetchData);

    // Check if venue is closed on the scheduled day
    const droppedOpt = entry.options?.[0];
    if (droppedOpt?.opening_hours) {
      const { isConflict, message } = checkOpeningHoursConflict(droppedOpt.opening_hours as string[], startIso);
      if (isConflict) {
        toast({ title: '⚠️ Venue may be closed', description: message, variant: 'destructive' });
      }
    }

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

  // Handle drop of ExploreCard onto timeline
  const handleDropExploreCard = useCallback(async (place: ExploreResult, categoryId: string | null, globalHour: number) => {
    if (!trip || !tripId) return;

    const daysArr = days;
    const dayIndex = Math.max(0, Math.min(Math.floor(globalHour / 24), daysArr.length - 1));
    const dayDate = daysArr[dayIndex];
    const dateStr = format(dayDate, 'yyyy-MM-dd');
    const localHour = globalHour - dayIndex * 24;
    const durationMin = 60;

    const startMinutes = Math.round(localHour * 60);
    const sH = Math.floor(startMinutes / 60) % 24;
    const sM = startMinutes % 60;
    const endMinutes = startMinutes + durationMin;
    const eH = Math.floor(endMinutes / 60) % 24;
    const eM = endMinutes % 60;

    const dayKey = format(dayDate, 'yyyy-MM-dd');
    const tzInfo = dayTimezoneMap.get(dayKey);
    const resolvedTz = resolveDropTz(localHour, tzInfo, homeTimezone);
    const startIso = localToUTC(dateStr, `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`, resolvedTz);
    const endDayIndex = Math.min(Math.floor((globalHour + durationMin / 60) / 24), daysArr.length - 1);
    const endDateStr = format(daysArr[endDayIndex], 'yyyy-MM-dd');
    const endIso = localToUTC(endDateStr, `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`, resolvedTz);

    await handleAddAtTime(place, startIso, endIso);
  }, [trip, tripId, dayTimezoneMap, homeTimezone, handleAddAtTime]);

  // Handle "Add to Timeline" from PlaceOverview
  const handleAddToTimeline = useCallback((place: ExploreResult) => {
    setExploreOpen(false);
    setExploreCategoryId(null);
    setExploreSearchQuery(null);
    setFloatingPlaceForTimeline(place);
  }, []);

  // Unified sidebar drag callbacks
  useEffect(() => {
    sidebarDragRef.current = sidebarDrag;
  }, [sidebarDrag]);

  const handleSidebarDragStartUnified = useCallback((entry: EntryWithOptions, pos: { x: number; y: number }) => {
    setSidebarDrag({ entry, clientX: pos.x, clientY: pos.y, globalHour: null });
    setSidebarDragHidePlanner(true);
    // 5-second cancel timeout
    if (sidebarDragTimeoutRef.current) clearTimeout(sidebarDragTimeoutRef.current);
    sidebarDragTimeoutRef.current = setTimeout(() => {
      setSidebarDrag(null);
      setSidebarDragHidePlanner(false);
      setSidebarOpen(false);
    }, 5000);
  }, []);

  const handleSidebarDragMoveUnified = useCallback((x: number, y: number) => {
    // Reset cancel timeout on movement
    if (sidebarDragTimeoutRef.current) {
      clearTimeout(sidebarDragTimeoutRef.current);
      sidebarDragTimeoutRef.current = null;
    }

    // Calculate which global hour the pointer is over
    const timelineEl = document.querySelector('[data-timeline-area]');
    let globalHour: number | null = null;
    if (timelineEl) {
      const rect = timelineEl.getBoundingClientRect();
      const relativeY = y - rect.top;
      const rawGlobalHour = relativeY / pixelsPerHour;
      const currentDrag = sidebarDragRef.current;
      const entryDurationHours = currentDrag?.entry
        ? (new Date(currentDrag.entry.end_time).getTime() -
           new Date(currentDrag.entry.start_time).getTime()) / 3600000
        : 1;
      const centredHour = rawGlobalHour - (entryDurationHours / 2);
      const snapped = Math.round(centredHour * 4) / 4;
      globalHour = snapped >= 0 ? snapped : 0;
    }

    setSidebarDrag(prev => prev ? { ...prev, clientX: x, clientY: y, globalHour } : null);

    // Auto-scroll near edges
    const SCROLL_ZONE = 80;
    const SCROLL_SPEED = 8;
    const scrollEl = mainScrollRef.current;
    if (scrollEl) {
      if (y < SCROLL_ZONE) {
        scrollEl.scrollBy(0, -SCROLL_SPEED);
      } else if (y > window.innerHeight - SCROLL_ZONE) {
        scrollEl.scrollBy(0, SCROLL_SPEED);
      }
    }
  }, [pixelsPerHour]);

  const handleSidebarDragEndUnified = useCallback(() => {
    const drag = sidebarDragRef.current;
    if (drag && drag.globalHour !== null) {
      handleDropOnTimeline(drag.entry.id, drag.globalHour);
    }
    setSidebarDrag(null);
    setSidebarDragHidePlanner(false);
    setSidebarOpen(false);
    if (sidebarDragTimeoutRef.current) {
      clearTimeout(sidebarDragTimeoutRef.current);
      sidebarDragTimeoutRef.current = null;
    }
  }, []);

  // Unified explore drag callbacks
  useEffect(() => {
    exploreDragRef.current = exploreDrag;
  }, [exploreDrag]);

  const handleExploreDragStartUnified = useCallback((place: ExploreResult, pos: { x: number; y: number }) => {
    setExploreDrag({ place, clientX: pos.x, clientY: pos.y, globalHour: null });
    // On mobile, hide explore panel
    if (window.innerWidth < 768) {
      setExploreOpen(false);
    }
    // 5-second cancel timeout
    if (exploreDragTimeoutRef.current) clearTimeout(exploreDragTimeoutRef.current);
    exploreDragTimeoutRef.current = setTimeout(() => {
      setExploreDrag(null);
    }, 5000);
  }, []);

  const handleExploreDragMoveUnified = useCallback((x: number, y: number) => {
    // Reset cancel timeout on movement
    if (exploreDragTimeoutRef.current) {
      clearTimeout(exploreDragTimeoutRef.current);
      exploreDragTimeoutRef.current = null;
    }

    let globalHour: number | null = null;
    const timelineArea = document.querySelector('[data-timeline-area]');
    if (timelineArea) {
      const rect = timelineArea.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right) {
        const relativeY = y - rect.top;
        const rawGlobalHour = relativeY / pixelsPerHour;
        globalHour = Math.round(rawGlobalHour * 4) / 4; // 15-min snap
      }
    }

    setExploreDrag(prev => prev ? { ...prev, clientX: x, clientY: y, globalHour } : null);

    // Auto-scroll near edges
    const scrollEl = mainScrollRef.current;
    if (scrollEl) {
      const rect = scrollEl.getBoundingClientRect();
      const SCROLL_ZONE = 80;
      if (y < rect.top + SCROLL_ZONE) {
        scrollEl.scrollTop -= 8;
      } else if (y > rect.bottom - SCROLL_ZONE) {
        scrollEl.scrollTop += 8;
      }
    }
  }, [pixelsPerHour]);

  const handleExploreDragEndUnified = useCallback(() => {
    const drag = exploreDragRef.current;
    if (drag && drag.globalHour !== null && drag.globalHour >= 0) {
      const catId = inferCategoryFromTypes(drag.place.types);
      handleDropExploreCard(drag.place, catId, drag.globalHour);
    }
    setExploreDrag(null);
    if (exploreDragTimeoutRef.current) {
      clearTimeout(exploreDragTimeoutRef.current);
      exploreDragTimeoutRef.current = null;
    }
  }, [handleDropExploreCard]);


  const lastPinchDistRef = useRef<number | null>(null);
  const pinchAnchorScrollRef = useRef<number>(0);
  const pinchAnchorZoomRef = useRef<number>(1);
  const pinchAnchorYRef = useRef<number>(0);

  useEffect(() => {
    if (!zoomEnabled) return;
    const el = mainScrollRef.current;
    if (!el) return;

    const getDistance = (t1: Touch, t2: Touch) =>
      Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        lastPinchDistRef.current = getDistance(e.touches[0], e.touches[1]);
        pinchAnchorZoomRef.current = zoomLevelRef.current;
        pinchAnchorScrollRef.current = el.scrollTop;
        pinchAnchorYRef.current = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && lastPinchDistRef.current !== null) {
        e.preventDefault();
        const newDist = getDistance(e.touches[0], e.touches[1]);
        const scale = newDist / lastPinchDistRef.current;
        const newZoom = Math.min(2.0, Math.max(0.5, pinchAnchorZoomRef.current * scale));

        const anchorY = pinchAnchorYRef.current;
        const rect = el.getBoundingClientRect();
        const anchorRelative = anchorY - rect.top + pinchAnchorScrollRef.current;
        const anchorHour = anchorRelative / (80 * pinchAnchorZoomRef.current);
        const newAnchorPixel = anchorHour * (80 * newZoom);
        const newScrollTop = newAnchorPixel - (anchorY - rect.top);

        setZoomLevel(newZoom);
        requestAnimationFrame(() => {
          el.scrollTop = newScrollTop;
        });
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        lastPinchDistRef.current = null;
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [zoomEnabled, scrollContainerReady]);

  // Desktop zoom (Ctrl+scroll / trackpad pinch)
  useEffect(() => {
    if (!zoomEnabled) return;
    const el = mainScrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();

      const delta = -e.deltaY * 0.005;
      const currentZoom = zoomLevelRef.current;
      const newZoom = Math.min(2.0, Math.max(0.5, currentZoom + delta));

      const rect = el.getBoundingClientRect();
      const anchorRelative = e.clientY - rect.top + el.scrollTop;
      const anchorHour = anchorRelative / (80 * currentZoom);
      const newAnchorPixel = anchorHour * (80 * newZoom);
      const newScrollTop = newAnchorPixel - (e.clientY - rect.top);

      setZoomLevel(newZoom);
      requestAnimationFrame(() => {
        el.scrollTop = newScrollTop;
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [zoomEnabled, scrollContainerReady]);

  // Bin + Planner FAB proximity detection is now handled via onDragPositionUpdate callback


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

  // Handle "Send to Planner" from overlay
  const handleSendToPlanner = async (entryId: string) => {
    const { error } = await supabase
      .from('entries')
      .update({ is_scheduled: false } as any)
      .eq('id', entryId);
    if (error) {
      toast({ title: 'Failed to move', description: error.message, variant: 'destructive' });
      return;
    }
    setSheetOpen(false);
    toast({
      title: 'Event moved to Planner 📋',
      action: (
        <button
          className="ml-2 shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          onClick={async () => {
            await supabase.from('entries').update({ is_scheduled: true } as any).eq('id', entryId);
            await fetchData();
          }}
        >
          Undo
        </button>
      ),
    });
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

      const dayTzInfo = dayTimezoneMap.get(dayDateStr);
      const insertTz = dayTzInfo?.activeTz || homeTimezone;
      const startIso = localToUTC(
        dayDateStr,
        `${String(defaultStartHour).padStart(2, '0')}:${String(defaultStartMin).padStart(2, '0')}`,
        insertTz
      );
      const endIso = localToUTC(
        dayDateStr,
        `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`,
        insertTz
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
    return days.map((day, i) => {
      if (isUndated) return `Day ${i + 1}`;
      return `Day ${i + 1} — ${format(day, 'EEE d MMM')}`;
    });
  }, [days, isUndated]);

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

  // Auto-generate transport between events
  const [autoTransportLoading, setAutoTransportLoading] = useState(false);

  const handleAutoGenerateTransport = async () => {
    if (!tripId) return;
    setAutoTransportLoading(true);
    try {
      toast({ title: 'Generating transport…', description: 'Calculating routes between your events' });

      const { data, error } = await supabase.functions.invoke('auto-generate-transport', {
        body: { tripId },
      });
      if (error) throw error;

      // Refresh to get the new transport entries
      await fetchData();

      // Always run snap + push algorithm after transport creation
      const { data: freshEntries } = await supabase
        .from('entries')
        .select('*')
        .eq('trip_id', tripId)
        .eq('is_scheduled', true)
        .order('start_time');

      if (freshEntries && freshEntries.length > 0) {
        const { data: freshOptions } = await supabase
          .from('entry_options')
          .select('entry_id, category')
          .in('entry_id', freshEntries.map((e: any) => e.id));

        const optMap = new Map<string, string>();
        for (const o of (freshOptions ?? [])) {
          if (!optMap.has(o.entry_id)) optMap.set(o.entry_id, o.category ?? '');
        }

        // Helper: get calendar day key in trip timezone
        const getDayKey = (isoTime: string) => {
          // Use per-day resolved TZ for accurate day grouping
          for (const [dayStr, info] of dayTimezoneMap) {
            if (getDateInTimezone(isoTime, info.activeTz) === dayStr) return dayStr;
          }
          return getDateInTimezone(isoTime, homeTimezone);
        };

        // Group by calendar day in trip timezone
        const dayGroupsForPush = new Map<string, any[]>();
        for (const e of freshEntries) {
          const dayStr = getDayKey(e.start_time);
          if (!dayGroupsForPush.has(dayStr)) dayGroupsForPush.set(dayStr, []);
          dayGroupsForPush.get(dayStr)!.push(e);
        }

        const updates: Array<{ id: string; start_time: string; end_time: string }> = [];

        for (const [dayKey, dayEnts] of dayGroupsForPush) {
          // Sort by start_time
          dayEnts.sort((a: any, b: any) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
          );

          // SNAP: For each newly created transport, pull the next unlocked non-transport event forward
          // ONLY if both transport and next event are on the SAME calendar day
          if (data?.created?.length > 0) {
            for (const transport of data.created) {
              // Only process transports that belong to this day
              if (getDayKey(transport.end_time) !== dayKey) continue;

              const transportEnd = new Date(transport.end_time).getTime();
              // Find the next non-transport, non-locked entry after this transport ON THE SAME DAY
              const nextEntry = dayEnts.find((e: any) => {
                const eStart = new Date(e.start_time).getTime();
                return eStart > transportEnd - 1 &&
                  !e.is_locked &&
                  e.linked_type !== 'checkin' && e.linked_type !== 'checkout' &&
                  optMap.get(e.id) !== 'transfer' &&
                  e.id !== transport.id &&
                  getDayKey(e.start_time) === dayKey; // same day guard
              });
              if (nextEntry) {
                const gap = new Date(nextEntry.start_time).getTime() - transportEnd;
                if (gap > 0) {
                  const duration = new Date(nextEntry.end_time).getTime() - new Date(nextEntry.start_time).getTime();
                  const newStart = new Date(transportEnd).toISOString();
                  const newEnd = new Date(transportEnd + duration).toISOString();
                  // Midnight guard: don't snap if it would change the calendar day
                  if (getDayKey(newStart) !== dayKey) continue;
                  nextEntry.start_time = newStart;
                  nextEntry.end_time = newEnd;
                  updates.push({
                    id: nextEntry.id,
                    start_time: nextEntry.start_time,
                    end_time: nextEntry.end_time,
                  });
                }
              }
            }
          }

          // CASCADE PUSH: resolve any remaining overlaps (same-day only)
          for (let i = 0; i < dayEnts.length - 1; i++) {
            const currentEnd = new Date(dayEnts[i].end_time).getTime();
            const nextStart = new Date(dayEnts[i + 1].start_time).getTime();

            if (currentEnd > nextStart && !dayEnts[i + 1].is_locked) {
              const overlapMs = currentEnd - nextStart;
              const nextDuration = new Date(dayEnts[i + 1].end_time).getTime() - new Date(dayEnts[i + 1].start_time).getTime();

              let newStartTime: string;
              let newEndTime: string;

              // Check if next entry is overnight (> 6 hours, likely hotel)
              if (nextDuration > 6 * 3600000) {
                newStartTime = new Date(currentEnd).toISOString();
                newEndTime = dayEnts[i + 1].end_time;
              } else {
                newStartTime = new Date(new Date(dayEnts[i + 1].start_time).getTime() + overlapMs).toISOString();
                newEndTime = new Date(new Date(dayEnts[i + 1].end_time).getTime() + overlapMs).toISOString();
              }

              // Midnight guard: don't push across midnight into a different calendar day
              if (getDayKey(newStartTime) !== dayKey) continue;

              dayEnts[i + 1].start_time = newStartTime;
              dayEnts[i + 1].end_time = newEndTime;

              // Only add to updates if not already there
              if (!updates.find(u => u.id === dayEnts[i + 1].id)) {
                updates.push({
                  id: dayEnts[i + 1].id,
                  start_time: dayEnts[i + 1].start_time,
                  end_time: dayEnts[i + 1].end_time,
                });
              } else {
                const existing = updates.find(u => u.id === dayEnts[i + 1].id)!;
                existing.start_time = dayEnts[i + 1].start_time;
                existing.end_time = dayEnts[i + 1].end_time;
              }
            }
          }
        }

        // Apply updates
        for (const u of updates) {
          await supabase
            .from('entries')
            .update({ start_time: u.start_time, end_time: u.end_time })
            .eq('id', u.id);
        }

        if (updates.length > 0) {
          await fetchData();
        }

        toast({
          title: `Added ${data?.created?.length ?? 0} transport entries`,
          description: updates.length > 0 ? `Adjusted ${updates.length} events to resolve overlaps` : undefined,
        });
      } else {
        toast({ title: `Added ${data?.created?.length ?? 0} transport entries` });
      }
    } catch (err: any) {
      toast({ title: 'Failed to generate transport', description: err.message, variant: 'destructive' });
    } finally {
      setAutoTransportLoading(false);
    }
  };

  // days is already memoized above

  if (!currentUser) return null;

  return (
    <div className="flex h-screen flex-col bg-background" ref={scrollRef}>
      <TimelineHeader
        trip={trip}
        tripId={tripId ?? ''}
        onRefresh={handleGlobalRefresh}
        refreshing={globalRefreshing}
      />
      <TripNavBar
        liveOpen={liveOpen}
        plannerOpen={sidebarOpen}
        isMobile={isMobile}
        mobileView={mobileView}
        onToggleLive={() => {
          if (isMobile) {
            setMobileView(mobileView === 'live' ? 'timeline' : 'live');
            setSidebarOpen(false);
          } else {
            setLiveOpen(!liveOpen);
          }
        }}
        onTogglePlanner={() => {
          if (isMobile) {
            setMobileView('timeline');
            setSidebarOpen(!sidebarOpen);
          } else {
            setSidebarOpen(!sidebarOpen);
          }
        }}
        onTimelineOnly={() => {
          if (isMobile) {
            setMobileView('timeline');
            setSidebarOpen(false);
          } else {
            setLiveOpen(false);
            setSidebarOpen(false);
          }
        }}
      />

      {/* Floating Action Button */}
      <button
        onClick={() => {
          setPrefillStartTime(undefined);
          setPrefillEndTime(undefined);
          setPrefillCategory(undefined);
          setTransportContext(null);
          setSheetMode('create');
          setSheetEntry(null);
          setSheetOption(null);
          setSheetOpen(true);
        }}
        className={cn(
          "fixed bottom-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all duration-200",
          (sidebarOpen || exploreOpen) && !isMobile
            ? (liveOpen ? 'right-[calc(25vw+24px)]' : 'right-[calc(30vw+24px)]')
            : 'right-6'
        )}
        title="Add entry"
      >
        <span className="text-2xl font-light">+</span>
      </button>

      {/* Planner FAB — above + FAB */}
      <button
        ref={plannerFabRef}
        onClick={() => {
          if (!dragActiveEntryId) {
            if (exploreOpen) {
              setExploreOpen(false);
              setExploreCategoryId(null);
              setExploreSearchQuery(null);
            }
            setSidebarOpen(!sidebarOpen);
          }
        }}
        className={cn(
          "fixed bottom-24 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200",
          (sidebarOpen || exploreOpen) && !isMobile
            ? (liveOpen ? 'right-[calc(25vw+24px)]' : 'right-[calc(30vw+24px)]')
            : 'right-6',
          currentDragPhase === 'detached'
            ? plannerFabHighlighted
              ? "bg-primary scale-125 text-primary-foreground"
              : "bg-primary/60 text-primary-foreground scale-100"
            : sidebarOpen
              ? "bg-primary text-primary-foreground"
              : "bg-background border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
        )}
        title="Planner"
      >
        <ClipboardList className="h-5 w-5" />
      </button>

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
          {/* Day pill - position:fixed, pinned below tab bar */}
          {days.length > 0 && (() => {
            const clampedIdx = Math.min(currentDayIndex, days.length - 1);
            const dayDate = days[clampedIdx];
            if (!dayDate) return null;
            const dayStr = format(dayDate, 'yyyy-MM-dd');
            const tzInfo = dayTimezoneMap.get(dayStr);
            let tzAbbrev = '';
            if (tzInfo) {
              const tz = tzInfo.flights.length > 0 ? tzInfo.flights[0].originTz : tzInfo.activeTz;
              try {
                tzAbbrev = new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'short' })
                  .formatToParts(dayDate).find(p => p.type === 'timeZoneName')?.value || '';
              } catch { /* ignore */ }
            }
            return (
              <div
                className="fixed left-1/2 -translate-x-1/2 z-50 pointer-events-none"
                style={{ top: '110px' }}
              >
                <div className="inline-flex items-center gap-1 rounded-full bg-background/95 backdrop-blur-md border border-border/50 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm">
                  <span>{isUndated ? `Day ${currentDayIndex + 1}` : format(dayDate, 'EEE d MMM').toUpperCase()}</span>
                  <span className="text-muted-foreground/60">·</span>
                  <span className="text-muted-foreground">{tzAbbrev}</span>
                  {!isUndated && isToday(dayDate) && (
                    <span className="ml-1 rounded-full bg-primary px-1 py-0 text-[8px] font-semibold text-primary-foreground">TODAY</span>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="flex flex-1 overflow-hidden">
            {/* Desktop Live panel */}
            {!isMobile && (
              <LivePanel
                open={liveOpen}
                onOpenChange={setLiveOpen}
                compact={liveOpen && sidebarOpen}
              />
            )}

            {/* Mobile Live full-screen takeover */}
            {isMobile && mobileView === 'live' && (
              <LivePanel open={true} onOpenChange={() => setMobileView('timeline')} />
            )}

            {/* Timeline main content */}
            {(!isMobile || mobileView === 'timeline') && (
              <main ref={(el) => {
                (mainScrollRef as React.MutableRefObject<HTMLElement | null>).current = el;
                if (el && !scrollContainerReady) setScrollContainerReady(true);
              }} className="flex-1 overflow-y-auto pb-20" style={zoomEnabled ? { touchAction: 'pan-y' } : undefined} onContextMenu={(e) => { if ('ontouchstart' in window) e.preventDefault(); }}>
                <ContinuousTimeline
                  days={days}
                  entries={scheduledEntries}
                  allEntries={entries}
                  weatherData={weatherData}
                  
                  dayTimezoneMap={dayTimezoneMap}
                  dayLocationMap={dayLocationMap}
                  homeTimezone={homeTimezone}
                  formatTime={formatTime}
                  userId={currentUser?.id}
                  userVotes={userVotes}
                  votingLocked={trip.voting_locked}
                  isEditor={isEditor}
                  userLat={userLat}
                  userLng={userLng}
                  onCardTap={handleCardTap}
                  onEntryTimeChange={handleEntryTimeChange}
                  onAddBetween={handleAddBetween}
                  onDragSlot={floatingPlaceForTimeline ? (startIso, endIso) => {
                    handleAddAtTime(floatingPlaceForTimeline, startIso, endIso);
                    setFloatingPlaceForTimeline(null);
                  } : handleDragSlot}
                  onClickSlot={floatingPlaceForTimeline ? (isoTime) => {
                    const endTime = new Date(new Date(isoTime).getTime() + 60 * 60000).toISOString();
                    handleAddAtTime(floatingPlaceForTimeline, isoTime, endTime);
                    setFloatingPlaceForTimeline(null);
                  } : () => {}}
                  onDropFromPanel={handleDropOnTimeline}
                  onDropExploreCard={handleDropExploreCard}
                  onModeSwitchConfirm={handleModeSwitchConfirm}
                  onDeleteTransport={handleDeleteTransport}
                  onToggleLock={handleToggleLock}
                  onVoteChange={fetchData}
                  scrollContainerRef={mainScrollRef}
                  isUndated={isUndated}
                  onCurrentDayChange={setCurrentDayIndex}
                  onTrimDay={handleTrimDay}
                  
                   onSnapRelease={handleSnapRelease}
                   onChainShift={handleChainShift}
                   onGroupDrop={handleGroupDrop}
                    pixelsPerHour={pixelsPerHour}
                  onResetZoom={() => setZoomLevel(1.0)}
                   externalDragGlobalHour={
                     (sidebarDrag?.globalHour ?? exploreDrag?.globalHour) ?? null
                   }
                   externalDragDurationHours={
                     sidebarDrag
                       ? (new Date(sidebarDrag.entry.end_time).getTime() - new Date(sidebarDrag.entry.start_time).getTime()) / 3600000
                       : exploreDrag
                         ? 1
                         : null
                   }
                   binRef={binRef}
                  onDragActiveChange={(active, entryId) => {
                    setDragActiveEntryId(active ? entryId : null);
                    if (!active) {
                      setBinHighlighted(false);
                      setPlannerFabHighlighted(false);
                    }
                  }}
                  onDragCommitOverride={(entryId, clientX, clientY) => {
                    // Only check bin/planner when in detached phase
                    if (currentDragPhase !== 'detached') return false;
                    // Check bin proximity
                    if (binRef.current) {
                      const rect = binRef.current.getBoundingClientRect();
                      const dist = Math.hypot(clientX - (rect.left + rect.width / 2), clientY - (rect.top + rect.height / 2));
                      if (dist < 60) {
                        const entry = entries.find(e => e.id === entryId);
                        if (!entry) return true;
                        if (entry.is_locked) {
                          sonnerToast.error("Can't delete — unlock first");
                          return true;
                        }
                        const cat = entry.options[0]?.category;
                        if (cat === 'flight' || cat === 'airport_processing') {
                          sonnerToast.error("Can't delete flights by dragging");
                          return true;
                        }
                        supabase.from('entries').delete().eq('id', entryId).then(() => {
                          fetchData();
                          sonnerToast.success(entry.options[0]?.name ? `Deleted ${entry.options[0].name}` : 'Entry deleted');
                        });
                        return true;
                      }
                    }
                    // Check planner FAB proximity
                    if (plannerFabRef.current) {
                      const rect = plannerFabRef.current.getBoundingClientRect();
                      const dist = Math.hypot(clientX - (rect.left + rect.width / 2), clientY - (rect.top + rect.height / 2));
                      if (dist < 60) {
                        const entry = entries.find(e => e.id === entryId);
                        if (!entry) return true;
                        if (entry.is_locked) {
                          sonnerToast.error("Can't move — unlock first");
                          return true;
                        }
                        const cat = entry.options[0]?.category;
                        if (cat === 'flight' || cat === 'airport_processing') {
                          sonnerToast.error("Can't move flights to Planner");
                          return true;
                        }
                        supabase.from('entries')
                          .update({ is_scheduled: false, scheduled_day: null })
                          .eq('id', entryId)
                          .then(() => {
                            fetchData();
                            sonnerToast.success(entry.options[0]?.name ? `Moved ${entry.options[0].name} to Planner` : 'Moved to Planner');
                          });
                        return true;
                      }
                    }
                    return false;
                  }}
                  onDragPositionUpdate={(clientX, clientY) => {
                    if (currentDragPhase !== 'detached') return;
                    if (binRef.current) {
                      const rect = binRef.current.getBoundingClientRect();
                      const dist = Math.hypot(clientX - (rect.left + rect.width / 2), clientY - (rect.top + rect.height / 2));
                      setBinHighlighted(dist < 60);
                    }
                    if (plannerFabRef.current) {
                      const rect = plannerFabRef.current.getBoundingClientRect();
                      const dist = Math.hypot(clientX - (rect.left + rect.width / 2), clientY - (rect.top + rect.height / 2));
                      setPlannerFabHighlighted(dist < 60);
                    }
                  }}
                  onDragEnd={() => {
                    setDragActiveEntryId(null);
                    setBinHighlighted(false);
                    setPlannerFabHighlighted(false);
                    setCurrentDragPhase(null);
                  }}
                  onDragPhaseChange={setCurrentDragPhase}
                />
              </main>
            )}

            {/* Desktop Planner panel */}
            {!isMobile && (
              <CategorySidebar
                open={sidebarOpen || exploreOpen}
                onOpenChange={(open) => {
                  if (!open && exploreOpen) {
                    setExploreOpen(false);
                    setExploreCategoryId(null);
                  }
                  setSidebarOpen(open);
                }}
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
                onSidebarDragStart={handleSidebarDragStartUnified}
                onSidebarDragMove={handleSidebarDragMoveUnified}
                onSidebarDragEnd={handleSidebarDragEndUnified}
                compact={liveOpen && sidebarOpen}
                exploreOpen={exploreOpen}
                exploreContent={trip ? (
                  <ExploreView
                    open={exploreOpen}
                    onClose={() => { setExploreOpen(false); setExploreCategoryId(null); setExploreSearchQuery(null); }}
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
                    createContext={prefillStartTime ? { startTime: prefillStartTime, endTime: prefillEndTime } : null}
                    onAddAtTime={handleAddAtTime}
                    initialSearchQuery={exploreSearchQuery}
                    onAddToTimeline={handleAddToTimeline}
                    onExploreDragStart={handleExploreDragStartUnified}
                    onExploreDragMove={handleExploreDragMoveUnified}
                    onExploreDragEnd={handleExploreDragEndUnified}
                    embedded
                  />
                ) : undefined}
              />
            )}
          </div>

          {/* Mobile Planner overlay */}
          {isMobile && (
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
              onSidebarDragStart={handleSidebarDragStartUnified}
              onSidebarDragMove={handleSidebarDragMoveUnified}
              onSidebarDragEnd={handleSidebarDragEndUnified}
              hiddenForDrag={sidebarDragHidePlanner}
            />
          )}
          <EntrySheet
            mode={sheetMode ?? 'create'}
            open={sheetOpen}
            onOpenChange={(open) => {
              setSheetOpen(open);
              if (!open) {
                setTimeout(() => {
                  setSheetMode(null);
                  setSheetEntry(null);
                  setSheetOption(null);
                  setPrefillStartTime(undefined);
                  setPrefillEndTime(undefined);
                  setPrefillCategory(undefined);
                  setTransportContext(null);
                  setGapContext(null);
                  setSheetResolvedTz(undefined);
                }, 300);
              }
            }}
            tripId={trip.id}
            onSaved={async () => {
              const freshEntries = await fetchData();

              // Refresh sheetEntry with latest data so lock state updates immediately
              if (sheetEntry && freshEntries) {
                const fresh = freshEntries.find(e => e.id === sheetEntry.id);
                if (fresh) {
                  setSheetEntry(fresh);
                  if (sheetOption && fresh.options) {
                    const freshOpt = fresh.options.find(o => o.id === sheetOption.id);
                    if (freshOpt) setSheetOption(freshOpt);
                  }
                } else {
                  // Entry was deleted — close the sheet cleanly
                  setSheetOpen(false);
                  setSheetEntry(null);
                  setSheetOption(null);
                  setSheetMode(null);
                }
              }

              // Auto-extend: check latest entry times after save
              if (trip && tripId) {
                const { data: latest } = await supabase
                  .from('entries')
                  .select('end_time')
                  .eq('trip_id', tripId)
                  .order('end_time', { ascending: false })
                  .limit(1)
                  .single();
                if (latest) await autoExtendTripIfNeeded(tripId, latest.end_time, trip, fetchData);
              }
            }}
            trip={trip}
            resolvedTz={sheetResolvedTz}
            entry={sheetEntry}
            option={sheetOption}
            formatTime={formatTime}
            userLat={userLat}
            userLng={userLng}
            votingLocked={trip.voting_locked}
            userVotes={userVotes}
            onVoteChange={fetchData}
            onMoveToIdeas={handleSendToPlanner}
            // Create mode props
            prefillStartTime={prefillStartTime}
            prefillEndTime={prefillEndTime}
            prefillCategory={prefillCategory}
            transportContext={transportContext}
            gapContext={gapContext}
            onHotelSelected={() => {
              setSheetOpen(false);
              setHotelWizardOpen(true);
            }}
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
            onExploreRequest={(catId, searchQuery) => {
              setSheetOpen(false);
              setExploreCategoryId(catId);
              setExploreSearchQuery(searchQuery ?? null);
              setExploreOpen(true);
            }}
          />

          {/* On mobile, ExploreView renders as full-screen overlay */}
          {trip && isMobile && (
            <ExploreView
              open={exploreOpen}
              onClose={() => { setExploreOpen(false); setExploreCategoryId(null); setExploreSearchQuery(null); }}
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
              createContext={prefillStartTime ? { startTime: prefillStartTime, endTime: prefillEndTime } : null}
              onAddAtTime={handleAddAtTime}
              initialSearchQuery={exploreSearchQuery}
              onAddToTimeline={handleAddToTimeline}
              onExploreDragStart={handleExploreDragStartUnified}
              onExploreDragMove={handleExploreDragMoveUnified}
              onExploreDragEnd={handleExploreDragEndUnified}
            />
          )}

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
            onCreated={async () => {
              await fetchData();
              // Auto-extend: check if hotel checkout goes past trip end
              if (trip && tripId) {
                const { data: latest } = await supabase
                  .from('entries')
                  .select('end_time')
                  .eq('trip_id', tripId)
                  .order('end_time', { ascending: false })
                  .limit(1)
                  .single();
                if (latest) await autoExtendTripIfNeeded(tripId, latest.end_time, trip, fetchData);
              }
            }}
            dayTimezoneMap={dayTimezoneMap}
          />
        </>
      )}

      {/* Unified sidebar drag floating card (planner → timeline) */}
      {sidebarDrag && (() => {
        const opt = sidebarDrag.entry.options[0];
        if (!opt) return null;
        const durationMs = new Date(sidebarDrag.entry.end_time).getTime() - new Date(sidebarDrag.entry.start_time).getTime();
        const durationHours = durationMs / 3600000;
        const moveHeight = durationHours * pixelsPerHour;
        const cardWidth = Math.min(window.innerWidth * 0.6, 300);
        return (
          <div className="fixed inset-0 z-[200] pointer-events-none">
            <div
              style={{
                position: 'fixed',
                left: sidebarDrag.clientX - cardWidth / 2,
                top: sidebarDrag.clientY - 40,
                width: cardWidth,
                height: Math.max(moveHeight, 60),
                willChange: 'transform',
              }}
            >
              <div className="h-full ring-2 ring-primary/60 shadow-lg shadow-primary/20 rounded-2xl overflow-hidden">
                <EntryCard
                  option={opt}
                  startTime={sidebarDrag.entry.start_time}
                  endTime={sidebarDrag.entry.end_time}
                  formatTime={(iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  isPast={false}
                  optionIndex={0}
                  totalOptions={1}
                  votingLocked={trip.voting_locked}
                  hasVoted={false}
                  onVoteChange={() => {}}
                  cardSizeClass="h-full"
                  height={Math.max(moveHeight, 60)}
                  notes={sidebarDrag.entry.notes}
                  isLocked={sidebarDrag.entry.is_locked}
                />
              </div>
              {sidebarDrag.globalHour !== null && sidebarDrag.globalHour >= 0 && (
                <div className="mt-1 flex justify-center">
                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground shadow-md">
                    {String(Math.floor((sidebarDrag.globalHour % 24))).padStart(2, '0')}:
                    {String(Math.round(((sidebarDrag.globalHour % 1) * 60))).padStart(2, '0')}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Unified explore drag floating card (explore → timeline) */}
      {exploreDrag && (
        <div className="fixed inset-0 z-[100] pointer-events-none">
          <div
            className="pointer-events-none absolute z-[101]"
            style={{
              left: exploreDrag.clientX - 100,
              top: exploreDrag.clientY - 40,
              width: 200,
              opacity: 0.9,
              filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.2))',
            }}
          >
            <div className="rounded-xl bg-background border border-border shadow-xl p-2.5">
              <p className="text-sm font-bold truncate text-foreground">{exploreDrag.place.name}</p>
              {exploreDrag.place.address && (
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">📍 {exploreDrag.place.address}</p>
              )}
              {exploreDrag.place.rating != null && (
                <p className="text-[11px] font-bold text-amber-500 mt-0.5">⭐ {exploreDrag.place.rating.toFixed(1)}</p>
              )}
            </div>
            {exploreDrag.globalHour !== null && exploreDrag.globalHour >= 0 && (
              <div className="mt-1 flex justify-center">
                <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground shadow-md">
                  {String(Math.floor((exploreDrag.globalHour % 24))).padStart(2, '0')}:
                  {String(Math.round(((exploreDrag.globalHour % 1) * 60))).padStart(2, '0')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}


      {floatingPlaceForTimeline && (
        <div className="fixed inset-x-0 z-50 flex items-center justify-center pointer-events-none" style={{ top: 110 }}>
          <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-primary px-5 py-2.5 shadow-lg">
            <span className="text-sm font-medium text-primary-foreground">
              Tap a time slot to place <span className="font-bold">{floatingPlaceForTimeline.name}</span>
            </span>
            <button
              className="rounded-full bg-primary-foreground/20 px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary-foreground/30 transition-colors"
              onClick={() => setFloatingPlaceForTimeline(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Zoom level indicator */}
      {zoomEnabled && showZoomIndicator && zoomLevel !== 1.0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-full bg-foreground/80 px-3 py-1 shadow-lg transition-opacity duration-300">
          <span className="text-xs font-bold text-background">
            {Math.round(zoomLevel * 100)}%
          </span>
        </div>
      )}

      {/* Drag-to-delete bin */}
      <div
        ref={binRef}
        className={cn(
          "fixed bottom-6 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200",
          (dragActiveEntryId && currentDragPhase === 'detached') || sidebarDragActive
            ? binHighlighted
              ? "bg-red-500 scale-125"
              : "bg-red-400/80 scale-100"
            : isMobile
              ? "scale-0 opacity-0 pointer-events-none"
              : "bg-muted/60 scale-100 opacity-40 hover:opacity-70"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setBinHighlighted(true);
        }}
        onDragLeave={() => setBinHighlighted(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setBinHighlighted(false);
          setSidebarDragActive(false);
          const entryId = e.dataTransfer.getData('text/plain');
          if (!entryId) return;
          const entry = entries.find(en => en.id === entryId);
          if (!entry) return;
          if (entry.is_locked) {
            sonnerToast.error("Can't delete — unlock first");
            return;
          }
          const cat = entry.options[0]?.category;
          if (cat === 'flight' || cat === 'airport_processing') {
            sonnerToast.error("Can't delete flights by dragging");
            return;
          }
          await supabase.from('entries').delete().eq('id', entryId);
          sonnerToast.success(entry.options[0]?.name ? `Deleted ${entry.options[0].name}` : 'Entry deleted');
          fetchData();
        }}
      >
        <Trash2 className="h-5 w-5 text-white" />
      </div>

      {/* Undo/Redo floating buttons */}
      <UndoRedoButtons canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} sidebarOpen={sidebarOpen || exploreOpen} isMobile={isMobile} compact={liveOpen && (sidebarOpen || exploreOpen)} />
    </div>
  );
};

export default Timeline;

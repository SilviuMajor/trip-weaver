import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { addDays, parseISO, startOfDay, format, isPast, isToday } from 'date-fns';
import { getDateInTimezone, localToUTC, resolveDropTz } from '@/lib/timezoneUtils';
import { findCategory } from '@/lib/categories';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useGeolocation } from '@/hooks/useGeolocation';

import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useTravelCalculation } from '@/hooks/useTravelCalculation';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { analyzeConflict, generateRecommendations } from '@/lib/conflictEngine';
import { toast } from '@/hooks/use-toast';
import TimelineHeader from '@/components/timeline/TimelineHeader';
import TripNavBar from '@/components/timeline/TripNavBar';
import ContinuousTimeline from '@/components/timeline/ContinuousTimeline';
import EntrySheet from '@/components/timeline/EntrySheet';
import CategorySidebar from '@/components/timeline/CategorySidebar';
import LivePanel from '@/components/timeline/LivePanel';
import ConflictResolver from '@/components/timeline/ConflictResolver';
import DayPickerDialog from '@/components/timeline/DayPickerDialog';
import HotelWizard from '@/components/timeline/HotelWizard';
import UndoRedoButtons from '@/components/timeline/UndoRedoButtons';
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

  // Undo/Redo (fetchData ref will be set after declaration)
  const fetchDataRef = useRef<() => Promise<void>>();
  const { canUndo, canRedo, undo, redo, pushAction } = useUndoRedo(async () => { await fetchDataRef.current?.(); });

  const scrollRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLElement>(null);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);



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
  }, [currentUser, tripId]);

  fetchDataRef.current = fetchData;

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
    const map = new Map<string, { activeTz: string; flights: Array<{ originTz: string; destinationTz: string; flightStartHour: number; flightEndHour: number; flightEndUtc: string }> }>();
    if (!trip) return map;

    const days = getDays();

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
  }, [trip, scheduledEntries, homeTimezone]);

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
  }, [trip, scheduledEntries, homeTimezone]);

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

  const handleAddTransport = (fromEntryId: string, toEntryId: string, prefillTime: string, resolvedTz?: string) => {
    const fromEntry = entries.find(e => e.id === fromEntryId);
    const toEntry = entries.find(e => e.id === toEntryId);
    const fromOpt = fromEntry?.options[0];
    const toOpt = toEntry?.options[0];

    // Use location_name for regular entries, arrival_location for flights (where you end up)
    const fromAddr = fromOpt?.location_name || fromOpt?.arrival_location || '';
    const toAddr = toOpt?.location_name || toOpt?.departure_location || '';

    // Fix 1: Use actual end time of departing event (accounting for flight checkout)
    const fromCheckout = entries.find(e => e.linked_flight_id === fromEntryId && e.linked_type === 'checkout');
    const actualEndTime = fromCheckout?.end_time ?? fromEntry?.end_time ?? prefillTime;

    // Calculate gap in minutes
    let gapMinutes: number | undefined;
    if (fromEntry && toEntry) {
      const gapMs = new Date(toEntry.start_time).getTime() - new Date(actualEndTime).getTime();
      gapMinutes = Math.round(gapMs / 60000);
    }

    setTransportContext({ fromAddress: fromAddr, toAddress: toAddr, gapMinutes, fromEntryId, toEntryId, resolvedTz });
    setPrefillStartTime(actualEndTime);
    setPrefillEndTime(undefined);
    setPrefillCategory('transfer');
    setSheetMode('create');
    setSheetEntry(null);
    setSheetOption(null);
    setSheetOpen(true);
  };

  // Direct transport generation (for ≤2hr gap buttons — bypasses modal)
  const handleGenerateTransportDirect = async (fromEntryId: string, toEntryId: string, prefillTime: string, resolvedTz?: string) => {
    const fromEntry = entries.find(e => e.id === fromEntryId);
    const toEntry = entries.find(e => e.id === toEntryId);
    if (!fromEntry || !toEntry || !tripId) return;

    const fromOpt = fromEntry.options[0];
    const toOpt = toEntry.options[0];
    const fromAddr = fromOpt?.location_name || fromOpt?.arrival_location || '';
    const toAddr = toOpt?.location_name || toOpt?.departure_location || '';

    if (!fromAddr || !toAddr) {
      handleAddTransport(fromEntryId, toEntryId, prefillTime, resolvedTz);
      return;
    }

    try {
      toast({ title: 'Generating transport…' });

      const fromCheckout = entries.find(e => e.linked_flight_id === fromEntryId && e.linked_type === 'checkout');
      const departureTime = fromCheckout?.end_time ?? fromEntry.end_time;

      const { data, error } = await supabase.functions.invoke('google-directions', {
        body: {
          fromAddress: fromAddr,
          toAddress: toAddr,
          modes: ['walk', 'transit', 'drive', 'bicycle'],
          departureTime,
        },
      });

      if (error || !data?.results?.length) {
        toast({ title: 'Could not calculate route', variant: 'destructive' });
        return;
      }

      const walkThreshold = trip?.walk_threshold_min ?? 10;
      const walkResult = data.results.find((r: any) => r.mode === 'walk');
      const transitResult = data.results.find((r: any) => r.mode === 'transit');

      let chosen = transitResult || data.results[0];
      if (walkResult && walkResult.duration_min <= walkThreshold) {
        chosen = walkResult;
      }

      const blockDur = Math.ceil(chosen.duration_min / 5) * 5;
      const startTime = departureTime;
      const endTime = new Date(new Date(startTime).getTime() + blockDur * 60000).toISOString();

      const modeLabels: Record<string, string> = { walk: 'Walk', transit: 'Transit', drive: 'Drive', bicycle: 'Cycle' };
      const toShort = toAddr.split(',')[0].trim();
      const name = `${modeLabels[chosen.mode] || chosen.mode} to ${toShort}`;

      const { data: newEntry, error: entryErr } = await supabase.from('entries').insert({
        trip_id: tripId,
        start_time: startTime,
        end_time: endTime,
        from_entry_id: fromEntryId,
        to_entry_id: toEntryId,
        is_scheduled: true,
      } as any).select('id').single();

      if (entryErr || !newEntry) throw entryErr;

      await supabase.from('entry_options').insert({
        entry_id: newEntry.id,
        name,
        category: 'transfer',
        category_color: '#6B7280',
        departure_location: fromAddr,
        arrival_location: toAddr,
        distance_km: chosen.distance_km,
        route_polyline: chosen.polyline,
        transport_modes: data.results,
      } as any);

      // Auto-snap destination event to meet transport end
      let destOrigStart: string | null = null;
      let destOrigEnd: string | null = null;
      const destEntry = entries.find(e => e.id === toEntryId);
      if (destEntry && !destEntry.is_locked) {
        destOrigStart = destEntry.start_time;
        destOrigEnd = destEntry.end_time;
        const destDuration = new Date(destEntry.end_time).getTime() - new Date(destEntry.start_time).getTime();
        const newDestStart = endTime;
        const newDestEnd = new Date(new Date(endTime).getTime() + destDuration).toISOString();
        await supabase.from('entries').update({
          start_time: newDestStart,
          end_time: newDestEnd,
        }).eq('id', toEntryId);
      }

      pushAction({
        description: `Add ${name}`,
        undo: async () => {
          // Restore destination event times if snapped
          if (destOrigStart && destOrigEnd) {
            await supabase.from('entries').update({
              start_time: destOrigStart,
              end_time: destOrigEnd,
            }).eq('id', toEntryId);
          }
          await supabase.from('entry_options').delete().eq('entry_id', newEntry.id);
          await supabase.from('entries').delete().eq('id', newEntry.id);
          await fetchData();
        },
        redo: async () => {
          await fetchData();
        },
      });

      toast({ title: `Added ${name}` });
      await fetchData();
    } catch (err: any) {
      toast({ title: 'Failed to generate transport', description: err?.message, variant: 'destructive' });
    }
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

          // Tier 1 auto-snap: if gap to destination < 30 min and not locked, snap it
          if (transport.to_entry_id) {
            const { data: destEntry } = await supabase
              .from('entries')
              .select('id, start_time, end_time, is_locked')
              .eq('id', transport.to_entry_id)
              .single();

            if (destEntry && !destEntry.is_locked) {
              const transportNewEndMs = new Date(newTransportEnd).getTime();
              const destStartMs = new Date(destEntry.start_time).getTime();
              const gapMs = destStartMs - transportNewEndMs;
              const gapMin = gapMs / 60000;

              if (gapMin > 0 && gapMin < 30) {
                const origDestStart = destEntry.start_time;
                const origDestEnd = destEntry.end_time;
                const destDuration = new Date(destEntry.end_time).getTime() - destStartMs;
                const snappedStart = newTransportEnd;
                const snappedEnd = new Date(transportNewEndMs + destDuration).toISOString();

                await supabase.from('entries').update({
                  start_time: snappedStart,
                  end_time: snappedEnd,
                }).eq('id', destEntry.id);

                // Get dest name for toast
                const { data: destOpt } = await supabase
                  .from('entry_options')
                  .select('name')
                  .eq('entry_id', destEntry.id)
                  .limit(1)
                  .single();
                const destName = destOpt?.name || 'event';

                pushAction({
                  description: `Snap ${destName}`,
                  undo: async () => {
                    await supabase.from('entries').update({ start_time: origDestStart, end_time: origDestEnd }).eq('id', destEntry.id);
                  },
                  redo: async () => {
                    await supabase.from('entries').update({ start_time: snappedStart, end_time: snappedEnd }).eq('id', destEntry.id);
                  },
                });

                toast({ title: `Snapped ${destName}` });
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to reposition transport:', err);
    }

    await fetchData();
  };

  // Handle mode switch confirm from TransportConnector
  const handleModeSwitchConfirm = async (entryId: string, mode: string, newDurationMin: number, distanceKm: number, polyline?: string | null) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    const blockDur = Math.ceil(newDurationMin / 5) * 5;
    const newEndIso = new Date(new Date(entry.start_time).getTime() + blockDur * 60000).toISOString();

    // Update entry times
    await supabase.from('entries').update({ end_time: newEndIso }).eq('id', entryId);

    // Update option name, distance, polyline
    const opt = entry.options[0];
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

  const days = getDays();


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
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        title="Add entry"
      >
        <span className="text-2xl font-light">+</span>
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
            const dayDate = days[currentDayIndex];
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
              <main ref={mainScrollRef} className="flex-1 overflow-y-auto pb-20">
                <ContinuousTimeline
                  days={days}
                  entries={scheduledEntries}
                  allEntries={entries}
                  weatherData={weatherData}
                  travelSegments={travelSegments}
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
                  onAddTransport={handleAddTransport}
                  onGenerateTransport={handleGenerateTransportDirect}
                  onDragSlot={handleDragSlot}
                  onClickSlot={() => {}}
                  onDropFromPanel={handleDropOnTimeline}
                  onModeSwitchConfirm={handleModeSwitchConfirm}
                  onDeleteTransport={handleDeleteTransport}
                  onToggleLock={handleToggleLock}
                  onVoteChange={fetchData}
                  scrollContainerRef={mainScrollRef}
                  isUndated={isUndated}
                  onCurrentDayChange={setCurrentDayIndex}
                />
              </main>
            )}

            {/* Desktop Planner panel */}
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
                compact={liveOpen && sidebarOpen}
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
            />
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
                setGapContext(null);
                setSheetResolvedTz(undefined);
              }
            }}
            tripId={trip.id}
            onSaved={fetchData}
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
            dayTimezoneMap={dayTimezoneMap}
          />
        </>
      )}

      {/* Undo/Redo floating buttons */}
      <UndoRedoButtons canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} />
    </div>
  );
};

export default Timeline;

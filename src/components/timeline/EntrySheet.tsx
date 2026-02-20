import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { addDays, format, parseISO } from 'date-fns';
import { utcToLocal, localToUTC } from '@/lib/timezoneUtils';
import { PREDEFINED_CATEGORIES, PICKER_CATEGORIES, TRAVEL_MODES, type CategoryDef } from '@/lib/categories';
import type { Trip, EntryWithOptions, EntryOption, CategoryPreset } from '@/types/trip';
import { useTripMember } from '@/hooks/useTripMember';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import AirportPicker from './AirportPicker';
import type { Airport } from '@/lib/airports';
import AIRPORTS from '@/lib/airports';
import { Loader2, Upload, Check, Clock, AlertTriangle, Search } from 'lucide-react';
import PlacesAutocomplete, { type PlaceDetails } from './PlacesAutocomplete';
import PhotoStripPicker from './PhotoStripPicker';
import RouteMapPreview from './RouteMapPreview';
import { cn } from '@/lib/utils';
import { getTzAbbr } from '@/lib/entryHelpers';
import PlaceOverview from './PlaceOverview';

const REFERENCE_DATE = '2099-01-01';

// ─── Types ───

interface ReturnFlightData {
  departureLocation: string;
  arrivalLocation: string;
  departureTz: string;
  arrivalTz: string;
  departureTerminal: string;
  arrivalTerminal: string;
  departureLat: number | null;
  departureLng: number | null;
  arrivalLat: number | null;
  arrivalLng: number | null;
}

interface TransportResult {
  mode: string;
  duration_min: number;
  distance_km: number;
  polyline?: string | null;
}

interface EntrySheetProps {
  mode: 'create' | 'view';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  trip?: Trip | null;
  onSaved: () => void;

  // Resolved timezone for the entry's day (from dayTimezoneMap / resolveEntryTz)
  resolvedTz?: string;

  // View mode
  entry?: EntryWithOptions | null;
  option?: EntryOption | null;
  formatTime?: (iso: string, tz?: string) => string;
  userLat?: number | null;
  userLng?: number | null;
  votingLocked?: boolean;
  userVotes?: string[];
  onVoteChange?: () => void;
  onMoveToIdeas?: (entryId: string) => void;

  // Create mode
  editEntry?: EntryWithOptions | null;
  editOption?: EntryOption | null;
  prefillStartTime?: string;
  prefillEndTime?: string;
  prefillCategory?: string;
  transportContext?: { fromAddress: string; toAddress: string; gapMinutes?: number; fromEntryId?: string; toEntryId?: string; resolvedTz?: string } | null;
  gapContext?: { fromName: string; toName: string; fromAddress: string; toAddress: string } | null;
  onTransportConflict?: (blockDuration: number, gapMinutes: number) => void;
  onHotelSelected?: () => void;
  onExploreRequest?: (categoryId: string | null, searchQuery?: string) => void;
}

type Step = 'category' | 'details';

const EntrySheet = ({
  mode, open, onOpenChange, tripId, trip, onSaved,
  resolvedTz: resolvedTzProp,
  entry, option, formatTime: formatTimeProp, userLat, userLng,
  votingLocked, userVotes = [], onVoteChange, onMoveToIdeas,
  editEntry, editOption, prefillStartTime, prefillEndTime, prefillCategory, transportContext,
  gapContext,
  onTransportConflict,
  onHotelSelected,
  onExploreRequest,
}: EntrySheetProps) => {
  const { member: currentUser, isEditor } = useTripMember(tripId);
  const { session } = useAdminAuth();
  const isMobile = useIsMobile();

  // ─── Create mode state ───
  const [step, setStep] = useState<Step>('category');
  const [saving, setSaving] = useState(false);
  const [transportResults, setTransportResults] = useState<TransportResult[]>([]);
  const [transportLoading, setTransportLoading] = useState(false);
  const [selectedPolyline, setSelectedPolyline] = useState<string | null>(null);
  const transportFetchedRef = useRef(false);
  const [flightParseLoading, setFlightParseLoading] = useState(false);
  const [parsedFlights, setParsedFlights] = useState<any[]>([]);
  const flightFileRef = useRef<HTMLInputElement>(null);

  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [autoPhotos, setAutoPhotos] = useState<string[]>([]);
  const [placePhone, setPlacePhone] = useState<string | null>(null);
  const [placeAddress, setPlaceAddress] = useState<string | null>(null);
  const [placeRating, setPlaceRating] = useState<number | null>(null);
  const [placeUserRatingCount, setPlaceUserRatingCount] = useState<number | null>(null);
  const [placeOpeningHours, setPlaceOpeningHours] = useState<string[] | null>(null);
  const [placeGoogleMapsUri, setPlaceGoogleMapsUri] = useState<string | null>(null);
  const [placeGooglePlaceId, setPlaceGooglePlaceId] = useState<string | null>(null);
  const [placePriceLevel, setPlacePriceLevel] = useState<string | null>(null);

  const [departureLocation, setDepartureLocation] = useState('');
  const [arrivalLocation, setArrivalLocation] = useState('');
  const [departureTz, setDepartureTz] = useState('Europe/London');
  const [arrivalTz, setArrivalTz] = useState('Europe/Amsterdam');
  const [departureTerminal, setDepartureTerminal] = useState('');
  const [arrivalTerminal, setArrivalTerminal] = useState('');
  const [departureLat, setDepartureLat] = useState<number | null>(null);
  const [departureLng, setDepartureLng] = useState<number | null>(null);
  const [arrivalLat, setArrivalLat] = useState<number | null>(null);
  const [arrivalLng, setArrivalLng] = useState<number | null>(null);
  const [checkinHours, setCheckinHours] = useState(2);
  const [checkoutMin, setCheckoutMin] = useState(30);

  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferMode, setTransferMode] = useState('transit');
  const [calcLoading, setCalcLoading] = useState(false);

  const [date, setDate] = useState('');
  const [selectedDay, setSelectedDay] = useState('0');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [durationMin, setDurationMin] = useState(60);

  const [returnFlightData, setReturnFlightData] = useState<ReturnFlightData | null>(null);
  const [showReturnPrompt, setShowReturnPrompt] = useState(false);
  const [isReturnFlight, setIsReturnFlight] = useState(false);

  const isUndated = !trip?.start_date;
  const dayCount = trip?.duration_days ?? 3;
  const isEditing = !!editEntry;
  const isFlight = categoryId === 'flight';
  const isTransfer = categoryId === 'transfer';
  const homeTimezone = trip?.home_timezone ?? 'Europe/London';
  const defaultCheckinHours = trip?.default_checkin_hours ?? 2;
  const defaultCheckoutMin = trip?.default_checkout_min ?? 30;
  const selectedCategory = PREDEFINED_CATEGORIES.find(c => c.id === categoryId);

  const customCategories = (trip?.category_presets as CategoryPreset[] | null) ?? [];
  const allCategories: CategoryDef[] = [
    ...PICKER_CATEGORIES,
    ...customCategories.map((c, i) => ({
      id: `custom_${i}`,
      name: c.name,
      emoji: c.emoji || '📌',
      color: c.color,
      defaultDurationMin: 60,
      defaultStartHour: 10,
      defaultStartMin: 0,
    })),
  ];

  // ─── Create mode logic (all preserved from EntryForm) ───

  useEffect(() => {
    if (mode !== 'create') return;
    if (editEntry && open) {
      const editTz = resolvedTzProp || homeTimezone;
      const { date: sDate, time: sTime } = utcToLocal(editEntry.start_time, editTz);
      const { time: eTime } = utcToLocal(editEntry.end_time, editTz);
      setDate(sDate);
      setStartTime(sTime);
      setEndTime(eTime);

      if (isUndated) {
        const refDate = parseISO(REFERENCE_DATE);
        const startDt = parseISO(editEntry.start_time);
        const diff = Math.round((startDt.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
        setSelectedDay(String(Math.max(0, diff)));
      }

      if (editOption) {
        setCategoryId(editOption.category ?? '');
        setName(editOption.name);
        setWebsite(editOption.website ?? '');
        setLocationName(editOption.location_name ?? '');
        setDepartureLocation(editOption.departure_location ?? '');
        setArrivalLocation(editOption.arrival_location ?? '');
        setDepartureTz(editOption.departure_tz ?? 'Europe/London');
        setArrivalTz(editOption.arrival_tz ?? 'Europe/Amsterdam');
        setDepartureTerminal(editOption.departure_terminal ?? '');
        setArrivalTerminal(editOption.arrival_terminal ?? '');
        if (editOption.category === 'transfer') {
          setTransferFrom(editOption.departure_location ?? '');
          setTransferTo(editOption.arrival_location ?? '');
        }
        setPlacePhone((editOption as any).phone ?? null);
        setPlaceAddress((editOption as any).address ?? null);
        setPlaceRating((editOption as any).rating ?? null);
        setPlaceUserRatingCount((editOption as any).user_rating_count ?? null);
        setPlaceOpeningHours((editOption as any).opening_hours ?? null);
        setPlaceGoogleMapsUri((editOption as any).google_maps_uri ?? null);
        setPlaceGooglePlaceId((editOption as any).google_place_id ?? null);
        setPlacePriceLevel((editOption as any).price_level ?? null);
        setStep('details');
      }
    }
  }, [editEntry, editOption, open, isUndated, mode]);

  useEffect(() => {
    if (mode !== 'create') return;
    if (prefillStartTime && open && !editEntry) {
      const effectiveTz = transportContext?.resolvedTz || homeTimezone;
      const { date: d, time: t } = utcToLocal(prefillStartTime, effectiveTz);
      setStartTime(t);
      if (!isUndated) setDate(d);
    }
  }, [prefillStartTime, open, editEntry, isUndated, homeTimezone, mode, transportContext]);

  useEffect(() => {
    if (mode !== 'create') return;
    if (prefillEndTime && open && !editEntry) {
      const { time: eT } = utcToLocal(prefillEndTime, homeTimezone);
      setEndTime(eT);
      if (prefillStartTime) {
        const startDt = new Date(prefillStartTime);
        const endDt = new Date(prefillEndTime);
        const diffMin = Math.round((endDt.getTime() - startDt.getTime()) / 60000);
        if (diffMin > 0) setDurationMin(diffMin);
      }
    }
  }, [prefillEndTime, prefillStartTime, open, editEntry, homeTimezone, mode]);

  const applySmartDefaults = useCallback((cat: CategoryDef) => {
    const h = cat.defaultStartHour;
    const m = cat.defaultStartMin;
    if (prefillStartTime && !isEditing) {
      const effectiveTz = transportContext?.resolvedTz || homeTimezone;
      const { time: pTime } = utcToLocal(prefillStartTime, effectiveTz);
      const [pH, pM] = pTime.split(':').map(Number);
      setStartTime(`${String(pH).padStart(2, '0')}:${String(pM).padStart(2, '0')}`);
      setDurationMin(cat.defaultDurationMin);
      const endTotalMin = pH * 60 + pM + cat.defaultDurationMin;
      const endH = Math.floor(endTotalMin / 60) % 24;
      const endM = endTotalMin % 60;
      setEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
    } else {
      setStartTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      setDurationMin(cat.defaultDurationMin);
      const endTotalMin = h * 60 + m + cat.defaultDurationMin;
      const endH = Math.floor(endTotalMin / 60) % 24;
      const endM = endTotalMin % 60;
      setEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
    }
  }, [prefillStartTime, isEditing, homeTimezone, transportContext]);

  useEffect(() => {
    if (mode !== 'create') return;
    if (prefillCategory && open && !editEntry) {
      const specialCats = ['flight', 'hotel', 'transfer', 'private_transfer'];
      if (!specialCats.includes(prefillCategory) && onExploreRequest) {
        onExploreRequest(prefillCategory);
        onOpenChange(false);
        return;
      }
      const cat = allCategories.find(c => c.id === prefillCategory);
      if (cat) {
        setCategoryId(prefillCategory);
        applySmartDefaults(cat);
        setStep('details');
      }
    }
  }, [prefillCategory, open, editEntry, applySmartDefaults, mode]);

  const handlePlaceSelect = (details: PlaceDetails) => {
    setName(details.name);
    if (details.website) setWebsite(details.website);
    if (details.address) setLocationName(details.address);
    setLatitude(details.lat);
    setLongitude(details.lng);
    if (details.photos.length > 0) setAutoPhotos(details.photos);
    setPlacePhone(details.phone);
    setPlaceAddress(details.address || null);
    setPlaceRating(details.rating);
    setPlaceUserRatingCount(details.userRatingCount);
    setPlaceOpeningHours(details.openingHours);
    setPlaceGoogleMapsUri(details.googleMapsUri);
    setPlaceGooglePlaceId(details.placeId);
    setPlacePriceLevel(details.priceLevel);
  };

  const reset = () => {
    setStep('category');
    setCategoryId('');
    setName('');
    setWebsite('');
    setLocationName('');
    setDepartureLocation('');
    setArrivalLocation('');
    setDepartureTz('Europe/London');
    setArrivalTz('Europe/Amsterdam');
    setDepartureTerminal('');
    setArrivalTerminal('');
    setCheckinHours(defaultCheckinHours);
    setCheckoutMin(defaultCheckoutMin);
    setTransferFrom('');
    setTransferTo('');
    setTransferMode('transit');
    setCalcLoading(false);
    setDate('');
    setSelectedDay('0');
    setStartTime('09:00');
    setEndTime('10:00');
    setDurationMin(60);
    setSaving(false);
    setIsReturnFlight(false);
    setLatitude(null);
    setLongitude(null);
    setAutoPhotos([]);
    setTransportResults([]);
    setTransportLoading(false);
    setSelectedPolyline(null);
    transportFetchedRef.current = false;
    setParsedFlights([]);
    setFlightParseLoading(false);
    setPlacePhone(null);
    setPlaceAddress(null);
    setPlaceRating(null);
    setPlaceUserRatingCount(null);
    setPlaceOpeningHours(null);
    setPlaceGoogleMapsUri(null);
    setPlaceGooglePlaceId(null);
    setPlacePriceLevel(null);
    setDepartureLat(null);
    setDepartureLng(null);
    setArrivalLat(null);
    setArrivalLng(null);
  };

  // Transport gap auto-fill
  const fetchAllRoutes = useCallback(async (from: string, to: string) => {
    setTransportLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-directions', {
        body: { fromAddress: from, toAddress: to, modes: ['walk', 'transit', 'drive', 'bicycle'] },
      });
      if (!error && data?.results) {
        setTransportResults(data.results);
        const fastest = data.results.reduce((a: TransportResult, b: TransportResult) => a.duration_min < b.duration_min ? a : b);
        setTransferMode(fastest.mode);
        setSelectedPolyline(fastest.polyline ?? null);
        const blockDur = Math.ceil(fastest.duration_min / 5) * 5;
        setDurationMin(fastest.duration_min);
        const [h, m] = startTime.split(':').map(Number);
        const endTotalMin = h * 60 + m + blockDur;
        const endH = Math.floor(endTotalMin / 60) % 24;
        const endM = endTotalMin % 60;
        setEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
        const modeLabels: Record<string, string> = { walk: 'Walk', transit: 'Transit', drive: 'Drive', bicycle: 'Cycle' };
        const toShort = to.split(',')[0].trim();
        setName(`${modeLabels[fastest.mode] || fastest.mode} to ${toShort}`);
      }
    } catch (err) {
      console.error('Transport route fetch failed:', err);
    } finally {
      setTransportLoading(false);
    }
  }, [startTime]);

  useEffect(() => {
    if (mode !== 'create') return;
    if (transportContext && open && !transportFetchedRef.current && categoryId === 'transfer') {
      transportFetchedRef.current = true;
      setTransferFrom(transportContext.fromAddress);
      setTransferTo(transportContext.toAddress);
      fetchAllRoutes(transportContext.fromAddress, transportContext.toAddress);
    }
    if (!transportContext && gapContext && open && !transportFetchedRef.current && categoryId === 'transfer' && transferFrom && transferTo) {
      transportFetchedRef.current = true;
      fetchAllRoutes(transferFrom, transferTo);
    }
  }, [transportContext, gapContext, open, categoryId, fetchAllRoutes, mode, transferFrom, transferTo]);

  const handleSelectTransportMode = (result: TransportResult) => {
    setTransferMode(result.mode);
    setDurationMin(result.duration_min);
    setSelectedPolyline(result.polyline ?? null);
    const blockDur = Math.ceil(result.duration_min / 5) * 5;
    const [h, m] = startTime.split(':').map(Number);
    const endTotalMin = h * 60 + m + blockDur;
    const endH = Math.floor(endTotalMin / 60) % 24;
    const endM = endTotalMin % 60;
    setEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
    const modeLabels: Record<string, string> = { walk: 'Walk', transit: 'Transit', drive: 'Drive', bicycle: 'Cycle' };
    const toShort = transferTo.split(',')[0].trim();
    setName(`${modeLabels[result.mode] || result.mode} to ${toShort}`);
  };

  // Flight booking upload
  const handleFlightFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFlightParseLoading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => { resolve((reader.result as string).split(',')[1]); };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke('parse-flight-booking', {
        body: { fileBase64: base64, mimeType: file.type },
      });
      if (error) throw error;
      if (data?.flights?.length > 0) {
        if (data.flights.length === 1) {
          applyParsedFlight(data.flights[0]);
          toast({ title: 'Extracted flight details — please review ✈️' });
        } else {
          setParsedFlights(data.flights);
          toast({ title: `Found ${data.flights.length} flights — select one` });
        }
      } else {
        toast({ title: 'No flight details found in document', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Failed to parse booking', description: err.message, variant: 'destructive' });
    } finally {
      setFlightParseLoading(false);
      if (flightFileRef.current) flightFileRef.current.value = '';
    }
  };

  const applyParsedFlight = (flight: any) => {
    if (flight.flight_number) setName(flight.flight_number);
    if (flight.departure_terminal) setDepartureTerminal(flight.departure_terminal);
    if (flight.arrival_terminal) setArrivalTerminal(flight.arrival_terminal);
    if (flight.departure_time) setStartTime(flight.departure_time);
    if (flight.arrival_time) setEndTime(flight.arrival_time);
    if (flight.departure_airport) {
      const apt = AIRPORTS.find(a => a.iata === flight.departure_airport.toUpperCase());
      if (apt) { setDepartureLocation(`${apt.iata} - ${apt.name}`); setDepartureTz(apt.timezone); setDepartureLat(apt.lat); setDepartureLng(apt.lng); }
      else setDepartureLocation(flight.departure_airport);
    }
    if (flight.arrival_airport) {
      const apt = AIRPORTS.find(a => a.iata === flight.arrival_airport.toUpperCase());
      if (apt) { setArrivalLocation(`${apt.iata} - ${apt.name}`); setArrivalTz(apt.timezone); setArrivalLat(apt.lat); setArrivalLng(apt.lng); }
      else setArrivalLocation(flight.arrival_airport);
    }
    if (flight.date) setDate(flight.date);
    if (flight.departure_time && flight.arrival_time) {
      const entryDate = flight.date || '2099-01-01';
      const dTz = flight.departure_airport ? (AIRPORTS.find(a => a.iata === flight.departure_airport.toUpperCase())?.timezone || departureTz) : departureTz;
      const aTz = flight.arrival_airport ? (AIRPORTS.find(a => a.iata === flight.arrival_airport.toUpperCase())?.timezone || arrivalTz) : arrivalTz;
      calcFlightDuration(flight.departure_time, flight.arrival_time, dTz, aTz, entryDate);
    }
    setParsedFlights([]);
  };

  const handleClose = (openVal: boolean) => {
    if (!openVal) reset();
    onOpenChange(openVal);
  };

  const handleCategorySelect = (catId: string) => {
    if (catId === 'hotel' && onHotelSelected) {
      onHotelSelected();
      return;
    }
    const specialCats = ['flight', 'hotel', 'transfer', 'private_transfer'];
    if (!specialCats.includes(catId) && onExploreRequest) {
      onExploreRequest(catId);
      return;
    }
    setCategoryId(catId);
    const cat = allCategories.find(c => c.id === catId);
    if (cat) applySmartDefaults(cat);
    setStep('details');
  };

  const calcFlightDuration = useCallback((sTime: string, eTime: string, dTz: string, aTz: string, dateStr: string) => {
    if (!sTime || !eTime) return;
    const entryDate = dateStr || '2099-01-01';
    const departUTC = new Date(localToUTC(entryDate, sTime, dTz));
    const arriveUTC = new Date(localToUTC(entryDate, eTime, aTz));
    let diffMin = Math.round((arriveUTC.getTime() - departUTC.getTime()) / 60000);
    if (diffMin <= 0) diffMin += 1440;
    setDurationMin(diffMin);
  }, []);

  const handleFlightStartChange = (newStart: string) => {
    setStartTime(newStart);
    const entryDate = isUndated ? format(addDays(parseISO(REFERENCE_DATE), Number(selectedDay)), 'yyyy-MM-dd') : date;
    calcFlightDuration(newStart, endTime, departureTz, arrivalTz, entryDate || '2099-01-01');
  };

  const handleFlightEndChange = (newEnd: string) => {
    setEndTime(newEnd);
    const entryDate = isUndated ? format(addDays(parseISO(REFERENCE_DATE), Number(selectedDay)), 'yyyy-MM-dd') : date;
    calcFlightDuration(startTime, newEnd, departureTz, arrivalTz, entryDate || '2099-01-01');
  };

  const handleDepartureAirportChange = (airport: Airport) => {
    setDepartureLocation(`${airport.iata} - ${airport.name}`);
    setDepartureTz(airport.timezone);
    setDepartureLat(airport.lat);
    setDepartureLng(airport.lng);
  };

  const handleArrivalAirportChange = (airport: Airport) => {
    setArrivalLocation(`${airport.iata} - ${airport.name}`);
    setArrivalTz(airport.timezone);
    setArrivalLat(airport.lat);
    setArrivalLng(airport.lng);
  };

  const calcTransferDuration = async () => {
    if (!transferFrom.trim() || !transferTo.trim()) {
      toast({ title: 'Enter both From and To locations', variant: 'destructive' });
      return;
    }
    setCalcLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-directions', {
        body: { fromAddress: transferFrom.trim(), toAddress: transferTo.trim(), mode: transferMode },
      });
      if (error) throw error;
      if (data?.duration_min) {
        setDurationMin(data.duration_min);
        const [h, m] = startTime.split(':').map(Number);
        const endTotalMin = h * 60 + m + data.duration_min;
        const endH = Math.floor(endTotalMin / 60) % 24;
        const endM = endTotalMin % 60;
        setEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
        toast({ title: `Estimated: ${data.duration_min} min (${data.distance_km} km)` });
      } else {
        toast({ title: 'No route found', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Failed to calculate', description: err.message, variant: 'destructive' });
    } finally {
      setCalcLoading(false);
    }
  };

  const autoDetectTripDates = async (entryDate: string, dayIndex: number) => {
    if (!trip || !isUndated || !isFlight) return;
    try {
      const startDate = addDays(parseISO(entryDate), -dayIndex);
      const endDate = addDays(startDate, (trip.duration_days ?? 3) - 1);
      await supabase.from('trips').update({
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
      } as any).eq('id', trip.id);

      const { data: allEntries } = await supabase.from('entries').select('*').eq('trip_id', trip.id);
      if (allEntries) {
        for (const ent of allEntries) {
          const entryStart = new Date(ent.start_time);
          const refBase = new Date('2099-01-01T00:00:00Z');
          const entryDayOffset = Math.round((entryStart.getTime() - refBase.getTime()) / (1000 * 60 * 60 * 24));
          if (entryDayOffset >= 0 && entryDayOffset < 365) {
            const realDate = addDays(startDate, entryDayOffset);
            const startTimeStr = format(entryStart, 'HH:mm:ss');
            const endTimeStr = format(new Date(ent.end_time), 'HH:mm:ss');
            const newStart = `${format(realDate, 'yyyy-MM-dd')}T${startTimeStr}Z`;
            const newEnd = `${format(realDate, 'yyyy-MM-dd')}T${endTimeStr}Z`;
            await supabase.from('entries').update({ start_time: newStart, end_time: newEnd }).eq('id', ent.id);
          }
        }
      }
      toast({ title: 'Trip dates set based on your flight! 🎉' });
    } catch (err) {
      console.error('Failed to auto-detect trip dates:', err);
    }
  };

  const handleSaveAsIdea = async () => {
    if (!name.trim()) { toast({ title: 'Name is required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const placeholderDate = isUndated
        ? format(addDays(parseISO(REFERENCE_DATE), Number(selectedDay)), 'yyyy-MM-dd')
        : (date || format(new Date(), 'yyyy-MM-dd'));
      const startIso = localToUTC(placeholderDate, '00:00', homeTimezone);
      const endIso = localToUTC(placeholderDate, '01:00', homeTimezone);
      const scheduledDay = isUndated ? Number(selectedDay) : null;

      const { data: d, error } = await supabase
        .from('entries')
        .insert({ trip_id: tripId, start_time: startIso, end_time: endIso, is_scheduled: false, scheduled_day: scheduledDay, created_by: session?.user?.id ?? null } as any)
        .select('id').single();
      if (error) throw error;

      const cat = allCategories.find(c => c.id === categoryId);
      await supabase.from('entry_options').insert({
        entry_id: d.id, name: name.trim(), website: website.trim() || null,
        category: cat ? cat.id : null, category_color: cat?.color ?? null,
        location_name: locationName.trim() || null,
        departure_location: isFlight ? (departureLocation.trim() || null) : isTransfer ? (transferFrom.trim() || null) : null,
        arrival_location: isFlight ? (arrivalLocation.trim() || null) : isTransfer ? (transferTo.trim() || null) : null,
        departure_tz: isFlight ? departureTz : null, arrival_tz: isFlight ? arrivalTz : null,
      } as any);

      onSaved();
      handleClose(false);
      toast({ title: 'Added to ideas panel 💡' });
    } catch (err: any) {
      toast({ title: 'Failed to save', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleSave = async () => {
    let entryDate: string;
    if (transportContext && prefillStartTime) {
      const { date: d } = utcToLocal(prefillStartTime, homeTimezone);
      entryDate = d;
    } else {
      entryDate = isUndated ? format(addDays(parseISO(REFERENCE_DATE), Number(selectedDay)), 'yyyy-MM-dd') : date;
    }
    if (!entryDate) { toast({ title: 'Please select a date', variant: 'destructive' }); return; }

    setSaving(true);
    try {
      let startIso: string, endIso: string;
      if (isFlight) {
        startIso = localToUTC(entryDate, startTime, departureTz);
        endIso = localToUTC(entryDate, endTime, arrivalTz);
        if (new Date(endIso) <= new Date(startIso)) {
          endIso = localToUTC(format(addDays(parseISO(entryDate), 1), 'yyyy-MM-dd'), endTime, arrivalTz);
        }
      } else if (isTransfer && transportContext) {
        const blockDur = Math.ceil(durationMin / 5) * 5;
        startIso = prefillStartTime || localToUTC(entryDate, startTime, homeTimezone);
        endIso = new Date(new Date(startIso).getTime() + blockDur * 60000).toISOString();
      } else {
        const saveTz = resolvedTzProp || homeTimezone;
        startIso = localToUTC(entryDate, startTime, saveTz);
        endIso = localToUTC(entryDate, endTime, saveTz);
      }

      let entryId: string;
      if (isEditing && editEntry) {
        const { error } = await supabase.from('entries').update({ start_time: startIso, end_time: endIso }).eq('id', editEntry.id);
        if (error) throw error;
        entryId = editEntry.id;
      } else {
        const insertPayload: any = { trip_id: tripId, start_time: startIso, end_time: endIso, created_by: session?.user?.id ?? null };
        if (transportContext?.fromEntryId) insertPayload.from_entry_id = transportContext.fromEntryId;
        if (transportContext?.toEntryId) insertPayload.to_entry_id = transportContext.toEntryId;
        const { data: d, error } = await supabase.from('entries').insert(insertPayload).select('id').single();
        if (error) throw error;
        entryId = d.id;
      }

      if (isEditing && editOption) {
        const cat = allCategories.find(c => c.id === categoryId);
        await supabase.from('entry_options').update({
          name: name.trim(), website: website.trim() || null,
          category: cat ? cat.id : null, category_color: cat?.color ?? null,
          location_name: locationName.trim() || null, latitude: isFlight ? arrivalLat : latitude, longitude: isFlight ? arrivalLng : longitude,
          departure_location: isFlight ? (departureLocation.trim() || null) : isTransfer ? (transferFrom.trim() || null) : null,
          arrival_location: isFlight ? (arrivalLocation.trim() || null) : isTransfer ? (transferTo.trim() || null) : null,
          departure_tz: isFlight ? departureTz : null, arrival_tz: isFlight ? arrivalTz : null,
          departure_terminal: isFlight ? departureTerminal : null, arrival_terminal: isFlight ? arrivalTerminal : null,
          airport_checkin_hours: isFlight ? checkinHours : null, airport_checkout_min: isFlight ? checkoutMin : null,
          phone: placePhone, address: placeAddress, rating: placeRating, user_rating_count: placeUserRatingCount,
          opening_hours: placeOpeningHours, google_maps_uri: placeGoogleMapsUri, google_place_id: placeGooglePlaceId,
          price_level: placePriceLevel,
        } as any).eq('id', editOption.id);
      } else {
        const cat = allCategories.find(c => c.id === categoryId);
        const optionPayload: any = {
          entry_id: entryId, name: name.trim(), website: website.trim() || null,
          category: cat ? cat.id : null, category_color: cat?.color ?? null,
          location_name: locationName.trim() || null, latitude: isFlight ? arrivalLat : latitude, longitude: isFlight ? arrivalLng : longitude,
          departure_location: isFlight ? (departureLocation.trim() || null) : isTransfer ? (transferFrom.trim() || null) : null,
          arrival_location: isFlight ? (arrivalLocation.trim() || null) : isTransfer ? (transferTo.trim() || null) : null,
          departure_tz: isFlight ? departureTz : null, arrival_tz: isFlight ? arrivalTz : null,
          departure_terminal: isFlight ? departureTerminal : null, arrival_terminal: isFlight ? arrivalTerminal : null,
          airport_checkin_hours: isFlight ? checkinHours : null, airport_checkout_min: isFlight ? checkoutMin : null,
          phone: placePhone, address: placeAddress, rating: placeRating, user_rating_count: placeUserRatingCount,
          opening_hours: placeOpeningHours, google_maps_uri: placeGoogleMapsUri, google_place_id: placeGooglePlaceId,
          price_level: placePriceLevel,
        };

        if (isTransfer) {
          const selectedResult = transportResults.find(r => r.mode === transferMode);
          if (selectedResult) {
            optionPayload.distance_km = selectedResult.distance_km;
            optionPayload.route_polyline = selectedResult.polyline ?? null;
            optionPayload.transport_modes = transportResults;
          }
          const modeLabels: Record<string, string> = { walk: 'Walk', transit: 'Transit', drive: 'Drive', bicycle: 'Cycle' };
          if (!name.trim()) {
            const toShort = transferTo.split(',')[0].trim();
            optionPayload.name = `${modeLabels[transferMode] || transferMode} to ${toShort}`;
          }
        }

        const { data: optData } = await supabase.from('entry_options').insert(optionPayload).select('id').single();

        if (autoPhotos.length > 0 && optData) {
          for (let i = 0; i < autoPhotos.length; i++) {
            await supabase.from('option_images').insert({
              option_id: optData.id,
              image_url: autoPhotos[i],
              sort_order: i,
            });
          }
        }
      }

      if (isFlight && !isEditing) {
        const linkedEntryCheckin = await supabase.from('entries').insert({
          trip_id: tripId,
          start_time: new Date(new Date(startIso).getTime() - checkinHours * 3600000).toISOString(),
          end_time: startIso,
          linked_flight_id: entryId,
          linked_type: 'checkin',
          created_by: session?.user?.id ?? null,
        } as any).select('id').single();

        if (linkedEntryCheckin.data) {
          await supabase.from('entry_options').insert({
            entry_id: linkedEntryCheckin.data.id,
            name: `Check in · ${departureLocation.split(' - ')[0]?.trim() || 'Airport'}`,
            category: 'airport_processing',
            category_color: 'hsl(210, 50%, 55%)',
            departure_location: departureLocation,
            location_name: departureLocation,
            latitude: departureLat,
            longitude: departureLng,
          } as any);
        }

        const linkedEntryCheckout = await supabase.from('entries').insert({
          trip_id: tripId,
          start_time: endIso,
          end_time: new Date(new Date(endIso).getTime() + checkoutMin * 60000).toISOString(),
          linked_flight_id: entryId,
          linked_type: 'checkout',
          created_by: session?.user?.id ?? null,
        } as any).select('id').single();

        if (linkedEntryCheckout.data) {
          await supabase.from('entry_options').insert({
            entry_id: linkedEntryCheckout.data.id,
            name: `Check out · ${arrivalLocation.split(' - ')[0]?.trim() || 'Airport'}`,
            category: 'airport_processing',
            category_color: 'hsl(210, 50%, 55%)',
            arrival_location: arrivalLocation,
            location_name: arrivalLocation,
            latitude: arrivalLat,
            longitude: arrivalLng,
          } as any);
        }

        if (!trip?.home_timezone || trip.home_timezone === 'Europe/London') {
          await supabase.from('trips').update({ home_timezone: departureTz } as any).eq('id', tripId);
        }
      }

      if (isFlight && isUndated && !isEditing && date) {
        await autoDetectTripDates(date, Number(selectedDay));
      }

      if (isTransfer && !isEditing && transportContext?.toEntryId) {
        try {
          const { data: nextEntry } = await supabase
            .from('entries')
            .select('id, start_time, end_time, is_locked')
            .eq('id', transportContext.toEntryId)
            .single();
          if (nextEntry && !nextEntry.is_locked) {
            const transportEndDt = new Date(endIso);
            const nextDuration = new Date(nextEntry.end_time).getTime() - new Date(nextEntry.start_time).getTime();
            if (transportEndDt.getTime() !== new Date(nextEntry.start_time).getTime()) {
              await supabase.from('entries').update({
                start_time: endIso,
                end_time: new Date(transportEndDt.getTime() + nextDuration).toISOString(),
              }).eq('id', nextEntry.id);
            }
          }
        } catch (err) {
          console.error('Failed to pull next event:', err);
        }
      }

      onSaved();
      handleClose(false);
      toast({ title: isEditing ? 'Entry updated!' : 'Entry created!' });

      if (isFlight && !isEditing && !isReturnFlight) {
        setReturnFlightData({
          departureLocation: arrivalLocation, arrivalLocation: departureLocation,
          departureTz: arrivalTz, arrivalTz: departureTz,
          departureTerminal: '', arrivalTerminal: '',
          departureLat: arrivalLat, departureLng: arrivalLng,
          arrivalLat: departureLat, arrivalLng: departureLng,
        });
        setShowReturnPrompt(true);
      }
    } catch (err: any) {
      toast({ title: 'Failed to save entry', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleReturnFlightConfirm = () => {
    if (!returnFlightData) return;
    setShowReturnPrompt(false);
    setIsReturnFlight(true);
    setCategoryId('flight');
    setName('');
    setDepartureLocation(returnFlightData.departureLocation);
    setArrivalLocation(returnFlightData.arrivalLocation);
    setDepartureTz(returnFlightData.departureTz);
    setArrivalTz(returnFlightData.arrivalTz);
    setDepartureTerminal('');
    setArrivalTerminal('');
    setDepartureLat(returnFlightData.departureLat);
    setDepartureLng(returnFlightData.departureLng);
    setArrivalLat(returnFlightData.arrivalLat);
    setArrivalLng(returnFlightData.arrivalLng);
    setWebsite(''); setLocationName(''); setTransferFrom(''); setTransferTo('');
    setDate(''); setSelectedDay('0');
    const cat = PREDEFINED_CATEGORIES.find(c => c.id === 'flight');
    if (cat) {
      setStartTime(`${String(cat.defaultStartHour).padStart(2, '0')}:${String(cat.defaultStartMin).padStart(2, '0')}`);
      setDurationMin(cat.defaultDurationMin);
      const endTotalMin = cat.defaultStartHour * 60 + cat.defaultStartMin + cat.defaultDurationMin;
      setEndTime(`${String(Math.floor(endTotalMin / 60) % 24).padStart(2, '0')}:${String(endTotalMin % 60).padStart(2, '0')}`);
    }
    setStep('details');
    onOpenChange(true);
    setReturnFlightData(null);
  };

  const handleReturnFlightDecline = () => { setShowReturnPrompt(false); setReturnFlightData(null); };

  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
  };

  // ─── Render ───

  const stepTitle = step === 'category'
    ? 'What are you planning?'
    : (isFlight ? '✈️ Flight Details' : isTransfer ? '🚐 Transfer Details' : `${selectedCategory?.emoji ?? '📌'} Details`);

  // ─── VIEW MODE ───
  if (mode === 'view') {
    if (!entry || !option) return null;

    const viewContent = (
      <PlaceOverview
        entry={entry}
        option={option}
        trip={trip}
        context="timeline"
        isEditor={isEditor}
        resolvedTz={resolvedTzProp}
        formatTime={formatTimeProp}
        userLat={userLat}
        userLng={userLng}
        votingLocked={votingLocked}
        userVotes={userVotes}
        onVoteChange={onVoteChange}
        onSaved={onSaved}
        onClose={() => onOpenChange(false)}
        onMoveToIdeas={onMoveToIdeas}
      />
    );

    if (isMobile) {
      return (
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="max-h-[92vh] overflow-y-auto">
            {viewContent}
          </DrawerContent>
        </Drawer>
      );
    }

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md p-0">
          {viewContent}
        </DialogContent>
      </Dialog>
    );
  }

  // ─── CREATE MODE ───
  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{stepTitle}</DialogTitle>
          </DialogHeader>

          {step === 'category' && (
            <div className="space-y-1">
              {/* Search bar */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search for a place..."
                  className="pl-9"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      const query = e.currentTarget.value.trim();
                      setCategoryId('activity');
                      setName(query);
                      setStep('details');
                    }
                  }}
                />
              </div>

              {/* Contextual transport suggestion */}
              {gapContext && gapContext.fromName && gapContext.toName && (
                <button
                  type="button"
                  onClick={() => {
                    setCategoryId('transfer');
                    setTransferFrom(gapContext.fromAddress);
                    setTransferTo(gapContext.toAddress);
                    setName('');
                    applySmartDefaults({ id: 'transfer', name: 'Transfer', emoji: '🚐', color: 'hsl(200, 60%, 45%)', defaultDurationMin: 60, defaultStartHour: 9, defaultStartMin: 0 });
                    setStep('details');
                    if (gapContext.fromAddress && gapContext.toAddress) {
                      transportFetchedRef.current = false;
                    }
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-left transition-all hover:border-primary hover:bg-primary/10"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg">🚐</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">Transport</p>
                    <p className="truncate text-xs text-muted-foreground">{gapContext.fromName} → {gapContext.toName}</p>
                  </div>
                </button>
              )}

              {/* Category list — grouped vertical layout */}
              {(() => {
                const travelIds = ['flight', 'hotel', 'private_transfer'];
                const foodIds = ['breakfast', 'lunch', 'coffee_shop', 'dinner', 'drinks', 'nightlife'];
                const activityIds = ['sightseeing', 'museum', 'park', 'activity', 'shopping'];

                const customCats = allCategories.filter(c =>
                  !travelIds.includes(c.id) &&
                  !foodIds.includes(c.id) &&
                  !activityIds.includes(c.id)
                );

                const renderItem = (cat: typeof allCategories[0]) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategorySelect(cat.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all hover:bg-accent/50 active:bg-accent"
                  >
                    <span className="text-lg w-7 text-center shrink-0">{cat.emoji}</span>
                    <span className="text-sm font-medium">{cat.name}</span>
                  </button>
                );

                const divider = (key: string) => (
                  <div key={key} className="my-1 border-t border-border/50" />
                );

                return (
                  <div>
                    {travelIds.map(id => {
                      const cat = allCategories.find(c => c.id === id);
                      return cat ? renderItem(cat) : null;
                    })}

                    {divider('div-travel')}

                    {customCats.length > 0 && (
                      <>
                        {customCats.map(cat => renderItem(cat))}
                        {divider('div-custom')}
                      </>
                    )}

                    {foodIds.map(id => {
                      const cat = allCategories.find(c => c.id === id);
                      return cat ? renderItem(cat) : null;
                    })}

                    {divider('div-food')}

                    {activityIds.map(id => {
                      const cat = allCategories.find(c => c.id === id);
                      return cat ? renderItem(cat) : null;
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-4">
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => setStep('category')}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: selectedCategory.color }}
                >
                  <span>{selectedCategory.emoji}</span>
                  {selectedCategory.name}
                  <span className="ml-1 text-white/70">← change</span>
                </button>
              )}

              <div className="space-y-2">
                <Label htmlFor="opt-name">Name *</Label>
                {!isFlight && !isTransfer ? (
                  <PlacesAutocomplete value={name} onChange={setName} onPlaceSelect={handlePlaceSelect} placeholder="e.g. Anne Frank House" autoFocus />
                ) : (
                  <Input id="opt-name" placeholder={isFlight ? 'e.g. BA1234' : 'e.g. Airport to Hotel'} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                )}
              </div>

              {autoPhotos.length > 0 && !isFlight && !isTransfer && (
                <PhotoStripPicker photos={autoPhotos} onChange={setAutoPhotos} />
              )}

              {isFlight && (
                <>
                  <div className="flex items-center gap-2">
                    <input ref={flightFileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleFlightFileUpload} />
                    <Button type="button" variant="outline" size="sm" onClick={() => flightFileRef.current?.click()} disabled={flightParseLoading} className="text-xs">
                      {flightParseLoading ? <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Parsing...</> : <><Upload className="mr-1.5 h-3 w-3" /> Upload booking</>}
                    </Button>
                    <span className="text-[10px] text-muted-foreground">PDF or image</span>
                  </div>

                  {parsedFlights.length > 1 && (
                    <div className="space-y-1.5 rounded-lg border border-border/50 bg-muted/30 p-2">
                      <p className="text-xs font-medium text-muted-foreground">Select flight</p>
                      {parsedFlights.map((f, i) => (
                        <button key={i} type="button" onClick={() => applyParsedFlight(f)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted transition-colors text-left">
                          <span className="font-medium">{f.flight_number || `Flight ${i + 1}`}</span>
                          <span className="text-muted-foreground">{f.departure_airport} → {f.arrival_airport}</span>
                          {f.date && <span className="ml-auto text-muted-foreground">{f.date}</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Departure Airport</Label>
                      <AirportPicker value={departureLocation} onChange={handleDepartureAirportChange} placeholder="Search departure airport..." />
                      {departureTz && <p className="text-xs text-muted-foreground">Timezone: {getTzAbbr(departureTz)}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Departure Terminal</Label>
                      <Input placeholder="e.g. Terminal 5, T2" value={departureTerminal} onChange={(e) => setDepartureTerminal(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Arrival Airport</Label>
                      <AirportPicker value={arrivalLocation} onChange={handleArrivalAirportChange} placeholder="Search arrival airport..." />
                      {arrivalTz && <p className="text-xs text-muted-foreground">Timezone: {getTzAbbr(arrivalTz)}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Arrival Terminal</Label>
                      <Input placeholder="e.g. Terminal 1, T3" value={arrivalTerminal} onChange={(e) => setArrivalTerminal(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Airport Processing</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Arrive early (hours)</Label>
                        <Input type="number" min={0} max={6} step={0.5} value={checkinHours} onChange={(e) => setCheckinHours(Math.max(0, Number(e.target.value) || 0))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Checkout (minutes)</Label>
                        <Input type="number" min={0} max={120} step={15} value={checkoutMin} onChange={(e) => setCheckoutMin(Math.max(0, Number(e.target.value) || 0))} />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Auto-creates check-in &amp; checkout blocks on the timeline</p>
                  </div>
                </>
              )}

              {isTransfer && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>From</Label>
                      <Input placeholder="e.g. Heathrow Airport" value={transferFrom} onChange={(e) => setTransferFrom(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>To</Label>
                      <Input placeholder="e.g. Hotel Krasnapolsky" value={transferTo} onChange={(e) => setTransferTo(e.target.value)} />
                    </div>
                  </div>

                  {transportContext && (transportLoading || transportResults.length > 0) ? (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground">Routes</Label>
                      {transportLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          <span className="ml-2 text-xs text-muted-foreground">Fetching routes…</span>
                        </div>
                      ) : transportResults.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">No routes found</p>
                      ) : (
                        <div className="space-y-1.5">
                          {transportResults.map(r => {
                            const modeEmoji: Record<string, string> = { walk: '🚶', transit: '🚌', drive: '🚗', bicycle: '🚲' };
                            const modeLabel: Record<string, string> = { walk: 'Walk', transit: 'Transit', drive: 'Drive', bicycle: 'Cycle' };
                            const formatDur = (min: number) => {
                              const h = Math.floor(min / 60); const m = min % 60;
                              if (h === 0) return `${m}m`; if (m === 0) return `${h}h`; return `${h}h ${m}m`;
                            };
                            return (
                              <button key={r.mode} type="button" onClick={() => handleSelectTransportMode(r)}
                                className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors',
                                  transferMode === r.mode ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'
                                )}>
                                <span className="text-base">{modeEmoji[r.mode] ?? '🚌'}</span>
                                <span className="flex-1 text-left capitalize">{modeLabel[r.mode] ?? r.mode}</span>
                                <span className="text-xs text-muted-foreground">{formatDur(r.duration_min)} · {r.distance_km < 1 ? `${Math.round(r.distance_km * 1000)}m` : `${r.distance_km.toFixed(1)}km`}</span>
                                {transferMode === r.mode && <Check className="h-3.5 w-3.5 text-primary" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Travel mode</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {TRAVEL_MODES.map((m) => (
                          <button key={m.id} type="button" onClick={() => setTransferMode(m.id)}
                            className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all',
                              transferMode === m.id ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border bg-background text-muted-foreground hover:border-primary/40'
                            )}>
                            <span className="text-base">{m.emoji}</span>
                            <span>{m.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Route map preview in creation dialog */}
              {isTransfer && transportContext && (
                selectedPolyline ? (
                  <RouteMapPreview
                    polyline={selectedPolyline}
                    fromAddress={transferFrom}
                    toAddress={transferTo}
                    travelMode={transferMode}
                    size="full"
                  />
                ) : transferFrom && transferTo && !transportLoading && transportResults.length > 0 ? (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 text-xs" asChild>
                      <a href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(transferFrom)}&destination=${encodeURIComponent(transferTo)}&travelmode=${transferMode === 'bicycle' ? 'bicycling' : transferMode === 'drive' ? 'driving' : transferMode}`} target="_blank" rel="noopener noreferrer">
                        View Route on Google Maps
                      </a>
                    </Button>
                  </div>
                ) : null
              )}

              {/* Gap overflow warning */}
              {isTransfer && transportContext?.gapMinutes != null && durationMin > 0 && (() => {
                const blockDur = Math.ceil(durationMin / 5) * 5;
                const gap = transportContext.gapMinutes!;
                const overflow = blockDur - gap;
                const contingency = blockDur - durationMin;
                if (overflow > 0) {
                  return (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        <div>
                          <p className="text-sm font-medium">
                            Transport takes <span className="font-bold">{blockDur}m</span> but gap is only <span className="font-bold">{gap}m</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {overflow}m overflow — the conflict resolver will help adjust the schedule
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }
                if (contingency > 0) {
                  return (
                    <div className="rounded-lg border border-border/50 bg-muted/30 p-2">
                      <p className="text-xs text-muted-foreground">
                        ⏱ {durationMin}m travel + {contingency}m contingency = <span className="font-semibold">{blockDur}m block</span>
                        {gap > blockDur && <span> · {gap - blockDur}m gap remaining</span>}
                      </p>
                    </div>
                  );
                }
                return null;
              })()}

              {!isTransfer && (
                <div className="space-y-2">
                  <Label htmlFor="opt-website">Website</Label>
                  <Input id="opt-website" type="url" placeholder="https://..." value={website} onChange={(e) => setWebsite(e.target.value)} />
                </div>
              )}

              {!isFlight && !isTransfer && (
                <div className="space-y-2">
                  <Label>Location Name</Label>
                  <Input placeholder="e.g. Dam Square" value={locationName} onChange={(e) => setLocationName(e.target.value)} />
                </div>
              )}

              {!(isTransfer && transportContext) && (<>
              <div className="border-t border-border/50 pt-4 mt-2">
                <Label className="text-sm font-semibold text-muted-foreground">When</Label>
              </div>

              {/* Hide date/day selector when transport context provides timing */}
              {!transportContext && (
              <div className="space-y-2">
                {isUndated ? (
                  <>
                    <Label>Day</Label>
                    <Select value={selectedDay} onValueChange={setSelectedDay}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-popover">
                        {Array.from({ length: dayCount }, (_, i) => (
                          <SelectItem key={i} value={String(i)}>Day {i + 1}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isFlight && (
                      <div className="mt-2 space-y-1">
                        <Label htmlFor="flight-real-date" className="text-xs text-muted-foreground">Actual flight date (optional — sets trip dates automatically)</Label>
                        <Input id="flight-real-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <Label htmlFor="entry-date">Date</Label>
                    <Input id="entry-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </>
                )}
              </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Time</Label>
                  <span className="text-xs text-muted-foreground">
                    {(() => {
                      if (isFlight) {
                        return `Duration: ${durationMin >= 60 ? `${Math.floor(durationMin / 60)}h${durationMin % 60 ? ` ${durationMin % 60}m` : ''}` : `${durationMin}m`}`;
                      }
                      const [sh, sm] = startTime.split(':').map(Number);
                      const [eh, em] = endTime.split(':').map(Number);
                      const diff = (eh * 60 + em) - (sh * 60 + sm);
                      if (diff <= 0) return '';
                      const h = Math.floor(diff / 60);
                      const m = diff % 60;
                      return `Duration: ${h > 0 ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`}`;
                    })()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{isFlight ? `Depart (${getTzAbbr(departureTz)})` : 'Start'}</Label>
                    <Input type="time" value={startTime} onChange={(e) => isFlight ? handleFlightStartChange(e.target.value) : handleStartTimeChange(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{isFlight ? `Arrive (${getTzAbbr(arrivalTz)})` : 'End'}</Label>
                    <Input type="time" value={endTime} onChange={(e) => isFlight ? handleFlightEndChange(e.target.value) : setEndTime(e.target.value)} />
                  </div>
                </div>
              </div>

              {isTransfer && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 space-y-1">
                      <Label>Duration (minutes)</Label>
                      <Input type="number" min={15} step={15} value={durationMin}
                        onChange={(e) => {
                          const d = parseInt(e.target.value) || 60;
                          setDurationMin(d);
                          const [h, m] = startTime.split(':').map(Number);
                          const endTotalMin = h * 60 + m + d;
                          setEndTime(`${String(Math.floor(endTotalMin / 60) % 24).padStart(2, '0')}:${String(endTotalMin % 60).padStart(2, '0')}`);
                        }}
                      />
                    </div>
                    <Button variant="outline" size="sm" className="mt-6" onClick={calcTransferDuration} disabled={calcLoading}>
                      {calcLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Calculate'}
                    </Button>
                  </div>
                </div>
              )}
              </>)}

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setStep('category')}>Back</Button>
                <Button variant="secondary" onClick={() => handleSaveAsIdea()} disabled={saving}>💡 Ideas</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : (isEditing ? 'Update Entry' : 'Create Entry')}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Return flight prompt */}
      <AlertDialog open={showReturnPrompt} onOpenChange={setShowReturnPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add return flight? ✈️</AlertDialogTitle>
            <AlertDialogDescription>Would you like to add a return flight with reversed airports and timezones?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleReturnFlightDecline}>No thanks</AlertDialogCancel>
            <AlertDialogAction onClick={handleReturnFlightConfirm}>Yes, add return</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EntrySheet;

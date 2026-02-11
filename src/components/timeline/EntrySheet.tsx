import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { addDays, format, parseISO } from 'date-fns';
import { utcToLocal, localToUTC } from '@/lib/timezoneUtils';
import { PREDEFINED_CATEGORIES, TRAVEL_MODES, type CategoryDef } from '@/lib/categories';
import type { Trip, EntryWithOptions, EntryOption, CategoryPreset } from '@/types/trip';
import { haversineKm } from '@/lib/distance';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import AirportPicker from './AirportPicker';
import type { Airport } from '@/lib/airports';
import AIRPORTS from '@/lib/airports';
import { Loader2, Upload, Check, Clock, ExternalLink, Pencil, Trash2, Lock, Unlock, Lightbulb, Plane, AlertTriangle, RefreshCw } from 'lucide-react';
import PlacesAutocomplete, { type PlaceDetails } from './PlacesAutocomplete';
import PhotoStripPicker from './PhotoStripPicker';
import ImageGallery from './ImageGallery';
import ImageUploader from './ImageUploader';
import MapPreview from './MapPreview';
import VoteButton from './VoteButton';
import RouteMapPreview from './RouteMapPreview';
import { cn } from '@/lib/utils';

const REFERENCE_DATE = '2099-01-01';

// ─── Inline Field (click-to-edit for view mode) ───

interface InlineFieldProps {
  value: string;
  canEdit: boolean;
  onSave: (newValue: string) => Promise<void>;
  renderDisplay?: (val: string) => React.ReactNode;
  renderInput?: (val: string, onChange: (v: string) => void, onDone: () => void) => React.ReactNode;
  className?: string;
  inputType?: string;
  placeholder?: string;
}

const InlineField = ({ value, canEdit, onSave, renderDisplay, renderInput, className, inputType = 'text', placeholder }: InlineFieldProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleDone = async () => {
    if (draft !== value) {
      setSaving(true);
      await onSave(draft);
      setSaving(false);
    }
    setEditing(false);
  };

  if (editing && canEdit) {
    if (renderInput) {
      return <>{renderInput(draft, setDraft, handleDone)}</>;
    }
    return (
      <Input
        type={inputType}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={handleDone}
        onKeyDown={e => { if (e.key === 'Enter') handleDone(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        autoFocus
        disabled={saving}
        placeholder={placeholder}
        className={cn('h-8', className)}
      />
    );
  }

  const display = renderDisplay ? renderDisplay(value) : <span>{value || <span className="text-muted-foreground italic">{placeholder || 'Empty'}</span>}</span>;

  return (
    <div
      className={cn('group inline-flex items-center gap-1.5', canEdit && 'cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors', className)}
      onClick={() => { if (canEdit) { setDraft(value); setEditing(true); } }}
    >
      {display}
      {canEdit && <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
    </div>
  );
};

// ─── Helpers ───

function formatTimeInTz(isoString: string, tz: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
}

function getTzAbbr(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value ?? tz.split('/').pop() ?? tz;
  } catch { return tz.split('/').pop() ?? tz; }
}

// ─── Types ───

interface ReturnFlightData {
  departureLocation: string;
  arrivalLocation: string;
  departureTz: string;
  arrivalTz: string;
  departureTerminal: string;
  arrivalTerminal: string;
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

  // View mode
  entry?: EntryWithOptions | null;
  option?: EntryOption | null;
  formatTime?: (iso: string) => string;
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
  transportContext?: { fromAddress: string; toAddress: string; gapMinutes?: number; fromEntryId?: string; toEntryId?: string } | null;
  onTransportConflict?: (blockDuration: number, gapMinutes: number) => void;
}

type Step = 'category' | 'details';

const EntrySheet = ({
  mode, open, onOpenChange, tripId, trip, onSaved,
  entry, option, formatTime: formatTimeProp, userLat, userLng,
  votingLocked, userVotes = [], onVoteChange, onMoveToIdeas,
  editEntry, editOption, prefillStartTime, prefillEndTime, prefillCategory, transportContext,
  onTransportConflict,
}: EntrySheetProps) => {
  const { currentUser, isEditor } = useCurrentUser();

  // ─── View mode state ───
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [viewRefreshing, setViewRefreshing] = useState(false);
  const [viewResults, setViewResults] = useState<TransportResult[]>([]);
  const [viewSelectedMode, setViewSelectedMode] = useState<string | null>(null);
  const [viewApplying, setViewApplying] = useState(false);

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

  const [departureLocation, setDepartureLocation] = useState('');
  const [arrivalLocation, setArrivalLocation] = useState('');
  const [departureTz, setDepartureTz] = useState('Europe/London');
  const [arrivalTz, setArrivalTz] = useState('Europe/Amsterdam');
  const [departureTerminal, setDepartureTerminal] = useState('');
  const [arrivalTerminal, setArrivalTerminal] = useState('');
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
  const tripTimezone = trip?.timezone ?? 'Europe/Amsterdam';
  const defaultCheckinHours = trip?.default_checkin_hours ?? 2;
  const defaultCheckoutMin = trip?.default_checkout_min ?? 30;
  const selectedCategory = PREDEFINED_CATEGORIES.find(c => c.id === categoryId);

  const customCategories = (trip?.category_presets as CategoryPreset[] | null) ?? [];
  const allCategories: CategoryDef[] = [
    ...PREDEFINED_CATEGORIES.filter(c => c.id !== 'airport_processing'),
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
      const { date: sDate, time: sTime } = utcToLocal(editEntry.start_time, tripTimezone);
      const { time: eTime } = utcToLocal(editEntry.end_time, tripTimezone);
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
        setStep('details');
      }
    }
  }, [editEntry, editOption, open, isUndated, mode]);

  useEffect(() => {
    if (mode !== 'create') return;
    if (prefillStartTime && open && !editEntry) {
      const { date: d, time: t } = utcToLocal(prefillStartTime, tripTimezone);
      setStartTime(t);
      if (!isUndated) setDate(d);
    }
  }, [prefillStartTime, open, editEntry, isUndated, tripTimezone, mode]);

  useEffect(() => {
    if (mode !== 'create') return;
    if (prefillEndTime && open && !editEntry) {
      const { time: eT } = utcToLocal(prefillEndTime, tripTimezone);
      setEndTime(eT);
      if (prefillStartTime) {
        const startDt = new Date(prefillStartTime);
        const endDt = new Date(prefillEndTime);
        const diffMin = Math.round((endDt.getTime() - startDt.getTime()) / 60000);
        if (diffMin > 0) setDurationMin(diffMin);
      }
    }
  }, [prefillEndTime, prefillStartTime, open, editEntry, tripTimezone, mode]);

  const applySmartDefaults = useCallback((cat: CategoryDef) => {
    const h = cat.defaultStartHour;
    const m = cat.defaultStartMin;
    if (prefillStartTime && !isEditing) {
      const { time: pTime } = utcToLocal(prefillStartTime, tripTimezone);
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
  }, [prefillStartTime, isEditing, tripTimezone]);

  useEffect(() => {
    if (mode !== 'create') return;
    if (prefillCategory && open && !editEntry) {
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
    setDeleting(false);
    setToggling(false);
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
        // Use block duration (rounded up to 5 min) for the calendar
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
  }, [transportContext, open, categoryId, fetchAllRoutes, mode]);

  const handleSelectTransportMode = (result: TransportResult) => {
    setTransferMode(result.mode);
    setDurationMin(result.duration_min);
    setSelectedPolyline(result.polyline ?? null);
    // Use block duration (rounded up to 5 min) for the calendar
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
      if (apt) { setDepartureLocation(`${apt.iata} - ${apt.name}`); setDepartureTz(apt.timezone); }
      else setDepartureLocation(flight.departure_airport);
    }
    if (flight.arrival_airport) {
      const apt = AIRPORTS.find(a => a.iata === flight.arrival_airport.toUpperCase());
      if (apt) { setArrivalLocation(`${apt.iata} - ${apt.name}`); setArrivalTz(apt.timezone); }
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
  };

  const handleArrivalAirportChange = (airport: Airport) => {
    setArrivalLocation(`${airport.iata} - ${airport.name}`);
    setArrivalTz(airport.timezone);
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
      const startIso = localToUTC(placeholderDate, '00:00', tripTimezone);
      const endIso = localToUTC(placeholderDate, '01:00', tripTimezone);
      const scheduledDay = isUndated ? Number(selectedDay) : null;

      const { data: d, error } = await supabase
        .from('entries')
        .insert({ trip_id: tripId, start_time: startIso, end_time: endIso, is_scheduled: false, scheduled_day: scheduledDay } as any)
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
    // When transport context exists, derive date from prefillStartTime
    let entryDate: string;
    if (transportContext && prefillStartTime) {
      const { date: d } = utcToLocal(prefillStartTime, tripTimezone);
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
        // For transport with context, use block duration (rounded up to 5 min)
        const blockDur = Math.ceil(durationMin / 5) * 5;
        startIso = localToUTC(entryDate, startTime, tripTimezone);
        const startDt = new Date(startIso);
        endIso = new Date(startDt.getTime() + blockDur * 60000).toISOString();
      } else {
        startIso = localToUTC(entryDate, startTime, tripTimezone);
        endIso = localToUTC(entryDate, endTime, tripTimezone);
      }

      let entryId: string;
      if (isEditing && editEntry) {
        const { error } = await supabase.from('entries').update({ start_time: startIso, end_time: endIso }).eq('id', editEntry.id);
        if (error) throw error;
        entryId = editEntry.id;
      } else {
        const { data: d, error } = await supabase.from('entries').insert({ trip_id: tripId, start_time: startIso, end_time: endIso }).select('id').single();
        if (error) throw error;
        entryId = d.id;
      }

      const cat = allCategories.find(c => c.id === categoryId);
      const optionPayload: any = {
        entry_id: entryId, name: name.trim(), website: isTransfer ? null : (website.trim() || null),
        category: cat ? cat.id : null, category_color: cat?.color ?? null,
        location_name: locationName.trim() || null, latitude, longitude,
        departure_location: isFlight ? (departureLocation.trim() || null) : isTransfer ? (transferFrom.trim() || null) : null,
        arrival_location: isFlight ? (arrivalLocation.trim() || null) : isTransfer ? (transferTo.trim() || null) : null,
        departure_tz: isFlight ? departureTz : null, arrival_tz: isFlight ? arrivalTz : null,
        departure_terminal: isFlight ? (departureTerminal.trim() || null) : null,
        arrival_terminal: isFlight ? (arrivalTerminal.trim() || null) : null,
        airport_checkin_hours: isFlight ? checkinHours : null,
        airport_checkout_min: isFlight ? checkoutMin : null,
        route_polyline: isTransfer ? (selectedPolyline || null) : null,
        distance_km: isTransfer ? (transportResults.find(r => r.mode === transferMode)?.distance_km ?? null) : null,
      };

      let optionId: string | null = null;
      if (isEditing && editOption) {
        const { error } = await supabase.from('entry_options').update(optionPayload).eq('id', editOption.id);
        if (error) throw error;
        optionId = editOption.id;
      } else {
        const { data: optData, error } = await supabase.from('entry_options').insert(optionPayload).select('id').single();
        if (error) throw error;
        optionId = optData.id;
      }

      // Upload auto-fetched photos
      if (optionId && autoPhotos.length > 0 && !isEditing) {
        for (let i = 0; i < autoPhotos.length; i++) {
          try {
            const res = await fetch(autoPhotos[i]);
            if (!res.ok) continue;
            const blob = await res.blob();
            const path = `${optionId}/${Date.now()}_${i}.jpg`;
            const { error: uploadErr } = await supabase.storage.from('trip-images').upload(path, blob, { upsert: false });
            if (uploadErr) continue;
            const { data: urlData } = supabase.storage.from('trip-images').getPublicUrl(path);
            await supabase.from('option_images').insert({ option_id: optionId, image_url: urlData.publicUrl, sort_order: i });
          } catch {}
        }
      }

      // Auto-create airport processing entries for new flights
      if (isFlight && !isEditing && checkinHours > 0) {
        const checkinEnd = new Date(startIso);
        const checkinStart = new Date(checkinEnd.getTime() - checkinHours * 60 * 60 * 1000);
        const { data: checkinEntry } = await supabase.from('entries')
          .insert({ trip_id: tripId, start_time: checkinStart.toISOString(), end_time: checkinEnd.toISOString(), is_locked: true, linked_flight_id: entryId, linked_type: 'checkin' } as any)
          .select('id').single();
        if (checkinEntry) {
          await supabase.from('entry_options').insert({ entry_id: checkinEntry.id, name: 'Airport Check-in', category: 'airport_processing', category_color: 'hsl(210, 50%, 60%)', location_name: departureLocation.split(' - ')[0] || null } as any);
        }
      }
      if (isFlight && !isEditing && checkoutMin > 0) {
        const checkoutStart = new Date(endIso);
        const checkoutEnd = new Date(checkoutStart.getTime() + checkoutMin * 60 * 1000);
        const { data: checkoutEntry } = await supabase.from('entries')
          .insert({ trip_id: tripId, start_time: checkoutStart.toISOString(), end_time: checkoutEnd.toISOString(), is_locked: true, linked_flight_id: entryId, linked_type: 'checkout' } as any)
          .select('id').single();
        if (checkoutEntry) {
          await supabase.from('entry_options').insert({ entry_id: checkoutEntry.id, name: 'Airport Checkout', category: 'airport_processing', category_color: 'hsl(210, 50%, 60%)', location_name: arrivalLocation.split(' - ')[0] || null } as any);
        }
      }

      if (isFlight && isUndated && !isEditing && date) {
        await autoDetectTripDates(date, Number(selectedDay));
      }

      onSaved();
      handleClose(false);
      toast({ title: isEditing ? 'Entry updated!' : 'Entry created!' });

      if (isFlight && !isEditing && !isReturnFlight) {
        setReturnFlightData({
          departureLocation: arrivalLocation, arrivalLocation: departureLocation,
          departureTz: arrivalTz, arrivalTz: departureTz,
          departureTerminal: '', arrivalTerminal: '',
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
    const [h, m] = newStart.split(':').map(Number);
    const endTotalMin = h * 60 + m + durationMin;
    const endH = Math.floor(endTotalMin / 60) % 24;
    const endM = endTotalMin % 60;
    setEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
  };

  // ─── View mode helpers ───

  const handleToggleLock = async () => {
    if (!entry) return;
    setToggling(true);
    try {
      const { error } = await supabase.from('entries').update({ is_locked: !entry.is_locked } as any).eq('id', entry.id);
      if (error) throw error;
      toast({ title: entry.is_locked ? 'Entry unlocked' : 'Entry locked' });
      onSaved();
    } catch (err: any) {
      toast({ title: 'Failed to toggle lock', description: err.message, variant: 'destructive' });
    } finally { setToggling(false); }
  };

  const handleInlineSaveOption = async (field: string, value: string) => {
    if (!option) return;
    const { error } = await supabase.from('entry_options').update({ [field]: value || null } as any).eq('id', option.id);
    if (error) { toast({ title: 'Failed to save', variant: 'destructive' }); return; }
    onSaved();
  };

  // Save flight departure/arrival time and cascade to linked checkin/checkout
  const handleFlightTimeSave = async (type: 'departure' | 'arrival', newTimeStr: string) => {
    if (!entry || !option) return;
    const tz = type === 'departure' ? (option.departure_tz || tripTimezone) : (option.arrival_tz || tripTimezone);

    // Parse the new HH:MM in the relevant timezone and build a full ISO timestamp
    const currentISO = type === 'departure' ? entry.start_time : entry.end_time;
    const currentDate = new Date(currentISO);
    // Get the date part in the relevant timezone
    const datePart = currentDate.toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
    const utcISO = localToUTC(datePart, newTimeStr, tz);

    // Update the entry's start_time or end_time
    const updateField = type === 'departure' ? 'start_time' : 'end_time';
    const { error } = await supabase.from('entries').update({ [updateField]: utcISO } as any).eq('id', entry.id);
    if (error) { toast({ title: 'Failed to save time', variant: 'destructive' }); return; }

    // Cascade to linked entries
    const checkinHrs = option.airport_checkin_hours ?? defaultCheckinHours;
    const checkoutMins = option.airport_checkout_min ?? defaultCheckoutMin;

    const { data: linkedEntries } = await supabase
      .from('entries')
      .select('*')
      .eq('linked_flight_id', entry.id);

    if (linkedEntries) {
      for (const linked of linkedEntries) {
        if (linked.linked_type === 'checkin' && type === 'departure') {
          // Checkin ends at departure, starts checkinHrs before
          const depMs = new Date(utcISO).getTime();
          const checkinStart = new Date(depMs - checkinHrs * 3600000).toISOString();
          await supabase.from('entries').update({
            start_time: checkinStart,
            end_time: utcISO,
          } as any).eq('id', linked.id);
        }
        if (linked.linked_type === 'checkout' && type === 'arrival') {
          // Checkout starts at arrival, ends checkoutMins after
          const arrMs = new Date(utcISO).getTime();
          const checkoutEnd = new Date(arrMs + checkoutMins * 60000).toISOString();
          await supabase.from('entries').update({
            start_time: utcISO,
            end_time: checkoutEnd,
          } as any).eq('id', linked.id);
        }
      }
    }

    toast({ title: `${type === 'departure' ? 'Departure' : 'Arrival'} time updated` });
    onSaved();
  };

  const handleInlineSaveEntry = async (field: string, value: string) => {
    if (!entry) return;
    const { error } = await supabase.from('entries').update({ [field]: value } as any).eq('id', entry.id);
    if (error) { toast({ title: 'Failed to save', variant: 'destructive' }); return; }
    onSaved();
  };

  // ─── Render ───

  const stepTitle = step === 'category'
    ? 'What are you planning?'
    : (isFlight ? '✈️ Flight Details' : isTransfer ? '🚐 Transfer Details' : `${selectedCategory?.emoji ?? '📌'} Details`);

  // ─── VIEW MODE ───
  if (mode === 'view') {
    if (!entry || !option) return null;

    const distance = userLat != null && userLng != null && option.latitude != null && option.longitude != null
      ? haversineKm(userLat, userLng, option.latitude, option.longitude) : null;
    const hasVoted = userVotes.includes(option.id);
    const images = option.images ?? [];
    const isLocked = entry.is_locked;
    const isFlightView = option.category === 'flight' && option.departure_tz && option.arrival_tz;
    const flightDurationMin = isFlightView ? Math.round((new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / 60000) : 0;
    const flightHours = Math.floor(flightDurationMin / 60);
    const flightMins = flightDurationMin % 60;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <div className="space-y-4">
            <DialogHeader className="text-left">
              {option.category && (
                <Badge
                  className="w-fit gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider"
                  style={option.category_color ? { backgroundColor: option.category_color, color: '#fff' } : undefined}
                >
                  {isFlightView && <Plane className="h-3 w-3" />}
                  {option.category}
                </Badge>
              )}
              <DialogTitle className="font-display text-xl">
                <InlineField
                  value={option.name}
                  canEdit={isEditor}
                  onSave={async (v) => handleInlineSaveOption('name', v)}
                  placeholder="Entry name"
                />
              </DialogTitle>
            </DialogHeader>

            {/* Flight layout */}
            {isFlightView ? (
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 text-left space-y-0.5">
                    <InlineField
                      value={option.departure_location || 'Departure'}
                      canEdit={isEditor}
                      onSave={async (v) => handleInlineSaveOption('departure_location', v)}
                      renderDisplay={(val) => <p className="text-sm font-bold text-foreground">{val}</p>}
                    />
                    {option.departure_terminal && (
                      <InlineField
                        value={option.departure_terminal}
                        canEdit={isEditor}
                        onSave={async (v) => handleInlineSaveOption('departure_terminal', v)}
                        renderDisplay={(val) => <p className="text-xs text-muted-foreground">{val}</p>}
                        placeholder="Terminal"
                      />
                    )}
                    <InlineField
                      value={formatTimeInTz(entry.start_time, option.departure_tz!)}
                      canEdit={isEditor}
                      onSave={async (v) => handleFlightTimeSave('departure', v)}
                      inputType="time"
                      renderDisplay={(val) => <p className="text-lg font-semibold text-foreground">{val}</p>}
                    />
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">
                      {getTzAbbr(option.departure_tz!)}
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <Plane className="h-4 w-4 text-muted-foreground" />
                    <div className="h-px w-12 bg-border" />
                    <span className="text-[10px] text-muted-foreground">
                      {flightHours > 0 ? `${flightHours}h ` : ''}{flightMins}m
                    </span>
                  </div>
                  <div className="flex-1 text-right space-y-0.5">
                    <InlineField
                      value={option.arrival_location || 'Arrival'}
                      canEdit={isEditor}
                      onSave={async (v) => handleInlineSaveOption('arrival_location', v)}
                      renderDisplay={(val) => <p className="text-sm font-bold text-foreground">{val}</p>}
                    />
                    {option.arrival_terminal && (
                      <InlineField
                        value={option.arrival_terminal}
                        canEdit={isEditor}
                        onSave={async (v) => handleInlineSaveOption('arrival_terminal', v)}
                        renderDisplay={(val) => <p className="text-xs text-muted-foreground">{val}</p>}
                        placeholder="Terminal"
                      />
                    )}
                    <InlineField
                      value={formatTimeInTz(entry.end_time, option.arrival_tz!)}
                      canEdit={isEditor}
                      onSave={async (v) => handleFlightTimeSave('arrival', v)}
                      inputType="time"
                      renderDisplay={(val) => <p className="text-lg font-semibold text-foreground">{val}</p>}
                    />
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">
                      {getTzAbbr(option.arrival_tz!)}
                    </p>
                  </div>
                </div>
                {isLocked && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" /> Locked
                  </div>
                )}
              </div>
            ) : option.category === 'transfer' ? (
              <>
                {/* Transport mode-centric header */}
                {(() => {
                  const lower = option.name.toLowerCase();
                  let modeEmoji = '🚆', modeLabel = 'Transport';
                  if (lower.startsWith('walk')) { modeEmoji = '🚶'; modeLabel = 'Walking'; }
                  else if (lower.startsWith('transit')) { modeEmoji = '🚌'; modeLabel = 'Transit'; }
                  else if (lower.startsWith('drive')) { modeEmoji = '🚗'; modeLabel = 'Driving'; }
                  else if (lower.startsWith('cycle')) { modeEmoji = '🚲'; modeLabel = 'Cycling'; }

                  const totalMin = Math.round((new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / 60000);
                  const h = Math.floor(totalMin / 60);
                  const m = totalMin % 60;
                  const durationStr = h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}` : `${m}m`;

                  // Contingency: block is rounded to 5min, real is < block
                  const blockDur = totalMin;
                  const realDur = Math.floor(blockDur / 5) * 5 === blockDur ? blockDur : blockDur;
                  const contingency = blockDur % 5 === 0 && blockDur > 0 ? blockDur - (blockDur - (blockDur % 5 || 5)) : 0;

                  return (
                    <div className="space-y-4">
                      {/* Mode header */}
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{modeEmoji}</span>
                        <div>
                          <p className="text-lg font-bold text-foreground">{modeLabel}</p>
                          <p className="text-sm text-muted-foreground">{option.name}</p>
                        </div>
                      </div>

                      {/* From / To */}
                      {(option.departure_location || option.arrival_location) && (
                        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                          <div className="space-y-1.5">
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-semibold text-muted-foreground w-10 shrink-0 pt-0.5">From</span>
                              <span className="text-sm font-medium text-foreground">{option.departure_location || '—'}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-semibold text-muted-foreground w-10 shrink-0 pt-0.5">To</span>
                              <span className="text-sm font-medium text-foreground">{option.arrival_location || '—'}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Duration & distance */}
                      <div className="flex items-center gap-3">
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{durationStr}</span>
                        {(option as any).distance_km != null && (
                          <span className="text-sm text-muted-foreground">
                            {(option as any).distance_km < 1
                              ? `${Math.round((option as any).distance_km * 1000)}m`
                              : `${Number((option as any).distance_km).toFixed(1)}km`}
                          </span>
                        )}
                        {contingency > 0 && (
                          <span className="text-xs text-muted-foreground">+{contingency}m contingency</span>
                        )}
                      </div>

                      {/* Route map */}
                      {(option as any).route_polyline && (
                        <RouteMapPreview
                          polyline={(option as any).route_polyline}
                          fromAddress={option.departure_location || ''}
                          toAddress={option.arrival_location || ''}
                          travelMode={modeLabel.toLowerCase()}
                          size="full"
                        />
                      )}

                      {/* Time (de-emphasized) */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{formatTimeProp?.(entry.start_time) ?? ''} — {formatTimeProp?.(entry.end_time) ?? ''}</span>
                      </div>

                      {isLocked && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Lock className="h-3 w-3" /> Locked
                        </div>
                      )}

                      {/* Mode switcher / refresh in view */}
                      {isEditor && option.departure_location && option.arrival_location && (
                        <div className="space-y-2 pt-2 border-t border-border/50">
                          <Button variant="outline" size="sm" className="w-full text-xs" onClick={async () => {
                            setViewRefreshing(true);
                            try {
                              const { data: rData, error: rError } = await supabase.functions.invoke('google-directions', {
                                body: {
                                  fromAddress: option.departure_location,
                                  toAddress: option.arrival_location,
                                  modes: ['walk', 'transit', 'drive', 'bicycle'],
                                  departureTime: entry.start_time,
                                },
                              });
                              if (rError) throw rError;
                              setViewResults(rData?.results ?? []);
                              const currentLower = option.name.toLowerCase();
                              let cm = 'transit';
                              if (currentLower.startsWith('walk')) cm = 'walk';
                              else if (currentLower.startsWith('drive')) cm = 'drive';
                              else if (currentLower.startsWith('cycle')) cm = 'bicycle';
                              setViewSelectedMode(cm);
                            } catch (err) {
                              console.error('View refresh failed:', err);
                            } finally {
                              setViewRefreshing(false);
                            }
                          }} disabled={viewRefreshing}>
                            {viewRefreshing ? <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Refreshing…</> : <><RefreshCw className="mr-1.5 h-3 w-3" /> Refresh routes</>}
                          </Button>
                          {viewResults.length > 0 && (
                            <div className="space-y-1.5">
                              {viewResults.map(r => {
                                const fmtDur = (min: number) => { const hh = Math.floor(min / 60); const mm = min % 60; if (hh === 0) return `${mm}m`; if (mm === 0) return `${hh}h`; return `${hh}h ${mm}m`; };
                                const modeEmojiMap: Record<string, string> = { walk: '🚶', transit: '🚌', drive: '🚗', bicycle: '🚲' };
                                const modeLabelMap: Record<string, string> = { walk: 'Walk', transit: 'Transit', drive: 'Drive', bicycle: 'Cycle' };
                                return (
                                  <button key={r.mode} onClick={async () => {
                                    setViewSelectedMode(r.mode);
                                    setViewApplying(true);
                                    try {
                                      const blockDur = Math.ceil(r.duration_min / 5) * 5;
                                      const newEnd = new Date(new Date(entry.start_time).getTime() + blockDur * 60000).toISOString();
                                      const toShort = (option.arrival_location || '').split(',')[0].trim();
                                      const newName = `${modeLabelMap[r.mode] || r.mode} to ${toShort}`;
                                      await supabase.from('entries').update({ end_time: newEnd }).eq('id', entry.id);
                                      await supabase.from('entry_options').update({ distance_km: r.distance_km, route_polyline: r.polyline ?? null, name: newName } as any).eq('id', option.id);
                                      setViewResults([]);
                                      onSaved();
                                    } catch (err) { console.error('Apply mode failed:', err); } finally { setViewApplying(false); }
                                  }}
                                    className={cn(
                                      'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors',
                                      viewSelectedMode === r.mode ? 'bg-orange-100 dark:bg-orange-900/30 font-medium' : 'hover:bg-muted'
                                    )}
                                    disabled={viewApplying}
                                  >
                                    <span className="text-base">{modeEmojiMap[r.mode] ?? '🚌'}</span>
                                    <span className="flex-1 text-left">{modeLabelMap[r.mode] ?? r.mode}</span>
                                    <span className="text-xs text-muted-foreground">{fmtDur(r.duration_min)} · {r.distance_km < 1 ? `${Math.round(r.distance_km * 1000)}m` : `${r.distance_km.toFixed(1)}km`}</span>
                                    {viewSelectedMode === r.mode && <Check className="h-3.5 w-3.5 text-orange-500" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            ) : (
              <>
                {/* Generic time (inline-editable) */}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{formatTimeProp?.(entry.start_time) ?? ''} — {formatTimeProp?.(entry.end_time) ?? ''}</span>
                  {isLocked && <Lock className="ml-1 h-3.5 w-3.5 text-muted-foreground/60" />}
                </div>
              </>
            )}

            {/* Distance */}
            {distance !== null && (
              <p className="text-sm text-muted-foreground">
                📍 {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`} away
              </p>
            )}

            {/* Website (hidden for transport) */}
            {option.category !== 'transfer' && (option.website || isEditor) && (
              <InlineField
                value={option.website || ''}
                canEdit={isEditor}
                onSave={async (v) => handleInlineSaveOption('website', v)}
                renderDisplay={(val) =>
                  val ? (
                    <a href={val} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline" onClick={e => e.stopPropagation()}>
                      <ExternalLink className="h-3.5 w-3.5" /> Visit website
                    </a>
                  ) : <span className="text-sm text-muted-foreground italic">Add website</span>
                }
                placeholder="https://..."
              />
            )}

            {/* Map */}
            {option.latitude != null && option.longitude != null && (
              <MapPreview latitude={option.latitude} longitude={option.longitude} locationName={option.location_name} />
            )}

            {/* Vote (hidden for transport & flights) */}
            {currentUser && option.category !== 'transfer' && option.category !== 'flight' && (
              <div className="flex items-center gap-3">
                <VoteButton
                  optionId={option.id}
                  userId={currentUser.id}
                  voteCount={option.vote_count ?? 0}
                  hasVoted={hasVoted}
                  locked={votingLocked ?? false}
                  onVoteChange={onVoteChange ?? (() => {})}
                />
              </div>
            )}

            {/* Images */}
            {images.length > 0 && (
              <div className="pt-2">
                <ImageGallery images={images} />
              </div>
            )}

            {isEditor && (
              <ImageUploader optionId={option.id} currentCount={images.length} onUploaded={onSaved} />
            )}

            {/* Editor actions */}
            {isEditor && (
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <Button variant="outline" size="sm" onClick={handleToggleLock} disabled={toggling}>
                  {isLocked ? <><Unlock className="mr-1.5 h-3.5 w-3.5" /> Unlock</> : <><Lock className="mr-1.5 h-3.5 w-3.5" /> Lock</>}
                </Button>

                {onMoveToIdeas && (
                  <Button variant="outline" size="sm" onClick={() => onMoveToIdeas(entry.id)}>
                    <Lightbulb className="mr-1.5 h-3.5 w-3.5" /> Move to ideas
                  </Button>
                )}

                <AlertDialog>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleting(true)}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                  </Button>
                </AlertDialog>
              </div>
            )}

            {/* Delete confirmation */}
            <AlertDialog open={deleting} onOpenChange={setDeleting}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently delete the entry and all its options. This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={async () => {
                      try {
                        const { error } = await supabase.from('entries').delete().eq('id', entry.id);
                        if (error) throw error;
                        toast({ title: 'Entry deleted' });
                        onOpenChange(false);
                        onSaved();
                      } catch (err: any) {
                        toast({ title: 'Failed to delete', description: err.message, variant: 'destructive' });
                      } finally { setDeleting(false); }
                    }}
                  >Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
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
            <DialogTitle className="font-display">{stepTitle}</DialogTitle>
          </DialogHeader>

          {step === 'category' && (
            <div className="grid grid-cols-3 gap-2">
              {allCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategorySelect(cat.id)}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-3 text-center transition-all hover:border-primary hover:bg-primary/5"
                >
                  <span className="text-2xl">{cat.emoji}</span>
                  <span className="text-xs font-medium">{cat.name}</span>
                </button>
              ))}
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
                    {isFlight
                      ? `Duration: ${durationMin >= 60 ? `${Math.floor(durationMin / 60)}h${durationMin % 60 ? ` ${durationMin % 60}m` : ''}` : `${durationMin}m`}`
                      : `Suggested: ${startTime} – ${endTime} (${durationMin >= 60 ? `${Math.floor(durationMin / 60)}h${durationMin % 60 ? ` ${durationMin % 60}m` : ''}` : `${durationMin}m`})`
                    }
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

              {!isFlight && (
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
                    {isTransfer && (
                      <Button variant="outline" size="sm" className="mt-6" onClick={calcTransferDuration} disabled={calcLoading}>
                        {calcLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Calculate'}
                      </Button>
                    )}
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

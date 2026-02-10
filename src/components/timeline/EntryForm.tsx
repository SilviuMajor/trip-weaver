import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { addDays, format, parseISO } from 'date-fns';
import { utcToLocal } from '@/lib/timezoneUtils';
import { PREDEFINED_CATEGORIES, TRAVEL_MODES, type CategoryDef } from '@/lib/categories';
import type { Trip, EntryWithOptions, EntryOption, CategoryPreset } from '@/types/trip';
import { localToUTC } from '@/lib/timezoneUtils';
import AirportPicker from './AirportPicker';
import type { Airport } from '@/lib/airports';
import AIRPORTS from '@/lib/airports';
import { Loader2, Upload, Check } from 'lucide-react';
import PlacesAutocomplete, { type PlaceDetails } from './PlacesAutocomplete';
import PhotoStripPicker from './PhotoStripPicker';
import { cn } from '@/lib/utils';

const REFERENCE_DATE = '2099-01-01';

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
}

interface EntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  onCreated: () => void;
  trip?: Trip | null;
  editEntry?: EntryWithOptions | null;
  editOption?: EntryOption | null;
  prefillStartTime?: string;
  prefillEndTime?: string;
  prefillCategory?: string;
  transportContext?: { fromAddress: string; toAddress: string } | null;
}

type Step = 'category' | 'details';

const EntryForm = ({ open, onOpenChange, tripId, onCreated, trip, editEntry, editOption, prefillStartTime, prefillEndTime, prefillCategory, transportContext }: EntryFormProps) => {
  const [step, setStep] = useState<Step>('category');
  const [saving, setSaving] = useState(false);

  // Transport route results (for gap-button flow)
  const [transportResults, setTransportResults] = useState<TransportResult[]>([]);
  const [transportLoading, setTransportLoading] = useState(false);
  const transportFetchedRef = useRef(false);

  // Flight booking upload
  const [flightParseLoading, setFlightParseLoading] = useState(false);
  const [parsedFlights, setParsedFlights] = useState<any[]>([]);
  const flightFileRef = useRef<HTMLInputElement>(null);

  // Step 1: Category
  const [categoryId, setCategoryId] = useState('');

  // Step 2: Details
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [locationName, setLocationName] = useState('');

  // Google Places auto-fill
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [autoPhotos, setAutoPhotos] = useState<string[]>([]);

  // Flight-specific
  const [departureLocation, setDepartureLocation] = useState('');
  const [arrivalLocation, setArrivalLocation] = useState('');
  const [departureTz, setDepartureTz] = useState('Europe/London');
  const [arrivalTz, setArrivalTz] = useState('Europe/Amsterdam');
  const [departureTerminal, setDepartureTerminal] = useState('');
  const [arrivalTerminal, setArrivalTerminal] = useState('');
  const [checkinHours, setCheckinHours] = useState(2);
  const [checkoutMin, setCheckoutMin] = useState(30);

  // Transfer-specific
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferMode, setTransferMode] = useState('transit');
  const [calcLoading, setCalcLoading] = useState(false);

  // Step 3: When
  const [date, setDate] = useState('');
  const [selectedDay, setSelectedDay] = useState('0');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [durationMin, setDurationMin] = useState(60);

  // Return flight prompt
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

  // Pre-fill when editing
  useEffect(() => {
    if (editEntry && open) {
      const startDt = parseISO(editEntry.start_time);
      const { date: sDate, time: sTime } = utcToLocal(editEntry.start_time, tripTimezone);
      const { time: eTime } = utcToLocal(editEntry.end_time, tripTimezone);
      setDate(sDate);
      setStartTime(sTime);
      setEndTime(eTime);

      if (isUndated) {
        const refDate = parseISO(REFERENCE_DATE);
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
        // For transfer: reuse departure/arrival as from/to
        if (editOption.category === 'transfer') {
          setTransferFrom(editOption.departure_location ?? '');
          setTransferTo(editOption.arrival_location ?? '');
        }
        setStep('details');
      }
    }
  }, [editEntry, editOption, open, isUndated]);

  // Pre-fill start time from prop
  useEffect(() => {
    if (prefillStartTime && open && !editEntry) {
      const { date: d, time: t } = utcToLocal(prefillStartTime, tripTimezone);
      setStartTime(t);
      if (!isUndated) {
        setDate(d);
      }
    }
  }, [prefillStartTime, open, editEntry, isUndated, tripTimezone]);

  // Pre-fill end time from prop (drag-to-create)
  useEffect(() => {
    if (prefillEndTime && open && !editEntry) {
      const { time: eT } = utcToLocal(prefillEndTime, tripTimezone);
      setEndTime(eT);
      // Calculate duration from prefilled times
      if (prefillStartTime) {
        const startDt = new Date(prefillStartTime);
        const endDt = new Date(prefillEndTime);
        const diffMin = Math.round((endDt.getTime() - startDt.getTime()) / 60000);
        if (diffMin > 0) setDurationMin(diffMin);
      }
    }
  }, [prefillEndTime, prefillStartTime, open, editEntry, tripTimezone]);

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

  // Pre-fill category from sidebar "+" button
  useEffect(() => {
    if (prefillCategory && open && !editEntry) {
      const cat = allCategories.find(c => c.id === prefillCategory);
      if (cat) {
        setCategoryId(prefillCategory);
        applySmartDefaults(cat);
        setStep('details');
      }
    }
  }, [prefillCategory, open, editEntry, applySmartDefaults, allCategories]);

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
    transportFetchedRef.current = false;
    setParsedFlights([]);
    setFlightParseLoading(false);
  };

  // --- Transport gap-button: auto-fill from/to and fetch all routes ---
  const fetchAllRoutes = useCallback(async (from: string, to: string) => {
    setTransportLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-directions', {
        body: { fromAddress: from, toAddress: to, modes: ['walk', 'transit', 'drive', 'bicycle'] },
      });
      if (!error && data?.results) {
        setTransportResults(data.results);
        // Auto-select fastest
        const fastest = data.results.reduce((a: TransportResult, b: TransportResult) =>
          a.duration_min < b.duration_min ? a : b
        );
        setTransferMode(fastest.mode);
        setDurationMin(fastest.duration_min);
        // Update end time
        const [h, m] = startTime.split(':').map(Number);
        const endTotalMin = h * 60 + m + fastest.duration_min;
        const endH = Math.floor(endTotalMin / 60) % 24;
        const endM = endTotalMin % 60;
        setEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
        // Auto-generate name
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
    if (transportContext && open && !transportFetchedRef.current && categoryId === 'transfer') {
      transportFetchedRef.current = true;
      setTransferFrom(transportContext.fromAddress);
      setTransferTo(transportContext.toAddress);
      fetchAllRoutes(transportContext.fromAddress, transportContext.toAddress);
    }
  }, [transportContext, open, categoryId, fetchAllRoutes]);

  // When user selects a different transport mode from inline results
  const handleSelectTransportMode = (result: TransportResult) => {
    setTransferMode(result.mode);
    setDurationMin(result.duration_min);
    const [h, m] = startTime.split(':').map(Number);
    const endTotalMin = h * 60 + m + result.duration_min;
    const endH = Math.floor(endTotalMin / 60) % 24;
    const endM = endTotalMin % 60;
    setEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
    const modeLabels: Record<string, string> = { walk: 'Walk', transit: 'Transit', drive: 'Drive', bicycle: 'Cycle' };
    const toShort = transferTo.split(',')[0].trim();
    setName(`${modeLabels[result.mode] || result.mode} to ${toShort}`);
  };

  // --- Flight booking upload ---
  const handleFlightFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFlightParseLoading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // strip data: prefix
        };
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

    // Look up airports by IATA code
    if (flight.departure_airport) {
      const apt = AIRPORTS.find(a => a.iata === flight.departure_airport.toUpperCase());
      if (apt) {
        setDepartureLocation(`${apt.iata} - ${apt.name}`);
        setDepartureTz(apt.timezone);
      } else {
        setDepartureLocation(flight.departure_airport);
      }
    }
    if (flight.arrival_airport) {
      const apt = AIRPORTS.find(a => a.iata === flight.arrival_airport.toUpperCase());
      if (apt) {
        setArrivalLocation(`${apt.iata} - ${apt.name}`);
        setArrivalTz(apt.timezone);
      } else {
        setArrivalLocation(flight.arrival_airport);
      }
    }
    if (flight.date) setDate(flight.date);

    // Recalc duration
    if (flight.departure_time && flight.arrival_time) {
      const entryDate = flight.date || '2099-01-01';
      const dTz = flight.departure_airport ? (AIRPORTS.find(a => a.iata === flight.departure_airport.toUpperCase())?.timezone || departureTz) : departureTz;
      const aTz = flight.arrival_airport ? (AIRPORTS.find(a => a.iata === flight.arrival_airport.toUpperCase())?.timezone || arrivalTz) : arrivalTz;
      calcFlightDuration(flight.departure_time, flight.arrival_time, dTz, aTz, entryDate);
    }

    setParsedFlights([]);
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleCategorySelect = (catId: string) => {
    setCategoryId(catId);
    const cat = allCategories.find(c => c.id === catId);
    if (cat) applySmartDefaults(cat);
    setStep('details');
  };

  // handleDetailsNext removed -- when step is merged into details

  // Auto-calculate flight duration
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

  // Airport selection handlers
  const handleDepartureAirportChange = (airport: Airport) => {
    setDepartureLocation(`${airport.iata} - ${airport.name}`);
    setDepartureTz(airport.timezone);
  };

  const handleArrivalAirportChange = (airport: Airport) => {
    setArrivalLocation(`${airport.iata} - ${airport.name}`);
    setArrivalTz(airport.timezone);
  };

  // Calculate transfer duration via Google Directions
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

  // Auto-detect trip dates from flight
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
        for (const entry of allEntries) {
          const entryStart = new Date(entry.start_time);
          const refBase = new Date('2099-01-01T00:00:00Z');
          const entryDayOffset = Math.round((entryStart.getTime() - refBase.getTime()) / (1000 * 60 * 60 * 24));

          if (entryDayOffset >= 0 && entryDayOffset < 365) {
            const realDate = addDays(startDate, entryDayOffset);
            const entryEnd = new Date(entry.end_time);
            const startTimeStr = format(entryStart, 'HH:mm:ss');
            const endTimeStr = format(entryEnd, 'HH:mm:ss');
            const newStart = `${format(realDate, 'yyyy-MM-dd')}T${startTimeStr}Z`;
            const newEnd = `${format(realDate, 'yyyy-MM-dd')}T${endTimeStr}Z`;

            await supabase.from('entries').update({
              start_time: newStart,
              end_time: newEnd,
            }).eq('id', entry.id);
          }
        }
      }

      toast({ title: 'Trip dates set based on your flight! 🎉' });
    } catch (err) {
      console.error('Failed to auto-detect trip dates:', err);
    }
  };

  const handleSaveAsIdea = async () => {
    if (!name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Use a placeholder time for unscheduled entries
      const placeholderDate = isUndated
        ? format(addDays(parseISO(REFERENCE_DATE), Number(selectedDay)), 'yyyy-MM-dd')
        : (date || format(new Date(), 'yyyy-MM-dd'));
      const startIso = localToUTC(placeholderDate, '00:00', tripTimezone);
      const endIso = localToUTC(placeholderDate, '01:00', tripTimezone);

      const scheduledDay = isUndated ? Number(selectedDay) : null;

      const { data, error } = await supabase
        .from('entries')
        .insert({
          trip_id: tripId,
          start_time: startIso,
          end_time: endIso,
          is_scheduled: false,
          scheduled_day: scheduledDay,
        } as any)
        .select('id')
        .single();
      if (error) throw error;

      const cat = allCategories.find(c => c.id === categoryId);
      await supabase.from('entry_options').insert({
        entry_id: data.id,
        name: name.trim(),
        website: website.trim() || null,
        category: cat ? cat.id : null,
        category_color: cat?.color ?? null,
        location_name: locationName.trim() || null,
        departure_location: isFlight ? (departureLocation.trim() || null) : isTransfer ? (transferFrom.trim() || null) : null,
        arrival_location: isFlight ? (arrivalLocation.trim() || null) : isTransfer ? (transferTo.trim() || null) : null,
        departure_tz: isFlight ? departureTz : null,
        arrival_tz: isFlight ? arrivalTz : null,
      } as any);

      onCreated();
      handleClose(false);
      toast({ title: 'Added to ideas panel 💡' });
    } catch (err: any) {
      toast({ title: 'Failed to save', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const entryDate = isUndated
      ? format(addDays(parseISO(REFERENCE_DATE), Number(selectedDay)), 'yyyy-MM-dd')
      : date;

    if (!entryDate) {
      toast({ title: 'Please select a date', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      let startIso: string;
      let endIso: string;

      if (isFlight) {
        startIso = localToUTC(entryDate, startTime, departureTz);
        endIso = localToUTC(entryDate, endTime, arrivalTz);
        if (new Date(endIso) <= new Date(startIso)) {
          const nextDay = format(addDays(parseISO(entryDate), 1), 'yyyy-MM-dd');
          endIso = localToUTC(nextDay, endTime, arrivalTz);
        }
      } else {
        // Fix: convert local time to proper UTC using trip timezone
        startIso = localToUTC(entryDate, startTime, tripTimezone);
        endIso = localToUTC(entryDate, endTime, tripTimezone);
      }

      let entryId: string;

      if (isEditing && editEntry) {
        const { error } = await supabase
          .from('entries')
          .update({ start_time: startIso, end_time: endIso })
          .eq('id', editEntry.id);
        if (error) throw error;
        entryId = editEntry.id;
      } else {
        const { data, error } = await supabase
          .from('entries')
          .insert({ trip_id: tripId, start_time: startIso, end_time: endIso })
          .select('id')
          .single();
        if (error) throw error;
        entryId = data.id;
      }

      const cat = allCategories.find(c => c.id === categoryId);
      const optionPayload: any = {
        entry_id: entryId,
        name: name.trim(),
        website: website.trim() || null,
        category: cat ? cat.id : null,
        category_color: cat?.color ?? null,
        location_name: locationName.trim() || null,
        latitude: latitude,
        longitude: longitude,
        departure_location: isFlight ? (departureLocation.trim() || null) : isTransfer ? (transferFrom.trim() || null) : null,
        arrival_location: isFlight ? (arrivalLocation.trim() || null) : isTransfer ? (transferTo.trim() || null) : null,
        departure_tz: isFlight ? departureTz : null,
        arrival_tz: isFlight ? arrivalTz : null,
        departure_terminal: isFlight ? (departureTerminal.trim() || null) : null,
        arrival_terminal: isFlight ? (arrivalTerminal.trim() || null) : null,
        airport_checkin_hours: isFlight ? checkinHours : null,
        airport_checkout_min: isFlight ? checkoutMin : null,
      };

      let optionId: string | null = null;

      if (isEditing && editOption) {
        const { error } = await supabase
          .from('entry_options')
          .update(optionPayload)
          .eq('id', editOption.id);
        if (error) throw error;
        optionId = editOption.id;
      } else {
        const { data: optData, error } = await supabase
          .from('entry_options')
          .insert(optionPayload)
          .select('id')
          .single();
        if (error) throw error;
        optionId = optData.id;
      }

      // Upload auto-fetched photos
      if (optionId && autoPhotos.length > 0 && !isEditing) {
        const existingCount = 0;
        for (let i = 0; i < autoPhotos.length; i++) {
          try {
            const photoUrl = autoPhotos[i];
            const res = await fetch(photoUrl);
            if (!res.ok) continue;
            const blob = await res.blob();
            const ext = 'jpg';
            const path = `${optionId}/${Date.now()}_${i}.${ext}`;
            const { error: uploadErr } = await supabase.storage
              .from('trip-images')
              .upload(path, blob, { upsert: false });
            if (uploadErr) { console.error('Photo upload:', uploadErr); continue; }
            const { data: urlData } = supabase.storage
              .from('trip-images')
              .getPublicUrl(path);
            await supabase.from('option_images').insert({
              option_id: optionId,
              image_url: urlData.publicUrl,
              sort_order: existingCount + i,
            });
          } catch (err) {
            console.error('Auto-photo upload failed:', err);
          }
        }
      }

      // Auto-create airport processing entries for new flights
      if (isFlight && !isEditing && checkinHours > 0) {
        // Check-in entry: ends at flight departure, starts X hours before
        const checkinEnd = new Date(startIso);
        const checkinStart = new Date(checkinEnd.getTime() - checkinHours * 60 * 60 * 1000);
        const { data: checkinEntry } = await supabase
          .from('entries')
          .insert({
            trip_id: tripId,
            start_time: checkinStart.toISOString(),
            end_time: checkinEnd.toISOString(),
            is_locked: true,
            linked_flight_id: entryId,
            linked_type: 'checkin',
          } as any)
          .select('id')
          .single();
        if (checkinEntry) {
          await supabase.from('entry_options').insert({
            entry_id: checkinEntry.id,
            name: 'Airport Check-in',
            category: 'airport_processing',
            category_color: 'hsl(210, 50%, 60%)',
            location_name: departureLocation.split(' - ')[0] || null,
          } as any);
        }
      }

      if (isFlight && !isEditing && checkoutMin > 0) {
        // Checkout entry: starts at flight arrival, ends Y minutes after
        const checkoutStart = new Date(endIso);
        const checkoutEnd = new Date(checkoutStart.getTime() + checkoutMin * 60 * 1000);
        const { data: checkoutEntry } = await supabase
          .from('entries')
          .insert({
            trip_id: tripId,
            start_time: checkoutStart.toISOString(),
            end_time: checkoutEnd.toISOString(),
            is_locked: true,
            linked_flight_id: entryId,
            linked_type: 'checkout',
          } as any)
          .select('id')
          .single();
        if (checkoutEntry) {
          await supabase.from('entry_options').insert({
            entry_id: checkoutEntry.id,
            name: 'Airport Checkout',
            category: 'airport_processing',
            category_color: 'hsl(210, 50%, 60%)',
            location_name: arrivalLocation.split(' - ')[0] || null,
          } as any);
        }
      }

      // Auto-detect dates from flight on undated trip
      if (isFlight && isUndated && !isEditing && date) {
        await autoDetectTripDates(date, Number(selectedDay));
      }

      onCreated();
      handleClose(false);
      toast({ title: isEditing ? 'Entry updated!' : 'Entry created!' });

      // Prompt return flight for new flights
      if (isFlight && !isEditing && !isReturnFlight) {
        setReturnFlightData({
          departureLocation: arrivalLocation,
          arrivalLocation: departureLocation,
          departureTz: arrivalTz,
          arrivalTz: departureTz,
          departureTerminal: '',
          arrivalTerminal: '',
        });
        setShowReturnPrompt(true);
      }
    } catch (err: any) {
      toast({ title: 'Failed to save entry', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
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
    setWebsite('');
    setLocationName('');
    setTransferFrom('');
    setTransferTo('');
    setDate('');
    setSelectedDay('0');
    const cat = PREDEFINED_CATEGORIES.find(c => c.id === 'flight');
    if (cat) {
      setStartTime(`${String(cat.defaultStartHour).padStart(2, '0')}:${String(cat.defaultStartMin).padStart(2, '0')}`);
      setDurationMin(cat.defaultDurationMin);
      const endTotalMin = cat.defaultStartHour * 60 + cat.defaultStartMin + cat.defaultDurationMin;
      const endH = Math.floor(endTotalMin / 60) % 24;
      const endM = endTotalMin % 60;
      setEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
    }
    setStep('details');
    onOpenChange(true);
    setReturnFlightData(null);
  };

  const handleReturnFlightDecline = () => {
    setShowReturnPrompt(false);
    setReturnFlightData(null);
  };

  // Recalculate end time when start time or duration changes (non-flight)
  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    const [h, m] = newStart.split(':').map(Number);
    const endTotalMin = h * 60 + m + durationMin;
    const endH = Math.floor(endTotalMin / 60) % 24;
    const endM = endTotalMin % 60;
    setEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
  };

  // Get timezone abbreviation for display
  const getTzAbbr = (tz: string): string => {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        timeZoneName: 'short',
      }).formatToParts(new Date());
      return parts.find(p => p.type === 'timeZoneName')?.value ?? tz;
    } catch {
      return tz;
    }
  };

  const stepTitle = step === 'category'
    ? 'What are you planning?'
    : (isFlight ? '✈️ Flight Details' : isTransfer ? '🚐 Transfer Details' : `${selectedCategory?.emoji ?? '📌'} Details`);

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
                  <PlacesAutocomplete
                    value={name}
                    onChange={setName}
                    onPlaceSelect={handlePlaceSelect}
                    placeholder="e.g. Anne Frank House"
                    autoFocus
                  />
                ) : (
                  <Input
                    id="opt-name"
                    placeholder={isFlight ? 'e.g. BA1234' : 'e.g. Airport to Hotel'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                )}
              </div>

              {autoPhotos.length > 0 && !isFlight && !isTransfer && (
                <PhotoStripPicker photos={autoPhotos} onChange={setAutoPhotos} />
              )}

              {isFlight && (
                <>
                  {/* Upload booking button */}
                  <div className="flex items-center gap-2">
                    <input
                      ref={flightFileRef}
                      type="file"
                      accept=".pdf,image/*"
                      className="hidden"
                      onChange={handleFlightFileUpload}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => flightFileRef.current?.click()}
                      disabled={flightParseLoading}
                      className="text-xs"
                    >
                      {flightParseLoading ? (
                        <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Parsing...</>
                      ) : (
                        <><Upload className="mr-1.5 h-3 w-3" /> Upload booking</>
                      )}
                    </Button>
                    <span className="text-[10px] text-muted-foreground">PDF or image</span>
                  </div>

                  {/* Multiple flights selector */}
                  {parsedFlights.length > 1 && (
                    <div className="space-y-1.5 rounded-lg border border-border/50 bg-muted/30 p-2">
                      <p className="text-xs font-medium text-muted-foreground">Select flight</p>
                      {parsedFlights.map((f, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => applyParsedFlight(f)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted transition-colors text-left"
                        >
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
                      <AirportPicker
                        value={departureLocation}
                        onChange={handleDepartureAirportChange}
                        placeholder="Search departure airport..."
                      />
                      {departureTz && (
                        <p className="text-xs text-muted-foreground">
                          Timezone: {getTzAbbr(departureTz)}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Departure Terminal</Label>
                      <Input
                        placeholder="e.g. Terminal 5, T2"
                        value={departureTerminal}
                        onChange={(e) => setDepartureTerminal(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Arrival Airport</Label>
                      <AirportPicker
                        value={arrivalLocation}
                        onChange={handleArrivalAirportChange}
                        placeholder="Search arrival airport..."
                      />
                      {arrivalTz && (
                        <p className="text-xs text-muted-foreground">
                          Timezone: {getTzAbbr(arrivalTz)}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Arrival Terminal</Label>
                      <Input
                        placeholder="e.g. Terminal 1, T3"
                        value={arrivalTerminal}
                        onChange={(e) => setArrivalTerminal(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Airport processing times */}
                  <div className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Airport Processing</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Arrive early (hours)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={6}
                          step={0.5}
                          value={checkinHours}
                          onChange={(e) => setCheckinHours(Math.max(0, Number(e.target.value) || 0))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Checkout (minutes)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={120}
                          step={15}
                          value={checkoutMin}
                          onChange={(e) => setCheckoutMin(Math.max(0, Number(e.target.value) || 0))}
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Auto-creates check-in &amp; checkout blocks on the timeline
                    </p>
                  </div>
                </>
              )}

              {isTransfer && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>From</Label>
                      <Input
                        placeholder="e.g. Heathrow Airport"
                        value={transferFrom}
                        onChange={(e) => setTransferFrom(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>To</Label>
                      <Input
                        placeholder="e.g. Hotel Krasnapolsky"
                        value={transferTo}
                        onChange={(e) => setTransferTo(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Inline route comparison (when auto-fetched from transport gap) */}
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
                              const h = Math.floor(min / 60);
                              const m = min % 60;
                              if (h === 0) return `${m}m`;
                              if (m === 0) return `${h}h`;
                              return `${h}h ${m}m`;
                            };
                            return (
                              <button
                                key={r.mode}
                                type="button"
                                onClick={() => handleSelectTransportMode(r)}
                                className={cn(
                                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors',
                                  transferMode === r.mode
                                    ? 'bg-primary/10 text-primary font-medium'
                                    : 'hover:bg-muted text-foreground'
                                )}
                              >
                                <span className="text-base">{modeEmoji[r.mode] ?? '🚌'}</span>
                                <span className="flex-1 text-left capitalize">{modeLabel[r.mode] ?? r.mode}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDur(r.duration_min)} · {r.distance_km < 1 ? `${Math.round(r.distance_km * 1000)}m` : `${r.distance_km.toFixed(1)}km`}
                                </span>
                                {transferMode === r.mode && <Check className="h-3.5 w-3.5 text-primary" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Manual mode picker (when not from transport gap) */
                    <div className="space-y-2">
                      <Label>Travel mode</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {TRAVEL_MODES.map((mode) => (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => setTransferMode(mode.id)}
                            className={cn(
                              'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all',
                              transferMode === mode.id
                                ? 'border-primary bg-primary/10 text-primary font-medium'
                                : 'border-border bg-background text-muted-foreground hover:border-primary/40'
                            )}
                          >
                            <span className="text-base">{mode.emoji}</span>
                            <span>{mode.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="opt-website">Website</Label>
                <Input
                  id="opt-website"
                  type="url"
                  placeholder="https://..."
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              {!isFlight && !isTransfer && (
                <div className="space-y-2">
                  <Label>Location Name</Label>
                  <Input
                    placeholder="e.g. Dam Square"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                  />
                </div>
              )}

              {/* When section */}
              <div className="border-t border-border/50 pt-4 mt-2">
                <Label className="text-sm font-semibold text-muted-foreground">When</Label>
              </div>

              {/* Day / date picker */}
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
                        <Label htmlFor="flight-real-date" className="text-xs text-muted-foreground">
                          Actual flight date (optional — sets trip dates automatically)
                        </Label>
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

              {/* Time inputs */}
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
                    <Label className="text-xs text-muted-foreground">
                      {isFlight ? `Depart (${getTzAbbr(departureTz)})` : 'Start'}
                    </Label>
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => isFlight ? handleFlightStartChange(e.target.value) : handleStartTimeChange(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {isFlight ? `Arrive (${getTzAbbr(arrivalTz)})` : 'End'}
                    </Label>
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => isFlight ? handleFlightEndChange(e.target.value) : setEndTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Duration override (non-flight only) */}
              {!isFlight && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 space-y-1">
                      <Label>Duration (minutes)</Label>
                      <Input
                        type="number"
                        min={15}
                        step={15}
                        value={durationMin}
                        onChange={(e) => {
                          const d = parseInt(e.target.value) || 60;
                          setDurationMin(d);
                          const [h, m] = startTime.split(':').map(Number);
                          const endTotalMin = h * 60 + m + d;
                          const endH = Math.floor(endTotalMin / 60) % 24;
                          const endM = endTotalMin % 60;
                          setEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
                        }}
                      />
                    </div>
                    {isTransfer && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-6"
                        onClick={calcTransferDuration}
                        disabled={calcLoading}
                      >
                        {calcLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Calculate'}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setStep('category')}>Back</Button>
                <Button
                  variant="secondary"
                  onClick={() => handleSaveAsIdea()}
                  disabled={saving}
                >
                  💡 Ideas
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : (isEditing ? 'Update Entry' : 'Create Entry')}
                </Button>
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
            <AlertDialogDescription>
              Would you like to add a return flight with reversed airports and timezones?
            </AlertDialogDescription>
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

export default EntryForm;

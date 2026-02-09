import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { addDays, format, parseISO } from 'date-fns';
import { PREDEFINED_CATEGORIES, TRAVEL_MODES, type CategoryDef } from '@/lib/categories';
import type { Trip, EntryWithOptions, EntryOption, CategoryPreset } from '@/types/trip';
import { localToUTC } from '@/lib/timezoneUtils';
import AirportPicker from './AirportPicker';
import type { Airport } from '@/lib/airports';
import { Loader2 } from 'lucide-react';

const REFERENCE_DATE = '2099-01-01';

interface ReturnFlightData {
  departureLocation: string;
  arrivalLocation: string;
  departureTz: string;
  arrivalTz: string;
  departureTerminal: string;
  arrivalTerminal: string;
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
}

type Step = 'category' | 'details' | 'when';

const EntryForm = ({ open, onOpenChange, tripId, onCreated, trip, editEntry, editOption, prefillStartTime }: EntryFormProps) => {
  const [step, setStep] = useState<Step>('category');
  const [saving, setSaving] = useState(false);

  // Step 1: Category
  const [categoryId, setCategoryId] = useState('');

  // Step 2: Details
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [locationName, setLocationName] = useState('');

  // Flight-specific
  const [departureLocation, setDepartureLocation] = useState('');
  const [arrivalLocation, setArrivalLocation] = useState('');
  const [departureTz, setDepartureTz] = useState('Europe/London');
  const [arrivalTz, setArrivalTz] = useState('Europe/Amsterdam');
  const [departureTerminal, setDepartureTerminal] = useState('');
  const [arrivalTerminal, setArrivalTerminal] = useState('');

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

  const isUndated = !trip?.start_date;
  const dayCount = trip?.duration_days ?? 3;
  const isEditing = !!editEntry;
  const isFlight = categoryId === 'flight';
  const isTransfer = categoryId === 'transfer';
  const tripTimezone = trip?.timezone ?? 'Europe/Amsterdam';

  const selectedCategory = PREDEFINED_CATEGORIES.find(c => c.id === categoryId);

  const customCategories = (trip?.category_presets as CategoryPreset[] | null) ?? [];
  const allCategories: CategoryDef[] = [
    ...PREDEFINED_CATEGORIES,
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
      const endDt = parseISO(editEntry.end_time);
      setDate(format(startDt, 'yyyy-MM-dd'));
      setStartTime(format(startDt, 'HH:mm'));
      setEndTime(format(endDt, 'HH:mm'));

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
      const dt = new Date(prefillStartTime);
      setStartTime(format(dt, 'HH:mm'));
    }
  }, [prefillStartTime, open, editEntry]);

  const applySmartDefaults = useCallback((cat: CategoryDef) => {
    const h = cat.defaultStartHour;
    const m = cat.defaultStartMin;
    if (prefillStartTime && !isEditing) {
      const dt = new Date(prefillStartTime);
      const pH = dt.getHours();
      const pM = dt.getMinutes();
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
  }, [prefillStartTime, isEditing]);

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

  const handleDetailsNext = () => {
    if (!name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    setStep('when');
  };

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
        latitude: null,
        longitude: null,
        departure_location: isFlight ? (departureLocation.trim() || null) : isTransfer ? (transferFrom.trim() || null) : null,
        arrival_location: isFlight ? (arrivalLocation.trim() || null) : isTransfer ? (transferTo.trim() || null) : null,
        departure_tz: isFlight ? departureTz : null,
        arrival_tz: isFlight ? arrivalTz : null,
        departure_terminal: isFlight ? (departureTerminal.trim() || null) : null,
        arrival_terminal: isFlight ? (arrivalTerminal.trim() || null) : null,
      };

      if (isEditing && editOption) {
        const { error } = await supabase
          .from('entry_options')
          .update(optionPayload)
          .eq('id', editOption.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('entry_options')
          .insert(optionPayload);
        if (error) throw error;
      }

      // Auto-detect dates from flight on undated trip
      if (isFlight && isUndated && !isEditing && date) {
        await autoDetectTripDates(date, Number(selectedDay));
      }

      onCreated();
      handleClose(false);
      toast({ title: isEditing ? 'Entry updated!' : 'Entry created!' });

      // Prompt return flight for new flights
      if (isFlight && !isEditing) {
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
    : step === 'details'
      ? (isFlight ? '✈️ Flight Details' : isTransfer ? '🚐 Transfer Details' : `${selectedCategory?.emoji ?? '📌'} Details`)
      : 'When?';

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
                <Input
                  id="opt-name"
                  placeholder={isFlight ? 'e.g. BA1234' : isTransfer ? 'e.g. Airport to Hotel' : 'e.g. Anne Frank House'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>

              {isFlight && (
                <>
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
                  <div className="space-y-2">
                    <Label>Travel mode</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {TRAVEL_MODES.map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setTransferMode(mode.id)}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                            transferMode === mode.id
                              ? 'border-primary bg-primary/10 text-primary font-medium'
                              : 'border-border bg-background text-muted-foreground hover:border-primary/40'
                          }`}
                        >
                          <span className="text-base">{mode.emoji}</span>
                          <span>{mode.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
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

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setStep('category')}>Back</Button>
                <Button onClick={handleDetailsNext}>Next: When?</Button>
              </DialogFooter>
            </div>
          )}

          {step === 'when' && (
            <div className="space-y-4">
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
                <Button variant="outline" onClick={() => setStep('details')}>Back</Button>
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

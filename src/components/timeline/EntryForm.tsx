import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { addDays, format, parseISO } from 'date-fns';
import { PREDEFINED_CATEGORIES, type CategoryDef } from '@/lib/categories';
import type { Trip, EntryWithOptions, EntryOption, CategoryPreset } from '@/types/trip';

const REFERENCE_DATE = '2099-01-01';

const COMMON_TIMEZONES = [
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)' },
  { value: 'Europe/Rome', label: 'Rome (CET/CEST)' },
  { value: 'Europe/Lisbon', label: 'Lisbon (WET/WEST)' },
  { value: 'Europe/Istanbul', label: 'Istanbul (TRT)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
];

interface EntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  onCreated: () => void;
  trip?: Trip | null;
  editEntry?: EntryWithOptions | null;
  editOption?: EntryOption | null;
}

type Step = 'category' | 'details' | 'when';

const EntryForm = ({ open, onOpenChange, tripId, onCreated, trip, editEntry, editOption }: EntryFormProps) => {
  const [step, setStep] = useState<Step>('category');
  const [saving, setSaving] = useState(false);

  // Step 1: Category
  const [categoryId, setCategoryId] = useState('');

  // Step 2: Details
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  // Flight-specific
  const [departureLocation, setDepartureLocation] = useState('');
  const [arrivalLocation, setArrivalLocation] = useState('');
  const [departureTz, setDepartureTz] = useState('Europe/London');
  const [arrivalTz, setArrivalTz] = useState('Europe/Amsterdam');

  // Step 3: When
  const [date, setDate] = useState('');
  const [selectedDay, setSelectedDay] = useState('0');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [durationMin, setDurationMin] = useState(60);

  const isUndated = !trip?.start_date;
  const dayCount = trip?.duration_days ?? 3;
  const isEditing = !!editEntry;
  const isFlight = categoryId === 'flight';
  const tripTimezone = trip?.timezone ?? 'Europe/Amsterdam';

  const selectedCategory = PREDEFINED_CATEGORIES.find(c => c.id === categoryId);

  // Build custom categories from trip presets
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
        setLatitude(editOption.latitude != null ? String(editOption.latitude) : '');
        setLongitude(editOption.longitude != null ? String(editOption.longitude) : '');
        setDepartureLocation(editOption.departure_location ?? '');
        setArrivalLocation(editOption.arrival_location ?? '');
        setDepartureTz(editOption.departure_tz ?? 'Europe/London');
        setArrivalTz(editOption.arrival_tz ?? 'Europe/Amsterdam');
        // Go to details step for editing
        setStep('details');
      }
    }
  }, [editEntry, editOption, open, isUndated]);

  const applySmartDefaults = useCallback((cat: CategoryDef) => {
    const h = cat.defaultStartHour;
    const m = cat.defaultStartMin;
    setStartTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    setDurationMin(cat.defaultDurationMin);
    const endTotalMin = h * 60 + m + cat.defaultDurationMin;
    const endH = Math.floor(endTotalMin / 60) % 24;
    const endM = endTotalMin % 60;
    setEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
  }, []);

  const reset = () => {
    setStep('category');
    setCategoryId('');
    setName('');
    setWebsite('');
    setLocationName('');
    setLatitude('');
    setLongitude('');
    setDepartureLocation('');
    setArrivalLocation('');
    setDepartureTz('Europe/London');
    setArrivalTz('Europe/Amsterdam');
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
        // Convert local departure/arrival times to UTC using their respective timezones
        startIso = localToUTC(entryDate, startTime, departureTz);
        endIso = localToUTC(entryDate, endTime, arrivalTz);
      } else {
        startIso = `${entryDate}T${startTime}:00+00:00`;
        endIso = `${entryDate}T${endTime}:00+00:00`;
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

      // Save/update the option
      const cat = allCategories.find(c => c.id === categoryId);
      const optionPayload = {
        entry_id: entryId,
        name: name.trim(),
        website: website.trim() || null,
        category: cat ? cat.id : null,
        category_color: cat?.color ?? null,
        location_name: locationName.trim() || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        departure_location: isFlight ? (departureLocation.trim() || null) : null,
        arrival_location: isFlight ? (arrivalLocation.trim() || null) : null,
        departure_tz: isFlight ? departureTz : null,
        arrival_tz: isFlight ? arrivalTz : null,
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

      onCreated();
      handleClose(false);
      toast({ title: isEditing ? 'Entry updated!' : 'Entry created!' });
    } catch (err: any) {
      toast({ title: 'Failed to save entry', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Recalculate end time when start time or duration changes
  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    const [h, m] = newStart.split(':').map(Number);
    const endTotalMin = h * 60 + m + durationMin;
    const endH = Math.floor(endTotalMin / 60) % 24;
    const endM = endTotalMin % 60;
    setEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
  };

  const stepTitle = step === 'category'
    ? 'What are you planning?'
    : step === 'details'
      ? (isFlight ? '✈️ Flight Details' : `${selectedCategory?.emoji ?? '📌'} Details`)
      : 'When?';

  return (
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
            {/* Category badge */}
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
                placeholder={isFlight ? 'e.g. BA1234' : 'e.g. Anne Frank House'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            {isFlight && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>From (airport/city)</Label>
                    <Input
                      placeholder="e.g. LHR"
                      value={departureLocation}
                      onChange={(e) => setDepartureLocation(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>To (airport/city)</Label>
                    <Input
                      placeholder="e.g. AMS"
                      value={arrivalLocation}
                      onChange={(e) => setArrivalLocation(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Departure timezone</Label>
                    <Select value={departureTz} onValueChange={setDepartureTz}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-popover max-h-60">
                        {COMMON_TIMEZONES.map(tz => (
                          <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Arrival timezone</Label>
                    <Select value={arrivalTz} onValueChange={setArrivalTz}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-popover max-h-60">
                        {COMMON_TIMEZONES.map(tz => (
                          <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

            {!isFlight && (
              <>
                <div className="space-y-2">
                  <Label>Location Name</Label>
                  <Input
                    placeholder="e.g. Dam Square"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Latitude</Label>
                    <Input type="number" step="any" placeholder="52.3676" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Longitude</Label>
                    <Input type="number" step="any" placeholder="4.9041" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
                  </div>
                </div>
              </>
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
                </>
              ) : (
                <>
                  <Label htmlFor="entry-date">Date</Label>
                  <Input id="entry-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </>
              )}
            </div>

            {/* Time inputs with smart defaults */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Time</Label>
                <span className="text-xs text-muted-foreground">
                  Suggested: {startTime} – {endTime} ({durationMin >= 60 ? `${Math.floor(durationMin / 60)}h${durationMin % 60 ? ` ${durationMin % 60}m` : ''}` : `${durationMin}m`})
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {isFlight ? 'Depart (local)' : 'Start'}
                  </Label>
                  <Input type="time" value={startTime} onChange={(e) => handleStartTimeChange(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {isFlight ? 'Arrive (local)' : 'End'}
                  </Label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>
              {isFlight && (
                <p className="text-xs text-muted-foreground">
                  Depart in {COMMON_TIMEZONES.find(t => t.value === departureTz)?.label ?? departureTz} · Arrive in {COMMON_TIMEZONES.find(t => t.value === arrivalTz)?.label ?? arrivalTz}
                </p>
              )}
            </div>

            {/* Duration override */}
            <div className="space-y-2">
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
  );
};

/** Convert a local date+time in a specific timezone to a UTC ISO string */
function localToUTC(dateStr: string, timeStr: string, tz: string): string {
  // Create a date string that we'll interpret in the given timezone
  const fakeDate = new Date(`${dateStr}T${timeStr}:00`);
  // Use Intl to find the offset for this timezone at this time
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  // Get the UTC timestamp by calculating the offset
  const utcDate = new Date(`${dateStr}T${timeStr}:00Z`);
  const localInTz = new Date(formatter.format(utcDate).replace(/(\d+)\/(\d+)\/(\d+),?\s*/, '$3-$1-$2T'));
  const offsetMs = localInTz.getTime() - utcDate.getTime();
  const adjustedUtc = new Date(fakeDate.getTime() - offsetMs);
  return adjustedUtc.toISOString();
}

export default EntryForm;

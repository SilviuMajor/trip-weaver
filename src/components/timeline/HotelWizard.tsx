import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, ArrowRight, Building2, CalendarDays, Clock, HotelIcon, Check, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { localToUTC } from '@/lib/timezoneUtils';
import { addDays, parseISO, format } from 'date-fns';
import PlacesAutocomplete, { type PlaceDetails } from './PlacesAutocomplete';
import type { Trip } from '@/types/trip';
import { cn } from '@/lib/utils';

interface HotelData {
  name: string;
  locationName: string;
  lat: number | null;
  lng: number | null;
  website: string | null;
  photos: string[];
  selectedNights: number[];
}

interface HotelWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  trip: Trip;
  onCreated: () => void;
}

const REFERENCE_DATE = '2099-01-01';

const HotelWizard = ({ open, onOpenChange, tripId, trip, onCreated }: HotelWizardProps) => {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Hotel data
  const [hotelName, setHotelName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [website, setWebsite] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);

  // Night selection
  const [selectedNights, setSelectedNights] = useState<number[]>([]);

  // Time settings
  const [eveningReturn, setEveningReturn] = useState('22:00');
  const [morningLeave, setMorningLeave] = useState('08:00');

  // Multi-hotel tracking
  const [allHotels, setAllHotels] = useState<HotelData[]>([]);
  const assignedNights = useMemo(() => {
    const set = new Set<number>();
    allHotels.forEach(h => h.selectedNights.forEach(n => set.add(n)));
    return set;
  }, [allHotels]);

  const isUndated = !trip.start_date;
  const totalDays = isUndated
    ? (trip.duration_days ?? 3)
    : Math.max(1, Math.ceil((new Date(trip.end_date!).getTime() - new Date(trip.start_date!).getTime()) / 86400000) + 1);

  // Last night = totalDays - 1 (can't stay the night OF the last day, only night BEFORE it)
  const nightLabels = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => {
      if (isUndated) {
        return `Night of Day ${i + 1}`;
      }
      const date = addDays(parseISO(trip.start_date!), i);
      return `Night of ${format(date, 'EEE d MMM')}`;
    });
  }, [totalDays, isUndated, trip.start_date]);

  const tripLocation = useMemo(() => {
    if (lat != null && lng != null) return { lat, lng };
    return undefined;
  }, [lat, lng]);

  const handlePlaceSelect = (details: PlaceDetails) => {
    setHotelName(details.name);
    setLocationName(details.address);
    setLat(details.lat);
    setLng(details.lng);
    setWebsite(details.website);
    setPhotos(details.photos);
  };

  const toggleNight = (nightIdx: number) => {
    setSelectedNights(prev =>
      prev.includes(nightIdx)
        ? prev.filter(n => n !== nightIdx)
        : [...prev, nightIdx]
    );
  };

  const resetHotelFields = () => {
    setHotelName('');
    setLocationName('');
    setLat(null);
    setLng(null);
    setWebsite(null);
    setPhotos([]);
    setSelectedNights([]);
  };

  const handleAddAnotherHotel = () => {
    // Save current hotel data
    setAllHotels(prev => [...prev, {
      name: hotelName,
      locationName,
      lat,
      lng,
      website,
      photos,
      selectedNights,
    }]);
    resetHotelFields();
    setStep(1);
  };

  const handleFinish = async () => {
    // Combine current hotel with previously added hotels
    const hotelsToCreate = [
      ...allHotels,
      {
        name: hotelName,
        locationName,
        lat,
        lng,
        website,
        photos,
        selectedNights,
      },
    ];

    setSaving(true);
    try {
      const tz = trip.timezone;

      for (const hotel of hotelsToCreate) {
        for (const nightIdx of hotel.selectedNights) {
          // Calculate day date string
          const dayDateStr = isUndated
            ? format(addDays(parseISO(REFERENCE_DATE), nightIdx), 'yyyy-MM-dd')
            : format(addDays(parseISO(trip.start_date!), nightIdx), 'yyyy-MM-dd');

          const nextDayDateStr = isUndated
            ? format(addDays(parseISO(REFERENCE_DATE), nightIdx + 1), 'yyyy-MM-dd')
            : format(addDays(parseISO(trip.start_date!), nightIdx + 1), 'yyyy-MM-dd');

          const startIso = localToUTC(dayDateStr, eveningReturn, tz);
          const endIso = localToUTC(nextDayDateStr, morningLeave, tz);

          // Insert entry
          const { data: newEntry, error: entryErr } = await supabase
            .from('entries')
            .insert({
              trip_id: tripId,
              start_time: startIso,
              end_time: endIso,
              is_scheduled: true,
              scheduled_day: nightIdx,
            } as any)
            .select('id')
            .single();

          if (entryErr || !newEntry) throw entryErr;

          // Insert option
          const { data: newOpt, error: optErr } = await supabase
            .from('entry_options')
            .insert({
              entry_id: newEntry.id,
              name: hotel.name,
              category: 'hotel',
              category_color: 'hsl(260, 50%, 55%)',
              location_name: hotel.locationName,
              latitude: hotel.lat,
              longitude: hotel.lng,
              website: hotel.website,
            } as any)
            .select('id')
            .single();

          if (optErr || !newOpt) throw optErr;

          // Insert images
          if (hotel.photos.length > 0) {
            await supabase.from('option_images').insert(
              hotel.photos.map((url, i) => ({
                option_id: newOpt.id,
                image_url: url,
                sort_order: i,
              }))
            );
          }
        }
      }

      const totalNights = hotelsToCreate.reduce((sum, h) => sum + h.selectedNights.length, 0);
      toast({ title: `Hotel set up ✨`, description: `${hotelsToCreate.length} hotel(s), ${totalNights} night(s) created.` });
      onCreated();
      onOpenChange(false);

      // Reset everything
      resetHotelFields();
      setAllHotels([]);
      setStep(1);
      setEveningReturn('22:00');
      setMorningLeave('08:00');
    } catch (err: any) {
      toast({ title: 'Failed to create hotel entries', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const canProceedStep1 = hotelName.trim().length > 0;
  const canProceedStep2 = selectedNights.length > 0;

  const stepIndicator = (
    <div className="flex items-center gap-1.5 mb-4">
      {[1, 2, 3, 4].map(s => (
        <div
          key={s}
          className={cn(
            'h-1.5 flex-1 rounded-full transition-colors',
            s <= step ? 'bg-primary' : 'bg-muted'
          )}
        />
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {step === 1 && 'Pick Your Hotel'}
            {step === 2 && 'Select Nights'}
            {step === 3 && 'Set Times'}
            {step === 4 && 'Another Hotel?'}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && 'Search for your hotel to auto-fill details.'}
            {step === 2 && 'Which nights are you staying here?'}
            {step === 3 && 'When do you return in the evening and leave in the morning?'}
            {step === 4 && 'Do you have another hotel during this trip?'}
          </DialogDescription>
        </DialogHeader>

        {stepIndicator}

        {/* Step 1: Pick Hotel */}
        {step === 1 && (
          <div className="space-y-3">
            <PlacesAutocomplete
              value={hotelName}
              onChange={setHotelName}
              onPlaceSelect={handlePlaceSelect}
              placeholder="Search for a hotel..."
              tripLocation={tripLocation}
              autoFocus
            />
            {locationName && (
              <p className="text-xs text-muted-foreground">📍 {locationName}</p>
            )}
            {photos.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto py-1">
                {photos.slice(0, 3).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`${hotelName} photo`}
                    className="h-16 w-24 rounded-md object-cover shrink-0"
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select Nights */}
        {step === 2 && (
          <div className="space-y-2 max-h-[40vh] overflow-y-auto">
            {nightLabels.map((label, idx) => {
              const isAssigned = assignedNights.has(idx);
              const isSelected = selectedNights.includes(idx);
              return (
                <label
                  key={idx}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors',
                    isAssigned && !isSelected
                      ? 'opacity-40 cursor-not-allowed border-border'
                      : isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40'
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => !isAssigned && toggleNight(idx)}
                    disabled={isAssigned && !isSelected}
                  />
                  <span className="text-sm font-medium">{label}</span>
                  {isAssigned && !isSelected && (
                    <span className="ml-auto text-[10px] text-muted-foreground">Already assigned</span>
                  )}
                </label>
              );
            })}
          </div>
        )}

        {/* Step 3: Set Times */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <Clock className="h-3.5 w-3.5" />
                When do you usually get back in the evening?
              </Label>
              <Input
                type="time"
                value={eveningReturn}
                onChange={(e) => setEveningReturn(e.target.value)}
                className="w-32"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <Clock className="h-3.5 w-3.5" />
                When do you want to leave in the morning?
              </Label>
              <Input
                type="time"
                value={morningLeave}
                onChange={(e) => setMorningLeave(e.target.value)}
                className="w-32"
              />
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p>
                <strong>{hotelName}</strong> will be set from <strong>{eveningReturn}</strong> to{' '}
                <strong>{morningLeave}</strong> the next morning for <strong>{selectedNights.length} night(s)</strong>.
              </p>
              <p className="mt-1">You can adjust individual nights later on the timeline.</p>
            </div>
          </div>
        )}

        {/* Step 4: Another Hotel? */}
        {step === 4 && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">🏨 {hotelName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedNights.length} night(s) · {eveningReturn} – {morningLeave}
              </p>
            </div>

            {allHotels.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Previously added</p>
                {allHotels.map((h, i) => (
                  <div key={i} className="rounded-lg border border-border p-2.5">
                    <p className="text-sm font-medium">🏨 {h.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.selectedNights.length} night(s)
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                className="h-16 flex-col gap-1"
                onClick={handleAddAnotherHotel}
              >
                <Plus className="h-5 w-5" />
                <span className="text-xs">Add Another</span>
              </Button>
              <Button
                className="h-16 flex-col gap-1"
                onClick={handleFinish}
                disabled={saving}
              >
                <Check className="h-5 w-5" />
                <span className="text-xs">{saving ? 'Creating...' : 'Finish'}</span>
              </Button>
            </div>
          </div>
        )}

        {/* Navigation footer */}
        {step < 4 && (
          <DialogFooter className="flex-row justify-between sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep(prev => prev - 1)}
              disabled={step === 1}
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={() => setStep(prev => prev + 1)}
              disabled={
                (step === 1 && !canProceedStep1) ||
                (step === 2 && !canProceedStep2)
              }
              className="gap-1"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default HotelWizard;

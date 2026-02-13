import { useState, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, Building2, Clock, Check, Plus, Upload, Pencil, Loader2, CalendarDays } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { localToUTC } from '@/lib/timezoneUtils';
import { addDays, parseISO, format, differenceInCalendarDays } from 'date-fns';
import PlacesAutocomplete, { type PlaceDetails } from './PlacesAutocomplete';
import type { Trip } from '@/types/trip';
import { cn } from '@/lib/utils';

interface HotelDraft {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  phone: string | null;
  rating: number | null;
  userRatingCount: number | null;
  googlePlaceId: string | null;
  googleMapsUri: string | null;
  photos: string[];
  checkInDate: string;
  checkInTime: string;
  checkoutDate: string;
  checkoutTime: string;
  eveningReturn: string;
  morningLeave: string;
}

interface HotelWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  trip: Trip;
  onCreated: () => void;
  dayTimezoneMap?: Map<string, { activeTz: string; flights: Array<any> }>;
}

const REFERENCE_DATE = '2099-01-01';

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const HotelWizard = ({ open, onOpenChange, tripId, trip, onCreated, dayTimezoneMap }: HotelWizardProps) => {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Current hotel draft
  const defaultCheckInDate = trip.start_date ?? '';
  const defaultCheckoutDate = trip.end_date ?? '';

  const [hotelName, setHotelName] = useState('');
  const [address, setAddress] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [website, setWebsite] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [userRatingCount, setUserRatingCount] = useState<number | null>(null);
  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(null);
  const [googleMapsUri, setGoogleMapsUri] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [checkInDate, setCheckInDate] = useState(defaultCheckInDate);
  const [checkInTime, setCheckInTime] = useState('15:00');
  const [checkoutDate, setCheckoutDate] = useState(defaultCheckoutDate);
  const [checkoutTime, setCheckoutTime] = useState('11:00');
  const [eveningReturn, setEveningReturn] = useState('22:00');
  const [morningLeave, setMorningLeave] = useState('08:00');

  // Multi-hotel tracking
  const [allHotels, setAllHotels] = useState<HotelDraft[]>([]);

  const isUndated = !trip.start_date;

  const numNights = useMemo(() => {
    if (!checkInDate || !checkoutDate) return 0;
    const diff = differenceInCalendarDays(parseISO(checkoutDate), parseISO(checkInDate));
    return Math.max(0, diff);
  }, [checkInDate, checkoutDate]);

  const tripLocation = useMemo(() => {
    if (lat != null && lng != null) return { lat, lng };
    return undefined;
  }, [lat, lng]);

  const resetFields = () => {
    setHotelName('');
    setAddress(null);
    setLat(null);
    setLng(null);
    setWebsite(null);
    setPhone(null);
    setRating(null);
    setUserRatingCount(null);
    setGooglePlaceId(null);
    setGoogleMapsUri(null);
    setPhotos([]);
    setCheckInDate(defaultCheckInDate);
    setCheckInTime('15:00');
    setCheckoutDate(defaultCheckoutDate);
    setCheckoutTime('11:00');
    setEveningReturn('22:00');
    setMorningLeave('08:00');
  };

  const resetAll = () => {
    resetFields();
    setAllHotels([]);
    setStep(0);
  };

  const handlePlaceSelect = (details: PlaceDetails) => {
    setHotelName(details.name);
    setAddress(details.address);
    setLat(details.lat);
    setLng(details.lng);
    setWebsite(details.website);
    setPhone(details.phone);
    setRating(details.rating);
    setUserRatingCount(details.userRatingCount);
    setGooglePlaceId(details.placeId);
    setGoogleMapsUri(details.googleMapsUri);
    setPhotos(details.photos);
  };

  const handleUpload = async (file: File) => {
    setParsing(true);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke('parse-hotel-booking', {
        body: { fileBase64: base64, mimeType: file.type },
      });
      if (error) throw error;

      const hotel = data?.hotel;
      if (!hotel?.hotel_name) {
        toast({ title: 'Could not extract hotel details', description: 'Try entering manually.', variant: 'destructive' });
        setParsing(false);
        return;
      }

      setHotelName(hotel.hotel_name);
      if (hotel.address) setAddress(hotel.address);
      if (hotel.check_in_date) setCheckInDate(hotel.check_in_date);
      if (hotel.check_in_time) setCheckInTime(hotel.check_in_time);
      if (hotel.checkout_date) setCheckoutDate(hotel.checkout_date);
      if (hotel.checkout_time) setCheckoutTime(hotel.checkout_time);

      setStep(1);
    } catch (err: any) {
      console.error('Hotel parse error:', err);
      toast({ title: 'Failed to parse booking', description: err?.message, variant: 'destructive' });
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  const buildDraft = (): HotelDraft => ({
    name: hotelName,
    address,
    lat,
    lng,
    website,
    phone,
    rating,
    userRatingCount,
    googlePlaceId,
    googleMapsUri,
    photos,
    checkInDate,
    checkInTime,
    checkoutDate,
    checkoutTime,
    eveningReturn,
    morningLeave,
  });

  const handleAddAnother = () => {
    setAllHotels(prev => [...prev, buildDraft()]);
    resetFields();
    setStep(0);
  };

  const handleFinish = async () => {
    const hotelsToCreate = [...allHotels, buildDraft()];
    setSaving(true);

    try {
      const fallbackTz = trip.home_timezone;

      for (const hotel of hotelsToCreate) {
        // 1. Insert into hotels table
        const { data: hotelRow, error: hotelErr } = await supabase
          .from('hotels')
          .insert({
            trip_id: tripId,
            name: hotel.name,
            address: hotel.address,
            latitude: hotel.lat,
            longitude: hotel.lng,
            website: hotel.website,
            phone: hotel.phone,
            rating: hotel.rating,
            user_rating_count: hotel.userRatingCount,
            google_place_id: hotel.googlePlaceId,
            google_maps_uri: hotel.googleMapsUri,
            check_in_date: hotel.checkInDate || null,
            check_in_time: hotel.checkInTime || '15:00',
            checkout_date: hotel.checkoutDate || null,
            checkout_time: hotel.checkoutTime || '11:00',
            evening_return: hotel.eveningReturn || '22:00',
            morning_leave: hotel.morningLeave || '08:00',
          } as any)
          .select('id')
          .single();

        if (hotelErr || !hotelRow) throw hotelErr;
        const hotelId = hotelRow.id;

        const ciDate = hotel.checkInDate;
        const coDate = hotel.checkoutDate;
        if (!ciDate || !coDate) continue;

        const nights = differenceInCalendarDays(parseISO(coDate), parseISO(ciDate));
        if (nights <= 0) continue;

        // Helper to create an entry + option + photos
        const createBlock = async (
          startIso: string,
          endIso: string,
          optionName: string,
          scheduledDay: number | null,
        ) => {
          const { data: entry, error: eErr } = await supabase
            .from('entries')
            .insert({
              trip_id: tripId,
              start_time: startIso,
              end_time: endIso,
              is_scheduled: true,
              scheduled_day: scheduledDay,
            } as any)
            .select('id')
            .single();
          if (eErr || !entry) throw eErr;

          const { data: opt, error: oErr } = await supabase
            .from('entry_options')
            .insert({
              entry_id: entry.id,
              name: optionName,
              category: 'hotel',
              category_color: 'hsl(260, 50%, 55%)',
              location_name: hotel.address,
              latitude: hotel.lat,
              longitude: hotel.lng,
              website: hotel.website,
              phone: hotel.phone,
              rating: hotel.rating,
              user_rating_count: hotel.userRatingCount,
              google_place_id: hotel.googlePlaceId,
              google_maps_uri: hotel.googleMapsUri,
              hotel_id: hotelId,
            } as any)
            .select('id')
            .single();
          if (oErr || !opt) throw oErr;

          if (hotel.photos.length > 0) {
            await supabase.from('option_images').insert(
              hotel.photos.map((url, i) => ({
                option_id: opt.id,
                image_url: url,
                sort_order: i,
              }))
            );
          }
        };

        // Resolve timezone for a date string
        const tzFor = (dateStr: string) => {
          const info = dayTimezoneMap?.get(dateStr);
          return info?.activeTz || fallbackTz;
        };

        // Day index relative to trip start (for scheduled_day)
        const dayIndex = (dateStr: string) => {
          if (isUndated) return null;
          return differenceInCalendarDays(parseISO(dateStr), parseISO(trip.start_date!));
        };

        // 2. Check-in block (1hr)
        const ciTz = tzFor(ciDate);
        const ciStart = localToUTC(ciDate, hotel.checkInTime || '15:00', ciTz);
        const ciEndTime = `${String(Math.min(23, parseInt(hotel.checkInTime || '15') + 1)).padStart(2, '0')}:${(hotel.checkInTime || '15:00').split(':')[1]}`;
        const ciEnd = localToUTC(ciDate, ciEndTime, ciTz);
        await createBlock(ciStart, ciEnd, `Check in · ${hotel.name}`, dayIndex(ciDate));

        // 3. Overnight blocks
        for (let n = 0; n < nights; n++) {
          const nightDate = format(addDays(parseISO(ciDate), n), 'yyyy-MM-dd');
          const nextDate = format(addDays(parseISO(ciDate), n + 1), 'yyyy-MM-dd');
          const nightTz = tzFor(nightDate);
          const nextTz = tzFor(nextDate);
          const oStart = localToUTC(nightDate, hotel.eveningReturn || '22:00', nightTz);
          const oEnd = localToUTC(nextDate, hotel.morningLeave || '08:00', nextTz);
          await createBlock(oStart, oEnd, hotel.name, dayIndex(nightDate));
        }

        // 4. Checkout block (1hr, ending at checkout_time)
        const coTz = tzFor(coDate);
        const coTimeHr = parseInt(hotel.checkoutTime || '11');
        const coTimeMin = (hotel.checkoutTime || '11:00').split(':')[1];
        const coStartTime = `${String(Math.max(0, coTimeHr - 1)).padStart(2, '0')}:${coTimeMin}`;
        const coStart = localToUTC(coDate, coStartTime, coTz);
        const coEnd = localToUTC(coDate, hotel.checkoutTime || '11:00', coTz);
        await createBlock(coStart, coEnd, `Check out · ${hotel.name}`, dayIndex(coDate));
      }

      const totalNights = hotelsToCreate.reduce((sum, h) => {
        if (!h.checkInDate || !h.checkoutDate) return sum;
        return sum + Math.max(0, differenceInCalendarDays(parseISO(h.checkoutDate), parseISO(h.checkInDate)));
      }, 0);

      toast({ title: 'Hotel set up ✨', description: `${hotelsToCreate.length} hotel(s), ${totalNights} night(s) created.` });
      onCreated();
      onOpenChange(false);
      resetAll();
    } catch (err: any) {
      toast({ title: 'Failed to create hotel entries', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const canProceedStep1 = hotelName.trim().length > 0;
  const checkoutValid = !checkInDate || !checkoutDate || differenceInCalendarDays(parseISO(checkoutDate), parseISO(checkInDate)) > 0;
  const canProceedStep2 = checkInDate && checkoutDate && checkoutValid && numNights > 0;

  const stepIndicator = (
    <div className="flex items-center gap-1.5 mb-4">
      {[0, 1, 2, 3, 4].map(s => (
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
            {step === 0 && 'Add Hotel'}
            {step === 1 && 'Hotel Details'}
            {step === 2 && 'Dates & Times'}
            {step === 3 && 'Daily Defaults'}
            {step === 4 && 'Review'}
          </DialogTitle>
          <DialogDescription>
            {step === 0 && 'Upload a booking confirmation or enter details manually.'}
            {step === 1 && 'Search for your hotel to auto-fill details.'}
            {step === 2 && 'Set your check-in and checkout dates and times.'}
            {step === 3 && 'When do you return in the evening and leave in the morning?'}
            {step === 4 && 'Review your hotel and add another or finish.'}
          </DialogDescription>
        </DialogHeader>

        {stepIndicator}

        {/* Step 0: Entry Method */}
        {step === 0 && (
          <div className="space-y-3">
            {parsing ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Extracting hotel details…</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-6 w-6" />
                  <span className="text-xs text-center leading-tight">Upload Booking<br />Confirmation</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  onClick={() => setStep(1)}
                >
                  <Pencil className="h-6 w-6" />
                  <span className="text-xs text-center leading-tight">Enter<br />Manually</span>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Hotel Details */}
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
            {address && (
              <p className="text-xs text-muted-foreground">📍 {address}</p>
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

        {/* Step 2: Dates & Times */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> Check-in date
                </Label>
                <Input
                  type="date"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Check-in time
                </Label>
                <Input
                  type="time"
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> Checkout date
                </Label>
                <Input
                  type="date"
                  value={checkoutDate}
                  onChange={(e) => setCheckoutDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Checkout time
                </Label>
                <Input
                  type="time"
                  value={checkoutTime}
                  onChange={(e) => setCheckoutTime(e.target.value)}
                />
              </div>
            </div>
            {checkInDate && checkoutDate && (
              <div className={cn(
                'rounded-lg p-3 text-sm',
                checkoutValid ? 'bg-muted/50 text-muted-foreground' : 'bg-destructive/10 text-destructive'
              )}>
                {checkoutValid
                  ? `${numNights} night${numNights !== 1 ? 's' : ''}`
                  : 'Checkout must be after check-in'}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Daily Defaults */}
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
                <strong>{hotelName}</strong> · <strong>{numNights} night{numNights !== 1 ? 's' : ''}</strong> · return{' '}
                <strong>{eveningReturn}</strong> → leave <strong>{morningLeave}</strong>
              </p>
              <p className="mt-1">You can adjust individual nights later on the timeline.</p>
            </div>
          </div>
        )}

        {/* Step 4: Review & Another Hotel */}
        {step === 4 && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">🏨 {hotelName}</p>
              {address && <p className="text-xs text-muted-foreground mt-0.5">📍 {address}</p>}
              <p className="text-xs text-muted-foreground mt-0.5">
                {checkInDate && checkoutDate ? (
                  <>
                    {format(parseISO(checkInDate), 'd MMM')} ({checkInTime}) → {format(parseISO(checkoutDate), 'd MMM')} ({checkoutTime})
                    {' · '}{numNights} night{numNights !== 1 ? 's' : ''}
                  </>
                ) : (
                  `${numNights} night(s)`
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Return {eveningReturn} → Leave {morningLeave}
              </p>
            </div>

            {allHotels.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Previously added</p>
                {allHotels.map((h, i) => {
                  const hNights = h.checkInDate && h.checkoutDate
                    ? Math.max(0, differenceInCalendarDays(parseISO(h.checkoutDate), parseISO(h.checkInDate)))
                    : 0;
                  return (
                    <div key={i} className="rounded-lg border border-border p-2.5">
                      <p className="text-sm font-medium">🏨 {h.name}</p>
                      <p className="text-xs text-muted-foreground">{hNights} night(s)</p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                className="h-16 flex-col gap-1"
                onClick={handleAddAnother}
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

        {/* Navigation footer for steps 1-3 */}
        {step >= 1 && step <= 3 && (
          <DialogFooter className="flex-row justify-between sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep(prev => prev - 1)}
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

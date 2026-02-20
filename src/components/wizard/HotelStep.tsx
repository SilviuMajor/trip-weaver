import { useState, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, Building2, Clock, Check, Plus, Upload, Pencil, Loader2, CalendarDays, Star, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { parseISO, format, differenceInCalendarDays } from 'date-fns';
import PlacesAutocomplete, { type PlaceDetails } from '@/components/timeline/PlacesAutocomplete';
import type { HotelDraft } from '@/components/timeline/HotelWizard';
import { cn } from '@/lib/utils';

interface HotelStepProps {
  hotels: HotelDraft[];
  onChange: (hotels: HotelDraft[]) => void;
  defaultCheckInDate: string;
  defaultCheckoutDate: string;
}

interface PlaceCandidate {
  placeId: string;
  name: string;
  address: string;
  photoUrl?: string;
}

type EnrichmentStep = 'idle' | 'searching' | 'matched' | 'candidates' | 'manual';

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

const isStrongMatch = (parsedName: string, placeName: string): boolean => {
  const a = parsedName.toLowerCase().trim();
  const b = placeName.toLowerCase().trim();
  if (a.includes(b) || b.includes(a)) return true;
  const wordsA = a.split(/\s+/).filter(w => w.length >= 3);
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length >= 3));
  const shared = wordsA.filter(w => wordsB.has(w));
  return shared.length >= 2;
};

const HotelStep = ({ hotels, onChange, defaultCheckInDate, defaultCheckoutDate }: HotelStepProps) => {
  const [subStep, setSubStep] = useState(0);
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Current hotel draft state
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

  // Auto-enrichment state
  const [enrichmentStep, setEnrichmentStep] = useState<EnrichmentStep>('idle');
  const [autoMatchedPlace, setAutoMatchedPlace] = useState<PlaceDetails | null>(null);
  const [placeCandidates, setPlaceCandidates] = useState<PlaceCandidate[]>([]);
  const [fetchingCandidate, setFetchingCandidate] = useState<string | null>(null);

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
    setEnrichmentStep('idle');
    setAutoMatchedPlace(null);
    setPlaceCandidates([]);
    setFetchingCandidate(null);
  };

  const applyPlaceDetails = (details: PlaceDetails) => {
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

  const handlePlaceSelect = (details: PlaceDetails) => {
    applyPlaceDetails(details);
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

  const finaliseDraft = () => {
    onChange([...hotels, buildDraft()]);
    resetFields();
    setSubStep(0);
  };

  const autoEnrichFromParsedName = async (parsedHotelName: string) => {
    setEnrichmentStep('searching');
    try {
      const { data: acData, error: acErr } = await supabase.functions.invoke('google-places', {
        body: { action: 'autocomplete', query: parsedHotelName },
      });
      if (acErr) throw acErr;

      const predictions = acData?.predictions ?? [];
      if (predictions.length === 0) {
        setEnrichmentStep('manual');
        return;
      }

      const topPrediction = predictions[0];
      const { data: detailsData, error: detErr } = await supabase.functions.invoke('google-places', {
        body: { action: 'details', placeId: topPrediction.place_id },
      });
      if (detErr) throw detErr;

      const topDetails: PlaceDetails = {
        name: detailsData.name,
        address: detailsData.address,
        website: detailsData.website,
        phone: detailsData.phone ?? null,
        lat: detailsData.lat,
        lng: detailsData.lng,
        rating: detailsData.rating ?? null,
        userRatingCount: detailsData.userRatingCount ?? null,
        openingHours: detailsData.openingHours ?? null,
        googleMapsUri: detailsData.googleMapsUri ?? null,
        placeId: topPrediction.place_id,
        priceLevel: detailsData.priceLevel ?? null,
        placeTypes: detailsData.placeTypes ?? null,
        photos: (detailsData.photos ?? []).map((p: any) => typeof p === 'string' ? p : p?.url).filter(Boolean),
      };

      if (isStrongMatch(parsedHotelName, topDetails.name)) {
        setAutoMatchedPlace(topDetails);
        setEnrichmentStep('matched');
      } else {
        const candidates: PlaceCandidate[] = predictions.slice(0, 5).map((p: any) => ({
          placeId: p.place_id,
          name: p.structured_formatting?.main_text || p.description,
          address: p.structured_formatting?.secondary_text || '',
        }));
        if (topDetails.photos.length > 0) {
          candidates[0].photoUrl = topDetails.photos[0];
        }
        setPlaceCandidates(candidates);
        setEnrichmentStep('candidates');
      }
    } catch (err) {
      console.error('Auto-enrichment error:', err);
      setEnrichmentStep('manual');
    }
  };

  const selectCandidate = async (candidate: PlaceCandidate) => {
    setFetchingCandidate(candidate.placeId);
    try {
      const { data, error } = await supabase.functions.invoke('google-places', {
        body: { action: 'details', placeId: candidate.placeId },
      });
      if (error) throw error;

      const details: PlaceDetails = {
        name: data.name,
        address: data.address,
        website: data.website,
        phone: data.phone ?? null,
        lat: data.lat,
        lng: data.lng,
        rating: data.rating ?? null,
        userRatingCount: data.userRatingCount ?? null,
        openingHours: data.openingHours ?? null,
        googleMapsUri: data.googleMapsUri ?? null,
        placeId: candidate.placeId,
        priceLevel: data.priceLevel ?? null,
        placeTypes: data.placeTypes ?? null,
        photos: (data.photos ?? []).map((p: any) => typeof p === 'string' ? p : p?.url).filter(Boolean),
      };
      applyPlaceDetails(details);
      setEnrichmentStep('idle');
      setSubStep(2);
    } catch (err) {
      console.error('Failed to fetch candidate details:', err);
      toast({ title: 'Failed to load hotel details', variant: 'destructive' });
    } finally {
      setFetchingCandidate(null);
    }
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

      setSubStep(1);
      setParsing(false);
      autoEnrichFromParsedName(hotel.hotel_name);
    } catch (err: any) {
      console.error('Hotel parse error:', err);
      toast({ title: 'Failed to parse booking', description: err?.message, variant: 'destructive' });
      setParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  };

  const canProceedStep1 = hotelName.trim().length > 0;
  const checkoutValid = !checkInDate || !checkoutDate || differenceInCalendarDays(parseISO(checkoutDate), parseISO(checkInDate)) > 0;
  const canProceedStep2 = checkInDate && checkoutDate && checkoutValid && numNights > 0;

  // ─── Render enrichment-aware sub-step 1 ───
  const renderStep1 = () => {
    if (enrichmentStep === 'searching') {
      return (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Finding your hotel on Google…</p>
        </div>
      );
    }

    if (enrichmentStep === 'matched' && autoMatchedPlace) {
      return (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">We found your hotel</p>
          <div className="rounded-lg border border-border overflow-hidden">
            {autoMatchedPlace.photos.length > 0 && (
              <img src={autoMatchedPlace.photos[0]} alt={autoMatchedPlace.name} className="w-full h-32 object-cover" />
            )}
            <div className="p-3 space-y-1">
              <p className="text-sm font-semibold">{autoMatchedPlace.name}</p>
              <p className="text-xs text-muted-foreground">📍 {autoMatchedPlace.address}</p>
              {autoMatchedPlace.rating && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {autoMatchedPlace.rating}
                  {autoMatchedPlace.userRatingCount && (
                    <span>({autoMatchedPlace.userRatingCount.toLocaleString()})</span>
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => { applyPlaceDetails(autoMatchedPlace); setEnrichmentStep('idle'); setSubStep(2); }}>
              <Check className="h-4 w-4 mr-1" /> Confirm
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => {
              if (placeCandidates.length > 0) setEnrichmentStep('candidates');
              else setEnrichmentStep('manual');
            }}>
              This isn't right
            </Button>
          </div>
        </div>
      );
    }

    if (enrichmentStep === 'candidates' && placeCandidates.length > 0) {
      return (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Select your hotel</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {placeCandidates.map((c) => (
              <button
                key={c.placeId}
                type="button"
                className="w-full flex items-center gap-3 rounded-lg border border-border p-2.5 text-left hover:bg-accent/50 transition-colors disabled:opacity-50"
                onClick={() => selectCandidate(c)}
                disabled={fetchingCandidate !== null}
              >
                {c.photoUrl ? (
                  <img src={c.photoUrl} alt={c.name} className="h-12 w-16 rounded object-cover shrink-0" />
                ) : (
                  <div className="h-12 w-16 rounded bg-muted flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.address}</p>
                </div>
                {fetchingCandidate === c.placeId && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="w-full gap-1" onClick={() => setEnrichmentStep('manual')}>
            <Search className="h-3.5 w-3.5" /> Search manually
          </Button>
        </div>
      );
    }

    // Manual / idle
    return (
      <div className="space-y-3">
        <PlacesAutocomplete
          value={hotelName}
          onChange={setHotelName}
          onPlaceSelect={handlePlaceSelect}
          placeholder="Search for a hotel..."
          tripLocation={tripLocation}
          autoFocus
        />
        {address && <p className="text-xs text-muted-foreground">📍 {address}</p>}
        {photos.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto py-1">
            {photos.slice(0, 3).map((url, i) => (
              <img key={i} src={url} alt={`${hotelName} photo`} className="h-16 w-24 rounded-md object-cover shrink-0" />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-foreground flex items-center justify-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Where are you staying?
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Add your hotel — or skip this for now</p>
      </div>

      {/* Sub-step progress dots (visible after sub-step 0) */}
      {subStep > 0 && (
        <div className="flex items-center gap-1.5">
          {[0, 1, 2, 3, 4].map(s => (
            <div key={s} className={cn('h-1.5 flex-1 rounded-full transition-colors', s <= subStep ? 'bg-primary' : 'bg-muted')} />
          ))}
        </div>
      )}

      {/* Previously added hotels */}
      {hotels.length > 0 && subStep < 4 && (
        <div className="space-y-1.5">
          {hotels.map((h, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-border p-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">🏨 {h.name}</p>
                <p className="text-xs text-muted-foreground">
                  {h.checkInDate && h.checkoutDate
                    ? `${format(parseISO(h.checkInDate), 'd MMM')} – ${format(parseISO(h.checkoutDate), 'd MMM')}`
                    : 'Dates TBC'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChange(hotels.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sub-step 0: Entry method */}
      {subStep === 0 && (
        <div className="space-y-3">
          {parsing ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Extracting hotel details…</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
                <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-6 w-6" />
                  <span className="text-xs text-center leading-tight">Upload Booking<br />Confirmation</span>
                </Button>
                <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => setSubStep(1)}>
                  <Pencil className="h-6 w-6" />
                  <span className="text-xs text-center leading-tight">Enter<br />Manually</span>
                </Button>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or search</span>
                </div>
              </div>
              <PlacesAutocomplete
                value={hotelName}
                onChange={setHotelName}
                onPlaceSelect={(details) => {
                  applyPlaceDetails(details);
                  setSubStep(2);
                }}
                placeholder="Search for your hotel…"
                tripLocation={tripLocation}
              />
            </>
          )}
        </div>
      )}

      {/* Sub-step 1: Hotel details */}
      {subStep === 1 && renderStep1()}

      {/* Sub-step 2: Dates & Times */}
      {subStep === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Check-in date</Label>
              <Input type="date" className="h-8" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Check-in time</Label>
              <Input type="time" className="h-8" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Checkout date</Label>
              <Input type="date" className="h-8" value={checkoutDate} onChange={(e) => setCheckoutDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Checkout time</Label>
              <Input type="time" className="h-8" value={checkoutTime} onChange={(e) => setCheckoutTime(e.target.value)} />
            </div>
          </div>
          {checkInDate && checkoutDate && (
            <div className={cn('rounded-lg p-3 text-sm', checkoutValid ? 'bg-muted/50 text-muted-foreground' : 'bg-destructive/10 text-destructive')}>
              {checkoutValid ? `${numNights} night${numNights !== 1 ? 's' : ''}` : 'Checkout must be after check-in'}
            </div>
          )}
        </div>
      )}

      {/* Sub-step 3: Daily Defaults */}
      {subStep === 3 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm"><Clock className="h-3.5 w-3.5" /> When do you usually get back in the evening?</Label>
            <Input type="time" value={eveningReturn} onChange={(e) => setEveningReturn(e.target.value)} className="w-32" />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm"><Clock className="h-3.5 w-3.5" /> When do you want to leave in the morning?</Label>
            <Input type="time" value={morningLeave} onChange={(e) => setMorningLeave(e.target.value)} className="w-32" />
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

      {/* Sub-step 4: Review */}
      {subStep === 4 && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border overflow-hidden">
            {photos.length > 0 && (
              <img src={photos[0]} alt={hotelName} className="w-full h-28 object-cover" />
            )}
            <div className="p-3">
              <p className="text-sm font-medium">🏨 {hotelName}</p>
              {address && <p className="text-xs text-muted-foreground mt-0.5">📍 {address}</p>}
              <p className="text-xs text-muted-foreground mt-0.5">
                {checkInDate && checkoutDate ? (
                  <>
                    {format(parseISO(checkInDate), 'd MMM')} ({checkInTime}) → {format(parseISO(checkoutDate), 'd MMM')} ({checkoutTime})
                    {' · '}{numNights} night{numNights !== 1 ? 's' : ''}
                  </>
                ) : `${numNights} night(s)`}
              </p>
              <p className="text-xs text-muted-foreground">Return {eveningReturn} → Leave {morningLeave}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button variant="outline" className="h-16 flex-col gap-1" onClick={() => { finaliseDraft(); }}>
              <Plus className="h-5 w-5" />
              <span className="text-xs">Add Another</span>
            </Button>
            <Button className="h-16 flex-col gap-1" onClick={finaliseDraft}>
              <Check className="h-5 w-5" />
              <span className="text-xs">Done</span>
            </Button>
          </div>
        </div>
      )}

      {/* Sub-step navigation (steps 1-3) */}
      {subStep >= 1 && subStep <= 3 && (
        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={() => setSubStep(s => s - 1)} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button
            onClick={() => setSubStep(s => s + 1)}
            disabled={(subStep === 1 && !canProceedStep1) || (subStep === 2 && !canProceedStep2)}
            className="gap-1"
          >
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default HotelStep;

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useProfile } from '@/hooks/useProfile';
import { toast } from '@/hooks/use-toast';
import { addDays, format, parseISO, differenceInCalendarDays } from 'date-fns';
import { localToUTC } from '@/lib/timezoneUtils';
import { findCategory } from '@/lib/categories';
import AIRPORTS from '@/lib/airports';
import WizardStep from '@/components/wizard/WizardStep';
import NameStep from '@/components/wizard/NameStep';
import DateStep from '@/components/wizard/DateStep';
import FlightStep, { type FlightDraft } from '@/components/wizard/FlightStep';
import HotelStep from '@/components/wizard/HotelStep';
import ActivitiesStep, { type ActivityDraft } from '@/components/wizard/ActivitiesStep';
import MembersStep from '@/components/wizard/MembersStep';
import type { HotelDraft } from '@/components/timeline/HotelWizard';

interface MemberDraft {
  name: string;
  role: 'organizer' | 'editor' | 'viewer';
}

const STEPS = ['Name', 'Dates', 'Flights', 'Hotels', 'Activities', 'Members'];

const TripWizard = () => {
  const { adminUser, isAdmin, loading: authLoading } = useAdminAuth();
  const { displayName, loading: profileLoading } = useProfile(adminUser?.id);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [creatorName, setCreatorName] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datesUnknown, setDatesUnknown] = useState(false);
  const [durationDays, setDurationDays] = useState(3);
  const [timezone, setTimezone] = useState('Europe/London');
  const [flightDrafts, setFlightDrafts] = useState<FlightDraft[]>([]);
  const [hotelDrafts, setHotelDrafts] = useState<HotelDraft[]>([]);
  const [activityDrafts, setActivityDrafts] = useState<ActivityDraft[]>([]);
  const [members, setMembers] = useState<MemberDraft[]>([]);

  // Set creator name from profile when available
  useEffect(() => {
    if (displayName) setCreatorName(displayName);
  }, [displayName]);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/auth');
    }
  }, [authLoading, isAdmin, navigate]);

  // Auto-set home timezone from first flight's departure
  useEffect(() => {
    if (flightDrafts.length > 0 && flightDrafts[0].departureTz) {
      setTimezone(flightDrafts[0].departureTz);
    }
  }, [flightDrafts]);

  // Derive origin coordinates for Activities step
  const activityOrigin = useMemo(() => {
    const hotelWithCoords = hotelDrafts.find(h => h.lat != null && h.lng != null);
    if (hotelWithCoords) return { lat: hotelWithCoords.lat!, lng: hotelWithCoords.lng! };

    if (flightDrafts.length > 0 && flightDrafts[0].arrivalLocation) {
      const iata = flightDrafts[0].arrivalLocation.split(' - ')[0]?.trim();
      const airport = AIRPORTS.find(a => a.iata === iata);
      if (airport) return { lat: airport.lat, lng: airport.lng };
    }

    return null;
  }, [hotelDrafts, flightDrafts]);

  const handleNext = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const handleBack = () => setStep(s => Math.max(s - 1, 0));

  const createFlightEntry = async (tripId: string, flight: FlightDraft, flightDate: string, flightName: string) => {
    // Look up airport coordinates
    const depIata = flight.departureLocation.split(' - ')[0]?.trim();
    const arrIata = flight.arrivalLocation.split(' - ')[0]?.trim();
    const depAirport = AIRPORTS.find(a => a.iata === depIata);
    const arrAirport = AIRPORTS.find(a => a.iata === arrIata);

    const startIso = localToUTC(flightDate, flight.departureTime, flight.departureTz);
    let endIso = localToUTC(flightDate, flight.arrivalTime, flight.arrivalTz);
    // If arrival is before departure, assume next day
    if (new Date(endIso) <= new Date(startIso)) {
      const nextDay = format(addDays(parseISO(flightDate), 1), 'yyyy-MM-dd');
      endIso = localToUTC(nextDay, flight.arrivalTime, flight.arrivalTz);
    }

    const { data: entry, error } = await supabase
      .from('entries')
      .insert({ trip_id: tripId, start_time: startIso, end_time: endIso })
      .select('id')
      .single();
    if (error || !entry) return;

    await supabase.from('entry_options').insert({
      entry_id: entry.id,
      name: flightName,
      category: 'flight',
      category_color: 'hsl(210, 70%, 50%)',
      departure_location: flight.departureLocation || null,
      arrival_location: flight.arrivalLocation || null,
      departure_tz: flight.departureTz,
      arrival_tz: flight.arrivalTz,
      departure_terminal: flight.departureTerminal || null,
      arrival_terminal: flight.arrivalTerminal || null,
      airport_checkin_hours: 2,
      airport_checkout_min: 30,
      latitude: arrAirport?.lat ?? null,
      longitude: arrAirport?.lng ?? null,
    } as any);

    // Create processing entries
    const checkinStart = new Date(new Date(startIso).getTime() - 2 * 60 * 60 * 1000);
    const { data: checkinEntry } = await supabase
      .from('entries')
      .insert({
        trip_id: tripId,
        start_time: checkinStart.toISOString(),
        end_time: startIso,
        is_locked: true,
        linked_flight_id: entry.id,
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
        location_name: flight.departureLocation || null,
        departure_location: flight.departureLocation || null,
        latitude: depAirport?.lat ?? null,
        longitude: depAirport?.lng ?? null,
      } as any);
    }

    const checkoutEnd = new Date(new Date(endIso).getTime() + 30 * 60 * 1000);
    const { data: checkoutEntry } = await supabase
      .from('entries')
      .insert({
        trip_id: tripId,
        start_time: endIso,
        end_time: checkoutEnd.toISOString(),
        is_locked: true,
        linked_flight_id: entry.id,
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
        location_name: flight.arrivalLocation || null,
        arrival_location: flight.arrivalLocation || null,
        latitude: arrAirport?.lat ?? null,
        longitude: arrAirport?.lng ?? null,
      } as any);
    }
  };

  const createHotelEntries = async (tripId: string, hotels: HotelDraft[], fallbackTz: string, tripStartDate: string | null, remapDate: (d: string) => string) => {
    for (const hotel of hotels) {
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

      const createBlock = async (
        startIso: string,
        endIso: string,
        optionName: string,
        scheduledDay: number | null,
        linkedType?: string | null,
      ) => {
        const { data: entry, error: eErr } = await supabase
          .from('entries')
          .insert({
            trip_id: tripId,
            start_time: startIso,
            end_time: endIso,
            is_scheduled: true,
            scheduled_day: scheduledDay,
            linked_type: linkedType || null,
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

      const dayIndex = (dateStr: string) => {
        if (!tripStartDate) {
          return differenceInCalendarDays(parseISO(dateStr), parseISO('2099-01-01'));
        }
        return differenceInCalendarDays(parseISO(dateStr), parseISO(tripStartDate));
      };

      // Check-in block (1hr)
      const ciDateRef = remapDate(ciDate);
      const ciStart = localToUTC(ciDateRef, hotel.checkInTime || '15:00', fallbackTz);
      const ciEndTime = `${String(Math.min(23, parseInt(hotel.checkInTime || '15') + 1)).padStart(2, '0')}:${(hotel.checkInTime || '15:00').split(':')[1]}`;
      const ciEnd = localToUTC(ciDateRef, ciEndTime, fallbackTz);
      await createBlock(ciStart, ciEnd, `Check in · ${hotel.name}`, dayIndex(ciDateRef));

      // Overnight blocks
      for (let n = 0; n < nights; n++) {
        const nightDateRef = remapDate(format(addDays(parseISO(ciDate), n), 'yyyy-MM-dd'));
        const nextDateRef = remapDate(format(addDays(parseISO(ciDate), n + 1), 'yyyy-MM-dd'));
        const oStart = localToUTC(nightDateRef, hotel.eveningReturn || '22:00', fallbackTz);

        const isLastNight = n === nights - 1;
        const endTime = isLastNight ? (hotel.checkoutTime || '11:00') : (hotel.morningLeave || '08:00');
        const oEnd = localToUTC(nextDateRef, endTime, fallbackTz);

        const optionName = isLastNight ? `Check out · ${hotel.name}` : hotel.name;
        const linkedType = isLastNight ? 'checkout' : null;

        await createBlock(oStart, oEnd, optionName, dayIndex(nightDateRef), linkedType);
      }
    }
  };

  const createPlannerEntries = async (tripId: string, activities: ActivityDraft[], fallbackTz: string) => {
    const REFERENCE_DATE_STR = '2099-01-01';
    const startIso = localToUTC(REFERENCE_DATE_STR, '00:00', fallbackTz);
    const endIso = localToUTC(REFERENCE_DATE_STR, '01:00', fallbackTz);

    for (const activity of activities) {
      const place = activity.place;
      const cat = findCategory(activity.categoryId);

      const { data: d, error } = await supabase
        .from('entries')
        .insert({ trip_id: tripId, start_time: startIso, end_time: endIso, is_scheduled: false } as any)
        .select('id')
        .single();
      if (error) throw error;

      const { data: optData } = await supabase.from('entry_options').insert({
        entry_id: d.id,
        name: place.name,
        category: cat?.id ?? activity.categoryId,
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
      } as any).select('id').single();

      // Background: fetch photos
      if (place.placeId && !place.placeId.startsWith('manual-') && optData) {
        try {
          const { data: details } = await supabase.functions.invoke('google-places', {
            body: { action: 'details', placeId: place.placeId },
          });
          if (details?.photos?.length > 0) {
            const photoUrls = (details.photos ?? []).map((p: any) => typeof p === 'string' ? p : p?.url).filter(Boolean);
            for (let i = 0; i < photoUrls.length; i++) {
              await supabase.from('option_images').insert({
                option_id: optData.id,
                image_url: photoUrls[i],
                sort_order: i,
              });
            }
          }
        } catch (e) {
          console.error('Background photo fetch failed:', e);
        }
      }
    }
  };

  const handleCreate = async () => {
    if (!name) {
      toast({ title: 'Please fill in a name', variant: 'destructive' });
      return;
    }
    if (!datesUnknown && (!startDate || !endDate)) {
      toast({ title: 'Please fill in dates', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const insertData: Record<string, unknown> = {
        name,
        destination: destination.trim() || null,
        start_date: datesUnknown ? null : startDate,
        end_date: datesUnknown ? null : endDate,
        duration_days: datesUnknown ? durationDays : null,
        home_timezone: timezone,
        category_presets: null,
        owner_id: adminUser?.id ?? null,
      };

      const { data: trip, error } = await supabase
        .from('trips')
        .insert(insertData as any)
        .select('id')
        .single();

      if (error) throw error;

      // Auto-add creator as organizer
      const myName = creatorName.trim() || adminUser?.email || 'Organizer';
      const allMembers = [
        { name: myName, role: 'organizer' as const },
        ...members,
      ];

      const { error: membersError } = await supabase
        .from('trip_users')
        .insert(allMembers.map((m, i) => ({
          name: m.name,
          role: m.role,
          trip_id: trip.id,
          // Only the first member (creator/organizer) gets user_id
          ...(i === 0 ? { user_id: adminUser?.id ?? null } : {}),
        } as any)));

      if (membersError) throw membersError;

      // For undated trips: remap real dates to reference dates (2099-01-01 + offset)
      const REFERENCE_DATE_STR = '2099-01-01';
      let remapDate: (realDate: string) => string;
      if (datesUnknown) {
        const allRealDates: string[] = [];
        for (const f of flightDrafts) {
          if (f.date) allRealDates.push(f.date);
        }
        for (const h of hotelDrafts) {
          if (h.checkInDate) allRealDates.push(h.checkInDate);
        }
        allRealDates.sort();
        const earliest = allRealDates[0] || REFERENCE_DATE_STR;
        remapDate = (realDate: string) => {
          const offset = differenceInCalendarDays(parseISO(realDate), parseISO(earliest));
          return format(addDays(parseISO(REFERENCE_DATE_STR), Math.max(0, offset)), 'yyyy-MM-dd');
        };

        if (allRealDates.length >= 1) {
          const maxDate = hotelDrafts.reduce((max, h) => {
            return h.checkoutDate && h.checkoutDate > max ? h.checkoutDate : max;
          }, allRealDates[allRealDates.length - 1]);
          const totalSpan = differenceInCalendarDays(parseISO(maxDate), parseISO(earliest)) + 1;
          if (totalSpan > durationDays) {
            await supabase.from('trips').update({ duration_days: totalSpan }).eq('id', trip.id);
          }
        }
      } else {
        remapDate = (realDate: string) => realDate;
      }

      // Create flight entries
      for (const flight of flightDrafts) {
        const rawDate = flight.date || startDate || REFERENCE_DATE_STR;
        const flightDate = remapDate(rawDate);
        const flightName = flight.flightNumber || `${flight.departureLocation.split(' - ')[0]} → ${flight.arrivalLocation.split(' - ')[0]}`;
        await createFlightEntry(trip.id, flight, flightDate, flightName);
      }

      if (hotelDrafts.length > 0) {
        await createHotelEntries(trip.id, hotelDrafts, timezone, datesUnknown ? null : startDate, remapDate);
      }

      if (activityDrafts.length > 0) {
        await createPlannerEntries(trip.id, activityDrafts, timezone);
      }

      const parts: string[] = [];
      if (flightDrafts.length > 0) parts.push(`${flightDrafts.length} flight${flightDrafts.length > 1 ? 's' : ''}`);
      if (hotelDrafts.length > 0) parts.push(`${hotelDrafts.length} hotel${hotelDrafts.length > 1 ? 's' : ''}`);
      if (activityDrafts.length > 0) parts.push(`${activityDrafts.length} activit${activityDrafts.length > 1 ? 'ies' : 'y'} in planner`);
      const desc = parts.length > 0 ? `Added ${parts.join(' + ')} to your timeline` : undefined;
      toast({ title: "Trip created — let's plan! ✈️", description: desc });
      navigate(`/trip/${trip.id}`);
    } catch (err: any) {
      toast({ title: 'Failed to create trip', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const isLastStep = step === STEPS.length - 1;

  if (authLoading || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <WizardStep
          currentStep={step}
          totalSteps={STEPS.length}
          stepLabels={STEPS}
          onBack={step > 0 ? handleBack : () => navigate('/')}
          onNext={isLastStep ? handleCreate : handleNext}
          nextLabel={isLastStep ? (saving ? 'Creating…' : 'Create Trip') : 'Next'}
          nextDisabled={saving || (step === 0 && !name) || (step === 1 && !datesUnknown && (!startDate || !endDate))}
          canSkip={
            step >= 2 && !isLastStep &&
            !(step === 2 && flightDrafts.length > 0) &&
            !(step === 3 && hotelDrafts.length > 0) &&
            !(step === 4 && activityDrafts.length > 0)
          }
          onSkip={handleNext}
        >
          {step === 0 && <NameStep value={name} onChange={setName} destination={destination} onDestinationChange={setDestination} />}
          {step === 1 && (
            <DateStep
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              datesUnknown={datesUnknown}
              onDatesUnknownChange={setDatesUnknown}
              durationDays={durationDays}
              onDurationDaysChange={setDurationDays}
            />
          )}
          {step === 2 && (
            <FlightStep
              flights={flightDrafts}
              onChange={setFlightDrafts}
              startDate={startDate}
              endDate={endDate}
            />
          )}
          {step === 3 && (
            <HotelStep
              hotels={hotelDrafts}
              onChange={setHotelDrafts}
              defaultCheckInDate={startDate}
              defaultCheckoutDate={endDate}
            />
          )}
          {step === 4 && (
            <ActivitiesStep
              activities={activityDrafts}
              onChange={setActivityDrafts}
              destination={destination}
              originLat={activityOrigin?.lat}
              originLng={activityOrigin?.lng}
            />
          )}
          {step === 5 && (
            <MembersStep
              members={members}
              onChange={setMembers}
              creatorName={creatorName}
              onCreatorNameChange={setCreatorName}
              hasDisplayName={!!displayName}
            />
          )}
        </WizardStep>
      </div>
    </div>
  );
};

export default TripWizard;

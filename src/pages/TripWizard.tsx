import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useProfile } from '@/hooks/useProfile';
import { toast } from '@/hooks/use-toast';
import { addDays, format, parseISO } from 'date-fns';
import { localToUTC } from '@/lib/timezoneUtils';
import WizardStep from '@/components/wizard/WizardStep';
import NameStep from '@/components/wizard/NameStep';
import DateStep, { type FlightDraft } from '@/components/wizard/DateStep';
import TimezoneStep from '@/components/wizard/TimezoneStep';
import CategoryStep from '@/components/wizard/CategoryStep';
import MembersStep from '@/components/wizard/MembersStep';
import type { CategoryPreset } from '@/types/trip';

interface MemberDraft {
  name: string;
  role: 'organizer' | 'editor' | 'viewer';
}

const STEPS = ['Name', 'Dates', 'Timezone', 'Categories', 'Members'];

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
  const [categories, setCategories] = useState<CategoryPreset[]>([]);
  const [members, setMembers] = useState<MemberDraft[]>([]);

  // Flight state
  const [outboundFlight, setOutboundFlight] = useState<FlightDraft | null>(null);
  const [returnFlight, setReturnFlight] = useState<FlightDraft | null>(null);

  // Set creator name from profile when available
  useEffect(() => {
    if (displayName) setCreatorName(displayName);
  }, [displayName]);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/auth');
    }
  }, [authLoading, isAdmin, navigate]);

  // Auto-set timezone from outbound flight departure (home timezone)
  useEffect(() => {
    if (outboundFlight?.departureTz) {
      setTimezone(outboundFlight.departureTz);
    }
  }, [outboundFlight?.departureTz]);

  const handleNext = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const handleBack = () => setStep(s => Math.max(s - 1, 0));

  const createFlightEntry = async (tripId: string, flight: FlightDraft, flightDate: string, flightName: string) => {
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
        location_name: flight.departureLocation.split(' - ')[0] || null,
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
        location_name: flight.arrivalLocation.split(' - ')[0] || null,
      } as any);
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
        category_presets: categories.length > 0 ? categories : null,
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
        .insert(allMembers.map(m => ({
          name: m.name,
          role: m.role,
          trip_id: trip.id,
        })));

      if (membersError) throw membersError;

      // Create flight entries if provided
      if (outboundFlight && startDate) {
        await createFlightEntry(trip.id, outboundFlight, startDate, 'Outbound Flight');
      }
      if (returnFlight && endDate) {
        await createFlightEntry(trip.id, returnFlight, endDate, 'Return Flight');
      }

      toast({ title: 'Trip created!' });
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
          canSkip={step > 1 && !isLastStep}
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
              outboundFlight={outboundFlight}
              onOutboundFlightChange={setOutboundFlight}
              returnFlight={returnFlight}
              onReturnFlightChange={setReturnFlight}
            />
          )}
          {step === 2 && <TimezoneStep value={timezone} onChange={setTimezone} />}
          {step === 3 && <CategoryStep categories={categories} onChange={setCategories} />}
          {step === 4 && (
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

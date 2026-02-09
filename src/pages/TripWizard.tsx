import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useProfile } from '@/hooks/useProfile';
import { toast } from '@/hooks/use-toast';
import WizardStep from '@/components/wizard/WizardStep';
import NameStep from '@/components/wizard/NameStep';
import DateStep from '@/components/wizard/DateStep';
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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datesUnknown, setDatesUnknown] = useState(false);
  const [durationDays, setDurationDays] = useState(3);
  const [timezone, setTimezone] = useState('Europe/Amsterdam');
  const [categories, setCategories] = useState<CategoryPreset[]>([]);
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

  const handleNext = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const handleBack = () => setStep(s => Math.max(s - 1, 0));

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
        start_date: datesUnknown ? null : startDate,
        end_date: datesUnknown ? null : endDate,
        duration_days: datesUnknown ? durationDays : null,
        timezone,
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
          {step === 0 && <NameStep value={name} onChange={setName} />}
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

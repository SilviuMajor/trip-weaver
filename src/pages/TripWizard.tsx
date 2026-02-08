import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
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
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [timezone, setTimezone] = useState('Europe/Amsterdam');
  const [categories, setCategories] = useState<CategoryPreset[]>([]);
  const [members, setMembers] = useState<MemberDraft[]>([]);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/auth');
    }
  }, [authLoading, isAdmin, navigate]);

  const handleNext = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const handleBack = () => setStep(s => Math.max(s - 1, 0));

  const handleCreate = async () => {
    if (!name || !startDate || !endDate) {
      toast({ title: 'Please fill in name and dates', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const insertData: Record<string, unknown> = {
        name,
        start_date: startDate,
        end_date: endDate,
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

      // Insert members
      if (members.length > 0) {
        const { error: membersError } = await supabase
          .from('trip_users')
          .insert(members.map(m => ({
            name: m.name,
            role: m.role,
            trip_id: trip.id,
          })));

        if (membersError) throw membersError;
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

  if (authLoading) {
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
          nextDisabled={saving || (step === 0 && !name) || (step === 1 && (!startDate || !endDate))}
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
            />
          )}
          {step === 2 && <TimezoneStep value={timezone} onChange={setTimezone} />}
          {step === 3 && <CategoryStep categories={categories} onChange={setCategories} />}
          {step === 4 && <MembersStep members={members} onChange={setMembers} />}
        </WizardStep>
      </div>
    </div>
  );
};

export default TripWizard;

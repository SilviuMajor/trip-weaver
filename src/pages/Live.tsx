import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTripMember } from '@/hooks/useTripMember';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import TimelineHeader from '@/components/timeline/TimelineHeader';
import TripNavBar from '@/components/timeline/TripNavBar';
import type { Trip } from '@/types/trip';

const Live = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const { member: currentUser, isAuthenticated, loading: memberLoading } = useTripMember(tripId);
  const { session } = useAdminAuth();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);

  useEffect(() => {
    if (memberLoading) return;
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
    if (!currentUser) {
      navigate('/');
    }
  }, [memberLoading, isAuthenticated, currentUser, navigate]);

  const fetchTrip = useCallback(async () => {
    if (!tripId) return;
    const { data } = await supabase.from('trips').select('*').eq('id', tripId).single();
    if (data) setTrip(data as unknown as Trip);
  }, [tripId]);

  useEffect(() => { fetchTrip(); }, [fetchTrip]);

  if (!currentUser) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TimelineHeader
        trip={trip}
        tripId={tripId ?? ''}
      />
      <TripNavBar liveOpen={false} plannerOpen={false} isMobile={false} onToggleLive={() => {}} onTogglePlanner={() => {}} onTimelineOnly={() => navigate(`/trip/${tripId}/timeline`)} />

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Radio className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold">Live View</h2>
          <p className="mt-1 text-sm text-muted-foreground">Track your trip in real-time — coming soon</p>
        </div>
      </div>
    </div>
  );
};

export default Live;

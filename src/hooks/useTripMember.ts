import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from './useAdminAuth';

interface TripMember {
  id: string;
  userId: string;
  name: string;
  role: 'organizer' | 'editor' | 'viewer';
  tripId: string;
}

export function useTripMember(tripId: string | undefined) {
  const { session, loading: authLoading } = useAdminAuth();
  const [member, setMember] = useState<TripMember | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMembership = useCallback(async () => {
    if (!tripId || !session?.user) {
      setMember(null);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('trip_users')
      .select('id, name, role, trip_id, user_id')
      .eq('trip_id', tripId)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (data) {
      setMember({
        id: data.id,
        userId: session.user.id,
        name: data.name,
        role: data.role as TripMember['role'],
        tripId: data.trip_id!,
      });
    } else {
      setMember(null);
    }
    setLoading(false);
  }, [tripId, session?.user?.id]);

  useEffect(() => {
    if (authLoading) return;
    fetchMembership();
  }, [authLoading, fetchMembership]);

  const isOrganiser = member?.role === 'organizer';
  const isEditor = member?.role === 'organizer' || member?.role === 'editor';
  const isViewer = !!member;

  return {
    member,
    loading: authLoading || loading,
    isAuthenticated: !!session,
    isOrganiser,
    isEditor,
    isViewer,
    refetch: fetchMembership,
  };
}

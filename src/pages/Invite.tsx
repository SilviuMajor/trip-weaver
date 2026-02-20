import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useProfile } from '@/hooks/useProfile';
import { toast } from '@/hooks/use-toast';
import Brand from '@/components/Brand';
import { Loader2 } from 'lucide-react';

const Invite = () => {
  const { code } = useParams<{ code: string }>();
  const { session, loading: authLoading } = useAdminAuth();
  const { displayName } = useProfile(session?.user?.id);
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'joining' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!session) {
      const returnUrl = `/invite/${code}`;
      navigate(`/auth?redirect=${encodeURIComponent(returnUrl)}`);
      return;
    }

    const joinTrip = async () => {
      setStatus('joining');

      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .select('id, name')
        .eq('invite_code', code as string)
        .maybeSingle();

      if (tripError || !trip) {
        setStatus('error');
        setErrorMsg('This invite link is invalid or has expired.');
        return;
      }

      const { data: existing } = await supabase
        .from('trip_users')
        .select('id')
        .eq('trip_id', trip.id)
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (existing) {
        toast({ title: `Welcome back to ${trip.name}!` });
        navigate(`/trip/${trip.id}/timeline`);
        return;
      }

      const name = displayName || session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Member';
      const { error: joinError } = await supabase
        .from('trip_users')
        .insert({
          trip_id: trip.id,
          user_id: session.user.id,
          name,
          role: 'viewer',
        } as any);

      if (joinError) {
        setStatus('error');
        setErrorMsg('Failed to join trip. Please try again.');
        console.error('Join error:', joinError);
        return;
      }

      toast({ title: `You've joined ${trip.name}! 🎉` });
      navigate(`/trip/${trip.id}/timeline`);
    };

    joinTrip();
  }, [authLoading, session, code, navigate, displayName]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-sm text-center"
      >
        <div className="mb-8">
          <Brand size="xl" />
        </div>

        {status === 'error' ? (
          <div className="space-y-4">
            <p className="text-muted-foreground">{errorMsg}</p>
            <button
              onClick={() => navigate('/')}
              className="text-sm text-primary hover:underline"
            >
              Go to dashboard
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-muted-foreground">
              {status === 'loading' ? 'Loading...' : 'Joining trip...'}
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Invite;

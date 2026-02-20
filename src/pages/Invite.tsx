import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useProfile } from '@/hooks/useProfile';
import { toast } from '@/hooks/use-toast';
import Brand from '@/components/Brand';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, MapPin, LogIn, UserPlus } from 'lucide-react';

type InviteStatus = 'loading' | 'ready' | 'joining' | 'error';

interface TripPreview {
  id: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  emoji: string | null;
  image_url: string | null;
}

const Invite = () => {
  const { code } = useParams<{ code: string }>();
  const { session, loading: authLoading } = useAdminAuth();
  const { displayName } = useProfile(session?.user?.id);
  const navigate = useNavigate();
  const [status, setStatus] = useState<InviteStatus>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [trip, setTrip] = useState<TripPreview | null>(null);

  // Step 1: Fetch trip info
  useEffect(() => {
    if (!code) return;

    const fetchTrip = async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('id, name, destination, start_date, end_date, emoji, image_url')
        .eq('invite_code', code)
        .maybeSingle();

      if (error || !data) {
        setStatus('error');
        setErrorMsg('This invite link is invalid or has expired.');
        return;
      }

      setTrip(data as TripPreview);
      setStatus('ready');
    };

    fetchTrip();
  }, [code]);

  // Step 2: Auto-join if logged in
  useEffect(() => {
    if (authLoading || status !== 'ready' || !trip) return;
    if (!session) return;

    const joinTrip = async () => {
      setStatus('joining');

      const { data: existing } = await supabase
        .from('trip_users')
        .select('id')
        .eq('trip_id', trip.id)
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (existing) {
        toast({ title: `Welcome back to ${trip.name}!` });
        navigate('/');
        return;
      }

      const name =
        displayName ||
        session.user.user_metadata?.display_name ||
        session.user.email?.split('@')[0] ||
        'Member';

      const { error: joinError } = await supabase
        .from('trip_users')
        .insert({
          trip_id: trip.id,
          user_id: session.user.id,
          name,
          role: 'viewer',
        });

      if (joinError) {
        setStatus('error');
        setErrorMsg('Failed to join trip. Please try again.');
        console.error('Join error:', joinError);
        return;
      }

      toast({ title: `You've joined ${trip.name}! 🎉` });
      navigate('/');
    };

    joinTrip();
  }, [authLoading, session, status, trip, navigate, displayName]);

  const formatDateRange = (start: string | null, end: string | null) => {
    if (!start || !end) return null;
    try {
      const s = new Date(start);
      const e = new Date(end);
      return `${s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — ${e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    } catch {
      return null;
    }
  };

  const handleGoToAuth = (mode: 'login' | 'signup') => {
    const returnUrl = `/invite/${code}`;
    navigate(`/auth?redirect=${encodeURIComponent(returnUrl)}${mode === 'signup' ? '&signup=true' : ''}`);
  };

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

        {/* Error */}
        {status === 'error' && (
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted text-3xl">
              😕
            </div>
            <p className="text-muted-foreground">{errorMsg}</p>
            <button
              onClick={() => navigate('/')}
              className="text-sm text-primary hover:underline"
            >
              Go to dashboard
            </button>
          </div>
        )}

        {/* Loading trip */}
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading invite...</p>
          </div>
        )}

        {/* Joining */}
        {status === 'joining' && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-muted-foreground">Joining {trip?.name}...</p>
          </div>
        )}

        {/* Ready — not logged in */}
        {status === 'ready' && trip && !session && (
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <div className="flex h-28 items-center justify-center bg-muted text-5xl">
                {trip.image_url ? (
                  <img
                    src={trip.image_url}
                    alt={trip.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  trip.emoji || '✈️'
                )}
              </div>
              <CardContent className="space-y-2 p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  You've been invited to
                </p>
                <h2 className="text-xl font-bold">{trip.name}</h2>
                {trip.destination && (
                  <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {trip.destination}
                  </div>
                )}
                {formatDateRange(trip.start_date, trip.end_date) && (
                  <p className="text-sm text-muted-foreground">
                    {formatDateRange(trip.start_date, trip.end_date)}
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sign up or log in to join this trip
              </p>
              <Button className="w-full" onClick={() => handleGoToAuth('signup')}>
                <UserPlus className="mr-2 h-4 w-4" />
                Sign Up to Join
              </Button>
              <Button variant="outline" className="w-full" onClick={() => handleGoToAuth('login')}>
                <LogIn className="mr-2 h-4 w-4" />
                I Already Have an Account
              </Button>
            </div>
          </div>
        )}

        {/* Ready — logged in, brief flash before auto-join */}
        {status === 'ready' && trip && session && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-muted-foreground">Joining {trip.name}...</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Invite;

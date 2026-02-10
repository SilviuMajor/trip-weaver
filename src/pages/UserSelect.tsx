import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Users, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { TripUser } from '@/types/trip';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAdminAuth } from '@/hooks/useAdminAuth';

const UserSelect = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const [users, setUsers] = useState<TripUser[]>([]);
  const [tripName, setTripName] = useState('');
  const [loading, setLoading] = useState(true);
  const { currentUser, login } = useCurrentUser();
  const { adminUser, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [ownerBypassAttempted, setOwnerBypassAttempted] = useState(false);

  // PIN dialog state
  const [pinUser, setPinUser] = useState<TripUser | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // If already logged in as a trip member, go straight to timeline
  useEffect(() => {
    if (currentUser) {
      navigate(`/trip/${tripId}/timeline`);
    }
  }, [currentUser, navigate, tripId]);

  // Auto-bypass: if authenticated owner, auto-create trip_user and enter
  useEffect(() => {
    if (authLoading || !tripId || ownerBypassAttempted || currentUser) return;

    if (!adminUser) {
      setOwnerBypassAttempted(true);
      return;
    }

    const autoEnter = async () => {
      const { data: trip } = await supabase
        .from('trips')
        .select('owner_id, name')
        .eq('id', tripId)
        .single();

      if (!trip || trip.owner_id !== adminUser.id) {
        setOwnerBypassAttempted(true);
        return;
      }

      const { data: existing } = await supabase
        .from('trip_users')
        .select('*')
        .eq('trip_id', tripId)
        .eq('role', 'organizer')
        .limit(1)
        .maybeSingle();

      if (existing) {
        login(existing as TripUser);
        navigate(`/trip/${tripId}/timeline`);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', adminUser.id)
        .maybeSingle();

      const name = profile?.display_name || adminUser.email?.split('@')[0] || 'Organizer';

      const { data: newUser } = await supabase
        .from('trip_users')
        .insert({ trip_id: tripId, name, role: 'organizer' })
        .select()
        .single();

      if (newUser) {
        login(newUser as TripUser);
        navigate(`/trip/${tripId}/timeline`);
      } else {
        setOwnerBypassAttempted(true);
      }
    };

    autoEnter();
  }, [adminUser, authLoading, tripId, ownerBypassAttempted, currentUser, login, navigate]);

  useEffect(() => {
    if (!tripId) return;

    const fetchData = async () => {
      const [usersRes, tripRes] = await Promise.all([
        supabase.from('trip_users').select('*').eq('trip_id', tripId).order('name'),
        supabase.from('trips').select('name').eq('id', tripId).single(),
      ]);

      if (usersRes.data) setUsers(usersRes.data as TripUser[]);
      if (tripRes.data) setTripName(tripRes.data.name);
      setLoading(false);
    };

    fetchData();
  }, [tripId]);

  const handleSelectUser = (user: TripUser) => {
    if (user.pin_hash) {
      setPinUser(user);
      setPinInput('');
      setPinError(false);
    } else {
      login(user);
      navigate(`/trip/${tripId}/timeline`);
    }
  };

  const handlePinSubmit = () => {
    if (!pinUser) return;
    if (pinInput === pinUser.pin_hash) {
      login(pinUser);
      navigate(`/trip/${tripId}/timeline`);
      setPinUser(null);
    } else {
      setPinError(true);
    }
  };

  if (authLoading || (!ownerBypassAttempted && adminUser)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-sm"
      >
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/15 text-4xl">
            🧳
          </div>
          <h1 className="mb-2 text-3xl font-bold tracking-tight">
            {tripName || 'Trip Planner'}
          </h1>
          <p className="text-muted-foreground">Select your name to get started</p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No members yet. The trip organizer needs to add members.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((user, index) => (
              <motion.button
                key={user.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                onClick={() => handleSelectUser(user)}
                className="flex w-full items-center gap-3 rounded-2xl border-2 border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-lg active:scale-[0.98]"
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: `hsl(${(index * 47 + 20) % 360}, 65%, 55%)` }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{user.name}</p>
                  <p className="text-xs capitalize text-muted-foreground">{user.role}</p>
                </div>
                {user.pin_hash && <Lock className="h-4 w-4 text-muted-foreground" />}
              </motion.button>
            ))}
          </div>
        )}
      </motion.div>

      {/* PIN Dialog */}
      <Dialog open={!!pinUser} onOpenChange={(open) => { if (!open) setPinUser(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Enter PIN for {pinUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="password"
              maxLength={6}
              placeholder="Enter PIN"
              value={pinInput}
              onChange={e => { setPinInput(e.target.value); setPinError(false); }}
              onKeyDown={e => { if (e.key === 'Enter') handlePinSubmit(); }}
              autoFocus
              className={pinError ? 'border-destructive' : ''}
            />
            {pinError && <p className="text-sm text-destructive">Incorrect PIN</p>}
            <Button onClick={handlePinSubmit} className="w-full">Enter</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserSelect;

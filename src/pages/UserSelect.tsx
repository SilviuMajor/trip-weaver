import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Users } from 'lucide-react';
import type { TripUser } from '@/types/trip';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const UserSelect = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const [users, setUsers] = useState<TripUser[]>([]);
  const [tripName, setTripName] = useState('');
  const [loading, setLoading] = useState(true);
  const { currentUser, login } = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      navigate(`/trip/${tripId}/timeline`);
    }
  }, [currentUser, navigate, tripId]);

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
    login(user);
    navigate(`/trip/${tripId}/timeline`);
  };

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
              </motion.button>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default UserSelect;

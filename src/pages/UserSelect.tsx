import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Users } from 'lucide-react';
import type { TripUser } from '@/types/trip';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const UserSelect = () => {
  const [users, setUsers] = useState<TripUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentUser, login } = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      navigate('/trip');
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from('trip_users')
        .select('*')
        .order('name');

      if (!error && data) {
        setUsers(data as TripUser[]);
      }
      setLoading(false);
    };

    fetchUsers();
  }, []);

  const handleSelectUser = (user: TripUser) => {
    login(user);
    navigate('/trip');
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
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <MapPin className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mb-2 text-3xl font-bold tracking-tight">Trip Planner</h1>
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
              No users yet. Add some users in the backend to get started.
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
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow-md active:scale-[0.98]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
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

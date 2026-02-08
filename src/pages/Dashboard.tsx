import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Calendar, MapPin, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { format, parseISO } from 'date-fns';
import type { Trip } from '@/types/trip';

const Dashboard = () => {
  const { adminUser, isAdmin, loading: authLoading, signOut } = useAdminAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/auth');
    }
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    if (!adminUser) return;

    const fetchTrips = async () => {
      const { data } = await supabase
        .from('trips')
        .select('*')
        .eq('owner_id', adminUser.id)
        .order('start_date', { ascending: false });

      setTrips((data ?? []) as unknown as Trip[]);
      setLoading(false);
    };

    fetchTrips();
  }, [adminUser]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold">My Trips</h1>
            <p className="text-sm text-muted-foreground">{adminUser?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate('/trip/new')} size="sm">
              <Plus className="mr-1 h-4 w-4" />
              New Trip
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : trips.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <MapPin className="h-8 w-8 text-primary" />
            </div>
            <h2 className="mb-2 text-xl font-bold">No trips yet</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Create your first trip to start planning
            </p>
            <Button onClick={() => navigate('/trip/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Create Trip
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {trips.map((trip, i) => (
              <motion.button
                key={trip.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/trip/${trip.id}`)}
                className="flex w-full items-start gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-display text-lg font-bold">{trip.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {format(parseISO(trip.start_date), 'd MMM')} — {format(parseISO(trip.end_date), 'd MMM yyyy')}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;

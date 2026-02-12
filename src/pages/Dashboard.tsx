import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, LogOut, Settings, MoreVertical, Link2, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useProfile } from '@/hooks/useProfile';
import { format, parseISO } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import type { Trip } from '@/types/trip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const CARD_COLORS = [
  'hsl(24, 90%, 52%)',
  'hsl(340, 75%, 55%)',
  'hsl(262, 70%, 55%)',
  'hsl(173, 70%, 40%)',
  'hsl(45, 90%, 50%)',
];

const Dashboard = () => {
  const { adminUser, isAdmin, loading: authLoading, signOut } = useAdminAuth();
  const { displayName } = useProfile(adminUser?.id);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripDestinations, setTripDestinations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [deleteTrip, setDeleteTrip] = useState<Trip | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/auth');
    }
  }, [authLoading, isAdmin, navigate]);

  const fetchTrips = async () => {
    if (!adminUser) return;
    const { data } = await supabase
      .from('trips')
      .select('*')
      .eq('owner_id', adminUser.id)
      .order('start_date', { ascending: false });

    const fetchedTrips = (data ?? []) as unknown as Trip[];
    setTrips(fetchedTrips);

    // Auto-generate destination list from entry data
    if (fetchedTrips.length > 0) {
      const tripIds = fetchedTrips.map(t => t.id);
      const { data: entries } = await supabase
        .from('entries')
        .select('id, trip_id')
        .in('trip_id', tripIds);
      if (entries && entries.length > 0) {
        const entryIds = entries.map(e => e.id);
        const { data: options } = await supabase
          .from('entry_options')
          .select('entry_id, location_name, arrival_location, category')
          .in('entry_id', entryIds);
        if (options) {
          const entryTripMap = new Map<string, string>();
          entries.forEach(e => entryTripMap.set(e.id, e.trip_id));

          const destMap: Record<string, Set<string>> = {};
          options.forEach(opt => {
            if (opt.category === 'transfer' || opt.category === 'airport_processing') return;
            const tid = entryTripMap.get(opt.entry_id);
            if (!tid) return;
            if (!destMap[tid]) destMap[tid] = new Set();
            const loc = opt.arrival_location || opt.location_name;
            if (loc) {
              const city = loc.split(',')[0].split(' - ').pop()?.trim();
              if (city) destMap[tid].add(city);
            }
          });

          const result: Record<string, string> = {};
          for (const [tid, cities] of Object.entries(destMap)) {
            if (cities.size > 0) result[tid] = [...cities].slice(0, 4).join(', ');
          }
          setTripDestinations(result);
        }
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!adminUser) return;
    fetchTrips();
  }, [adminUser]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleCopyLink = (tripId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/trip/${tripId}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copied!', description: 'Share this link with your trip members.' });
  };

  const handleDeleteTrip = async () => {
    if (!deleteTrip) return;
    await supabase.from('trips').delete().eq('id', deleteTrip.id);
    setDeleteTrip(null);
    fetchTrips();
    toast({ title: 'Trip deleted' });
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
            <p className="text-sm text-muted-foreground">{displayName || adminUser?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate('/trip/new')} size="sm">
              <Plus className="mr-1 h-4 w-4" />
              New Trip
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
              <Settings className="h-4 w-4" />
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
            <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/15 text-4xl">
              🗺️
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
              <motion.div
                key={trip.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/trip/${trip.id}`)}
                className="flex w-full cursor-pointer items-start gap-4 rounded-2xl border-2 border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-lg"
                style={{ borderLeftColor: CARD_COLORS[i % CARD_COLORS.length], borderLeftWidth: 4 }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-2xl overflow-hidden">
                  {trip.image_url ? (
                    <img src={trip.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (trip as any).emoji || '✈️'
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-display text-lg font-bold">{trip.name}</h3>
                  {(tripDestinations[trip.id] || trip.destination) && (
                    <p className="truncate text-sm text-muted-foreground">📍 {tripDestinations[trip.id] || trip.destination}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {trip.start_date && trip.end_date
                      ? `${format(parseISO(trip.start_date), 'd MMM')} — ${format(parseISO(trip.end_date), 'd MMM yyyy')}`
                      : trip.duration_days
                        ? `${trip.duration_days}-day trip`
                        : 'Dates TBD'}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/trip/${trip.id}/settings`); }}>
                      <Settings className="mr-2 h-4 w-4" />
                      Trip Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => handleCopyLink(trip.id, e)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Share Link
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteTrip(trip); }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Trip
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <AlertDialog open={!!deleteTrip} onOpenChange={(open) => !open && setDeleteTrip(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTrip?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this trip and all its entries. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTrip} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;

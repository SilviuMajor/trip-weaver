import { useState } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { LogOut, Lock, Unlock, Route, CloudSun, Loader2, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { differenceInDays, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Trip, EntryWithOptions } from '@/types/trip';

interface TimelineHeaderProps {
  trip: Trip | null;
  tripId: string;
  onDataRefresh?: () => void;
  onAutoGenerateTransport?: () => void;
  autoTransportLoading?: boolean;
  scheduledEntries?: EntryWithOptions[];
}

const TimelineHeader = ({ trip, tripId, onDataRefresh, onAutoGenerateTransport, autoTransportLoading, scheduledEntries = [] }: TimelineHeaderProps) => {
  const { currentUser, logout, isOrganizer } = useCurrentUser();
  const navigate = useNavigate();
  const [weatherLoading, setWeatherLoading] = useState(false);

  const isUndated = !trip?.start_date;
  const daysUntilTrip = trip?.start_date ? differenceInDays(parseISO(trip.start_date), new Date()) : null;
  const weatherDisabled = isUndated || (daysUntilTrip !== null && daysUntilTrip > 14);
  const weatherTitle = isUndated
    ? 'Set dates first to fetch weather'
    : daysUntilTrip !== null && daysUntilTrip > 14
      ? 'Weather available within 14 days of trip'
      : 'Update weather';

  const handleLogout = () => {
    logout();
    navigate(`/trip/${tripId}`);
  };

  const handleToggleLock = async () => {
    if (!trip) return;
    await supabase.from('trips').update({ voting_locked: !trip.voting_locked }).eq('id', trip.id);
  };

  const handleUpdateWeather = async () => {
    if (!tripId || !trip) return;
    setWeatherLoading(true);
    try {
      const flights = scheduledEntries
        .filter(e => e.options[0]?.category === 'flight' && e.options[0]?.departure_tz)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      let segments: Array<{ lat: number; lng: number; startDate: string; endDate: string }> = [];

      if (flights.length > 0 && trip.start_date && trip.end_date) {
        let currentDate = trip.start_date;
        for (const flight of flights) {
          const opt = flight.options[0];
          const flightDate = flight.start_time.substring(0, 10);
          if (opt.latitude != null && opt.longitude != null && currentDate <= flightDate) {
            segments.push({ lat: opt.latitude, lng: opt.longitude, startDate: currentDate, endDate: flightDate });
          }
          currentDate = flight.end_time.substring(0, 10);
        }
        const lastFlightOpt = flights[flights.length - 1].options[0];
        if (lastFlightOpt.latitude != null && lastFlightOpt.longitude != null && currentDate <= trip.end_date) {
          segments.push({ lat: lastFlightOpt.latitude, lng: lastFlightOpt.longitude, startDate: currentDate, endDate: trip.end_date });
        }
      }

      if (segments.length === 0) {
        segments = [{ lat: 52.37, lng: 4.90, startDate: trip.start_date!, endDate: trip.end_date! }];
      }

      const { data, error } = await supabase.functions.invoke('fetch-weather', { body: { tripId, segments } });
      if (error) throw error;
      toast({ title: data?.message ?? 'Weather updated' });
      onDataRefresh?.();
    } catch (err: any) {
      toast({ title: 'Failed to update weather', description: err.message, variant: 'destructive' });
    } finally {
      setWeatherLoading(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        {/* Left: Trip info */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
            className="h-8 w-8 shrink-0 overflow-hidden"
            title="My Trips"
          >
            {trip?.image_url ? (
              <img src={trip.image_url} alt="" className="h-6 w-6 rounded-full object-cover" />
            ) : (
              <span className="text-base">{trip?.emoji || '✈️'}</span>
            )}
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight">{trip?.name || 'Trip Planner'}</h1>
            {currentUser && (
              <p className="text-xs text-muted-foreground">Hey, {currentUser.name}</p>
            )}
          </div>
        </div>

        {/* Right: Settings + Exit */}
        <div className="flex items-center gap-1">
          {isOrganizer && (
            <Button variant="ghost" size="icon" onClick={() => navigate(`/trip/${tripId}/settings`)} className="h-8 w-8" title="Trip settings">
              <Settings className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Organizer tools row */}
      {isOrganizer && trip && (
        <div className="mx-auto flex max-w-2xl items-center gap-1 px-4 pb-2">
          <Button variant="ghost" size="icon" onClick={handleToggleLock} className="h-7 w-7" title={trip.voting_locked ? 'Unlock voting' : 'Lock voting'}>
            {trip.voting_locked ? <Lock className="h-3.5 w-3.5 text-destructive" /> : <Unlock className="h-3.5 w-3.5 text-muted-foreground" />}
          </Button>
          {onAutoGenerateTransport && (
            <Button variant="ghost" size="icon" onClick={onAutoGenerateTransport} className="h-7 w-7" disabled={autoTransportLoading} title="Auto-generate transport">
              {autoTransportLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Route className="h-3.5 w-3.5 text-muted-foreground" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={handleUpdateWeather} className="h-7 w-7" disabled={weatherLoading || weatherDisabled} title={weatherTitle}>
            {weatherLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudSun className={cn('h-3.5 w-3.5', weatherDisabled ? 'text-muted-foreground/40' : 'text-muted-foreground')} />}
          </Button>
        </div>
      )}
    </header>
  );
};

export default TimelineHeader;

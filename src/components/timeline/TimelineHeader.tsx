import { useState } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { LogOut, Lock, Unlock, Plus, Route, CloudSun, Loader2, Settings, Home, Lightbulb } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { differenceInDays, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Trip, EntryWithOptions } from '@/types/trip';

interface TimelineHeaderProps {
  trip: Trip | null;
  tripId: string;
  onAddEntry?: () => void;
  onDataRefresh?: () => void;
  onToggleIdeas?: () => void;
  ideasCount?: number;
  scheduledEntries?: EntryWithOptions[];
}

const TimelineHeader = ({ trip, tripId, onAddEntry, onDataRefresh, onToggleIdeas, ideasCount = 0, scheduledEntries = [] }: TimelineHeaderProps) => {
  const { currentUser, logout, isOrganizer, isEditor } = useCurrentUser();
  const navigate = useNavigate();
  const [travelLoading, setTravelLoading] = useState(false);
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
    await supabase
      .from('trips')
      .update({ voting_locked: !trip.voting_locked })
      .eq('id', trip.id);
  };

  const handleGenerateTravel = async () => {
    if (!tripId) return;
    setTravelLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-directions', {
        body: { tripId },
      });
      if (error) throw error;
      toast({ title: `Generated ${data?.segments?.length ?? 0} travel segments` });
      onDataRefresh?.();
    } catch (err: any) {
      toast({ title: 'Failed to generate travel times', description: err.message, variant: 'destructive' });
    } finally {
      setTravelLoading(false);
    }
  };

  const handleUpdateWeather = async () => {
    if (!tripId || !trip) return;
    setWeatherLoading(true);
    try {
      // Build location segments from flights
      const flights = scheduledEntries
        .filter(e => e.options[0]?.category === 'flight' && e.options[0]?.departure_tz)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      let segments: Array<{ lat: number; lng: number; startDate: string; endDate: string }> = [];

      if (flights.length > 0 && trip.start_date && trip.end_date) {
        let currentDate = trip.start_date;

        for (const flight of flights) {
          const opt = flight.options[0];
          const flightDate = flight.start_time.substring(0, 10);

          // Segment before this flight: use departure coords
          if (opt.latitude != null && opt.longitude != null && currentDate <= flightDate) {
            segments.push({
              lat: opt.latitude,
              lng: opt.longitude,
              startDate: currentDate,
              endDate: flightDate,
            });
          }

          // After flight: update currentDate to flight arrival date
          currentDate = flight.end_time.substring(0, 10);
        }

        // Segment after last flight to trip end
        const lastFlightOpt = flights[flights.length - 1].options[0];
        if (lastFlightOpt.latitude != null && lastFlightOpt.longitude != null && currentDate <= trip.end_date) {
          segments.push({
            lat: lastFlightOpt.latitude,
            lng: lastFlightOpt.longitude,
            startDate: currentDate,
            endDate: trip.end_date,
          });
        }
      }

      // Fallback: if no segments built, use Amsterdam defaults
      if (segments.length === 0) {
        segments = [{ lat: 52.37, lng: 4.90, startDate: trip.start_date!, endDate: trip.end_date! }];
      }

      const { data, error } = await supabase.functions.invoke('fetch-weather', {
        body: { tripId, segments },
      });
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
            <h1 className="truncate text-lg font-bold leading-tight">
              {trip?.name || 'Trip Planner'}
            </h1>
            {currentUser && (
              <p className="text-xs text-muted-foreground">
                Hey, {currentUser.name}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Organizer-only buttons */}
          {isOrganizer && trip && (
            <>
              <Button variant="ghost" size="icon" onClick={handleToggleLock} className="h-8 w-8" title={trip.voting_locked ? 'Unlock voting' : 'Lock voting'}>
                {trip.voting_locked ? <Lock className="h-4 w-4 text-destructive" /> : <Unlock className="h-4 w-4 text-muted-foreground" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleGenerateTravel} className="h-8 w-8" disabled={travelLoading} title="Generate travel times">
                {travelLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4 text-muted-foreground" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleUpdateWeather} className="h-8 w-8" disabled={weatherLoading || weatherDisabled} title={weatherTitle}>
                {weatherLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudSun className={cn('h-4 w-4', weatherDisabled ? 'text-muted-foreground/40' : 'text-muted-foreground')} />}
              </Button>
            </>
          )}

          {isEditor && onAddEntry && (
            <Button variant="ghost" size="icon" onClick={onAddEntry} className="h-8 w-8">
              <Plus className="h-4 w-4" />
            </Button>
          )}

          {/* Ideas toggle - desktop only */}
          {onToggleIdeas && (
            <Button variant="ghost" size="icon" onClick={onToggleIdeas} className="h-8 w-8 relative hidden md:flex" title="Ideas panel">
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
              {ideasCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {ideasCount}
                </span>
              )}
            </Button>
          )}

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
    </header>
  );
};

export default TimelineHeader;

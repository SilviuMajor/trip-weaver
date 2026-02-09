import { useState } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { LogOut, Lock, Unlock, Plus, Route, CloudSun, Loader2, Settings, Home, Lightbulb } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { differenceInDays, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Trip } from '@/types/trip';

interface TimelineHeaderProps {
  trip: Trip | null;
  tripId: string;
  onAddEntry?: () => void;
  onDataRefresh?: () => void;
  onToggleIdeas?: () => void;
  ideasCount?: number;
}

const TimelineHeader = ({ trip, tripId, onAddEntry, onDataRefresh, onToggleIdeas, ideasCount = 0 }: TimelineHeaderProps) => {
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
    if (!tripId) return;
    setWeatherLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-weather', {
        body: { tripId, lat: 52.37, lng: 4.90 },
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
            className="h-8 w-8 shrink-0"
            title="My Trips"
          >
            <Home className="h-4 w-4" />
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

import { useState } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { LogOut, Globe, Lock, Unlock, Plus, Route, CloudSun, Loader2, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { differenceInDays, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Trip } from '@/types/trip';
import type { useTimezone } from '@/hooks/useTimezone';

interface TimelineHeaderProps {
  trip: Trip | null;
  tripId: string;
  timezone: ReturnType<typeof useTimezone>['timezone'];
  onToggleTimezone: () => void;
  timezoneLabel: string;
  onAddEntry?: () => void;
  onDataRefresh?: () => void;
}

const TimelineHeader = ({ trip, tripId, timezone, onToggleTimezone, timezoneLabel, onAddEntry, onDataRefresh }: TimelineHeaderProps) => {
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
      // Default to Amsterdam coordinates; could be enhanced to use trip location
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
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold leading-tight">
            {trip?.name || 'Trip Planner'}
          </h1>
          {currentUser && (
            <p className="text-xs text-muted-foreground">
              Hey, {currentUser.name}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Organizer-only buttons */}
          {isOrganizer && trip && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleLock}
                className="h-8 w-8"
                title={trip.voting_locked ? 'Unlock voting' : 'Lock voting'}
              >
                {trip.voting_locked ? (
                  <Lock className="h-4 w-4 text-destructive" />
                ) : (
                  <Unlock className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleGenerateTravel}
                className="h-8 w-8"
                disabled={travelLoading}
                title="Generate travel times"
              >
                {travelLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Route className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleUpdateWeather}
                className="h-8 w-8"
                disabled={weatherLoading || weatherDisabled}
                title={weatherTitle}
              >
                {weatherLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CloudSun className={cn('h-4 w-4', weatherDisabled ? 'text-muted-foreground/40' : 'text-muted-foreground')} />
                )}
              </Button>
            </>
          )}

          {/* Add entry button (organizer/editor) */}
          {isEditor && onAddEntry && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onAddEntry}
              className="h-8 w-8"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}

          {/* Trip settings (organizer only) */}
          {isOrganizer && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/trip/${tripId}/settings`)}
              className="h-8 w-8"
              title="Trip settings"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}

          {/* Timezone toggle */}
          <div className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            <Label htmlFor="tz-toggle" className="cursor-pointer text-xs text-muted-foreground">
              {timezone === 'UK' ? 'UK' : 'AMS'}
            </Label>
            <Switch
              id="tz-toggle"
              checked={timezone === 'Amsterdam'}
              onCheckedChange={onToggleTimezone}
              className="scale-75"
            />
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="h-8 w-8"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default TimelineHeader;

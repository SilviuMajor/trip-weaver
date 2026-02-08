import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { LogOut, Globe, Lock, Unlock, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Trip } from '@/types/trip';
import type { useTimezone } from '@/hooks/useTimezone';

interface TimelineHeaderProps {
  trip: Trip | null;
  timezone: ReturnType<typeof useTimezone>['timezone'];
  onToggleTimezone: () => void;
  timezoneLabel: string;
  onAddEntry?: () => void;
}

const TimelineHeader = ({ trip, timezone, onToggleTimezone, timezoneLabel, onAddEntry }: TimelineHeaderProps) => {
  const { currentUser, logout, isOrganizer, isEditor } = useCurrentUser();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleToggleLock = async () => {
    if (!trip) return;
    await supabase
      .from('trips')
      .update({ voting_locked: !trip.voting_locked })
      .eq('id', trip.id);
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

        <div className="flex items-center gap-2">
          {/* Lock voting toggle (organizer only) */}
          {isOrganizer && trip && (
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

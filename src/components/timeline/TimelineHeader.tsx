import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTimezone } from '@/hooks/useTimezone';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { LogOut, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Trip } from '@/types/trip';

interface TimelineHeaderProps {
  trip: Trip | null;
  timezone: ReturnType<typeof useTimezone>['timezone'];
  onToggleTimezone: () => void;
  timezoneLabel: string;
}

const TimelineHeader = ({ trip, timezone, onToggleTimezone, timezoneLabel }: TimelineHeaderProps) => {
  const { currentUser, logout } = useCurrentUser();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
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

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
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

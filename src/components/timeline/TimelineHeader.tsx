import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { LogOut, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Trip } from '@/types/trip';

interface TimelineHeaderProps {
  trip: Trip | null;
  tripId: string;
}

const TimelineHeader = ({ trip, tripId }: TimelineHeaderProps) => {
  const { currentUser, logout, isOrganizer } = useCurrentUser();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate(`/trip/${tripId}`);
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
    </header>
  );
};

export default TimelineHeader;

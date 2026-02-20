import { useTripMember } from '@/hooks/useTripMember';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Button } from '@/components/ui/button';
import { Home, MoreVertical, Settings, RefreshCw, User, Moon, Sun, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from 'next-themes';
import type { Trip } from '@/types/trip';

interface TimelineHeaderProps {
  trip: Trip | null;
  tripId: string;
  onRefresh?: () => Promise<void>;
  refreshing?: boolean;
}

const TimelineHeader = ({ trip, tripId, onRefresh, refreshing }: TimelineHeaderProps) => {
  const { tripId: paramTripId } = useParams<{ tripId: string }>();
  const effectiveTripId = paramTripId || tripId;
  const { member: currentUser, isOrganiser: isOrganizer } = useTripMember(effectiveTripId);
  const { signOut } = useAdminAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-lg will-change-transform">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        {/* Left: Home + Trip info */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="h-8 w-8 shrink-0"
            title="Dashboard"
          >
            <Home className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight">{trip?.name || 'tr1p'}</h1>
            {currentUser && (
              <p className="text-xs text-muted-foreground">Hey, {currentUser.name}</p>
            )}
          </div>
        </div>

        {/* Right: Refresh + Overflow menu */}
        <div className="flex items-center gap-1">
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={refreshing}
              className="h-8 w-8"
              title="Refresh weather & routes"
            >
              <RefreshCw className={`h-4 w-4 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isOrganizer && (
                <DropdownMenuItem onClick={() => navigate(`/trip/${tripId}/settings`)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Trip Settings
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <User className="mr-2 h-4 w-4" />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? (
                  <Sun className="mr-2 h-4 w-4" />
                ) : (
                  <Moon className="mr-2 h-4 w-4" />
                )}
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default TimelineHeader;

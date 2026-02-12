import { useNavigate } from 'react-router-dom';
import { Radio, Plus, ClipboardList, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TripNavBarProps {
  currentPage: 'timeline' | 'planner' | 'live';
  tripId: string;
  onAddEntry?: () => void;
  ideasCount?: number;
}

const TripNavBar = ({ currentPage, tripId, onAddEntry, ideasCount = 0 }: TripNavBarProps) => {
  const navigate = useNavigate();

  const navItems: Record<string, { left: { label: string; icon: React.ReactNode; page: string }; right: { label: string; icon: React.ReactNode; page: string } }> = {
    timeline: {
      left: { label: 'Live', icon: <Radio className="h-4 w-4" />, page: 'live' },
      right: { label: 'Planner', icon: <ClipboardList className="h-4 w-4" />, page: 'planner' },
    },
    planner: {
      left: { label: 'Live', icon: <Radio className="h-4 w-4" />, page: 'live' },
      right: { label: 'Timeline', icon: <Calendar className="h-4 w-4" />, page: 'timeline' },
    },
    live: {
      left: { label: 'Timeline', icon: <Calendar className="h-4 w-4" />, page: 'timeline' },
      right: { label: 'Planner', icon: <ClipboardList className="h-4 w-4" />, page: 'planner' },
    },
  };

  const { left, right } = navItems[currentPage];

  const navigateTo = (page: string) => {
    navigate(`/trip/${tripId}/${page}`);
  };

  return (
    <div className="sticky top-[57px] z-20 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2">
        {/* Left button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateTo(left.page)}
          className="h-9 gap-1.5 px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {left.icon}
          {left.label}
        </Button>

        {/* Centre + button */}
        <Button
          variant="default"
          size="icon"
          onClick={onAddEntry}
          className="h-12 w-12 rounded-full shadow-md"
        >
          <Plus className="h-5 w-5" />
        </Button>

        {/* Right button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateTo(right.page)}
          className="h-9 gap-1.5 px-3 text-xs font-medium text-muted-foreground hover:text-foreground relative"
        >
          {right.icon}
          {right.label}
          {right.page === 'planner' && ideasCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
              {ideasCount}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
};

export default TripNavBar;

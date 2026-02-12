import { Calendar, ClipboardList, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TripNavBarProps {
  liveOpen: boolean;
  plannerOpen: boolean;
  isMobile: boolean;
  mobileView?: 'timeline' | 'live';
  onToggleLive: () => void;
  onTogglePlanner: () => void;
  onTimelineOnly: () => void;
}

const TripNavBar = ({
  liveOpen,
  plannerOpen,
  isMobile,
  mobileView = 'timeline',
  onToggleLive,
  onTogglePlanner,
  onTimelineOnly,
}: TripNavBarProps) => {
  const tabs = [
    {
      key: 'live' as const,
      label: 'Live',
      icon: Radio,
      active: isMobile ? mobileView === 'live' : liveOpen,
      onClick: onToggleLive,
    },
    {
      key: 'timeline' as const,
      label: 'Timeline',
      icon: Calendar,
      active: isMobile ? mobileView === 'timeline' && !plannerOpen : !liveOpen && !plannerOpen,
      onClick: onTimelineOnly,
    },
    {
      key: 'planner' as const,
      label: 'Planner',
      icon: ClipboardList,
      active: isMobile ? plannerOpen : plannerOpen,
      onClick: onTogglePlanner,
    },
  ];

  return (
    <div className="sticky top-[57px] z-20 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-2xl">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={tab.onClick}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors',
              tab.active
                ? 'text-primary border-b-2 border-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TripNavBar;

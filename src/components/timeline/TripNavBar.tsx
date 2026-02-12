import { Calendar, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TripNavBarProps {
  activeTab: 'timeline' | 'planner';
  onTabChange: (tab: 'timeline' | 'planner') => void;
}

const TripNavBar = ({ activeTab, onTabChange }: TripNavBarProps) => {
  const tabs = [
    { key: 'timeline' as const, label: 'Timeline', icon: Calendar },
    { key: 'planner' as const, label: 'Planner', icon: ClipboardList },
  ];

  return (
    <div className="sticky top-[57px] z-20 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-2xl">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors',
              activeTab === tab.key
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

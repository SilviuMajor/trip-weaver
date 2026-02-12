import { Radio } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface LivePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compact?: boolean;
}

const LivePanel = ({ open, compact = false }: LivePanelProps) => {
  const isMobile = useIsMobile();

  const content = (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 bg-primary/5">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <Radio className="h-10 w-10 text-primary animate-pulse" />
        <span className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
      </div>
      <div className="text-center">
        <h3 className="font-display text-xl font-bold text-foreground">LIVE</h3>
        <p className="mt-1 text-sm text-muted-foreground">Coming soon</p>
        <p className="mt-2 max-w-[220px] text-xs text-muted-foreground/70">
          Live trip tracking, weather, and real-time updates
        </p>
      </div>
    </div>
  );

  // Mobile: rendered inline by parent (full-screen takeover), so just return content
  if (isMobile) {
    if (!open) return null;
    return (
      <div className="flex-1 overflow-y-auto">
        {content}
      </div>
    );
  }

  // Desktop: side panel
  return (
    <div
      className={cn(
        'shrink-0 border-r border-border bg-background overflow-y-auto transition-all duration-300',
        open
          ? compact
            ? 'w-[25vw]'
            : 'w-[30vw] max-w-[400px]'
          : 'w-0'
      )}
    >
      {open && content}
    </div>
  );
};

export default LivePanel;

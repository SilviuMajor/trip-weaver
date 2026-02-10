import { Radio } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface LivePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LivePanel = ({ open, onOpenChange }: LivePanelProps) => {
  const isMobile = useIsMobile();

  const content = (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Radio className="h-8 w-8 text-primary" />
      </div>
      <div className="text-center">
        <h3 className="font-display text-lg font-bold">LIVE</h3>
        <p className="mt-1 text-sm text-muted-foreground">Coming soon</p>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-full sm:w-[320px] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Live</SheetTitle>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  if (!open) return null;

  return (
    <div className={cn(
      'shrink-0 border-r border-border bg-background overflow-hidden transition-all duration-300',
      'w-[320px]'
    )}>
      {content}
    </div>
  );
};

export default LivePanel;

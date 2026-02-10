import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DayPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  days: string[];
  onSelectDay: (dayIndex: number) => void;
}

const DayPickerDialog = ({ open, onOpenChange, days, onSelectDay }: DayPickerDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Which day?
          </DialogTitle>
          <DialogDescription>
            Pick a day to place the entry on the timeline.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto space-y-1 py-2">
          {days.map((label, index) => (
            <Button
              key={index}
              variant="ghost"
              className={cn(
                'w-full justify-start text-left h-10 font-medium',
                'hover:bg-primary/10 hover:text-primary'
              )}
              onClick={() => {
                onSelectDay(index);
                onOpenChange(false);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DayPickerDialog;

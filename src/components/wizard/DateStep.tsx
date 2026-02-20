import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface DateStepProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  datesUnknown: boolean;
  onDatesUnknownChange: (v: boolean) => void;
  durationDays: number;
  onDurationDaysChange: (v: number) => void;
}

const DateStep = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  datesUnknown,
  onDatesUnknownChange,
  durationDays,
  onDurationDaysChange,
}: DateStepProps) => {
  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold">When are you going?</h2>
      <p className="mb-6 text-sm text-muted-foreground">Set your travel dates</p>

      <div className="mb-6 flex items-center gap-3">
        <Switch
          id="dates-unknown"
          checked={datesUnknown}
          onCheckedChange={onDatesUnknownChange}
        />
        <Label htmlFor="dates-unknown" className="cursor-pointer text-sm">
          I don't know when yet
        </Label>
      </div>

      {datesUnknown ? (
        <div className="space-y-2">
          <Label>How many days?</Label>
          <Input
            type="number"
            min={1}
            max={30}
            value={durationDays}
            onChange={(e) => onDurationDaysChange(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
          />
          <p className="text-xs text-muted-foreground">
            You can set exact dates later
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Start date</Label>
            <Input type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>End date</Label>
            <Input type="date" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default DateStep;

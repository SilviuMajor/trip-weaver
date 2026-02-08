import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DateStepProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
}

const DateStep = ({ startDate, endDate, onStartDateChange, onEndDateChange }: DateStepProps) => (
  <div>
    <h2 className="mb-2 text-2xl font-bold">When are you going?</h2>
    <p className="mb-6 text-sm text-muted-foreground">Set your travel dates</p>
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
  </div>
);

export default DateStep;

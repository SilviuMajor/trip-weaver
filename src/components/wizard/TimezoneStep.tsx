import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TimezoneStepProps {
  value: string;
  onChange: (v: string) => void;
}

const TIMEZONES = [
  { value: 'Europe/London', label: 'UK (GMT/BST)' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
];

const TimezoneStep = ({ value, onChange }: TimezoneStepProps) => (
  <div>
    <h2 className="mb-2 text-2xl font-bold">Where are you based?</h2>
    <p className="mb-6 text-sm text-muted-foreground">This sets the clock for your trip's timeline</p>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TIMEZONES.map(tz => (
          <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

export default TimezoneStep;

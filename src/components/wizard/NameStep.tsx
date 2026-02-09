import { Input } from '@/components/ui/input';

interface NameStepProps {
  value: string;
  onChange: (v: string) => void;
  destination: string;
  onDestinationChange: (v: string) => void;
}

const NameStep = ({ value, onChange, destination, onDestinationChange }: NameStepProps) => (
  <div>
    <h2 className="mb-2 text-2xl font-bold">What's your trip called?</h2>
    <p className="mb-6 text-sm text-muted-foreground">Give it a memorable name</p>
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Amsterdam Adventure 2026"
      className="mb-4 text-lg"
      autoFocus
    />
    <label className="mb-1 block text-sm font-medium text-muted-foreground">Destination (optional)</label>
    <Input
      value={destination}
      onChange={(e) => onDestinationChange(e.target.value)}
      placeholder="Amsterdam, Netherlands"
    />
  </div>
);

export default NameStep;

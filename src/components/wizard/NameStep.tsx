import { Input } from '@/components/ui/input';

interface NameStepProps {
  value: string;
  onChange: (v: string) => void;
}

const NameStep = ({ value, onChange }: NameStepProps) => (
  <div>
    <h2 className="mb-2 text-2xl font-bold">What's your trip called?</h2>
    <p className="mb-6 text-sm text-muted-foreground">Give it a memorable name</p>
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Amsterdam Adventure 2026"
      className="text-lg"
      autoFocus
    />
  </div>
);

export default NameStep;

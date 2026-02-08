import { Train, Bus, Footprints, Car } from 'lucide-react';

const getModeIcon = (mode: string | null) => {
  if (!mode) return Train;
  const lower = mode.toLowerCase();
  if (lower.includes('walk')) return Footprints;
  if (lower.includes('bus')) return Bus;
  if (lower.includes('driv') || lower.includes('car')) return Car;
  return Train;
};

interface TravelSegmentCardProps {
  durationMin: number | null;
  mode: string | null;
  departBy?: string;
}

const TravelSegmentCard = ({ durationMin, mode, departBy }: TravelSegmentCardProps) => {
  const Icon = getModeIcon(mode);

  return (
    <div className="mx-auto flex max-w-2xl items-center gap-2 border-l-2 border-dashed border-muted-foreground/30 py-2 pl-6 pr-4">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      {durationMin != null && (
        <span className="text-xs text-muted-foreground">
          {durationMin} min
        </span>
      )}
      {departBy && (
        <span className="text-[10px] text-muted-foreground/70">
          Leave by {departBy}
        </span>
      )}
    </div>
  );
};

export default TravelSegmentCard;

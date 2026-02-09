const getModeEmoji = (mode: string | null): string => {
  if (!mode) return '🚆';
  const lower = mode.toLowerCase();
  if (lower.includes('walk')) return '🚶';
  if (lower.includes('bus')) return '🚌';
  if (lower.includes('cycle') || lower.includes('bike')) return '🚲';
  if (lower.includes('driv') || lower.includes('car')) return '🚗';
  if (lower.includes('fly') || lower.includes('flight')) return '✈️';
  return '🚆';
};

interface TravelSegmentCardProps {
  durationMin: number | null;
  mode: string | null;
  departBy?: string;
}

const TravelSegmentCard = ({ durationMin, mode, departBy }: TravelSegmentCardProps) => {
  const emoji = getModeEmoji(mode);

  return (
    <div className="mx-auto flex max-w-2xl items-center gap-3 py-2 px-6">
      <span className="text-lg">{emoji}</span>
      <div className="flex-1 border-t-2 border-dashed border-primary/30" />
      {durationMin != null && (
        <span className="rounded-full bg-secondary px-3 py-0.5 text-xs font-semibold text-secondary-foreground">
          {durationMin} min
        </span>
      )}
      {departBy && (
        <span className="text-[10px] text-muted-foreground">
          Leave by {departBy}
        </span>
      )}
    </div>
  );
};

export default TravelSegmentCard;

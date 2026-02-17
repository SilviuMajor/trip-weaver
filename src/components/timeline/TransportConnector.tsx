import { Settings } from 'lucide-react';

interface TransportConnectorProps {
  mode: string;
  durationMin: number;
  destinationName: string;
  distanceKm?: number | null;
  isLoading?: boolean;
  onCogTap: () => void;
  height?: number;
}

const MODE_EMOJI: Record<string, string> = {
  walk: '🚶', drive: '🚗', transit: '🚌', bicycle: '🚲',
};

const fmtDur = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
};

const TransportConnector = ({
  mode, durationMin, destinationName, distanceKm, isLoading, onCogTap, height,
}: TransportConnectorProps) => {
  const shortDest = destinationName.split(',')[0].trim();

  return (
    <div
      className="w-full flex items-center pointer-events-auto"
      style={{ height: height ?? 24, minHeight: 20 }}
    >
      {/* Dot-line connector */}
      <div className="flex flex-col items-center mr-1.5 opacity-40" style={{ width: 8 }}>
        <div className="w-px h-1 bg-muted-foreground/40" />
        <div className="w-1 h-1 rounded-full bg-muted-foreground/50" />
        <div className="w-px h-1 bg-muted-foreground/40" />
      </div>

      {/* Info text */}
      {isLoading ? (
        <span className="text-[10px] text-muted-foreground/50 animate-pulse">Calculating…</span>
      ) : (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 truncate">
          <span className="text-[11px]">{MODE_EMOJI[mode] ?? '🚌'}</span>
          <span className="font-semibold text-muted-foreground/80">{fmtDur(durationMin)}</span>
          <span className="truncate">to {shortDest}</span>
        </div>
      )}

      {/* Cog button */}
      <button
        onClick={(e) => { e.stopPropagation(); onCogTap(); }}
        className="ml-auto pl-2 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors flex-shrink-0"
      >
        <Settings className="h-3 w-3" />
      </button>
    </div>
  );
};

export default TransportConnector;

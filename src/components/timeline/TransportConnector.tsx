import { RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EntryWithOptions, EntryOption, TransportMode } from '@/types/trip';

const MODE_CONFIG: { mode: string; emoji: string; label: string; apiMode: string }[] = [
  { mode: 'walk', emoji: '🚶', label: 'Walk', apiMode: 'walk' },
  { mode: 'drive', emoji: '🚗', label: 'Drive', apiMode: 'drive' },
  { mode: 'transit', emoji: '🚌', label: 'Transit', apiMode: 'transit' },
  { mode: 'bicycle', emoji: '🚲', label: 'Bike', apiMode: 'bicycle' },
];

const fmtDur = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
};

const fmtDist = (km: number | null | undefined): string => {
  if (km == null) return '';
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
};

interface TransportConnectorProps {
  entry: EntryWithOptions;
  option: EntryOption;
  height: number;
  fromLabel?: string;
  toLabel?: string;
  onModeSelect: (mode: string, durationMin: number, distanceKm: number, polyline?: string | null) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  selectedMode?: string;
}

const TransportConnector = ({
  entry,
  option,
  height,
  fromLabel,
  toLabel,
  onModeSelect,
  onRefresh,
  isRefreshing,
  selectedMode: selectedModeProp,
}: TransportConnectorProps) => {
  const transportModes: TransportMode[] = (option as any).transport_modes ?? [];
  
  // Detect current selected mode from the option name
  const detectCurrentMode = (): string => {
    if (selectedModeProp) return selectedModeProp;
    const lower = option.name.toLowerCase();
    if (lower.startsWith('walk')) return 'walk';
    if (lower.startsWith('drive')) return 'drive';
    if (lower.startsWith('transit')) return 'transit';
    if (lower.startsWith('cycle') || lower.startsWith('bic')) return 'bicycle';
    return 'transit';
  };

  const currentMode = detectCurrentMode();
  const isCompact = height < 40;
  const showLabels = height >= 160; // Fix 3: show labels only for tall connectors (2+ hours)

  // Find the selected mode data
  const selectedData = transportModes.find(m => m.mode === currentMode);
  const selectedDistance = selectedData ? fmtDist(selectedData.distance_km) : '';

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg',
        'bg-stone-100 dark:bg-stone-900/20',
        'border border-dashed border-stone-300/50 dark:border-stone-700/30',
        'cursor-default select-none overflow-hidden'
      )}
      style={{ height }}
    >
      {/* Refresh button */}
      <button
        onClick={(e) => { e.stopPropagation(); onRefresh(); }}
        className="absolute top-1 right-1 z-10 rounded-full p-0.5 hover:bg-stone-200 dark:hover:bg-stone-800/50 transition-colors"
      >
        {isRefreshing ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : (
          <RefreshCw className="h-3 w-3 text-muted-foreground/60" />
        )}
      </button>

      {/* From → To labels */}
      {showLabels && fromLabel && toLabel && (
        <div className="text-[9px] text-muted-foreground/60 truncate max-w-[90%] mb-0.5">
          {fromLabel} → {toLabel}
        </div>
      )}

      {/* Mode icons row */}
      <div className={cn('flex items-center gap-1', isCompact ? 'gap-0.5' : 'gap-1.5')}>
        {MODE_CONFIG.map(({ mode, emoji, apiMode }) => {
          const modeData = transportModes.find(m => m.mode === apiMode);
          const isSelected = currentMode === apiMode;
          const durLabel = modeData ? fmtDur(modeData.duration_min) : '—';

          return (
            <button
              key={mode}
              onClick={(e) => {
                e.stopPropagation();
                if (modeData && !isSelected) {
                  onModeSelect(apiMode, modeData.duration_min, modeData.distance_km, modeData.polyline);
                }
              }}
              className={cn(
                'flex flex-col items-center rounded-md px-1.5 py-0.5 transition-all',
                isSelected
                  ? 'bg-orange-100 dark:bg-orange-900/30 scale-105'
                  : 'opacity-50 hover:opacity-80 hover:bg-stone-200/50 dark:hover:bg-stone-800/30',
                !modeData && 'opacity-20 pointer-events-none'
              )}
            >
              <span className={cn('leading-none', isSelected ? 'text-base' : 'text-sm')}>
                {emoji}
              </span>
              <span className={cn(
                'text-[9px] leading-tight',
                isSelected ? 'font-bold text-orange-700 dark:text-orange-300' : 'text-muted-foreground'
              )}>
                {durLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Distance for selected mode */}
      {selectedDistance && !isCompact && (
        <span className="text-[9px] text-muted-foreground/50 mt-0.5">{selectedDistance}</span>
      )}

    </div>
  );
};

export default TransportConnector;

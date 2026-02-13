import { useState, useRef, useEffect } from 'react';
import { RefreshCw, Loader2, Trash2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EntryWithOptions, EntryOption, TransportMode } from '@/types/trip';

const MODE_CONFIG: { mode: string; emoji: string; label: string; apiMode: string }[] = [
  { mode: 'walk', emoji: '🚶', label: 'Walk', apiMode: 'walk' },
  { mode: 'drive', emoji: '🚗', label: 'Drive', apiMode: 'drive' },
  { mode: 'transit', emoji: '🚌', label: 'Transit', apiMode: 'transit' },
  { mode: 'bicycle', emoji: '🚲', label: 'Bike', apiMode: 'bicycle' },
];

/* Layer 1: Background strip — low opacity, fills the gap */
const STRIP_COLORS_LIGHT: Record<string, string> = {
  walk: 'hsl(140, 45%, 75%)',
  drive: 'hsl(0, 45%, 80%)',
  transit: 'hsl(45, 55%, 75%)',
  bicycle: 'hsl(210, 45%, 78%)',
};

const STRIP_COLORS_DARK: Record<string, string> = {
  walk: 'hsl(140, 40%, 30%)',
  drive: 'hsl(0, 40%, 30%)',
  transit: 'hsl(45, 50%, 30%)',
  bicycle: 'hsl(210, 40%, 30%)',
};

/* Layer 2: Content pill — selected mode highlight */
const MODE_HIGHLIGHT_LIGHT: Record<string, string> = {
  walk: 'hsl(140, 45%, 75%)',
  drive: 'hsl(0, 45%, 80%)',
  transit: 'hsl(45, 55%, 75%)',
  bicycle: 'hsl(210, 45%, 78%)',
};

const MODE_HIGHLIGHT_DARK: Record<string, string> = {
  walk: 'hsl(140, 40%, 30%)',
  drive: 'hsl(0, 40%, 30%)',
  transit: 'hsl(45, 50%, 30%)',
  bicycle: 'hsl(210, 40%, 30%)',
};

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
  onDelete?: () => void;
  onInfoTap?: () => void;
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
  onDelete,
  onInfoTap,
}: TransportConnectorProps) => {
  const transportModes: TransportMode[] = (option as any).transport_modes ?? [];
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const handleDeleteTap = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (confirmingDelete) {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      setConfirmingDelete(false);
      onDelete?.();
    } else {
      setConfirmingDelete(true);
      confirmTimer.current = setTimeout(() => setConfirmingDelete(false), 3000);
    }
  };

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
  const showExtended = height >= 100;

  const selectedData = transportModes.find(m => m.mode === currentMode);
  const selectedDistance = selectedData ? fmtDist(selectedData.distance_km) : '';

  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
  const stripColor = isDark
    ? (STRIP_COLORS_DARK[currentMode] || STRIP_COLORS_DARK.transit)
    : (STRIP_COLORS_LIGHT[currentMode] || STRIP_COLORS_LIGHT.transit);

  const highlightColor = isDark
    ? (MODE_HIGHLIGHT_DARK[currentMode] || MODE_HIGHLIGHT_DARK.transit)
    : (MODE_HIGHLIGHT_LIGHT[currentMode] || MODE_HIGHLIGHT_LIGHT.transit);

  return (
    <div
      className="relative w-full pointer-events-none"
      style={{ height, overflow: 'visible' }}
    >
      {/* Layer 1: Background strip — fills the gap exactly, never overflows */}
      <div
        className="absolute inset-0 rounded-sm overflow-hidden"
        style={{ backgroundColor: stripColor }}
      />

      {/* Layer 2: Content pill — centred, can overflow into adjacent cards */}
      <div
        className={cn(
          'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          'z-20 min-h-[40px] w-fit px-3 py-1 pointer-events-auto',
          'rounded-full shadow-md',
          'flex items-center gap-1.5'
        )}
        style={{ backgroundColor: stripColor }}
      >
        {/* Info icon */}
        {onInfoTap ? (
          <button
            onClick={(e) => { e.stopPropagation(); onInfoTap(); }}
            className="flex items-center justify-center rounded-md p-1 opacity-50 hover:opacity-80 hover:bg-stone-200/50 dark:hover:bg-stone-800/30 transition-all"
          >
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        ) : <div className="w-5" />}

        {/* Mode buttons */}
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
                !isSelected && 'opacity-50 hover:opacity-80',
                !modeData && 'opacity-20 pointer-events-none'
              )}
              style={isSelected ? { boxShadow: isDark ? '0 0 0 1.5px rgba(255,255,255,0.3), 0 1px 3px rgba(0,0,0,0.3)' : '0 0 0 1.5px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.15)', transform: 'scale(1.05)' } : undefined}
            >
              <span className={cn('leading-none', isSelected ? 'text-base' : 'text-sm')}>
                {emoji}
              </span>
              <span className={cn(
                'text-[9px] leading-tight',
                isSelected ? 'font-bold text-foreground' : 'text-muted-foreground'
              )}>
                {durLabel}
              </span>
            </button>
          );
        })}

        {/* Refresh */}
        <button
          onClick={(e) => { e.stopPropagation(); onRefresh(); }}
          className="flex items-center justify-center rounded-md p-1 opacity-50 hover:opacity-80 hover:bg-stone-200/50 dark:hover:bg-stone-800/30 transition-all"
        >
          {isRefreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        {/* Delete */}
        {onDelete && (
          <button
            onClick={handleDeleteTap}
            className={cn(
              'flex items-center justify-center rounded-md p-1 transition-all',
              confirmingDelete
                ? 'bg-red-500 text-white scale-105'
                : 'opacity-50 hover:opacity-80 hover:bg-stone-200/50 dark:hover:bg-stone-800/30'
            )}
          >
            <Trash2 className={cn('h-3.5 w-3.5', confirmingDelete ? 'text-white' : 'text-muted-foreground')} />
          </button>
        )}
      </div>

      {/* Extended: from→to + distance (only when gap is large) */}
      {showExtended && fromLabel && toLabel && (
        <div className="absolute bottom-1 left-0 right-0 flex flex-col items-center pointer-events-none">
          <span className="text-[9px] text-muted-foreground/60 truncate max-w-[90%]">
            {fromLabel} → {toLabel}
          </span>
          {selectedDistance && (
            <span className="text-[9px] text-muted-foreground/50">{selectedDistance}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default TransportConnector;

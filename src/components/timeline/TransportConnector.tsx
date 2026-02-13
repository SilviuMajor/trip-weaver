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

const MODE_COLORS_LIGHT: Record<string, string> = {
  walk: 'hsl(140, 40%, 85%)',
  drive: 'hsl(0, 40%, 85%)',
  transit: 'hsl(45, 50%, 85%)',
  bicycle: 'hsl(210, 40%, 85%)',
};

const MODE_COLORS_DARK: Record<string, string> = {
  walk: 'hsla(140, 40%, 30%, 0.3)',
  drive: 'hsla(0, 40%, 30%, 0.3)',
  transit: 'hsla(45, 50%, 30%, 0.3)',
  bicycle: 'hsla(210, 40%, 30%, 0.3)',
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
  const isCompressed = height <= 50;
  const showLabels = height >= 160;

  const selectedData = transportModes.find(m => m.mode === currentMode);
  const selectedDistance = selectedData ? fmtDist(selectedData.distance_km) : '';

  // Detect dark mode
  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
  const backgroundColor = isDark
    ? (MODE_COLORS_DARK[currentMode] || MODE_COLORS_DARK.transit)
    : (MODE_COLORS_LIGHT[currentMode] || MODE_COLORS_LIGHT.transit);

  if (isCompressed) {
    // Compressed pill mode
    const selectedCfg = MODE_CONFIG.find(c => c.apiMode === currentMode);
    const durLabel = selectedData ? fmtDur(selectedData.duration_min) : '—';

    return (
      <div
        className={cn(
          'relative flex items-center justify-center rounded-full',
          'border border-dashed border-stone-300/50 dark:border-stone-700/30',
          'cursor-default select-none transition-colors duration-300'
        )}
        style={{ height, backgroundColor, width: '60%', margin: '0 auto' }}
      >
        <div className="flex items-center gap-1">
          {/* Info icon */}
          {onInfoTap && (
            <button
              onClick={(e) => { e.stopPropagation(); onInfoTap(); }}
              className="flex items-center justify-center rounded-full opacity-50 hover:opacity-80 transition-all"
              style={{ minWidth: 28, minHeight: 28 }}
            >
              <Info className="h-3 w-3 text-muted-foreground" />
            </button>
          )}

          {/* Selected mode pill */}
          <span className="text-sm leading-none">{selectedCfg?.emoji}</span>
          <span className="text-[10px] font-bold text-foreground/80">{durLabel}</span>

          {/* Other mode icons */}
          {MODE_CONFIG.filter(c => c.apiMode !== currentMode).map(({ emoji, apiMode }) => {
            const modeData = transportModes.find(m => m.mode === apiMode);
            return (
              <button
                key={apiMode}
                onClick={(e) => {
                  e.stopPropagation();
                  if (modeData) onModeSelect(apiMode, modeData.duration_min, modeData.distance_km, modeData.polyline);
                }}
                className={cn('text-xs opacity-40 hover:opacity-70 transition-all', !modeData && 'opacity-15 pointer-events-none')}
                style={{ minWidth: 20, minHeight: 20 }}
              >
                {emoji}
              </button>
            );
          })}

          {/* Refresh */}
          <button
            onClick={(e) => { e.stopPropagation(); onRefresh(); }}
            className="flex items-center justify-center rounded-full opacity-40 hover:opacity-70 transition-all"
            style={{ minWidth: 28, minHeight: 28 }}
          >
            {isRefreshing ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            ) : (
              <RefreshCw className="h-3 w-3 text-muted-foreground" />
            )}
          </button>

          {/* Delete */}
          {onDelete && (
            <button
              onClick={handleDeleteTap}
              className={cn(
                'flex items-center justify-center rounded-full transition-all',
                confirmingDelete ? 'bg-red-500 text-white' : 'opacity-40 hover:opacity-70'
              )}
              style={{ minWidth: 28, minHeight: 28 }}
            >
              <Trash2 className={cn('h-3 w-3', confirmingDelete ? 'text-white' : 'text-muted-foreground')} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Normal (non-compressed) mode
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg',
        'border border-dashed border-stone-300/50 dark:border-stone-700/30',
        'cursor-default select-none overflow-hidden transition-colors duration-300'
      )}
      style={{ height, backgroundColor }}
    >
      {/* From → To labels */}
      {showLabels && fromLabel && toLabel && (
        <div className="text-[9px] text-muted-foreground/60 truncate max-w-[90%] mb-0.5">
          {fromLabel} → {toLabel}
        </div>
      )}

      {/* Mode icons row + info + refresh + delete */}
      <div className={cn('flex items-center gap-1', height < 40 ? 'gap-0.5' : 'gap-1.5')}>
        {/* Info button */}
        {onInfoTap && (
          <button
            onClick={(e) => { e.stopPropagation(); onInfoTap(); }}
            className="flex flex-col items-center rounded-md px-1 py-0.5 opacity-50 hover:opacity-80 hover:bg-stone-200/50 dark:hover:bg-stone-800/30 transition-all"
            style={{ minWidth: 32, minHeight: 32 }}
          >
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}

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

        {/* Refresh button */}
        <button
          onClick={(e) => { e.stopPropagation(); onRefresh(); }}
          className="flex flex-col items-center rounded-md px-1.5 py-0.5 opacity-50 hover:opacity-80 hover:bg-stone-200/50 dark:hover:bg-stone-800/30 transition-all"
        >
          {isRefreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        {/* Delete button — two-tap confirm */}
        {onDelete && (
          <button
            onClick={handleDeleteTap}
            className={cn(
              'flex flex-col items-center rounded-md px-1.5 py-0.5 transition-all',
              confirmingDelete
                ? 'bg-red-500 text-white scale-105'
                : 'opacity-50 hover:opacity-80 hover:bg-stone-200/50 dark:hover:bg-stone-800/30'
            )}
          >
            <Trash2 className={cn('h-3.5 w-3.5', confirmingDelete ? 'text-white' : 'text-muted-foreground')} />
          </button>
        )}
      </div>

      {/* Distance for selected mode */}
      {selectedDistance && height >= 40 && (
        <span className="text-[9px] text-muted-foreground/50 mt-0.5">{selectedDistance}</span>
      )}
    </div>
  );
};

export default TransportConnector;

import { useState, useRef, useEffect } from 'react';
import { RefreshCw, Loader2, Trash2, Info, Settings, X } from 'lucide-react';
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
  walk: 'hsl(145, 40%, 82%)',
  drive: 'hsl(5, 45%, 85%)',
  transit: 'hsl(40, 50%, 82%)',
  bicycle: 'hsl(215, 40%, 83%)',
};

const STRIP_COLORS_DARK: Record<string, string> = {
  walk: 'hsl(140, 20%, 22%)',
  drive: 'hsl(0, 20%, 22%)',
  transit: 'hsl(45, 25%, 22%)',
  bicycle: 'hsl(210, 20%, 22%)',
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
  const [expanded, setExpanded] = useState(false);
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
  const selectedData = transportModes.find(m => m.mode === currentMode);
  const selectedDistance = selectedData ? fmtDist(selectedData.distance_km) : '';

  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
  const stripColor = isDark
    ? (STRIP_COLORS_DARK[currentMode] || STRIP_COLORS_DARK.transit)
    : (STRIP_COLORS_LIGHT[currentMode] || STRIP_COLORS_LIGHT.transit);

  const totalMs = new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime();
  const totalMinutes = Math.round(totalMs / 60000);

  const currentModeConfig = MODE_CONFIG.find(m => m.apiMode === currentMode);

  return (
    <div
      className="relative w-full pointer-events-none"
      style={{ height, overflow: 'visible' }}
      data-transport-connector
    >
      {/* Layer 1: Background strip */}
      <div
        className="absolute inset-0 rounded-sm overflow-hidden"
        style={{ backgroundColor: stripColor }}
      />

      {/* Layer 2: Pill — left-aligned, overflows when needed */}
      {expanded ? (
        /* ─── Expanded state ─── */
        <div
          className="absolute left-1 top-1/2 -translate-y-1/2 z-20 pointer-events-auto rounded-3xl flex items-center gap-0.5 px-1.5 py-0.5"
          style={{
            backgroundColor: stripColor,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            minHeight: 40,
          }}
        >
          {/* Info */}
          {onInfoTap && (
            <button
              onClick={(e) => { e.stopPropagation(); onInfoTap(); }}
              className="flex items-center justify-center rounded-md p-1 hover:opacity-80 transition-all"
              style={{ touchAction: 'manipulation' }}
            >
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}

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
                  !isSelected && 'opacity-50 active:opacity-80',
                  !modeData && 'opacity-20 pointer-events-none'
                )}
                style={{
                  touchAction: 'manipulation',
                  ...(isSelected ? {
                    boxShadow: isDark ? '0 0 0 1px rgba(255,255,255,0.15), 0 1px 2px rgba(0,0,0,0.15)' : '0 0 0 1px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
                    transform: 'scale(1.05)',
                  } : undefined)
                }}
              >
                <span className={cn('leading-none', isSelected ? 'text-[17px]' : 'text-[15px]')}>
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
            className="flex items-center justify-center rounded-md p-1 hover:opacity-80 transition-all"
            style={{ touchAction: 'manipulation' }}
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
                  : 'hover:opacity-80'
              )}
              style={{ touchAction: 'manipulation' }}
            >
              <Trash2 className={cn('h-3.5 w-3.5', confirmingDelete ? 'text-white' : 'text-muted-foreground')} />
            </button>
          )}

          {/* Close */}
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
            className="flex items-center justify-center rounded-md p-1 hover:opacity-80 transition-all"
            style={{ touchAction: 'manipulation' }}
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      ) : (
        /* ─── Collapsed state ─── */
        <div
          className="absolute left-1 top-1/2 -translate-y-1/2 z-20 pointer-events-auto rounded-2xl flex items-center gap-1.5 px-2.5 py-1 whitespace-nowrap"
          style={{
            backgroundColor: stripColor,
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            minHeight: 32,
          }}
        >
          <span className="text-sm">{currentModeConfig?.emoji ?? '🚌'}</span>
          <span
            className="text-xs font-bold"
            style={{ color: isDark ? 'hsl(30, 80%, 60%)' : 'hsl(25, 30%, 12%)' }}
          >
            {selectedData ? fmtDur(selectedData.duration_min) : fmtDur(totalMinutes)}
          </span>
          {selectedData?.distance_km != null && (
            <span
              className="text-[10px]"
              style={{ color: isDark ? 'hsl(30, 40%, 45%)' : 'rgba(0,0,0,0.4)' }}
            >
              · {fmtDist(selectedData.distance_km)}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            className="w-[22px] h-[22px] rounded-md flex items-center justify-center"
            style={{
              color: 'hsl(30, 60%, 52%)',
              background: 'rgba(234, 155, 50, 0.12)',
              touchAction: 'manipulation',
            }}
          >
            <Settings className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* From→To label — always shown when collapsed */}
      {!expanded && fromLabel && toLabel && (
        <div
          className="absolute bottom-[1px] left-1 right-0 text-[9px] z-[9] pointer-events-none truncate pr-2"
          style={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }}
        >
          {fromLabel} → {toLabel}
        </div>
      )}
    </div>
  );
};

export default TransportConnector;

import { cn } from '@/lib/utils';
import type { EntryWithOptions, EntryOption, TransportMode } from '@/types/trip';

const STRIP_COLORS_LIGHT: Record<string, string> = {
  walk: 'hsl(145, 40%, 82%)', drive: 'hsl(5, 45%, 85%)',
  transit: 'hsl(40, 50%, 82%)', bicycle: 'hsl(215, 40%, 83%)',
};
const STRIP_COLORS_DARK: Record<string, string> = {
  walk: 'hsl(140, 20%, 22%)', drive: 'hsl(0, 20%, 22%)',
  transit: 'hsl(45, 25%, 22%)', bicycle: 'hsl(210, 20%, 22%)',
};
const MODE_EMOJI: Record<string, string> = { walk: '🚶', drive: '🚗', transit: '🚌', bicycle: '🚲' };

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
  onTap: () => void;
}

const TransportConnector = ({ entry, option, height, fromLabel, toLabel, onTap }: TransportConnectorProps) => {
  const transportModes: TransportMode[] = (option as any).transport_modes ?? [];

  const detectCurrentMode = (): string => {
    const lower = option.name.toLowerCase();
    if (lower.startsWith('walk')) return 'walk';
    if (lower.startsWith('drive')) return 'drive';
    if (lower.startsWith('transit')) return 'transit';
    if (lower.startsWith('cycle') || lower.startsWith('bic')) return 'bicycle';
    return 'transit';
  };

  const currentMode = detectCurrentMode();
  const selectedData = transportModes.find(m => m.mode === currentMode);
  const totalMin = Math.round((new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / 60000);

  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
  const stripColor = isDark
    ? (STRIP_COLORS_DARK[currentMode] || STRIP_COLORS_DARK.transit)
    : (STRIP_COLORS_LIGHT[currentMode] || STRIP_COLORS_LIGHT.transit);

  return (
    <div
      className="relative w-full pointer-events-none"
      style={{ height, overflow: 'visible' }}
      data-transport-connector
    >
      {/* Background strip — right: 4 to match card column pr-1 padding */}
      <div
        className="absolute top-0 bottom-0 rounded-[4px] overflow-hidden"
        style={{ backgroundColor: stripColor, left: 0, right: 4 }}
      />

      {/* Info pill + from→to label — left-aligned, tappable */}
      <div
        className="absolute left-1 top-1/2 -translate-y-1/2 z-20 pointer-events-auto flex flex-col items-start gap-0.5 cursor-pointer"
        onClick={(e) => { e.stopPropagation(); onTap(); }}
      >
        <div
          className="rounded-2xl flex items-center gap-1.5 px-2.5 py-1 whitespace-nowrap"
          style={{
            backgroundColor: stripColor,
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            minHeight: 32,
          }}
        >
          <span className="text-sm">{MODE_EMOJI[currentMode] ?? '🚌'}</span>
          <span
            className="text-xs font-bold"
            style={{ color: isDark ? 'hsl(30, 80%, 60%)' : 'hsl(25, 30%, 12%)' }}
          >
            {selectedData ? fmtDur(selectedData.duration_min) : fmtDur(totalMin)}
          </span>
          {(selectedData?.distance_km ?? (option as any).distance_km) != null && (
            <span
              className="text-[10px]"
              style={{ color: isDark ? 'hsl(30, 40%, 45%)' : 'rgba(0,0,0,0.4)' }}
            >
              · {fmtDist(selectedData?.distance_km ?? (option as any).distance_km)}
            </span>
          )}
        </div>

        {fromLabel && toLabel && (
          <span
            className="text-[8px] pl-1 truncate max-w-[200px]"
            style={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }}
          >
            {fromLabel} → {toLabel}
          </span>
        )}
      </div>
    </div>
  );
};

export default TransportConnector;

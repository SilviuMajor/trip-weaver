import { Settings, Plus } from 'lucide-react';
import type { EntryWithOptions, EntryOption } from '@/types/trip';

interface TransportConnectorProps {
  entry: EntryWithOptions;
  option: EntryOption;
  height: number;
  gapHeight: number;
  transportMinutes: number;
  gapMinutes: number;
  fromLabel?: string;
  toLabel?: string;
  onTap: () => void;
  onAddAtArrival?: () => void;
}

const MODE_EMOJI: Record<string, string> = {
  walk: '🚶', drive: '🚗', transit: '🚌', bicycle: '🚲',
};

const MODE_COLORS: Record<string, { stripe: string; fill: string; bg: string; text: string }> = {
  walk:    { stripe: '#4ade80', fill: 'rgba(74,222,128,0.12)',  bg: 'rgba(74,222,128,0.03)',  text: '#4ade80' },
  transit: { stripe: '#fbbf24', fill: 'rgba(251,191,36,0.12)',  bg: 'rgba(251,191,36,0.03)',  text: '#fbbf24' },
  drive:   { stripe: '#ef4444', fill: 'rgba(239,68,68,0.12)',   bg: 'rgba(239,68,68,0.03)',   text: '#ef4444' },
  bicycle: { stripe: '#60a5fa', fill: 'rgba(96,165,250,0.12)',  bg: 'rgba(96,165,250,0.03)',  text: '#60a5fa' },
};

const MODE_COLORS_OVERFLOW: Record<string, { fill: string; bg: string }> = {
  walk:    { fill: 'rgba(74,222,128,0.18)',  bg: 'rgba(74,222,128,0.08)' },
  transit: { fill: 'rgba(251,191,36,0.18)',  bg: 'rgba(251,191,36,0.08)' },
  drive:   { fill: 'rgba(239,68,68,0.18)',   bg: 'rgba(239,68,68,0.08)' },
  bicycle: { fill: 'rgba(96,165,250,0.18)',  bg: 'rgba(96,165,250,0.08)' },
};

const fmtDur = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
};

const detectMode = (optionName: string): string => {
  const lower = optionName?.toLowerCase() ?? '';
  if (lower.startsWith('walk')) return 'walk';
  if (lower.startsWith('drive')) return 'drive';
  if (lower.startsWith('cycle') || lower.startsWith('bic')) return 'bicycle';
  return 'transit';
};

const TransportConnector = ({
  entry, option, height, gapHeight, transportMinutes, gapMinutes,
  fromLabel, toLabel, onTap, onAddAtArrival,
}: TransportConnectorProps) => {
  const mode = detectMode(option.name);
  const colors = MODE_COLORS[mode] ?? MODE_COLORS.transit;
  const overflowColors = MODE_COLORS_OVERFLOW[mode] ?? MODE_COLORS_OVERFLOW.transit;
  const emoji = MODE_EMOJI[mode] ?? '🚌';
  const shortDest = (toLabel || option.arrival_location || 'Next').split(',')[0].trim();
  const fillPct = gapMinutes > 0 ? Math.min(100, (transportMinutes / gapMinutes) * 100) : 100;

  const isOverflow = gapHeight < 14;
  const isCompact = !isOverflow && gapHeight < 22;
  const isNormal = !isOverflow && !isCompact;

  const bandHeight = isOverflow ? 22 : gapHeight;
  const topOffset = isOverflow ? -(22 - gapHeight) / 2 : 0;

  const activeFill = isOverflow ? overflowColors.fill : colors.fill;
  const activeBg = isOverflow ? overflowColors.bg : colors.bg;

  const fontSize = isCompact ? 9 : 10;

  return (
    <div
      className="w-full pointer-events-auto cursor-pointer"
      style={{
        position: isOverflow ? 'absolute' : 'relative',
        top: isOverflow ? topOffset : undefined,
        left: 0,
        right: 0,
        height: bandHeight,
        zIndex: isOverflow ? 5 : undefined,
        ...(isOverflow ? {
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        } : {}),
      }}
      onClick={(e) => { e.stopPropagation(); onTap(); }}
    >
      {/* Background (unfilled area) */}
      <div
        className="absolute inset-0 rounded-l-sm"
        style={{ backgroundColor: activeBg }}
      />

      {/* Fill area (top-down, represents travel time) */}
      <div
        className="absolute top-0 left-0 right-0 rounded-l-sm"
        style={{
          height: `${fillPct}%`,
          backgroundColor: activeFill,
        }}
      />

      {/* Left stripe */}
      <div
        className="absolute left-0 top-0 bottom-0 rounded-l-sm"
        style={{ width: 3, backgroundColor: colors.stripe }}
      />

      {/* Text row */}
      <div
        className="relative flex items-center gap-1 pl-[7px] pr-1 truncate"
        style={{ height: Math.min(bandHeight, 20), fontSize }}
      >
        <span style={{ fontSize: fontSize + 1 }}>{emoji}</span>
        <span className="font-semibold" style={{ color: colors.text }}>{fmtDur(transportMinutes)}</span>
        {isNormal && (
          <span className="truncate text-muted-foreground/60">to {shortDest}</span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onTap(); }}
          className="ml-auto pl-1 flex-shrink-0 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
        >
          <Settings className="h-3 w-3" />
        </button>
      </div>

      {/* "+" add button — normal mode only */}
      {isNormal && onAddAtArrival && (
        <button
          onClick={(e) => { e.stopPropagation(); onAddAtArrival(); }}
          className="absolute bottom-0.5 right-1 flex items-center justify-center rounded-full border border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 hover:bg-muted/50 transition-colors"
          style={{ width: 20, height: 20 }}
        >
          <Plus className="h-2.5 w-2.5 text-muted-foreground/40" />
        </button>
      )}
    </div>
  );
};

export default TransportConnector;

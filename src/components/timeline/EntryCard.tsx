import { useState } from 'react';

import { MapPin, Clock, Plane, ArrowRight, Lock, LockOpen, RefreshCw, Loader2, Check } from 'lucide-react';
import type { EntryOption } from '@/types/trip';
import { toast } from 'sonner';
import RouteMapPreview from './RouteMapPreview';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

import { findCategory } from '@/lib/categories';


const formatDuration = (startIso: string, endIso: string): string => {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

// ─── Helpers for diagonal fade design ───
const extractHue = (hslString: string): number => {
  const match = hslString.match(/hsl\((\d+)/);
  return match ? parseInt(match[1]) : 260;
};

const DIAGONAL_GRADIENTS = {
  full: 'linear-gradient(148deg, transparent 15%, rgba(10,8,6,0.20) 25%, rgba(10,8,6,0.65) 38%, rgba(10,8,6,0.96) 50%)',
  condensed: 'linear-gradient(148deg, transparent 10%, rgba(10,8,6,0.20) 20%, rgba(10,8,6,0.65) 33%, rgba(10,8,6,0.96) 45%)',
  tight: 'linear-gradient(148deg, transparent 5%, rgba(10,8,6,0.25) 14%, rgba(10,8,6,0.70) 26%, rgba(10,8,6,0.97) 38%)',
  compact: 'linear-gradient(148deg, transparent 0%, rgba(10,8,6,0.30) 8%, rgba(10,8,6,0.78) 18%, rgba(10,8,6,0.97) 28%)',
};

interface EntryCardProps {
  option: EntryOption;
  startTime: string;
  endTime: string;
  formatTime: (iso: string) => string;
  isPast: boolean;
  optionIndex: number;
  totalOptions: number;
  distanceKm?: number | null;
  votingLocked: boolean;
  userId?: string;
  hasVoted: boolean;
  onVoteChange: () => void;
  onClick?: () => void;
  cardSizeClass?: string;
  isDragging?: boolean;
  isLocked?: boolean;
  isProcessing?: boolean;
  linkedType?: string | null;
  height?: number;
  canEdit?: boolean;
  overlapMinutes?: number;
  overlapPosition?: 'top' | 'bottom';
  onToggleLock?: () => void;
  onDragStart?: (e: React.MouseEvent) => void;
  onTouchDragStart?: (e: React.TouchEvent) => void;
  onTouchDragMove?: (e: React.TouchEvent) => void;
  onTouchDragEnd?: () => void;
  isShaking?: boolean;
  notes?: string | null;
  entryId?: string;
}

const getCategoryColor = (catId: string | null, customColor: string | null): string => {
  const predefined = findCategory(catId ?? '');
  if (predefined) return predefined.color;
  if (customColor) return customColor;
  return 'hsl(260, 50%, 55%)';
};

const getCategoryEmoji = (catId: string | null): string => {
  const predefined = findCategory(catId ?? '');
  return predefined?.emoji ?? '📌';
};

const getCategoryName = (catId: string | null): string => {
  const predefined = findCategory(catId ?? '');
  return predefined?.name ?? catId ?? '';
};

const formatTimeInTz = (isoString: string, tz: string | null): string => {
  if (!tz) return '';
  const date = new Date(isoString);
  const time = date.toLocaleTimeString('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const tzAbbr = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    timeZoneName: 'short',
  }).formatToParts(date).find(p => p.type === 'timeZoneName')?.value ?? '';
  return `${time} ${tzAbbr}`;
};

const EntryCard = ({
  option,
  startTime,
  endTime,
  formatTime,
  isPast: isEntryPast,
  optionIndex,
  totalOptions,
  distanceKm,
  votingLocked,
  userId,
  hasVoted,
  onVoteChange,
  onClick,
  cardSizeClass,
  isDragging,
  isLocked,
  isProcessing,
  linkedType,
  height: heightProp,
  canEdit,
  overlapMinutes = 0,
  overlapPosition,
  onToggleLock,
  onDragStart,
  onTouchDragStart,
  onTouchDragMove,
  onTouchDragEnd,
  isShaking,
  notes,
  entryId,
}: EntryCardProps) => {
  const firstImage = option.images?.[0]?.image_url;
  const catColor = getCategoryColor(option.category, option.category_color);
  const catEmoji = getCategoryEmoji(option.category);
  const catName = getCategoryName(option.category);
  const isTransfer = option.category === 'transfer';
  const isFlight = option.category === 'flight';
  const isAirportProcessing = option.category === 'airport_processing';

  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
  const hue = extractHue(catColor);

  const durationLabel = formatDuration(startTime, endTime);

  // ─── 5-tier pixel-based system ───
  const h = heightProp ?? 200;
  const isMicro = h < 30;
  const isCompactTier = h >= 30 && h < 72;
  const isTight = h >= 72 && h < 86;
  const isCondensedTier = h >= 86 && h < 116;
  const isFull = h >= 116;

  // Transport tier mapping (transport cards have different visual needs)
  const isCompact = h < 72;
  const isMedium = h >= 40 && h < 72;
  const isCondensed = h >= 72 && h < 116;

  // Overlap red tint calculation
  const totalMs = new Date(endTime).getTime() - new Date(startTime).getTime();
  const overlapFraction = overlapMinutes > 0 && totalMs > 0
    ? Math.min(1, (overlapMinutes * 60000) / totalMs)
    : 0;

  // ─── Transport mode detection ───
  const detectTransportMode = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.startsWith('walk')) return { emoji: '🚶', label: 'Walking' };
    if (lower.startsWith('transit')) return { emoji: '🚌', label: 'Transit' };
    if (lower.startsWith('drive')) return { emoji: '🚗', label: 'Driving' };
    if (lower.startsWith('cycle')) return { emoji: '🚲', label: 'Cycling' };
    return { emoji: '🚆', label: 'Transport' };
  };

  const formatDistanceVal = (km: number | null | undefined): string => {
    if (km == null) return '';
    if (km < 1) return `${Math.round(km * 1000)}m`;
    return `${km.toFixed(1)}km`;
  };

  // ─── Refresh state ───
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResults, setRefreshResults] = useState<{ mode: string; duration_min: number; distance_km: number; polyline?: string | null }[]>([]);
  const [showRefreshPopover, setShowRefreshPopover] = useState(false);
  const [selectedRefreshMode, setSelectedRefreshMode] = useState<string | null>(null);
  const [applyingRefresh, setApplyingRefresh] = useState(false);

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-directions', {
        body: {
          fromAddress: option.departure_location,
          toAddress: option.arrival_location,
          modes: ['walk', 'transit', 'drive', 'bicycle'],
          departureTime: startTime,
        },
      });
      if (error) throw error;
      const results = data?.results ?? [];
      setRefreshResults(results);
      const currentMode = detectTransportMode(option.name);
      const modeMap: Record<string, string> = { Walking: 'walk', Transit: 'transit', Driving: 'drive', Cycling: 'bicycle', Transport: 'transit' };
      setSelectedRefreshMode(modeMap[currentMode.label] ?? results[0]?.mode ?? null);
      setShowRefreshPopover(true);
    } catch (err) {
      console.error('Transport refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleApplyRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const result = refreshResults.find(r => r.mode === selectedRefreshMode);
    if (!result) return;
    setApplyingRefresh(true);
    try {
      const blockDur = Math.ceil(result.duration_min / 5) * 5;
      const startDt = new Date(startTime);
      const newEndIso = new Date(startDt.getTime() + blockDur * 60000).toISOString();
      const modeLabels: Record<string, string> = { walk: 'Walk', transit: 'Transit', drive: 'Drive', bicycle: 'Cycle' };
      const toShort = (option.arrival_location || '').split(',')[0].trim();
      const newName = `${modeLabels[result.mode] || result.mode} to ${toShort}`;

      await supabase.from('entries').update({ end_time: newEndIso }).eq('id', option.entry_id);
      await supabase.from('entry_options').update({
        distance_km: result.distance_km,
        route_polyline: result.polyline ?? null,
        name: newName,
      } as any).eq('id', option.id);

      setShowRefreshPopover(false);
      onVoteChange();
    } catch (err) {
      console.error('Failed to apply refresh:', err);
    } finally {
      setApplyingRefresh(false);
    }
  };

  const fmtDurShort = (min: number): string => {
    const hh = Math.floor(min / 60);
    const mm = min % 60;
    if (hh === 0) return `${mm}m`;
    if (mm === 0) return `${hh}h`;
    return `${hh}h ${mm}m`;
  };

  const refreshModeEmoji: Record<string, string> = { walk: '🚶', transit: '🚌', drive: '🚗', bicycle: '🚲' };

  const refreshPopover = (
    <Popover open={showRefreshPopover} onOpenChange={setShowRefreshPopover}>
      <PopoverTrigger asChild>
        <button
          onClick={handleRefresh}
          className="shrink-0 rounded-full p-1 hover:bg-orange-200/50 dark:hover:bg-orange-800/30 transition-colors"
        >
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-500" /> : <RefreshCw className="h-3.5 w-3.5 text-orange-500" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2.5" align="end" onClick={e => e.stopPropagation()}>
        <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Updated routes</p>
        {refreshResults.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No routes found</p>
        ) : (
          <div className="space-y-1">
            {refreshResults.map(r => (
              <button
                key={r.mode}
                onClick={(e) => { e.stopPropagation(); setSelectedRefreshMode(r.mode); }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors',
                  selectedRefreshMode === r.mode ? 'bg-orange-100 dark:bg-orange-900/30 font-medium' : 'hover:bg-muted'
                )}
              >
                <span className="text-sm">{refreshModeEmoji[r.mode] ?? '🚌'}</span>
                <span className="flex-1 text-left capitalize">{r.mode === 'bicycle' ? 'Cycle' : r.mode}</span>
                <span className="text-[10px] text-muted-foreground">{fmtDurShort(r.duration_min)} · {formatDistanceVal(r.distance_km)}</span>
                {selectedRefreshMode === r.mode && <Check className="h-3 w-3 text-orange-500" />}
              </button>
            ))}
          </div>
        )}
        {selectedRefreshMode && refreshResults.length > 0 && (
          <Button size="sm" className="w-full mt-2 text-xs h-7 bg-orange-500 hover:bg-orange-600" onClick={handleApplyRefresh} disabled={applyingRefresh}>
            {applyingRefresh ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Apply
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );

  // ─── Glossy no-image backgrounds ───
  const glossyBg = isDark
    ? `linear-gradient(145deg, hsl(${hue}, 30%, 16%), hsl(${hue}, 15%, 9%))`
    : `linear-gradient(145deg, hsl(${hue}, 25%, 92%), hsl(${hue}, 15%, 86%))`;
  const glassBg = isDark
    ? 'linear-gradient(152deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.02) 40%, transparent 55%)'
    : 'linear-gradient(152deg, rgba(255,255,255,0.6) 25%, rgba(255,255,255,0.3) 40%, transparent 55%)';
  const glossyBorder = isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)';

  // ─── Uniform duration pill ───
  const pillStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute', zIndex: 20,
      borderRadius: 20, fontSize: 10, padding: '3px 10px',
      fontWeight: 700, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
    };
    // Position: top-right for full/condensed/tight, center-right for compact/micro
    if (isFull || isCondensedTier || isTight) {
      Object.assign(base, { top: 7, right: 7 });
    } else {
      Object.assign(base, { top: '50%', transform: 'translateY(-50%)', right: 7 });
    }
    // Lock state styling
    if (isLocked) {
      return { ...base, background: 'rgba(224, 138, 58, 0.85)', border: '1px solid rgba(224, 138, 58, 0.4)', color: '#fff' };
    }
    if (firstImage) {
      return { ...base, background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' };
    }
    if (isDark) {
      return { ...base, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' };
    }
    return { ...base, background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.08)', color: 'hsl(25, 30%, 20%)' };
  };

  const durationPill = (
    <div
      style={pillStyle()}
      onClick={(e) => { e.stopPropagation(); onToggleLock?.(); }}
      onMouseDown={(e) => { e.stopPropagation(); }}
      onTouchStart={(e) => { e.stopPropagation(); }}
      onPointerDown={(e) => { e.stopPropagation(); }}
    >
      {isLocked ? <Lock className="h-2.5 w-2.5" /> : <LockOpen className="h-2.5 w-2.5 opacity-60" />}
      <span>{durationLabel}</span>
    </div>
  );

  // ─── Corner flag ───
  const cornerFlag = () => {
    if (isMicro) {
      // Centred circle for micro
      return (
        <div
          className="absolute z-20 flex items-center justify-center"
          style={{
            left: 0, top: '50%', transform: 'translateY(-50%)',
            backgroundColor: catColor, borderRadius: 999,
            padding: '4px 6px', fontSize: 11, lineHeight: 1,
          }}
        >
          <span className="text-white" style={{ lineHeight: 1 }}>{catEmoji}</span>
        </div>
      );
    }
    const flagStyle = isFull
      ? { padding: '5px 7px', fontSize: 13 }
      : (isCondensedTier || isTight)
        ? { padding: '4px 6px', fontSize: 12 }
        : { padding: '3px 5px', fontSize: 11 };
    return (
      <div
        className="absolute z-20 flex items-center justify-center"
        style={{
          background: catColor, left: 0, top: 0,
          borderRadius: '14px 0 8px 0', lineHeight: 1,
          ...flagStyle,
        }}
      >
        <span className="text-white" style={{ lineHeight: 1 }}>{catEmoji}</span>
      </div>
    );
  };

  // ─── Transport connector card (all variants) — uses internal isCompact/isMedium/isCondensed ───
  if (isTransfer) {
    const mode = detectTransportMode(option.name);
    const optionDistanceKm = (option as any).distance_km as number | null | undefined;
    const distStr = formatDistanceVal(optionDistanceKm);

    if (h < 40) {
      return (
        <div
          onClick={onClick}
          onMouseDown={onDragStart}
          onTouchStart={onTouchDragStart} onTouchMove={onTouchDragMove} onTouchEnd={onTouchDragEnd}
          className={cn(
            'group relative flex items-center gap-1.5 overflow-hidden rounded-lg border-l-[3px] border-dashed shadow-sm transition-all hover:shadow-md bg-orange-50 dark:bg-orange-950/20',
            isEntryPast && 'opacity-50 grayscale-[30%]',
            isDragging ? 'cursor-grabbing ring-2 ring-primary scale-[1.03] shadow-xl z-50 transition-transform duration-100' : onDragStart ? 'cursor-grab' : 'cursor-pointer',
            isShaking && 'animate-shake',
            cardSizeClass
          )}
          style={{ touchAction: 'none', borderLeftColor: 'hsl(30, 80%, 55%)' }}
        >
          <div className="flex w-full items-center gap-1.5 px-2 py-0.5 pointer-events-none">
            <span className="text-xs shrink-0">{mode.emoji}</span>
            <span className="text-[10px] font-semibold text-orange-700 dark:text-orange-300">{durationLabel}</span>
            {distStr && <span className="text-[10px] text-orange-600/70 dark:text-orange-400/70">· {distStr}</span>}
          </div>
        </div>
      );
    }

    if (h >= 40 && h < 72) {
      return (
        <div
          onClick={onClick}
          onMouseDown={onDragStart}
          onTouchStart={onTouchDragStart} onTouchMove={onTouchDragMove} onTouchEnd={onTouchDragEnd}
          className={cn(
            'group relative flex items-center overflow-hidden rounded-lg border-l-[3px] border-dashed shadow-sm transition-all hover:shadow-md bg-orange-50 dark:bg-orange-950/20',
            isEntryPast && 'opacity-50 grayscale-[30%]',
            isDragging ? 'cursor-grabbing ring-2 ring-primary scale-[1.03] shadow-xl z-50 transition-transform duration-100' : onDragStart ? 'cursor-grab' : 'cursor-pointer',
            isShaking && 'animate-shake',
            cardSizeClass
          )}
          style={{ touchAction: 'none', borderLeftColor: 'hsl(30, 80%, 55%)' }}
        >
          <div className="flex w-full items-center gap-2 px-2.5 py-1 pointer-events-none">
            <span className="text-base shrink-0">{mode.emoji}</span>
            <span className="truncate text-xs font-medium text-foreground flex-1 min-w-0">{option.name}</span>
            <span className="shrink-0 text-[10px] font-bold text-orange-700 dark:text-orange-300">{durationLabel}</span>
            {distStr && <span className="shrink-0 text-[10px] text-orange-600/70 dark:text-orange-400/70">· {distStr}</span>}
          </div>
        </div>
      );
    }

    if (h >= 72 && h < 116) {
      return (
        <div
          onClick={onClick}
          onMouseDown={onDragStart}
          onTouchStart={onTouchDragStart} onTouchMove={onTouchDragMove} onTouchEnd={onTouchDragEnd}
          className={cn(
            'group relative overflow-hidden rounded-xl border-l-[3px] border-dashed shadow-sm transition-all hover:shadow-md bg-orange-50 dark:bg-orange-950/20',
            isEntryPast && 'opacity-50 grayscale-[30%]',
            isDragging ? 'cursor-grabbing ring-2 ring-primary scale-[1.03] shadow-xl z-50 transition-transform duration-100' : onDragStart ? 'cursor-grab' : 'cursor-pointer',
            isShaking && 'animate-shake',
            cardSizeClass
          )}
          style={{ touchAction: 'none', borderLeftColor: 'hsl(30, 80%, 55%)' }}
        >
          <div className="flex h-full pointer-events-none">
            <div className="flex items-center justify-center w-12 shrink-0">
              <span className="text-xl">{mode.emoji}</span>
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 py-2 pr-2">
              <span className="truncate text-sm font-semibold text-foreground">{option.name}</span>
              <div className="flex items-center gap-2 text-xs text-orange-700 dark:text-orange-300">
                <span className="font-bold">{durationLabel}</span>
                {distStr && <span className="text-orange-600/70 dark:text-orange-400/70">· {distStr}</span>}
                <span className="h-px flex-1 bg-orange-300/30 dark:bg-orange-700/30" />
                <span className="text-muted-foreground">{formatTime(startTime)} — {formatTime(endTime)}</span>
              </div>
            </div>
            <div className="flex items-start pt-2 pr-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
              {refreshPopover}
            </div>
          </div>
        </div>
      );
    }

    // Full transport card (h >= 116)
    return (
      <div
        onClick={onClick}
        onMouseDown={onDragStart}
        onTouchStart={onTouchDragStart} onTouchMove={onTouchDragMove} onTouchEnd={onTouchDragEnd}
          className={cn(
            'group relative overflow-hidden rounded-2xl border-l-[3px] border-dashed shadow-sm transition-all hover:shadow-md bg-orange-50 dark:bg-orange-950/20',
            isEntryPast && 'opacity-50 grayscale-[30%]',
            isDragging ? 'cursor-grabbing ring-2 ring-primary scale-[1.03] shadow-xl z-50 transition-transform duration-100' : onDragStart ? 'cursor-grab' : 'cursor-pointer',
            isLocked && 'border-r border-t border-b border-muted-foreground/20',
            isShaking && 'animate-shake',
            cardSizeClass
          )}
        style={{ touchAction: 'none', borderLeftColor: 'hsl(30, 80%, 55%)' }}
      >
        <div className="relative z-10 flex h-full pointer-events-none">
          <div className="flex items-center justify-center w-14 shrink-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30">
              <span className="text-2xl">{mode.emoji}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0 py-3 pr-3 space-y-1.5">
            <h3 className="truncate text-sm font-bold text-foreground">{option.name}</h3>
            {(option.departure_location || option.arrival_location) && (
              <p className="truncate text-[11px] text-muted-foreground">
                {option.departure_location} → {option.arrival_location}
              </p>
            )}
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 text-xs font-bold text-orange-700 dark:text-orange-300">{durationLabel}</span>
              {distStr && <span className="text-xs text-orange-600/70 dark:text-orange-400/70">{distStr}</span>}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                <span>{formatTime(startTime)} — {formatTime(endTime)}</span>
              </div>
              {isLocked && <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary"><Lock className="h-2.5 w-2.5 text-primary-foreground" /></span>}
            </div>
            {(option as any).route_polyline && (
              <div className="mt-1">
                <RouteMapPreview
                  polyline={(option as any).route_polyline}
                  fromAddress={option.departure_location || ''}
                  toAddress={option.arrival_location || ''}
                  travelMode={mode.label.toLowerCase()}
                  size="mini"
                />
              </div>
            )}
          </div>
          <div className="flex items-start pt-3 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {refreshPopover}
          </div>
        </div>
      </div>
    );
  }

  // ─── Overlap overlay helper ───
  const overlapOverlay = overlapFraction > 0 ? (
    <div
      className="absolute inset-x-0 z-[1] pointer-events-none rounded-[14px]"
      style={{
        background: 'linear-gradient(to right, hsla(0, 70%, 50%, 0.25), hsla(0, 70%, 50%, 0.1))',
        ...(overlapPosition === 'top'
          ? { top: 0, height: `${overlapFraction * 100}%` }
          : { bottom: 0, height: `${overlapFraction * 100}%` }),
      }}
    />
  ) : null;

  // ─── Determine gradient tier ───
  const gradientTier = isFull ? 'full' : isCondensedTier ? 'condensed' : isTight ? 'tight' : 'compact';

  // ─── Shared card wrapper for all non-transfer tiers ───
  const cardBase = (children: React.ReactNode) => (
    <div
      onClick={onClick}
      onMouseDown={onDragStart}
      onTouchStart={onTouchDragStart}
      onTouchMove={onTouchDragMove}
      onTouchEnd={onTouchDragEnd}
      className={cn(
        'group relative rounded-[14px] shadow-sm transition-all hover:shadow-md border border-white/[0.06]',
        (isCompactTier || isMicro) && h < 45 ? 'overflow-visible' : 'overflow-hidden',
        isEntryPast && 'opacity-50 grayscale-[30%]',
        isDragging ? 'cursor-grabbing ring-2 ring-primary scale-[1.03] shadow-xl z-50 transition-transform duration-100' : onDragStart ? 'cursor-grab' : 'cursor-pointer',
        isShaking && 'animate-shake',
        cardSizeClass
      )}
      style={{ touchAction: 'none' }}
    >
      {/* Inner background — ALWAYS clips to rounded corners */}
      <div className="absolute inset-0 overflow-hidden rounded-[14px]">
        {firstImage ? (
          <>
            <img src={firstImage} alt={option.name} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 z-[5]" style={{ background: DIAGONAL_GRADIENTS[gradientTier] }} />
          </>
        ) : (
          <>
            <div className="absolute inset-0" style={{ background: glossyBg, border: glossyBorder }} />
            <div className="absolute inset-0 z-[5]" style={{ background: glassBg }} />
          </>
        )}
      </div>
      {children}
      {overlapOverlay}
    </div>
  );

  // Detect hotel utility blocks for aesthetic labels
  const isCheckIn = option.name?.startsWith('Check in ·');
  const isCheckOut = option.name?.startsWith('Check out ·') || linkedType === 'checkout';
  const displayName = isCheckIn
    ? option.name?.replace(/^Check in · /, '') ?? option.name
    : isCheckOut && option.name?.startsWith('Check out · ')
      ? option.name?.replace(/^Check out · /, '')
      : option.name;

  // Text color depends on whether we have an image (always white) or glossy (depends on theme)
  const textColor = firstImage ? 'text-white' : isDark ? 'text-white' : 'text-foreground';
  const subTextColor = firstImage ? 'text-white/75' : isDark ? 'text-white/60' : 'text-muted-foreground';
  const faintTextColor = firstImage ? 'text-white/40' : isDark ? 'text-white/40' : 'text-muted-foreground/60';

  // ═══ MICRO (<30px) ═══
  if (isMicro) {
    return cardBase(
      <>
        {cornerFlag()}
        {durationPill}
        <div
          className={cn('absolute z-10 text-right', textColor)}
          style={{ top: '50%', left: 30, right: 70, transform: 'translateY(-50%)', pointerEvents: 'none' }}
        >
          <span className="text-sm font-bold truncate block" style={{ textShadow: firstImage ? '0 1px 2px rgba(0,0,0,0.2)' : undefined }}>{option.name}</span>
        </div>
      </>
    );
  }

  // ═══ COMPACT (30–71px) ═══
  if (isCompactTier) {
    return cardBase(
      <>
        {cornerFlag()}
        {durationPill}
        <div
          className={cn('absolute z-10 text-right', textColor)}
          style={{ top: '50%', left: 10, right: 70, transform: 'translateY(-50%)', pointerEvents: 'none' }}
        >
          <span className="text-sm font-bold truncate block" style={{ textShadow: firstImage ? '0 1px 2px rgba(0,0,0,0.2)' : undefined }}>{displayName}</span>
          {h >= 45 && (
            <span className={cn('text-[10px] block', faintTextColor)}>
              {formatTime(startTime)} — {formatTime(endTime)}
            </span>
          )}
        </div>
        {isCheckOut && (
          <span className={cn('absolute bottom-0.5 left-7 z-10 text-[8px] font-semibold uppercase tracking-wider', faintTextColor)}>checkout</span>
        )}
      </>
    );
  }

  // ═══ TIGHT (72–85px) ═══
  if (isTight) {
    return cardBase(
      <>
        {cornerFlag()}
        {durationPill}
        <div className={cn('absolute bottom-0 right-0 z-10 text-right flex flex-col items-end', textColor)} style={{ padding: '6px 10px', pointerEvents: 'none' }}>
          <h3 className="text-sm font-bold leading-tight truncate" style={{ textShadow: firstImage ? '0 1px 3px rgba(0,0,0,0.3)' : undefined }}>
            {displayName}
          </h3>
          <span className={cn('text-[10px]', faintTextColor)}>
            {formatTime(startTime)} — {formatTime(endTime)}
          </span>
        </div>
        {isCheckIn && (
          <span className={cn('absolute bottom-1 left-8 z-10 text-[8px] uppercase tracking-wider font-semibold', faintTextColor)}>CHECK-IN</span>
        )}
        {isCheckOut && (
          <span className={cn('absolute bottom-1 left-8 z-10 text-[8px] uppercase tracking-wider font-semibold', faintTextColor)}>checkout</span>
        )}
      </>
    );
  }

  // ═══ CONDENSED (86–115px) ═══
  if (isCondensedTier) {
    return cardBase(
      <>
        {cornerFlag()}
        {durationPill}
        <div className={cn('absolute bottom-0 right-0 z-10 text-right flex flex-col items-end', textColor)} style={{ padding: 10, pointerEvents: 'none' }}>
          {isCheckIn && (
            <span className={cn('text-[8px] uppercase tracking-wider font-semibold block mb-0.5', faintTextColor)}>CHECK-IN</span>
          )}
          <h3 className="text-sm font-bold leading-tight truncate" style={{ textShadow: firstImage ? '0 1px 3px rgba(0,0,0,0.3)' : undefined }}>
            {displayName}
          </h3>
          {(option as any).rating != null && (
            <p className={cn('text-[10px] truncate', subTextColor)}>
              ⭐ {(option as any).rating} ({Number((option as any).user_rating_count ?? 0).toLocaleString()})
            </p>
          )}
          <span className={cn('text-[10px]', faintTextColor)}>
            {formatTime(startTime)} — {formatTime(endTime)}
          </span>
        </div>
        {isCheckOut && (
          <span className={cn('absolute bottom-1 left-2.5 z-10 text-[10px] font-semibold uppercase tracking-wider', faintTextColor)}>checkout</span>
        )}
      </>
    );
  }

  // ═══ FULL (≥116px) ═══
  return cardBase(
    <>
      {cornerFlag()}
      {durationPill}

      {/* Content — bottom-right */}
      <div className={cn('absolute bottom-0 right-0 z-10 text-right flex flex-col items-end p-3', textColor)} style={{ pointerEvents: 'none' }}>
        {isCheckIn && (
          <span className={cn('text-[8px] uppercase tracking-wider font-semibold block mb-1', faintTextColor)}>CHECK-IN</span>
        )}
        {totalOptions > 1 && (
          <span className={cn('text-[10px] font-medium block mb-1', subTextColor)}>
            {optionIndex + 1}/{totalOptions}
          </span>
        )}
        <h3
          className="text-sm font-bold leading-tight mb-1"
          style={{ textShadow: firstImage ? '0 1px 4px rgba(0,0,0,0.3)' : undefined }}
        >
          {displayName}
        </h3>
        {!isTransfer && !isProcessing && (option as any).rating != null && (
          <p className={cn('text-[10px] mb-0.5', subTextColor)}>
            ⭐ {(option as any).rating} ({Number((option as any).user_rating_count ?? 0).toLocaleString()})
          </p>
        )}
        {!isTransfer && !isProcessing && option.location_name && (
          <p className={cn('text-[9px] truncate mb-0.5', subTextColor)}>
            📍 {option.location_name}
          </p>
        )}
        {notes && !isTransfer && !isProcessing && (
          <p className={cn('text-[10px] line-clamp-2 mb-0.5', subTextColor)}>
            {notes}
          </p>
        )}

        {/* Flight info */}
        {option.category === 'flight' && option.departure_location ? (
          <p className={cn('text-[10px]', faintTextColor)}>
            {option.departure_location?.split(' - ')[0]}{option.departure_terminal ? ` T${option.departure_terminal}` : ''} → {option.arrival_location?.split(' - ')[0]}{option.arrival_terminal ? ` T${option.arrival_terminal}` : ''}
          </p>
        ) : !isProcessing && (
          <p className={cn('text-[10px] mt-0.5', faintTextColor)}>
            {formatTime(startTime)} — {formatTime(endTime)}
          </p>
        )}

        {/* Processing time */}
        {isProcessing && (
          <p className={cn('text-[10px]', faintTextColor)}>
            {formatTime(startTime)} — {formatTime(endTime)}
          </p>
        )}
      </div>

      {/* Distance (bottom-left) */}
      {!isProcessing && distanceKm !== null && distanceKm !== undefined && (
        <div className={cn('absolute bottom-4 left-4 z-10 flex items-center gap-1 text-[10px]', faintTextColor)}>
          <MapPin className="h-3 w-3" />
          <span>{distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`}</span>
        </div>
      )}

      {/* Mini route map on transport cards */}
      {isTransfer && (option as any).route_polyline && (
        <div className="absolute bottom-16 left-4 right-4 z-10">
          <RouteMapPreview
            polyline={(option as any).route_polyline}
            fromAddress={option.departure_location || ''}
            toAddress={option.arrival_location || ''}
            travelMode="transit"
            size="mini"
          />
        </div>
      )}

      {isCheckOut && (
        <span className={cn('absolute bottom-1 left-3 z-10 text-[10px] font-semibold uppercase tracking-wider', faintTextColor)}>checkout</span>
      )}
    </>
  );
};

export default EntryCard;

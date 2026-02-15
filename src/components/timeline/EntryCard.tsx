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
import VoteButton from './VoteButton';

const formatDuration = (startIso: string, endIso: string): string => {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
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
  isCompact?: boolean;
  isMedium?: boolean;
  isCondensed?: boolean;
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
  isCompact,
  isMedium,
  isCondensed,
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


  const tintBg = isProcessing ? `${catColor}10` : `${catColor}18`;

  const handleLockClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleLock?.();
  };

  const durationLabel = formatDuration(startTime, endTime);

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
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
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

  // ─── Transport connector card (all variants) ───
  if (isTransfer) {
    const mode = detectTransportMode(option.name);
    const optionDistanceKm = (option as any).distance_km as number | null | undefined;
    const distStr = formatDistanceVal(optionDistanceKm);

    if (isCompact) {
      return (
        <div
          onClick={onClick}
          onMouseDown={onDragStart}
          onTouchStart={onTouchDragStart} onTouchMove={onTouchDragMove} onTouchEnd={onTouchDragEnd}
          className={cn(
            'group relative flex items-center gap-1.5 overflow-hidden rounded-lg border-l-[3px] border-dashed shadow-sm transition-all hover:shadow-md bg-orange-50 dark:bg-orange-950/20',
            isEntryPast && 'opacity-50 grayscale-[30%]',
            isDragging ? 'cursor-grabbing ring-2 ring-primary' : onDragStart ? 'cursor-grab' : 'cursor-pointer',
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

    if (isMedium) {
      return (
        <div
          onClick={onClick}
          onMouseDown={onDragStart}
          onTouchStart={onTouchDragStart} onTouchMove={onTouchDragMove} onTouchEnd={onTouchDragEnd}
          className={cn(
            'group relative flex items-center overflow-hidden rounded-lg border-l-[3px] border-dashed shadow-sm transition-all hover:shadow-md bg-orange-50 dark:bg-orange-950/20',
            isEntryPast && 'opacity-50 grayscale-[30%]',
            isDragging ? 'cursor-grabbing ring-2 ring-primary' : onDragStart ? 'cursor-grab' : 'cursor-pointer',
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

    if (isCondensed) {
      return (
        <div
          onClick={onClick}
          onMouseDown={onDragStart}
          onTouchStart={onTouchDragStart} onTouchMove={onTouchDragMove} onTouchEnd={onTouchDragEnd}
          className={cn(
            'group relative overflow-hidden rounded-xl border-l-[3px] border-dashed shadow-sm transition-all hover:shadow-md bg-orange-50 dark:bg-orange-950/20',
            isEntryPast && 'opacity-50 grayscale-[30%]',
            isDragging ? 'cursor-grabbing ring-2 ring-primary' : onDragStart ? 'cursor-grab' : 'cursor-pointer',
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

    // Full transport card
    return (
      <div
        onClick={onClick}
        onMouseDown={onDragStart}
        onTouchStart={onTouchDragStart} onTouchMove={onTouchDragMove} onTouchEnd={onTouchDragEnd}
          className={cn(
            'group relative overflow-hidden rounded-2xl border-l-[3px] border-dashed shadow-sm transition-all hover:shadow-md bg-orange-50 dark:bg-orange-950/20',
            isEntryPast && 'opacity-50 grayscale-[30%]',
            isDragging ? 'cursor-grabbing ring-2 ring-primary' : onDragStart ? 'cursor-grab' : 'cursor-pointer',
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

  // Medium layout for sub-hour entries (40-80px)
  if (isMedium) {
    return (
      <div
        onClick={onClick}
        onMouseDown={onDragStart}
        onTouchStart={onTouchDragStart}
        onTouchMove={onTouchDragMove}
        onTouchEnd={onTouchDragEnd}
        className={cn(
          'group relative overflow-hidden rounded-xl border shadow-sm transition-all hover:shadow-md',
          isEntryPast && 'opacity-50 grayscale-[30%]',
          isDragging ? 'cursor-grabbing ring-2 ring-primary' : onDragStart ? 'cursor-grab' : 'cursor-pointer',
          isLocked && 'border-2 border-muted-foreground/20',
          isShaking && 'animate-shake',
          cardSizeClass
        )}
        style={{
          touchAction: 'none',
          borderColor: isLocked ? undefined : catColor,
          borderLeftWidth: isLocked ? undefined : 3,
          background: tintBg,
        }}
      >
        <div className="relative z-10 flex h-full flex-col justify-center gap-0.5 px-2.5 py-1 pointer-events-none">
          <span className="truncate text-xs font-semibold leading-tight">
            {catEmoji} {option.name}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatTime(startTime)} — {formatTime(endTime)}
            <span className="ml-1 font-bold">{durationLabel}</span>
          </span>
        </div>
        {overlapFraction > 0 && (
          <div
            className="absolute inset-x-0 z-[1] pointer-events-none rounded-xl"
            style={{
              background: 'linear-gradient(to right, hsla(0, 70%, 50%, 0.25), hsla(0, 70%, 50%, 0.1))',
              ...(overlapPosition === 'top'
                ? { top: 0, height: `${overlapFraction * 100}%` }
                : { bottom: 0, height: `${overlapFraction * 100}%` }),
            }}
          />
        )}
      </div>
    );
  }

  // Compact single-line layout for very short entries
  if (isCompact) {
    return (
      <div
        onClick={onClick}
        onMouseDown={onDragStart}
        onTouchStart={onTouchDragStart}
        onTouchMove={onTouchDragMove}
        onTouchEnd={onTouchDragEnd}
        className={cn(
          'group relative flex items-center gap-1.5 overflow-hidden rounded-lg border shadow-sm transition-all hover:shadow-md',
          isEntryPast && 'opacity-50 grayscale-[30%]',
          isDragging ? 'cursor-grabbing ring-2 ring-primary' : onDragStart ? 'cursor-grab' : 'cursor-pointer',
          isLocked && 'border-2 border-muted-foreground/20',
          isShaking && 'animate-shake',
          cardSizeClass
        )}
        style={{
          touchAction: 'none',
          borderColor: isLocked ? undefined : catColor,
          borderLeftWidth: isLocked ? undefined : 3,
          background: tintBg,
        }}
      >
        <div className="relative z-10 flex w-full items-center gap-1.5 px-2 py-0.5 pointer-events-none">
          <span className="text-xs shrink-0">{catEmoji}</span>
          <span className="truncate text-[11px] font-semibold leading-tight flex-1 min-w-0">
            {option.name}
          </span>
          <span className="shrink-0 text-[9px] text-muted-foreground whitespace-nowrap">
            {formatTime(startTime)}–{formatTime(endTime)} <span className="font-bold">{durationLabel}</span>
          </span>
        </div>
      </div>
    );
  }

  // Condensed layout for 1-2 hour events (80-160px)
  // Detect hotel utility blocks for aesthetic labels
  const isCheckIn = option.name?.startsWith('Check in ·');
  const isCheckOut = option.name?.startsWith('Check out ·') || linkedType === 'checkout';
  const displayName = isCheckIn
    ? option.name?.replace(/^Check in · /, '') ?? option.name
    : isCheckOut && option.name?.startsWith('Check out · ')
      ? option.name?.replace(/^Check out · /, '')
      : option.name;

  if (isCondensed) {
    return (
      <div
        onClick={onClick}
        onMouseDown={onDragStart}
        onTouchStart={onTouchDragStart}
        onTouchMove={onTouchDragMove}
        onTouchEnd={onTouchDragEnd}
        className={cn(
          'group relative overflow-hidden rounded-xl border shadow-sm transition-all hover:shadow-md',
          isEntryPast && 'opacity-50 grayscale-[30%]',
          isDragging ? 'cursor-grabbing ring-2 ring-primary' : onDragStart ? 'cursor-grab' : 'cursor-pointer',
          isLocked && 'border-2 border-muted-foreground/20',
          isShaking && 'animate-shake',
          cardSizeClass
        )}
        style={{
          touchAction: 'none',
          borderColor: isLocked ? undefined : catColor,
          borderLeftWidth: isLocked ? undefined : 3,
          background: firstImage ? undefined : tintBg,
        }}
      >
        {firstImage && (
          <div className="absolute inset-0">
            <img src={firstImage} alt={option.name} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/5" />
          </div>
        )}
        <div className={cn(
          'relative z-10 flex h-full flex-col justify-between px-2.5 py-1.5 pointer-events-none',
          firstImage ? 'text-white' : 'text-foreground'
        )}>
          <div>
            <div className="flex items-center gap-1.5">
              {option.category && (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold mb-1"
                  style={{ backgroundColor: catColor, color: '#fff' }}
                >
                  <span className="text-[10px]">{catEmoji}</span>
                  {catName}
                </span>
              )}
              {isCheckIn && (
                <span className={cn('text-[8px] uppercase tracking-wider font-semibold mb-1', firstImage ? 'text-white/60' : 'text-muted-foreground')}>CHECK-IN</span>
              )}
            </div>
            <h3 className="truncate text-sm font-bold leading-tight">
              {displayName}
            </h3>
            {(option as any).rating != null && (
              <p className={cn(
                'text-[10px]',
                firstImage ? 'text-white/70' : 'text-muted-foreground'
              )}>
                ⭐ {(option as any).rating} ({Number((option as any).user_rating_count ?? 0).toLocaleString()})
              </p>
            )}
            {option.location_name && (
              <p className={cn('flex items-center gap-0.5 text-[9px] truncate', firstImage ? 'text-white/70' : 'text-muted-foreground')}>
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{option.location_name}</span>
              </p>
            )}
            {notes && (
              <p className={cn(
                'text-[9px] line-clamp-1',
                firstImage ? 'text-white/60' : 'text-muted-foreground'
              )}>
                {notes}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className={cn(
                'text-[10px]',
                firstImage ? 'text-white/70' : 'text-muted-foreground'
              )}>
                {formatTime(startTime)} — {formatTime(endTime)}
              </span>
            </div>
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
              firstImage ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
            )}>
              {durationLabel}
            </span>
          </div>
        </div>
        {isCheckOut && (
          <span className={cn(
            'absolute bottom-1 left-2.5 z-10 text-[10px] font-semibold uppercase tracking-wider',
            firstImage ? 'text-white/60' : 'text-muted-foreground/70'
          )}>checkout</span>
        )}
        {overlapFraction > 0 && (
          <div
            className="absolute inset-x-0 z-[1] pointer-events-none rounded-xl"
            style={{
              background: 'linear-gradient(to right, hsla(0, 70%, 50%, 0.25), hsla(0, 70%, 50%, 0.1))',
              ...(overlapPosition === 'top'
                ? { top: 0, height: `${overlapFraction * 100}%` }
                : { bottom: 0, height: `${overlapFraction * 100}%` }),
            }}
          />
        )}
    </div>
    );
  }

  return (
    <div
      onClick={onClick}
      onMouseDown={onDragStart}
      onTouchStart={onTouchDragStart}
      onTouchMove={onTouchDragMove}
      onTouchEnd={onTouchDragEnd}
        className={cn(
          'group relative overflow-hidden rounded-2xl border shadow-md transition-all hover:shadow-lg',
          isEntryPast && 'opacity-50 grayscale-[30%]',
          isDragging ? 'cursor-grabbing ring-2 ring-primary' : onDragStart ? 'cursor-grab' : 'cursor-pointer',
          isLocked && 'border-2 border-muted-foreground/20',
          isProcessing && 'opacity-80',
          isShaking && 'animate-shake',
          cardSizeClass
        )}
      style={{
        touchAction: 'none',
        ...(!firstImage ? {
          borderColor: isLocked ? undefined : catColor,
          borderLeftWidth: isLocked ? undefined : 4,
        } : {}),
      }}
    >
      {/* Background */}
      {firstImage ? (
        <div className="absolute inset-0">
          <img src={firstImage} alt={option.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/5" />
        </div>
      ) : (
        <div className="absolute inset-0" style={{ background: tintBg }} />
      )}

      {/* Content */}
      <div className={cn(
        'relative z-10 p-4 pointer-events-none',
        firstImage ? 'text-white' : 'text-foreground',
        isProcessing && 'p-3'
      )}>
        {/* Top row: Category + Options indicator */}
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-1.5">
            {option.category && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ backgroundColor: catColor, color: '#fff' }}
              >
                <span className="text-xs">{catEmoji}</span>
                {isProcessing
                  ? (linkedType === 'checkin' ? 'Check-in' : 'Checkout')
                  : catName
                }
              </span>
            )}
            {isCheckIn && (
              <span className={cn('text-[8px] uppercase tracking-wider font-semibold', firstImage ? 'text-white/60' : 'text-muted-foreground')}>CHECK-IN</span>
            )}
          </div>
          {totalOptions > 1 && (
            <span className={cn(
              'text-[10px] font-medium',
              firstImage ? 'text-white/70' : 'text-muted-foreground'
            )}>
              {optionIndex + 1}/{totalOptions}
            </span>
          )}
        </div>

        {/* Title with emoji */}
        <h3
          className={cn(
            'mb-2 flex items-center gap-2 font-display font-bold leading-tight',
            isProcessing ? 'text-sm' : 'text-lg'
          )}
        >
          {!option.category && <span className="text-xl">{catEmoji}</span>}
          {displayName}
        </h3>

        {/* Rating */}
        {!isTransfer && !isProcessing && (option as any).rating != null && (
          <p className={cn(
            'mb-1 text-[10px]',
            firstImage ? 'text-white/70' : 'text-muted-foreground'
          )}>
            ⭐ {(option as any).rating} ({Number((option as any).user_rating_count ?? 0).toLocaleString()})
          </p>
        )}
        {!isTransfer && !isProcessing && option.location_name && (
          <p className={cn('mb-2 flex items-center gap-1 text-xs truncate', firstImage ? 'text-white/80' : 'text-muted-foreground')}>
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{option.location_name}</span>
          </p>
        )}

        {/* Notes */}
        {notes && !isTransfer && !isProcessing && (
          <p className={cn(
            'mb-2 text-xs line-clamp-2',
            firstImage ? 'text-white/70' : 'text-muted-foreground'
          )}>
            {notes}
          </p>
        )}

        {/* Transfer FROM → TO display */}
        {isTransfer && (option.departure_location || option.arrival_location) && (
          <div className={cn(
            'mb-2 flex items-center gap-1.5 text-xs',
            firstImage ? 'text-white/80' : 'text-muted-foreground'
          )}>
            <span>{option.departure_location}</span>
            <ArrowRight className="h-3 w-3" />
            <span>{option.arrival_location}</span>
          </div>
        )}

        {/* Contingency buffer label for transport */}
        {isTransfer && (() => {
          const totalMs = new Date(endTime).getTime() - new Date(startTime).getTime();
          const blockMin = Math.round(totalMs / 60000);
          const contingency = blockMin % 5 === 0 ? blockMin - Math.floor(blockMin / 5) * 5 : 0;
          // A simpler approach: if block is a multiple of 5 and > real duration, show contingency
          // We don't know real duration here, but we can detect if the block is rounded
          // For now, show nothing - contingency is visual in the block size
          return null;
        })()}

        {/* Mini route map on transport cards */}
        {isTransfer && (option as any).route_polyline && !isCompact && !isMedium && (
          <div className="mb-2">
            <RouteMapPreview
              polyline={(option as any).route_polyline}
              fromAddress={option.departure_location || ''}
              toAddress={option.arrival_location || ''}
              travelMode="transit"
              size="mini"
            />
          </div>
        )}

        {/* Time / Flight info */}
        {option.category === 'flight' && option.departure_location ? (
          <div className={cn(
            'mb-2 flex items-center gap-1.5 text-xs',
            firstImage ? 'text-white/80' : 'text-muted-foreground'
          )}>
            <Plane className="h-3 w-3" />
            <span>
              {option.departure_location?.split(' - ')[0]}{option.departure_terminal ? ` T${option.departure_terminal}` : ''} {formatTimeInTz(startTime, option.departure_tz)} → {option.arrival_location?.split(' - ')[0]}{option.arrival_terminal ? ` T${option.arrival_terminal}` : ''} {formatTimeInTz(endTime, option.arrival_tz)}
            </span>
          </div>
        ) : !isTransfer && !isProcessing && (
          <div className={cn(
            'mb-2 flex items-center gap-1.5 text-xs',
            firstImage ? 'text-white/80' : 'text-muted-foreground'
          )}>
            <Clock className="h-3 w-3" />
            <span>{formatTime(startTime)} — {formatTime(endTime)}</span>
          </div>
        )}

        {/* Processing: show time compactly */}
        {isProcessing && (
          <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatTime(startTime)} — {formatTime(endTime)}</span>
          </div>
        )}

        {/* Bottom row: Distance + Duration + Votes */}
        {!isProcessing && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {distanceKm !== null && distanceKm !== undefined && (
                <div className={cn(
                  'flex items-center gap-1 text-xs',
                  firstImage ? 'text-white/70' : 'text-muted-foreground'
                )}>
                  <MapPin className="h-3 w-3" />
                  <span>{distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                firstImage ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
              )}>
                {durationLabel}
              </span>
              {userId && totalOptions > 1 && option.category !== 'transfer' && option.category !== 'flight' && (
                <span className="pointer-events-auto">
                <VoteButton
                  optionId={option.id}
                  userId={userId}
                  voteCount={option.vote_count ?? 0}
                  hasVoted={hasVoted}
                  locked={votingLocked}
                  onVoteChange={onVoteChange}
                />
                </span>
              )}
            </div>
          </div>
        )}

      </div>

      {isCheckOut && (
        <span className={cn(
          'absolute bottom-1 left-3 z-10 text-[10px] font-semibold uppercase tracking-wider',
          firstImage ? 'text-white/60' : 'text-muted-foreground/70'
        )}>checkout</span>
      )}

      {/* Overlap red tint overlay */}
      {overlapFraction > 0 && (
        <div
          className="absolute inset-x-0 z-[1] pointer-events-none rounded-2xl"
          style={{
            background: 'linear-gradient(to right, hsla(0, 70%, 50%, 0.25), hsla(0, 70%, 50%, 0.1))',
            ...(overlapPosition === 'top'
              ? { top: 0, height: `${overlapFraction * 100}%` }
              : { bottom: 0, height: `${overlapFraction * 100}%` }),
          }}
        />
      )}
    </div>
  );
};

export default EntryCard;

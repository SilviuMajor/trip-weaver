import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { format, isToday, isPast, addMinutes } from 'date-fns';
import { calculateSunTimes } from '@/lib/sunCalc';
import type { EntryWithOptions, EntryOption, WeatherData, TransportMode } from '@/types/trip';
import { cn } from '@/lib/utils';
import { haversineKm } from '@/lib/distance';
import { localToUTC, getHourInTimezone, resolveEntryTz, getDateInTimezone, getUtcOffsetHoursDiff } from '@/lib/timezoneUtils';
import { Plus, Bus, Lock, LockOpen, AlertTriangle, Magnet, Loader2, Trash2 } from 'lucide-react';
import { useDragResize, type DragType } from '@/hooks/useDragResize';
import EntryCard from './EntryCard';
import FlightGroupCard from './FlightGroupCard';

import TransportConnector from './TransportConnector';

import WeatherBadge from './WeatherBadge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface FlightTzInfo {
  originTz: string;
  destinationTz: string;
  flightStartHour: number;
  flightEndHour: number;
  flightEndUtc?: string;
}

interface ContinuousTimelineProps {
  days: Date[];
  entries: EntryWithOptions[];
  allEntries: EntryWithOptions[];
  formatTime: (iso: string, tz?: string) => string;
  homeTimezone: string;
  userLat: number | null;
  userLng: number | null;
  votingLocked: boolean;
  userId: string | undefined;
  userVotes: string[];
  onVoteChange: () => void;
  onCardTap: (entry: EntryWithOptions, option: EntryOption) => void;
  
  weatherData: WeatherData[];
  onClickSlot?: (isoTime: string) => void;
  onDragSlot?: (startIso: string, endIso: string) => void;
  onAddBetween?: (prefillTime: string, gapContext?: { fromName: string; toName: string; fromAddress: string; toAddress: string }) => void;
  onAddTransport?: (fromEntryId: string, toEntryId: string, prefillTime: string, resolvedTz?: string) => void;
  onGenerateTransport?: (fromEntryId: string, toEntryId: string, prefillTime: string, resolvedTz?: string) => void;
  onEntryTimeChange?: (entryId: string, newStartIso: string, newEndIso: string) => Promise<void>;
  onDropFromPanel?: (entryId: string, globalHour: number) => void;
  onModeSwitchConfirm?: (entryId: string, mode: string, newDurationMin: number, distanceKm: number, polyline?: string | null) => Promise<void>;
  onDeleteTransport?: (entryId: string) => Promise<void>;
  dayTimezoneMap: Map<string, { activeTz: string; flights: FlightTzInfo[] }>;
  dayLocationMap: Map<string, { lat: number; lng: number }>;
  isEditor?: boolean;
  onToggleLock?: (entryId: string, currentLocked: boolean) => void;
  scrollContainerRef?: React.RefObject<HTMLElement>;
  isUndated?: boolean;
  onCurrentDayChange?: (dayIndex: number) => void;
  onTrimDay?: (side: 'start' | 'end') => void;
  onMagnetSnap?: (entryId: string) => Promise<void>;
  pixelsPerHour: number;
  onResetZoom?: () => void;
  onDragActiveChange?: (active: boolean, entryId: string | null) => void;
  onDragCommitOverride?: (entryId: string, clientX: number, clientY: number) => boolean;
  onDragPositionUpdate?: (clientX: number, clientY: number) => void;
  onDragEnd?: () => void;
  onDragPhaseChange?: (phase: 'timeline' | 'detached' | null) => void;
  binRef?: React.RefObject<HTMLDivElement>;
}

const ContinuousTimeline = ({
  days,
  entries: scheduledEntries,
  allEntries,
  formatTime,
  homeTimezone,
  userLat,
  userLng,
  votingLocked,
  userId,
  userVotes,
  onVoteChange,
  onCardTap,
  
  weatherData,
  onClickSlot,
  onDragSlot,
  onAddBetween,
  onAddTransport,
  onGenerateTransport,
  onEntryTimeChange,
  onDropFromPanel,
  onModeSwitchConfirm,
  onDeleteTransport,
  dayTimezoneMap,
  dayLocationMap,
  isEditor,
  onToggleLock,
  scrollContainerRef,
  isUndated,
  onCurrentDayChange,
  onTrimDay,
  onMagnetSnap,
  pixelsPerHour,
  onResetZoom,
  onDragActiveChange,
  onDragCommitOverride,
  onDragPositionUpdate,
  onDragEnd,
  onDragPhaseChange,
  binRef,
}: ContinuousTimelineProps) => {
  const totalDays = days.length;
  const totalHours = totalDays * 24;
  const containerHeight = totalHours * pixelsPerHour + 30;
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridTopPx, setGridTopPx] = useState(0);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);

  // Double-tap to reset zoom
  const lastTapRef = useRef<number>(0);

  // Tap-to-create refs (mobile)
  const tapCreateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotTouchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Previous dragState ref for detecting drag end
  const prevDragStateRef = useRef<boolean>(false);

  // dragPhase is now computed via useMemo below (after dragState is available)

  // Single scroll listener that measures grid position inline (no stale gridTopPx dependency)
  useEffect(() => {
    const container = scrollContainerRef?.current;
    const grid = gridRef.current;
    if (!container || !grid || days.length === 0) return;

    const handleScroll = () => {
      const containerRect = container.getBoundingClientRect();
      const gridRect = grid.getBoundingClientRect();
      const gridTop = gridRect.top - containerRect.top + container.scrollTop;
      setGridTopPx(gridTop);
      const centreScroll = container.scrollTop + container.clientHeight / 2;
      const adjustedScroll = centreScroll - gridTop;
      const dayIdx = Math.floor(adjustedScroll / (24 * pixelsPerHour));
      const clamped = Math.max(0, Math.min(days.length - 1, dayIdx));
      setCurrentDayIndex(clamped);
      onCurrentDayChange?.(clamped);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    const timer = setTimeout(handleScroll, 150);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(timer);
    };
  }, [scrollContainerRef?.current, days.length, onCurrentDayChange, pixelsPerHour]);

  // Helper to get TZ abbreviation at midnight for a day (before any flight departs)
  const getMidnightTzAbbrev = useCallback((dayDate: Date): string => {
    const dayStr = format(dayDate, 'yyyy-MM-dd');
    const tzInfo = dayTimezoneMap.get(dayStr);
    if (!tzInfo) return '';
    // At midnight, use the origin TZ (before any flight departs that day)
    const tz = tzInfo.flights.length > 0 ? tzInfo.flights[0].originTz : tzInfo.activeTz;
    try {
      return new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'short' })
        .formatToParts(dayDate).find(p => p.type === 'timeZoneName')?.value || '';
    } catch { return ''; }
  }, [dayTimezoneMap]);

  // Resolve TZ info for a given day
  const getDayTzInfo = useCallback((dayDate: Date) => {
    const dayStr = format(dayDate, 'yyyy-MM-dd');
    return dayTimezoneMap.get(dayStr);
  }, [dayTimezoneMap]);

  const getActiveTz = useCallback((dayDate: Date) => {
    return getDayTzInfo(dayDate)?.activeTz || homeTimezone;
  }, [getDayTzInfo, homeTimezone]);

  const getDayFlights = useCallback((dayDate: Date): FlightTzInfo[] => {
    return getDayTzInfo(dayDate)?.flights || [];
  }, [getDayTzInfo]);

  // Find day index for an entry
  const findDayIndex = useCallback((isoTime: string, tz: string): number => {
    const dateStr = getDateInTimezone(isoTime, tz);
    for (let i = 0; i < days.length; i++) {
      if (format(days[i], 'yyyy-MM-dd') === dateStr) return i;
    }
    return 0;
  }, [days]);

  // Compute global hour for an entry
  const getEntryGlobalHours = useCallback((entry: EntryWithOptions): { startGH: number; endGH: number; resolvedTz: string } => {
    const opt = entry.options[0];
    const isFlight = opt?.category === 'flight' && opt.departure_tz && opt.arrival_tz;

    if (isFlight) {
      const depTz = opt.departure_tz!;
      const dayIdx = findDayIndex(entry.start_time, depTz);
      const startLocal = getHourInTimezone(entry.start_time, depTz);
      const startGH = dayIdx * 24 + startLocal;
      const utcDurH = (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / 3600000;
      return { startGH, endGH: startGH + utcDurH, resolvedTz: depTz };
    }

    // Non-flight: resolve TZ based on day's flight info
    // First find which day this entry belongs to by checking TZ
    let resolvedTz = homeTimezone;
    for (const [dayStr, info] of dayTimezoneMap) {
      const entryDate = getDateInTimezone(entry.start_time, info.activeTz);
      if (entryDate === dayStr) {
        resolvedTz = info.activeTz;
        if (info.flights.length > 0 && info.flights[0].flightEndUtc) {
          const entryMs = new Date(entry.start_time).getTime();
          const flightEndMs = new Date(info.flights[0].flightEndUtc).getTime();
          // Transport entries inherit TZ from their "from" entry
          if (entry.from_entry_id) {
            const fromEntry = scheduledEntries.find(e => e.id === entry.from_entry_id);
            if (fromEntry) {
              const fromMs = new Date(fromEntry.start_time).getTime();
              resolvedTz = fromMs >= flightEndMs ? info.flights[0].destinationTz : info.flights[0].originTz;
            } else {
              resolvedTz = entryMs >= flightEndMs ? info.flights[0].destinationTz : info.flights[0].originTz;
            }
          } else {
            resolvedTz = entryMs >= flightEndMs ? info.flights[0].destinationTz : info.flights[0].originTz;
          }
        }
        break;
      }
    }

    const dayIdx = findDayIndex(entry.start_time, resolvedTz);
    const startLocal = getHourInTimezone(entry.start_time, resolvedTz);
    const endLocal = getHourInTimezone(entry.end_time, resolvedTz);
    const startGH = dayIdx * 24 + startLocal;

    // Handle cross-midnight: if end is before start in local time, it's the next day
    let endGH: number;
    if (endLocal < startLocal) {
      endGH = (dayIdx + 1) * 24 + endLocal;
    } else {
      endGH = dayIdx * 24 + endLocal;
    }

    return { startGH, endGH, resolvedTz };
  }, [dayTimezoneMap, homeTimezone, findDayIndex, scheduledEntries]);

  // Sort all scheduled entries by global start hour
  const sortedEntries = useMemo(() => {
    return [...scheduledEntries].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  }, [scheduledEntries]);

  // Drag commit handler: convert global hours back to day/local/UTC
  const handleDragCommit = useCallback((entryId: string, newStartGH: number, newEndGH: number, tz?: string, _targetDay?: Date, dragType?: DragType, clientX?: number, clientY?: number) => {
    // For move drags, check override (bin/planner) first — only when detached
    if (dragType === 'move' && clientX !== undefined && clientY !== undefined) {
      if (onDragCommitOverride?.(entryId, clientX, clientY)) return;
    }

    if (!onEntryTimeChange) return;
    const entry = sortedEntries.find(e => e.id === entryId);
    if (!entry) return;
    if (entry.is_locked) return;

    const dayIndex = Math.floor(newStartGH / 24);
    const clampedDayIndex = Math.max(0, Math.min(dayIndex, days.length - 1));
    const dayDate = days[clampedDayIndex];
    const dateStr = format(dayDate, 'yyyy-MM-dd');

    const toTimeStr = (hour: number) => {
      const localHour = hour % 24;
      const minutes = Math.round(localHour * 60);
      const h = Math.floor(minutes / 60) % 24;
      const m = minutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const primaryOpt = entry.options[0];
    const isFlight = primaryOpt?.category === 'flight' && primaryOpt?.departure_tz && primaryOpt?.arrival_tz;
    const tzInfo = dayTimezoneMap.get(dateStr);
    const startTz = isFlight ? primaryOpt.departure_tz! : (tz || tzInfo?.activeTz || homeTimezone);
    const endTz = isFlight ? primaryOpt.arrival_tz! : startTz;

    const isMove = dragType === 'move';

    if (isMove && entry) {
      const origDurationMs = new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime();
      const newStartIso = localToUTC(dateStr, toTimeStr(newStartGH), startTz);
      const newEndIso = new Date(new Date(newStartIso).getTime() + origDurationMs).toISOString();
      onEntryTimeChange(entryId, newStartIso, newEndIso);
    } else {
      // Resize: end might be on a different day
      const endDayIndex = Math.floor(newEndGH / 24);
      const clampedEndDayIndex = Math.max(0, Math.min(endDayIndex, days.length - 1));
      const endDateStr = format(days[clampedEndDayIndex], 'yyyy-MM-dd');
      const newStartIso = localToUTC(dateStr, toTimeStr(newStartGH), startTz);
      const newEndIso = localToUTC(endDateStr, toTimeStr(newEndGH), endTz);
      onEntryTimeChange(entryId, newStartIso, newEndIso);
    }

    // Move linked processing entries if this is a flight
    if (entry) {
      const linkedOpt = entry.options[0];
      const linkedEntries = allEntries.filter(e => e.linked_flight_id === entry.id);
      const fallbackTz = tz || tzInfo?.activeTz || homeTimezone;

      linkedEntries.forEach(linked => {
        const linkedTz = linked.linked_type === 'checkin'
          ? (linkedOpt?.departure_tz || fallbackTz)
          : (linkedOpt?.arrival_tz || fallbackTz);

        const linkedDurationMs = new Date(linked.end_time).getTime() - new Date(linked.start_time).getTime();

        let newLinkedStartIso: string;
        let newLinkedEndIso: string;

        if (linked.linked_type === 'checkin') {
          const newLinkedEndHour = newStartGH;
          const linkedEndDayIdx = Math.max(0, Math.min(Math.floor(newLinkedEndHour / 24), days.length - 1));
          newLinkedEndIso = localToUTC(format(days[linkedEndDayIdx], 'yyyy-MM-dd'), toTimeStr(newLinkedEndHour), linkedTz);
          newLinkedStartIso = new Date(new Date(newLinkedEndIso).getTime() - linkedDurationMs).toISOString();
        } else {
          const newLinkedStartHour = newEndGH;
          const linkedStartDayIdx = Math.max(0, Math.min(Math.floor(newLinkedStartHour / 24), days.length - 1));
          newLinkedStartIso = localToUTC(format(days[linkedStartDayIdx], 'yyyy-MM-dd'), toTimeStr(newLinkedStartHour), linkedTz);
          newLinkedEndIso = new Date(new Date(newLinkedStartIso).getTime() + linkedDurationMs).toISOString();
        }

        onEntryTimeChange(linked.id, newLinkedStartIso, newLinkedEndIso);
      });
    }
  }, [onEntryTimeChange, sortedEntries, days, dayTimezoneMap, homeTimezone, allEntries, onDragCommitOverride]);

  const { dragState, wasDraggedRef, onMouseDown, onTouchStart, onTouchMove, onTouchEnd } = useDragResize({
    pixelsPerHour,
    startHour: 0,
    totalHours,
    gridTopPx,
    onCommit: handleDragCommit,
    scrollContainerRef,
  });

  // Locked-entry drag feedback
  const [shakeEntryId, setShakeEntryId] = useState<string | null>(null);
  const [refreshingTransportId, setRefreshingTransportId] = useState<string | null>(null);
  const [magnetLoadingId, setMagnetLoadingId] = useState<string | null>(null);
  
  const handleLockedAttempt = useCallback((entryId: string) => {
    toast.error('Cannot drag a locked event');
    setShakeEntryId(entryId);
    setTimeout(() => setShakeEntryId(null), 400);
  }, []);

  // Build flight groups
  const { flightGroupMap, linkedEntryIds } = useMemo(() => {
    const map = new Map<string, { flight: EntryWithOptions; checkin?: EntryWithOptions; checkout?: EntryWithOptions }>();
    const linked = new Set<string>();

    sortedEntries.forEach(entry => {
      const opt = entry.options[0];
      if (opt?.category === 'flight') {
        const group: { flight: EntryWithOptions; checkin?: EntryWithOptions; checkout?: EntryWithOptions } = { flight: entry };
        sortedEntries.forEach(e => {
          if (e.linked_flight_id === entry.id) {
            linked.add(e.id);
            if (e.linked_type === 'checkin') group.checkin = e;
            else if (e.linked_type === 'checkout') group.checkout = e;
          }
        });
        map.set(entry.id, group);
      }
    });

    return { flightGroupMap: map, linkedEntryIds: linked };
  }, [sortedEntries]);

  // Transport detection helper
  const isTransportEntry = useCallback((entry: EntryWithOptions): boolean => {
    const opt = entry.options[0];
    if (!opt) return false;
    if (opt.category === 'transfer') return true;
    const name = opt.name?.toLowerCase() ?? '';
    return (entry.from_entry_id != null && entry.to_entry_id != null) ||
      (name.startsWith('drive to') || name.startsWith('walk to') ||
       name.startsWith('transit to') || name.startsWith('cycle to'));
  }, []);

  // Check if transfer exists between entries
  const hasTransferBetween = useCallback((entryA: EntryWithOptions, entryB: EntryWithOptions): boolean => {
    if (entryA.linked_flight_id === entryB.id || entryB.linked_flight_id === entryA.id) return true;
    if (entryA.linked_flight_id && entryB.linked_flight_id && entryA.linked_flight_id === entryB.linked_flight_id) return true;
    const aEnd = new Date(entryA.end_time).getTime();
    const bStart = new Date(entryB.start_time).getTime();
    return sortedEntries.some(e => {
      const opt = e.options[0];
      if (!opt || opt.category !== 'transfer') return false;
      if (e.from_entry_id === entryA.id && e.to_entry_id === entryB.id) return true;
      const eStart = new Date(e.start_time).getTime();
      return eStart >= aEnd && eStart <= bStart;
    });
  }, [sortedEntries]);

  // Visible entries (for gap detection)
  const visibleEntries = useMemo(() => {
    return sortedEntries.filter(e => {
      const opt = e.options[0];
      return opt && opt.category !== 'airport_processing' && !isTransportEntry(e) && !e.linked_flight_id;
    });
  }, [sortedEntries, isTransportEntry]);

  // Overlap/conflict map (global)
  const overlapMap = useMemo(() => {
    const map = new Map<string, { minutes: number; position: 'top' | 'bottom' }>();
    for (let i = 0; i < sortedEntries.length - 1; i++) {
      const a = sortedEntries[i];
      const b = sortedEntries[i + 1];
      if (linkedEntryIds.has(a.id) || linkedEntryIds.has(b.id)) continue;
      const aGH = getEntryGlobalHours(a);
      const bGH = getEntryGlobalHours(b);
      if (aGH.endGH > bGH.startGH) {
        const overlapMin = Math.round((aGH.endGH - bGH.startGH) * 60);
        map.set(a.id, { minutes: overlapMin, position: 'bottom' });
        map.set(b.id, { minutes: overlapMin, position: 'top' });
      }
    }
    return map;
  }, [sortedEntries, linkedEntryIds, getEntryGlobalHours]);

  // Conflict toast
  const prevConflictCountRef = useRef(0);
  useEffect(() => {
    const conflictCount = overlapMap.size;
    if (conflictCount > 0 && conflictCount !== prevConflictCountRef.current) {
      toast.warning('Time conflict — drag to adjust');
    }
    prevConflictCountRef.current = conflictCount;
  }, [overlapMap]);

  // Drag-to-create state
  const [slotDragStart, setSlotDragStart] = useState<number | null>(null);
  const [slotDragEnd, setSlotDragEnd] = useState<number | null>(null);
  const slotDraggingRef = useRef(false);

  const handleSlotMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onClickSlot && !onDragSlot) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = Math.round(y / pixelsPerHour * 60 / 15) * 15;
    setSlotDragStart(minutes);
    setSlotDragEnd(minutes);
    slotDraggingRef.current = false;
  };

  const handleSlotMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (slotDragStart === null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = Math.round(y / pixelsPerHour * 60 / 15) * 15;
    if (Math.abs(minutes - slotDragStart) > 5) slotDraggingRef.current = true;
    setSlotDragEnd(minutes);
  };

  const minutesToIso = useCallback((totalMinutes: number): string => {
    const globalHour = totalMinutes / 60;
    const dayIndex = Math.floor(globalHour / 24);
    const clampedDayIndex = Math.max(0, Math.min(dayIndex, days.length - 1));
    const localHour = globalHour - clampedDayIndex * 24;
    const h = Math.floor(localHour);
    const m = Math.round((localHour - h) * 60);
    const dateStr = format(days[clampedDayIndex], 'yyyy-MM-dd');
    const tzInfo = dayTimezoneMap.get(dateStr);
    const activeTz = tzInfo?.activeTz || homeTimezone;
    return localToUTC(dateStr, `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, activeTz);
  }, [days, dayTimezoneMap, homeTimezone]);

  const handleSlotMouseUp = () => {
    if (slotDragStart === null) return;
    if (slotDraggingRef.current && onDragSlot && slotDragEnd !== null) {
      const s = Math.min(slotDragStart, slotDragEnd);
      const e = Math.max(slotDragStart, slotDragEnd);
      if (e - s >= 15) {
        onDragSlot(minutesToIso(s), minutesToIso(e));
      }
    } else if (onClickSlot) {
      onClickSlot(minutesToIso(slotDragStart));
    }
    setSlotDragStart(null);
    setSlotDragEnd(null);
    slotDraggingRef.current = false;
  };

  // Resolve TZ for a global hour position (for drop)
  const resolveGlobalHourTz = useCallback((globalHour: number): string => {
    const dayIndex = Math.floor(globalHour / 24);
    const clampedDayIndex = Math.max(0, Math.min(dayIndex, days.length - 1));
    const dayStr = format(days[clampedDayIndex], 'yyyy-MM-dd');
    const tzInfo = dayTimezoneMap.get(dayStr);
    if (!tzInfo) return homeTimezone;
    const localHour = globalHour - clampedDayIndex * 24;
    if (tzInfo.flights.length === 0) return tzInfo.activeTz;
    const lastFlight = tzInfo.flights[tzInfo.flights.length - 1];
    return localHour >= lastFlight.flightEndHour ? lastFlight.destinationTz : lastFlight.originTz;
  }, [days, dayTimezoneMap, homeTimezone]);

  // Expose drag-active state to parent
  useEffect(() => {
    const active = !!dragState;
    const entryId = dragState?.entryId ?? null;
    onDragActiveChange?.(active, entryId);
  }, [dragState, onDragActiveChange]);

  // Position update callback during drag
  useEffect(() => {
    if (dragState && dragState.type === 'move') {
      onDragPositionUpdate?.(dragState.currentClientX, dragState.currentClientY);
    }
  }, [dragState?.currentClientX, dragState?.currentClientY, onDragPositionUpdate]);

  // Drag end callback
  useEffect(() => {
    const isActive = !!dragState;
    if (prevDragStateRef.current && !isActive) {
      onDragEnd?.();
    }
    prevDragStateRef.current = isActive;
  }, [dragState, onDragEnd]);

  // Three-stage drag phase computation (synchronous — no one-frame lag)
  const dragPhase = useMemo((): 'timeline' | 'detached' | null => {
    if (!dragState || dragState.type !== 'move') return null;
    
    const horizontalDist = Math.abs(dragState.currentClientX - dragState.startClientX);
    const vw = window.innerWidth;
    const isMobileDevice = vw < 768;
    const threshold = isMobileDevice ? Math.max(15, vw * 0.04) : Math.max(40, vw * 0.04);
    
    return horizontalDist > threshold ? 'detached' : 'timeline';
  }, [dragState]);

  // Notify parent of phase changes
  useEffect(() => {
    onDragPhaseChange?.(dragPhase);
  }, [dragPhase, onDragPhaseChange]);

  // Single-tap to create / double-tap to reset zoom (mobile)
  const handleSlotTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length > 0) return;

    // Only create on empty space — ignore taps on cards or interactive elements
    const target = e.target as HTMLElement;
    const isOnCard = target.closest('[data-entry-card]') ||
                     target.closest('[data-transport-connector]') ||
                     target.closest('button') ||
                     target.closest('[data-magnet]') ||
                     target.closest('[data-resize-handle]');
    if (isOnCard) {
      slotTouchStartRef.current = null;
      return;
    }

    // Ignore if finger moved (was a scroll, not a tap)
    if (slotTouchStartRef.current) {
      const touch = e.changedTouches[0];
      const dx = touch.clientX - slotTouchStartRef.current.x;
      const dy = touch.clientY - slotTouchStartRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 15) {
        slotTouchStartRef.current = null;
        return;
      }
    }
    slotTouchStartRef.current = null;

    const now = Date.now();

    if (now - lastTapRef.current < 300) {
      // Double tap — reset zoom, cancel any pending create
      if (tapCreateTimeoutRef.current) {
        clearTimeout(tapCreateTimeoutRef.current);
        tapCreateTimeoutRef.current = null;
      }
      onResetZoom?.();
      lastTapRef.current = 0;
      return;
    }

    lastTapRef.current = now;

    // Delay to distinguish from double-tap
    const touch = e.changedTouches[0];
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = touch.clientY - rect.top;
    const minutes = Math.round(y / pixelsPerHour * 60 / 15) * 15;

    tapCreateTimeoutRef.current = setTimeout(() => {
      if (onDragSlot) {
        onDragSlot(minutesToIso(minutes), minutesToIso(minutes + 60));
      }
      tapCreateTimeoutRef.current = null;
    }, 320);
  }, [onResetZoom, pixelsPerHour, onDragSlot, minutesToIso]);


  return (
    <div className="mx-auto max-w-2xl px-4 pb-2 pt-[50px]">
      <div
      ref={gridRef}
        className="relative ml-20"
        data-grid-top
        data-timeline-area
        style={{ height: containerHeight, minHeight: 200, marginRight: 24 }}
        onMouseDown={handleSlotMouseDown}
        onMouseMove={handleSlotMouseMove}
        onMouseUp={handleSlotMouseUp}
        onMouseLeave={() => {
          if (slotDragStart !== null) {
            setSlotDragStart(null);
            setSlotDragEnd(null);
            slotDraggingRef.current = false;
          }
        }}
        onTouchStart={(e) => {
          if (e.touches.length === 1) {
            slotTouchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          }
        }}
        onTouchEnd={handleSlotTouchEnd}
        onDragOver={(e) => {
          if (onDropFromPanel) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }
        }}
        onDrop={(e) => {
          if (!onDropFromPanel) return;
          e.preventDefault();
          const entryId = e.dataTransfer.getData('text/plain');
          if (!entryId) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const y = e.clientY - rect.top;
          const globalHour = y / pixelsPerHour;
          const snapped = Math.round(globalHour * 4) / 4;
          onDropFromPanel(entryId, snapped);
        }}
      >
        {/* Hour lines for ALL hours */}
        {Array.from({ length: totalHours }, (_, i) => i).map(globalHour => {
          const dayIndex = Math.floor(globalHour / 24);
          const hourInDay = globalHour % 24;
          const dayDate = days[Math.min(dayIndex, days.length - 1)];
          if (!dayDate) return null;
          const dayStr = format(dayDate, 'yyyy-MM-dd');
          const tzInfo = dayTimezoneMap.get(dayStr);

          let displayHourNum = hourInDay;
          if (tzInfo?.flights && tzInfo.flights.length > 0) {
            const f = tzInfo.flights[0];
            if (hourInDay >= f.flightEndHour) {
              const offset = getUtcOffsetHoursDiff(f.originTz, f.destinationTz);
              displayHourNum = ((hourInDay + offset) % 24 + 24) % 24;
            }
          }
          const displayHour = `${String(displayHourNum).padStart(2, '0')}:00`;
          const labelTop = globalHour * pixelsPerHour;

          // Hide hour label if a drag time pill is nearby
          let hideForPill = false;
          if (dragState) {
            const dragEntry = sortedEntries.find(e => e.id === dragState.entryId);
            if (dragEntry) {
              const origGH = getEntryGlobalHours(dragEntry);
              const durationGH = origGH.endGH - origGH.startGH;
              if (dragState.type === 'move') {
                const startPx = dragState.currentStartHour * pixelsPerHour;
                const endPx = (dragState.currentStartHour + durationGH) * pixelsPerHour;
                if (Math.abs(labelTop - startPx) < 20 || Math.abs(labelTop - endPx) < 20) hideForPill = true;
              } else if (dragState.type === 'resize-top') {
                if (Math.abs(labelTop - dragState.currentStartHour * pixelsPerHour) < 20) hideForPill = true;
              } else if (dragState.type === 'resize-bottom') {
                if (Math.abs(labelTop - dragState.currentEndHour * pixelsPerHour) < 20) hideForPill = true;
              }
            }
          }

          return (
            <div
              key={globalHour}
              className="absolute left-0 right-0 border-t border-border/30"
              style={{ top: labelTop }}
            >
              <span
                className="absolute -top-2.5 z-[15] select-none text-[10px] font-medium text-muted-foreground/50 text-center"
                style={{ left: -46, width: 30, opacity: hideForPill ? 0 : 1, transition: 'opacity 0.15s' }}
              >
                {displayHour}
              </span>
            </div>
          );
        })}

        {/* 30-minute lines — show when zoomed >120% */}
        {pixelsPerHour > 96 && Array.from({ length: totalHours }, (_, i) => i).map(globalHour => {
          const top = (globalHour + 0.5) * pixelsPerHour;
          return (
            <div
              key={`half-${globalHour}`}
              className="absolute left-0 right-0 border-t border-border/15"
              style={{ top }}
            />
          );
        })}

        {/* 30-minute gutter labels — show when zoomed >120% */}
        {pixelsPerHour > 96 && Array.from({ length: totalHours }, (_, i) => i).map(globalHour => {
          const dayIndex = Math.floor(globalHour / 24);
          const hourInDay = globalHour % 24;
          const dayDate = days[Math.min(dayIndex, days.length - 1)];
          if (!dayDate) return null;
          const dayStr = format(dayDate, 'yyyy-MM-dd');
          const tzInfo = dayTimezoneMap.get(dayStr);

          let displayHourNum = hourInDay;
          if (tzInfo?.flights && tzInfo.flights.length > 0) {
            const f = tzInfo.flights[0];
            if (hourInDay >= f.flightEndHour) {
              const offset = getUtcOffsetHoursDiff(f.originTz, f.destinationTz);
              displayHourNum = ((hourInDay + offset) % 24 + 24) % 24;
            }
          }
          return (
            <div
              key={`half-label-${globalHour}`}
              className="absolute"
              style={{ top: (globalHour + 0.5) * pixelsPerHour }}
            >
              <span className="absolute -top-2 select-none text-[9px] text-muted-foreground/30" style={{ left: -46, width: 30, textAlign: 'center' }}>
                {String(displayHourNum).padStart(2, '0')}:30
              </span>
            </div>
          );
        })}

        {/* 15-minute lines — show when zoomed >175% */}
        {pixelsPerHour > 140 && Array.from({ length: totalHours }, (_, i) => i).flatMap(globalHour =>
          [0.25, 0.75].map(frac => {
            const top = (globalHour + frac) * pixelsPerHour;
            return (
              <div
                key={`quarter-${globalHour}-${frac}`}
                className="absolute left-0 right-0 border-t border-border/10"
                style={{ top }}
              />
            );
          })
        )}

        {/* Midnight day markers — inline pills */}
        {days.map((day, dayIndex) => {
          const globalHour = dayIndex * 24;
          const today = !isUndated && isToday(day);
          const dayLabel = isUndated ? `Day ${dayIndex + 1}` : format(day, 'EEE d MMM').toUpperCase();
          const tzAbbrev = getMidnightTzAbbrev(day);

          return (
            <div key={`day-marker-${dayIndex}`} data-day-marker data-day-index={dayIndex}>
              {/* Inline pill beside 00:00 label */}
              <div
                className="absolute z-[16] flex items-center gap-1"
                style={{ top: globalHour * pixelsPerHour - 8, left: -12 }}
                id={today ? 'today' : undefined}
              >
                <div className={cn(
                  'inline-flex items-center gap-1 rounded-full bg-secondary border border-border/40 px-3 py-1 text-xs font-semibold text-secondary-foreground shadow-sm',
                  today && 'ring-1 ring-primary/40'
                )}>
                  <span>{dayLabel}</span>
                  {tzAbbrev && (
                    <>
                      <span className="text-muted-foreground/50">·</span>
                      <span className="text-muted-foreground/70">{tzAbbrev}</span>
                    </>
                  )}
                  {dayIndex === 0 && (
                    <>
                      <span className="text-muted-foreground/50">·</span>
                      <span className="text-muted-foreground/70">🚩 Trip Begins</span>
                      {(() => {
                        const dayStr = format(day, 'yyyy-MM-dd');
                        const isEmpty = !scheduledEntries.some(e => getDateInTimezone(e.start_time, homeTimezone) === dayStr);
                        return isEmpty && days.length > 1 ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); onTrimDay?.('start'); }}
                            className="ml-1 text-[10px] text-muted-foreground/70 hover:text-destructive underline"
                          >
                            ✂ Trim
                          </button>
                        ) : null;
                      })()}
                    </>
                  )}
                </div>
                {today && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">TODAY</span>
                )}
              </div>
              {/* Midnight line (subtle) */}
              {dayIndex > 0 && (
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-primary/20 z-[5]"
                  style={{ top: globalHour * pixelsPerHour }}
                />
              )}
            </div>
          );
        })}

        {/* Trip Ends marker — positioned at end of last day */}
        {days.length > 0 && (
          <div
            className="absolute z-[16] flex items-center gap-1"
            style={{ top: days.length * 24 * pixelsPerHour - 8, left: -12 }}
          >
            <div className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border/40 px-3 py-1 text-xs font-semibold text-secondary-foreground shadow-sm">
              <span>🏁 Trip Ends</span>
              {(() => {
                const lastDay = days[days.length - 1];
                const dayStr = format(lastDay, 'yyyy-MM-dd');
                const isEmpty = !scheduledEntries.some(e => getDateInTimezone(e.start_time, homeTimezone) === dayStr);
                return isEmpty && days.length > 1 ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); onTrimDay?.('end'); }}
                    className="ml-1 text-[10px] text-muted-foreground/70 hover:text-destructive underline"
                  >
                    ✂ Trim
                  </button>
                ) : null;
              })()}
            </div>
          </div>
        )}

        {slotDragStart !== null && slotDragEnd !== null && slotDraggingRef.current && (() => {
          const s = Math.min(slotDragStart, slotDragEnd);
          const e = Math.max(slotDragStart, slotDragEnd);
          if (e - s < 15) return null;
          const top = (s / 60) * pixelsPerHour;
          const height = ((e - s) / 60) * pixelsPerHour;
          const sH = Math.floor(s / 60) % 24;
          const sM = s % 60;
          const eH = Math.floor(e / 60) % 24;
          const eM = e % 60;
          const label = `${String(sH).padStart(2, '0')}:${String(sM % 60).padStart(2, '0')} – ${String(eH).padStart(2, '0')}:${String(eM % 60).padStart(2, '0')}`;
          return (
            <div className="pointer-events-none absolute left-0 right-0 z-[12] rounded-lg border-2 border-dashed border-primary/50 bg-primary/10" style={{ top, height }}>
              <span className="absolute left-2 top-1 select-none text-xs font-medium text-primary">{label}</span>
            </div>
          );
        })()}

        {/* Gap buttons between visible entries */}
        {visibleEntries.map((entry, idx) => {
          if (idx >= visibleEntries.length - 1) return null;
          const nextEntry = visibleEntries[idx + 1];

          const aGH = getEntryGlobalHours(entry);
          const bGH = getEntryGlobalHours(nextEntry);

          // Use flight group bounds
          const aGroup = flightGroupMap.get(entry.id);
          let aEndGH = aGH.endGH;
          if (aGroup?.checkout) {
            const coDur = (new Date(aGroup.checkout.end_time).getTime() - new Date(aGroup.checkout.start_time).getTime()) / 3600000;
            aEndGH = aGH.endGH + coDur;
          }

          const bGroup = flightGroupMap.get(nextEntry.id);
          let bStartGH = bGH.startGH;
          if (bGroup?.checkin) {
            const ciDur = (new Date(bGroup.checkin.end_time).getTime() - new Date(bGroup.checkin.start_time).getTime()) / 3600000;
            bStartGH = bGH.startGH - ciDur;
          }

          const gapMin = Math.round((bStartGH - aEndGH) * 60);
          if (gapMin <= 5) return null;
          if (hasTransferBetween(entry, nextEntry)) return null;

          const gapTopPx = aEndGH * pixelsPerHour;
          const gapBottomPx = bStartGH * pixelsPerHour;
          const gapHeight = gapBottomPx - gapTopPx;
          const midGH = (aEndGH + bStartGH) / 2;
          const btnTop = midGH * pixelsPerHour - 12;
          const isTransportGap = gapMin < 120;

          return (
            <div key={`gap-${entry.id}-${nextEntry.id}`}>
              <div className="absolute left-1/2 border-l-2 border-dashed border-primary/20 pointer-events-none" style={{ top: gapTopPx, height: gapHeight }} />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isTransportGap && (onGenerateTransport || onAddTransport)) {
                    const fromResolvedTz = resolveGlobalHourTz(aEndGH);
                    (onGenerateTransport || onAddTransport)!(entry.id, nextEntry.id, entry.end_time, fromResolvedTz);
                  } else if (onAddBetween) {
                    onAddBetween(entry.end_time, { fromName: entry.options[0]?.name ?? '', toName: nextEntry.options[0]?.name ?? '', fromAddress: entry.options[0]?.location_name || entry.options[0]?.arrival_location || '', toAddress: nextEntry.options[0]?.location_name || nextEntry.options[0]?.departure_location || '' });
                  }
                }}
                className="absolute z-20 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/30 bg-background px-2 py-1 text-[10px] text-muted-foreground/60 transition-all hover:border-primary hover:bg-primary/10 hover:text-primary"
                style={{ top: btnTop }}
              >
                {isTransportGap ? (
                  <><Bus className="h-3 w-3" /><span>Transport</span></>
                ) : (
                  <><Plus className="h-3 w-3" /><span>+ Add something</span></>
                )}
              </button>
            </div>
          );
        })}

        {/* Entry cards */}
        {sortedEntries.map((entry, index) => {
          if (linkedEntryIds.has(entry.id)) return null;
          const primaryOption = entry.options[0];
          if (!primaryOption) return null;

          const isDragged = dragState?.entryId === entry.id;
          const isLocked = entry.is_locked;
          const entryPast = isPast(new Date(entry.end_time));

          let entryGH: { startGH: number; endGH: number; resolvedTz: string };
          let entryStartGH: number;
          let entryEndGH: number;
          let resolvedTz: string;

          const isResizing = isDragged && dragState && (dragState.type === 'resize-top' || dragState.type === 'resize-bottom');

          if (isResizing && dragState) {
            entryStartGH = dragState.currentStartHour;
            entryEndGH = dragState.currentEndHour;
            resolvedTz = getEntryGlobalHours(entry).resolvedTz;
          } else {
            entryGH = getEntryGlobalHours(entry);
            entryStartGH = entryGH.startGH;
            entryEndGH = entryGH.endGH;
            resolvedTz = entryGH.resolvedTz;
          }

          // Flight groups: expand bounds
          const flightGroup = flightGroupMap.get(entry.id);
          let groupStartGH = entryStartGH;
          let groupEndGH = entryEndGH;

          if (flightGroup) {
            if (flightGroup.checkin) {
              const ciDurH = (new Date(flightGroup.checkin.end_time).getTime() - new Date(flightGroup.checkin.start_time).getTime()) / 3600000;
              groupStartGH = entryStartGH - ciDurH;
            }
            if (flightGroup.checkout) {
              const coDurH = (new Date(flightGroup.checkout.end_time).getTime() - new Date(flightGroup.checkout.start_time).getTime()) / 3600000;
              groupEndGH = entryEndGH + coDurH;
            }
          }

          const top = Math.max(0, groupStartGH * pixelsPerHour);
          const height = (groupEndGH - groupStartGH) * pixelsPerHour;
          const isCompact = height < 40 && !flightGroup;
          const isMedium = height >= 40 && height < 80 && !flightGroup;
          const isCondensed = height >= 80 && height < 160 && !flightGroup;
          const hasConflict = overlapMap.has(entry.id);

          const distanceKm =
            userLat != null && userLng != null && primaryOption.latitude != null && primaryOption.longitude != null
              ? haversineKm(userLat, userLng, primaryOption.latitude, primaryOption.longitude)
              : null;

          const isTransport = isTransportEntry(entry);

          // Compute magnet state: gap-aware, transport-aware
          const magnetState = (() => {
            const cat = primaryOption.category;
            // Sub-entries of flight groups: no magnet
            if (cat === 'airport_processing' || entry.linked_flight_id) {
              return { showMagnet: false, nextLocked: false };
            }

            const isTransferEntry = cat === 'transfer';
            const isFlightEntry = cat === 'flight';

            // For flights, use the flight GROUP end (checkout end, not flight end)
            let effectiveEndTime = entry.end_time;
            if (isFlightEntry && flightGroup?.checkout) {
              effectiveEndTime = flightGroup.checkout.end_time;
            }

            let transportAfter: EntryWithOptions | null = null;
            let nextEvent: EntryWithOptions | null = null;
            for (let i = index + 1; i < sortedEntries.length; i++) {
              const c = sortedEntries[i];
              const co = c.options[0];
              // Skip entries that are part of THIS flight group
              if (isFlightEntry && (c.linked_flight_id === entry.id || c.id === flightGroup?.checkin?.id || c.id === flightGroup?.checkout?.id)) continue;
              if (co?.category === 'transfer' && !transportAfter && !isTransferEntry) {
                transportAfter = c;
              } else if (co?.category !== 'transfer' && co?.category !== 'airport_processing' && !c.linked_flight_id) {
                nextEvent = c;
                break;
              }
            }

            if (!nextEvent) return { showMagnet: false, nextLocked: false };

            const GAP_TOLERANCE_MS = 2 * 60 * 1000;

            if (isTransferEntry) {
              const gapMs = new Date(nextEvent.start_time).getTime() - new Date(entry.end_time).getTime();
              return { showMagnet: gapMs > GAP_TOLERANCE_MS, nextLocked: !!nextEvent.is_locked };
            }

            if (transportAfter) {
              const gapToTransport = new Date(transportAfter.start_time).getTime() - new Date(effectiveEndTime).getTime();
              return { showMagnet: gapToTransport > GAP_TOLERANCE_MS, nextLocked: !!nextEvent.is_locked };
            } else {
              const gapToNext = new Date(nextEvent.start_time).getTime() - new Date(effectiveEndTime).getTime();
              return { showMagnet: gapToNext > GAP_TOLERANCE_MS, nextLocked: !!nextEvent.is_locked };
            }
          })();
          const isFlightCard = !!flightGroup;
          const canDrag = isEditor && onEntryTimeChange && !isLocked && !isFlightCard;

          // Adjacency checks for resize handle pill visibility
          const hasEntryDirectlyAbove = sortedEntries.some((other, j) => {
            if (j === index) return false;
            const otherGH = getEntryGlobalHours(other);
            return Math.abs(otherGH.endGH - groupStartGH) * 60 < 2;
          });
          const hasEntryDirectlyBelow = sortedEntries.some((other, j) => {
            if (j === index) return false;
            const otherGH = getEntryGlobalHours(other);
            return Math.abs(otherGH.startGH - groupEndGH) * 60 < 2;
          });

          const isBeingDragged = dragState?.entryId === entry.id && dragState?.type === 'move';

          // Drag hours for init (global coordinates)
          const origGH = getEntryGlobalHours(entry);
          const origStartGH = origGH.startGH;
          const origEndGH = origGH.endGH;
          const dragTz = resolvedTz;

          // Per-entry formatTime using resolved TZ
          const entryFormatTime = (iso: string) => {
            const d = new Date(iso);
            return d.toLocaleTimeString('en-GB', {
              timeZone: resolvedTz,
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });
          };

          return (
            <div key={entry.id}>
                <div
                  data-entry-card
                  data-entry-id={entry.id}
                  onTouchStart={canDrag ? (e) => {
                    onTouchStart(e as any, entry.id, 'move', origStartGH, origEndGH, dragTz);
                  } : undefined}
                  className={cn(
                    'absolute pr-1 group overflow-visible',
                    isDragged && 'z-30',
                    !isDragged && 'z-10'
                  )}
                  style={{
                    top,
                    height,
                    left: '0%',
                    width: '100%',
                    zIndex: isDragged ? 30 : isTransport ? 20 : hasConflict ? 10 + index : 10,
                    opacity: isBeingDragged ? 0.4 : undefined,
                    border: isBeingDragged ? '3px dashed hsl(var(--primary) / 0.5)' : undefined,
                    borderRadius: isBeingDragged ? '16px' : undefined,
                    touchAction: 'none',
                  }}
                >
                <div className="relative h-full">
                  {/* Conflict indicators */}
                  {hasConflict && !isDragged && (
                    <div className="absolute inset-0 rounded-xl ring-2 ring-red-400/60 pointer-events-none z-20" />
                  )}
                  {hasConflict && !isDragged && (
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-md">
                      <AlertTriangle className="h-3 w-3" />
                    </div>
                  )}

                  {/* Top resize handle */}
                  {canDrag && !flightGroup && !isCompact && (
                    <div
                      data-resize-handle
                      className="absolute left-0 right-0 -top-1 z-20 h-5 cursor-ns-resize group/resize touch-none"
                      onMouseDown={(e) => onMouseDown(e, entry.id, 'resize-top', origStartGH, origEndGH, dragTz)}
                      onTouchStart={(e) => onTouchStart(e, entry.id, 'resize-top', origStartGH, origEndGH, dragTz)}
                      onTouchMove={onTouchMove}
                      onTouchEnd={onTouchEnd}
                    >
                      {!hasEntryDirectlyAbove && (
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-2 rounded-full bg-muted-foreground/30 group-hover/resize:bg-primary/60 transition-colors" />
                      )}
                    </div>
                  )}
                  {!canDrag && isLocked && !flightGroup && !isCompact && (
                    <div
                      data-resize-handle
                      className="absolute left-0 right-0 -top-1 z-20 h-5 cursor-not-allowed touch-none"
                      onMouseDown={(e) => { e.stopPropagation(); handleLockedAttempt(entry.id); }}
                      onTouchStart={(e) => { e.stopPropagation(); handleLockedAttempt(entry.id); }}
                    >
                      {!hasEntryDirectlyAbove && (
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-2 rounded-full bg-muted-foreground/10" />
                      )}
                    </div>
                  )}

                  {flightGroup ? (() => {
                    const totalDuration = groupEndGH - groupStartGH;
                    const checkinDuration = flightGroup.checkin
                      ? (new Date(flightGroup.checkin.end_time).getTime() - new Date(flightGroup.checkin.start_time).getTime()) / 3600000
                      : 0;
                    const flightDuration = entryEndGH - entryStartGH;
                    const checkoutDuration = flightGroup.checkout
                      ? (new Date(flightGroup.checkout.end_time).getTime() - new Date(flightGroup.checkout.start_time).getTime()) / 3600000
                      : 0;
                    const ciFrac = totalDuration > 0 ? checkinDuration / totalDuration : 0.25;
                    const flFrac = totalDuration > 0 ? flightDuration / totalDuration : 0.5;
                    const coFrac = totalDuration > 0 ? checkoutDuration / totalDuration : 0.25;

                    return (
                      <div className="relative h-full">
                        <FlightGroupCard
                          flightOption={primaryOption}
                          flightEntry={entry}
                          checkinEntry={flightGroup.checkin}
                          checkoutEntry={flightGroup.checkout}
                          checkinFraction={ciFrac}
                          flightFraction={flFrac}
                          checkoutFraction={coFrac}
                          isPast={entryPast}
                          isDragging={isDragged}
                          isLocked={isLocked}
                          onClick={() => {
                            if (!wasDraggedRef.current) onCardTap(entry, primaryOption);
                          }}
                          onDragStart={(e) => {
                            e.stopPropagation();
                            toast.info('Flight position is fixed — edit times inside the card');
                          }}
                          isShaking={shakeEntryId === entry.id}
                        />
                        {/* Flight group resize handles */}
                        {onEntryTimeChange && flightGroup.checkin && (() => {
                          const ciDurH = (new Date(flightGroup.checkin.end_time).getTime() - new Date(flightGroup.checkin.start_time).getTime()) / 3600000;
                          return (
                            <div
                              className="absolute left-0 right-0 top-0 z-20 h-2 cursor-ns-resize"
                              onMouseDown={(e) => onMouseDown(e, flightGroup.checkin!.id, 'resize-top', groupStartGH, groupStartGH + ciDurH, dragTz)}
                              onTouchStart={(e) => onTouchStart(e, flightGroup.checkin!.id, 'resize-top', groupStartGH, groupStartGH + ciDurH, dragTz)}
                              onTouchMove={onTouchMove}
                              onTouchEnd={onTouchEnd}
                            />
                          );
                        })()}
                        {onEntryTimeChange && flightGroup.checkout && (() => {
                          const coDurH = (new Date(flightGroup.checkout.end_time).getTime() - new Date(flightGroup.checkout.start_time).getTime()) / 3600000;
                          return (
                            <div
                              className="absolute bottom-0 left-0 right-0 z-20 h-2 cursor-ns-resize"
                              onMouseDown={(e) => onMouseDown(e, flightGroup.checkout!.id, 'resize-bottom', groupEndGH - coDurH, groupEndGH, dragTz)}
                              onTouchStart={(e) => onTouchStart(e, flightGroup.checkout!.id, 'resize-bottom', groupEndGH - coDurH, groupEndGH, dragTz)}
                              onTouchMove={onTouchMove}
                              onTouchEnd={onTouchEnd}
                            />
                          );
                        })()}
                        {/* Magnet on flight group */}
                        {magnetState.showMagnet && (
                          <button
                            data-magnet
                            onClick={(e) => {
                              e.stopPropagation();
                              if (magnetState.nextLocked) {
                                toast('Next event is locked', { description: 'Unlock it before snapping' });
                                return;
                              }
                              if (!onMagnetSnap) return;
                              setMagnetLoadingId(entry.id);
                              onMagnetSnap(entry.id).finally(() => setMagnetLoadingId(null));
                            }}
                            className={cn(
                              "absolute -bottom-3 -right-3 z-[45] flex h-7 w-7 items-center justify-center rounded-full border border-border shadow-sm",
                              magnetState.nextLocked
                                ? "bg-muted cursor-not-allowed"
                                : "bg-green-100 dark:bg-green-900/40 hover:bg-green-200 dark:hover:bg-green-800/50 cursor-pointer",
                              magnetLoadingId === entry.id && "animate-pulse"
                            )}
                          >
                            {magnetLoadingId === entry.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-green-600" />
                            ) : (
                              <Magnet className={cn("h-3 w-3", magnetState.nextLocked ? "text-muted-foreground/40" : "text-green-600 dark:text-green-400")} style={{ transform: 'rotate(180deg)' }} />
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })() : isTransport ? (
                    <div data-transport-connector className="relative h-full flex items-center justify-center">
                      <TransportConnector
                        entry={entry}
                        option={primaryOption}
                        height={height}
                        fromLabel={primaryOption.departure_location || undefined}
                        toLabel={primaryOption.arrival_location || undefined}
                        isRefreshing={refreshingTransportId === entry.id}
                        onInfoTap={() => onCardTap(entry, primaryOption)}
                        onModeSelect={async (mode, durationMin, distanceKm, polyline) => {
                          if (onModeSwitchConfirm) {
                            await onModeSwitchConfirm(entry.id, mode, durationMin, distanceKm, polyline);
                          }
                        }}
                        onRefresh={async () => {
                          setRefreshingTransportId(entry.id);
                          try {
                            const { data, error } = await supabase.functions.invoke('google-directions', {
                              body: {
                                fromAddress: primaryOption.departure_location,
                                toAddress: primaryOption.arrival_location,
                                modes: ['walk', 'transit', 'drive', 'bicycle'],
                                departureTime: entry.start_time,
                              },
                            });
                            if (!error && data?.results) {
                              await supabase.from('entry_options').update({
                                transport_modes: data.results,
                              } as any).eq('id', primaryOption.id);
                              onVoteChange();
                            }
                          } catch (err) {
                            console.error('Transport refresh failed:', err);
                          } finally {
                            setRefreshingTransportId(null);
                          }
                        }}
                        onDelete={onDeleteTransport ? () => onDeleteTransport(entry.id) : undefined}
                      />
                      {/* Magnet snap icon on transport connector */}
                      {magnetState.showMagnet && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (magnetState.nextLocked) {
                              toast('Next event is locked', { description: 'Unlock it before snapping' });
                              return;
                            }
                            if (!onMagnetSnap) return;
                            setMagnetLoadingId(entry.id);
                            onMagnetSnap(entry.id).finally(() => setMagnetLoadingId(null));
                          }}
                          className={cn(
                            "absolute -bottom-3 -right-3 z-[45] flex h-7 w-7 items-center justify-center rounded-full border border-border shadow-sm",
                            magnetState.nextLocked
                              ? "bg-muted cursor-not-allowed"
                              : "bg-green-100 dark:bg-green-900/40 hover:bg-green-200 dark:hover:bg-green-800/50 cursor-pointer",
                            magnetLoadingId === entry.id && "animate-pulse"
                          )}
                        >
                          {magnetLoadingId === entry.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-green-600" />
                          ) : (
                            <Magnet className={cn("h-3 w-3", magnetState.nextLocked ? "text-muted-foreground/40" : "text-green-600 dark:text-green-400")} style={{ transform: 'rotate(180deg)' }} />
                          )}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="relative h-full">
                      <EntryCard
                        overlapMinutes={overlapMap.get(entry.id)?.minutes}
                        overlapPosition={overlapMap.get(entry.id)?.position}
                        isCompact={isCompact}
                        isMedium={isMedium}
                        isCondensed={isCondensed}
                        notes={(entry as any).notes}
                        option={primaryOption}
                        startTime={entry.start_time}
                        endTime={entry.end_time}
                        formatTime={entryFormatTime}
                        isPast={entryPast}
                        optionIndex={0}
                        totalOptions={entry.options.length}
                        distanceKm={distanceKm}
                        votingLocked={votingLocked}
                        userId={userId}
                        hasVoted={userVotes.includes(primaryOption.id)}
                        onVoteChange={onVoteChange}
                        onClick={() => {
                          if (!wasDraggedRef.current) onCardTap(entry, primaryOption);
                        }}
                        cardSizeClass="h-full"
                        isDragging={isDragged}
                        isLocked={isLocked}
                        isProcessing={primaryOption.category === 'airport_processing'}
                        linkedType={entry.linked_type}
                        canEdit={isEditor}
                        onDragStart={canDrag ? (e) => {
                          onMouseDown(e as any, entry.id, 'move', origStartGH, origEndGH, dragTz);
                        } : isLocked ? (e) => {
                          e.stopPropagation();
                          handleLockedAttempt(entry.id);
                        } : undefined}
                        onTouchDragStart={canDrag ? (e) => {
                          onTouchStart(e as any, entry.id, 'move', origStartGH, origEndGH, dragTz);
                        } : isLocked ? (e) => {
                          e.stopPropagation();
                          handleLockedAttempt(entry.id);
                        } : undefined}
                        onTouchDragMove={onTouchMove}
                        onTouchDragEnd={onTouchEnd}
                        isShaking={shakeEntryId === entry.id}
                        entryId={entry.id}
                      />
                      {/* Lock icon outside card — right side */}
                      {isEditor && onToggleLock && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleLock(entry.id, !!isLocked);
                          }}
                          className={cn(
                            "absolute top-1/2 -translate-y-1/2 -right-3 z-30 flex h-7 w-7 items-center justify-center rounded-full border border-border shadow-sm",
                            isLocked ? "bg-primary" : "bg-background"
                          )}
                        >
                          {isLocked ? (
                            <Lock className="h-4 w-4 text-primary-foreground" />
                          ) : (
                            <LockOpen className="h-4 w-4 text-muted-foreground/40" />
                          )}
                        </button>
                      )}
                      {/* Magnet snap icon outside card — bottom right */}
                      {magnetState.showMagnet && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (magnetState.nextLocked) {
                              toast('Next event is locked', { description: 'Unlock it before snapping' });
                              return;
                            }
                            if (!onMagnetSnap) return;
                            setMagnetLoadingId(entry.id);
                            onMagnetSnap(entry.id).finally(() => setMagnetLoadingId(null));
                          }}
                          className={cn(
                            "absolute -bottom-3 -right-3 z-[45] flex h-7 w-7 items-center justify-center rounded-full border border-border shadow-sm",
                            magnetState.nextLocked
                              ? "bg-muted cursor-not-allowed"
                              : "bg-green-100 dark:bg-green-900/40 hover:bg-green-200 dark:hover:bg-green-800/50 cursor-pointer",
                            magnetLoadingId === entry.id && "animate-pulse"
                          )}
                        >
                          {magnetLoadingId === entry.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-green-600" />
                          ) : (
                            <Magnet className={cn("h-3 w-3", magnetState.nextLocked ? "text-muted-foreground/40" : "text-green-600 dark:text-green-400")} style={{ transform: 'rotate(180deg)' }} />
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Bottom resize handle — not for transport */}
                  {canDrag && !flightGroup && !isTransport && !isCompact && (
                    <div
                      data-resize-handle
                      className="absolute -bottom-1 left-0 right-0 z-20 h-5 cursor-ns-resize group/resize touch-none"
                      onMouseDown={(e) => onMouseDown(e, entry.id, 'resize-bottom', origStartGH, origEndGH, dragTz)}
                      onTouchStart={(e) => onTouchStart(e, entry.id, 'resize-bottom', origStartGH, origEndGH, dragTz)}
                      onTouchMove={onTouchMove}
                      onTouchEnd={onTouchEnd}
                    >
                      {!hasEntryDirectlyBelow && (
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-2 rounded-full bg-muted-foreground/30 group-hover/resize:bg-primary/60 transition-colors" />
                      )}
                    </div>
                  )}
                  {!canDrag && isLocked && !flightGroup && !isTransport && !isCompact && (
                    <div
                      data-resize-handle
                      className="absolute -bottom-1 left-0 right-0 z-20 h-5 cursor-not-allowed touch-none"
                      onMouseDown={(e) => { e.stopPropagation(); handleLockedAttempt(entry.id); }}
                      onTouchStart={(e) => { e.stopPropagation(); handleLockedAttempt(entry.id); }}
                    >
                      {!hasEntryDirectlyBelow && (
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-2 rounded-full bg-muted-foreground/10" />
                      )}
                    </div>
                  )}

                  {/* + buttons — not for transport, not adjacent to transport */}
                  {onAddBetween && !isTransport && (() => {
                    const prevIdx = sortedEntries.findIndex(e => e.id === entry.id) - 1;
                    const prevE = prevIdx >= 0 ? sortedEntries[prevIdx] : null;
                    if (prevE?.options[0]?.category === 'transfer') return null;
                    return (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const prefillDate = addMinutes(new Date(entry.start_time), -60);
                          onAddBetween(prefillDate.toISOString());
                        }}
                        className="absolute z-20 flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/30 bg-background text-muted-foreground/50 opacity-0 transition-all group-hover:opacity-100 hover:border-primary hover:bg-primary/10 hover:text-primary"
                        style={{ top: -10, left: -10 }}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    );
                  })()}
                  {onAddBetween && !isTransport && (() => {
                    const nextIdx = sortedEntries.findIndex(e => e.id === entry.id) + 1;
                    const nextE = nextIdx < sortedEntries.length ? sortedEntries[nextIdx] : null;
                    if (nextE?.options[0]?.category === 'transfer') return null;
                    return (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddBetween(entry.end_time);
                        }}
                        className="absolute z-20 flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/30 bg-background text-muted-foreground/50 opacity-0 transition-all group-hover:opacity-100 hover:border-primary hover:bg-primary/10 hover:text-primary"
                        style={{ bottom: -10, left: -10 }}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    );
                  })()}

                  {/* "+ Add something" below transport cards */}
                  {isTransport && (() => {
                    let nextVisible = entry.to_entry_id
                      ? sortedEntries.find(e => e.id === entry.to_entry_id)
                      : null;
                    if (!nextVisible) {
                      const entryIdx = sortedEntries.findIndex(e => e.id === entry.id);
                      for (let i = entryIdx + 1; i < sortedEntries.length; i++) {
                        const candidate = sortedEntries[i];
                        if (!isTransportEntry(candidate) && !candidate.linked_flight_id) {
                          nextVisible = candidate;
                          break;
                        }
                      }
                    }
                    if (!nextVisible) return null;

                    const transportEnd = new Date(entry.end_time).getTime();
                    const nextStart = new Date(nextVisible.start_time).getTime();
                    const gapMs = nextStart - transportEnd;
                    if (gapMs <= 0) return null;

                    const transportEndGH = getEntryGlobalHours(entry).endGH;
                    const nextStartGH = getEntryGlobalHours(nextVisible).startGH;
                    const gapPixelHeight = (nextStartGH - transportEndGH) * pixelsPerHour;
                    const BUTTON_HEIGHT = 22;
                    const addBtnTopOffset = height + Math.max(0, (gapPixelHeight - BUTTON_HEIGHT) / 2);

                    return onAddBetween ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); onAddBetween(entry.end_time); }}
                        className="absolute z-20 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/30 bg-background px-2 py-0.5 text-[10px] text-muted-foreground/60 transition-all hover:border-primary hover:bg-primary/10 hover:text-primary"
                        style={{ top: addBtnTopOffset }}
                      >
                        <Plus className="h-3 w-3" />
                        <span>+ Add something</span>
                      </button>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>
          );
        })}

        {/* Sunrise/sunset gradient — per-day segments */}
        {days.map((day, dayIndex) => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const loc = dayLocationMap.get(dayStr);
          const lat = loc?.lat ?? userLat ?? 51.5;
          const lng = loc?.lng ?? userLng ?? -0.1;
          const sunTimes = calculateSunTimes(day, lat, lng);
          const sunriseHour = sunTimes.sunrise ? sunTimes.sunrise.getUTCHours() + sunTimes.sunrise.getUTCMinutes() / 60 : 6;
          const sunsetHour = sunTimes.sunset ? sunTimes.sunset.getUTCHours() + sunTimes.sunset.getUTCMinutes() / 60 : 20;
          const toPercent = (h: number) => Math.max(0, Math.min(100, (h / 24) * 100));
          const sunrisePct = toPercent(sunriseHour);
          const sunsetPct = toPercent(sunsetHour);
          const midPct = (sunrisePct + sunsetPct) / 2;

          const gradient = `linear-gradient(to bottom, 
            hsl(220, 50%, 20%) 0%, 
            hsl(30, 80%, 55%) ${sunrisePct}%, 
            hsl(200, 60%, 70%) ${sunrisePct + (midPct - sunrisePct) * 0.3}%, 
            hsl(200, 70%, 75%) ${midPct}%, 
            hsl(200, 60%, 70%) ${sunsetPct - (midPct - sunrisePct) * 0.3}%, 
            hsl(25, 80%, 50%) ${sunsetPct}%, 
            hsl(220, 50%, 20%) 100%)`;

          return (
            <div
              key={`sun-${dayIndex}`}
              className="absolute rounded-full z-[4]"
              style={{
                left: -6,
                width: 5,
                top: dayIndex * 24 * pixelsPerHour,
                height: 24 * pixelsPerHour,
                background: gradient,
              }}
            />
          );
        })}

        {/* TZ change badges at flight boundaries */}
        {days.map((day, dayIndex) => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const tzInfo = dayTimezoneMap.get(dayStr);
          if (!tzInfo || tzInfo.flights.length === 0) return null;
          const f = tzInfo.flights[0];
          const offset = getUtcOffsetHoursDiff(f.originTz, f.destinationTz);
          if (offset === 0) return null;
          const globalFlightMidHour = dayIndex * 24 + (f.flightStartHour + f.flightEndHour) / 2;
          const badgeTop = globalFlightMidHour * pixelsPerHour - 8;
          return (
            <div key={`tz-${dayIndex}`} className="absolute z-[16]" style={{ top: badgeTop, left: -78, width: 58 }}>
              <span className="rounded-full bg-primary/20 border border-primary/30 px-2 py-0.5 text-[10px] font-bold text-primary whitespace-nowrap">
                TZ {offset > 0 ? '+' : ''}{offset}h
              </span>
            </div>
          );
        })}

        {/* Weather column */}
        <div className="absolute top-0 bottom-0 z-[5]" style={{ left: -50, width: 50 }}>
          {days.map((day, dayIndex) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            return Array.from({ length: 24 }, (_, h) => h).map(hour => {
              const w = weatherData.find(wd => wd.date === dayStr && wd.hour === hour);
              if (!w) return null;
              const globalHour = dayIndex * 24 + hour;
              const top = globalHour * pixelsPerHour;
              return (
                <div key={`weather-${dayIndex}-${hour}`} className="absolute left-0" style={{ top: top + (pixelsPerHour / 2) - 6 }}>
                  <WeatherBadge temp={w.temp_c} condition={w.condition} hour={hour} date={day} />
                </div>
              );
            });
          })}
        </div>

        {/* Time pills during move drag */}
        {dragState && dragState.type === 'move' && (() => {
          const entry = sortedEntries.find(e => e.id === dragState.entryId);
          if (!entry) return null;
          const origGH = getEntryGlobalHours(entry);
          const durationGH = origGH.endGH - origGH.startGH;
          const startGH = dragState.currentStartHour;
          const endGH = startGH + durationGH;
          const formatGH = (gh: number) => {
            const h = Math.floor(gh % 24);
            const m = Math.round((gh % 1) * 60);
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          };
          const startTop = startGH * pixelsPerHour;
          const endTop = endGH * pixelsPerHour;
          return (
            <>
              <div className="absolute z-[60] pointer-events-none" style={{ top: startTop - 10, left: -72 }}>
                <span className="inline-flex items-center justify-center rounded-full bg-white dark:bg-zinc-800 border border-border shadow-sm px-2 py-0.5 text-[10px] font-bold text-foreground whitespace-nowrap">{formatGH(startGH)}</span>
              </div>
              <div className="absolute z-[60] pointer-events-none" style={{ top: endTop - 10, left: -72 }}>
                <span className="inline-flex items-center justify-center rounded-full bg-white dark:bg-zinc-800 border border-border shadow-sm px-2 py-0.5 text-[10px] font-bold text-foreground whitespace-nowrap">{formatGH(endGH)}</span>
              </div>
            </>
          );
        })()}

        {/* Time pill during resize */}
        {dragState && (dragState.type === 'resize-top' || dragState.type === 'resize-bottom') && (() => {
          const isTop = dragState.type === 'resize-top';
          const activeGH = isTop ? dragState.currentStartHour : dragState.currentEndHour;
          const activeTop = activeGH * pixelsPerHour;
          const h = Math.floor(activeGH % 24);
          const m = Math.round((activeGH % 1) * 60);
          const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          return (
            <div className="absolute z-[60] pointer-events-none" style={{ top: activeTop - 10, left: -72 }}>
              <span className="inline-flex items-center justify-center rounded-full bg-white dark:bg-zinc-800 border border-border shadow-sm px-2 py-0.5 text-[10px] font-bold text-foreground whitespace-nowrap">{timeStr}</span>
            </div>
          );
        })()}

        {/* Ghost outline during Stage 2 (detached) move drag */}
        {dragState && dragState.type === 'move' && dragPhase === 'detached' && (() => {
          const entry = sortedEntries.find(e => e.id === dragState.entryId);
          if (!entry) return null;
          const origGH = getEntryGlobalHours(entry);
          const durationGH = origGH.endGH - origGH.startGH;
          const ghostTop = dragState.currentStartHour * pixelsPerHour;
          const ghostHeight = durationGH * pixelsPerHour;
          return (
            <div
              className="absolute left-0 right-0 z-[11] rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 pointer-events-none"
              style={{ top: ghostTop, height: ghostHeight }}
            />
          );
        })()}

        {/* Stage 1 — In-timeline moving card */}
        {dragState && dragState.type === 'move' && dragPhase === 'timeline' && (() => {
          const entry = sortedEntries.find(e => e.id === dragState.entryId);
          if (!entry) return null;
          const opt = entry.options[0];
          if (!opt) return null;
          const origGH = getEntryGlobalHours(entry);
          const durationGH = origGH.endGH - origGH.startGH;
          const moveTop = dragState.currentStartHour * pixelsPerHour;
          const moveHeight = durationGH * pixelsPerHour;
          const isCompactMove = moveHeight < 40;
          const isMediumMove = moveHeight >= 40 && moveHeight < 80;
          const isCondensedMove = moveHeight >= 80 && moveHeight < 160;

          return (
            <div
              className="absolute left-0 right-0 pr-1 z-[50] pointer-events-none"
              style={{ top: moveTop, height: moveHeight }}
            >
              <div className="h-full ring-2 ring-primary/60 shadow-lg shadow-primary/20 rounded-2xl overflow-hidden">
                <EntryCard
                  option={opt}
                  startTime={entry.start_time}
                  endTime={entry.end_time}
                  formatTime={(iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  isPast={false}
                  optionIndex={0}
                  totalOptions={1}
                  votingLocked={votingLocked}
                  hasVoted={false}
                  onVoteChange={() => {}}
                  cardSizeClass="h-full"
                  isCompact={isCompactMove}
                  isMedium={isMediumMove}
                  isCondensed={isCondensedMove}
                  notes={(entry as any).notes}
                  isLocked={entry.is_locked}
                  linkedType={entry.linked_type}
                  isProcessing={opt.category === 'airport_processing'}
                />
              </div>
            </div>
          );
        })()}

      </div>

      {/* Trip Ends marker */}
      <div className="flex items-center justify-center rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 mt-2">
        🏁 Trip Ends
      </div>

      {/* Stage 2 — Floating card at cursor position (detached) */}
      {dragState && dragState.type === 'move' && dragPhase === 'detached' && (() => {
        const entry = sortedEntries.find(e => e.id === dragState.entryId);
        if (!entry) return null;
        const opt = entry.options[0];
        if (!opt) return null;
        const origGH = getEntryGlobalHours(entry);
        const durationGH = origGH.endGH - origGH.startGH;
        const moveHeight = durationGH * pixelsPerHour;
        const isCompactMove = moveHeight < 40;
        const isMediumMove = moveHeight >= 40 && moveHeight < 80;
        const isCondensedMove = moveHeight >= 80 && moveHeight < 160;

        const gridRect = gridRef.current?.getBoundingClientRect();
        const cardWidth = gridRect ? gridRect.width - 4 : 220;

        let shrinkFactor = 1;
        if (binRef?.current) {
          const br = binRef.current.getBoundingClientRect();
          const binDist = Math.hypot(
            dragState.currentClientX - (br.left + br.width / 2),
            dragState.currentClientY - (br.top + br.height / 2)
          );
          shrinkFactor = binDist < 150 ? Math.max(0.3, binDist / 150) : 1;
        }

        return (
          <div
            className="fixed z-[200] pointer-events-none"
            style={{
              left: Math.max(4, Math.min(window.innerWidth - cardWidth - 4, dragState.currentClientX - cardWidth / 2)),
              top: Math.max(4, Math.min(window.innerHeight - moveHeight - 4, dragState.currentClientY - moveHeight / 2)),
              width: cardWidth,
              height: moveHeight,
              transform: shrinkFactor < 1 ? `scale(${shrinkFactor})` : undefined,
              transition: 'left 0.1s ease-out, top 0.1s ease-out, transform 0.1s ease-out',
            }}
          >
            <div className="h-full ring-2 ring-primary/60 shadow-lg shadow-primary/20 rounded-2xl overflow-hidden">
              <EntryCard
                option={opt}
                startTime={entry.start_time}
                endTime={entry.end_time}
                formatTime={(iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}
                isPast={false}
                optionIndex={0}
                totalOptions={1}
                votingLocked={votingLocked}
                hasVoted={false}
                onVoteChange={() => {}}
                cardSizeClass="h-full"
                isCompact={isCompactMove}
                isMedium={isMediumMove}
                isCondensed={isCondensedMove}
                notes={(entry as any).notes}
                isLocked={entry.is_locked}
                linkedType={entry.linked_type}
                isProcessing={opt.category === 'airport_processing'}
              />
            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default ContinuousTimeline;

import { useState, useEffect } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { utcToLocal, localToUTC } from '@/lib/timezoneUtils';
import { haversineKm } from '@/lib/distance';
import { cn } from '@/lib/utils';
import { Loader2, Check, Clock, ExternalLink, Pencil, Trash2, Lock, Unlock, LockOpen, ClipboardList, Plane, RefreshCw, Phone, ChevronDown, Navigation, Car, AlertTriangle } from 'lucide-react';
import InlineField from './InlineField';
import PlacesAutocomplete, { type PlaceDetails } from './PlacesAutocomplete';
import ImageGallery from './ImageGallery';
import ImageUploader from './ImageUploader';
import MapPreview from './MapPreview';
import RouteMapPreview from './RouteMapPreview';
import VoteButton from './VoteButton';
import { decodePolylineEndpoint, formatPriceLevel, getEntryDayHours, checkOpeningHoursConflict, formatTimeInTz, getTzAbbr } from '@/lib/entryHelpers';
import type { Trip, EntryWithOptions, EntryOption } from '@/types/trip';

// ─── Place Details Section ───
const PlaceDetailsSection = ({ option, entryStartTime }: { option: EntryOption; entryStartTime?: string }) => {
  const rating = (option as any).rating as number | null;
  const userRatingCount = (option as any).user_rating_count as number | null;
  const openingHours = (option as any).opening_hours as string[] | null;
  const priceLevel = (option as any).price_level as string | null;
  const [hoursOpen, setHoursOpen] = useState(false);

  const hasAnyData = rating != null || (openingHours && openingHours.length > 0) || priceLevel;
  if (!hasAnyData) return null;

  const priceLevelDisplay = formatPriceLevel(priceLevel);
  const { text: entryDayHoursText, dayName, googleIndex } = getEntryDayHours(openingHours, entryStartTime);

  // Closed-day warning: only for entries with a real scheduled time (not 2099 reference)
  const closedWarning = (() => {
    if (!entryStartTime || entryStartTime.startsWith('2099')) return null;
    const { isConflict, message } = checkOpeningHoursConflict(openingHours, entryStartTime);
    return isConflict ? message : null;
  })();

  return (
    <div className="space-y-2">
      {(rating != null || priceLevelDisplay) && (
        <div className="flex items-center gap-2 text-sm">
          {rating != null && (
            <span className="font-medium">
              ⭐ {rating}
              {userRatingCount != null && (
                <span className="text-muted-foreground font-normal"> ({userRatingCount.toLocaleString()} reviews)</span>
              )}
            </span>
          )}
          {priceLevelDisplay && (
            <span className="text-sm">{priceLevelDisplay}</span>
          )}
        </div>
      )}

      {closedWarning && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive font-medium">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{closedWarning}</span>
        </div>
      )}

      {openingHours && openingHours.length > 0 && (
        <Collapsible open={hoursOpen} onOpenChange={setHoursOpen}>
          <CollapsibleTrigger className="flex items-center gap-1.5 text-sm text-foreground hover:text-primary transition-colors w-full text-left">
            <span className="shrink-0">🕐</span>
            <span className="flex-1 truncate text-muted-foreground text-xs font-semibold">
              {entryDayHoursText || 'Opening hours'}
            </span>
            <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', hoursOpen && 'rotate-180')} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-1.5 pl-5 space-y-0.5">
            {openingHours.map((day, i) => (
              <p key={i} className={cn(
                'text-xs',
                i === googleIndex ? 'text-primary font-semibold' : 'text-muted-foreground'
              )}>
                {day}
                {i === googleIndex && <span className="ml-1 text-[10px]">← This day</span>}
              </p>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

// ─── Types ───

interface TransportResult {
  mode: string;
  duration_min: number;
  distance_km: number;
  polyline?: string | null;
}

export interface PlaceOverviewProps {
  entry: EntryWithOptions;
  option: EntryOption;
  trip?: Trip | null;
  context: 'timeline' | 'planner' | 'explore' | 'create' | 'global';
  isEditor: boolean;
  resolvedTz?: string;
  formatTime?: (iso: string, tz?: string) => string;
  userLat?: number | null;
  userLng?: number | null;
  votingLocked?: boolean;
  userVotes?: string[];
  onVoteChange?: () => void;
  onSaved: () => void;
  onClose: () => void;
  onMoveToIdeas?: (entryId: string) => void;
  preloadedReviews?: { text: string; rating: number | null; author: string; relativeTime: string }[] | null;
  preloadedEditorialSummary?: string | null;
  preloadedCurrentOpeningHours?: string[] | null;
}

const PlaceOverview = ({
  entry,
  option,
  trip,
  context,
  isEditor,
  resolvedTz,
  formatTime: formatTimeProp,
  userLat,
  userLng,
  votingLocked,
  userVotes = [],
  onVoteChange,
  onSaved,
  onClose,
  onMoveToIdeas,
  preloadedReviews,
  preloadedEditorialSummary,
  preloadedCurrentOpeningHours,
}: PlaceOverviewProps) => {
  const homeTimezone = trip?.home_timezone ?? 'Europe/London';
  const defaultCheckinHours = trip?.default_checkin_hours ?? 2;
  const defaultCheckoutMin = trip?.default_checkout_min ?? 30;

  // ─── View mode state ───
  const [deleting, setDeleting] = useState(false);
  const [hotelBlockCount, setHotelBlockCount] = useState(0);
  const [hotelBlockEntryIds, setHotelBlockEntryIds] = useState<string[]>([]);
  const [toggling, setToggling] = useState(false);
  const [viewRefreshing, setViewRefreshing] = useState(false);
  const [viewResults, setViewResults] = useState<TransportResult[]>([]);
  const [viewSelectedMode, setViewSelectedMode] = useState<string | null>(null);
  const [viewModesPreloaded, setViewModesPreloaded] = useState(false);
  const [viewApplying, setViewApplying] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [showPlaceSearch, setShowPlaceSearch] = useState(false);
  const [placeSearchQuery, setPlaceSearchQuery] = useState('');
  const [topReview, setTopReview] = useState<{ text: string; rating: number | null; author: string; relativeTime: string } | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  // ─── Effects ───
  useEffect(() => {
    setNotesValue((entry as any).notes ?? '');
    setNotesDirty(false);
  }, [entry]);

  useEffect(() => {
    if (deleting && option?.hotel_id) {
      (async () => {
        const { data } = await supabase
          .from('entry_options')
          .select('entry_id')
          .eq('hotel_id', option.hotel_id);
        const ids = data?.map(d => d.entry_id) ?? [];
        setHotelBlockEntryIds(ids);
        setHotelBlockCount(ids.length);
      })();
    }
  }, [deleting, option?.hotel_id]);

  // Fetch review on-demand (skip if preloaded)
  useEffect(() => {
    if (preloadedReviews && preloadedReviews.length > 0) {
      const best = [...preloadedReviews].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
      setTopReview(best);
      setReviewLoading(false);
      return;
    }
    if (!option.google_place_id || option.category === 'flight' || option.category === 'transfer') return;
    setReviewLoading(true);
    supabase.functions.invoke('google-places', {
      body: { action: 'details', placeId: option.google_place_id }
    }).then(({ data }) => {
      if (data?.reviews?.length > 0) {
        const best = [...data.reviews].sort((a: any, b: any) => (b.rating ?? 0) - (a.rating ?? 0))[0];
        setTopReview(best);
      }
    }).catch(() => {}).finally(() => setReviewLoading(false));
  }, [option.google_place_id, option.category, preloadedReviews]);

  useEffect(() => {
    if (option?.category === 'transfer' && !viewModesPreloaded) {
      const transportModes = (option as any).transport_modes;
      if (transportModes && Array.isArray(transportModes) && transportModes.length > 0) {
        setViewResults(transportModes as TransportResult[]);
        const lower = option.name.toLowerCase();
        let cm = 'transit';
        if (lower.startsWith('walk')) cm = 'walk';
        else if (lower.startsWith('drive')) cm = 'drive';
        else if (lower.startsWith('cycle')) cm = 'bicycle';
        setViewSelectedMode(cm);
      }
      setViewModesPreloaded(true);
    }
  }, [option, viewModesPreloaded]);

  // ─── Handlers ───
  const handlePlaceSelectInView = async (details: PlaceDetails) => {
    const updateData: Record<string, any> = {
      name: details.name,
      location_name: details.address || null,
      latitude: details.lat,
      longitude: details.lng,
      phone: details.phone || null,
      website: details.website || null,
      opening_hours: details.openingHours || null,
      rating: details.rating,
      user_rating_count: details.userRatingCount,
      google_maps_uri: details.googleMapsUri || null,
      google_place_id: details.placeId || null,
      price_level: details.priceLevel || null,
      address: details.address || null,
    };
    await supabase.from('entry_options').update(updateData as any).eq('id', option.id);
    if (details.photos.length > 0) {
      const existingImages = option.images ?? [];
      const newPhotos = details.photos.filter(url => !existingImages.some(img => img.image_url === url));
      for (let i = 0; i < newPhotos.length; i++) {
        await supabase.from('option_images').insert({
          option_id: option.id,
          image_url: newPhotos[i],
          sort_order: existingImages.length + i,
        });
      }
    }
    setShowPlaceSearch(false);
    setPlaceSearchQuery('');
    onSaved();
  };

  const handleNotesSave = async () => {
    if (!notesDirty) return;
    const trimmed = notesValue.trim() || null;
    await supabase.from('entries').update({ notes: trimmed } as any).eq('id', entry.id);
    setNotesDirty(false);
    onSaved();
  };

  const handleToggleLock = async () => {
    setToggling(true);
    try {
      const { error } = await supabase.from('entries').update({ is_locked: !entry.is_locked } as any).eq('id', entry.id);
      if (error) throw error;
      toast({ title: entry.is_locked ? 'Entry unlocked' : 'Entry locked' });
      onSaved();
    } catch (err: any) {
      toast({ title: 'Failed to toggle lock', description: err.message, variant: 'destructive' });
    } finally { setToggling(false); }
  };

  const handleInlineSaveOption = async (field: string, value: string) => {
    const { error } = await supabase.from('entry_options').update({ [field]: value || null } as any).eq('id', option.id);
    if (error) { toast({ title: 'Failed to save', variant: 'destructive' }); return; }
    onSaved();
  };

  const handleInlineSaveEntry = async (field: string, value: string) => {
    const { error } = await supabase.from('entries').update({ [field]: value } as any).eq('id', entry.id);
    if (error) { toast({ title: 'Failed to save', variant: 'destructive' }); return; }
    onSaved();
  };

  const handleGenericTimeSave = async (which: 'start' | 'end', newTimeStr: string) => {
    if (!trip) return;
    const viewTz = resolvedTz || homeTimezone;
    const dateStr = utcToLocal(entry.start_time, viewTz).date;
    const newUtc = localToUTC(dateStr, newTimeStr, viewTz);
    const field = which === 'start' ? 'start_time' : 'end_time';
    const { error } = await supabase.from('entries').update({ [field]: newUtc } as any).eq('id', entry.id);
    if (error) { toast({ title: 'Failed to save time', variant: 'destructive' }); return; }
    onSaved();
  };

  const handleFlightTimeSave = async (type: 'departure' | 'arrival', newTimeStr: string) => {
    const tz = type === 'departure' ? (option.departure_tz || homeTimezone) : (option.arrival_tz || homeTimezone);
    const currentISO = type === 'departure' ? entry.start_time : entry.end_time;
    const currentDate = new Date(currentISO);
    const datePart = currentDate.toLocaleDateString('en-CA', { timeZone: tz });
    const utcISO = localToUTC(datePart, newTimeStr, tz);

    const updateField = type === 'departure' ? 'start_time' : 'end_time';
    const { error } = await supabase.from('entries').update({ [updateField]: utcISO } as any).eq('id', entry.id);
    if (error) { toast({ title: 'Failed to save time', variant: 'destructive' }); return; }

    const checkinHrs = option.airport_checkin_hours ?? defaultCheckinHours;
    const checkoutMins = option.airport_checkout_min ?? defaultCheckoutMin;

    const { data: linkedEntries } = await supabase
      .from('entries')
      .select('*')
      .eq('linked_flight_id', entry.id);

    if (linkedEntries) {
      for (const linked of linkedEntries) {
        if (linked.linked_type === 'checkin' && type === 'departure') {
          const depMs = new Date(utcISO).getTime();
          const checkinStart = new Date(depMs - checkinHrs * 3600000).toISOString();
          await supabase.from('entries').update({
            start_time: checkinStart,
            end_time: utcISO,
          } as any).eq('id', linked.id);
        }
        if (linked.linked_type === 'checkout' && type === 'arrival') {
          const arrMs = new Date(utcISO).getTime();
          const checkoutEnd = new Date(arrMs + checkoutMins * 60000).toISOString();
          await supabase.from('entries').update({
            start_time: utcISO,
            end_time: checkoutEnd,
          } as any).eq('id', linked.id);
        }
      }
    }

    toast({ title: `${type === 'departure' ? 'Departure' : 'Arrival'} time updated` });
    onSaved();
  };

  const cascadeCheckinDuration = async (newHours: number) => {
    const depMs = new Date(entry.start_time).getTime();
    const { data: linkedEntries } = await supabase
      .from('entries')
      .select('*')
      .eq('linked_flight_id', entry.id)
      .eq('linked_type', 'checkin');
    if (linkedEntries) {
      for (const linked of linkedEntries) {
        const checkinStart = new Date(depMs - newHours * 3600000).toISOString();
        await supabase.from('entries').update({
          start_time: checkinStart,
          end_time: entry.start_time,
        } as any).eq('id', linked.id);
      }
    }
    onSaved();
  };

  const cascadeCheckoutDuration = async (newMinutes: number) => {
    const arrMs = new Date(entry.end_time).getTime();
    const { data: linkedEntries } = await supabase
      .from('entries')
      .select('*')
      .eq('linked_flight_id', entry.id)
      .eq('linked_type', 'checkout');
    if (linkedEntries) {
      for (const linked of linkedEntries) {
        const checkoutEnd = new Date(arrMs + newMinutes * 60000).toISOString();
        await supabase.from('entries').update({
          start_time: entry.end_time,
          end_time: checkoutEnd,
        } as any).eq('id', linked.id);
      }
    }
    onSaved();
  };

  // ─── Computed values ───
  const distance = userLat != null && userLng != null && option.latitude != null && option.longitude != null
    ? haversineKm(userLat, userLng, option.latitude, option.longitude) : null;
  const hasVoted = userVotes.includes(option.id);
  const images = option.images ?? [];
  const isLocked = entry.is_locked;
  const isFlightView = option.category === 'flight' && option.departure_tz && option.arrival_tz;
  const flightDurationMin = isFlightView ? Math.round((new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / 60000) : 0;
  const flightHours = Math.floor(flightDurationMin / 60);
  const flightMins = flightDurationMin % 60;

  const entryDayLabel = (() => {
    if (!trip?.start_date || !entry?.start_time) return null;
    const tripStart = new Date(trip.start_date + 'T00:00:00');
    const entryDate = new Date(entry.start_time);
    const diffDays = Math.floor((entryDate.getTime() - tripStart.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return null;
    const dayName = entryDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    return `Day ${diffDays + 1} · ${dayName}`;
  })();

  return (
    <>
      {/* Hero image gallery at top — fixed height, touch swipe */}
        {images.length > 0 ? (
          <div className="relative w-full overflow-hidden" style={{ height: 240 }}>
            <ImageGallery images={images} height={240} />
            {isEditor && option.category !== 'transfer' && (
              <div className="absolute bottom-3 right-3 z-30">
                <ImageUploader optionId={option.id} currentCount={images.length} onUploaded={onSaved} />
              </div>
            )}
          </div>
        ) : isEditor && option.category !== 'transfer' ? (
          <div className="w-full bg-muted/30 flex items-center justify-center" style={{ height: 160 }}>
            <ImageUploader optionId={option.id} currentCount={0} onUploaded={onSaved} />
          </div>
        ) : null}

        <div className="px-4 pb-4 pt-2 space-y-4">
          {/* Category badge + title */}
          <div className="space-y-1">
            {option.category && (
              <Badge
                className="w-fit gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider"
                style={option.category_color ? { backgroundColor: option.category_color, color: '#fff' } : undefined}
              >
                {isFlightView && <Plane className="h-3 w-3" />}
                {option.category}
              </Badge>
            )}
            {entryDayLabel && (
              <p className="text-xs font-medium text-muted-foreground">{entryDayLabel}</p>
            )}
            <h2 className="text-xl font-bold">
              <InlineField
                value={option.name}
                canEdit={isEditor}
                onSave={async (v) => {
                  await handleInlineSaveOption('name', v);
                  if (v !== option.name && v.trim().length > 2) {
                    setPlaceSearchQuery(v);
                    setShowPlaceSearch(true);
                  }
                }}
                placeholder="Entry name"
              />
            </h2>
            {showPlaceSearch && (
              <div className="pt-1">
                <PlacesAutocomplete
                  value={placeSearchQuery}
                  onChange={setPlaceSearchQuery}
                  onPlaceSelect={handlePlaceSelectInView}
                  placeholder="Search for a place..."
                  autoFocus
                />
                <button
                  className="text-xs text-muted-foreground hover:text-foreground mt-1"
                  onClick={() => { setShowPlaceSearch(false); setPlaceSearchQuery(''); }}
                >
                  Cancel search
                </button>
              </div>
            )}

            {/* Lock + Delete action row */}
            <div className="flex items-center gap-2 pt-1">
              {isEditor && option?.category !== 'flight' && option?.category !== 'transfer' && (
                <button
                  className={cn(
                    'flex items-center justify-center h-8 w-8 rounded-md transition-colors',
                    isLocked ? 'bg-primary hover:bg-primary/90' : 'hover:bg-muted/50'
                  )}
                  onClick={handleToggleLock}
                  disabled={toggling}
                >
                  {isLocked
                    ? <Lock className="h-4 w-4 text-primary-foreground" />
                    : <LockOpen className="h-4 w-4 text-muted-foreground" />
                  }
                </button>
              )}
              {isEditor && (
                <button
                  className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-destructive/10 transition-colors"
                  onClick={() => setDeleting(true)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              )}
            </div>
          </div>

          {/* Flight layout */}
          {isFlightView ? (
            <div className="space-y-3">
              {images.length === 0 && (
                <img
                  src="https://images.unsplash.com/photo-1436491865332-7a61a109db05?w=600&h=200&fit=crop"
                  alt="Flight"
                  className="w-full h-32 object-cover rounded-xl"
                />
              )}
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 text-left space-y-0.5">
                  <InlineField
                    value={option.departure_location || 'Departure'}
                    canEdit={isEditor}
                    onSave={async (v) => handleInlineSaveOption('departure_location', v)}
                    renderDisplay={(val) => <p className="text-sm font-bold text-foreground">{val}</p>}
                  />
                  <InlineField
                    value={option.departure_terminal || ''}
                    canEdit={isEditor}
                    onSave={async (v) => handleInlineSaveOption('departure_terminal', v)}
                    renderDisplay={(val) => {
                      if (!val) return <p className="text-xs text-muted-foreground italic">Add terminal</p>;
                      const formatted = /^\d+$/.test(val.trim()) || /^T\d+$/i.test(val.trim())
                        ? `Terminal - ${val.trim().replace(/^T/i, '')}`
                        : val;
                      return <p className="text-xs text-muted-foreground">{formatted}</p>;
                    }}
                    placeholder="Add terminal"
                  />
                  <InlineField
                    value={formatTimeInTz(entry.start_time, option.departure_tz!)}
                    canEdit={isEditor}
                    onSave={async (v) => handleFlightTimeSave('departure', v)}
                    inputType="time"
                    renderDisplay={(val) => <p className="text-lg font-semibold text-foreground">{val}</p>}
                  />
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">
                    {getTzAbbr(option.departure_tz!)}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <Plane className="h-4 w-4 text-muted-foreground" />
                  <div className="h-px w-12 bg-border" />
                  <span className="text-[10px] text-muted-foreground">
                    {flightHours > 0 ? `${flightHours}h ` : ''}{flightMins}m
                  </span>
                </div>
                <div className="flex-1 text-right space-y-0.5">
                  <InlineField
                    value={option.arrival_location || 'Arrival'}
                    canEdit={isEditor}
                    onSave={async (v) => handleInlineSaveOption('arrival_location', v)}
                    renderDisplay={(val) => <p className="text-sm font-bold text-foreground">{val}</p>}
                  />
                  <InlineField
                    value={option.arrival_terminal || ''}
                    canEdit={isEditor}
                    onSave={async (v) => handleInlineSaveOption('arrival_terminal', v)}
                    renderDisplay={(val) => {
                      if (!val) return <p className="text-xs text-muted-foreground italic">Add terminal</p>;
                      const formatted = /^\d+$/.test(val.trim()) || /^T\d+$/i.test(val.trim())
                        ? `Terminal - ${val.trim().replace(/^T/i, '')}`
                        : val;
                      return <p className="text-xs text-muted-foreground">{formatted}</p>;
                    }}
                    placeholder="Add terminal"
                  />
                  <InlineField
                    value={formatTimeInTz(entry.end_time, option.arrival_tz!)}
                    canEdit={isEditor}
                    onSave={async (v) => handleFlightTimeSave('arrival', v)}
                    inputType="time"
                    renderDisplay={(val) => <p className="text-lg font-semibold text-foreground">{val}</p>}
                  />
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">
                    {getTzAbbr(option.arrival_tz!)}
                  </p>
                </div>
              </div>
              {/* Flight date */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{new Date(entry.start_time).toLocaleDateString('en-GB', { timeZone: option.departure_tz!, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              {isLocked && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary"><Lock className="h-2.5 w-2.5 text-primary-foreground" /></span> Locked
                </div>
              )}
              {/* Airport Processing - editable durations */}
              {isEditor && (
                <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Airport Processing</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Check-in</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-16 text-sm text-center"
                          defaultValue={option.airport_checkin_hours ?? defaultCheckinHours}
                          onBlur={async (e) => {
                            const hrs = Math.max(0, Number(e.target.value) || 0);
                            await handleInlineSaveOption('airport_checkin_hours', String(hrs));
                            await cascadeCheckinDuration(hrs);
                          }}
                        />
                        <span className="text-xs text-muted-foreground">hrs before</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Checkout</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-16 text-sm text-center"
                          defaultValue={option.airport_checkout_min ?? defaultCheckoutMin}
                          onBlur={async (e) => {
                            const mins = Math.max(0, Number(e.target.value) || 0);
                            await handleInlineSaveOption('airport_checkout_min', String(mins));
                            await cascadeCheckoutDuration(mins);
                          }}
                        />
                        <span className="text-xs text-muted-foreground">mins after</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </div>
          ) : option.category === 'transfer' ? (
            <>
              {/* Transport mode-centric header */}
              {(() => {
                const lower = option.name.toLowerCase();
                let modeEmoji = '🚆', modeLabel = 'Transport';
                if (lower.startsWith('walk')) { modeEmoji = '🚶'; modeLabel = 'Walking'; }
                else if (lower.startsWith('transit')) { modeEmoji = '🚌'; modeLabel = 'Transit'; }
                else if (lower.startsWith('drive')) { modeEmoji = '🚗'; modeLabel = 'Driving'; }
                else if (lower.startsWith('cycle')) { modeEmoji = '🚲'; modeLabel = 'Cycling'; }

                const totalMin = Math.round((new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / 60000);
                const h = Math.floor(totalMin / 60);
                const m = totalMin % 60;
                const durationStr = h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}` : `${m}m`;

                const selectedModeData = viewResults.find(r => r.mode === viewSelectedMode)
                  || ((option as any).transport_modes || []).find((m: any) => m.mode === viewSelectedMode);
                const rawDuration = selectedModeData?.duration_min ?? totalMin;
                const blockDur = Math.ceil(rawDuration / 5) * 5;
                const contingency = blockDur - rawDuration;

                return (
                  <div className="space-y-4">
                    {/* From / To */}
                    {(option.departure_location || option.arrival_location) && (
                      <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                        <div className="space-y-1.5">
                          <div className="flex items-start gap-2">
                            <span className="text-xs font-semibold text-muted-foreground w-10 shrink-0 pt-0.5">From</span>
                            <span className="text-sm font-medium text-foreground">{option.departure_location || '—'}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-xs font-semibold text-muted-foreground w-10 shrink-0 pt-0.5">To</span>
                            <span className="text-sm font-medium text-foreground">{option.arrival_location || '—'}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Duration & distance */}
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{durationStr}</span>
                      {(option as any).distance_km != null && (
                        <span className="text-sm text-muted-foreground">
                          {(option as any).distance_km < 1
                            ? `${Math.round((option as any).distance_km * 1000)}m`
                            : `${Number((option as any).distance_km).toFixed(1)}km`}
                        </span>
                      )}
                      {contingency > 0 && (
                        <span className="text-xs text-muted-foreground">⏱ {rawDuration}m + {contingency}m buffer = {blockDur}m</span>
                      )}
                    </div>

                    {/* Route map */}
                    {(() => {
                      const polylineStr = (option as any).route_polyline;
                      if (!polylineStr) return null;
                      const dest = decodePolylineEndpoint(polylineStr);
                      return (
                        <RouteMapPreview
                          polyline={polylineStr}
                          fromAddress={option.departure_location || ''}
                          toAddress={option.arrival_location || ''}
                          travelMode={modeLabel.toLowerCase()}
                          size="full"
                          destLat={dest?.lat ?? null}
                          destLng={dest?.lng ?? null}
                          destName={(option.arrival_location || '').split(',')[0].trim()}
                        />
                      );
                    })()}

                    {/* Time (de-emphasized) */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{formatTimeProp?.(entry.start_time) ?? ''} — {formatTimeProp?.(entry.end_time) ?? ''}</span>
                    </div>

                    {isLocked && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary"><Lock className="h-2.5 w-2.5 text-primary-foreground" /></span> Locked
                      </div>
                    )}

                    {/* Mode switcher / refresh in view */}
                    {isEditor && option.departure_location && option.arrival_location && (
                      <div className="space-y-2 pt-2 border-t border-border/50">
                        <Button variant="outline" size="sm" className="w-full text-xs" onClick={async () => {
                          setViewRefreshing(true);
                          try {
                            const { data: rData, error: rError } = await supabase.functions.invoke('google-directions', {
                              body: {
                                fromAddress: option.departure_location,
                                toAddress: option.arrival_location,
                                modes: ['walk', 'transit', 'drive', 'bicycle'],
                                departureTime: entry.start_time,
                              },
                            });
                            if (rError) throw rError;
                            setViewResults(rData?.results ?? []);
                            const currentLower = option.name.toLowerCase();
                            let cm = 'transit';
                            if (currentLower.startsWith('walk')) cm = 'walk';
                            else if (currentLower.startsWith('drive')) cm = 'drive';
                            else if (currentLower.startsWith('cycle')) cm = 'bicycle';
                            setViewSelectedMode(cm);
                          } catch (err) {
                            console.error('View refresh failed:', err);
                          } finally {
                            setViewRefreshing(false);
                          }
                        }} disabled={viewRefreshing}>
                          {viewRefreshing ? <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Refreshing…</> : <><RefreshCw className="mr-1.5 h-3 w-3" /> Refresh routes</>}
                        </Button>
                        {viewResults.length > 0 && (
                          <div className="space-y-1.5">
                            {viewResults.map(r => {
                              const fmtDur = (min: number) => { const hh = Math.floor(min / 60); const mm = min % 60; if (hh === 0) return `${mm}m`; if (mm === 0) return `${hh}h`; return `${hh}h ${mm}m`; };
                              const modeEmojiMap: Record<string, string> = { walk: '🚶', transit: '🚌', drive: '🚗', bicycle: '🚲' };
                              const modeLabelMap: Record<string, string> = { walk: 'Walk', transit: 'Transit', drive: 'Drive', bicycle: 'Cycle' };
                              return (
                                <button key={r.mode} onClick={async () => {
                                  setViewSelectedMode(r.mode);
                                  setViewApplying(true);
                                  try {
                                    const blockDur = Math.ceil(r.duration_min / 5) * 5;
                                    const newEnd = new Date(new Date(entry.start_time).getTime() + blockDur * 60000).toISOString();
                                    const toShort = (option.arrival_location || '').split(',')[0].trim();
                                    const newName = `${modeLabelMap[r.mode] || r.mode} to ${toShort}`;
                                    await supabase.from('entries').update({ end_time: newEnd }).eq('id', entry.id);
                                    await supabase.from('entry_options').update({ distance_km: r.distance_km, route_polyline: r.polyline ?? null, name: newName } as any).eq('id', option.id);
                                    setViewResults([]);
                                    onSaved();
                                  } catch (err) { console.error('Apply mode failed:', err); } finally { setViewApplying(false); }
                                }}
                                  className={cn(
                                    'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors',
                                    viewSelectedMode === r.mode ? 'bg-orange-100 dark:bg-orange-900/30 font-medium' : 'hover:bg-muted'
                                  )}
                                  disabled={viewApplying}
                                >
                                  <span className="text-base">{modeEmojiMap[r.mode] ?? '🚌'}</span>
                                  <span className="flex-1 text-left">{modeLabelMap[r.mode] ?? r.mode}</span>
                                  <span className="text-xs text-muted-foreground">{fmtDur(r.duration_min)} · {r.distance_km < 1 ? `${Math.round(r.distance_km * 1000)}m` : `${r.distance_km.toFixed(1)}km`}</span>
                                  {viewSelectedMode === r.mode && <Check className="h-3.5 w-3.5 text-orange-500" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          ) : (
            <>
              {/* Editable Start / End / Duration */}
              {/* Time + Map side-by-side grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Left: Time card */}
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Time</p>
                  <div className="flex items-center gap-1.5">
                    <InlineField
                      value={formatTimeProp?.(entry.start_time) ?? ''}
                      canEdit={isEditor}
                      onSave={async (v) => handleGenericTimeSave('start', v)}
                      inputType="time"
                      renderDisplay={(val) => <span className="text-sm font-medium">{val}</span>}
                    />
                    <span className="text-sm text-muted-foreground">—</span>
                    <InlineField
                      value={formatTimeProp?.(entry.end_time) ?? ''}
                      canEdit={isEditor}
                      onSave={async (v) => handleGenericTimeSave('end', v)}
                      inputType="time"
                      renderDisplay={(val) => <span className="text-sm font-medium">{val}</span>}
                    />
                  </div>
                  <span className="inline-block rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary mt-1">
                    {(() => {
                      const diffMs = new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime();
                      const totalMin = Math.round(diffMs / 60000);
                      if (totalMin <= 0) return '';
                      const h = Math.floor(totalMin / 60);
                      const m = totalMin % 60;
                      return h > 0 ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
                    })()}
                  </span>
                </div>

                {/* Right: Map preview with navigation popover */}
                {option.latitude != null && option.longitude != null ? (
                  <Popover>
                    <PopoverTrigger asChild>
                    <div className="rounded-xl border border-border overflow-hidden relative cursor-pointer">
                        <img
                          src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/static-map?lat=${option.latitude}&lng=${option.longitude}&size=300x120`}
                          alt="Map preview"
                          className="w-full h-[100px] object-cover"
                          loading="lazy"
                        />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-1.5" side="top" align="end">
                      <a href={`https://maps.apple.com/?ll=${option.latitude},${option.longitude}&q=${encodeURIComponent(option.location_name || 'Location')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-muted transition-colors">
                        <Navigation className="h-3.5 w-3.5" /> Apple Maps
                      </a>
                      <a href={`https://www.google.com/maps/search/?api=1&query=${option.latitude},${option.longitude}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-muted transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" /> Google Maps
                      </a>
                      <a href={`https://m.uber.com/ul/?action=setPickup&pickup[latitude]=my_location&pickup[longitude]=my_location&dropoff[latitude]=${option.latitude}&dropoff[longitude]=${option.longitude}&dropoff[nickname]=${encodeURIComponent(option.location_name || 'Destination')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-muted transition-colors">
                        <Car className="h-3.5 w-3.5" /> Uber
                      </a>
                    </PopoverContent>
                  </Popover>
                ) : isEditor ? (
                  <button
                    className="rounded-xl border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center gap-1 w-full min-h-[100px] hover:border-primary hover:bg-primary/5 transition-all"
                    onClick={() => {
                      setShowPlaceSearch(true);
                      setPlaceSearchQuery(option.name || '');
                    }}
                  >
                    <span className="text-2xl opacity-20">📍</span>
                    <span className="text-[10px] font-semibold text-muted-foreground">Tap to add location</span>
                  </button>
                ) : (
                  <div className="rounded-xl border border-border bg-muted/30 flex items-center justify-center">
                    <span className="text-2xl opacity-20">📍</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Distance */}
          {distance !== null && (
            <p className="text-sm text-muted-foreground">
              📍 {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`} away
            </p>
          )}

          {/* Enriched Place Details (non-flight, non-transport) */}
          {option.category !== 'flight' && option.category !== 'transfer' && (
            <PlaceDetailsSection option={option} entryStartTime={entry.start_time} />
          )}

          {/* Editorial Summary */}
          {option.category !== 'flight' && option.category !== 'transfer' && preloadedEditorialSummary && (
            <p className="text-xs text-muted-foreground italic leading-relaxed px-1">
              "{preloadedEditorialSummary}"
            </p>
          )}

          {/* Modified Hours Warning */}
          {option.category !== 'flight' && option.category !== 'transfer' && preloadedCurrentOpeningHours && option.opening_hours && (
            (() => {
              const regular = (option.opening_hours as string[]).join('|');
              const current = preloadedCurrentOpeningHours.join('|');
              if (regular !== current) {
                return (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 font-medium">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>⚠️ Modified hours today</span>
                  </div>
                );
              }
              return null;
            })()
          )}

          {/* Top Review */}
          {option.category !== 'flight' && option.category !== 'transfer' && topReview && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">💬</span>
                <span className="text-xs font-semibold text-muted-foreground">Top Review</span>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-xs font-medium">{topReview.author}</span>
                  {topReview.rating && (
                    <span className="text-[10px] text-muted-foreground">{'⭐'.repeat(Math.min(topReview.rating, 5))}</span>
                  )}
                  {topReview.relativeTime && (
                    <span className="text-[10px] text-muted-foreground">· {topReview.relativeTime}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3">{topReview.text}</p>
                {option.google_maps_uri && (
                  <a
                    href={option.google_maps_uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-primary hover:underline mt-1.5 inline-block"
                  >
                    Read more on Google →
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Phone + Website — plain inline text with editable empty states */}
          {option.category !== 'transfer' && option.category !== 'flight' && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {(option as any).phone ? (
                <a href={`tel:${(option as any).phone}`} className="text-sm text-primary hover:underline" onClick={e => e.stopPropagation()}>
                  📞 {(option as any).phone}
                </a>
              ) : isEditor ? (
                <InlineField
                  value=""
                  canEdit={true}
                  onSave={async (v) => {
                    await supabase.from('entry_options').update({ phone: v } as any).eq('id', option.id);
                    onSaved();
                  }}
                  placeholder="Add phone"
                  renderDisplay={() => (
                    <span className="text-sm text-muted-foreground/40 hover:text-primary transition-colors cursor-pointer">
                      📞 Add phone
                    </span>
                  )}
                />
              ) : null}
              {option.website ? (
                <a href={option.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate max-w-[200px]" onClick={e => e.stopPropagation()}>
                  🔗 {(() => { try { return new URL(option.website).hostname; } catch { return option.website; } })()}
                </a>
              ) : isEditor ? (
                <InlineField
                  value=""
                  canEdit={true}
                  onSave={async (v) => handleInlineSaveOption('website', v)}
                  placeholder="https://..."
                  renderDisplay={() => (
                    <span className="text-sm text-muted-foreground/40 hover:text-primary transition-colors cursor-pointer">
                      🔗 Add website
                    </span>
                  )}
                />
              ) : null}
            </div>
          )}

          {/* Notes — always visible for editors */}
          {isEditor ? (
            <div className="space-y-1">
              <textarea
                value={notesValue}
                onChange={(e) => { setNotesValue(e.target.value); setNotesDirty(true); }}
                onBlur={handleNotesSave}
                placeholder="📝 Add a note..."
                className="flex min-h-[48px] w-full rounded-md border border-dashed border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:border-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                rows={2}
              />
            </div>
          ) : notesValue ? (
            <div className="space-y-1">
              <p className="text-sm text-foreground whitespace-pre-wrap">📝 {notesValue}</p>
            </div>
          ) : null}


          {/* Budget — collapsible (not for flights/transfers) */}
          {option.category !== 'flight' && option.category !== 'transfer' && (() => {
            const est = option.estimated_budget;
            const act = option.actual_cost;
            const hasEst = est != null;
            const hasAct = act != null;
            const headerLabel = hasEst && hasAct
              ? `💰 €${act.toFixed(2)} / €${est.toFixed(2)}`
              : '💰 Budget';

            const budgetSummary = () => {
              if (hasEst && hasAct) {
                const diff = est - act;
                if (diff > 0) return <p className="text-sm text-green-600 font-medium">€{diff.toFixed(2)} under budget</p>;
                if (diff === 0) return <p className="text-sm text-green-600 font-medium">On budget</p>;
                return <p className="text-sm text-destructive font-medium">€{Math.abs(diff).toFixed(2)} over budget</p>;
              }
              if (hasEst) return <p className="text-sm text-muted-foreground">Estimated: €{est.toFixed(2)}</p>;
              if (hasAct) return <p className="text-sm text-muted-foreground">Spent: €{act.toFixed(2)}</p>;
              return <p className="text-sm text-muted-foreground italic">Track spending for this activity</p>;
            };

            return (
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1.5 text-sm font-semibold text-foreground w-full text-left py-1">
                  <span className="flex-1">{headerLabel}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform [&[data-state=open]]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-1">
                  {isEditor ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-20">Estimated</span>
                        <InlineField
                          value={est != null ? est.toFixed(2) : ''}
                          canEdit={true}
                          placeholder="Add budget"
                          renderDisplay={(val) => val ? <span className="text-sm">€{val}</span> : <span className="text-sm text-muted-foreground italic">Add budget</span>}
                          renderInput={(val, onChange, onDone) => (
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-muted-foreground">€</span>
                              <Input
                                type="number"
                                step="0.01"
                                value={val}
                                onChange={e => onChange(e.target.value)}
                                onBlur={onDone}
                                onKeyDown={e => { if (e.key === 'Enter') onDone(); }}
                                autoFocus
                                placeholder="0.00"
                                className="h-8 w-28"
                              />
                            </div>
                          )}
                          onSave={async (v) => {
                            const parsed = v ? parseFloat(v) : null;
                            await supabase.from('entry_options').update({ estimated_budget: parsed } as any).eq('id', option.id);
                            onSaved();
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-20">Actual</span>
                        <InlineField
                          value={act != null ? act.toFixed(2) : ''}
                          canEdit={true}
                          placeholder="Add actual cost"
                          renderDisplay={(val) => val ? <span className="text-sm">€{val}</span> : <span className="text-sm text-muted-foreground italic">Add actual cost</span>}
                          renderInput={(val, onChange, onDone) => (
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-muted-foreground">€</span>
                              <Input
                                type="number"
                                step="0.01"
                                value={val}
                                onChange={e => onChange(e.target.value)}
                                onBlur={onDone}
                                onKeyDown={e => { if (e.key === 'Enter') onDone(); }}
                                autoFocus
                                placeholder="0.00"
                                className="h-8 w-28"
                              />
                            </div>
                          )}
                          onSave={async (v) => {
                            const parsed = v ? parseFloat(v) : null;
                            await supabase.from('entry_options').update({ actual_cost: parsed } as any).eq('id', option.id);
                            onSaved();
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {hasEst && <p className="text-sm">Estimated: €{est.toFixed(2)}</p>}
                      {hasAct && <p className="text-sm">Spent: €{act.toFixed(2)}</p>}
                    </>
                  )}
                  {budgetSummary()}
                </CollapsibleContent>
              </Collapsible>
            );
          })()}

          {/* Editor actions */}
          {isEditor && onMoveToIdeas && option?.category !== 'transfer' && option?.category !== 'flight' && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={isLocked}
                onClick={() => {
                  if (isLocked) {
                    toast({ title: 'Unlock this entry first', description: 'Locked entries cannot be sent to the Planner.' });
                    return;
                  }
                  onMoveToIdeas(entry.id);
                }}
              >
                <ClipboardList className="mr-1.5 h-3.5 w-3.5" /> Send to Planner
              </Button>
            </div>
          )}

          {/* Delete confirmation */}
          {option?.hotel_id ? (
            <AlertDialog open={deleting} onOpenChange={setDeleting}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete hotel block</AlertDialogTitle>
                  <AlertDialogDescription>
                    Do you want to delete just this block, or all blocks for {option.name}?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={async () => {
                      try {
                        if (hotelBlockEntryIds.length > 0) {
                          const { error } = await supabase.from('entries').delete().in('id', hotelBlockEntryIds);
                          if (error) throw error;
                        }
                        await supabase.from('hotels').delete().eq('id', option.hotel_id!);
                        toast({ title: 'All hotel blocks deleted' });
                        onClose();
                        onSaved();
                      } catch (err: any) {
                        toast({ title: 'Failed to delete', description: err.message, variant: 'destructive' });
                      } finally { setDeleting(false); }
                    }}
                  >
                    Delete All — {hotelBlockCount} blocks
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      try {
                        const { error } = await supabase.from('entries').delete().eq('id', entry.id);
                        if (error) throw error;
                        toast({ title: 'Entry deleted' });
                        onClose();
                        onSaved();
                      } catch (err: any) {
                        toast({ title: 'Failed to delete', description: err.message, variant: 'destructive' });
                      } finally { setDeleting(false); }
                    }}
                  >
                    Just This Block
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => setDeleting(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <AlertDialog open={deleting} onOpenChange={setDeleting}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently delete the entry and all its options. This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={async () => {
                      try {
                        const { error } = await supabase.from('entries').delete().eq('id', entry.id);
                        if (error) throw error;
                        toast({ title: 'Entry deleted' });
                        onClose();
                        onSaved();
                      } catch (err: any) {
                        toast({ title: 'Failed to delete', description: err.message, variant: 'destructive' });
                      } finally { setDeleting(false); }
                    }}
                  >Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
      </div>
    </>
  );
};

export default PlaceOverview;

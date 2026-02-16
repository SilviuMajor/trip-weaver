import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ArrowLeft, MapPin, ClipboardList, List, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { findCategory, type CategoryDef } from '@/lib/categories';
import { CATEGORY_TO_PLACE_TYPES, getCategorySearchPlaceholder } from '@/lib/placeTypeMapping';
import { cn } from '@/lib/utils';
import ExploreCard from './ExploreCard';
import PlaceOverview from './PlaceOverview';
import type { Trip, EntryWithOptions, EntryOption } from '@/types/trip';

// ─── Types ───

export interface ExploreResult {
  placeId: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  userRatingCount: number | null;
  priceLevel: string | null;
  openingHours: string[] | null;
  types: string[];
  googleMapsUri: string | null;
  website: string | null;
  phone: string | null;
  photoRef: string | null;
  photoUrl?: string | null;
}

interface ExploreViewProps {
  open: boolean;
  onClose: () => void;
  trip: Trip;
  entries: EntryWithOptions[];
  categoryId?: string | null;
  isEditor: boolean;
  onAddToPlanner: (place: ExploreResult) => void;
  onCardTap: (place: ExploreResult) => void;
  onAddManually: () => void;
}

// ─── Helpers ───

function resolveOrigin(
  entries: EntryWithOptions[],
): { name: string; lat: number; lng: number } | null {
  const now = Date.now();
  let closest: { name: string; lat: number; lng: number; diff: number } | null = null;

  for (const entry of entries) {
    if (!entry.is_scheduled) continue;
    const opt = entry.options[0];
    if (!opt?.latitude || !opt?.longitude) continue;
    const diff = Math.abs(new Date(entry.start_time).getTime() - now);
    if (!closest || diff < closest.diff) {
      closest = { name: opt.location_name || opt.name, lat: opt.latitude, lng: opt.longitude, diff };
    }
  }
  return closest ? { name: closest.name, lat: closest.lat, lng: closest.lng } : null;
}

function buildTempEntry(place: ExploreResult, tripId: string, categoryId: string | null, resolvedPhotoUrl: string | null): { entry: EntryWithOptions; option: EntryOption } {
  const now = new Date().toISOString();
  const fakeEntryId = `explore-${place.placeId}`;
  const fakeOptionId = `explore-opt-${place.placeId}`;

  const option: EntryOption = {
    id: fakeOptionId,
    entry_id: fakeEntryId,
    name: place.name,
    website: place.website,
    category: categoryId,
    category_color: null,
    latitude: place.lat,
    longitude: place.lng,
    location_name: place.address,
    departure_location: null,
    arrival_location: null,
    departure_tz: null,
    arrival_tz: null,
    departure_terminal: null,
    arrival_terminal: null,
    airport_checkin_hours: null,
    airport_checkout_min: null,
    phone: place.phone,
    address: place.address,
    rating: place.rating,
    user_rating_count: place.userRatingCount,
    opening_hours: place.openingHours,
    google_maps_uri: place.googleMapsUri,
    google_place_id: place.placeId,
    price_level: place.priceLevel,
    estimated_budget: null,
    actual_cost: null,
    created_at: now,
    updated_at: now,
    vote_count: 0,
    images: resolvedPhotoUrl ? [{ id: 'temp', option_id: fakeOptionId, image_url: resolvedPhotoUrl, sort_order: 0, created_at: now }] : [],
  };

  const entry: EntryWithOptions = {
    id: fakeEntryId,
    trip_id: tripId,
    start_time: now,
    end_time: now,
    is_locked: false,
    is_scheduled: false,
    scheduled_day: null,
    option_group_id: null,
    linked_flight_id: null,
    linked_type: null,
    from_entry_id: null,
    to_entry_id: null,
    created_at: now,
    updated_at: now,
    options: [option],
  };

  return { entry, option };
}

// ─── Component ───

const ExploreView = ({
  open,
  onClose,
  trip,
  entries,
  categoryId,
  isEditor,
  onAddToPlanner,
  onCardTap,
  onAddManually,
}: ExploreViewProps) => {
  const [results, setResults] = useState<ExploreResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [originLocation, setOriginLocation] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [originResolved, setOriginResolved] = useState(false);
  const [addedPlaceIds, setAddedPlaceIds] = useState<Set<string>>(new Set());
  const [selectedPlace, setSelectedPlace] = useState<ExploreResult | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialLoadDone = useRef(false);
  const isMobile = useIsMobile();

  const cat: CategoryDef | undefined = categoryId ? findCategory(categoryId) : undefined;
  const destination = trip.destination || null;

  // Existing place IDs in trip
  const existingPlaceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of entries) {
      for (const opt of entry.options) {
        if (opt.google_place_id) ids.add(opt.google_place_id);
      }
    }
    return ids;
  }, [entries]);

  // Resolve origin
  useEffect(() => {
    if (!open) return;
    const fromEntries = resolveOrigin(entries);
    if (fromEntries) {
      setOriginLocation(fromEntries);
      setOriginResolved(true);
      return;
    }
    if (destination) {
      supabase.functions.invoke('google-places', {
        body: { action: 'autocomplete', input: destination },
      }).then(({ data }) => {
        const first = data?.predictions?.[0];
        if (first?.lat && first?.lng) {
          setOriginLocation({ name: destination, lat: first.lat, lng: first.lng });
        }
        setOriginResolved(true);
      }).catch(() => setOriginResolved(true));
    } else {
      setOriginResolved(true);
    }
  }, [open, entries, destination]);

  // Auto-focus search input
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setResults([]);
      setSearchQuery('');
      setLoading(false);
      setAddedPlaceIds(new Set());
      initialLoadDone.current = false;
      setOriginResolved(false);
    }
  }, [open]);

  // Auto-load nearby search when category is set and origin resolved
  useEffect(() => {
    if (!open || !categoryId || !originResolved || initialLoadDone.current) return;
    if (searchQuery.trim()) return;

    const types = CATEGORY_TO_PLACE_TYPES[categoryId];
    if (!types || !originLocation) {
      initialLoadDone.current = true;
      return;
    }

    initialLoadDone.current = true;
    performNearbySearch(originLocation.lat, originLocation.lng, types);
  }, [open, categoryId, originResolved, originLocation, searchQuery]);

  // Debounced text search
  useEffect(() => {
    if (!open || !searchQuery.trim()) return;
    const timer = setTimeout(() => {
      performTextSearch(searchQuery.trim());
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, open]);

  const performNearbySearch = useCallback(async (lat: number, lng: number, types: string[]) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-places', {
        body: { action: 'nearbySearch', latitude: lat, longitude: lng, types, maxResults: 20 },
      });
      if (error) throw error;
      setResults(data?.results ?? []);
    } catch (err: any) {
      console.error('Nearby search failed:', err);
      toast({ title: 'Search failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  const performTextSearch = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const body: any = { action: 'textSearch', query };
      if (originLocation) {
        body.latitude = originLocation.lat;
        body.longitude = originLocation.lng;
      }
      if (categoryId) {
        const types = CATEGORY_TO_PLACE_TYPES[categoryId];
        if (types?.length) body.types = types;
      }
      const { data, error } = await supabase.functions.invoke('google-places', { body });
      if (error) throw error;
      setResults(data?.results ?? []);
    } catch (err: any) {
      console.error('Text search failed:', err);
      toast({ title: 'Search failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [originLocation, categoryId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) performTextSearch(searchQuery.trim());
  };

  const handleAdd = useCallback((place: ExploreResult) => {
    onAddToPlanner(place);
    setAddedPlaceIds(prev => new Set(prev).add(place.placeId));
  }, [onAddToPlanner]);

  const handleCardTap = useCallback((place: ExploreResult) => {
    setSelectedPlace(place);
    setDetailOpen(true);
  }, []);

  if (!open) return null;

  // Detail sheet content
  const detailContent = selectedPlace ? (() => {
    const { entry: tempEntry, option: tempOption } = buildTempEntry(selectedPlace, trip.id, categoryId ?? null, selectedPlace.photoUrl ?? null);
    const placeIsInTrip = existingPlaceIds.has(selectedPlace.placeId) || addedPlaceIds.has(selectedPlace.placeId);
    return (
      <div className="overflow-y-auto max-h-[85vh]">
        {/* Add to Planner button */}
        {isEditor && !placeIsInTrip && (
          <div className="px-4 pt-3 pb-1">
            <Button
              className="w-full gap-2"
              onClick={() => {
                handleAdd(selectedPlace);
                setDetailOpen(false);
              }}
            >
              <ClipboardList className="h-4 w-4" />
              Add to Planner
            </Button>
          </div>
        )}
        <PlaceOverview
          entry={tempEntry}
          option={tempOption}
          trip={trip}
          context="explore"
          isEditor={false}
          onSaved={() => {}}
          onClose={() => setDetailOpen(false)}
        />
      </div>
    );
  })() : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold truncate">
            {cat ? `${cat.emoji} ${cat.name}` : '🔍 Explore'}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="icon" className="h-7 w-7">
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={() => toast({ title: 'Map view coming soon' })}
          >
            <Map className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearchSubmit} className="border-b px-3 py-2">
        <Input
          ref={inputRef}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={getCategorySearchPlaceholder(categoryId ?? null, destination)}
          className="h-9 text-sm"
        />
      </form>

      {/* Origin context */}
      {originLocation && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">Suggested near {originLocation.name}</span>
        </div>
      )}

      {/* Results */}
      <ScrollArea className="flex-1">
        <div className="px-3 py-2 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {!loading && results.length === 0 && (searchQuery.trim() || initialLoadDone.current) && (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">
                {searchQuery.trim() ? `No results for "${searchQuery}"` : 'No places found nearby'}
              </p>
            </div>
          )}

          {!loading && results.map((place) => {
            const inTrip = existingPlaceIds.has(place.placeId) || addedPlaceIds.has(place.placeId);
            return (
              <ExploreCard
                key={place.placeId}
                place={place}
                categoryId={categoryId ?? null}
                onAddToPlanner={() => handleAdd(place)}
                onTap={() => handleCardTap(place)}
                isInTrip={inTrip}
                travelTime={null}
                compactHours={null}
              />
            );
          })}

          {/* Add manually link */}
          {!loading && (results.length > 0 || searchQuery.trim()) && (
            <button
              className="w-full py-3 text-sm text-primary hover:underline"
              onClick={onAddManually}
            >
              + Add manually
            </button>
          )}
        </div>
      </ScrollArea>

      {/* Detail sheet */}
      {isMobile ? (
        <Drawer open={detailOpen} onOpenChange={setDetailOpen}>
          <DrawerContent className="max-h-[92vh]">
            <DrawerTitle className="sr-only">Place Details</DrawerTitle>
            {detailContent}
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-0">
            <DialogTitle className="sr-only">Place Details</DialogTitle>
            {detailContent}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ExploreView;

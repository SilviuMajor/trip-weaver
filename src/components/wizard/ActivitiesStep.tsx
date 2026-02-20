import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, X, Loader2, ClipboardList } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { findCategory, PICKER_CATEGORIES } from '@/lib/categories';
import { CATEGORY_TO_PLACE_TYPES, getCategorySearchPlaceholder, inferCategoryFromTypes } from '@/lib/placeTypeMapping';
import { cn } from '@/lib/utils';
import ExploreCard from '@/components/timeline/ExploreCard';
import PlaceOverview from '@/components/timeline/PlaceOverview';
import type { ExploreResult } from '@/components/timeline/ExploreView';
import type { EntryWithOptions, EntryOption } from '@/types/trip';

// Categories relevant for activities (exclude transport/flight/hotel)
const EXPLORE_CATEGORIES = PICKER_CATEGORIES.filter(
  c => !['flight', 'hotel', 'private_transfer', 'transfer', 'transport', 'airport_processing'].includes(c.id)
);

export interface ActivityDraft {
  place: ExploreResult;
  categoryId: string;
}

interface ActivitiesStepProps {
  activities: ActivityDraft[];
  onChange: (activities: ActivityDraft[]) => void;
  destination: string;
  originLat?: number | null;
  originLng?: number | null;
}

type SortOption = 'default' | 'rating' | 'reviews' | 'nearest';

// ─── buildTempEntry helper ───
function buildTempEntry(
  place: ExploreResult,
  categoryId: string | null,
  detailPhotos: { url: string; attribution: string }[]
): { entry: EntryWithOptions; option: EntryOption } {
  const now = new Date().toISOString();
  const fakeEntryId = `wizard-${place.placeId}`;
  const fakeOptionId = `wizard-opt-${place.placeId}`;
  const cat = findCategory(categoryId ?? '');

  const option: EntryOption = {
    id: fakeOptionId,
    entry_id: fakeEntryId,
    name: place.name,
    website: place.website,
    category: categoryId,
    category_color: cat?.color ?? null,
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
    images: detailPhotos.length > 0
      ? detailPhotos.map((p, i) => ({
          id: `temp-img-${i}`,
          option_id: fakeOptionId,
          image_url: p.url,
          sort_order: i,
          created_at: now,
          attribution: p.attribution || undefined,
        }))
      : [],
  };

  const entry: EntryWithOptions = {
    id: fakeEntryId,
    trip_id: 'wizard',
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

const ActivitiesStep = ({ activities, onChange, destination, originLat, originLng }: ActivitiesStepProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<ExploreResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [originLocation, setOriginLocation] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [originResolved, setOriginResolved] = useState(false);

  // Detail drawer state
  const [selectedPlace, setSelectedPlace] = useState<ExploreResult | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [detailPhotos, setDetailPhotos] = useState<{ url: string; attribution: string }[]>([]);
  const [detailReviews, setDetailReviews] = useState<any[] | null>(null);
  const [detailEditorialSummary, setDetailEditorialSummary] = useState<string | null>(null);

  // Sort state
  const [sortBy, setSortBy] = useState<SortOption>('default');

  // Resolve origin
  useEffect(() => {
    if (originLat != null && originLng != null) {
      setOriginLocation({ name: destination || 'Hotel', lat: originLat, lng: originLng });
      setOriginResolved(true);
      return;
    }
    if (destination) {
      supabase.functions.invoke('google-places', {
        body: { action: 'textSearch', query: destination, maxResults: 1 },
      }).then(({ data }) => {
        const first = data?.results?.[0];
        if (first?.lat && first?.lng) {
          setOriginLocation({ name: destination, lat: first.lat, lng: first.lng });
        }
        setOriginResolved(true);
      }).catch(() => setOriginResolved(true));
    } else {
      setOriginResolved(true);
    }
  }, [destination, originLat, originLng]);

  const performNearbySearch = useCallback(async (lat: number, lng: number, types: string[]) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-places', {
        body: { action: 'nearbySearch', latitude: lat, longitude: lng, types, maxResults: 20, radius: 5000 },
      });
      if (error) throw error;
      setResults(data?.results ?? []);
    } catch (err: any) {
      toast({ title: 'Search failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  const performTextSearch = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const body: any = { action: 'textSearch', query, radius: 10000 };
      if (originLocation) {
        body.latitude = originLocation.lat;
        body.longitude = originLocation.lng;
      }
      if (selectedCategory) {
        const types = CATEGORY_TO_PLACE_TYPES[selectedCategory];
        if (types?.length) body.types = types;
      }
      const { data, error } = await supabase.functions.invoke('google-places', { body });
      if (error) throw error;
      setResults(data?.results ?? []);
    } catch (err: any) {
      toast({ title: 'Search failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [originLocation, selectedCategory]);

  const handleCategoryTap = (catId: string) => {
    if (selectedCategory === catId) {
      setSelectedCategory(null);
      setResults([]);
      setSortBy('default');
      return;
    }
    setSelectedCategory(catId);
    setSearchQuery('');
    setSortBy('default');
    if (originLocation) {
      const types = CATEGORY_TO_PLACE_TYPES[catId] || [];
      if (types.length > 0) performNearbySearch(originLocation.lat, originLocation.lng, types);
    }
  };

  const handleAdd = (place: ExploreResult) => {
    const catId = selectedCategory || inferCategoryFromTypes(place.types);
    if (activities.some(a => a.place.placeId === place.placeId)) return;
    onChange([...activities, { place, categoryId: catId }]);
    toast({ title: `Added ${place.name}` });
  };

  const handleRemove = (placeId: string) => {
    onChange(activities.filter(a => a.place.placeId !== placeId));
  };

  // Card tap → fetch details and open drawer
  const handleCardTap = async (place: ExploreResult) => {
    setDetailLoading(place.placeId);
    try {
      const { data: details } = await supabase.functions.invoke('google-places', {
        body: { action: 'details', placeId: place.placeId },
      });
      const rawPhotos = details?.photos ?? [];
      const normalizedPhotos = rawPhotos.map((p: any) =>
        typeof p === 'string' ? { url: p, attribution: '' } : { url: p.url, attribution: p.attribution ?? '' }
      );
      setDetailPhotos(normalizedPhotos);
      setDetailReviews(details?.reviews ?? []);
      setDetailEditorialSummary(details?.editorialSummary ?? null);
      if (details?.website) place.website = details.website;
      if (details?.phone) place.phone = details.phone;
      setSelectedPlace(place);
      setDetailOpen(true);
    } catch (err) {
      console.error('Failed to fetch place details:', err);
      setDetailPhotos([]);
      setDetailReviews(null);
      setDetailEditorialSummary(null);
      setSelectedPlace(place);
      setDetailOpen(true);
    } finally {
      setDetailLoading(null);
    }
  };

  // Sorted results
  const sortedResults = useMemo(() => {
    if (sortBy === 'default' || results.length === 0) return results;
    const sorted = [...results];
    switch (sortBy) {
      case 'rating':
        sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      case 'reviews':
        sorted.sort((a, b) => (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0));
        break;
      case 'nearest':
        if (originLocation) {
          sorted.sort((a, b) => {
            const distA = (a.lat != null && a.lng != null)
              ? Math.hypot(a.lat - originLocation.lat, a.lng - originLocation.lng)
              : Infinity;
            const distB = (b.lat != null && b.lng != null)
              ? Math.hypot(b.lat - originLocation.lat, b.lng - originLocation.lng)
              : Infinity;
            return distA - distB;
          });
        }
        break;
    }
    return sorted;
  }, [results, sortBy, originLocation]);

  // Debounced text search
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      if (selectedCategory && originLocation) {
        const types = CATEGORY_TO_PLACE_TYPES[selectedCategory] || [];
        if (types.length) performNearbySearch(originLocation.lat, originLocation.lng, types);
      } else {
        setResults([]);
      }
      return;
    }
    setSortBy('default');
    const timer = setTimeout(() => performTextSearch(trimmed), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">What do you want to do?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add activities to your planner — you can schedule them later
        </p>
      </div>

      {/* Wishlist chips */}
      {activities.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Your picks ({activities.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {activities.map(a => {
              const cat = findCategory(a.categoryId);
              return (
                <span
                  key={a.place.placeId}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
                >
                  {cat?.emoji} {a.place.name}
                  <button onClick={() => handleRemove(a.place.placeId)} className="ml-0.5 hover:opacity-70">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Search bar */}
      <form onSubmit={(e) => { e.preventDefault(); if (searchQuery.trim()) performTextSearch(searchQuery.trim()); }} className="mb-1">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={getCategorySearchPlaceholder(selectedCategory, destination || null)}
          className="h-9 text-sm"
          autoFocus
        />
      </form>

      {/* Category grid */}
      {!selectedCategory && !searchQuery.trim() && results.length === 0 && !loading && (
        <div className="grid grid-cols-3 gap-2">
          {EXPLORE_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => handleCategoryTap(cat.id)}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-border/50 p-3 transition-colors hover:bg-muted/50"
            >
              <span className="text-xl">{cat.emoji}</span>
              <span className="text-[11px] font-medium text-muted-foreground">{cat.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Back to categories */}
      {selectedCategory && (
        <button
          onClick={() => { setSelectedCategory(null); setResults([]); setSortBy('default'); }}
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> All categories
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Sort pills */}
      {!loading && results.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {([
            { id: 'default' as SortOption, label: 'Suggested' },
            { id: 'rating' as SortOption, label: '⭐ Rating' },
            { id: 'reviews' as SortOption, label: '🔥 Most reviewed' },
            { id: 'nearest' as SortOption, label: '📍 Nearest' },
          ] as const).map(opt => (
            <button
              key={opt.id}
              onClick={() => setSortBy(opt.id)}
              className={cn(
                'rounded-full px-3 py-1 text-[11px] font-medium border transition-colors whitespace-nowrap',
                sortBy === opt.id
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'text-muted-foreground border-border/50 hover:bg-muted'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {sortedResults.map(place => {
            const isAdded = activities.some(a => a.place.placeId === place.placeId);
            const cardCategoryId = selectedCategory || inferCategoryFromTypes(place.types);
            return (
              <ExploreCard
                key={place.placeId}
                place={place}
                categoryId={cardCategoryId}
                onAddToPlanner={() => handleAdd(place)}
                onTap={() => handleCardTap(place)}
                isInTrip={isAdded}
                isLoading={detailLoading === place.placeId}
              />
            );
          })}
        </div>
      )}

      {/* No results */}
      {!loading && results.length === 0 && searchQuery.trim() && (
        <p className="text-center text-sm text-muted-foreground py-4">
          No results for "{searchQuery}"
        </p>
      )}

      {/* Place detail drawer */}
      <Drawer
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setDetailReviews(null);
            setDetailPhotos([]);
            setDetailEditorialSummary(null);
          }
        }}
      >
        <DrawerContent className="max-h-[92vh]">
          <DrawerTitle className="sr-only">Place Details</DrawerTitle>
          {selectedPlace && (() => {
            const cardCategoryId = selectedCategory || inferCategoryFromTypes(selectedPlace.types);
            const { entry: tempEntry, option: tempOption } = buildTempEntry(selectedPlace, cardCategoryId, detailPhotos);
            const isAdded = activities.some(a => a.place.placeId === selectedPlace.placeId);
            return (
              <div className="overflow-y-auto">
                {!isAdded && (
                  <div className="px-4 pt-2 pb-1">
                    <Button
                      className="w-full"
                      onClick={() => {
                        handleAdd(selectedPlace);
                        setDetailOpen(false);
                      }}
                    >
                      <ClipboardList className="h-4 w-4 mr-1.5" />
                      Add to Planner
                    </Button>
                  </div>
                )}
                <PlaceOverview
                  entry={tempEntry}
                  option={tempOption}
                  context="explore"
                  isEditor={false}
                  onSaved={() => {}}
                  onClose={() => setDetailOpen(false)}
                  preloadedReviews={detailReviews}
                  preloadedEditorialSummary={detailEditorialSummary}
                />
              </div>
            );
          })()}
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default ActivitiesStep;

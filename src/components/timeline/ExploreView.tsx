import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, MapPin, Plus, Star, List, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { findCategory, type CategoryDef } from '@/lib/categories';
import { CATEGORY_TO_PLACE_TYPES, getCategorySearchPlaceholder } from '@/lib/placeTypeMapping';
import { cn } from '@/lib/utils';
import type { Trip, EntryWithOptions } from '@/types/trip';

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

const PRICE_LABELS: Record<string, string> = {
  PRICE_LEVEL_FREE: 'Free',
  PRICE_LEVEL_INEXPENSIVE: '€',
  PRICE_LEVEL_MODERATE: '€€',
  PRICE_LEVEL_EXPENSIVE: '€€€',
  PRICE_LEVEL_VERY_EXPENSIVE: '€€€€',
};

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
  const inputRef = useRef<HTMLInputElement>(null);
  const initialLoadDone = useRef(false);

  const cat: CategoryDef | undefined = categoryId ? findCategory(categoryId) : undefined;
  const destination = trip.destination || null;

  // Resolve origin
  useEffect(() => {
    if (!open) return;
    const fromEntries = resolveOrigin(entries);
    if (fromEntries) {
      setOriginLocation(fromEntries);
      setOriginResolved(true);
      return;
    }
    // Fallback: use trip destination via autocomplete
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
      // Reset state when opening
      setResults([]);
      setSearchQuery('');
      setLoading(false);
      initialLoadDone.current = false;
      setOriginResolved(false);
    }
  }, [open]);

  // Auto-load nearby search when category is set and origin resolved
  useEffect(() => {
    if (!open || !categoryId || !originResolved || initialLoadDone.current) return;
    if (searchQuery.trim()) return; // User already typing

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

  if (!open) return null;

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

          {!loading && results.map((place) => (
            <div
              key={place.placeId}
              className="flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors"
            >
              <div className="flex-1 min-w-0" onClick={() => onCardTap(place)}>
                <p className="text-sm font-medium truncate">{place.name}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{place.address}</p>
                <div className="flex items-center gap-2 mt-1">
                  {place.rating != null && (
                    <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {place.rating.toFixed(1)}
                      {place.userRatingCount != null && (
                        <span className="text-muted-foreground/60">({place.userRatingCount})</span>
                      )}
                    </span>
                  )}
                  {place.priceLevel && (
                    <span className="text-xs text-muted-foreground">
                      {PRICE_LABELS[place.priceLevel] || place.priceLevel}
                    </span>
                  )}
                </div>
              </div>
              {isEditor && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-primary hover:bg-primary/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToPlanner(place);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

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
    </div>
  );
};

export default ExploreView;

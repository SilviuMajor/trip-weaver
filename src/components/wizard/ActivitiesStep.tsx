import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { findCategory, PICKER_CATEGORIES } from '@/lib/categories';
import { CATEGORY_TO_PLACE_TYPES, getCategorySearchPlaceholder, inferCategoryFromTypes } from '@/lib/placeTypeMapping';
import ExploreCard from '@/components/timeline/ExploreCard';
import type { ExploreResult } from '@/components/timeline/ExploreView';

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

const ActivitiesStep = ({ activities, onChange, destination, originLat, originLng }: ActivitiesStepProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<ExploreResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [originLocation, setOriginLocation] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [originResolved, setOriginResolved] = useState(false);

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
      return;
    }
    setSelectedCategory(catId);
    setSearchQuery('');
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
          onClick={() => { setSelectedCategory(null); setResults([]); }}
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

      {/* Results */}
      {!loading && results.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {results.map(place => {
            const isAdded = activities.some(a => a.place.placeId === place.placeId);
            const cardCategoryId = selectedCategory || inferCategoryFromTypes(place.types);
            return (
              <ExploreCard
                key={place.placeId}
                place={place}
                categoryId={cardCategoryId}
                onAddToPlanner={() => handleAdd(place)}
                onTap={() => handleAdd(place)}
                isInTrip={isAdded}
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
    </div>
  );
};

export default ActivitiesStep;

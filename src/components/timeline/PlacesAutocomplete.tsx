import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export interface PlaceDetails {
  name: string;
  address: string;
  website: string | null;
  lat: number | null;
  lng: number | null;
  photos: string[];
}

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text?: string;
  };
}

interface PlacesAutocompleteProps {
  value: string;
  onChange: (name: string) => void;
  onPlaceSelect: (details: PlaceDetails) => void;
  placeholder?: string;
  tripLocation?: { lat: number; lng: number };
  autoFocus?: boolean;
}

const PlacesAutocomplete = ({ value, onChange, onPlaceSelect, placeholder, tripLocation, autoFocus }: PlacesAutocompleteProps) => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchPredictions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-places', {
        body: { action: 'autocomplete', query, location: tripLocation },
      });
      if (error) throw error;
      setPredictions(data?.predictions ?? []);
      setShowDropdown((data?.predictions ?? []).length > 0);
    } catch {
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }, [tripLocation]);

  const handleInputChange = (val: string) => {
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(val), 300);
  };

  const handleSelect = async (prediction: Prediction) => {
    setShowDropdown(false);
    setPredictions([]);
    onChange(prediction.structured_formatting.main_text);
    setFetchingDetails(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-places', {
        body: { action: 'details', placeId: prediction.place_id },
      });
      if (error) throw error;
      if (data) {
        onPlaceSelect({
          name: data.name,
          address: data.address,
          website: data.website,
          lat: data.lat,
          lng: data.lng,
          photos: data.photos ?? [],
        });
      }
    } catch (err) {
      console.error('Failed to fetch place details:', err);
    } finally {
      setFetchingDetails(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cleanup debounce
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowDropdown(false);
          }}
          onFocus={() => {
            if (predictions.length > 0) setShowDropdown(true);
          }}
        />
        {(loading || fetchingDetails) && (
          <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && predictions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
          {predictions.map((p) => (
            <button
              key={p.place_id}
              type="button"
              className="flex w-full flex-col px-3 py-2 text-left hover:bg-accent/50 transition-colors first:rounded-t-md last:rounded-b-md"
              onClick={() => handleSelect(p)}
            >
              <span className="text-sm font-medium">{p.structured_formatting.main_text}</span>
              {p.structured_formatting.secondary_text && (
                <span className="text-xs text-muted-foreground">{p.structured_formatting.secondary_text}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {fetchingDetails && (
        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Fetching place details…
        </p>
      )}
    </div>
  );
};

export default PlacesAutocomplete;

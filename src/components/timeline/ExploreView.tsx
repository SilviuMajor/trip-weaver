import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ArrowLeft, MapPin, ClipboardList, List, Map as MapIcon, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { findCategory, TRAVEL_MODES, PICKER_CATEGORIES, type CategoryDef } from '@/lib/categories';
import { CATEGORY_TO_PLACE_TYPES, getCategorySearchPlaceholder, inferCategoryFromTypes } from '@/lib/placeTypeMapping';
import { haversineKm } from '@/lib/distance';
import { cn } from '@/lib/utils';
import ExploreCard from './ExploreCard';
import PlaceOverview from './PlaceOverview';
import PlacesAutocomplete, { type PlaceDetails } from './PlacesAutocomplete';
import type { Trip, EntryWithOptions, EntryOption, GlobalPlace } from '@/types/trip';

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
  trip: Trip | null;
  entries: EntryWithOptions[];
  categoryId?: string | null;
  isEditor: boolean;
  onAddToPlanner: (place: ExploreResult) => void;
  onCardTap: (place: ExploreResult) => void;
  onAddManually: () => void;
  createContext?: { startTime?: string; endTime?: string } | null;
  onAddAtTime?: (place: ExploreResult, startTime: string, endTime: string) => void;
  initialOrigin?: { name: string; lat: number; lng: number } | null;
  embedded?: boolean;
  initialSearchQuery?: string | null;
}

// ─── Explore categories (exclude transport types) ───
const EXPLORE_CATEGORIES = PICKER_CATEGORIES.filter(
  c => !['flight', 'hotel', 'private_transfer', 'transfer', 'transport', 'airport_processing'].includes(c.id)
);

// ─── Helpers ───

function resolveOriginFromEntries(
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

function buildTempEntry(place: ExploreResult, tripId: string, categoryId: string | null, resolvedPhotoUrl: string | null, detailPhotos?: string[]): { entry: EntryWithOptions; option: EntryOption } {
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
    images: detailPhotos && detailPhotos.length > 0
      ? detailPhotos.map((url, i) => ({
          id: `temp-img-${i}`,
          option_id: fakeOptionId,
          image_url: url,
          sort_order: i,
          created_at: now,
        }))
      : resolvedPhotoUrl
        ? [{ id: 'temp', option_id: fakeOptionId, image_url: resolvedPhotoUrl, sort_order: 0, created_at: now }]
        : [],
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

// ─── Compact hours helper ───

const getCompactHours = (openingHours: string[] | null): { text: string | null; isClosed: boolean } => {
  if (!openingHours || openingHours.length === 0) return { text: null, isClosed: false };

  const now = new Date();
  const jsDay = now.getDay();
  const googleIndex = jsDay === 0 ? 6 : jsDay - 1;
  const dayHours = openingHours[googleIndex];

  if (!dayHours) return { text: null, isClosed: false };

  const lower = dayHours.toLowerCase();
  if (lower.includes('closed')) {
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return { text: `Closed ${dayNames[googleIndex]}`, isClosed: true };
  }
  if (lower.includes('open 24')) return { text: 'Open 24 hours', isClosed: false };

  const timeMatch = dayHours.match(/–\s*(\d{1,2}:\d{2}\s*[APap][Mm])/);
  if (timeMatch) return { text: `Open until ${timeMatch[1]}`, isClosed: false };

  return { text: dayHours.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday):\s*/i, ''), isClosed: false };
};

// ─── Component ───

const formatCreateTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
};

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
  createContext,
  onAddAtTime,
  initialOrigin,
  embedded = false,
  initialSearchQuery,
}: ExploreViewProps) => {
  const [results, setResults] = useState<ExploreResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [originLocation, setOriginLocation] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [originResolved, setOriginResolved] = useState(false);
  const [addedPlaceIds, setAddedPlaceIds] = useState<Set<string>>(new Set());
  const [selectedPlace, setSelectedPlace] = useState<ExploreResult | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [travelMode, setTravelMode] = useState('walk');
  const [travelTimes, setTravelTimes] = useState<Map<string, number>>(new Map());
  const [originPopoverOpen, setOriginPopoverOpen] = useState(false);
  const [originSearchQuery, setOriginSearchQuery] = useState('');
  const [crossTripMatches, setCrossTripMatches] = useState<Map<string, string>>(new Map());
  const [selectedPriceLevels, setSelectedPriceLevels] = useState<string[]>([]);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [maxTravelMinutes, setMaxTravelMinutes] = useState<number | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualLocationQuery, setManualLocationQuery] = useState('');
  const [manualPlaceDetails, setManualPlaceDetails] = useState<PlaceDetails | null>(null);
  const [yourPlaces, setYourPlaces] = useState<GlobalPlace[]>([]);
  const [canLoadMore, setCanLoadMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [detailReviews, setDetailReviews] = useState<any[] | null>(null);
  const [detailPhotos, setDetailPhotos] = useState<string[]>([]);
  // Multi-select categories
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    if (categoryId) return [categoryId];
    return EXPLORE_CATEGORIES.map(c => c.id);
  });
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const originManuallySet = useRef(false);
  const fetchAbortRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialLoadDone = useRef(false);
  const textSearchRadiusRef = useRef(10000);
  const isMobile = useIsMobile();
  const { adminUser } = useAdminAuth();

  const destination = trip?.destination || null;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const originLat = originLocation?.lat;
  const originLng = originLocation?.lng;

  // Derive header title
  const headerTitle = useMemo(() => {
    if (selectedCategories.length === 1) {
      const cat = findCategory(selectedCategories[0]);
      return cat ? `${cat.emoji} ${cat.name}` : '🔍 Explore';
    }
    return '🔍 Explore';
  }, [selectedCategories]);

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

  // Today's entries for quick picks
  const todayEntries = useMemo(() => {
    return entries.filter(e => {
      const opt = e.options[0];
      if (!opt?.latitude || !opt?.longitude) return false;
      if (opt.category === 'airport_processing' || opt.category === 'transport' || opt.category === 'transfer') return false;
      return e.is_scheduled !== false;
    }).slice(0, 8);
  }, [entries]);

  // Combined place types from selected categories
  const combinedTypes = useMemo(() => {
    const types = new Set<string>();
    for (const catId of selectedCategories) {
      const catTypes = CATEGORY_TO_PLACE_TYPES[catId];
      if (catTypes) catTypes.forEach(t => types.add(t));
    }
    return [...types];
  }, [selectedCategories]);

  // Apply initial search query from parent
  useEffect(() => {
    if (initialSearchQuery && open) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery, open]);

  // Resolve origin
  useEffect(() => {
    if (!open) return;
    if (originManuallySet.current) return;
    if (initialOrigin) {
      setOriginLocation(initialOrigin);
      setOriginResolved(true);
      return;
    }
    const fromEntries = resolveOriginFromEntries(entries);
    if (fromEntries) {
      setOriginLocation(fromEntries);
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
  }, [open, entries, destination, initialOrigin]);

  // Auto-focus search input + reset on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setResults([]);
      setSearchQuery('');
      setLoading(false);
      setAddedPlaceIds(new Set());
      setSelectedPriceLevels([]);
      setMinRating(null);
      setMaxTravelMinutes(null);
      setCanLoadMore(false);
      initialLoadDone.current = false;
      textSearchRadiusRef.current = 10000;
      
      // Reset categories from prop
      if (categoryId) {
        setSelectedCategories([categoryId]);
      } else {
        setSelectedCategories(EXPLORE_CATEGORIES.map(c => c.id));
      }
      
      originManuallySet.current = false;
      setCrossTripMatches(new Map());
      setManualName('');
      setManualLocationQuery('');
      setManualPlaceDetails(null);
    }
  }, [open, categoryId]);

  // Fetch user's nearby global places
  const globalToExploreResult = useCallback((p: GlobalPlace): ExploreResult => ({
    placeId: p.google_place_id || p.id,
    name: p.name,
    address: p.address || '',
    lat: p.latitude ? Number(p.latitude) : null,
    lng: p.longitude ? Number(p.longitude) : null,
    rating: p.rating ? Number(p.rating) : null,
    userRatingCount: null,
    priceLevel: p.price_level,
    openingHours: p.opening_hours as string[] | null,
    types: [],
    googleMapsUri: null,
    website: p.website,
    phone: p.phone,
    photoRef: null,
  }), []);

  useEffect(() => {
    if (!open || !originLocation || !adminUser) { setYourPlaces([]); return; }
    (async () => {
      const { data } = await supabase
        .from('global_places')
        .select('*')
        .eq('user_id', adminUser.id);
      if (!data) return;
      const nearby = data.filter(p => {
        if (!p.latitude || !p.longitude) return false;
        if (haversineKm(originLocation.lat, originLocation.lng, Number(p.latitude), Number(p.longitude)) > 10) return false;
        // Filter by selected categories if only one selected
        if (selectedCategories.length === 1 && p.category !== selectedCategories[0]) return false;
        return true;
      });
      setYourPlaces(nearby as unknown as GlobalPlace[]);
    })();
  }, [open, originLocation, selectedCategories, adminUser]);

  // Auto-load nearby search when origin resolved and categories selected
  useEffect(() => {
    if (!open || !originResolved || initialLoadDone.current) return;
    if (searchQuery.trim()) return;
    if (combinedTypes.length === 0 || !originLocation) {
      initialLoadDone.current = true;
      return;
    }

    initialLoadDone.current = true;
    performNearbySearch(originLocation.lat, originLocation.lng, combinedTypes);
  }, [open, originResolved, originLocation, searchQuery, combinedTypes]);

  // Debounced text search — also reload nearby when search cleared
  useEffect(() => {
    if (!open) return;
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      // Search cleared — reload nearby if we had results before
      if (initialLoadDone.current && originLocation && combinedTypes.length > 0) {
        initialLoadDone.current = false;
        setTravelTimes(new Map());
        setCanLoadMore(false);
        // The auto-load effect above will re-trigger
      }
      return;
    }
    const timer = setTimeout(() => {
      performTextSearch(trimmed);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, open]);

  // Pre-fill manual name when zero results
  useEffect(() => {
    if (results.length === 0 && searchQuery) {
      setManualName(searchQuery);
    }
  }, [results, searchQuery]);

  // Fetch cross-trip matches after results load
  useEffect(() => {
    if (results.length === 0) { setCrossTripMatches(new Map()); return; }
    const placeIds = results.map(r => r.placeId).filter(Boolean);
    if (placeIds.length === 0) return;

    (async () => {
      try {
        const { data: matchingOptions } = await supabase
          .from('entry_options')
          .select('google_place_id, entry_id')
          .in('google_place_id', placeIds);

        if (!matchingOptions?.length) return;

        const entryIds = matchingOptions.map(o => o.entry_id);
        const { data: matchingEntries } = await supabase
          .from('entries')
          .select('id, trip_id')
          .in('id', entryIds)
          .neq('trip_id', trip?.id ?? '__none__');

        if (!matchingEntries?.length) return;

        const tripIds = [...new Set(matchingEntries.map(e => e.trip_id))];
        const { data: tripNames } = await supabase
          .from('trips')
          .select('id, name')
          .in('id', tripIds);

        if (!tripNames?.length) return;

        const tripNameMap = new Map(tripNames.map(t => [t.id, t.name]));
        const entryTripMap = new Map(matchingEntries.map(e => [e.id, e.trip_id]));

        const crossMap = new Map<string, string>();
        for (const opt of matchingOptions) {
          if (!opt.google_place_id) continue;
          const tId = entryTripMap.get(opt.entry_id);
          if (tId) {
            const name = tripNameMap.get(tId);
            if (name) crossMap.set(opt.google_place_id, name);
          }
        }
        setCrossTripMatches(crossMap);
      } catch {
        // Non-critical, silently ignore
      }
    })();
  }, [results, trip?.id]);

  const performNearbySearch = useCallback(async (lat: number, lng: number, types: string[]) => {
    setLoading(true);
    setCanLoadMore(false);
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

  const performTextSearch = useCallback(async (query: string, radius?: number) => {
    setLoading(true);
    setTravelTimes(new Map());
    setCanLoadMore(false);
    textSearchRadiusRef.current = radius || 10000;
    try {
      const body: any = { action: 'textSearch', query, radius: textSearchRadiusRef.current };
      if (originLocation) {
        body.latitude = originLocation.lat;
        body.longitude = originLocation.lng;
      }
      // Only pass types for single-category selection
      if (selectedCategories.length === 1) {
        const types = CATEGORY_TO_PLACE_TYPES[selectedCategories[0]];
        if (types?.length) body.types = types;
      }
      const { data, error } = await supabase.functions.invoke('google-places', { body });
      if (error) throw error;
      const newResults = data?.results ?? [];
      setResults(newResults);
      setCanLoadMore(newResults.length >= 20);
    } catch (err: any) {
      console.error('Text search failed:', err);
      toast({ title: 'Search failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [originLocation, selectedCategories]);

  const handleLoadMore = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setLoadingMore(true);
    const newRadius = textSearchRadiusRef.current * 2;
    textSearchRadiusRef.current = newRadius;
    try {
      const body: any = { action: 'textSearch', query: searchQuery.trim(), radius: newRadius };
      if (originLocation) {
        body.latitude = originLocation.lat;
        body.longitude = originLocation.lng;
      }
      if (selectedCategories.length === 1) {
        const types = CATEGORY_TO_PLACE_TYPES[selectedCategories[0]];
        if (types?.length) body.types = types;
      }
      const { data, error } = await supabase.functions.invoke('google-places', { body });
      if (error) throw error;
      const moreResults = data?.results ?? [];
      // Merge and deduplicate
      setResults(prev => {
        const existingIds = new Set(prev.map(r => r.placeId));
        const unique = moreResults.filter((r: ExploreResult) => !existingIds.has(r.placeId));
        return [...prev, ...unique];
      });
      setCanLoadMore(moreResults.length >= 20);
    } catch (err: any) {
      console.error('Load more failed:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [searchQuery, originLocation, selectedCategories]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) performTextSearch(searchQuery.trim());
  };

  const handleAdd = useCallback((place: ExploreResult) => {
    setAddedPlaceIds(prev => new Set(prev).add(place.placeId));
    toast({ title: `Added ${place.name} to Planner` });

    Promise.resolve(onAddToPlanner(place)).catch(() => {
      setAddedPlaceIds(prev => {
        const next = new Set(prev);
        next.delete(place.placeId);
        return next;
      });
      toast({ title: `Failed to add ${place.name}`, description: 'Please try again', variant: 'destructive' });
    });
  }, [onAddToPlanner]);

  const handleCardTap = useCallback(async (place: ExploreResult) => {
    setDetailLoading(place.placeId);
    try {
      const { data: details } = await supabase.functions.invoke('google-places', {
        body: { action: 'details', placeId: place.placeId },
      });
      setDetailPhotos(details?.photos ?? []);
      setDetailReviews(details?.reviews ?? []);
      // Enrich place with details data
      if (details?.website) place.website = details.website;
      if (details?.phone) place.phone = details.phone;
      setSelectedPlace(place);
      setDetailOpen(true);
    } catch (err) {
      console.error('Failed to fetch place details:', err);
      setDetailPhotos([]);
      setDetailReviews(null);
      setSelectedPlace(place);
      setDetailOpen(true);
    } finally {
      setDetailLoading(null);
    }
  }, []);

  const handleOriginChange = useCallback((name: string, lat: number, lng: number) => {
    originManuallySet.current = true;
    setOriginLocation({ name, lat, lng });
    setOriginPopoverOpen(false);
    setOriginSearchQuery('');
    initialLoadDone.current = false;
    setOriginResolved(true);
  }, []);

  // Handle category toggle
  const handleCategoryToggle = useCallback((catId: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(catId)) {
        if (prev.length <= 1) return prev; // Keep at least one
        return prev.filter(c => c !== catId);
      }
      return [...prev, catId];
    });
    // Re-trigger nearby search
    initialLoadDone.current = false;
    setResults([]);
    setTravelTimes(new Map());
  }, []);

  const handleSelectAllCategories = useCallback(() => {
    setSelectedCategories(EXPLORE_CATEGORIES.map(c => c.id));
    initialLoadDone.current = false;
    setResults([]);
    setTravelTimes(new Map());
  }, []);

  const handleManualAdd = useCallback(() => {
    if (!manualName.trim()) return;
    const syntheticPlace: ExploreResult = {
      placeId: manualPlaceDetails?.placeId || `manual-${Date.now()}`,
      name: manualName,
      address: manualPlaceDetails?.address || '',
      lat: manualPlaceDetails?.lat || null,
      lng: manualPlaceDetails?.lng || null,
      rating: manualPlaceDetails?.rating || null,
      userRatingCount: manualPlaceDetails?.userRatingCount || null,
      priceLevel: manualPlaceDetails?.priceLevel || null,
      openingHours: manualPlaceDetails?.openingHours || null,
      types: [],
      googleMapsUri: manualPlaceDetails?.googleMapsUri || null,
      website: manualPlaceDetails?.website || null,
      phone: manualPlaceDetails?.phone || null,
      photoRef: null,
    };
    onAddToPlanner(syntheticPlace);
    toast({ title: 'Added to planner', description: manualName });
    setManualName('');
    setManualLocationQuery('');
    setManualPlaceDetails(null);
  }, [manualName, manualPlaceDetails, onAddToPlanner]);

  // ─── Travel time fetching ───

  const MODE_SHORT_LABELS: Record<string, string> = { walk: 'Walk', transit: 'Transit', drive: 'Drive', cycle: 'Cycle' };

  const fetchTravelTimes = useCallback(async (
    resultsList: ExploreResult[],
    origin: { lat: number; lng: number },
    mode: string,
    generation: number,
  ) => {
    const times = new Map<string, number>();
    const batchSize = 5;

    for (let i = 0; i < resultsList.length; i += batchSize) {
      if (fetchAbortRef.current !== generation) return;
      const batch = resultsList.slice(i, i + batchSize);
      await Promise.all(batch.map(async (result) => {
        if (!result.lat || !result.lng) return;
        try {
          const { data } = await supabase.functions.invoke('google-directions', {
            body: {
              fromAddress: `${origin.lat},${origin.lng}`,
              toAddress: `${result.lat},${result.lng}`,
              mode,
            },
          });
          if (data?.duration_min != null) {
            times.set(result.placeId, Math.round(data.duration_min));
          }
        } catch (err) {
          console.error('Travel time fetch failed for', result.name, err);
        }
      }));
      if (fetchAbortRef.current !== generation) return;
      setTravelTimes(new Map(times));
      if (i + batchSize < resultsList.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }, []);

  // Trigger travel time fetch
  useEffect(() => {
    if (!originLocation || results.length === 0) return;
    setTravelTimes(new Map());
    const generation = ++fetchAbortRef.current;
    fetchTravelTimes(results, originLocation, travelMode, generation);
  }, [results, travelMode, originLocation, fetchTravelTimes]);

  // Sort results by travel time + push closed to bottom
  const filteredResults = useMemo(() => {
    return results.filter(place => {
      if (selectedPriceLevels.length > 0 && selectedPriceLevels.length < 4) {
        if (!place.priceLevel || !selectedPriceLevels.includes(place.priceLevel)) return false;
      }
      if (minRating !== null) {
        if (!place.rating || place.rating < minRating) return false;
      }
      if (maxTravelMinutes !== null) {
        const time = travelTimes.get(place.placeId);
        if (time == null || time > maxTravelMinutes) return false;
      }
      return true;
    });
  }, [results, selectedPriceLevels, minRating, maxTravelMinutes, travelTimes]);

  const sortedResults = useMemo(() => {
    let sorted = [...filteredResults];

    if (travelTimes.size > 0) {
      sorted.sort((a, b) => {
        const timeA = travelTimes.get(a.placeId) ?? 9999;
        const timeB = travelTimes.get(b.placeId) ?? 9999;
        return timeA - timeB;
      });
    }

    // Stable sort: push closed venues to bottom
    sorted.sort((a, b) => {
      const aHours = getCompactHours(a.openingHours);
      const bHours = getCompactHours(b.openingHours);
      if (aHours.isClosed && !bHours.isClosed) return 1;
      if (!aHours.isClosed && bHours.isClosed) return -1;
      return 0;
    });

    return sorted;
  }, [filteredResults, travelTimes]);

  // Build map image URL with multi-marker support
  const mapImageUrl = useMemo(() => {
    if (viewMode !== 'map') return null;
    const markers: { lat: number; lng: number; color: string }[] = [];

    // Blue: scheduled entries with coordinates
    entries.forEach(entry => {
      const opt = entry.options[0];
      if (opt?.latitude && opt?.longitude && entry.is_scheduled) {
        markers.push({ lat: opt.latitude, lng: opt.longitude, color: '0x4285F4' });
      }
    });

    // Gold: explore results
    sortedResults.forEach(result => {
      if (result.lat && result.lng) {
        markers.push({ lat: result.lat, lng: result.lng, color: '0xFFD700' });
      }
    });

    if (markers.length === 0) return null;
    const markersParam = encodeURIComponent(JSON.stringify(markers));
    const center = originLat && originLng ? `${originLat},${originLng}` : `${markers[0].lat},${markers[0].lng}`;
    return `${supabaseUrl}/functions/v1/static-map?center=${center}&zoom=14&size=800x600&markers=${markersParam}`;
  }, [viewMode, originLat, originLng, entries, sortedResults, supabaseUrl]);

  if (!open) return null;

  // Determine if multi-category mode (for card category inference)
  const isMultiCategory = selectedCategories.length !== 1;

  // Detail sheet content
  const detailContent = selectedPlace ? (() => {
    const inferredCat = isMultiCategory ? inferCategoryFromTypes(selectedPlace.types) : selectedCategories[0];
    const { entry: tempEntry, option: tempOption } = buildTempEntry(selectedPlace, trip?.id || 'global', inferredCat ?? null, selectedPlace.photoUrl ?? null, detailPhotos);
    const placeIsInTrip = existingPlaceIds.has(selectedPlace.placeId) || addedPlaceIds.has(selectedPlace.placeId);
    return (
      <div className="overflow-y-auto max-h-[85vh]">
        {isEditor && !placeIsInTrip && (
          <div className="px-4 pt-3 pb-1 space-y-2">
            {createContext?.startTime ? (
              <>
                <Button
                  className="w-full gap-2"
                  onClick={() => {
                    onAddAtTime?.(selectedPlace, createContext.startTime!, createContext.endTime!);
                    setDetailOpen(false);
                  }}
                >
                  <ClipboardList className="h-4 w-4" />
                  Add at {formatCreateTime(createContext.startTime)}
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    handleAdd(selectedPlace);
                    setDetailOpen(false);
                  }}
                >
                  Add to Planner instead
                </Button>
              </>
            ) : (
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
            )}
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
          preloadedReviews={detailReviews}
        />
      </div>
    );
  })() : null;

  return (
    <div className={embedded ? "flex flex-col h-full" : "fixed inset-0 z-50 flex flex-col bg-background"}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold truncate">
            {headerTitle}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className={cn('h-7 w-7', viewMode !== 'list' && 'text-muted-foreground')}
            onClick={() => setViewMode('list')}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === 'map' ? 'secondary' : 'ghost'}
            size="icon"
            className={cn('h-7 w-7', viewMode !== 'map' && 'text-muted-foreground')}
            onClick={() => setViewMode('map')}
          >
            <MapIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearchSubmit} className="border-b px-3 py-2">
        <Input
          ref={inputRef}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={getCategorySearchPlaceholder(selectedCategories.length === 1 ? selectedCategories[0] : null, destination)}
          className="h-9 text-sm"
        />
      </form>

      {/* Origin context — tappable popover */}
      {originLocation && (
        <Popover open={originPopoverOpen} onOpenChange={setOriginPopoverOpen}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">
                Suggested near <span className="underline decoration-dashed underline-offset-2 cursor-pointer font-medium">{originLocation.name}</span>
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            <PlacesAutocomplete
              value={originSearchQuery}
              onChange={setOriginSearchQuery}
              onPlaceSelect={(details) => {
                if (details.lat != null && details.lng != null) {
                  handleOriginChange(details.name, details.lat, details.lng);
                }
              }}
              placeholder="Search for a location..."
              tripLocation={originLocation ? { lat: originLocation.lat, lng: originLocation.lng } : undefined}
              autoFocus
            />
            {todayEntries.length > 0 && (
              <div className="mt-3 border-t pt-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Today's entries</p>
                <div className="space-y-0.5 max-h-40 overflow-y-auto">
                  {todayEntries.map(entry => {
                    const opt = entry.options[0];
                    if (!opt?.latitude || !opt?.longitude) return null;
                    return (
                      <button
                        key={entry.id}
                        className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs hover:bg-accent/50 transition-colors text-left"
                        onClick={() => handleOriginChange(opt.name, opt.latitude!, opt.longitude!)}
                      >
                        <span>{findCategory(opt.category)?.emoji ?? '📌'}</span>
                        <span className="truncate">{opt.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}

      {/* Travel mode pills */}
      {originLocation && (
        <div className="flex items-center gap-1.5 px-4 py-1 overflow-x-auto">
          {TRAVEL_MODES.map((mode) => (
            <button
              key={mode.id}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium border transition-colors whitespace-nowrap',
                travelMode === mode.id
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted'
              )}
              onClick={() => setTravelMode(mode.id)}
            >
              {mode.emoji} {MODE_SHORT_LABELS[mode.id] ?? mode.label}
            </button>
          ))}
        </div>
      )}

      {/* Filter chips */}
      <div className="flex items-center gap-1.5 px-4 py-1 overflow-x-auto">
        {/* Category filter chip */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'rounded-full px-3 py-1 text-[11px] font-medium border transition-colors whitespace-nowrap',
                selectedCategories.length < EXPLORE_CATEGORIES.length
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'text-muted-foreground border-border/50'
              )}
            >
              {selectedCategories.length === 1
                ? `${findCategory(selectedCategories[0])?.emoji ?? '📌'} ${findCategory(selectedCategories[0])?.name ?? 'Category'}`
                : selectedCategories.length === EXPLORE_CATEGORIES.length
                  ? 'Category'
                  : `${selectedCategories.length} categories`}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1">
              <button
                className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs hover:bg-accent/50 transition-colors text-left font-medium"
                onClick={handleSelectAllCategories}
              >
                <Check className={cn('h-3.5 w-3.5', selectedCategories.length === EXPLORE_CATEGORIES.length ? 'text-primary' : 'text-transparent')} />
                All categories
              </button>
              <div className="border-t my-1" />
              {EXPLORE_CATEGORIES.map(cat => {
                const isSelected = selectedCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs hover:bg-accent/50 transition-colors text-left"
                    onClick={() => handleCategoryToggle(cat.id)}
                  >
                    <Check className={cn('h-3.5 w-3.5', isSelected ? 'text-primary' : 'text-transparent')} />
                    <span>{cat.emoji}</span>
                    <span className="truncate">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* Price filter */}
        {results.length > 0 && (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    'rounded-full px-3 py-1 text-[11px] font-medium border transition-colors whitespace-nowrap',
                    selectedPriceLevels.length > 0 && selectedPriceLevels.length < 4
                      ? 'bg-primary/10 text-primary border-primary/20'
                      : 'text-muted-foreground border-border/50'
                  )}
                >
                  {selectedPriceLevels.length > 0 && selectedPriceLevels.length < 4
                    ? selectedPriceLevels.map(p => {
                        if (p === 'PRICE_LEVEL_INEXPENSIVE') return '€';
                        if (p === 'PRICE_LEVEL_MODERATE') return '€€';
                        if (p === 'PRICE_LEVEL_EXPENSIVE') return '€€€';
                        return '€€€€';
                      }).join('–')
                    : 'Price'}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="flex gap-1">
                  {([
                    { value: 'PRICE_LEVEL_INEXPENSIVE', label: '€' },
                    { value: 'PRICE_LEVEL_MODERATE', label: '€€' },
                    { value: 'PRICE_LEVEL_EXPENSIVE', label: '€€€' },
                    { value: 'PRICE_LEVEL_VERY_EXPENSIVE', label: '€€€€' },
                  ] as const).map(({ value, label }) => {
                    const isSelected = selectedPriceLevels.includes(value);
                    return (
                      <button
                        key={value}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors',
                          isSelected
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : 'text-muted-foreground border-border/50 hover:bg-muted'
                        )}
                        onClick={() => {
                          setSelectedPriceLevels(prev =>
                            isSelected ? prev.filter(v => v !== value) : [...prev, value]
                          );
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            {/* Rating filter */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    'rounded-full px-3 py-1 text-[11px] font-medium border transition-colors whitespace-nowrap',
                    minRating !== null
                      ? 'bg-primary/10 text-primary border-primary/20'
                      : 'text-muted-foreground border-border/50'
                  )}
                >
                  {minRating !== null ? `${minRating}+` : 'Rating'}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="flex gap-1">
                  {([
                    { value: 4.5, label: '4.5+' },
                    { value: 4.0, label: '4.0+' },
                    { value: 3.5, label: '3.5+' },
                    { value: null as number | null, label: 'Any' },
                  ]).map(({ value, label }) => (
                    <button
                      key={label}
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors',
                        minRating === value
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'text-muted-foreground border-border/50 hover:bg-muted'
                      )}
                      onClick={() => setMinRating(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Distance filter */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    'rounded-full px-3 py-1 text-[11px] font-medium border transition-colors whitespace-nowrap',
                    maxTravelMinutes !== null
                      ? 'bg-primary/10 text-primary border-primary/20'
                      : 'text-muted-foreground border-border/50'
                  )}
                >
                  {maxTravelMinutes !== null ? `Under ${maxTravelMinutes}m` : 'Distance'}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="flex gap-1">
                  {([
                    { value: 10, label: 'Under 10m' },
                    { value: 15, label: 'Under 15m' },
                    { value: 30, label: 'Under 30m' },
                    { value: null as number | null, label: 'Any' },
                  ]).map(({ value, label }) => (
                    <button
                      key={label}
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors',
                        maxTravelMinutes === value
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'text-muted-foreground border-border/50 hover:bg-muted'
                      )}
                      onClick={() => setMaxTravelMinutes(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </>
        )}
      </div>

      {/* Result count */}
      {!loading && results.length > 0 && (
        <div className="px-4 pb-1">
          <span className="text-[11px] text-muted-foreground">
            {filteredResults.length === results.length
              ? `${results.length} results`
              : `${filteredResults.length} of ${results.length} results`}
          </span>
        </div>
      )}

      {/* Results — Map or List */}
      {viewMode === 'map' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Map image */}
          <div className="relative w-full flex-1 min-h-[250px] bg-muted">
            {mapImageUrl ? (
              <img src={mapImageUrl} alt="Map" className="w-full h-full object-cover" />
            ) : loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                No results to show on map
              </div>
            )}
            {/* Legend */}
            <div className="absolute bottom-2 left-2 flex gap-2 text-[10px] bg-background/80 backdrop-blur-sm rounded-md px-2 py-1">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Your plans</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> Suggestions</span>
            </div>
          </div>
          {/* Horizontal card scroll */}
          <div className="border-t border-border">
            <div className="flex gap-2 overflow-x-auto p-3 scrollbar-hide">
              {sortedResults.map(place => {
                const inTrip = existingPlaceIds.has(place.placeId) || addedPlaceIds.has(place.placeId);
                const minutes = travelTimes.get(place.placeId);
                const modeEmoji = TRAVEL_MODES.find(m => m.id === travelMode)?.emoji ?? '🚶';
                const travelTimeStr = minutes != null ? `${modeEmoji} ${minutes}m` : undefined;
                const cardCategoryId = isMultiCategory ? inferCategoryFromTypes(place.types) : selectedCategories[0];
                return (
                  <div key={place.placeId} className="w-[200px] shrink-0">
                    <ExploreCard
                      place={place}
                      categoryId={cardCategoryId}
                      onAddToPlanner={() => handleAdd(place)}
                      onTap={() => handleCardTap(place)}
                      isInTrip={inTrip}
                      travelTime={travelTimeStr ?? null}
                      isLoading={detailLoading === place.placeId}
                    />
                  </div>
                );
              })}
            </div>
            {/* Load more + add manually */}
            <div className="px-3 pb-2 space-y-1">
              {canLoadMore && (
                <button
                  className="w-full py-2 text-sm text-primary hover:underline disabled:opacity-50"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading more...' : 'Load more results'}
                </button>
              )}
              {results.length > 0 && (
                <button
                  className="w-full py-2 text-sm text-primary hover:underline"
                  onClick={onAddManually}
                >
                  Can't find it? Add manually →
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="px-3 py-2 space-y-2">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}

            {/* Zero results inline form */}
            {!loading && results.length === 0 && searchQuery.trim() && (
              <div className="py-6 px-1">
                <div className="text-center mb-4">
                  <p className="text-sm font-medium">No results for "{searchQuery}"</p>
                  <p className="text-xs text-muted-foreground mt-1">Add it manually instead:</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
                    <Input
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="Place name"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Location</label>
                    <PlacesAutocomplete
                      value={manualLocationQuery}
                      onChange={setManualLocationQuery}
                      onPlaceSelect={(details) => {
                        setManualPlaceDetails(details);
                        setManualLocationQuery(details.name);
                      }}
                      placeholder="Search for address..."
                      tripLocation={originLocation ? { lat: originLocation.lat, lng: originLocation.lng } : undefined}
                    />
                  </div>
                  <Button
                    className="w-full gap-2"
                    onClick={handleManualAdd}
                    disabled={!manualName.trim()}
                  >
                    <Plus className="h-4 w-4" />
                    Add to Planner
                  </Button>
                </div>
                <button
                  className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={onAddManually}
                >
                  Or open the full entry form →
                </button>
              </div>
            )}

            {!loading && results.length === 0 && !searchQuery.trim() && initialLoadDone.current && (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">No places found nearby</p>
              </div>
            )}

            {yourPlaces.length > 0 && !loading && (
              <div className="mb-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                  From your places
                </p>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                  {yourPlaces.map(place => {
                    const asExplore = globalToExploreResult(place);
                    const inTrip = existingPlaceIds.has(asExplore.placeId) || addedPlaceIds.has(asExplore.placeId);
                    return (
                      <div key={place.id} className="shrink-0" style={{ width: 200 }}>
                        <ExploreCard
                          place={asExplore}
                          categoryId={place.category}
                          onAddToPlanner={() => handleAdd(asExplore)}
                          onTap={() => handleCardTap(asExplore)}
                          isInTrip={inTrip}
                          isLoading={detailLoading === asExplore.placeId}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!loading && sortedResults.map((place) => {
              const inTrip = existingPlaceIds.has(place.placeId) || addedPlaceIds.has(place.placeId);
              const minutes = travelTimes.get(place.placeId);
              const modeEmoji = TRAVEL_MODES.find(m => m.id === travelMode)?.emoji ?? '🚶';
              const travelTimeStr = minutes != null ? `${modeEmoji} ${minutes}m` : undefined;
              const travelTimeLoading = !!originLocation && minutes == null && results.length > 0;
              const hours = getCompactHours(place.openingHours);
              const cardCategoryId = isMultiCategory ? inferCategoryFromTypes(place.types) : selectedCategories[0];
              return (
                <ExploreCard
                  key={place.placeId}
                  place={place}
                  categoryId={cardCategoryId}
                  onAddToPlanner={() => handleAdd(place)}
                  onTap={() => handleCardTap(place)}
                  isInTrip={inTrip}
                  travelTime={travelTimeStr ?? null}
                  travelTimeLoading={travelTimeLoading}
                  compactHours={hours.text}
                  crossTripName={crossTripMatches.get(place.placeId) || null}
                  isLoading={detailLoading === place.placeId}
                />
              );
            })}

            {/* Load more button */}
            {!loading && canLoadMore && (
              <button
                className="w-full py-3 text-sm text-primary hover:underline disabled:opacity-50"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading more...' : 'Load more results'}
              </button>
            )}

            {/* Add manually link */}
            {!loading && results.length > 0 && (
              <button
                className="w-full py-3 text-sm text-primary hover:underline"
                onClick={onAddManually}
              >
                Can't find it? Add manually →
              </button>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Detail sheet */}
      {isMobile ? (
        <Drawer open={detailOpen} onOpenChange={(open) => { setDetailOpen(open); if (!open) { setDetailReviews(null); setDetailPhotos([]); } }}>
          <DrawerContent className="max-h-[92vh]">
            <DrawerTitle className="sr-only">Place Details</DrawerTitle>
            {detailContent}
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={detailOpen} onOpenChange={(open) => { setDetailOpen(open); if (!open) { setDetailReviews(null); setDetailPhotos([]); } }}>
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

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Star, Loader2, ChevronRight, MapPin, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { toast } from '@/hooks/use-toast';
import { findCategory } from '@/lib/categories';
import { inferCategoryFromTypes } from '@/lib/placeTypeMapping';
import PlaceOverview from '@/components/timeline/PlaceOverview';
import SidebarEntryCard from '@/components/timeline/SidebarEntryCard';
import ExploreView, { type ExploreResult } from '@/components/timeline/ExploreView';
import type { GlobalPlace, EntryWithOptions, EntryOption } from '@/types/trip';

type StatusFilter = 'all' | 'visited' | 'want_to_go';

const SKIP_CATEGORIES = ['flight', 'hotel', 'transfer', 'transport', 'airport_processing'];

const extractCityCountry = (address: string | null): { city: string | null; country: string | null } => {
  if (!address) return { city: null, country: null };
  const parts = address.split(',').map(s => s.trim());
  if (parts.length >= 3) {
    const cityPart = parts[parts.length - 2];
    const city = cityPart.replace(/^\d{4,6}\s*[A-Z]{0,2}\s*/, '').trim();
    const country = parts[parts.length - 1].trim();
    return { city: city || null, country: country || null };
  }
  if (parts.length === 2) {
    return { city: parts[0], country: parts[1] };
  }
  return { city: null, country: null };
};

const buildTempEntry = (place: GlobalPlace): { entry: EntryWithOptions; option: EntryOption } => {
  const option: EntryOption = {
    id: place.id,
    entry_id: place.id,
    name: place.name,
    category: place.category,
    category_color: findCategory(place.category)?.color ?? null,
    latitude: place.latitude,
    longitude: place.longitude,
    location_name: place.address,
    website: place.website,
    phone: place.phone,
    address: place.address,
    rating: place.rating,
    user_rating_count: null,
    opening_hours: place.opening_hours,
    google_place_id: place.google_place_id,
    google_maps_uri: null,
    price_level: place.price_level,
    departure_location: null,
    arrival_location: null,
    departure_tz: null,
    arrival_tz: null,
    departure_terminal: null,
    arrival_terminal: null,
    airport_checkin_hours: null,
    airport_checkout_min: null,
    estimated_budget: null,
    actual_cost: null,
    created_at: place.created_at,
    updated_at: place.updated_at,
    images: [],
  };

  const entry: EntryWithOptions = {
    id: place.id,
    trip_id: place.source_trip_id ?? '',
    start_time: new Date().toISOString(),
    end_time: new Date(Date.now() + 3600000).toISOString(),
    is_locked: false,
    is_scheduled: false,
    scheduled_day: null,
    option_group_id: null,
    linked_flight_id: null,
    linked_type: null,
    from_entry_id: null,
    to_entry_id: null,
    created_at: place.created_at,
    updated_at: place.updated_at,
    options: [option],
  };

  return { entry, option };
};

const GlobalPlanner = () => {
  const navigate = useNavigate();
  const { adminUser, isAdmin, loading: authLoading } = useAdminAuth();
  const [places, setPlaces] = useState<GlobalPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedPlace, setSelectedPlace] = useState<GlobalPlace | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [cityExploreOpen, setCityExploreOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate('/auth');
  }, [authLoading, isAdmin, navigate]);

  // Bug 6 fix: Only use direct query from entries/entry_options, no sync
  const fetchDirectPlaces = useCallback(async (): Promise<GlobalPlace[]> => {
    if (!adminUser) return [];
    // Get all trips the user is a member of (owned + shared)
    const { data: memberships } = await supabase
      .from('trip_users')
      .select('trip_id')
      .eq('user_id', adminUser.id);
    if (!memberships?.length) return [];

    const tripIds = [...new Set(memberships.map(m => m.trip_id).filter(Boolean))] as string[];

    const { data: trips } = await supabase
      .from('trips')
      .select('id, name, end_date')
      .in('id', tripIds);
    if (!trips?.length) return [];

    const tripNameMap = new Map<string, string>();
    trips.forEach(t => tripNameMap.set(t.id, t.name));
    const tripEndMap = new Map<string, string | null>();
    trips.forEach(t => tripEndMap.set(t.id, t.end_date));

    const { data: entries } = await supabase
      .from('entries')
      .select('id, trip_id, is_scheduled')
      .in('trip_id', tripIds);
    if (!entries?.length) return [];

    const entryMap = new Map<string, any>();
    entries.forEach(e => entryMap.set(e.id, e));

    const { data: options } = await supabase
      .from('entry_options')
      .select('*')
      .in('entry_id', entries.map(e => e.id));
    if (!options?.length) return [];

    const seen = new Set<string>();
    const result: GlobalPlace[] = [];

    for (const opt of options) {
      if (SKIP_CATEGORIES.includes(opt.category ?? '')) continue;
      if (!opt.name) continue;
      const hasCoords = opt.latitude != null && opt.longitude != null;
      const hasAddress = !!opt.address || !!opt.location_name;
      if (!hasCoords && !hasAddress) continue;

      const dedupKey = opt.google_place_id || `${opt.name.toLowerCase()}|${opt.latitude?.toFixed(3)}|${opt.longitude?.toFixed(3)}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      const entry = entryMap.get(opt.entry_id);
      const tripEndDate = entry ? tripEndMap.get(entry.trip_id) : null;
      const isVisited = tripEndDate && new Date(tripEndDate) < new Date();
      const address = opt.address ?? opt.location_name ?? null;
      const { city, country } = extractCityCountry(address);

      result.push({
        id: opt.id,
        user_id: adminUser.id,
        google_place_id: opt.google_place_id,
        name: opt.name,
        category: opt.category,
        latitude: opt.latitude,
        longitude: opt.longitude,
        opening_hours: opt.opening_hours as unknown as string[] | null,
        city,
        country,
        status: isVisited ? 'visited' : 'want_to_go',
        source: 'trip_auto',
        source_trip_id: entry?.trip_id ?? null,
        source_trip_name: entry?.trip_id ? tripNameMap.get(entry.trip_id) ?? null : null,
        rating: opt.rating,
        price_level: opt.price_level,
        website: opt.website,
        phone: opt.phone,
        address,
        notes: null,
        starred: false,
        created_at: opt.created_at,
        updated_at: opt.updated_at,
      });
    }
    return result;
  }, [adminUser]);

  // Load data on mount — only direct query, no sync
  useEffect(() => {
    if (!adminUser) return;
    (async () => {
      const directResult = await fetchDirectPlaces();
      setPlaces(directResult);
      setLoading(false);
    })();
  }, [adminUser, fetchDirectPlaces]);

  const filtered = useMemo(
    () => statusFilter === 'all' ? places : places.filter(p => p.status === statusFilter),
    [places, statusFilter]
  );

  const grouped = useMemo(() => {
    const countryMap = new Map<string, Map<string, GlobalPlace[]>>();
    const unsorted: GlobalPlace[] = [];

    filtered.forEach(place => {
      let city = place.city;
      let country = place.country;

      if (!city || !country) {
        const parsed = extractCityCountry(place.address);
        city = city || parsed.city;
        country = country || parsed.country;
      }

      if (!country || !city) { unsorted.push(place); return; }
      if (!countryMap.has(country)) countryMap.set(country, new Map());
      const cities = countryMap.get(country)!;
      if (!cities.has(city)) cities.set(city, []);
      cities.get(city)!.push(place);
    });

    return { countryMap, unsorted };
  }, [filtered]);

  const cityPlaces = useMemo(() => {
    if (!selectedCity) return [];
    return filtered.filter(p => {
      if (p.city === selectedCity) return true;
      const parsed = extractCityCountry(p.address);
      return parsed.city === selectedCity;
    });
  }, [filtered, selectedCity]);

  const cityCategories = useMemo(() => {
    const catMap = new Map<string, GlobalPlace[]>();
    cityPlaces.forEach(p => {
      const key = p.category ?? 'other';
      if (!catMap.has(key)) catMap.set(key, []);
      catMap.get(key)!.push(p);
    });
    return catMap;
  }, [cityPlaces]);

  const cityCenter = useMemo(() => {
    if (!selectedCity) return null;
    const cp = cityPlaces.filter(p => p.latitude && p.longitude);
    if (!cp.length) return null;
    return {
      lat: cp.reduce((s, p) => s + Number(p.latitude), 0) / cp.length,
      lng: cp.reduce((s, p) => s + Number(p.longitude), 0) / cp.length,
    };
  }, [cityPlaces, selectedCity]);

  const handleCityExploreAdd = useCallback(async (place: ExploreResult) => {
    if (!adminUser) return;
    const inferredCat = inferCategoryFromTypes(place.types);
    await supabase.from('global_places').upsert({
      user_id: adminUser.id,
      google_place_id: place.placeId,
      name: place.name,
      category: inferredCat,
      latitude: place.lat,
      longitude: place.lng,
      status: 'want_to_go',
      source: 'explore_save',
      rating: place.rating,
      price_level: place.priceLevel,
      address: place.address,
      city: selectedCity,
    } as any, { onConflict: 'user_id,google_place_id' });
    toast({ title: `Saved ${place.name} to My Places` });
    // Refetch via direct query
    const updated = await fetchDirectPlaces();
    setPlaces(updated);
  }, [adminUser, selectedCity, fetchDirectPlaces]);

  const filters: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Visited', value: 'visited' },
    { label: 'Want to Go', value: 'want_to_go' },
  ];

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const tempEntry = selectedPlace ? buildTempEntry(selectedPlace) : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => {
              if (cityExploreOpen) { setCityExploreOpen(false); }
              else if (selectedCity) { setSelectedCity(null); setCityExploreOpen(false); }
              else { navigate('/'); }
            }}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold">
              {selectedCity ? (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  {selectedCity}
                </span>
              ) : 'Global Planner'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {selectedCity && !cityExploreOpen && (
              <Button variant="outline" size="sm" onClick={() => setCityExploreOpen(true)}>
                <Search className="h-3.5 w-3.5 mr-1.5" />
                Explore
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        {/* Filter tabs */}
        {!selectedCity && (
          <div className="mb-4 flex gap-2">
            {filters.map(f => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  statusFilter === f.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : selectedCity ? (
          <div className="space-y-6">
            {cityPlaces.length === 0 ? (
              <p className="py-20 text-center text-sm text-muted-foreground">No places in this city.</p>
            ) : (
              Array.from(cityCategories.entries()).map(([catKey, catPlaces]) => {
                const cat = findCategory(catKey);
                return (
                  <div key={catKey}>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <span>{cat?.emoji ?? '📌'}</span>
                      <span>{cat?.name ?? catKey}</span>
                      <span className="text-xs font-normal text-muted-foreground">({catPlaces.length})</span>
                    </h3>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none" style={{ scrollSnapType: 'x mandatory' }}>
                      {catPlaces.map(place => {
                        const { entry } = buildTempEntry(place);
                        return (
                          <div key={place.id} className="w-[180px] shrink-0" style={{ scrollSnapAlign: 'start' }}>
                            <SidebarEntryCard
                              entry={entry}
                              onClick={() => setSelectedPlace(place)}
                              compact
                              visitedBadge={place.status === 'visited'}
                            />
                            {place.source_trip_name && (
                              <p className="mt-1 truncate text-[10px] text-muted-foreground/70 px-1">
                                from {place.source_trip_name}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-3xl">📍</div>
            <p className="text-sm text-muted-foreground">
              {statusFilter === 'all' ? 'No places found. Add entries to your trips to see them here.' : `No ${statusFilter === 'visited' ? 'visited' : 'planned'} places.`}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(grouped.countryMap.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([country, cities]) => (
                <div key={country}>
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{country}</h2>
                  <div className="space-y-1">
                    {Array.from(cities.entries())
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([city, cityPlaces]) => (
                        <motion.button
                          key={city}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => setSelectedCity(city)}
                          className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <MapPin className="h-4 w-4 text-primary" />
                            <span className="font-medium text-sm">{city}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{cityPlaces.length} places</span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </motion.button>
                      ))}
                  </div>
                </div>
              ))}

            {grouped.unsorted.length > 0 && (
              <div>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Other</h2>
                <div className="space-y-2">
                  {grouped.unsorted.map((place, i) => {
                    const cat = findCategory(place.category);
                    return (
                      <motion.button
                        key={place.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        onClick={() => setSelectedPlace(place)}
                        className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-lg">
                          {cat?.emoji ?? '📍'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-sm">{place.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {place.address && <span className="truncate">{place.address.split(',')[0]}</span>}
                            {place.source_trip_name && (
                              <span className="shrink-0 text-[10px] text-muted-foreground/60">· {place.source_trip_name}</span>
                            )}
                            {place.rating && (
                              <span className="flex items-center gap-0.5 shrink-0">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                {place.rating}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant="secondary"
                          className={`shrink-0 text-[10px] ${
                            place.status === 'visited'
                              ? 'bg-green-500/15 text-green-600 border-green-500/30'
                              : 'bg-blue-500/15 text-blue-600 border-blue-500/30'
                          }`}
                        >
                          {place.status === 'visited' ? '✓ Visited' : 'Want to Go'}
                        </Badge>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* City Explore overlay */}
      {cityExploreOpen && cityCenter && selectedCity && (
        <div className="fixed inset-0 z-40 bg-background flex flex-col">
          <ExploreView
            open={true}
            onClose={() => setCityExploreOpen(false)}
            trip={null}
            entries={[]}
            isEditor={true}
            onAddToPlanner={handleCityExploreAdd}
            onCardTap={() => {}}
            onAddManually={() => {}}
            initialOrigin={{ name: selectedCity, ...cityCenter }}
          />
        </div>
      )}

      {/* Place detail drawer */}
      <Drawer open={!!selectedPlace} onOpenChange={(open) => !open && setSelectedPlace(null)}>
        <DrawerContent className="max-h-[90vh]">
          <div className="overflow-y-auto">
            {tempEntry && (
              <PlaceOverview
                entry={tempEntry.entry}
                option={tempEntry.option}
                context="global"
                isEditor={false}
                onSaved={() => {}}
                onClose={() => setSelectedPlace(null)}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default GlobalPlanner;

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, Star, Loader2, ChevronRight, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { toast } from '@/hooks/use-toast';
import { findCategory } from '@/lib/categories';
import PlaceOverview from '@/components/timeline/PlaceOverview';
import SidebarEntryCard from '@/components/timeline/SidebarEntryCard';
import type { GlobalPlace, EntryWithOptions, EntryOption } from '@/types/trip';

type StatusFilter = 'all' | 'visited' | 'want_to_go';

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
  const [syncing, setSyncing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedPlace, setSelectedPlace] = useState<GlobalPlace | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate('/auth');
  }, [authLoading, isAdmin, navigate]);

  const fetchPlaces = useCallback(async () => {
    if (!adminUser) return;
    const { data } = await supabase
      .from('global_places')
      .select('*')
      .eq('user_id', adminUser.id)
      .order('name');
    setPlaces((data ?? []) as unknown as GlobalPlace[]);
    setLoading(false);
    return data ?? [];
  }, [adminUser]);

  const syncPlaces = useCallback(async () => {
    if (!adminUser) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-global-places', {
        body: { userId: adminUser.id },
      });
      if (error) throw error;
      toast({ title: `Synced ${data?.synced ?? 0} places, geocoded ${data?.geocoded ?? 0}` });
      await fetchPlaces();
    } catch (err: any) {
      toast({ title: 'Sync failed', description: err.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  }, [adminUser, fetchPlaces]);

  useEffect(() => {
    if (!adminUser) return;
    (async () => {
      const result = await fetchPlaces();
      if (result && result.length === 0) {
        await syncPlaces();
      }
    })();
  }, [adminUser]);

  const filtered = useMemo(
    () => statusFilter === 'all' ? places : places.filter(p => p.status === statusFilter),
    [places, statusFilter]
  );

  const grouped = useMemo(() => {
    const countryMap = new Map<string, Map<string, GlobalPlace[]>>();
    const unsorted: GlobalPlace[] = [];

    filtered.forEach(place => {
      if (!place.country || !place.city) { unsorted.push(place); return; }
      if (!countryMap.has(place.country)) countryMap.set(place.country, new Map());
      const cities = countryMap.get(place.country)!;
      if (!cities.has(place.city)) cities.set(place.city, []);
      cities.get(place.city)!.push(place);
    });

    return { countryMap, unsorted };
  }, [filtered]);

  // Get places for the selected city
  const cityPlaces = useMemo(() => {
    if (!selectedCity) return [];
    return filtered.filter(p => p.city === selectedCity);
  }, [filtered, selectedCity]);

  // Group city places by category for Netflix rows
  const cityCategories = useMemo(() => {
    const catMap = new Map<string, GlobalPlace[]>();
    cityPlaces.forEach(p => {
      const key = p.category ?? 'other';
      if (!catMap.has(key)) catMap.set(key, []);
      catMap.get(key)!.push(p);
    });
    return catMap;
  }, [cityPlaces]);

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
              if (selectedCity) { setSelectedCity(null); } else { navigate('/'); }
            }}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold">
              {selectedCity ? (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  {selectedCity}
                </span>
              ) : 'My Places'}
            </h1>
          </div>
          {!selectedCity && (
            <Button variant="ghost" size="icon" onClick={syncPlaces} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            </Button>
          )}
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
          /* ============ City Detail View — Netflix rows ============ */
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
              {statusFilter === 'all' ? 'No places synced yet. Tap sync to import from your trips.' : `No ${statusFilter === 'visited' ? 'visited' : 'planned'} places.`}
            </p>
          </div>
        ) : (
          /* ============ Grouped Country → City View ============ */
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

            {/* Unsorted places (no city/country) */}
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

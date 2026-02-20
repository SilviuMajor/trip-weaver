import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Navigation, Search } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useGeolocation } from '@/hooks/useGeolocation';
import { toast } from '@/hooks/use-toast';
import { inferCategoryFromTypes } from '@/lib/placeTypeMapping';
import PlacesAutocomplete, { type PlaceDetails } from '@/components/timeline/PlacesAutocomplete';
import ExploreView, { type ExploreResult } from '@/components/timeline/ExploreView';

interface SelectedLocation {
  name: string;
  lat: number;
  lng: number;
}

interface RecentCity {
  city: string;
  lat: number;
  lng: number;
}

const GlobalExplore = () => {
  const navigate = useNavigate();
  const { adminUser, isAdmin, loading: authLoading } = useAdminAuth();
  const { displayName } = useProfile(adminUser?.id);
  const geo = useGeolocation();

  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentCities, setRecentCities] = useState<RecentCity[]>([]);
  const [loadingCities, setLoadingCities] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate('/auth');
  }, [authLoading, isAdmin, navigate]);

  // Fetch recent cities from global_places
  useEffect(() => {
    if (!adminUser) return;
    (async () => {
      const { data } = await supabase
        .from('global_places')
        .select('city, latitude, longitude')
        .eq('user_id', adminUser.id)
        .not('city', 'is', null);

      if (!data?.length) { setLoadingCities(false); return; }

      const cityMap = new Map<string, { sumLat: number; sumLng: number; count: number }>();
      for (const p of data) {
        if (!p.city || !p.latitude || !p.longitude) continue;
        const existing = cityMap.get(p.city);
        if (existing) {
          existing.sumLat += Number(p.latitude);
          existing.sumLng += Number(p.longitude);
          existing.count++;
        } else {
          cityMap.set(p.city, { sumLat: Number(p.latitude), sumLng: Number(p.longitude), count: 1 });
        }
      }

      const cities: RecentCity[] = [];
      for (const [city, agg] of cityMap) {
        cities.push({ city, lat: agg.sumLat / agg.count, lng: agg.sumLng / agg.count });
      }
      setRecentCities(cities.slice(0, 5));
      setLoadingCities(false);
    })();
  }, [adminUser]);

  const handleSelectLocation = (loc: SelectedLocation) => {
    setSelectedLocation(loc);
  };

  const handlePlaceSelect = (details: PlaceDetails) => {
    if (details.lat != null && details.lng != null) {
      handleSelectLocation({ name: details.name, lat: details.lat, lng: details.lng });
    }
  };

  const handleUseCurrentLocation = () => {
    if (geo.latitude && geo.longitude) {
      handleSelectLocation({ name: 'Current Location', lat: geo.latitude, lng: geo.longitude });
    } else {
      toast({ title: 'Location unavailable', description: geo.error || 'Enable location access', variant: 'destructive' });
    }
  };

  const handleGlobalAdd = async (place: ExploreResult) => {
    if (!adminUser) return;
    const inferredCat = inferCategoryFromTypes(place.types);
    const { error } = await supabase.from('global_places').upsert({
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
      opening_hours: place.openingHours,
      website: place.website,
      phone: place.phone,
      address: place.address,
      city: selectedLocation?.name || null,
    } as any, { onConflict: 'user_id,google_place_id' });

    if (!error) {
      toast({ title: `Saved ${place.name} to My Places` });
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // ── State 2: ExploreView (no external category pills — ExploreView handles it) ──
  if (selectedLocation) {
    return (
      <div className="fixed inset-0 flex flex-col bg-background max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setSelectedLocation(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-sm font-semibold truncate">{selectedLocation.name}</span>
          </div>
        </div>

        {/* ExploreView — handles its own category selection internally */}
        <div className="flex-1 relative">
          <ExploreView
            open={true}
            onClose={() => setSelectedLocation(null)}
            trip={null}
            entries={[]}
            isEditor={true}
            onAddToPlanner={handleGlobalAdd}
            onCardTap={() => {}}
            onAddManually={() => {}}
            initialOrigin={selectedLocation}
          />
        </div>
      </div>
    );
  }

  // ── State 1: Location Picker ──
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-bold">Explore</h1>
          </div>
          <button onClick={() => navigate('/settings')} className="shrink-0">
            <UserAvatar name={displayName} size="sm" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <div>
          <h2 className="text-base font-semibold mb-1">Where do you want to explore?</h2>
          <p className="text-sm text-muted-foreground mb-4">Search for a city or use your current location</p>
        </div>

        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={handleUseCurrentLocation}
        >
          <Navigation className="h-4 w-4 text-primary" />
          Use current location
        </Button>

        <div>
          <PlacesAutocomplete
            value={searchQuery}
            onChange={setSearchQuery}
            onPlaceSelect={handlePlaceSelect}
            placeholder="Search for a city or place..."
            autoFocus
          />
        </div>

        {!loadingCities && recentCities.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent cities</p>
            <div className="space-y-1">
              {recentCities.map(city => (
                <button
                  key={city.city}
                  className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                  onClick={() => handleSelectLocation({ name: city.city, lat: city.lat, lng: city.lng })}
                >
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium">{city.city}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default GlobalExplore;

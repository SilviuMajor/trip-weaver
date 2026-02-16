import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

const reverseGeocode = async (lat: number, lng: number, apiKey: string): Promise<{ city: string | null; country: string | null }> => {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&result_type=locality|administrative_area_level_1`
    );
    const data = await res.json();
    if (!data.results?.length) return { city: null, country: null };
    const components = data.results[0].address_components ?? [];
    const city = components.find((c: any) => c.types.includes('locality'))?.long_name ?? null;
    const country = components.find((c: any) => c.types.includes('country'))?.long_name ?? null;
    return { city, country };
  } catch {
    return { city: null, country: null };
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { userId, tripId } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get trips owned by this user
    let tripsQuery = supabase
      .from('trips')
      .select('id, end_date')
      .eq('owner_id', userId);

    if (tripId) {
      tripsQuery = tripsQuery.eq('id', tripId);
    }

    const { data: trips, error: tripsErr } = await tripsQuery;
    if (tripsErr) throw tripsErr;
    if (!trips || trips.length === 0) {
      return new Response(JSON.stringify({ synced: 0, geocoded: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tripIds = trips.map((t: any) => t.id);
    const tripEndMap = new Map<string, string | null>();
    trips.forEach((t: any) => tripEndMap.set(t.id, t.end_date));

    // Get entries for those trips
    const { data: entries, error: entriesErr } = await supabase
      .from('entries')
      .select('id, trip_id, is_scheduled')
      .in('trip_id', tripIds);

    if (entriesErr) throw entriesErr;
    if (!entries || entries.length === 0) {
      return new Response(JSON.stringify({ synced: 0, geocoded: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const entryIds = entries.map((e: any) => e.id);
    const entryMap = new Map<string, any>();
    entries.forEach((e: any) => entryMap.set(e.id, e));

    // Get ALL options (no google_place_id filter)
    const { data: options, error: optsErr } = await supabase
      .from('entry_options')
      .select('*')
      .in('entry_id', entryIds);

    if (optsErr) throw optsErr;

    // Fetch existing global_places for dedup of non-Google entries
    const { data: existingPlaces } = await supabase
      .from('global_places')
      .select('id, name, latitude, longitude, google_place_id')
      .eq('user_id', userId);

    const existingByName = new Map<string, any[]>();
    (existingPlaces ?? []).forEach((p: any) => {
      const key = (p.name || '').toLowerCase();
      if (!existingByName.has(key)) existingByName.set(key, []);
      existingByName.get(key)!.push(p);
    });

    let synced = 0;
    for (const opt of (options ?? [])) {
      const entry = entryMap.get(opt.entry_id);
      if (!entry) continue;

      // Skip transport/flight/hotel categories
      if (SKIP_CATEGORIES.includes(opt.category)) continue;

      // Skip entries without a name
      if (!opt.name) continue;

      // Skip entries with no coordinates AND no address
      const hasCoords = opt.latitude != null && opt.longitude != null;
      const hasAddress = !!opt.address || !!opt.location_name;
      if (!hasCoords && !hasAddress) continue;

      const tripEndDate = tripEndMap.get(entry.trip_id);
      const isVisited = tripEndDate && new Date(tripEndDate) < new Date();

      const placeData = {
        user_id: userId,
        name: opt.name,
        category: opt.category,
        latitude: opt.latitude,
        longitude: opt.longitude,
        status: isVisited ? 'visited' : 'want_to_go',
        source: entry.is_scheduled ? 'trip_auto' : 'trip_planner',
        source_trip_id: entry.trip_id,
        rating: opt.rating,
        price_level: opt.price_level,
        opening_hours: opt.opening_hours,
        website: opt.website,
        phone: opt.phone,
        address: opt.address ?? opt.location_name,
      };

      if (opt.google_place_id) {
        // Upsert using google_place_id unique constraint
        const { error: upsertErr } = await supabase
          .from('global_places')
          .upsert({
            ...placeData,
            google_place_id: opt.google_place_id,
          }, {
            onConflict: 'user_id,google_place_id',
            ignoreDuplicates: false,
          });
        if (!upsertErr) synced++;
      } else {
        // Dedup by name + nearby coordinates (~0.001 degrees ≈ 100m)
        const nameKey = opt.name.toLowerCase();
        const matches = existingByName.get(nameKey) ?? [];
        const isDuplicate = matches.some((existing: any) => {
          if (!hasCoords || !existing.latitude || !existing.longitude) return false;
          return Math.abs(Number(existing.latitude) - opt.latitude) < 0.001
            && Math.abs(Number(existing.longitude) - opt.longitude) < 0.001;
        });

        if (!isDuplicate) {
          const { error: insertErr, data: inserted } = await supabase
            .from('global_places')
            .insert(placeData)
            .select('id, name, latitude, longitude, google_place_id');
          if (!insertErr) {
            synced++;
            // Add to dedup map for subsequent iterations
            if (inserted?.[0]) {
              if (!existingByName.has(nameKey)) existingByName.set(nameKey, []);
              existingByName.get(nameKey)!.push(inserted[0]);
            }
          }
        }
      }
    }

    // Reverse geocode + address fallback for places missing city/country (max 50 per sync)
    let geocoded = 0;
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');

    const { data: missingGeo } = await supabase
      .from('global_places')
      .select('id, latitude, longitude, address')
      .eq('user_id', userId)
      .is('city', null)
      .limit(50);

    for (const place of (missingGeo ?? [])) {
      let city: string | null = null;
      let country: string | null = null;

      // Try reverse geocode first
      if (apiKey && place.latitude != null && place.longitude != null) {
        const geo = await reverseGeocode(Number(place.latitude), Number(place.longitude), apiKey);
        city = geo.city;
        country = geo.country;
      }

      // Fallback to address parsing
      if (!city && !country) {
        const parsed = extractCityCountry(place.address);
        city = parsed.city;
        country = parsed.country;
      }

      if (city || country) {
        const { error: geoErr } = await supabase
          .from('global_places')
          .update({ city, country })
          .eq('id', place.id);
        if (!geoErr) geocoded++;
      }
    }

    return new Response(JSON.stringify({ synced, geocoded }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Sync error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

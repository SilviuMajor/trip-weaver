import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Get options with google_place_id
    const { data: options, error: optsErr } = await supabase
      .from('entry_options')
      .select('*')
      .in('entry_id', entryIds)
      .not('google_place_id', 'is', null);

    if (optsErr) throw optsErr;

    let synced = 0;
    for (const opt of (options ?? [])) {
      const entry = entryMap.get(opt.entry_id);
      if (!entry) continue;

      // Skip transport/airport categories
      if (['transfer', 'transport', 'airport_processing'].includes(opt.category)) continue;

      const tripEndDate = tripEndMap.get(entry.trip_id);
      const isVisited = tripEndDate && new Date(tripEndDate) < new Date();

      const { error: upsertErr } = await supabase
        .from('global_places')
        .upsert({
          user_id: userId,
          google_place_id: opt.google_place_id,
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
        }, {
          onConflict: 'user_id,google_place_id',
          ignoreDuplicates: false,
        });

      if (!upsertErr) synced++;
    }

    // Reverse geocode places missing city/country (max 20 per sync)
    let geocoded = 0;
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (apiKey) {
      const { data: missingGeo } = await supabase
        .from('global_places')
        .select('id, latitude, longitude')
        .eq('user_id', userId)
        .is('city', null)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .limit(20);

      for (const place of (missingGeo ?? [])) {
        const { city, country } = await reverseGeocode(place.latitude, place.longitude, apiKey);
        if (city || country) {
          const { error: geoErr } = await supabase
            .from('global_places')
            .update({ city, country })
            .eq('id', place.id);
          if (!geoErr) geocoded++;
        }
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

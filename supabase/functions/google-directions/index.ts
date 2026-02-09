import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!GOOGLE_MAPS_API_KEY) {
      throw new Error('GOOGLE_MAPS_API_KEY is not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();

    // --- Mode 1: Single address-based lookup (for Transfer entries) ---
    if (body.fromAddress && body.toAddress) {
      const { fromAddress, toAddress, mode } = body;
      const travelMode = mode || 'transit';

      console.log(`Fetching directions: "${fromAddress}" -> "${toAddress}" (${travelMode})`);

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(fromAddress)}&destination=${encodeURIComponent(toAddress)}&mode=${travelMode}&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.routes?.length) {
        return new Response(
          JSON.stringify({ error: `No route found: ${data.status}`, duration_min: null, distance_km: null }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const leg = data.routes[0].legs[0];
      return new Response(
        JSON.stringify({
          duration_min: Math.round(leg.duration.value / 60),
          distance_km: Math.round(leg.distance.value / 100) / 10,
          mode: travelMode,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Mode 2: Trip-wide batch calculation (existing flow) ---
    const { tripId } = body;
    if (!tripId) throw new Error('tripId or fromAddress/toAddress is required');

    console.log(`Fetching directions for trip: ${tripId}`);

    const { data: entries, error: entriesError } = await supabase
      .from('entries')
      .select('id, start_time, end_time')
      .eq('trip_id', tripId)
      .order('start_time');

    if (entriesError) throw entriesError;

    if (!entries || entries.length < 2) {
      return new Response(
        JSON.stringify({ message: 'Need at least 2 entries', segments: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const entryIds = entries.map((e: any) => e.id);
    const { data: options, error: optionsError } = await supabase
      .from('entry_options')
      .select('entry_id, latitude, longitude')
      .in('entry_id', entryIds)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (optionsError) throw optionsError;

    const entryCoords = new Map<string, { lat: number; lng: number }>();
    for (const opt of (options ?? [])) {
      if (!entryCoords.has(opt.entry_id) && opt.latitude && opt.longitude) {
        entryCoords.set(opt.entry_id, { lat: opt.latitude, lng: opt.longitude });
      }
    }

    await supabase
      .from('travel_segments')
      .delete()
      .eq('trip_id', tripId);

    const segments = [];

    for (let i = 0; i < entries.length - 1; i++) {
      const fromCoords = entryCoords.get(entries[i].id);
      const toCoords = entryCoords.get(entries[i + 1].id);

      if (!fromCoords || !toCoords) {
        console.log(`Skipping segment ${entries[i].id} -> ${entries[i + 1].id}: missing coordinates`);
        continue;
      }

      const origin = `${fromCoords.lat},${fromCoords.lng}`;
      const destination = `${toCoords.lat},${toCoords.lng}`;

      console.log(`Fetching directions: ${origin} -> ${destination}`);

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=transit&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.routes?.length) {
        console.log(`No route found: ${data.status}`);
        continue;
      }

      const route = data.routes[0];
      const leg = route.legs[0];

      const segment = {
        trip_id: tripId,
        from_entry_id: entries[i].id,
        to_entry_id: entries[i + 1].id,
        duration_min: Math.round(leg.duration.value / 60),
        distance_km: Math.round(leg.distance.value / 100) / 10,
        mode: 'transit',
        polyline: route.overview_polyline?.points ?? null,
      };

      const { error: insertError } = await supabase
        .from('travel_segments')
        .insert(segment);

      if (insertError) {
        console.error('Insert error:', insertError);
      } else {
        segments.push(segment);
      }
    }

    console.log(`Generated ${segments.length} travel segments`);

    return new Response(
      JSON.stringify({ segments }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

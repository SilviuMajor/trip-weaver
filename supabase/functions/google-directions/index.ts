import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

const MODE_MAP: Record<string, string> = {
  transit: 'TRANSIT',
  driving: 'DRIVE',
  drive: 'DRIVE',
  walking: 'WALK',
  walk: 'WALK',
  bicycling: 'BICYCLE',
  bicycle: 'BICYCLE',
  cycle: 'BICYCLE',
};

function buildWaypoint(input: string) {
  const coordMatch = input.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
  if (coordMatch) {
    return {
      location: {
        latLng: {
          latitude: parseFloat(coordMatch[1]),
          longitude: parseFloat(coordMatch[2]),
        },
      },
    };
  }
  return { address: input };
}

function parseRoutesResponse(data: any) {
  if (!data.routes?.length) return null;
  const route = data.routes[0];
  const leg = route.legs?.[0];
  if (!leg) return null;

  const durationSec = parseInt((leg.duration || '0s').replace('s', ''), 10);
  const distanceMeters = leg.distanceMeters || 0;

  return {
    duration_min: Math.round(durationSec / 60),
    distance_km: Math.round(distanceMeters / 100) / 10,
    polyline: route.polyline?.encodedPolyline ?? null,
  };
}

async function fetchSingleMode(
  apiKey: string,
  from: string,
  to: string,
  mode: string,
  departureTime?: string,
) {
  const travelMode = MODE_MAP[mode] || 'TRANSIT';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
    'X-Goog-FieldMask': 'routes.legs.duration,routes.legs.distanceMeters,routes.polyline.encodedPolyline',
  };

  const requestBody: any = {
    origin: buildWaypoint(from),
    destination: buildWaypoint(to),
    travelMode,
  };

  // Add departure time for transit and drive (traffic-aware)
  if (departureTime && (travelMode === 'TRANSIT' || travelMode === 'DRIVE')) {
    requestBody.departureTime = departureTime;
    if (travelMode === 'DRIVE') {
      requestBody.routingPreference = 'TRAFFIC_AWARE';
    }
  }

  const response = await fetch(ROUTES_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });
  const data = await response.json();
  return parseRoutesResponse(data);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!GOOGLE_MAPS_API_KEY) {
      throw new Error('GOOGLE_MAPS_API_KEY is not configured');
    }

    const body = await req.json();

    // --- Mode 1: Multi-mode address-based lookup ---
    if (body.fromAddress && body.toAddress) {
      const { fromAddress, toAddress, departureTime } = body;

      // If modes array provided, fetch all modes in parallel
      if (body.modes && Array.isArray(body.modes)) {
        console.log(`Multi-mode Routes API: "${fromAddress}" -> "${toAddress}" modes: ${body.modes.join(', ')}`);

        const promises = body.modes.map((mode: string) =>
          fetchSingleMode(GOOGLE_MAPS_API_KEY, fromAddress, toAddress, mode, departureTime)
            .then(result => result ? { mode, duration_min: result.duration_min, distance_km: result.distance_km } : null)
            .catch(() => null)
        );

        const results = (await Promise.all(promises)).filter(Boolean);

        return new Response(
          JSON.stringify({ results }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Single mode (legacy)
      const { mode } = body;
      console.log(`Routes API: "${fromAddress}" -> "${toAddress}" (${mode || 'transit'})`);

      const parsed = await fetchSingleMode(GOOGLE_MAPS_API_KEY, fromAddress, toAddress, mode || 'transit', departureTime);
      if (!parsed) {
        return new Response(
          JSON.stringify({ error: 'No route found', duration_min: null, distance_km: null }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          duration_min: parsed.duration_min,
          distance_km: parsed.distance_km,
          mode: mode || 'transit',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Mode 2: Trip-wide batch calculation ---
    const { tripId } = body;
    if (!tripId) throw new Error('tripId or fromAddress/toAddress is required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

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

    const headers = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': 'routes.legs.duration,routes.legs.distanceMeters,routes.polyline.encodedPolyline',
    };

    const segments = [];

    for (let i = 0; i < entries.length - 1; i++) {
      const fromCoords = entryCoords.get(entries[i].id);
      const toCoords = entryCoords.get(entries[i + 1].id);

      if (!fromCoords || !toCoords) {
        console.log(`Skipping segment ${entries[i].id} -> ${entries[i + 1].id}: missing coordinates`);
        continue;
      }

      console.log(`Routes API: ${fromCoords.lat},${fromCoords.lng} -> ${toCoords.lat},${toCoords.lng}`);

      const requestBody = {
        origin: {
          location: {
            latLng: { latitude: fromCoords.lat, longitude: fromCoords.lng },
          },
        },
        destination: {
          location: {
            latLng: { latitude: toCoords.lat, longitude: toCoords.lng },
          },
        },
        travelMode: 'TRANSIT',
        departureTime: entries[i].end_time,
      };

      const response = await fetch(ROUTES_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();

      const parsed = parseRoutesResponse(data);
      if (!parsed) {
        console.log('No route found:', JSON.stringify(data.error || data));
        continue;
      }

      const segment = {
        trip_id: tripId,
        from_entry_id: entries[i].id,
        to_entry_id: entries[i + 1].id,
        duration_min: parsed.duration_min,
        distance_km: parsed.distance_km,
        mode: 'transit',
        polyline: parsed.polyline,
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

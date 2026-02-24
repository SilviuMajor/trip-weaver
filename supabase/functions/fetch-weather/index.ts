import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// WMO Weather Code mapping
function mapWeatherCode(code: number): { condition: string; iconCode: string } {
  if (code === 0) return { condition: 'Clear sky', iconCode: 'clear' };
  if (code <= 3) return { condition: 'Partly cloudy', iconCode: 'partly-cloudy' };
  if (code === 45 || code === 48) return { condition: 'Fog', iconCode: 'fog' };
  if (code >= 51 && code <= 57) return { condition: 'Drizzle', iconCode: 'drizzle' };
  if (code >= 61 && code <= 67) return { condition: 'Rain', iconCode: 'rain' };
  if (code >= 71 && code <= 77) return { condition: 'Snow', iconCode: 'snow' };
  if (code >= 80 && code <= 82) return { condition: 'Rain showers', iconCode: 'rain' };
  if (code >= 85 && code <= 86) return { condition: 'Snow showers', iconCode: 'snow' };
  if (code >= 95 && code <= 99) return { condition: 'Thunderstorm', iconCode: 'thunderstorm' };
  return { condition: 'Unknown', iconCode: 'clear' };
}

interface Segment {
  lat: number;
  lng: number;
  startDate: string;
  endDate: string;
  startHour?: number;
  endHour?: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const { tripId, segments, lat, lng } = body;

    // Input validation
    if (!tripId || typeof tripId !== 'string' || !UUID_RE.test(tripId)) {
      return new Response(JSON.stringify({ error: 'Valid tripId (UUID) is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Support both new segments API and legacy single lat/lng
    let locationSegments: Segment[];

    if (segments && Array.isArray(segments) && segments.length > 0) {
      // Validate segments
      for (const seg of segments) {
        if (typeof seg.lat !== 'number' || seg.lat < -90 || seg.lat > 90) throw new Error('Invalid segment lat');
        if (typeof seg.lng !== 'number' || seg.lng < -180 || seg.lng > 180) throw new Error('Invalid segment lng');
        if (!seg.startDate || !DATE_RE.test(seg.startDate)) throw new Error('Invalid segment startDate');
        if (!seg.endDate || !DATE_RE.test(seg.endDate)) throw new Error('Invalid segment endDate');
      }
      locationSegments = segments;
    } else if (lat != null && lng != null) {
      if (typeof lat !== 'number' || lat < -90 || lat > 90) throw new Error('Invalid lat');
      if (typeof lng !== 'number' || lng < -180 || lng > 180) throw new Error('Invalid lng');
      // Legacy: single location for the whole trip
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .select('start_date, end_date')
        .eq('id', tripId)
        .single();
      if (tripError) throw tripError;
      if (!trip) throw new Error('Trip not found');
      locationSegments = [{ lat, lng, startDate: trip.start_date, endDate: trip.end_date }];
    } else {
      throw new Error('Either segments array or lat/lng are required');
    }

    console.log(`Fetching weather for trip: ${tripId}, ${locationSegments.length} segment(s)`);

    // Delete existing weather data for this trip (clean slate)
    await supabase
      .from('weather_cache')
      .delete()
      .eq('trip_id', tripId);

    let totalRecords = 0;

    for (const seg of locationSegments) {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${seg.lat}&longitude=${seg.lng}&hourly=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&start_date=${seg.startDate}&end_date=${seg.endDate}&timezone=auto`;

      const response = await fetch(url);
      if (!response.ok) {
        const text = await response.text();
        console.error(`Open-Meteo API error [${response.status}]: ${text}`);
        continue;
      }

      const weatherData = await response.json();
      if (!weatherData.hourly) {
        console.error('No hourly data returned from Open-Meteo for segment', seg);
        continue;
      }

      const { time, temperature_2m, weather_code, relative_humidity_2m, wind_speed_10m } = weatherData.hourly;

      const records = [];
      for (let i = 0; i < time.length; i++) {
        const dateTime = new Date(time[i]);
        const dateStr = time[i].substring(0, 10);
        const hour = dateTime.getHours();

        if (seg.startHour != null && dateStr === seg.startDate && hour < seg.startHour) continue;
        if (seg.endHour != null && dateStr === seg.endDate && hour > seg.endHour) continue;

        const { condition, iconCode } = mapWeatherCode(weather_code[i]);

        records.push({
          trip_id: tripId,
          date: dateStr,
          hour,
          temp_c: temperature_2m[i],
          condition,
          icon_code: iconCode,
          humidity: relative_humidity_2m[i],
          wind_speed: wind_speed_10m[i],
          latitude: seg.lat,
          longitude: seg.lng,
        });
      }

      // Insert in batches of 100
      for (let i = 0; i < records.length; i += 100) {
        const batch = records.slice(i, i + 100);
        const { error: insertError } = await supabase
          .from('weather_cache')
          .insert(batch);

        if (insertError) {
          console.error('Insert error:', insertError);
        }
      }

      totalRecords += records.length;
    }

    return new Response(
      JSON.stringify({
        message: `Cached ${totalRecords} weather records across ${locationSegments.length} location(s)`,
        records: totalRecords,
      }),
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

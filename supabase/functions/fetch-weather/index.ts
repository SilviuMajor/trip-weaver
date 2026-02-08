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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { tripId, lat, lng } = await req.json();
    if (!tripId || lat == null || lng == null) {
      throw new Error('tripId, lat, and lng are required');
    }

    console.log(`Fetching weather for trip: ${tripId}, coords: ${lat},${lng}`);

    // Get trip date range
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('start_date, end_date')
      .eq('id', tripId)
      .single();

    if (tripError) throw tripError;
    if (!trip) throw new Error('Trip not found');

    // Call Open-Meteo API (free, no key needed)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&start_date=${trip.start_date}&end_date=${trip.end_date}&timezone=auto`;

    console.log(`Open-Meteo URL: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Open-Meteo API error [${response.status}]: ${text}`);
    }

    const weatherData = await response.json();
    if (!weatherData.hourly) {
      throw new Error('No hourly data returned from Open-Meteo');
    }

    const { time, temperature_2m, weather_code, relative_humidity_2m, wind_speed_10m } = weatherData.hourly;

    // Delete existing weather data for this trip (clean slate)
    await supabase
      .from('weather_cache')
      .delete()
      .eq('trip_id', tripId);

    // Prepare records
    const records = [];
    for (let i = 0; i < time.length; i++) {
      const dateTime = new Date(time[i]);
      const dateStr = time[i].substring(0, 10); // YYYY-MM-DD
      const hour = dateTime.getHours();
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
      });
    }

    console.log(`Inserting ${records.length} weather records`);

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

    return new Response(
      JSON.stringify({
        message: `Cached ${records.length} weather records`,
        records: records.length,
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

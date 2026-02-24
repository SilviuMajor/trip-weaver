import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

  const url = new URL(req.url);
  const path = url.searchParams.get('path');
  const lat = url.searchParams.get('lat');
  const lng = url.searchParams.get('lng');
  const zoom = url.searchParams.get('zoom') || '15';
  const size = url.searchParams.get('size') || '600x200';
  const markersParam = url.searchParams.get('markers');

  // Validate inputs
  if (lat && (isNaN(Number(lat)) || Number(lat) < -90 || Number(lat) > 90)) {
    return new Response(JSON.stringify({ error: 'Invalid lat' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (lng && (isNaN(Number(lng)) || Number(lng) < -180 || Number(lng) > 180)) {
    return new Response(JSON.stringify({ error: 'Invalid lng' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!path && !markersParam && (!lat || !lng)) {
    return new Response(JSON.stringify({ error: 'lat and lng are required when path and markers are not provided' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validate size format
  const sizeMatch = size.match(/^(\d+)x(\d+)$/);
  if (!sizeMatch || Number(sizeMatch[1]) > 2048 || Number(sizeMatch[2]) > 2048) {
    return new Response(JSON.stringify({ error: 'Invalid size (max 2048x2048)' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let mapUrl: string;
  if (path) {
    if (path.length > 10000) {
      return new Response(JSON.stringify({ error: 'Path too long' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    mapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=${size}&path=weight:4|color:0x4285F4ff|enc:${path}&key=${apiKey}`;
  } else if (markersParam) {
    try {
      const markers = JSON.parse(decodeURIComponent(markersParam));
      if (!Array.isArray(markers) || markers.length > 50) throw new Error('Invalid markers');
      const groups = new Map<string, string[]>();
      for (const m of markers) {
        if (typeof m.lat !== 'number' || typeof m.lng !== 'number') continue;
        const color = (m.color || 'red').replace(/[^a-zA-Z0-9]/g, '');
        if (!groups.has(color)) groups.set(color, []);
        groups.get(color)!.push(`${m.lat},${m.lng}`);
      }
      let markerParams = '';
      groups.forEach((coords, color) => {
        markerParams += `&markers=color:${color}|size:small|${coords.join('|')}`;
      });
      const center = url.searchParams.get('center') || `${markers[0].lat},${markers[0].lng}`;
      mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=${size}${markerParams}&key=${apiKey}`;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid markers JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } else {
    mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&markers=color:red%7C${lat},${lng}&key=${apiKey}`;
  }

  const mapRes = await fetch(mapUrl);
  if (!mapRes.ok) {
    return new Response(JSON.stringify({ error: 'Failed to fetch map' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const imageBytes = await mapRes.arrayBuffer();
  return new Response(imageBytes, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
});

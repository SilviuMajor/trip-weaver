const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.searchParams.get('path');
  const lat = url.searchParams.get('lat');
  const lng = url.searchParams.get('lng');
  const zoom = url.searchParams.get('zoom') || '15';
  const size = url.searchParams.get('size') || '600x200';
  const markersParam = url.searchParams.get('markers');

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

  let mapUrl: string;
  if (path) {
    mapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=${size}&path=weight:4|color:0x4285F4ff|enc:${path}&key=${apiKey}`;
  } else if (markersParam) {
    try {
      const markers = JSON.parse(decodeURIComponent(markersParam));
      // Group markers by color
      const groups = new Map<string, string[]>();
      for (const m of markers) {
        const color = m.color || 'red';
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

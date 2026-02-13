import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GOOGLE_MAPS_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'autocomplete') {
      const { query, location } = body;
      if (!query || query.length < 3) {
        return new Response(JSON.stringify({ predictions: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const requestBody: any = {
        input: query,
      };
      if (location?.lat && location?.lng) {
        requestBody.locationBias = {
          circle: {
            center: { latitude: location.lat, longitude: location.lng },
            radius: 50000.0,
          },
        };
      }

      const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
        },
        body: JSON.stringify(requestBody),
      });
      const data = await res.json();

      if (data.error) {
        console.error('Autocomplete error:', JSON.stringify(data.error));
        return new Response(JSON.stringify({ predictions: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const predictions = (data.suggestions ?? [])
        .filter((s: any) => s.placePrediction)
        .map((s: any) => ({
          place_id: s.placePrediction.placeId,
          description: s.placePrediction.text?.text ?? '',
          structured_formatting: {
            main_text: s.placePrediction.structuredFormat?.mainText?.text ?? '',
            secondary_text: s.placePrediction.structuredFormat?.secondaryText?.text ?? '',
          },
        }));

      return new Response(JSON.stringify({ predictions }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'details') {
      const { placeId } = body;
      if (!placeId) {
        return new Response(JSON.stringify({ error: 'placeId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'displayName,formattedAddress,websiteUri,location,photos,nationalPhoneNumber,internationalPhoneNumber,rating,userRatingCount,regularOpeningHours,googleMapsUri,priceLevel,types',
        },
      });
      const result = await res.json();

      if (result.error) {
        console.error('Details error:', JSON.stringify(result.error));
        return new Response(JSON.stringify({ error: 'Place not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Upload photos to storage
      const photoUrls: string[] = [];
      const photoRefs = (result.photos ?? []).slice(0, 5);

      if (photoRefs.length > 0) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        for (const photo of photoRefs) {
          try {
            const photoUrl = `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=800&key=${apiKey}`;
            const photoRes = await fetch(photoUrl);
            if (!photoRes.ok) {
              console.error('Photo fetch failed:', photoRes.status);
              continue;
            }

            const blob = await photoRes.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const fileName = `places/${placeId}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;

            const { error: uploadError } = await supabase.storage
              .from('trip-images')
              .upload(fileName, new Uint8Array(arrayBuffer), {
                contentType: blob.type || 'image/jpeg',
                upsert: false,
              });

            if (uploadError) {
              console.error('Upload error:', uploadError);
              continue;
            }

            const { data: urlData } = supabase.storage
              .from('trip-images')
              .getPublicUrl(fileName);

            photoUrls.push(urlData.publicUrl);
          } catch (err) {
            console.error('Photo processing error:', err);
          }
        }
      }

      return new Response(JSON.stringify({
        name: result.displayName?.text ?? '',
        address: result.formattedAddress ?? '',
        website: result.websiteUri ?? null,
        phone: result.internationalPhoneNumber ?? result.nationalPhoneNumber ?? null,
        lat: result.location?.latitude ?? null,
        lng: result.location?.longitude ?? null,
        rating: result.rating ?? null,
        userRatingCount: result.userRatingCount ?? null,
        openingHours: result.regularOpeningHours?.weekdayDescriptions ?? null,
        googleMapsUri: result.googleMapsUri ?? null,
        priceLevel: result.priceLevel ?? null,
        placeTypes: result.types ?? null,
        photos: photoUrls,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const VALID_ACTIONS = ['autocomplete', 'details', 'nearbySearch', 'textSearch', 'photo'];

const mapPlace = (place: any) => ({
  placeId: place.id,
  name: place.displayName?.text ?? '',
  address: place.formattedAddress ?? '',
  lat: place.location?.latitude ?? null,
  lng: place.location?.longitude ?? null,
  rating: place.rating ?? null,
  userRatingCount: place.userRatingCount ?? null,
  priceLevel: place.priceLevel ?? null,
  openingHours: place.regularOpeningHours?.weekdayDescriptions ?? null,
  types: place.types ?? [],
  googleMapsUri: place.googleMapsUri ?? null,
  website: place.websiteUri ?? null,
  phone: place.internationalPhoneNumber ?? place.nationalPhoneNumber ?? null,
  photoRef: place.photos?.[0]?.name ?? null,
  reviews: (place.reviews ?? []).slice(0, 5).map((r: any) => ({
    text: r.text?.text ?? '',
    rating: r.rating ?? null,
    author: r.authorAttribution?.displayName ?? 'Anonymous',
    relativeTime: r.relativePublishTimeDescription ?? '',
  })),
});

const FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.photos,places.regularOpeningHours,places.types,places.googleMapsUri,places.websiteUri,places.nationalPhoneNumber,places.internationalPhoneNumber,places.reviews';

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

    // Validate action
    if (!action || !VALID_ACTIONS.includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'autocomplete') {
      const { query, location } = body;
      if (!query || typeof query !== 'string' || query.length < 3 || query.length > 200) {
        return new Response(JSON.stringify({ predictions: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const requestBody: any = { input: query };
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
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
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
      if (!placeId || typeof placeId !== 'string' || placeId.length > 300) {
        return new Response(JSON.stringify({ error: 'Valid placeId required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'displayName,formattedAddress,websiteUri,location,photos,nationalPhoneNumber,internationalPhoneNumber,rating,userRatingCount,regularOpeningHours,googleMapsUri,priceLevel,types,reviews,editorialSummary,currentOpeningHours',
        },
      });
      const result = await res.json();

      if (result.error) {
        console.error('Details error:', JSON.stringify(result.error));
        return new Response(JSON.stringify({ error: 'Place not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Upload photos to storage
      const photoResults: { url: string; attribution: string }[] = [];
      const photoRefs = (result.photos ?? []).slice(0, 5);

      if (photoRefs.length > 0) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        for (const photo of photoRefs) {
          try {
            const photoUrl = `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=800&key=${apiKey}`;
            const photoRes = await fetch(photoUrl);
            if (!photoRes.ok) continue;

            const blob = await photoRes.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const fileName = `places/${placeId}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;

            const { error: uploadError } = await supabase.storage
              .from('trip-images')
              .upload(fileName, new Uint8Array(arrayBuffer), {
                contentType: blob.type || 'image/jpeg',
                upsert: false,
              });

            if (uploadError) continue;

            const { data: urlData } = supabase.storage
              .from('trip-images')
              .getPublicUrl(fileName);

            const attribution = (photo.authorAttributions ?? [])[0]?.displayName ?? '';
            photoResults.push({ url: urlData.publicUrl, attribution });
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
        photos: photoResults,
        reviews: (result.reviews ?? []).slice(0, 5).map((r: any) => ({
          text: r.text?.text ?? '',
          rating: r.rating ?? null,
          author: r.authorAttribution?.displayName ?? 'Anonymous',
          relativeTime: r.relativePublishTimeDescription ?? '',
        })),
        editorialSummary: result.editorialSummary?.text ?? null,
        currentOpeningHours: result.currentOpeningHours?.weekdayDescriptions ?? null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'nearbySearch') {
      const { latitude, longitude, types, maxResults = 20, radius } = body;
      if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) throw new Error('Invalid latitude');
      if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) throw new Error('Invalid longitude');
      const searchRadius = Math.min(Math.max(Number(radius) || 5000, 100), 50000);

      const requestBody1: any = {
        includedTypes: types,
        maxResultCount: Math.min(maxResults, 20),
        locationRestriction: {
          circle: {
            center: { latitude, longitude },
            radius: searchRadius,
          },
        },
        rankPreference: 'DISTANCE',
      };

      const res1 = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify(requestBody1),
      });
      const data1 = await res1.json();

      if (data1.error) {
        console.error('nearbySearch error:', JSON.stringify(data1.error));
        return new Response(JSON.stringify({ results: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let allPlaces = data1.places ?? [];

      if (allPlaces.length >= 20) {
        try {
          const requestBody2: any = {
            includedTypes: types,
            maxResultCount: 20,
            locationRestriction: {
              circle: {
                center: { latitude, longitude },
                radius: Math.min(searchRadius * 2, 50000),
              },
            },
            rankPreference: 'DISTANCE',
          };

          const res2 = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': FIELD_MASK,
            },
            body: JSON.stringify(requestBody2),
          });
          const data2 = await res2.json();

          if (!data2.error && data2.places?.length) {
            const existingIds = new Set(allPlaces.map((p: any) => p.id));
            const newPlaces = data2.places.filter((p: any) => !existingIds.has(p.id));
            allPlaces = [...allPlaces, ...newPlaces];
          }
        } catch (err) {
          console.error('Second nearby search failed:', err);
        }
      }

      const results = allPlaces.map(mapPlace);

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'textSearch') {
      const { query, latitude, longitude, types, radius = 10000 } = body;
      if (!query || typeof query !== 'string' || query.length > 500) {
        return new Response(JSON.stringify({ results: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const requestBody: any = {
        textQuery: query,
        maxResultCount: 20,
      };

      if (latitude && longitude) {
        requestBody.locationBias = {
          circle: {
            center: { latitude, longitude },
            radius: Math.min(Number(radius), 50000),
          },
        };
      }

      if (types && types.length > 0) {
        requestBody.includedType = types[0];
      }

      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify(requestBody),
      });
      const data = await res.json();

      if (data.error) {
        console.error('textSearch error:', JSON.stringify(data.error));
        return new Response(JSON.stringify({ results: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const results = (data.places ?? []).map(mapPlace);

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'photo') {
      const { photoRef, maxWidth = 400 } = body;
      if (!photoRef || typeof photoRef !== 'string' || photoRef.length > 500) {
        return new Response(JSON.stringify({ error: 'Valid photoRef required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const clampedWidth = Math.min(Math.max(Number(maxWidth), 100), 1600);
      const photoUrl = `https://places.googleapis.com/v1/${photoRef}/media?maxWidthPx=${clampedWidth}&key=${apiKey}`;
      const photoRes = await fetch(photoUrl);
      if (!photoRes.ok) {
        return new Response(JSON.stringify({ error: 'Photo not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ url: photoRes.url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

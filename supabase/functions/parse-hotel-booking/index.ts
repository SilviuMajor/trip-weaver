import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const MAX_BASE64_SIZE = 10 * 1024 * 1024; // ~10MB

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const { fileBase64, mimeType } = await req.json();

    // Input validation
    if (!fileBase64 || typeof fileBase64 !== 'string') {
      return new Response(JSON.stringify({ error: 'fileBase64 is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (fileBase64.length > MAX_BASE64_SIZE) {
      return new Response(JSON.stringify({ error: 'File too large (max 10MB)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
      return new Response(JSON.stringify({ error: `Invalid mimeType. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are a hotel booking document parser. Extract hotel stay details from the provided document (booking confirmation, reservation email screenshot, Booking.com/Airbnb confirmation, etc.).

Extract:
- hotel_name: The name of the hotel/property
- address: Full address if shown
- check_in_date: In YYYY-MM-DD format
- check_in_time: In HH:MM 24-hour format (if shown)
- checkout_date: In YYYY-MM-DD format
- checkout_time: In HH:MM 24-hour format (if shown)
- num_nights: Number of nights if explicitly stated
- room_type: Room type/name if shown
- confirmation_number: Booking reference/confirmation number if shown

Return ONLY valid JSON, no markdown.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${fileBase64}` } },
              { type: 'text', text: 'Extract hotel booking details from this document.' },
            ],
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_hotel',
              description: 'Extract structured hotel booking data from a document',
              parameters: {
                type: 'object',
                properties: {
                  hotel: {
                    type: 'object',
                    properties: {
                      hotel_name: { type: 'string' },
                      address: { type: 'string' },
                      check_in_date: { type: 'string' },
                      check_in_time: { type: 'string' },
                      checkout_date: { type: 'string' },
                      checkout_time: { type: 'string' },
                      num_nights: { type: 'number' },
                      room_type: { type: 'string' },
                      confirmation_number: { type: 'string' },
                    },
                    required: ['hotel_name'],
                    additionalProperties: false,
                  },
                },
                required: ['hotel'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'extract_hotel' } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required, please add credits.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const text = await response.text();
      console.error('AI gateway error:', response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const content = aiData.choices?.[0]?.message?.content ?? '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Could not extract hotel details', hotel: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('parse-hotel-booking error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

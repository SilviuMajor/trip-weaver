const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const { fileBase64, mimeType } = await req.json();
    if (!fileBase64 || !mimeType) {
      return new Response(
        JSON.stringify({ error: 'fileBase64 and mimeType are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are a flight booking document parser. Extract all flight details from the provided document (booking confirmation, e-ticket, itinerary screenshot, etc.).

For each flight found, extract:
- flight_number: The airline code + number (e.g. "BA1234", "KL1234")
- departure_airport: IATA code (e.g. "LHR", "AMS")
- arrival_airport: IATA code (e.g. "AMS", "LHR")
- departure_terminal: Terminal name/number if shown (e.g. "T5", "Terminal 2")
- arrival_terminal: Terminal name/number if shown
- departure_time: In HH:MM 24-hour format
- arrival_time: In HH:MM 24-hour format
- date: In YYYY-MM-DD format

Return ONLY valid JSON, no markdown. If multiple flights are found (connecting flights or round trips), include all of them.`;

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
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${fileBase64}` },
              },
              {
                type: 'text',
                text: 'Extract all flight details from this document. Return JSON with a "flights" array.',
              },
            ],
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_flights',
              description: 'Extract structured flight data from a booking document',
              parameters: {
                type: 'object',
                properties: {
                  flights: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        flight_number: { type: 'string' },
                        departure_airport: { type: 'string' },
                        arrival_airport: { type: 'string' },
                        departure_terminal: { type: 'string' },
                        arrival_terminal: { type: 'string' },
                        departure_time: { type: 'string' },
                        arrival_time: { type: 'string' },
                        date: { type: 'string' },
                      },
                      required: ['flight_number', 'departure_airport', 'arrival_airport', 'departure_time', 'arrival_time'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['flights'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'extract_flights' } },
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

    // Fallback: try to parse content as JSON
    const content = aiData.choices?.[0]?.message?.content ?? '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Could not extract flight details', flights: [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('parse-flight-booking error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

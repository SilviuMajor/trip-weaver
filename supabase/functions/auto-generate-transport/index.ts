import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

function buildWaypoint(lat: number, lng: number) {
  return {
    location: {
      latLng: { latitude: lat, longitude: lng },
    },
  };
}

function buildAddressWaypoint(address: string) {
  return { address };
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

type ModeResult = {
  mode: string;
  duration_min: number;
  distance_km: number;
  polyline: string | null;
};

async function fetchMode(
  apiKey: string,
  origin: any,
  destination: any,
  travelMode: string,
  departureTime?: string,
): Promise<ModeResult | null> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
    'X-Goog-FieldMask': 'routes.legs.duration,routes.legs.distanceMeters,routes.polyline.encodedPolyline',
  };
  const body: any = { origin, destination, travelMode };
  if (departureTime && (travelMode === 'TRANSIT' || travelMode === 'DRIVE')) {
    body.departureTime = departureTime;
    if (travelMode === 'DRIVE') body.routingPreference = 'TRAFFIC_AWARE';
  }
  try {
    const res = await fetch(ROUTES_API_URL, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await res.json();
    const parsed = parseRoutesResponse(data);
    if (!parsed) return null;
    const modeMap: Record<string, string> = { WALK: 'walk', TRANSIT: 'transit', DRIVE: 'drive', BICYCLE: 'bicycle' };
    return { mode: modeMap[travelMode] || travelMode.toLowerCase(), ...parsed };
  } catch {
    return null;
  }
}

// Get location info from an entry option – returns coords or address
function getEntryLocation(opt: any): { origin: any; address: string } | null {
  if (opt.latitude != null && opt.longitude != null) {
    return {
      origin: buildWaypoint(opt.latitude, opt.longitude),
      address: opt.location_name || opt.arrival_location || `${opt.latitude},${opt.longitude}`,
    };
  }
  // For flights, use arrival_location as the "end" location
  if (opt.arrival_location) {
    return { origin: buildAddressWaypoint(opt.arrival_location), address: opt.arrival_location };
  }
  if (opt.location_name) {
    return { origin: buildAddressWaypoint(opt.location_name), address: opt.location_name };
  }
  return null;
}

function getEntryDestLocation(opt: any): { origin: any; address: string } | null {
  // For the "to" entry, use departure_location for flights, or location coords
  if (opt.latitude != null && opt.longitude != null) {
    return {
      origin: buildWaypoint(opt.latitude, opt.longitude),
      address: opt.location_name || opt.departure_location || `${opt.latitude},${opt.longitude}`,
    };
  }
  if (opt.departure_location) {
    return { origin: buildAddressWaypoint(opt.departure_location), address: opt.departure_location };
  }
  if (opt.location_name) {
    return { origin: buildAddressWaypoint(opt.location_name), address: opt.location_name };
  }
  return null;
}

function ceilTo5(min: number): number {
  return Math.ceil(min / 5) * 5;
}

// Resolve the "from" location (where you end up after an entry)
function resolveFromLocation(opt: any) {
  // For flights: you end up at the arrival
  if (opt.category === 'flight' && opt.arrival_location) {
    if (opt.latitude != null && opt.longitude != null) {
      // lat/lng might be departure for flights; prefer arrival_location address
    }
    return buildAddressWaypoint(opt.arrival_location);
  }
  if (opt.latitude != null && opt.longitude != null) {
    return buildWaypoint(opt.latitude, opt.longitude);
  }
  if (opt.location_name) return buildAddressWaypoint(opt.location_name);
  if (opt.arrival_location) return buildAddressWaypoint(opt.arrival_location);
  return null;
}

// Resolve the "to" location (where you need to be at for an entry)
function resolveToLocation(opt: any) {
  // For flights: you need to be at departure
  if (opt.category === 'flight' && opt.departure_location) {
    return buildAddressWaypoint(opt.departure_location);
  }
  if (opt.latitude != null && opt.longitude != null) {
    return buildWaypoint(opt.latitude, opt.longitude);
  }
  if (opt.location_name) return buildAddressWaypoint(opt.location_name);
  if (opt.departure_location) return buildAddressWaypoint(opt.departure_location);
  return null;
}

function getLocationName(opt: any, type: 'from' | 'to'): string {
  // Prefer the entry name, then location_name, then flight-specific fields
  if (opt.name && opt.category !== 'flight') return opt.name;
  if (opt.location_name) return opt.location_name;
  if (type === 'from') return opt.arrival_location || 'Unknown';
  return opt.departure_location || 'Unknown';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!GOOGLE_MAPS_API_KEY) throw new Error('GOOGLE_MAPS_API_KEY is not configured');

    const { tripId } = await req.json();
    if (!tripId) throw new Error('tripId is required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Fetch trip
    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single();
    if (tripErr || !trip) throw new Error('Trip not found');

    const walkThreshold = trip.walk_threshold_min ?? 10;
    const homeTimezone = trip.home_timezone || 'Europe/London';

    // 2. Fetch all scheduled entries with options
    const { data: entries, error: entriesErr } = await supabase
      .from('entries')
      .select('*')
      .eq('trip_id', tripId)
      .eq('is_scheduled', true)
      .order('start_time');
    if (entriesErr) throw entriesErr;
    if (!entries || entries.length < 2) {
      return new Response(
        JSON.stringify({ created: [], overlaps: [], message: 'Need at least 2 scheduled entries' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const entryIds = entries.map((e: any) => e.id);
    const { data: allOptions } = await supabase
      .from('entry_options')
      .select('*')
      .in('entry_id', entryIds);

    const optionsByEntry = new Map<string, any>();
    for (const opt of (allOptions ?? [])) {
      if (!optionsByEntry.has(opt.entry_id)) {
        optionsByEntry.set(opt.entry_id, opt);
      }
    }

    // 3. Group entries by day using flight-aware per-day timezone resolution
    function getDateInTz(isoString: string, tz: string): string {
      const d = new Date(isoString);
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      });
      const parts = formatter.formatToParts(d);
      const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00';
      return `${get('year')}-${get('month')}-${get('day')}`;
    }

    // Build flight-aware per-day timezone map (mirrors client-side dayTimezoneMap in src/pages/Timeline.tsx)
    const flightEntries = entries
      .filter((e: any) => {
        const opt = optionsByEntry.get(e.id);
        return opt?.category === 'flight' && opt?.departure_tz && opt?.arrival_tz;
      })
      .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    // Start with home timezone, or first flight's departure TZ
    let currentDayTz = homeTimezone;
    if (flightEntries.length > 0) {
      const firstFlightOpt = optionsByEntry.get(flightEntries[0].id);
      if (firstFlightOpt?.departure_tz) currentDayTz = firstFlightOpt.departure_tz;
    }

    // Build per-day TZ map by processing flights chronologically
    const perDayTz = new Map<string, string>();
    const allDayStrs = new Set<string>();
    for (const entry of entries) {
      allDayStrs.add(getDateInTz(entry.start_time, currentDayTz));
    }
    // First pass: assign current TZ to all days
    for (const dayStr of [...allDayStrs].sort()) {
      perDayTz.set(dayStr, currentDayTz);
    }
    // Second pass: update TZ based on flight arrivals
    let runningTz = currentDayTz;
    for (const flight of flightEntries) {
      const flightOpt = optionsByEntry.get(flight.id);
      const arrivalDay = getDateInTz(flight.end_time, flightOpt?.arrival_tz || runningTz);
      runningTz = flightOpt?.arrival_tz || runningTz;
      // All days from arrival day onward use the new TZ
      for (const dayStr of [...allDayStrs].sort()) {
        if (dayStr >= arrivalDay) {
          perDayTz.set(dayStr, runningTz);
        }
      }
    }

    const dayGroups = new Map<string, any[]>();
    for (const entry of entries) {
      // Use per-day resolved TZ for grouping
      const dayStr = getDateInTz(entry.start_time, perDayTz.get(getDateInTz(entry.start_time, currentDayTz)) || currentDayTz);
      if (!dayGroups.has(dayStr)) dayGroups.set(dayStr, []);
      dayGroups.get(dayStr)!.push(entry);
    }

    const created: any[] = [];
    const overlaps: any[] = [];

    // 4. Process each day
    for (const [dayStr, dayEntries] of dayGroups) {
      // Build maps of flight -> checkout end times and checkin start times
      const flightCheckoutEnd = new Map<string, string>();
      const flightCheckinStart = new Map<string, string>();
      for (const e of dayEntries) {
        if (e.linked_type === 'checkout' && e.linked_flight_id) {
          flightCheckoutEnd.set(e.linked_flight_id, e.end_time);
        }
        if (e.linked_type === 'checkin' && e.linked_flight_id) {
          flightCheckinStart.set(e.linked_flight_id, e.start_time);
        }
      }

      // Filter out checkin/checkout (they're part of flight groups)
      const mainEntries = dayEntries.filter((e: any) =>
        e.linked_type !== 'checkin' && e.linked_type !== 'checkout'
      );

      // Sort by start_time
      mainEntries.sort((a: any, b: any) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );

      for (let i = 0; i < mainEntries.length - 1; i++) {
        const entryA = mainEntries[i];
        const entryB = mainEntries[i + 1];
        const optA = optionsByEntry.get(entryA.id);
        const optB = optionsByEntry.get(entryB.id);

        if (!optA || !optB) continue;

        // Guard A: Skip transport-like categories
        const transportLike = ['transfer', 'travel', 'transport'];
        if (transportLike.includes(optA.category) || transportLike.includes(optB.category)) continue;

        // Check if transport already exists between them
        const existingTransport = mainEntries.find((e: any) => {
          const opt = optionsByEntry.get(e.id);
          if (opt?.category !== 'transfer') return false;
          const eStart = new Date(e.start_time).getTime();
          return eStart >= new Date(entryA.end_time).getTime() &&
                 eStart <= new Date(entryB.start_time).getTime();
        });
        if (existingTransport) continue;

        // Resolve locations
        const fromLoc = resolveFromLocation(optA);
        const toLoc = resolveToLocation(optB);

        if (!fromLoc || !toLoc) {
          console.log(`Skipping ${entryA.id} -> ${entryB.id}: missing location`);
          continue;
        }

        // Use checkout end_time for flights (transport starts after checkout, not flight end)
        const transportStartTime = (optA.category === 'flight')
          ? (flightCheckoutEnd.get(entryA.id) || entryA.end_time)
          : entryA.end_time;

        // Use checkin start_time as deadline for destination flights
        const deadlineTime = (optB.category === 'flight')
          ? (flightCheckinStart.get(entryB.id) || entryB.start_time)
          : entryB.start_time;

        // Guard B: Skip if no effective gap (start >= deadline)
        if (new Date(transportStartTime).getTime() >= new Date(deadlineTime).getTime()) {
          console.log(`Skipping ${entryA.id} -> ${entryB.id}: no effective gap`);
          continue;
        }

        // Guard C: Skip if entryB is a flight and its linked checkin already bridges the gap
        if (optB.category === 'flight' && flightCheckinStart.has(entryB.id)) {
          const checkinStart = new Date(flightCheckinStart.get(entryB.id)!).getTime();
          if (checkinStart <= new Date(transportStartTime).getTime()) {
            console.log(`Skipping ${entryA.id} -> ${entryB.id}: checkin already bridges gap`);
            continue;
          }
        }

        // Fetch walking + transit directions
        const departureTime = transportStartTime;
        const [walkResult, transitResult] = await Promise.all([
          fetchMode(GOOGLE_MAPS_API_KEY, fromLoc, toLoc, 'WALK', departureTime),
          fetchMode(GOOGLE_MAPS_API_KEY, fromLoc, toLoc, 'TRANSIT', departureTime),
        ]);

        // Determine best mode
        let selected: ModeResult | null = null;
        if (walkResult && walkResult.duration_min <= walkThreshold) {
          selected = walkResult;
        } else if (transitResult) {
          selected = transitResult;
        } else if (walkResult) {
          selected = walkResult;
        }

        if (!selected) {
          console.log(`No route found ${entryA.id} -> ${entryB.id}`);
          continue;
        }

        // Determine emoji for mode
        const modeEmoji: Record<string, string> = {
          walk: '🚶',
          transit: '🚇',
          drive: '🚗',
          bicycle: '🚲',
        };
        const emoji = modeEmoji[selected.mode] || '🚶';

        // Build transport entry - start at checkout end (for flights) or entryA end
        const transportDuration = Math.max(ceilTo5(selected.duration_min), 5);
        const startTime = transportStartTime;
        const endTimeMs = new Date(startTime).getTime() + transportDuration * 60000;
        const endTime = new Date(endTimeMs).toISOString();

        // Short destination name
        const destName = getLocationName(optB, 'to');
        const shortDest = destName.length > 25 ? destName.substring(0, 25) + '…' : destName;

        // Create the entry
        const { data: newEntry, error: entryInsertErr } = await supabase
          .from('entries')
          .insert({
            trip_id: tripId,
            start_time: startTime,
            end_time: endTime,
            is_scheduled: true,
            is_locked: false,
          })
          .select('id')
          .single();
        if (entryInsertErr || !newEntry) {
          console.error('Failed to insert transport entry:', entryInsertErr);
          continue;
        }

        // Create the option
        const { error: optInsertErr } = await supabase
          .from('entry_options')
          .insert({
            entry_id: newEntry.id,
            name: `${emoji} ${selected.mode.charAt(0).toUpperCase() + selected.mode.slice(1)} to ${shortDest}`,
            category: 'transfer',
            category_color: '#f97316',
            location_name: destName,
            departure_location: getLocationName(optA, 'from'),
            arrival_location: destName,
            distance_km: selected.distance_km,
            route_polyline: selected.polyline,
          });
        if (optInsertErr) {
          console.error('Failed to insert transport option:', optInsertErr);
        }

        created.push({
          id: newEntry.id,
          start_time: startTime,
          end_time: endTime,
          mode: selected.mode,
          duration_min: selected.duration_min,
          from_entry_id: entryA.id,
          to_entry_id: entryB.id,
        });

        // Detect overlap with next entry
        if (new Date(endTime).getTime() > new Date(entryB.start_time).getTime()) {
          overlaps.push({
            transport_id: newEntry.id,
            transport_end: endTime,
            blocked_entry_id: entryB.id,
            blocked_start: entryB.start_time,
            overlap_min: Math.ceil((new Date(endTime).getTime() - new Date(entryB.start_time).getTime()) / 60000),
          });
        }
      }
    }

    console.log(`Created ${created.length} transport entries, ${overlaps.length} overlaps detected`);

    return new Response(
      JSON.stringify({ created, overlaps }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

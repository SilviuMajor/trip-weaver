import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { EntryWithOptions } from '@/types/trip';

interface TravelResult {
  fromEntryId: string;
  toEntryId: string;
  durationMin: number;
  distanceKm: number;
}

export function useTravelCalculation() {
  const calculateTravel = useCallback(async (
    placedEntry: EntryWithOptions,
    prevEntry: EntryWithOptions | null,
    nextEntry: EntryWithOptions | null,
  ): Promise<{ prevTravel: TravelResult | null; nextTravel: TravelResult | null }> => {
    let prevTravel: TravelResult | null = null;
    let nextTravel: TravelResult | null = null;

    const promises: Promise<void>[] = [];

    const getCoords = (entry: EntryWithOptions) => {
      const opt = entry.options[0];
      if (opt?.latitude && opt?.longitude) {
        return { lat: opt.latitude, lng: opt.longitude };
      }
      if (opt?.location_name) return { address: opt.location_name };
      if (opt?.departure_location) return { address: opt.departure_location };
      return null;
    };

    const placedCoords = getCoords(placedEntry);

    if (prevEntry && placedCoords) {
      const prevCoords = getCoords(prevEntry);
      if (prevCoords) {
        promises.push(
          fetchDirections(prevCoords, placedCoords).then(result => {
            if (result) {
              prevTravel = {
                fromEntryId: prevEntry.id,
                toEntryId: placedEntry.id,
                ...result,
              };
            }
          })
        );
      }
    }

    if (nextEntry && placedCoords) {
      const nextCoords = getCoords(nextEntry);
      if (nextCoords) {
        promises.push(
          fetchDirections(placedCoords, nextCoords).then(result => {
            if (result) {
              nextTravel = {
                fromEntryId: placedEntry.id,
                toEntryId: nextEntry.id,
                ...result,
              };
            }
          })
        );
      }
    }

    await Promise.all(promises);
    return { prevTravel, nextTravel };
  }, []);

  return { calculateTravel };
}

async function fetchDirections(
  from: { lat?: number; lng?: number; address?: string },
  to: { lat?: number; lng?: number; address?: string },
): Promise<{ durationMin: number; distanceKm: number } | null> {
  try {
    const fromAddr = from.address ?? `${from.lat},${from.lng}`;
    const toAddr = to.address ?? `${to.lat},${to.lng}`;

    const { data, error } = await supabase.functions.invoke('google-directions', {
      body: { fromAddress: fromAddr, toAddress: toAddr, mode: 'transit' },
    });

    if (error || !data?.duration_min) return null;
    return { durationMin: data.duration_min, distanceKm: data.distance_km ?? 0 };
  } catch {
    return null;
  }
}
